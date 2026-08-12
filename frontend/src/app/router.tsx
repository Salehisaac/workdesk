import { Route, Routes } from 'react-router-dom';
import { JobCreatePage } from '../modules/project/pages/JobCreatePage';
import { ProjectBoardPage } from '../modules/project/pages/ProjectBoardPage';
import { ProjectCreatePage } from '../modules/project/pages/ProjectCreatePage';
import { ProjectListPage } from '../modules/project/pages/ProjectListPage';
import { ReminderCreatePage } from '../modules/reminder/pages/ReminderCreatePage';
import { ReminderListPage } from '../modules/reminder/pages/ReminderListPage';
import { HomePage } from './pages/HomePage';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/projects" element={<ProjectListPage />} />
      <Route path="/projects/new" element={<ProjectCreatePage />} />
      <Route path="/projects/:projectId" element={<ProjectBoardPage />} />
      {/* The list is part of the path so the form opens with it preselected;
          the form's own selector can still move the job to another list. */}
      <Route path="/projects/:projectId/lists/:listId/jobs/new" element={<JobCreatePage />} />
      <Route path="/reminders" element={<ReminderListPage />} />
      <Route path="/reminders/new" element={<ReminderCreatePage />} />
    </Routes>
  );
}
