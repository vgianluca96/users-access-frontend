import { create } from 'zustand';
import type { OrganizationOverview, User } from '../types';

export type FetchStatus = 'idle' | 'loading' | 'success' | 'error';

interface AppState {
  user: User | null;
  organizations: OrganizationOverview[];
  organizationsStatus: FetchStatus;
  setUser: (user: User) => void;
  setOrganizations: (organizations: OrganizationOverview[]) => void;
  setOrganizationsStatus: (status: FetchStatus) => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  organizations: [],
  organizationsStatus: 'idle',
  setUser: (user) => set({ user }),
  setOrganizations: (organizations) => set({ organizations }),
  setOrganizationsStatus: (organizationsStatus) => set({ organizationsStatus }),
}));
