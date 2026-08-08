import { useMemo, useState } from 'react';
import { faFilter } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useAppStore } from '../store/useAppStore';
import { useScopeFilterOptions } from '../lib/scopeFilterOptions';
import type { MembershipStatus } from '../types';

interface OrganizationMembersFilterProps {
  selectedOrgId: number | null;
  selectedClientId: number | null;
  selectedProjectId: number | null;
  selectedStatus: MembershipStatus | null;
  selectedCapabilityId: number | null;
  onOrgChange: (orgId: number | null) => void;
  onClientChange: (clientId: number | null) => void;
  onProjectChange: (projectId: number | null) => void;
  onStatusChange: (status: MembershipStatus | null) => void;
  onCapabilityChange: (capabilityId: number | null) => void;
}

/**
 * spec008 §5: `/organization-members`'s filter popup — the same org/client/
 * project cascading dropdowns as `AccessScopeFilter.tsx` (via the shared
 * `useScopeFilterOptions` hook, spec008 §5's extraction), plus Status and
 * Capability dropdowns unique to this page.
 */
export function OrganizationMembersFilter({
  selectedOrgId,
  selectedClientId,
  selectedProjectId,
  selectedStatus,
  selectedCapabilityId,
  onOrgChange,
  onClientChange,
  onProjectChange,
  onStatusChange,
  onCapabilityChange,
}: OrganizationMembersFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { orgOptions, clientOptions, projectOptions } = useScopeFilterOptions(selectedOrgId, selectedClientId);
  const capabilities = useAppStore((state) => state.capabilities);

  const capabilityOptions = useMemo(
    () =>
      [...capabilities].sort(
        (a, b) => a.resourceName.localeCompare(b.resourceName) || a.actionName.localeCompare(b.actionName),
      ),
    [capabilities],
  );

  const activeFilterCount =
    (selectedOrgId !== null ? 1 : 0) +
    (selectedClientId !== null ? 1 : 0) +
    (selectedProjectId !== null ? 1 : 0) +
    (selectedStatus !== null ? 1 : 0) +
    (selectedCapabilityId !== null ? 1 : 0);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="flex items-center gap-2 rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
      >
        <FontAwesomeIcon icon={faFilter} />
        Filters
        {activeFilterCount > 0 && (
          <span className="rounded-full bg-slate-700 px-1.5 py-0.5 text-xs font-semibold text-white">
            {activeFilterCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          {/* Click-outside-to-close backdrop. */}
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute left-0 top-full z-50 mt-2 flex w-80 flex-col gap-4 rounded border border-slate-200 bg-white p-4 shadow-lg">
            <label className="flex flex-col text-sm font-medium text-slate-600">
              Filter by organization
              <select
                className="mt-1 rounded border border-slate-300 bg-white px-3 py-2 text-slate-800"
                value={selectedOrgId ?? ''}
                onChange={(event) => {
                  const value = event.target.value;
                  onOrgChange(value === '' ? null : Number(value));
                  onClientChange(null);
                  onProjectChange(null);
                }}
              >
                <option value="">All organizations</option>
                {orgOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col text-sm font-medium text-slate-600">
              Filter by client
              <select
                className="mt-1 rounded border border-slate-300 bg-white px-3 py-2 text-slate-800"
                value={selectedClientId ?? ''}
                onChange={(event) => {
                  const value = event.target.value;
                  onClientChange(value === '' ? null : Number(value));
                  onProjectChange(null);
                }}
              >
                <option value="">All clients</option>
                {clientOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col text-sm font-medium text-slate-600">
              Filter by project
              <select
                className="mt-1 rounded border border-slate-300 bg-white px-3 py-2 text-slate-800"
                value={selectedProjectId ?? ''}
                onChange={(event) => {
                  const value = event.target.value;
                  onProjectChange(value === '' ? null : Number(value));
                }}
              >
                <option value="">All projects</option>
                {projectOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col text-sm font-medium text-slate-600">
              Filter by status
              <select
                className="mt-1 rounded border border-slate-300 bg-white px-3 py-2 text-slate-800"
                value={selectedStatus ?? ''}
                onChange={(event) => {
                  const value = event.target.value;
                  onStatusChange(value === '' ? null : (value as MembershipStatus));
                }}
              >
                <option value="">All statuses</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
              </select>
            </label>

            <label className="flex flex-col text-sm font-medium text-slate-600">
              Filter by capability
              <select
                className="mt-1 rounded border border-slate-300 bg-white px-3 py-2 text-slate-800"
                value={selectedCapabilityId ?? ''}
                onChange={(event) => {
                  const value = event.target.value;
                  onCapabilityChange(value === '' ? null : Number(value));
                }}
              >
                <option value="">All capabilities</option>
                {capabilityOptions.map((capability) => (
                  <option key={capability.id} value={capability.id}>
                    {capability.resourceName} → {capability.actionName}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </>
      )}
    </div>
  );
}
