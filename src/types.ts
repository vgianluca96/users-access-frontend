// Mirrors backend/src/types.ts — the backend is the source of truth for this data
// model (see CLAUDE.md). Keep in sync by hand until the two projects share a package.

export type RoleName = 'owner' | 'admin' | 'member' | 'viewer';

export interface Role {
  id: number;
  name: RoleName;
}

export interface Organization {
  id: number;
  name: string;
  slug: string;
  description?: string;
}

export interface Client {
  id: number;
  orgId: number;
  name: string;
  slug: string;
}

export interface Project {
  id: number;
  orgId: number;
  clientId: number;
  name: string;
}

export interface User {
  id: number | null;
  email: string;
  displayName: string | null;
  avatarUrl?: string | null;
  deleted?: boolean;
}

export type MembershipStatus = 'pending' | 'active';

export interface OrgMembership {
  id: number;
  orgId: number;
  userId: number | null;
  email: string;
  role: number;
  status: MembershipStatus;
  invitedByUserId: number | null;
  invitedAt: string;
  activatedAt: string | null;
}

export interface ClientMembership extends OrgMembership {
  clientId: number;
}

export interface Integration {
  id: number;
  orgId: number;
  clientId: number | null;
  name: string;
  provider: string;
  status: 'active' | 'disabled';
  createdByUserId: number | null;
  createdAt: string;
}

export interface Resource {
  id: number;
  name: string;
}

export interface Action {
  id: number;
  name: string;
}

export interface Capability {
  id: number;
  resourceId: number;
  actionId: number;
}

export interface CapabilityPreset {
  id: number;
  orgId: number | null;
  roleId: number;
  label: string;
  description?: string;
  capabilityId: number;
}

// Scope (orgId/clientId/projectId) is mutually exclusive: exactly one is
// non-null, the other two are null (spec003 §1). Capability information has
// moved entirely to GrantCapability (spec004 §2) — this row is scope +
// grantee + role only.
//
// spec010 §2: exactly one of `email` / `integrationId` is non-null — a grant
// targets a user or an integration, never both, never neither.
export interface AccessGrant {
  id: number;
  orgId: number | null;
  clientId: number | null;
  projectId: number | null;
  userId: number | null;
  integrationId: number | null;
  email: string | null;
  roleId: number | null;
}

// grant_capabilities table (spec004 §2). `added`/`denied` mutually
// exclusive; `preset`/`added` mutually exclusive; `preset`+`denied` may
// coexist (a preset capability the grant explicitly revokes).
export interface GrantCapability {
  id: number;
  grantId: number;
  capabilityId: number;
  preset: boolean;
  added: boolean;
  denied: boolean;
}

// GET /users-access-grants response row (spec003 §7, updated spec004 §7) —
// roleId/roleName resolve directly from AccessGrant.roleId now.
export interface AccessGrantSummary {
  grantId: number;
  orgId: number | null;
  clientId: number | null;
  projectId: number | null;
  userId: number | null;
  email: string;
  displayName: string | null;
  roleId: number | null;
  roleName: string | null;
}

// GET /integrations-access-grants response row (spec010 §4) — the
// integration-targeted mirror of AccessGrantSummary: integrationId/
// integrationName/provider stand in for userId/email/displayName.
export interface IntegrationAccessGrantSummary {
  grantId: number;
  orgId: number | null;
  clientId: number | null;
  projectId: number | null;
  integrationId: number;
  integrationName: string;
  provider: string;
  roleId: number | null;
  roleName: string | null;
}

// GET /capabilities response row (spec003 §10.1).
export interface CapabilityDetail {
  id: number;
  resourceId: number;
  resourceName: string;
  actionId: number;
  actionName: string;
}

// GET /capabilities-preset response row (spec004 §3) — the full
// role→capability catalog, independent of any grant.
export interface RoleCapabilityPreset {
  roleId: number;
  roleName: string;
  capabilityId: number;
  label: string;
  description?: string;
}

// GET /grant-capabilities?grantId=... response row (spec004 §5) — supersedes
// spec003 §10.3's GrantCapabilityEntry/three-endpoint split.
export interface GrantCapabilityDetail {
  capabilityId: number;
  resourceId: number;
  actionId: number;
  preset: boolean;
  added: boolean;
  denied: boolean;
}

// PATCH /grant-capabilities?grantId=... request body entry (spec006 §4).
export interface GrantCapabilityUpdateEntry {
  capabilityId: number;
  preset: boolean;
  added: boolean;
  denied: boolean;
}

// PATCH /grant-capabilities?grantId=... request body (spec006 §4, extended
// to also persist roleId — see grant-capabilities-service.ts).
export interface GrantCapabilitiesPatchRequestBody {
  capabilities: GrantCapabilityUpdateEntry[];
  roleId?: number | null;
}

// POST /user request body (spec007 §5 Step A / §6).
export interface CreateUserRequestBody {
  email: string;
  displayName: string;
  scope: 'Org' | 'Client';
  orgId: number | null;
  clientId: number | null;
  roleId: number | null;
  invitedByUserId: number | null;
}

// POST /grant-capabilities request body (spec007 §5 Step B, extended
// spec010 §5 for integration-targeted grants) — creates a new access_grants
// row plus its grant_capabilities rows in one call. Exactly one of
// `email`/`integrationId` must be non-null (spec010 §2's invariant).
export interface CreateGrantRequestBody {
  orgId: number | null;
  clientId: number | null;
  projectId: number | null;
  email: string | null;
  integrationId: number | null;
  roleId: number | null;
  grantCapabilities: GrantCapabilityUpdateEntry[];
}

// GET /organization-members?orgIds=... response row (spec008). One row per
// (orgId, email) with at least one org_membership/client_membership row
// under that org; reach/capabilities derived from access_grants/
// grant_capabilities, not membership rows (spec008 decision 1).
export interface OrganizationMemberReachEntry {
  kind: 'client' | 'project';
  id: number;
  name: string;
}

export interface OrganizationMemberCapabilityEntry {
  capabilityId: number;
  resourceId: number;
  resourceName: string;
  actionId: number;
  actionName: string;
}

export interface OrganizationMemberSummary {
  orgId: number;
  email: string;
  displayName: string | null;
  status: MembershipStatus;
  orgWideAccess: boolean;
  reach: OrganizationMemberReachEntry[];
  capabilities: OrganizationMemberCapabilityEntry[];
  grantIds: number[];
}

export interface OrganizationOverview {
  organization: Organization;
  clients: Client[];
  projects: Project[];
  members: Array<
    OrgMembership & {
      roleDetails: Role | null;
      user: User | null;
    }
  >;
  clientMembers: Array<
    ClientMembership & {
      roleDetails: Role | null;
      user: User | null;
      client: Client | null;
    }
  >;
  integrations: Integration[];
  capabilityPresets: CapabilityPreset[];
}
