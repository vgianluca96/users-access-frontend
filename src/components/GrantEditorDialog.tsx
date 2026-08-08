import { useEffect, useMemo, useState } from 'react';
import { faSpinner, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { apiClient } from '../lib/api';
import { useAppStore } from '../store/useAppStore';
import type { GrantCapabilitiesPatchRequestBody, GrantCapabilityDetail } from '../types';
import { isIntegrationAccessGrantSummary } from '../lib/accessScope';
import { buildClientsById, buildOrganizationsById, type ScopeKind } from '../lib/accessScope';
import {
  applyCycleToOverride,
  buildRoleBundleBaseline,
  computeFinalCapabilities,
  toggleCapabilityOverride,
  type Baseline,
  type MatrixColumn,
  type MatrixRow,
  type RowCycleState,
} from '../lib/capabilityMatrix';
import { CapabilityMatrix } from './CapabilityMatrix';

interface GrantEditorDialogProps {
  grantId: number | null;
  onClose: () => void;
}

/**
 * spec003 §10 / spec004 §6 / spec005 / spec006: the gear-icon "Settings"
 * dialog. `capabilities`/`roles`/`rolePresetCapabilities` come from the
 * global store (spec004 §4) — this dialog's own fetches are
 * `GET /grant-capabilities?grantId=` on open and `PATCH .../grant-capabilities`
 * on Save.
 *
 * The "Select Capabilities" matrix (baseline/pendingOverride/legend/table)
 * is shared with `AddGrantDialog.tsx` (spec007 §4) via
 * `lib/capabilityMatrix.ts` + `CapabilityMatrix.tsx` — see those for the
 * click-model details (spec005 §2, spec006 §7).
 */
export function GrantEditorDialog({ grantId, onClose }: GrantEditorDialogProps) {
  const accessGrantSummaries = useAppStore((state) => state.accessGrantSummaries);
  const integrationAccessGrantSummaries = useAppStore(
    (state) => state.integrationAccessGrantSummaries,
  );
  const orgMemberships = useAppStore((state) => state.orgMemberships);
  const clientMemberships = useAppStore((state) => state.clientMemberships);
  const projects = useAppStore((state) => state.projects);
  const organizations = useAppStore((state) => state.organizations);
  const roles = useAppStore((state) => state.roles);
  const capabilities = useAppStore((state) => state.capabilities);
  const rolePresetCapabilities = useAppStore((state) => state.rolePresetCapabilities);
  const updateAccessGrantSummaryRole = useAppStore((state) => state.updateAccessGrantSummaryRole);
  const updateIntegrationAccessGrantSummaryRole = useAppStore(
    (state) => state.updateIntegrationAccessGrantSummaryRole,
  );

  const [isLoading, setIsLoading] = useState(false);
  // spec005: "current status" — drives background only. Replaced wholesale on
  // a Role Preset change (§3); never touched by a badge/row/column click.
  const [baseline, setBaseline] = useState<Map<number, Baseline>>(new Map());
  // spec005 §2 / spec006 §7: per-capability pending target — drives the inset
  // ring, and is what Save (spec006 §5) persists directly.
  const [pendingOverride, setPendingOverride] = useState<Map<number, Baseline>>(new Map());
  // spec006 §7: which row/column is at which point of its 3-click cycle.
  const [rowCycleState, setRowCycleState] = useState<Map<number, RowCycleState>>(new Map());
  const [columnCycleState, setColumnCycleState] = useState<Map<number, RowCycleState>>(new Map());
  // spec005 §3: capabilities highlighted blue by the *last role switch* —
  // rendering only, excluded from Save's payload (see computeFinalCapabilities).
  const [roleSwitchHighlight, setRoleSwitchHighlight] = useState<Set<number>>(new Set());
  const [hasRoleChanged, setHasRoleChanged] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [scopeKind, setScopeKind] = useState<ScopeKind>('org');
  const [scopeEntityId, setScopeEntityId] = useState<number | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);

  // spec010 §10: a grantId may belong to either summary list — the gear
  // button on both AccessGrantsTable and IntegrationAccessGrantsTable share
  // this same dialog via AccessEditorPage's one `editingGrantId` state.
  const grant = useMemo(
    () =>
      accessGrantSummaries.find((candidate) => candidate.grantId === grantId) ??
      integrationAccessGrantSummaries.find((candidate) => candidate.grantId === grantId) ??
      null,
    [accessGrantSummaries, integrationAccessGrantSummaries, grantId],
  );
  const grantSubjectLabel = grant
    ? isIntegrationAccessGrantSummary(grant)
      ? `${grant.integrationName} (${grant.provider})`
      : grant.email
    : '';

  const organizationsById = useMemo(() => buildOrganizationsById(organizations), [organizations]);
  const clientsById = useMemo(() => buildClientsById(organizations), [organizations]);

  useEffect(() => {
    if (grantId === null) {
      return;
    }

    setIsLoading(true);
    setSaveError(null);

    apiClient
      .get<GrantCapabilityDetail[]>('/grant-capabilities', { params: { grantId } })
      .then((response) => {
        setBaseline(
          new Map(
            response.data.map((row): [number, Baseline] => [
              row.capabilityId,
              { preset: row.preset, added: row.added, denied: row.denied },
            ]),
          ),
        );
        setPendingOverride(new Map());
        setRowCycleState(new Map());
        setColumnCycleState(new Map());
        setRoleSwitchHighlight(new Set());
        setHasRoleChanged(false);
      })
      .finally(() => setIsLoading(false));
  }, [grantId]);

  useEffect(() => {
    if (!grant) {
      return;
    }

    if (grant.orgId !== null) {
      setScopeKind('org');
      setScopeEntityId(grant.orgId);
    } else if (grant.clientId !== null) {
      setScopeKind('client');
      setScopeEntityId(grant.clientId);
    } else if (grant.projectId !== null) {
      setScopeKind('project');
      setScopeEntityId(grant.projectId);
    }

    setSelectedRoleId(grant.roleId);
  }, [grant]);

  if (grantId === null) {
    return null;
  }

  const hasPendingChanges = pendingOverride.size > 0 || hasRoleChanged;

  // spec005 §2: clicking an individual badge toggles its override on/off.
  function toggleCapability(capabilityId: number) {
    setPendingOverride((current) => toggleCapabilityOverride(current, capabilityId, baseline));
  }

  // spec006 §7: clicking a resource name cycles the whole row through
  // added → denied → reset.
  function toggleRow(row: MatrixRow) {
    const capabilityIds = Array.from(row.cellsByActionId.values()).map((capability) => capability.id);
    const nextState = (((rowCycleState.get(row.resourceId) ?? 0) + 1) % 3) as RowCycleState;

    setRowCycleState((current) => new Map(current).set(row.resourceId, nextState));
    setPendingOverride((current) => applyCycleToOverride(current, capabilityIds, nextState, baseline));
  }

  // spec006 §7 (updated): clicking an action name cycles the whole column
  // through added → denied → reset, identical to a resource name's cycle.
  function toggleColumn(column: MatrixColumn, matrixRows: MatrixRow[]) {
    const capabilityIds = matrixRows.flatMap((row) => {
      const capability = row.cellsByActionId.get(column.actionId);
      return capability ? [capability.id] : [];
    });
    const nextState = (((columnCycleState.get(column.actionId) ?? 0) + 1) % 3) as RowCycleState;

    setColumnCycleState((current) => new Map(current).set(column.actionId, nextState));
    setPendingOverride((current) => applyCycleToOverride(current, capabilityIds, nextState, baseline));
  }

  // spec005 §3: full reset, not a merge — added/denied are discarded, the new
  // role's bundle becomes the entire baseline, and those bundle capabilities
  // get a forced thicker blue highlight (not a click-derived override).
  function handleRoleChange(newRoleId: number | null) {
    setSelectedRoleId(newRoleId);
    setHasRoleChanged(true);

    const nextBaseline = buildRoleBundleBaseline(rolePresetCapabilities, newRoleId);

    setBaseline(nextBaseline);
    setPendingOverride(new Map());
    setRowCycleState(new Map());
    setColumnCycleState(new Map());
    setRoleSwitchHighlight(new Set(nextBaseline.keys()));
  }

  // spec006 §5: Save. Also sends/persists `roleId` now — fix for a gap where
  // changing Role Preset and saving updated the capability badges but never
  // the grant's own roleId (grant-capabilities-service.ts's doc comment).
  function handleSave() {
    if (grantId === null) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    const body: GrantCapabilitiesPatchRequestBody = {
      capabilities: computeFinalCapabilities(baseline, pendingOverride),
      roleId: selectedRoleId,
    };

    apiClient
      .patch<{ capabilities: GrantCapabilityDetail[]; roleId: number | null }>(
        '/grant-capabilities',
        body,
        { params: { grantId } },
      )
      .then((response) => {
        setBaseline(
          new Map(
            response.data.capabilities.map((row): [number, Baseline] => [
              row.capabilityId,
              { preset: row.preset, added: row.added, denied: row.denied },
            ]),
          ),
        );
        setPendingOverride(new Map());
        setRowCycleState(new Map());
        setColumnCycleState(new Map());
        setRoleSwitchHighlight(new Set());
        setHasRoleChanged(false);
        setSelectedRoleId(response.data.roleId);

        const roleName = roles.find((role) => role.id === response.data.roleId)?.name ?? null;
        // spec010 §10: dispatch to whichever store slice actually holds this
        // grantId, so both tables' "Preset Role" columns stay in sync.
        if (grant && isIntegrationAccessGrantSummary(grant)) {
          updateIntegrationAccessGrantSummaryRole(grantId, response.data.roleId, roleName);
        } else {
          updateAccessGrantSummaryRole(grantId, response.data.roleId, roleName);
        }
      })
      .catch(() => {
        setSaveError('Failed to save changes. Please try again.');
      })
      .finally(() => setIsSaving(false));
  }

  const orgOptions = Array.from(new Set(orgMemberships.map((membership) => membership.orgId))).map(
    (id) => ({ id, name: organizationsById.get(id)?.name ?? `Organization ${id}` }),
  );
  const clientOptions = Array.from(new Set(clientMemberships.map((membership) => membership.clientId))).map(
    (id) => ({ id, name: clientsById.get(id)?.name ?? `Client ${id}` }),
  );
  const projectOptions = projects.map((project) => ({ id: project.id, name: project.name }));

  const scopeEntityOptions =
    scopeKind === 'org' ? orgOptions : scopeKind === 'client' ? clientOptions : projectOptions;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-800">
            Edit access grant{grant ? ` — ${grantSubjectLabel}` : ''}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 hover:text-slate-700"
          >
            <FontAwesomeIcon icon={faXmark} size="lg" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <FontAwesomeIcon icon={faSpinner} spin size="2x" className="text-slate-500" />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {saveError && (
              <div className="flex items-center justify-between rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                <span>{saveError}</span>
                <button
                  type="button"
                  onClick={() => setSaveError(null)}
                  aria-label="Dismiss"
                  className="ml-3 text-red-500 hover:text-red-700"
                >
                  <FontAwesomeIcon icon={faXmark} />
                </button>
              </div>
            )}

            <section>
              <h3 className="font-medium text-slate-700">Scope</h3>
              <p className="mb-2 text-xs text-slate-500">
                Choose whether this grant applies to an organization, a client, or a project, and
                which one.
              </p>
              <div className="flex flex-wrap gap-3">
                <select
                  className="rounded border border-slate-300 px-3 py-2 text-slate-800"
                  value={scopeKind}
                  onChange={(event) => {
                    setScopeKind(event.target.value as ScopeKind);
                    setScopeEntityId(null);
                  }}
                >
                  <option value="org">Org</option>
                  <option value="client">Client</option>
                  <option value="project">Project</option>
                </select>
                <select
                  className="min-w-48 rounded border border-slate-300 px-3 py-2 text-slate-800"
                  value={scopeEntityId ?? ''}
                  onChange={(event) =>
                    setScopeEntityId(event.target.value === '' ? null : Number(event.target.value))
                  }
                >
                  <option value="">Select…</option>
                  {scopeEntityOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
              </div>
            </section>

            <section>
              <h3 className="font-medium text-slate-700">Role Preset</h3>
              <p className="mb-2 text-xs text-slate-500">
                Base this grant's capabilities on a role, or choose None to start from nothing.
              </p>
              <select
                className="min-w-48 rounded border border-slate-300 px-3 py-2 text-slate-800"
                value={selectedRoleId ?? ''}
                onChange={(event) =>
                  handleRoleChange(event.target.value === '' ? null : Number(event.target.value))
                }
              >
                <option value="">None</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </section>

            <section>
              <h3 className="font-medium text-slate-700">Select Capabilities</h3>
              <p className="text-xs text-slate-500">
                The capabilities this grant includes, on top of or instead of the role preset above.
              </p>
              <p className="mb-3 text-xs text-slate-500">
                Click a resource or action name to bulk-edit its whole row/column.
              </p>

              <CapabilityMatrix
                capabilities={capabilities}
                baseline={baseline}
                pendingOverride={pendingOverride}
                roleSwitchHighlight={roleSwitchHighlight}
                rowCycleState={rowCycleState}
                columnCycleState={columnCycleState}
                onToggleCapability={toggleCapability}
                onToggleRow={toggleRow}
                onToggleColumn={toggleColumn}
              />
            </section>

            <div className="mt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!hasPendingChanges || isSaving}
                className={`flex items-center gap-2 rounded px-4 py-2 ${
                  !hasPendingChanges || isSaving
                    ? 'cursor-not-allowed bg-slate-300 text-slate-500'
                    : 'bg-slate-800 text-white hover:bg-slate-700'
                }`}
              >
                {isSaving && <FontAwesomeIcon icon={faSpinner} spin />}
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
