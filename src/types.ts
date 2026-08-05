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
  label: string;
  description?: string;
  capabilities: Capability[];
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
