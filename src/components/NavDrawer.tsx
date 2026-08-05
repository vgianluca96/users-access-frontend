import { faXmark } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useNavigate } from 'react-router-dom';

interface NavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NavDrawer({ isOpen, onClose }: NavDrawerProps) {
  const navigate = useNavigate();

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose}>
      <div
        className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col gap-4 bg-white p-6 shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close menu"
          className="self-end text-slate-500 hover:text-slate-800"
        >
          <FontAwesomeIcon icon={faXmark} size="lg" />
        </button>

        <button
          type="button"
          onClick={() => {
            navigate('/access-editor');
            onClose();
          }}
          className="rounded-md bg-slate-100 px-4 py-2 text-left text-slate-800 hover:bg-slate-200"
        >
          Access Editor
        </button>

        <button
          type="button"
          onClick={() => {
            navigate('/organization-members');
            onClose();
          }}
          className="rounded-md bg-slate-100 px-4 py-2 text-left text-slate-800 hover:bg-slate-200"
        >
          Organization Members
        </button>
      </div>
    </div>
  );
}
