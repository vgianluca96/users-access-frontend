import { useNavigate } from 'react-router-dom';

/**
 * spec009 §7: the "Access Editor"/"Organization Members" nav buttons, formerly
 * only reachable via NavDrawer.tsx's hamburger drawer, now live directly on
 * the page under the welcome message — the drawer is removed as a redundant
 * second path to the same two destinations.
 */
export function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-50">
      <h1 className="text-2xl font-semibold text-slate-800">Welcome</h1>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/access-editor')}
          className="rounded-md bg-slate-800 px-4 py-2 text-white hover:bg-slate-700"
        >
          Access Editor
        </button>

        <button
          type="button"
          onClick={() => navigate('/organization-members')}
          className="rounded-md bg-slate-800 px-4 py-2 text-white hover:bg-slate-700"
        >
          Organization Members
        </button>
      </div>
    </div>
  );
}
