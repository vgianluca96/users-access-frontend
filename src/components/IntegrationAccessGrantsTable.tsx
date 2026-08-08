import { Fragment, useMemo, useState } from 'react';
import { faCaretDown, faCaretRight, faGear, faSpinner, faTrash } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { apiClient } from '../lib/api';
import { useAppStore } from '../store/useAppStore';
import type { IntegrationAccessGrantSummary } from '../types';
import {
  buildClientsById,
  buildOrganizationsById,
  buildProjectsById,
  resolveEffectiveClientId,
  resolveEffectiveOrgId,
  resolveGrantScope,
  SCOPE_KIND_BADGE_CLASSES,
} from '../lib/accessScope';

interface IntegrationAccessGrantsTableProps {
  selectedOrgId: number | null;
  selectedClientId: number | null;
  selectedProjectId: number | null;
  onEditGrant: (grantId: number) => void;
}

interface IntegrationGroup {
  integrationId: number;
  grants: IntegrationAccessGrantSummary[];
}

/**
 * spec010 §7: the integration-targeted mirror of AccessGrantsTable
 * (spec003 §9, ungrouped per spec006 §2, re-grouped per spec009 §11) —
 * same structure (grouping accordion, filters, gear + delete), grouped by
 * `integrationId` instead of `email`, and with Integration Name / Provider
 * columns standing in for Email / User Name (confirmed 2026-08-07 — neither
 * has an integration equivalent).
 *
 * Filtering reuses the same page-level selectedOrgId/selectedClientId/
 * selectedProjectId as AccessGrantsTable — the Filters popup is shared
 * across both tables on `/access-editor`.
 */
export function IntegrationAccessGrantsTable({
  selectedOrgId,
  selectedClientId,
  selectedProjectId,
  onEditGrant,
}: IntegrationAccessGrantsTableProps) {
  const integrationAccessGrantSummaries = useAppStore(
    (state) => state.integrationAccessGrantSummaries,
  );
  const organizations = useAppStore((state) => state.organizations);
  const projects = useAppStore((state) => state.projects);
  const removeIntegrationAccessGrantSummary = useAppStore(
    (state) => state.removeIntegrationAccessGrantSummary,
  );

  const [expandedIntegrationIds, setExpandedIntegrationIds] = useState<Set<number>>(new Set());
  const [deletingGrant, setDeletingGrant] = useState<{ grantId: number; integrationName: string } | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const organizationsById = useMemo(() => buildOrganizationsById(organizations), [organizations]);
  const clientsById = useMemo(() => buildClientsById(organizations), [organizations]);
  const projectsById = useMemo(() => buildProjectsById(projects), [projects]);

  const filteredGrants = useMemo(() => {
    return integrationAccessGrantSummaries.filter((grant) => {
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
  }, [integrationAccessGrantSummaries, selectedOrgId, selectedClientId, selectedProjectId, clientsById, projectsById]);

  const groupedGrants = useMemo(() => {
    const groups = new Map<number, IntegrationAccessGrantSummary[]>();

    for (const grant of filteredGrants) {
      const existing = groups.get(grant.integrationId);
      if (existing) {
        existing.push(grant);
      } else {
        groups.set(grant.integrationId, [grant]);
      }
    }

    return Array.from(groups.entries()).map(
      ([integrationId, grants]): IntegrationGroup => ({ integrationId, grants }),
    );
  }, [filteredGrants]);

  function toggleExpanded(integrationId: number) {
    setExpandedIntegrationIds((current) => {
      const next = new Set(current);
      if (next.has(integrationId)) {
        next.delete(integrationId);
      } else {
        next.add(integrationId);
      }
      return next;
    });
  }

  async function handleConfirmDelete() {
    if (!deletingGrant || isDeleting) {
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await apiClient.delete('/grant-capabilities', { params: { grantId: deletingGrant.grantId } });
      removeIntegrationAccessGrantSummary(deletingGrant.grantId);
      setDeletingGrant(null);
    } catch {
      setDeleteError('Failed to delete this grant. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  }

  function renderGrantCells(grant: IntegrationAccessGrantSummary) {
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
              aria-label={`Edit access grant for ${grant.integrationName}`}
              className="text-slate-500 hover:text-slate-800"
            >
              <FontAwesomeIcon icon={faGear} />
            </button>
            <button
              type="button"
              onClick={() => {
                setDeleteError(null);
                setDeletingGrant({ grantId: grant.grantId, integrationName: grant.integrationName });
              }}
              aria-label={`Delete access grant for ${grant.integrationName}`}
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
            <th className="px-4 py-2 font-medium">Integration Name</th>
            <th className="px-4 py-2 font-medium">Provider</th>
            <th className="px-4 py-2 font-medium">Scope</th>
            <th className="px-4 py-2 font-medium">Preset Role</th>
            <th className="px-4 py-2 font-medium">Settings</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {groupedGrants.map(({ integrationId, grants }) => {
            if (grants.length === 1) {
              const grant = grants[0];
              return (
                <tr key={grant.grantId} className="text-slate-700">
                  <td className="px-4 py-2">{grant.integrationName}</td>
                  <td className="px-4 py-2">{grant.provider}</td>
                  {renderGrantCells(grant)}
                </tr>
              );
            }

            const isExpanded = expandedIntegrationIds.has(integrationId);

            return (
              <Fragment key={integrationId}>
                <tr
                  onClick={() => toggleExpanded(integrationId)}
                  className="cursor-pointer text-slate-700 hover:bg-slate-50"
                >
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-2">
                      <FontAwesomeIcon icon={isExpanded ? faCaretDown : faCaretRight} className="text-slate-400" />
                      {grants[0].integrationName}
                    </span>
                  </td>
                  <td className="px-4 py-2">{grants[0].provider}</td>
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
              Are you sure you want to delete the access grant for{' '}
              <strong>{deletingGrant.integrationName}</strong>? This only removes this grant — the
              integration itself is not deleted.
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
