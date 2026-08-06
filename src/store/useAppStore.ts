import { create } from 'zustand';
import type {
  AccessGrantSummary,
  CapabilityDetail,
  ClientMembership,
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
  setUser: (user: User) => void;
  setOrganizations: (organizations: OrganizationOverview[]) => void;
  setOrganizationsStatus: (status: FetchStatus) => void;
  setOrgMemberships: (orgMemberships: OrgMembership[]) => void;
  setOrgMembershipsStatus: (status: FetchStatus) => void;
  setClientMemberships: (clientMemberships: ClientMembership[]) => void;
  setClientMembershipsStatus: (status: FetchStatus) => void;
  setAccessGrantSummaries: (accessGrantSummaries: AccessGrantSummary[]) => void;
  setAccessGrantSummariesStatus: (status: FetchStatus) => void;
  setProjects: (projects: Project[]) => void;
  setProjectsStatus: (status: FetchStatus) => void;
  setRoles: (roles: Role[]) => void;
  setRolesStatus: (status: FetchStatus) => void;
  setCapabilities: (capabilities: CapabilityDetail[]) => void;
  setCapabilitiesStatus: (status: FetchStatus) => void;
  setRolePresetCapabilities: (rolePresetCapabilities: RoleCapabilityPreset[]) => void;
  setRolePresetCapabilitiesStatus: (status: FetchStatus) => void;
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
  setProjects: (projects) => set({ projects }),
  setProjectsStatus: (projectsStatus) => set({ projectsStatus }),
  setRoles: (roles) => set({ roles }),
  setRolesStatus: (rolesStatus) => set({ rolesStatus }),
  setCapabilities: (capabilities) => set({ capabilities }),
  setCapabilitiesStatus: (capabilitiesStatus) => set({ capabilitiesStatus }),
  setRolePresetCapabilities: (rolePresetCapabilities) => set({ rolePresetCapabilities }),
  setRolePresetCapabilitiesStatus: (rolePresetCapabilitiesStatus) =>
    set({ rolePresetCapabilitiesStatus }),
}));
