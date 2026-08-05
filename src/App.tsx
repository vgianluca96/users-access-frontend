import { Route, Routes } from 'react-router-dom';
import { AppDataLoader } from './components/AppDataLoader';
import { AccessEditorPage } from './pages/AccessEditorPage';
import { LandingPage } from './pages/LandingPage';
import { OrganizationMembersPage } from './pages/OrganizationMembersPage';

function App() {
  return (
    <AppDataLoader>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/access-editor" element={<AccessEditorPage />} />
        <Route path="/organization-members" element={<OrganizationMembersPage />} />
      </Routes>
    </AppDataLoader>
  );
}

export default App;
