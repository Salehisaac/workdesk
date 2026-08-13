import { useEffect, useRef } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { bridge } from '../bridge';
import { MeetingRepoPage } from '../modules/meeting/pages/MeetingRepoPage';
import { SessionCreatePage } from '../modules/meeting/pages/SessionCreatePage';
import { SessionDetailPage } from '../modules/meeting/pages/SessionDetailPage';
import { NoteCreatePage } from '../modules/note/pages/NoteCreatePage';
import { JobCreatePage } from '../modules/project/pages/JobCreatePage';
import { JobEditPage } from '../modules/project/pages/JobEditPage';
import { ProjectBoardPage } from '../modules/project/pages/ProjectBoardPage';
import { ProjectCreatePage } from '../modules/project/pages/ProjectCreatePage';
import { ProjectListPage } from '../modules/project/pages/ProjectListPage';
import { ProjectReportPage } from '../modules/project/pages/ProjectReportPage';
import { ReminderCreatePage } from '../modules/reminder/pages/ReminderCreatePage';
import { ReminderListPage } from '../modules/reminder/pages/ReminderListPage';
import { HomePage } from './pages/HomePage';

/**
 * Where a `?startapp=` launch parameter should land.
 *
 * The parameter is `<kind>-<id>` — currently only `session-<id>`, written by the
 * backend's app/services/sessioninvite (StartParam there is the other half of
 * this). Split on the FIRST hyphen only, so an id containing one wouldn't be
 * truncated, and validated rather than interpolated: this string arrives from
 * initDataUnsafe, so it decides which screen opens and nothing else. The screen
 * it opens re-authorizes on its own — GET /sessions/{id} is membership-checked
 * server-side — so a forged parameter buys a 403, not access.
 *
 * Returns null for anything unrecognized, which leaves the app on the home page
 * rather than on an error.
 */
export function startParamRoute(startParam: string): string | null {
  const separator = startParam.indexOf('-');
  if (separator <= 0) return null;

  const kind = startParam.slice(0, separator);
  const id = startParam.slice(separator + 1);
  if (kind !== 'session' || !/^\d+$/.test(id)) return null;

  return `/sessions/${id}`;
}

/**
 * Opens the screen the launch link asked for, once.
 *
 * A component rather than something in App.tsx because it needs the router's
 * navigate, and `replace` so the client's back button still exits the app from
 * the deep-linked screen instead of stepping back to a home page the user never
 * saw. The ref guard is what makes it once: React 18's StrictMode double-invokes
 * effects in dev, and a second navigate would fight a user who had already moved
 * on.
 */
function StartParamRedirect() {
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    // Guarded because this is the app's very first act: getEnv() reaches into
    // the client SDK, and a client that hands back something unexpected must
    // cost the deep link, not the whole app.
    let startParam = '';
    try {
      startParam = bridge.getEnv().startParam;
    } catch (error) {
      console.error('[router] could not read the launch parameter', error);
      return;
    }

    const to = startParamRoute(startParam);
    if (to) navigate(to, { replace: true });
  }, [navigate]);

  return null;
}

export function AppRouter() {
  return (
    <>
      <StartParamRedirect />
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
        {/* «مخزن جلسه». /sessions/:sessionId is also what a session invite opens
            (see startParamRoute), so its path is part of the wire contract with
            the backend's sessioninvite package, not just internal routing. */}
        <Route path="/sessions" element={<MeetingRepoPage />} />
        <Route path="/sessions/new" element={<SessionCreatePage />} />
        <Route path="/sessions/:sessionId" element={<SessionDetailPage />} />
        <Route path="/reminders" element={<ReminderListPage />} />
        <Route path="/reminders/new" element={<ReminderCreatePage />} />
        {/* Create-only, and no day segment: a note can only be written for today,
            so there is no other day this route could address. */}
        <Route path="/notes/new" element={<NoteCreatePage />} />
        {/* The client can hand the webview a path of its own choosing when it
            resolves a deep link; anything unknown lands on the home page rather
            than a blank screen. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
