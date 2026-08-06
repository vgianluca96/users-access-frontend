import { useState } from 'react';
import { AccessGrantsTable } from '../components/AccessGrantsTable';
import { AccessScopeFilter } from '../components/AccessScopeFilter';
import { GrantEditorDialog } from '../components/GrantEditorDialog';

export function AccessEditorPage() {
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [editingGrantId, setEditingGrantId] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Access Editor</h1>
          <p className="mt-1 text-sm text-slate-500">
            Review and manage access grants across your organizations, clients, and projects.
          </p>
        </div>

        <AccessScopeFilter
          selectedOrgId={selectedOrgId}
          selectedClientId={selectedClientId}
          onOrgChange={setSelectedOrgId}
          onClientChange={setSelectedClientId}
        />

        <AccessGrantsTable
          selectedOrgId={selectedOrgId}
          selectedClientId={selectedClientId}
          onEditGrant={setEditingGrantId}
        />
      </div>

      <GrantEditorDialog grantId={editingGrantId} onClose={() => setEditingGrantId(null)} />
    </div>
  );
}
