import { Fragment, useMemo, useState } from 'react';
import { faCaretDown, faCaretRight, faGear, faSpinner, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { apiClient } from '../lib/api';
import { useAppStore } from '../store/useAppStore';
import type { AccessGrantSummary } from '../types';
import {
  buildClientsById,
  buildOrganizationsById,
  buildProjectsById,
  resolveEffectiveClientId,
  resolveEffectiveOrgId,
  resolveGrantScope,
  SCOPE_KIND_BADGE_CLASSES,
} from '../lib/accessScope';

interface AccessGrantsTableProps {
  selectedOrgId: number | null;
  selectedClientId: number | null;
  selectedProjectId: number | null;
  onEditGrant: (grantId: number) => void;
}

interface EmailGroup {
  email: string;
  grants: AccessGrantSummary[];
}

/**
 * spec003 §9, ungrouped per spec006 §2, re-grouped per spec009 §11: filtered
 * grants are grouped by email — an email with a single grant renders exactly
 * as before (one flat row), an email with more than one grant collapses into
 * one accordion row (caret + "{n} grants") that expands to show each grant as
 * its own indented sub-row, same Scope/Preset Role/Settings columns as a
 * flat row would have had.
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
  const removeAccessGrantSummary = useAppStore((state) => state.removeAccessGrantSummary);

  const [expandedEmails, setExpandedEmails] = useState<Set<string>>(new Set());
  const [deletingGrant, setDeletingGrant] = useState<{ grantId: number; email: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  // spec009 §11: grouped by email, preserving `filteredGrants`' order.
  const groupedGrants = useMemo(() => {
    const groups = new Map<string, AccessGrantSummary[]>();

    for (const grant of filteredGrants) {
      const existing = groups.get(grant.email);
      if (existing) {
        existing.push(grant);
      } else {
        groups.set(grant.email, [grant]);
      }
    }

    return Array.from(groups.entries()).map(([email, grants]): EmailGroup => ({ email, grants }));
  }, [filteredGrants]);

  function toggleExpanded(email: string) {
    setExpandedEmails((current) => {
      const next = new Set(current);
      if (next.has(email)) {
        next.delete(email);
      } else {
        next.add(email);
      }
      return next;
    });
  }

  // spec009 §4: gear + trash live in the same "Settings" cell; the trash icon
  // opens a confirm dialog rather than deleting immediately.
  async function handleConfirmDelete() {
    if (!deletingGrant || isDeleting) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await apiClient.delete('/grant-capabilities', { params: { grantId: deletingGrant.grantId } });
      removeAccessGrantSummary(deletingGrant.grantId);
      setDeletingGrant(null);
    } catch {
      setDeleteError('Failed to delete this grant. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  }

  function renderGrantCells(grant: AccessGrantSummary) {
    const scope = resolveGrantScope(grant, organizationsById, clientsById, projectsById);

    return (
      <>
        <td className="px-4 py-2">
          {scope ? (
            <span
              className={`rounded-full px-2 py-1 text-xs font-medium ${SCOPE_KIND_BADGE_CLASSES[scope.kind]}`}
            >
              {scope.entityName}
            </span>
          ) : (
            '—'
          )}
        </td>
        <td className="px-4 py-2">{grant.roleId !== null ? grant.roleName ?? '—' : 'None'}</td>
        <td className="px-4 py-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onEditGrant(grant.grantId)}
              aria-label={`Edit access grant for ${grant.email}`}
              className="text-slate-500 hover:text-slate-800"
            >
              <FontAwesomeIcon icon={faGear} />
            </button>
            <button
              type="button"
              onClick={() => {
                setDeleteError(null);
                setDeletingGrant({ grantId: grant.grantId, email: grant.email });
              }}
              aria-label={`Delete access grant for ${grant.email}`}
              className="text-slate-500 hover:text-red-700"
            >
              <FontAwesomeIcon icon={faTrash} />
            </button>
          </div>
        </td>
      </>
    );
  }

  if (groupedGrants.length === 0) {
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
          {groupedGrants.map(({ email, grants }) => {
            if (grants.length === 1) {
              const grant = grants[0];
              return (
                <tr key={grant.grantId} className="text-slate-700">
                  <td className="px-4 py-2">{grant.email}</td>
                  <td className="px-4 py-2">{grant.displayName ?? '—'}</td>
                  {renderGrantCells(grant)}
                </tr>
              );
            }

            const isExpanded = expandedEmails.has(email);

            return (
              <Fragment key={email}>
                <tr
                  onClick={() => toggleExpanded(email)}
                  className="cursor-pointer text-slate-700 hover:bg-slate-50"
                >
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-2">
                      <FontAwesomeIcon icon={isExpanded ? faCaretDown : faCaretRight} className="text-slate-400" />
                      {email}
                    </span>
                  </td>
                  <td className="px-4 py-2">{grants[0].displayName ?? '—'}</td>
                  <td className="px-4 py-2 text-slate-500" colSpan={2}>
                    {grants.length} grants
                  </td>
                  <td className="px-4 py-2" />
                </tr>
                {isExpanded &&
                  grants.map((grant) => (
                    <tr key={grant.grantId} className="bg-slate-50/60 text-slate-700">
                      <td className="px-4 py-2 pl-10 text-slate-400">↳</td>
                      <td className="px-4 py-2" />
                      {renderGrantCells(grant)}
                    </tr>
                  ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>

      {deletingGrant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-slate-800">Delete access grant?</h2>
            <p className="mt-2 text-sm text-slate-600">
              Are you sure you want to delete the access grant for <strong>{deletingGrant.email}</strong>?
              This only removes this grant — the user account itself is not deleted.
            </p>

            {deleteError && <p className="mt-3 text-sm text-red-600">{deleteError}</p>}

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeletingGrant(null)}
                disabled={isDeleting}
                className="rounded border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className={`flex items-center gap-2 rounded px-4 py-2 text-white ${
                  isDeleting ? 'cursor-not-allowed bg-red-300' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {isDeleting && <FontAwesomeIcon icon={faSpinner} spin />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
