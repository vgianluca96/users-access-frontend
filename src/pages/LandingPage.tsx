import { useState } from 'react';
import { faBars } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { NavDrawer } from '../components/NavDrawer';

export function LandingPage() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <button
        type="button"
        onClick={() => setIsDrawerOpen(true)}
        aria-label="Open menu"
        className="fixed left-4 top-4 text-slate-700 hover:text-slate-900"
      >
        <FontAwesomeIcon icon={faBars} size="lg" />
      </button>

      <h1 className="text-2xl font-semibold text-slate-800">Welcome</h1>

      <NavDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
    </div>
  );
}
