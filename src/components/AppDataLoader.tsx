import { useEffect, type ReactNode } from 'react';
import { faSpinner } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { apiClient } from '../lib/api';
import { getLoggedInUser } from '../lib/mockUser';
import { useAppStore } from '../store/useAppStore';
import type { OrganizationOverview } from '../types';

interface AppDataLoaderProps {
  children: ReactNode;
}

/**
 * App-level data fetching (spec002 §5): lives above the routed pages so it runs
 * regardless of which route is active. Fetches the logged-in user's organizations
 * once on mount, blocking the routed content underneath with a spinner while in
 * flight and with an error message if the fetch fails.
 */
export function AppDataLoader({ children }: AppDataLoaderProps) {
  const organizationsStatus = useAppStore((state) => state.organizationsStatus);
  const setUser = useAppStore((state) => state.setUser);
  const setOrganizations = useAppStore((state) => state.setOrganizations);
  const setOrganizationsStatus = useAppStore((state) => state.setOrganizationsStatus);

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
  }, [setOrganizations, setOrganizationsStatus, setUser]);

  return (
    <div className="relative min-h-screen">
      {children}

      {organizationsStatus === 'loading' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/70">
          <FontAwesomeIcon icon={faSpinner} spin size="3x" className="text-slate-600" />
        </div>
      )}

      {organizationsStatus === 'error' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 px-6 text-center">
          <p className="max-w-md text-slate-700">
            An error occured. Please refresh the page. If the error persists, contact support
          </p>
        </div>
      )}
    </div>
  );
}
