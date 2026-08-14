import { useEffect, useRef } from 'react';
import { Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { bridge } from '../bridge';
import { MeetingRepoPage } from '../modules/meeting/pages/MeetingRepoPage';
import { SessionCreatePage } from '../modules/meeting/pages/SessionCreatePage';
import { SessionDetailPage } from '../modules/meeting/pages/SessionDetailPage';
import { LedgerBookPage } from '../modules/ledger/pages/LedgerBookPage';
import { LedgerCreatePage } from '../modules/ledger/pages/LedgerCreatePage';
import { LedgerListPage } from '../modules/ledger/pages/LedgerListPage';
import { LedgerReportPage } from '../modules/ledger/pages/LedgerReportPage';
import { TransactionCreatePage } from '../modules/ledger/pages/TransactionCreatePage';
import { NoteCreatePage } from '../modules/note/pages/NoteCreatePage';
import { JobCreatePage } from '../modules/project/pages/JobCreatePage';
import { JobEditPage } from '../modules/project/pages/JobEditPage';
import { ProjectBoardPage } from '../modules/project/pages/ProjectBoardPage';
import { ProjectCreatePage } from '../modules/project/pages/ProjectCreatePage';
import { ProjectEditPage } from '../modules/project/pages/ProjectEditPage';
import { ProjectListPage } from '../modules/project/pages/ProjectListPage';
import { ProjectReportPage } from '../modules/project/pages/ProjectReportPage';
import { ReminderCreatePage } from '../modules/reminder/pages/ReminderCreatePage';
import { ReminderListPage } from '../modules/reminder/pages/ReminderListPage';
import { HomePage } from './pages/HomePage';

/**
 * Everything a message from the bot can point at, by the `<kind>` prefix the
 * backend writes — sessioninvite.StartParamPrefix, ledgerinvite.StartParamPrefix
 * and app/services/projectfeed's three prefixes are the other half of this pair.
 * A Map rather than an object literal so a `<kind>` of `constructor` or
 * `toString` looks up to nothing instead of to something inherited.
 *
 * `ids` is how many id segments that kind carries, checked before `path` is
 * called: everything under a project is nested under it in the routes below, so
 * a list or a job needs its project's id alongside its own.
 */
const START_PARAM_ROUTES = new Map<string, { ids: number; path: (ids: string[]) => string }>([
  ['session', { ids: 1, path: ([sessionId]) => `/sessions/${sessionId}` }],
  ['ledger', { ids: 1, path: ([ledgerId]) => `/ledgers/${ledgerId}` }],
  ['project', { ids: 1, path: ([projectId]) => `/projects/${projectId}` }],
  // A list has no screen of its own — it is a column of its project's board, so
  // its link opens that board and asks it to scroll to the column (?list=, read
  // by ProjectBoardPage).
  ['list', { ids: 2, path: ([projectId, listId]) => `/projects/${projectId}?list=${listId}` }],
  ['job', { ids: 2, path: ([projectId, jobId]) => `/projects/${projectId}/jobs/${jobId}/edit` }],
]);

/**
 * Where a `?startapp=` launch parameter should land.
 *
 * The parameter is `<kind>-<id>[-<id>]`, written by whichever module messaged the
 * link: app/services/sessioninvite and ledgerinvite (modules that provision no
 * group, so a direct message is how their members find them), and
 * app/services/projectfeed (a project HAS a group, and these are the messages it
 * posts into it).
 *
 * Every segment is validated rather than interpolated: this string arrives from
 * initDataUnsafe, so it decides which screen opens and nothing else. The screens
 * it opens re-authorize on their own — GET /sessions/{id}, /ledgers/{id} and
 * /projects/{id} are all membership-checked server-side — so a forged parameter
 * buys a 403, not access.
 *
 * Returns null for anything unrecognized, which leaves the app on the home page
 * rather than on an error.
 */
export function startParamRoute(startParam: string): string | null {
  const [kind, ...ids] = startParam.split('-');

  const route = START_PARAM_ROUTES.get(kind);
  if (!route || ids.length !== route.ids) return null;
  if (!ids.every((id) => /^\d+$/.test(id))) return null;

  return route.path(ids);
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
        {/* Its own screen rather than a sheet over the board, like the report:
            it is a form plus a delete, and it needs a path the back button can
            pop. Reachable only by the project's creator — the board offers it to
            nobody else, and the API refuses everyone else. */}
        <Route path="/projects/:projectId/edit" element={<ProjectEditPage />} />
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
        {/* «دفتر مالی». The book is the screen; the report is the same book cut
            to a period, so it hangs off the book's own path rather than living
            somewhere else. /ledgers/:ledgerId is also what a ledger invite opens
            (see startParamRoute), so like /sessions/:sessionId its path is part
            of the wire contract with the backend, not just internal routing. */}
        <Route path="/ledgers" element={<LedgerListPage />} />
        <Route path="/ledgers/new" element={<LedgerCreatePage />} />
        <Route path="/ledgers/:ledgerId" element={<LedgerBookPage />} />
        {/* Which direction is being recorded is decided by the button that
            opened the form, and travels in ?type= — a create screen that had to
            ask again would be asking a question the last tap already answered. */}
        <Route path="/ledgers/:ledgerId/transactions/new" element={<TransactionCreatePage />} />
        {/* ?period=daily|weekly|monthly|yearly|custom — chosen in a dialog, so
            it belongs in the URL where going back returns to the same report. */}
        <Route path="/ledgers/:ledgerId/report" element={<LedgerReportPage />} />
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
