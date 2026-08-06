import { useState } from 'react';
import { OrganizationMembersFilter } from '../components/OrganizationMembersFilter';
import { OrganizationMembersTable } from '../components/OrganizationMembersTable';
import type { MembershipStatus } from '../types';

/**
 * spec008: replaces the title-only placeholder (spec002 §"Scope") with a
 * real directory — everyone across the logged-in user's organizations, in
 * one searchable/filterable table. Same page shell pattern as
 * `AccessEditorPage.tsx` (spec006 §1): h1 + one-sentence description,
 * filters + search in a header row, then the table.
 */
export function OrganizationMembersPage() {
  const [searchText, setSearchText] = useState('');
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<MembershipStatus | null>(null);
  const [selectedCapabilityId, setSelectedCapabilityId] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Organization Members</h1>
          <p className="mt-1 text-sm text-slate-500">
            Everyone across your organizations in one place — who they are, what they can reach, and
            what they can do.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <OrganizationMembersFilter
            selectedOrgId={selectedOrgId}
            selectedClientId={selectedClientId}
            selectedProjectId={selectedProjectId}
            selectedStatus={selectedStatus}
            selectedCapabilityId={selectedCapabilityId}
            onOrgChange={setSelectedOrgId}
            onClientChange={setSelectedClientId}
            onProjectChange={setSelectedProjectId}
            onStatusChange={setSelectedStatus}
            onCapabilityChange={setSelectedCapabilityId}
          />

          <input
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search by name or email…"
            className="min-w-64 flex-1 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
          />
        </div>

        <OrganizationMembersTable
          searchText={searchText}
          selectedOrgId={selectedOrgId}
          selectedClientId={selectedClientId}
          selectedProjectId={selectedProjectId}
          selectedStatus={selectedStatus}
          selectedCapabilityId={selectedCapabilityId}
        />
      </div>
    </div>
  );
}
