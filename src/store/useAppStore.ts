import { create } from 'zustand';
import type {
  AccessGrantSummary,
  CapabilityDetail,
  ClientMembership,
  OrganizationMemberSummary,
  OrganizationOverview,
  OrgMembership,
  Project,
  Role,
  RoleCapabilityPreset,
  User,
} from '../types';

export type FetchStatus = 'idle' | 'loading' | 'success' | 'error';

interface AppState {
  user: User | null;
  organizations: OrganizationOverview[];
  organizationsStatus: FetchStatus;
  orgMemberships: OrgMembership[];
  orgMembershipsStatus: FetchStatus;
  clientMemberships: ClientMembership[];
  clientMembershipsStatus: FetchStatus;
  accessGrantSummaries: AccessGrantSummary[];
  accessGrantSummariesStatus: FetchStatus;
  projects: Project[];
  projectsStatus: FetchStatus;
  roles: Role[];
  rolesStatus: FetchStatus;
  capabilities: CapabilityDetail[];
  capabilitiesStatus: FetchStatus;
  rolePresetCapabilities: RoleCapabilityPreset[];
  rolePresetCapabilitiesStatus: FetchStatus;
  organizationMembers: OrganizationMemberSummary[];
  organizationMembersStatus: FetchStatus;
  setUser: (user: User) => void;
  setOrganizations: (organizations: OrganizationOverview[]) => void;
  setOrganizationsStatus: (status: FetchStatus) => void;
  setOrgMemberships: (orgMemberships: OrgMembership[]) => void;
  setOrgMembershipsStatus: (status: FetchStatus) => void;
  setClientMemberships: (clientMemberships: ClientMembership[]) => void;
  setClientMembershipsStatus: (status: FetchStatus) => void;
  setAccessGrantSummaries: (accessGrantSummaries: AccessGrantSummary[]) => void;
  setAccessGrantSummariesStatus: (status: FetchStatus) => void;
  addAccessGrantSummary: (accessGrantSummary: AccessGrantSummary) => void;
  updateAccessGrantSummaryRole: (grantId: number, roleId: number | null, roleName: string | null) => void;
  setProjects: (projects: Project[]) => void;
  setProjectsStatus: (status: FetchStatus) => void;
  setRoles: (roles: Role[]) => void;
  setRolesStatus: (status: FetchStatus) => void;
  setCapabilities: (capabilities: CapabilityDetail[]) => void;
  setCapabilitiesStatus: (status: FetchStatus) => void;
  setRolePresetCapabilities: (rolePresetCapabilities: RoleCapabilityPreset[]) => void;
  setRolePresetCapabilitiesStatus: (status: FetchStatus) => void;
  setOrganizationMembers: (organizationMembers: OrganizationMemberSummary[]) => void;
  setOrganizationMembersStatus: (status: FetchStatus) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  organizations: [],
  organizationsStatus: 'idle',
  orgMemberships: [],
  orgMembershipsStatus: 'idle',
  clientMemberships: [],
  clientMembershipsStatus: 'idle',
  accessGrantSummaries: [],
  accessGrantSummariesStatus: 'idle',
  projects: [],
  projectsStatus: 'idle',
  roles: [],
  rolesStatus: 'idle',
  capabilities: [],
  capabilitiesStatus: 'idle',
  rolePresetCapabilities: [],
  rolePresetCapabilitiesStatus: 'idle',
  organizationMembers: [],
  organizationMembersStatus: 'idle',
  setUser: (user) => set({ user }),
  setOrganizations: (organizations) => set({ organizations }),
  setOrganizationsStatus: (organizationsStatus) => set({ organizationsStatus }),
  setOrgMemberships: (orgMemberships) => set({ orgMemberships }),
  setOrgMembershipsStatus: (orgMembershipsStatus) => set({ orgMembershipsStatus }),
  setClientMemberships: (clientMemberships) => set({ clientMemberships }),
  setClientMembershipsStatus: (clientMembershipsStatus) => set({ clientMembershipsStatus }),
  setAccessGrantSummaries: (accessGrantSummaries) => set({ accessGrantSummaries }),
  setAccessGrantSummariesStatus: (accessGrantSummariesStatus) =>
    set({ accessGrantSummariesStatus }),
  // spec007 §5 Step B: appends the just-created grant returned by
  // POST /grant-capabilities, so it shows up without a full refetch.
  addAccessGrantSummary: (accessGrantSummary) =>
    set((state) => ({ accessGrantSummaries: [...state.accessGrantSummaries, accessGrantSummary] })),
  // Fix: PATCH /grant-capabilities now also persists roleId (previously
  // silently dropped — see grant-capabilities-service.ts) — this keeps the
  // grants table's "Preset Role" column in sync with a successful Save
  // without needing a full GET /users-access-grants refetch.
  updateAccessGrantSummaryRole: (grantId, roleId, roleName) =>
    set((state) => ({
      accessGrantSummaries: state.accessGrantSummaries.map((summary) =>
        summary.grantId === grantId ? { ...summary, roleId, roleName } : summary,
      ),
    })),
  setProjects: (projects) => set({ projects }),
  setProjectsStatus: (projectsStatus) => set({ projectsStatus }),
  setRoles: (roles) => set({ roles }),
  setRolesStatus: (rolesStatus) => set({ rolesStatus }),
  setCapabilities: (capabilities) => set({ capabilities }),
  setCapabilitiesStatus: (capabilitiesStatus) => set({ capabilitiesStatus }),
  setRolePresetCapabilities: (rolePresetCapabilities) => set({ rolePresetCapabilities }),
  setRolePresetCapabilitiesStatus: (rolePresetCapabilitiesStatus) =>
    set({ rolePresetCapabilitiesStatus }),
  setOrganizationMembers: (organizationMembers) => set({ organizationMembers }),
  setOrganizationMembersStatus: (organizationMembersStatus) => set({ organizationMembersStatus }),
}));
