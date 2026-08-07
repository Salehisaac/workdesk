import { Route, Routes } from 'react-router-dom';
import { ProjectBoardPage } from '../modules/project/pages/ProjectBoardPage';
import { ProjectCreatePage } from '../modules/project/pages/ProjectCreatePage';
import { ProjectListPage } from '../modules/project/pages/ProjectListPage';
import { HomePage } from './pages/HomePage';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/projects" element={<ProjectListPage />} />
      <Route path="/projects/new" element={<ProjectCreatePage />} />
      <Route path="/projects/:projectId" element={<ProjectBoardPage />} />
    </Routes>
  );
}
