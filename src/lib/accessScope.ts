import type { AccessGrantSummary, Client, Organization, OrganizationOverview, Project } from '../types';

/**
 * Org/client names aren't available on OrgMembership/ClientMembership rows
 * (spec003 §9) — resolved here from the OrganizationOverview[] AppDataLoader
 * already fetches globally (spec002 §5), no separate fetch needed.
 */
export function buildOrganizationsById(organizations: OrganizationOverview[]): Map<number, Organization> {
  return new Map(organizations.map((overview): [number, Organization] => [
    overview.organization.id,
    overview.organization,
  ]));
}

export function buildClientsById(organizations: OrganizationOverview[]): Map<number, Client> {
  const clientsById = new Map<number, Client>();

  for (const overview of organizations) {
    for (const client of overview.clients) {
      clientsById.set(client.id, client);
    }
  }

  return clientsById;
}

export function buildProjectsById(projects: Project[]): Map<number, Project> {
  return new Map(projects.map((project): [number, Project] => [project.id, project]));
}

export type ScopeKind = 'org' | 'client' | 'project';

export interface ResolvedScope {
  kind: ScopeKind;
  entityId: number;
  entityName: string;
}

/**
 * Resolves an AccessGrantSummary's scope (spec003 §1: orgId/clientId/projectId
 * mutually exclusive — exactly one is set) to a display name, per §9's Scope
 * column / group-heading rule.
 */
export function resolveGrantScope(
  grant: Pick<AccessGrantSummary, 'orgId' | 'clientId' | 'projectId'>,
  organizationsById: Map<number, Organization>,
  clientsById: Map<number, Client>,
  projectsById: Map<number, Project>,
): ResolvedScope | null {
  if (grant.orgId !== null) {
    return {
      kind: 'org',
      entityId: grant.orgId,
      entityName: organizationsById.get(grant.orgId)?.name ?? `Organization ${grant.orgId}`,
    };
  }

  if (grant.clientId !== null) {
    return {
      kind: 'client',
      entityId: grant.clientId,
      entityName: clientsById.get(grant.clientId)?.name ?? `Client ${grant.clientId}`,
    };
  }

  if (grant.projectId !== null) {
    return {
      kind: 'project',
      entityId: grant.projectId,
      entityName: projectsById.get(grant.projectId)?.name ?? `Project ${grant.projectId}`,
    };
  }

  return null;
}

const SCOPE_KIND_LABEL: Record<ScopeKind, string> = {
  org: 'Org',
  client: 'Client',
  project: 'Project',
};

export function formatScopeLabel(scope: ResolvedScope): string {
  return `(${SCOPE_KIND_LABEL[scope.kind]}) ${scope.entityName}`;
}

/**
 * Resolves the org a grant ultimately falls under, even when the grant
 * itself is client/project-scoped (walking up via Client.orgId / Project.orgId)
 * — used for client-side org filtering, which spec003 §11 flags the backend
 * endpoint itself doesn't do correctly.
 */
export function resolveEffectiveOrgId(
  grant: Pick<AccessGrantSummary, 'orgId' | 'clientId' | 'projectId'>,
  clientsById: Map<number, Client>,
  projectsById: Map<number, Project>,
): number | null {
  if (grant.orgId !== null) {
    return grant.orgId;
  }

  if (grant.clientId !== null) {
    return clientsById.get(grant.clientId)?.orgId ?? null;
  }

  if (grant.projectId !== null) {
    return projectsById.get(grant.projectId)?.orgId ?? null;
  }

  return null;
}

/** Same idea as resolveEffectiveOrgId, but for the client-side client filter. */
export function resolveEffectiveClientId(
  grant: Pick<AccessGrantSummary, 'clientId' | 'projectId'>,
  projectsById: Map<number, Project>,
): number | null {
  if (grant.clientId !== null) {
    return grant.clientId;
  }

  if (grant.projectId !== null) {
    return projectsById.get(grant.projectId)?.clientId ?? null;
  }

  return null;
}
