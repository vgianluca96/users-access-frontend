import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { buildOrganizationsById } from '../lib/accessScope';
import type { MembershipStatus, OrganizationMemberSummary } from '../types';

interface OrganizationMembersTableProps {
  searchText: string;
  selectedOrgId: number | null;
  selectedClientId: number | null;
  selectedProjectId: number | null;
  selectedStatus: MembershipStatus | null;
  selectedCapabilityId: number | null;
}

const STATUS_BADGE_CLASSES: Record<MembershipStatus, string> = {
  active: 'bg-green-100 text-green-800',
  pending: 'bg-amber-100 text-amber-800',
};

const MAX_CAPABILITY_CHIPS = 3;

/** Groups a member's effective capabilities by resource, e.g. "Datasets: view, export". */
function groupCapabilitiesByResource(capabilities: OrganizationMemberSummary['capabilities']): string[] {
  const actionsByResource = new Map<string, string[]>();

  for (const capability of capabilities) {
    const actions = actionsByResource.get(capability.resourceName);
    if (actions) {
      actions.push(capability.actionName);
    } else {
      actionsByResource.set(capability.resourceName, [capability.actionName]);
    }
  }

  return Array.from(actionsByResource.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([resourceName, actionNames]) => `${resourceName}: ${actionNames.join(', ')}`);
}

/**
 * spec008 §5: `/organization-members`'s directory table — one row per
 * `OrganizationMemberSummary` (one `(org, person)` pair), read-only. All
 * filtering (§6) happens client-side over the already-fetched
 * `organizationMembers` store slice, same convention as `AccessGrantsTable.tsx`.
 */
export function OrganizationMembersTable({
  searchText,
  selectedOrgId,
  selectedClientId,
  selectedProjectId,
  selectedStatus,
  selectedCapabilityId,
}: OrganizationMembersTableProps) {
  const organizationMembers = useAppStore((state) => state.organizationMembers);
  const organizations = useAppStore((state) => state.organizations);

  const organizationsById = useMemo(() => buildOrganizationsById(organizations), [organizations]);

  const filteredMembers = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();

    return organizationMembers.filter((member) => {
      if (selectedOrgId !== null && member.orgId !== selectedOrgId) {
        return false;
      }

      if (
        selectedClientId !== null &&
        !member.reach.some((entry) => entry.kind === 'client' && entry.id === selectedClientId)
      ) {
        return false;
      }

      if (
        selectedProjectId !== null &&
        !member.reach.some((entry) => entry.kind === 'project' && entry.id === selectedProjectId)
      ) {
        return false;
      }

      if (selectedStatus !== null && member.status !== selectedStatus) {
        return false;
      }

      if (
        selectedCapabilityId !== null &&
        !member.capabilities.some((capability) => capability.capabilityId === selectedCapabilityId)
      ) {
        return false;
      }

      if (normalizedSearch.length > 0) {
        const haystack = `${member.displayName ?? ''} ${member.email}`.toLowerCase();
        if (!haystack.includes(normalizedSearch)) {
          return false;
        }
      }

      return true;
    });
  }, [
    organizationMembers,
    searchText,
    selectedOrgId,
    selectedClientId,
    selectedProjectId,
    selectedStatus,
    selectedCapabilityId,
  ]);

  if (filteredMembers.length === 0) {
    return <p className="text-sm text-slate-500">No organization members match the current filter.</p>;
  }

  return (
    <div className="overflow-x-auto rounded border border-slate-200">
      <table className="w-full min-w-[880px] text-left text-sm">
        <thead className="bg-slate-100 text-slate-600">
          <tr>
            <th className="px-4 py-2 font-medium">Name</th>
            <th className="px-4 py-2 font-medium">Email</th>
            <th className="px-4 py-2 font-medium">Organization</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Reach</th>
            <th className="px-4 py-2 font-medium">Capabilities</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filteredMembers.map((member) => {
            const capabilityChips = groupCapabilitiesByResource(member.capabilities);
            const visibleCapabilityChips = capabilityChips.slice(0, MAX_CAPABILITY_CHIPS);
            const hiddenCapabilityCount = capabilityChips.length - visibleCapabilityChips.length;

            return (
              <tr key={`${member.orgId}:${member.email}`} className="align-top text-slate-700">
                <td className="px-4 py-2">{member.displayName ?? '—'}</td>
                <td className="px-4 py-2">{member.email}</td>
                <td className="px-4 py-2">
                  {organizationsById.get(member.orgId)?.name ?? `Organization ${member.orgId}`}
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_BADGE_CLASSES[member.status]}`}
                  >
                    {member.status === 'active' ? 'Active' : 'Pending'}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-1.5">
                    {member.orgWideAccess && (
                      <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700">
                        Org-wide
                      </span>
                    )}
                    {member.reach.map((entry) => (
                      <span
                        key={`${entry.kind}:${entry.id}`}
                        className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700"
                      >
                        ({entry.kind === 'client' ? 'Client' : 'Project'}) {entry.name}
                      </span>
                    ))}
                    {!member.orgWideAccess && member.reach.length === 0 && (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-1.5">
                    {visibleCapabilityChips.map((chip) => (
                      <span
                        key={chip}
                        className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-800"
                      >
                        {chip}
                      </span>
                    ))}
                    {hiddenCapabilityCount > 0 && (
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                        +{hiddenCapabilityCount} more
                      </span>
                    )}
                    {capabilityChips.length === 0 && <span className="text-xs text-slate-400">—</span>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
