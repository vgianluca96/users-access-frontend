import { useEffect, useMemo, useState } from 'react';
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
  IntegrationAccessGrantSummary,
  User,
} from '../types';
import { buildClientsById, buildOrganizationsById, isIntegrationAccessGrantSummary, type ScopeKind } from '../lib/accessScope';
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

type UserMode = 'new' | 'existing';
type TargetKind = 'user' | 'integration';

interface AddGrantDialogProps {
  onClose: () => void;
}

/**
 * spec007 §2-5, reworked by spec009 §3, extended by spec010 §8-9 into a
 * 3-step wizard. Step 1 (new, spec010 §8) asks whether the grant targets a
 * user or an integration — nothing preselected, Next disabled until chosen.
 * Step 2 branches: the user path is the original spec007/spec009 step 1
 * (new-vs-existing-user picker); the integration path (new, spec010 §9) is a
 * single "existing integration" dropdown, sourced from
 * `OrganizationOverview.integrations` already in the store — no creation of
 * a new integration, unlike the user path's "new user" option. Step 3 reuses
 * the same scope/role-preset/capability-matrix UI as `GrantEditorDialog.tsx`
 * (via `lib/capabilityMatrix.ts` + `CapabilityMatrix.tsx`) for both target
 * kinds, starting from a fully neutral/empty state.
 *
 * Save runs up to two requests in sequence for the user path — `POST /users`
 * (skipped for an existing user) then `POST /grant-capabilities` (spec007
 * §5, spec009 §1 renames `/user`→`/users`) — and exactly one for the
 * integration path, straight to `POST /grant-capabilities` with
 * `integrationId` instead of `email` (spec010 §5, confirmed: the existing
 * endpoint was extended rather than adding a dedicated one).
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
  const addIntegrationAccessGrantSummary = useAppStore(
    (state) => state.addIntegrationAccessGrantSummary,
  );

  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 — grant target kind. Starts unselected (spec010 §8): "if the user
  // does not choose, next button is disabled" requires a real empty state.
  const [targetKind, setTargetKind] = useState<TargetKind | null>(null);

  // Step 2 (user path) — new vs. existing user.
  const [userMode, setUserMode] = useState<UserMode>('new');
  const [visibleUsers, setVisibleUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [selectedExistingUserId, setSelectedExistingUserId] = useState<number | null>(null);

  // Step 2 (user path) — "new user" fields.
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');

  // Step 2 (integration path) — existing integration picker (spec010 §9).
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<number | null>(null);

  // Step 3 — same shape as GrantEditorDialog, all starting neutral/unselected
  // (spec007 §4) instead of prefilled from a fetched grant.
  const [scopeKind, setScopeKind] = useState<ScopeKind>('org');
  const [scopeEntityId, setScopeEntityId] = useState<number | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [baseline, setBaseline] = useState<Map<number, Baseline>>(new Map());
  const [pendingOverride, setPendingOverride] = useState<Map<number, Baseline>>(new Map());
  const [rowCycleState, setRowCycleState] = useState<Map<number, RowCycleState>>(new Map());
  const [columnCycleState, setColumnCycleState] = useState<Map<number, RowCycleState>>(new Map());
  const [roleSwitchHighlight, setRoleSwitchHighlight] = useState<Set<number>>(new Set());

  // spec007 §5, resolved retry behavior: once Step A (POST /users) succeeds
  // — or an existing user was picked in step 2, skipping Step A entirely
  // (spec009 §3) — its result is remembered so a retry after a Step B
  // failure only re-sends Step B, rather than re-running Step A. Never used
  // on the integration path, which has no Step A at all (spec010 §9).
  const [createdUser, setCreatedUser] = useState<{ id: number; email: string } | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const organizationsById = useMemo(() => buildOrganizationsById(organizations), [organizations]);
  const clientsById = useMemo(() => buildClientsById(organizations), [organizations]);

  const visibleOrgIds = useMemo(
    () => Array.from(new Set(orgMemberships.map((membership) => membership.orgId))),
    [orgMemberships],
  );

  // spec009 §2-3: fetches the "existing user" picker's options once the user
  // path is selected — also doubles as the best-effort duplicate-email check
  // for "new user" (§3's resolved scope: checked against this visible-org
  // list only, not every user in the system; POST /users' 409 remains the
  // authoritative fallback for anything outside it). Skipped entirely on the
  // integration path, which has no use for it.
  useEffect(() => {
    if (targetKind !== 'user' || visibleOrgIds.length === 0) {
      return;
    }

    setIsLoadingUsers(true);
    apiClient
      .get<User[]>('/users', { params: { orgIds: visibleOrgIds.join(',') } })
      .then((response) => setVisibleUsers(response.data))
      .catch(() => setVisibleUsers([]))
      .finally(() => setIsLoadingUsers(false));
  }, [targetKind, visibleOrgIds]);

  // spec010 §9: the "existing integration" picker's options — every
  // integration under an org the logged-in user belongs to, deduped by id.
  // No new fetch: OrganizationOverview.integrations is already in the store
  // (AppDataLoader's GET /organizations, spec002 §5).
  const integrationOptions = useMemo(() => {
    const byId = new Map<number, { id: number; name: string; provider: string }>();

    for (const overview of organizations) {
      for (const integration of overview.integrations) {
        byId.set(integration.id, {
          id: integration.id,
          name: integration.name,
          provider: integration.provider,
        });
      }
    }

    return Array.from(byId.values());
  }, [organizations]);

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
  const isEmailTaken = visibleUsers.some((user) => user.email === email.trim());

  const canGoToStep2 = targetKind !== null;
  const canGoToStep3 =
    targetKind === 'user'
      ? userMode === 'new'
        ? isEmailValid && !isEmailTaken && displayName.trim().length > 0
        : selectedExistingUserId !== null
      : selectedIntegrationId !== null;

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
  // POST /users. Project scope maps to its owning client (resolved decision).
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

      if (targetKind === 'user' && !user) {
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
        const response = await apiClient.post<{ user: User }>('/users', body);
        user = { id: response.data.user.id as number, email: response.data.user.email };
        setCreatedUser(user);
      }

      const grantBody: CreateGrantRequestBody = {
        orgId: scopeKind === 'org' ? scopeEntityId : null,
        clientId: scopeKind === 'client' ? scopeEntityId : null,
        projectId: scopeKind === 'project' ? scopeEntityId : null,
        email: targetKind === 'user' ? user?.email ?? null : null,
        integrationId: targetKind === 'integration' ? selectedIntegrationId : null,
        roleId: selectedRoleId,
        grantCapabilities: finalCapabilities,
      };
      const grantResponse = await apiClient.post<{
        grant: AccessGrantSummary | IntegrationAccessGrantSummary;
      }>('/grant-capabilities', grantBody);

      if (isIntegrationAccessGrantSummary(grantResponse.data.grant)) {
        addIntegrationAccessGrantSummary(grantResponse.data.grant);
      } else {
        addAccessGrantSummary(grantResponse.data.grant);
      }
      onClose();
    } catch {
      setSaveError('Failed to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  function handleNext() {
    if (step === 1) {
      if (!canGoToStep2) {
        return;
      }

      setStep(2);
      return;
    }

    if (step === 2) {
      if (!canGoToStep3) {
        return;
      }

      // spec009 §3: picking "existing user" means there's no `POST /users`
      // call to make — the user already exists, so `createdUser` is set
      // directly from the dropdown selection, which makes `handleSave`'s
      // `if (targetKind === 'user' && !user)` short-circuit skip Step A
      // entirely. The integration path never runs Step A at all.
      if (targetKind === 'user' && userMode === 'existing') {
        const selectedUser = visibleUsers.find((user) => user.id === selectedExistingUserId);

        if (selectedUser && selectedUser.id !== null) {
          setCreatedUser({ id: selectedUser.id, email: selectedUser.email });
        }
      }

      setStep(3);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-800">
            Add new grant — Step {step} of 3
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

        {step === 1 && (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col text-sm font-medium text-slate-600">
              Create this grant for
              <select
                value={targetKind ?? ''}
                onChange={(event) => {
                  const value = event.target.value;
                  setTargetKind(value === '' ? null : (value as TargetKind));
                }}
                className="mt-1 rounded border border-slate-300 px-3 py-2 text-slate-800"
              >
                <option value="">Select…</option>
                <option value="user">A user</option>
                <option value="integration">An integration</option>
              </select>
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
                onClick={handleNext}
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
        )}

        {step === 2 && targetKind === 'user' && (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col text-sm font-medium text-slate-600">
              This grant is for
              <select
                value={userMode}
                onChange={(event) => {
                  const nextMode = event.target.value as UserMode;
                  setUserMode(nextMode);
                  setSelectedExistingUserId(null);
                  setEmail('');
                  setDisplayName('');
                }}
                className="mt-1 rounded border border-slate-300 px-3 py-2 text-slate-800"
              >
                <option value="new">A new user</option>
                <option value="existing">An existing user</option>
              </select>
            </label>

            {userMode === 'new' ? (
              <>
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
                  {email.length > 0 && isEmailValid && isEmailTaken && (
                    <span className="mt-1 text-xs text-red-600">A user with this email already exists.</span>
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
              </>
            ) : (
              <label className="flex flex-col text-sm font-medium text-slate-600">
                Existing user
                <select
                  value={selectedExistingUserId ?? ''}
                  onChange={(event) =>
                    setSelectedExistingUserId(event.target.value === '' ? null : Number(event.target.value))
                  }
                  disabled={isLoadingUsers}
                  className="mt-1 rounded border border-slate-300 px-3 py-2 text-slate-800"
                >
                  <option value="">{isLoadingUsers ? 'Loading users…' : 'Select…'}</option>
                  {visibleUsers.map((user) => (
                    <option key={user.id} value={user.id ?? ''}>
                      {user.displayName ? `${user.displayName} (${user.email})` : user.email}
                    </option>
                  ))}
                </select>
              </label>
            )}

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
                onClick={handleNext}
                disabled={!canGoToStep3}
                className={`rounded px-4 py-2 ${
                  canGoToStep3
                    ? 'bg-slate-800 text-white hover:bg-slate-700'
                    : 'cursor-not-allowed bg-slate-300 text-slate-500'
                }`}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {step === 2 && targetKind === 'integration' && (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col text-sm font-medium text-slate-600">
              Existing integration
              <select
                value={selectedIntegrationId ?? ''}
                onChange={(event) =>
                  setSelectedIntegrationId(event.target.value === '' ? null : Number(event.target.value))
                }
                className="mt-1 rounded border border-slate-300 px-3 py-2 text-slate-800"
              >
                <option value="">Select…</option>
                {integrationOptions.map((integration) => (
                  <option key={integration.id} value={integration.id}>
                    {integration.name} ({integration.provider})
                  </option>
                ))}
              </select>
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
                onClick={handleNext}
                disabled={!canGoToStep3}
                className={`rounded px-4 py-2 ${
                  canGoToStep3
                    ? 'bg-slate-800 text-white hover:bg-slate-700'
                    : 'cursor-not-allowed bg-slate-300 text-slate-500'
                }`}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
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
