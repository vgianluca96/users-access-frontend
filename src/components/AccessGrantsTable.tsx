import { useMemo } from 'react';
import { faGear } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useAppStore } from '../store/useAppStore';
import {
  buildClientsById,
  buildOrganizationsById,
  buildProjectsById,
  formatScopeLabel,
  resolveEffectiveClientId,
  resolveEffectiveOrgId,
  resolveGrantScope,
} from '../lib/accessScope';

interface AccessGrantsTableProps {
  selectedOrgId: number | null;
  selectedClientId: number | null;
  selectedProjectId: number | null;
  onEditGrant: (grantId: number) => void;
}

/**
 * spec003 §9, ungrouped per spec006 §2: every filtered grant is a row in one
 * flat table (no more per-org/client/project sections) — Email/User Name/
 * Scope/Preset Role/Settings columns, in that order (spec006 §9).
 *
 * spec007 §1: `selectedProjectId` is a direct equality check, unlike the
 * org/client filters — project is already the leaf of the scope hierarchy,
 * so there's no "effective" walk-up needed. Like the client filter already
 * does to org-scoped grants, this excludes every org/client-scoped grant
 * once a project filter is active.
 */
export function AccessGrantsTable({
  selectedOrgId,
  selectedClientId,
  selectedProjectId,
  onEditGrant,
}: AccessGrantsTableProps) {
  const accessGrantSummaries = useAppStore((state) => state.accessGrantSummaries);
  const organizations = useAppStore((state) => state.organizations);
  const projects = useAppStore((state) => state.projects);

  const organizationsById = useMemo(() => buildOrganizationsById(organizations), [organizations]);
  const clientsById = useMemo(() => buildClientsById(organizations), [organizations]);
  const projectsById = useMemo(() => buildProjectsById(projects), [projects]);

  const filteredGrants = useMemo(() => {
    return accessGrantSummaries.filter((grant) => {
      if (selectedOrgId !== null && resolveEffectiveOrgId(grant, clientsById, projectsById) !== selectedOrgId) {
        return false;
      }

      if (
        selectedClientId !== null &&
        resolveEffectiveClientId(grant, projectsById) !== selectedClientId
      ) {
        return false;
      }

      if (selectedProjectId !== null && grant.projectId !== selectedProjectId) {
        return false;
      }

      return true;
    });
  }, [accessGrantSummaries, selectedOrgId, selectedClientId, selectedProjectId, clientsById, projectsById]);

  if (filteredGrants.length === 0) {
    return <p className="text-sm text-slate-500">No access grants match the current filter.</p>;
  }

  return (
    <div className="overflow-x-auto rounded border border-slate-200">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="bg-slate-100 text-slate-600">
          <tr>
            <th className="px-4 py-2 font-medium">Email</th>
            <th className="px-4 py-2 font-medium">User Name</th>
            <th className="px-4 py-2 font-medium">Scope</th>
            <th className="px-4 py-2 font-medium">Preset Role</th>
            <th className="px-4 py-2 font-medium">Settings</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filteredGrants.map((grant) => {
            const scope = resolveGrantScope(grant, organizationsById, clientsById, projectsById);

            return (
              <tr key={grant.grantId} className="text-slate-700">
                <td className="px-4 py-2">{grant.email}</td>
                <td className="px-4 py-2">{grant.displayName ?? '—'}</td>
                <td className="px-4 py-2">{scope ? formatScopeLabel(scope) : '—'}</td>
                <td className="px-4 py-2">{grant.roleId !== null ? grant.roleName ?? '—' : 'None'}</td>
                <td className="px-4 py-2">
                  <button
                    type="button"
                    onClick={() => onEditGrant(grant.grantId)}
                    aria-label={`Edit access grant for ${grant.email}`}
                    className="text-slate-500 hover:text-slate-800"
                  >
                    <FontAwesomeIcon icon={faGear} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
