// spec007 §3: mirrors backend/src/utils/validation.ts's isValidEmail — this
// repo has no shared package between backend/frontend (see CLAUDE.md), so
// the same minimal email-format rule is duplicated here to gate step 1's
// Next button the same way the backend re-validates it server-side.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value);
}
