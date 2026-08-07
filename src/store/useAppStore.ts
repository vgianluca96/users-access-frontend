import { create } from 'zustand';
import type {
  AccessGrantSummary,
  CapabilityDetail,
  ClientMembership,
  IntegrationAccessGrantSummary,
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
  integrationAccessGrantSummaries: IntegrationAccessGrantSummary[];
  integrationAccessGrantSummariesStatus: FetchStatus;
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
  removeAccessGrantSummary: (grantId: number) => void;
  updateAccessGrantSummaryRole: (grantId: number, roleId: number | null, roleName: string | null) => void;
  setIntegrationAccessGrantSummaries: (
    integrationAccessGrantSummaries: IntegrationAccessGrantSummary[],
  ) => void;
  setIntegrationAccessGrantSummariesStatus: (status: FetchStatus) => void;
  addIntegrationAccessGrantSummary: (
    integrationAccessGrantSummary: IntegrationAccessGrantSummary,
  ) => void;
  removeIntegrationAccessGrantSummary: (grantId: number) => void;
  updateIntegrationAccessGrantSummaryRole: (
    grantId: number,
    roleId: number | null,
    roleName: string | null,
  ) => void;
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
  integrationAccessGrantSummaries: [],
  integrationAccessGrantSummariesStatus: 'idle',
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
  // spec009 §4: removes a just-deleted grant from the store so the grants
  // table updates without a full refetch.
  removeAccessGrantSummary: (grantId) =>
    set((state) => ({
      accessGrantSummaries: state.accessGrantSummaries.filter((summary) => summary.grantId !== grantId),
    })),
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
  setIntegrationAccessGrantSummaries: (integrationAccessGrantSummaries) =>
    set({ integrationAccessGrantSummaries }),
  setIntegrationAccessGrantSummariesStatus: (integrationAccessGrantSummariesStatus) =>
    set({ integrationAccessGrantSummariesStatus }),
  // spec010 §5: appends the just-created integration grant returned by
  // POST /grant-capabilities, mirroring addAccessGrantSummary above.
  addIntegrationAccessGrantSummary: (integrationAccessGrantSummary) =>
    set((state) => ({
      integrationAccessGrantSummaries: [
        ...state.integrationAccessGrantSummaries,
        integrationAccessGrantSummary,
      ],
    })),
  // spec010 §11: mirrors removeAccessGrantSummary above, for the integrations table's delete button.
  removeIntegrationAccessGrantSummary: (grantId) =>
    set((state) => ({
      integrationAccessGrantSummaries: state.integrationAccessGrantSummaries.filter(
        (summary) => summary.grantId !== grantId,
      ),
    })),
  // spec010 §10: mirrors updateAccessGrantSummaryRole above, for GrantEditorDialog's
  // Save when the edited grant is integration-targeted.
  updateIntegrationAccessGrantSummaryRole: (grantId, roleId, roleName) =>
    set((state) => ({
      integrationAccessGrantSummaries: state.integrationAccessGrantSummaries.map((summary) =>
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
