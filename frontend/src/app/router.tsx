import { Route, Routes } from 'react-router-dom';
import { JobCreatePage } from '../modules/project/pages/JobCreatePage';
import { JobEditPage } from '../modules/project/pages/JobEditPage';
import { ProjectBoardPage } from '../modules/project/pages/ProjectBoardPage';
import { ProjectCreatePage } from '../modules/project/pages/ProjectCreatePage';
import { ProjectListPage } from '../modules/project/pages/ProjectListPage';
import { ProjectReportPage } from '../modules/project/pages/ProjectReportPage';
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
      {/* A route, not a sheet over the board: the report is a screen's worth of
          content, and its own URL is what gives the client's back button
          something to pop instead of closing the mini app. */}
      <Route path="/projects/:projectId/report" element={<ProjectReportPage />} />
      {/* The list is part of the path so the form opens with it preselected;
          the form's own selector can still move the job to another list. */}
      <Route path="/projects/:projectId/lists/:listId/jobs/new" element={<JobCreatePage />} />
      {/* No list segment when editing: which list a job is in is the job's own
          state, read off the job itself rather than repeated in the URL — where
          it would go stale the moment the form moves it. */}
      <Route path="/projects/:projectId/jobs/:jobId/edit" element={<JobEditPage />} />
      <Route path="/reminders" element={<ReminderListPage />} />
      <Route path="/reminders/new" element={<ReminderCreatePage />} />
    </Routes>
  );
}
