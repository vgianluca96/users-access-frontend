import { useEffect, useMemo, useState } from 'react';
import { faSpinner, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { apiClient } from '../lib/api';
import { useAppStore } from '../store/useAppStore';
import type { CapabilityDetail, GrantCapabilityDetail, GrantCapabilityUpdateEntry } from '../types';
import { buildClientsById, buildOrganizationsById, type ScopeKind } from '../lib/accessScope';

interface GrantEditorDialogProps {
  grantId: number | null;
  onClose: () => void;
}

interface MatrixRow {
  resourceId: number;
  resourceName: string;
  cellsByActionId: Map<number, CapabilityDetail>;
}

interface MatrixColumn {
  actionId: number;
  actionName: string;
}

type BadgeState = 'preset' | 'added' | 'denied' | 'neutral';
type PendingColor = 'red' | 'blue' | 'green';
type Baseline = Pick<GrantCapabilityDetail, 'preset' | 'added' | 'denied'>;
// spec006 §7: 0 = no bulk override applied (baseline), 1 = row/column forced
// to "added", 2 = forced to "denied" — clicking cycles 0 → 1 → 2 → 0.
type RowCycleState = 0 | 1 | 2;

const ADDED_TARGET: Baseline = { preset: false, added: true, denied: false };
const REMOVED_TARGET: Baseline = { preset: false, added: false, denied: false };

function buildMatrix(capabilities: CapabilityDetail[]): { rows: MatrixRow[]; columns: MatrixColumn[] } {
  const rowsByResourceId = new Map<number, MatrixRow>();
  const columnsByActionId = new Map<number, string>();

  for (const capability of capabilities) {
    if (!rowsByResourceId.has(capability.resourceId)) {
      rowsByResourceId.set(capability.resourceId, {
        resourceId: capability.resourceId,
        resourceName: capability.resourceName,
        cellsByActionId: new Map(),
      });
    }

    rowsByResourceId.get(capability.resourceId)!.cellsByActionId.set(capability.actionId, capability);
    columnsByActionId.set(capability.actionId, capability.actionName);
  }

  const rows = Array.from(rowsByResourceId.values()).sort((a, b) => a.resourceId - b.resourceId);
  const columns = Array.from(columnsByActionId.entries())
    .map(([actionId, actionName]) => ({ actionId, actionName }))
    .sort((a, b) => a.actionId - b.actionId);

  return { rows, columns };
}

function badgeStateFor(baseline: Baseline | undefined): BadgeState {
  if (!baseline) return 'neutral';
  if (baseline.added) return 'added';
  if (baseline.denied) return 'denied';
  if (baseline.preset) return 'preset';
  return 'neutral';
}

// spec006 §7: derives the pending ring color from the override's own shape,
// not from the baseline it's overriding — this is what lets one function
// cover both individual-click targets (spec005 §2) and bulk row/column
// targets (spec006 §7) uniformly.
function pendingColorForOverride(override: Baseline): PendingColor {
  if (override.added) return 'green';
  if (override.denied) return 'red';
  if (override.preset) return 'blue';
  return 'red';
}

// spec005 §2's four individual-click transitions, keyed off the capability's
// current baseline state.
function computeIndividualClickTarget(base: Baseline): Baseline {
  const state = badgeStateFor(base);
  if (state === 'preset') return { preset: true, added: false, denied: true };
  if (state === 'denied') return { preset: true, added: false, denied: false };
  if (state === 'neutral') return ADDED_TARGET;
  return REMOVED_TARGET;
}

// spec005 §1/§2: background reflects the immutable baseline (never changes on
// click); a constant-width border also reflects baseline — only the inset
// ring (spec006 §6) changes with a pending click, so dimensions never shift.
const BADGE_BACKGROUND_CLASSES: Record<BadgeState, string> = {
  preset: 'bg-blue-100 text-blue-800',
  added: 'bg-green-100 text-green-800',
  denied: 'bg-red-100 text-red-800',
  neutral: 'bg-transparent text-slate-500',
};

const DEFAULT_BORDER_CLASSES: Record<BadgeState, string> = {
  preset: 'border border-blue-500',
  added: 'border border-green-500',
  denied: 'border border-red-500',
  neutral: 'border border-slate-900',
};

// spec006 §6: inset ring (box-shadow), not a border — never affects layout.
const PENDING_RING_CLASSES: Record<PendingColor, string> = {
  red: 'ring-4 ring-inset ring-red-600',
  blue: 'ring-4 ring-inset ring-blue-600',
  green: 'ring-4 ring-inset ring-green-600',
};

const LEGEND_BACKGROUND_ITEMS: Array<{ state: BadgeState; label: string }> = [
  { state: 'preset', label: 'Preset' },
  { state: 'added', label: 'Added' },
  { state: 'denied', label: 'Denied' },
  { state: 'neutral', label: 'Neutral' },
];

const LEGEND_BORDER_ITEMS: Array<{ color: PendingColor; label: string }> = [
  { color: 'red', label: 'Will be removed / denied' },
  { color: 'blue', label: 'Will be restored to preset' },
  { color: 'green', label: 'Will be added' },
];

// spec006 §5: Save's payload is now a direct read of pendingOverride (already
// holds the literal target) falling back to baseline — no more re-deriving a
// target from a color, since the override itself is the target.
function computeFinalCapabilities(
  baseline: Map<number, Baseline>,
  pendingOverride: Map<number, Baseline>,
): GrantCapabilityUpdateEntry[] {
  const capabilityIds = new Set([...baseline.keys(), ...pendingOverride.keys()]);
  const result: GrantCapabilityUpdateEntry[] = [];

  for (const capabilityId of capabilityIds) {
    const final = pendingOverride.get(capabilityId) ?? baseline.get(capabilityId) ?? REMOVED_TARGET;

    if (final.preset || final.added || final.denied) {
      result.push({ capabilityId, ...final });
    }
  }

  return result;
}

/**
 * spec003 §10 / spec004 §6 / spec005 / spec006: the gear-icon "Settings"
 * dialog. `capabilities`/`roles`/`rolePresetCapabilities` come from the
 * global store (spec004 §4) — this dialog's own fetches are
 * `GET /grant-capabilities?grantId=` on open and `PATCH .../grant-capabilities`
 * on Save.
 *
 * spec005: background color is the immutable "current status" (baseline),
 * never changed by clicking a badge — only the border ring (spec006 §6,
 * inset so dimensions never change) reflects a pending click. The baseline
 * itself is only replaced wholesale when the Role Preset dropdown changes
 * (spec005 §3), which also applies a forced blue highlight — tracked
 * separately from click-driven `pendingOverride` so Save doesn't
 * misinterpret it.
 *
 * spec006 §7: resource/action names are also clickable, applying a bulk
 * target to every capability in that row/column via the same
 * `pendingOverride` state individual badge clicks use.
 */
export function GrantEditorDialog({ grantId, onClose }: GrantEditorDialogProps) {
  const accessGrantSummaries = useAppStore((state) => state.accessGrantSummaries);
  const orgMemberships = useAppStore((state) => state.orgMemberships);
  const clientMemberships = useAppStore((state) => state.clientMemberships);
  const projects = useAppStore((state) => state.projects);
  const organizations = useAppStore((state) => state.organizations);
  const roles = useAppStore((state) => state.roles);
  const capabilities = useAppStore((state) => state.capabilities);
  const rolePresetCapabilities = useAppStore((state) => state.rolePresetCapabilities);

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

  const grant = useMemo(
    () => accessGrantSummaries.find((candidate) => candidate.grantId === grantId) ?? null,
    [accessGrantSummaries, grantId],
  );

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

  const { rows, columns } = buildMatrix(capabilities);
  const hasPendingChanges = pendingOverride.size > 0 || hasRoleChanged;

  // spec005 §2: clicking an individual badge toggles its override on/off.
  function toggleCapability(capabilityId: number) {
    setPendingOverride((current) => {
      const next = new Map(current);
      if (next.has(capabilityId)) {
        next.delete(capabilityId);
      } else {
        next.set(capabilityId, computeIndividualClickTarget(baseline.get(capabilityId) ?? REMOVED_TARGET));
      }
      return next;
    });
  }

  // spec006 §7: applies one step of the shared 3-state cycle (added → denied
  // → reset) to a set of capabilities — used by both row and column clicks.
  function applyCycleTargets(capabilityIds: number[], nextState: RowCycleState) {
    setPendingOverride((current) => {
      const next = new Map(current);

      for (const capabilityId of capabilityIds) {
        if (nextState === 0) {
          next.delete(capabilityId);
        } else if (nextState === 1) {
          next.set(capabilityId, ADDED_TARGET);
        } else {
          const preservedPreset = baseline.get(capabilityId)?.preset ?? false;
          next.set(capabilityId, { preset: preservedPreset, added: false, denied: true });
        }
      }

      return next;
    });
  }

  // spec006 §7: clicking a resource name cycles the whole row through
  // added → denied → reset.
  function toggleRow(row: MatrixRow) {
    const capabilityIds = Array.from(row.cellsByActionId.values()).map((capability) => capability.id);
    const nextState = (((rowCycleState.get(row.resourceId) ?? 0) + 1) % 3) as RowCycleState;

    setRowCycleState((current) => new Map(current).set(row.resourceId, nextState));
    applyCycleTargets(capabilityIds, nextState);
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
    applyCycleTargets(capabilityIds, nextState);
  }

  // spec005 §3: full reset, not a merge — added/denied are discarded, the new
  // role's bundle becomes the entire baseline, and those bundle capabilities
  // get a forced thicker blue highlight (not a click-derived override).
  function handleRoleChange(newRoleId: number | null) {
    setSelectedRoleId(newRoleId);
    setHasRoleChanged(true);

    const bundleCapabilityIds =
      newRoleId === null
        ? []
        : rolePresetCapabilities
            .filter((preset) => preset.roleId === newRoleId)
            .map((preset) => preset.capabilityId);

    const nextBaseline = new Map<number, Baseline>();

    for (const capabilityId of bundleCapabilityIds) {
      nextBaseline.set(capabilityId, { preset: true, added: false, denied: false });
    }

    setBaseline(nextBaseline);
    setPendingOverride(new Map());
    setRowCycleState(new Map());
        setColumnCycleState(new Map());
    setRoleSwitchHighlight(new Set(bundleCapabilityIds));
  }

  // spec006 §5: Save.
  function handleSave() {
    if (grantId === null) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    apiClient
      .patch<GrantCapabilityDetail[]>(
        '/grant-capabilities',
        { capabilities: computeFinalCapabilities(baseline, pendingOverride) },
        { params: { grantId } },
      )
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
            Edit access grant{grant ? ` — ${grant.email}` : ''}
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

              {/* spec005 §4: legend for both color channels. */}
              <div className="mb-3 flex flex-wrap gap-x-6 gap-y-2 text-xs text-slate-600">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-medium text-slate-500">Background:</span>
                  {LEGEND_BACKGROUND_ITEMS.map((item) => (
                    <span key={item.state} className="flex items-center gap-1.5">
                      <span
                        className={`h-3 w-3 rounded-full ${DEFAULT_BORDER_CLASSES[item.state]} ${BADGE_BACKGROUND_CLASSES[item.state]}`}
                      />
                      {item.label}
                    </span>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-medium text-slate-500">Border (pending):</span>
                  {LEGEND_BORDER_ITEMS.map((item) => (
                    <span key={item.color} className="flex items-center gap-1.5">
                      <span className={`h-3 w-3 rounded-full bg-white ${PENDING_RING_CLASSES[item.color]}`} />
                      {item.label}
                    </span>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto rounded border border-slate-200">
                <table className="w-full min-w-[480px] text-left text-sm">
                  <thead className="bg-slate-100 text-slate-600">
                    <tr>
                      <th className="px-3 py-2 font-medium">Resource</th>
                      {columns.map((column) => {
                        const columnState = columnCycleState.get(column.actionId) ?? 0;
                        const columnRingClass =
                          columnState === 1
                            ? PENDING_RING_CLASSES.green
                            : columnState === 2
                              ? PENDING_RING_CLASSES.red
                              : '';

                        return (
                          <th key={column.actionId} className="px-3 py-2 font-medium">
                            <button
                              type="button"
                              onClick={() => toggleColumn(column, rows)}
                              title="Click to cycle: add column, deny column, reset column"
                              className={`cursor-pointer rounded px-1.5 py-0.5 hover:bg-slate-200 ${columnRingClass}`}
                            >
                              {column.actionName}
                            </button>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row) => {
                      const rowState = rowCycleState.get(row.resourceId) ?? 0;
                      const rowRingClass =
                        rowState === 1
                          ? PENDING_RING_CLASSES.green
                          : rowState === 2
                            ? PENDING_RING_CLASSES.red
                            : '';

                      return (
                        <tr key={row.resourceId}>
                          <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-700">
                            <button
                              type="button"
                              onClick={() => toggleRow(row)}
                              title="Click to cycle: add row, deny row, reset row"
                              className={`cursor-pointer rounded px-1.5 py-0.5 hover:bg-slate-100 ${rowRingClass}`}
                            >
                              {row.resourceName}
                            </button>
                          </td>
                          {columns.map((column) => {
                            const capability = row.cellsByActionId.get(column.actionId);

                            if (!capability) {
                              return <td key={column.actionId} className="px-3 py-2" />;
                            }

                            const state = badgeStateFor(baseline.get(capability.id));
                            const override = pendingOverride.get(capability.id);
                            const borderClass = override
                              ? PENDING_RING_CLASSES[pendingColorForOverride(override)]
                              : roleSwitchHighlight.has(capability.id)
                                ? PENDING_RING_CLASSES.blue
                                : DEFAULT_BORDER_CLASSES[state];

                            return (
                              <td key={column.actionId} className="px-3 py-2">
                                <button
                                  type="button"
                                  onClick={() => toggleCapability(capability.id)}
                                  title={`${row.resourceName}:${column.actionName}`}
                                  className={`cursor-pointer rounded-full px-2 py-1 text-xs font-medium ${BADGE_BACKGROUND_CLASSES[state]} ${borderClass}`}
                                >
                                  {column.actionName}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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
