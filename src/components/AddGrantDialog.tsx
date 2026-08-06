import { useMemo, useState } from 'react';
import { faSpinner, faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { apiClient } from '../lib/api';
import { getLoggedInUser } from '../lib/mockUser';
import { isValidEmail } from '../lib/validation';
import { useAppStore } from '../store/useAppStore';
import type {
  AccessGrantSummary,
  CreateGrantRequestBody,
  CreateUserRequestBody,
  User,
} from '../types';
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

interface AddGrantDialogProps {
  onClose: () => void;
}

/**
 * spec007 §2-5: the "Add new grant" dialog. Step 1 collects a brand-new
 * user's email + display name; step 2 reuses the same scope/role-preset/
 * capability-matrix UI as `GrantEditorDialog.tsx` (via `lib/capabilityMatrix.ts`
 * + `CapabilityMatrix.tsx`), starting from a fully neutral/empty state
 * instead of prefilling from an existing grant. Save runs two requests in
 * sequence — POST /user then POST /grant-capabilities (spec007 §5).
 */
export function AddGrantDialog({ onClose }: AddGrantDialogProps) {
  const orgMemberships = useAppStore((state) => state.orgMemberships);
  const clientMemberships = useAppStore((state) => state.clientMemberships);
  const projects = useAppStore((state) => state.projects);
  const organizations = useAppStore((state) => state.organizations);
  const roles = useAppStore((state) => state.roles);
  const capabilities = useAppStore((state) => state.capabilities);
  const rolePresetCapabilities = useAppStore((state) => state.rolePresetCapabilities);
  const addAccessGrantSummary = useAppStore((state) => state.addAccessGrantSummary);

  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 fields.
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');

  // Step 2 — same shape as GrantEditorDialog, all starting neutral/unselected
  // (spec007 §4) instead of prefilled from a fetched grant.
  const [scopeKind, setScopeKind] = useState<ScopeKind>('org');
  const [scopeEntityId, setScopeEntityId] = useState<number | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [baseline, setBaseline] = useState<Map<number, Baseline>>(new Map());
  const [pendingOverride, setPendingOverride] = useState<Map<number, Baseline>>(new Map());
  const [rowCycleState, setRowCycleState] = useState<Map<number, RowCycleState>>(new Map());
  const [columnCycleState, setColumnCycleState] = useState<Map<number, RowCycleState>>(new Map());
  const [roleSwitchHighlight, setRoleSwitchHighlight] = useState<Set<number>>(new Set());

  // spec007 §5, resolved retry behavior: once Step A (POST /user) succeeds,
  // its result is remembered so a retry after a Step B failure only re-sends
  // Step B, rather than re-running Step A against the now-existing email.
  const [createdUser, setCreatedUser] = useState<{ id: number; email: string } | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const organizationsById = useMemo(() => buildOrganizationsById(organizations), [organizations]);
  const clientsById = useMemo(() => buildClientsById(organizations), [organizations]);

  const orgOptions = Array.from(new Set(orgMemberships.map((membership) => membership.orgId))).map((id) => ({
    id,
    name: organizationsById.get(id)?.name ?? `Organization ${id}`,
  }));
  const clientOptions = Array.from(new Set(clientMemberships.map((membership) => membership.clientId))).map(
    (id) => ({ id, name: clientsById.get(id)?.name ?? `Client ${id}` }),
  );
  const projectOptions = projects.map((project) => ({ id: project.id, name: project.name }));

  const scopeEntityOptions =
    scopeKind === 'org' ? orgOptions : scopeKind === 'client' ? clientOptions : projectOptions;

  const isEmailValid = isValidEmail(email.trim());
  const canGoToStep2 = isEmailValid && displayName.trim().length > 0;

  const finalCapabilities = computeFinalCapabilities(baseline, pendingOverride);
  const canSave = scopeEntityId !== null && finalCapabilities.length > 0;

  function toggleCapability(capabilityId: number) {
    setPendingOverride((current) => toggleCapabilityOverride(current, capabilityId, baseline));
  }

  function toggleRow(row: MatrixRow) {
    const capabilityIds = Array.from(row.cellsByActionId.values()).map((capability) => capability.id);
    const nextState = (((rowCycleState.get(row.resourceId) ?? 0) + 1) % 3) as RowCycleState;

    setRowCycleState((current) => new Map(current).set(row.resourceId, nextState));
    setPendingOverride((current) => applyCycleToOverride(current, capabilityIds, nextState, baseline));
  }

  function toggleColumn(column: MatrixColumn, matrixRows: MatrixRow[]) {
    const capabilityIds = matrixRows.flatMap((row) => {
      const capability = row.cellsByActionId.get(column.actionId);
      return capability ? [capability.id] : [];
    });
    const nextState = (((columnCycleState.get(column.actionId) ?? 0) + 1) % 3) as RowCycleState;

    setColumnCycleState((current) => new Map(current).set(column.actionId, nextState));
    setPendingOverride((current) => applyCycleToOverride(current, capabilityIds, nextState, baseline));
  }

  // spec007 §4: choosing a role preset fills the (until-now empty) baseline
  // with that role's bundle — same "full reset" rule as GrantEditorDialog's
  // Role Preset change (spec005 §3).
  function handleRoleChange(newRoleId: number | null) {
    setSelectedRoleId(newRoleId);

    const nextBaseline = buildRoleBundleBaseline(rolePresetCapabilities, newRoleId);

    setBaseline(nextBaseline);
    setPendingOverride(new Map());
    setRowCycleState(new Map());
    setColumnCycleState(new Map());
    setRoleSwitchHighlight(new Set(nextBaseline.keys()));
  }

  // spec007 §5 Step A — resolves the membership scope/entity to send to
  // POST /user. Project scope maps to its owning client (resolved decision).
  function resolveUserMembershipTarget(): { scope: 'Org' | 'Client'; orgId: number | null; clientId: number | null } {
    if (scopeKind === 'org') {
      return { scope: 'Org', orgId: scopeEntityId, clientId: null };
    }

    if (scopeKind === 'client') {
      return { scope: 'Client', orgId: null, clientId: scopeEntityId };
    }

    const project = projects.find((candidate) => candidate.id === scopeEntityId);
    return { scope: 'Client', orgId: null, clientId: project?.clientId ?? null };
  }

  async function handleSave() {
    if (!canSave || isSaving) {
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      let user = createdUser;

      if (!user) {
        const membershipTarget = resolveUserMembershipTarget();
        const body: CreateUserRequestBody = {
          email: email.trim(),
          displayName: displayName.trim(),
          scope: membershipTarget.scope,
          orgId: membershipTarget.orgId,
          clientId: membershipTarget.clientId,
          roleId: selectedRoleId,
          invitedByUserId: getLoggedInUser().id,
        };
        const response = await apiClient.post<{ user: User }>('/user', body);
        user = { id: response.data.user.id as number, email: response.data.user.email };
        setCreatedUser(user);
      }

      const grantBody: CreateGrantRequestBody = {
        orgId: scopeKind === 'org' ? scopeEntityId : null,
        clientId: scopeKind === 'client' ? scopeEntityId : null,
        projectId: scopeKind === 'project' ? scopeEntityId : null,
        email: user.email,
        roleId: selectedRoleId,
        grantCapabilities: finalCapabilities,
      };
      const grantResponse = await apiClient.post<{ grant: AccessGrantSummary }>(
        '/grant-capabilities',
        grantBody,
      );

      addAccessGrantSummary(grantResponse.data.grant);
      onClose();
    } catch {
      setSaveError('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-800">
            Add new grant — Step {step} of 2
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

        {step === 1 ? (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col text-sm font-medium text-slate-600">
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                className="mt-1 rounded border border-slate-300 px-3 py-2 text-slate-800"
              />
              {email.length > 0 && !isEmailValid && (
                <span className="mt-1 text-xs text-red-600">Enter a valid email address.</span>
              )}
            </label>

            <label className="flex flex-col text-sm font-medium text-slate-600">
              User Name
              <input
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Jane Doe"
                className="mt-1 rounded border border-slate-300 px-3 py-2 text-slate-800"
              />
            </label>

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
                onClick={() => setStep(2)}
                disabled={!canGoToStep2}
                className={`rounded px-4 py-2 ${
                  canGoToStep2
                    ? 'bg-slate-800 text-white hover:bg-slate-700'
                    : 'cursor-not-allowed bg-slate-300 text-slate-500'
                }`}
              >
                Next
              </button>
            </div>
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
                which one. Required.
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
                Base this grant's capabilities on a role, or choose None to pick capabilities
                manually.
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
                Pick at least one capability, on top of or instead of the role preset above.
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
                disabled={!canSave || isSaving}
                className={`flex items-center gap-2 rounded px-4 py-2 ${
                  !canSave || isSaving
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
