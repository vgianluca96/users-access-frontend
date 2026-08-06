import { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import { buildClientsById, buildOrganizationsById } from './accessScope';

export interface ScopeFilterOption {
  id: number;
  name: string;
}

export interface ScopeFilterOptions {
  orgOptions: ScopeFilterOption[];
  clientOptions: ScopeFilterOption[];
  projectOptions: ScopeFilterOption[];
}

/**
 * spec006 §3 / spec007 §1's org→client→project cascading dropdown options,
 * extracted out of `AccessScopeFilter.tsx` (spec008 §5) so `/organization-members`'s
 * filter popup can build the identical three lists without duplicating the
 * cascading logic: org options list every org the user belongs to; client
 * options narrow to `selectedOrgId` when set; project options narrow to
 * whichever of `selectedOrgId`/`selectedClientId` are set. No behavior
 * change versus the pre-extraction inline version.
 */
export function useScopeFilterOptions(
  selectedOrgId: number | null,
  selectedClientId: number | null,
): ScopeFilterOptions {
  const orgMemberships = useAppStore((state) => state.orgMemberships);
  const clientMemberships = useAppStore((state) => state.clientMemberships);
  const organizations = useAppStore((state) => state.organizations);
  const projects = useAppStore((state) => state.projects);

  const organizationsById = useMemo(() => buildOrganizationsById(organizations), [organizations]);
  const clientsById = useMemo(() => buildClientsById(organizations), [organizations]);

  const orgOptions = useMemo(() => {
    const ids = Array.from(new Set(orgMemberships.map((membership) => membership.orgId)));
    return ids
      .map((id) => ({ id, name: organizationsById.get(id)?.name ?? `Organization ${id}` }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [orgMemberships, organizationsById]);

  const clientOptions = useMemo(() => {
    const scoped =
      selectedOrgId === null
        ? clientMemberships
        : clientMemberships.filter((membership) => membership.orgId === selectedOrgId);
    const ids = Array.from(new Set(scoped.map((membership) => membership.clientId)));
    return ids
      .map((id) => ({ id, name: clientsById.get(id)?.name ?? `Client ${id}` }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [clientMemberships, selectedOrgId, clientsById]);

  const projectOptions = useMemo(() => {
    const scoped = projects.filter((project) => {
      if (selectedClientId !== null && project.clientId !== selectedClientId) {
        return false;
      }
      if (selectedOrgId !== null && project.orgId !== selectedOrgId) {
        return false;
      }
      return true;
    });
    return scoped
      .map((project) => ({ id: project.id, name: project.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [projects, selectedOrgId, selectedClientId]);

  return { orgOptions, clientOptions, projectOptions };
}
