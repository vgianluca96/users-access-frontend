import type { User } from '../types';

const STORAGE_KEY = 'loggedInUser';

// Mocked logged-in user, since there is no login flow (spec002 §4) — the user
// with id 1 from backend/data/users.json.
const MOCK_USER: User = {
  id: 1,
  email: 'user1@example.com',
  displayName: 'User 1',
  avatarUrl: 'https://example.com/avatars/user-1.png',
  deleted: false,
};

/** Reads the logged-in user from sessionStorage, seeding it with the mock user if absent. */
export function getLoggedInUser(): User {
  const stored = sessionStorage.getItem(STORAGE_KEY);

  if (stored) {
    return JSON.parse(stored) as User;
  }

  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(MOCK_USER));
  return MOCK_USER;
}
