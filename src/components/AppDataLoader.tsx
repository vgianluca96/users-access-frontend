import { useEffect, type ReactNode } from 'react';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { apiClient } from '../lib/api';
import { getLoggedInUser } from '../lib/mockUser';
import { useAppStore } from '../store/useAppStore';
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
} from '../types';

interface AppDataLoaderProps {
  children: ReactNode;
}

/**
 * App-level data fetching: lives above the routed pages so it runs
 * regardless of which route is active. Fetches, on mount (spec004 §4):
 *  - /roles, /capabilities, /capabilities-preset — independent of any id, fire immediately.
 *  - the logged-in user's organizations (spec002 §5), by userId — independent.
 *  - the logged-in user's org/client memberships (spec003 §3 steps 1-2), by email — independent.
 *  - access grant summaries (spec003 §3 step 3), which depend on the org ids from the org-membership fetch.
 *  - projects (spec003 §3 step 4), which depend on the org ids and client ids from the two membership fetches.
 *  - organization members (spec008 §4), which depend on the org ids from the org-membership fetch, same as access grant summaries.
 * Blocks the routed content underneath with a spinner while any of the above
 * is in flight, and with an error message if any of them fails.
 */
export function AppDataLoader({ children }: AppDataLoaderProps) {
  const organizationsStatus = useAppStore((state) => state.organizationsStatus);
  const orgMembershipsStatus = useAppStore((state) => state.orgMembershipsStatus);
  const clientMembershipsStatus = useAppStore((state) => state.clientMembershipsStatus);
  const accessGrantSummariesStatus = useAppStore((state) => state.accessGrantSummariesStatus);
  const integrationAccessGrantSummariesStatus = useAppStore(
    (state) => state.integrationAccessGrantSummariesStatus,
  );
  const projectsStatus = useAppStore((state) => state.projectsStatus);
  const rolesStatus = useAppStore((state) => state.rolesStatus);
  const capabilitiesStatus = useAppStore((state) => state.capabilitiesStatus);
  const rolePresetCapabilitiesStatus = useAppStore((state) => state.rolePresetCapabilitiesStatus);
  const organizationMembersStatus = useAppStore((state) => state.organizationMembersStatus);

  const setUser = useAppStore((state) => state.setUser);
  const setOrganizations = useAppStore((state) => state.setOrganizations);
  const setOrganizationsStatus = useAppStore((state) => state.setOrganizationsStatus);
  const setOrgMemberships = useAppStore((state) => state.setOrgMemberships);
  const setOrgMembershipsStatus = useAppStore((state) => state.setOrgMembershipsStatus);
  const setClientMemberships = useAppStore((state) => state.setClientMemberships);
  const setClientMembershipsStatus = useAppStore((state) => state.setClientMembershipsStatus);
  const setAccessGrantSummaries = useAppStore((state) => state.setAccessGrantSummaries);
  const setAccessGrantSummariesStatus = useAppStore(
    (state) => state.setAccessGrantSummariesStatus,
  );
  const setIntegrationAccessGrantSummaries = useAppStore(
    (state) => state.setIntegrationAccessGrantSummaries,
  );
  const setIntegrationAccessGrantSummariesStatus = useAppStore(
    (state) => state.setIntegrationAccessGrantSummariesStatus,
  );
  const setProjects = useAppStore((state) => state.setProjects);
  const setProjectsStatus = useAppStore((state) => state.setProjectsStatus);
  const setRoles = useAppStore((state) => state.setRoles);
  const setRolesStatus = useAppStore((state) => state.setRolesStatus);
  const setCapabilities = useAppStore((state) => state.setCapabilities);
  const setCapabilitiesStatus = useAppStore((state) => state.setCapabilitiesStatus);
  const setRolePresetCapabilities = useAppStore((state) => state.setRolePresetCapabilities);
  const setRolePresetCapabilitiesStatus = useAppStore(
    (state) => state.setRolePresetCapabilitiesStatus,
  );
  const setOrganizationMembers = useAppStore((state) => state.setOrganizationMembers);
  const setOrganizationMembersStatus = useAppStore((state) => state.setOrganizationMembersStatus);

  useEffect(() => {
    const user = getLoggedInUser();
    setUser(user);

    setOrganizationsStatus('loading');
    apiClient
      .get<OrganizationOverview[]>('/organizations', { params: { userId: user.id } })
      .then((response) => {
        setOrganizations(response.data);
        setOrganizationsStatus('success');
      })
      .catch(() => {
        setOrganizationsStatus('error');
      });

    setRolesStatus('loading');
    apiClient
      .get<Role[]>('/roles')
      .then((response) => {
        setRoles(response.data);
        setRolesStatus('success');
      })
      .catch(() => {
        setRolesStatus('error');
      });

    setCapabilitiesStatus('loading');
    apiClient
      .get<CapabilityDetail[]>('/capabilities')
      .then((response) => {
        setCapabilities(response.data);
        setCapabilitiesStatus('success');
      })
      .catch(() => {
        setCapabilitiesStatus('error');
      });

    setRolePresetCapabilitiesStatus('loading');
    apiClient
      .get<RoleCapabilityPreset[]>('/capabilities-preset')
      .then((response) => {
        setRolePresetCapabilities(response.data);
        setRolePresetCapabilitiesStatus('success');
      })
      .catch(() => {
        setRolePresetCapabilitiesStatus('error');
      });

    setOrgMembershipsStatus('loading');
    const orgMembershipsPromise = apiClient
      .get<OrgMembership[]>('/org-membership', { params: { email: user.email } })
      .then((response) => {
        setOrgMemberships(response.data);
        setOrgMembershipsStatus('success');
        return response.data;
      })
      .catch((): OrgMembership[] => {
        setOrgMembershipsStatus('error');
        return [];
      });

    setClientMembershipsStatus('loading');
    const clientMembershipsPromise = apiClient
      .get<ClientMembership[]>('/client-membership', { params: { email: user.email } })
      .then((response) => {
        setClientMemberships(response.data);
        setClientMembershipsStatus('success');
        return response.data;
      })
      .catch((): ClientMembership[] => {
        setClientMembershipsStatus('error');
        return [];
      });

    orgMembershipsPromise.then((orgMemberships) => {
      const orgIds = Array.from(new Set(orgMemberships.map((membership) => membership.orgId)));

      setAccessGrantSummariesStatus('loading');
      apiClient
        .get<AccessGrantSummary[]>('/users-access-grants', {
          params: { orgIds: orgIds.join(',') },
        })
        .then((response) => {
          setAccessGrantSummaries(response.data);
          setAccessGrantSummariesStatus('success');
        })
        .catch(() => {
          setAccessGrantSummariesStatus('error');
        });

      // spec010 §6: the integration-targeted mirror of the fetch above, same
      // org-id dependency.
      setIntegrationAccessGrantSummariesStatus('loading');
      apiClient
        .get<IntegrationAccessGrantSummary[]>('/integrations-access-grants', {
          params: { orgIds: orgIds.join(',') },
        })
        .then((response) => {
          setIntegrationAccessGrantSummaries(response.data);
          setIntegrationAccessGrantSummariesStatus('success');
        })
        .catch(() => {
          setIntegrationAccessGrantSummariesStatus('error');
        });

      // spec008 §4: same org-id dependency as access grant summaries above.
      setOrganizationMembersStatus('loading');
      apiClient
        .get<OrganizationMemberSummary[]>('/organization-members', {
          params: { orgIds: orgIds.join(',') },
        })
        .then((response) => {
          setOrganizationMembers(response.data);
          setOrganizationMembersStatus('success');
        })
        .catch(() => {
          setOrganizationMembersStatus('error');
        });
    });

    Promise.all([orgMembershipsPromise, clientMembershipsPromise]).then(
      ([orgMemberships, clientMemberships]) => {
        const orgIds = Array.from(new Set(orgMemberships.map((membership) => membership.orgId)));
        const clientIds = Array.from(
          new Set(clientMemberships.map((membership) => membership.clientId)),
        );

        setProjectsStatus('loading');
        apiClient
          .get<Project[]>('/projects', {
            params: { orgId: orgIds.join(','), clientId: clientIds.join(',') },
          })
          .then((response) => {
            setProjects(response.data);
            setProjectsStatus('success');
          })
          .catch(() => {
            setProjectsStatus('error');
          });
      },
    );
  }, [
    setAccessGrantSummaries,
    setAccessGrantSummariesStatus,
    setIntegrationAccessGrantSummaries,
    setIntegrationAccessGrantSummariesStatus,
    setCapabilities,
    setCapabilitiesStatus,
    setClientMemberships,
    setClientMembershipsStatus,
    setOrgMemberships,
    setOrgMembershipsStatus,
    setOrganizationMembers,
    setOrganizationMembersStatus,
    setOrganizations,
    setOrganizationsStatus,
    setProjects,
    setProjectsStatus,
    setRolePresetCapabilities,
    setRolePresetCapabilitiesStatus,
    setRoles,
    setRolesStatus,
    setUser,
  ]);

  const statuses = [
    organizationsStatus,
    orgMembershipsStatus,
    clientMembershipsStatus,
    accessGrantSummariesStatus,
    integrationAccessGrantSummariesStatus,
    projectsStatus,
    rolesStatus,
    capabilitiesStatus,
    rolePresetCapabilitiesStatus,
    organizationMembersStatus,
  ];
  const isLoading = statuses.some((status) => status === 'loading');
  const hasError = statuses.some((status) => status === 'error');

  return (
    <div className="relative min-h-screen">
      {children}

      {isLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70">
          <FontAwesomeIcon icon={faSpinner} spin size="3x" className="text-slate-600" />
        </div>
      )}

      {!isLoading && hasError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 px-6 text-center">
          <p className="max-w-md text-slate-700">
            An error occured. Please refresh the page. If the error persists, contact support
          </p>
        </div>
      )}
    </div>
  );
}
