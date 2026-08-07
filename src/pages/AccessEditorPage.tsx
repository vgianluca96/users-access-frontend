import { useState } from 'react';
import { faArrowLeft, faPlus } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useNavigate } from 'react-router-dom';
import { AccessGrantsTable } from '../components/AccessGrantsTable';
import { AccessScopeFilter } from '../components/AccessScopeFilter';
import { AddGrantDialog } from '../components/AddGrantDialog';
import { GrantEditorDialog } from '../components/GrantEditorDialog';

export function AccessEditorPage() {
  const navigate = useNavigate();
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [editingGrantId, setEditingGrantId] = useState<number | null>(null);
  const [isAddGrantOpen, setIsAddGrantOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mx-auto flex max-w-5xl flex-col gap-6">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="flex items-center gap-2 self-start text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <FontAwesomeIcon icon={faArrowLeft} />
          Back to home
        </button>

        <div>
          <h1 className="text-2xl font-semibold text-slate-800">Access Editor</h1>
          <p className="mt-1 text-sm text-slate-500">
            Review and manage access grants across your organizations, clients, and projects.
          </p>
        </div>

        <div className="flex items-center justify-between gap-3">
          <AccessScopeFilter
            selectedOrgId={selectedOrgId}
            selectedClientId={selectedClientId}
            selectedProjectId={selectedProjectId}
            onOrgChange={setSelectedOrgId}
            onClientChange={setSelectedClientId}
            onProjectChange={setSelectedProjectId}
          />

          <button
            type="button"
            onClick={() => setIsAddGrantOpen(true)}
            className="flex items-center gap-2 rounded bg-slate-800 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            <FontAwesomeIcon icon={faPlus} />
            Add new grant
          </button>
        </div>

        <AccessGrantsTable
          selectedOrgId={selectedOrgId}
          selectedClientId={selectedClientId}
          selectedProjectId={selectedProjectId}
          onEditGrant={setEditingGrantId}
        />
      </div>

      <GrantEditorDialog grantId={editingGrantId} onClose={() => setEditingGrantId(null)} />
      {isAddGrantOpen && <AddGrantDialog onClose={() => setIsAddGrantOpen(false)} />}
    </div>
  );
}
