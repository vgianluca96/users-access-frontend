import { useState } from 'react';
import { faFilter } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useScopeFilterOptions } from '../lib/scopeFilterOptions';

interface AccessScopeFilterProps {
  selectedOrgId: number | null;
  selectedClientId: number | null;
  selectedProjectId: number | null;
  onOrgChange: (orgId: number | null) => void;
  onClientChange: (clientId: number | null) => void;
  onProjectChange: (projectId: number | null) => void;
}

/**
 * spec003 §3 step 5 (org/client dropdowns), moved behind a popup per
 * spec006 §3 — same filtering behavior, triggered by a filter-icon button
 * instead of being always visible. Labels renamed "Organization"/"Client" →
 * "Filter by organization"/"Filter by client". spec007 §1 adds a third
 * "Filter by project" dropdown, cascading the same way client already
 * cascades off org: picking an org narrows both client and project options;
 * picking a client further narrows project options. spec008 §5: the
 * cascading-options logic itself now lives in `lib/scopeFilterOptions.ts`,
 * shared with `OrganizationMembersFilter.tsx`.
 */
export function AccessScopeFilter({
  selectedOrgId,
  selectedClientId,
  selectedProjectId,
  onOrgChange,
  onClientChange,
  onProjectChange,
}: AccessScopeFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { orgOptions, clientOptions, projectOptions } = useScopeFilterOptions(selectedOrgId, selectedClientId);

  const activeFilterCount =
    (selectedOrgId !== null ? 1 : 0) +
    (selectedClientId !== null ? 1 : 0) +
    (selectedProjectId !== null ? 1 : 0);

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
          <div className="absolute left-0 top-full z-50 mt-2 flex w-72 flex-col gap-4 rounded border border-slate-200 bg-white p-4 shadow-lg">
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
          </div>
        </>
      )}
    </div>
  );
}
