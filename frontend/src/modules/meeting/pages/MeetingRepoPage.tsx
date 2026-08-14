import { Button, DotLoading } from 'antd-mobile';
import {
  AddOutline,
  CheckCircleOutline,
  ClockCircleOutline,
  EnvironmentOutline,
  ExclamationCircleOutline,
  FileOutline,
  QuestionCircleOutline,
  RightOutline,
  TeamOutline,
} from 'antd-mobile-icons';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatShortDate, formatTime, toPersianDigits } from '../../../shared/date/jalali';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { useMe } from '../../../shared/api/me';
import { useDecisions, useSessions, useUpdateDecisionStatus } from '../api';
import { MeetingGuideSheet } from '../components/MeetingGuideSheet';
import {
  DECISION_STATUSES,
  DECISION_STATUS_LABEL,
  SESSION_STATUSES,
  SESSION_STATUS_LABEL,
} from '../types';
import type { Decision, DecisionStatus, Session, SessionStatus } from '../types';
import styles from './MeetingRepoPage.module.css';

type Tab = 'sessions' | 'decisions';

/**
 * «مخزن جلسه» — the meeting repository's front door.
 *
 * Two tabs, because the module holds two things that are read in two different
 * ways: جلسات is a timeline (what is coming up, what already happened) and
 * مصوبات is a to-do list (what was promised, by when, by whom). Putting the
 * second one behind the first would bury the half people actually chase.
 *
 * The sessions tab splits at *now* rather than listing everything flat. A
 * repository accumulates — after a month the useful part is the next meeting,
 * not the fortieth past one — so «پیش رو» leads and «برگزارشده» follows in
 * reverse, newest first, which is the order an archive is read in.
 */
export function MeetingRepoPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('sessions');
  const [guideOpen, setGuideOpen] = useState(false);
  // One filter per tab, kept apart: they filter different things by different
  // vocabularies, and switching tabs shouldn't silently hide rows because of a
  // choice made about the other one.
  const [sessionFilter, setSessionFilter] = useState<SessionStatus | 'all'>('all');
  const [decisionFilter, setDecisionFilter] = useState<DecisionStatus | 'all'>('all');
  const sessions = useSessions();
  const decisions = useDecisions();

  const visibleSessions = useMemo(
    () => (sessions.data ?? []).filter((session) => sessionFilter === 'all' || session.status === sessionFilter),
    [sessions.data, sessionFilter],
  );
  const { upcoming, past } = useMemo(() => splitByTime(visibleSessions), [visibleSessions]);
  const visibleDecisions = useMemo(
    () => (decisions.data ?? []).filter((decision) => decisionFilter === 'all' || decision.status === decisionFilter),
    [decisions.data, decisionFilter],
  );

  const isLoading = tab === 'sessions' ? sessions.isLoading : decisions.isLoading;
  const isError = tab === 'sessions' ? sessions.isError : decisions.isError;
  // "Nothing at all" and "nothing in this filter" are different states and get
  // different words — the second one is a choice the reader can undo.
  const filtered = tab === 'sessions' ? sessionFilter !== 'all' : decisionFilter !== 'all';

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={() => navigate('/')} aria-label="بازگشت">
          <RightOutline />
        </button>
        <h1 className={styles.headerTitle}>مخزن جلسه</h1>
        {/* Same place and same shape as the projects guide: this is the front
            door of a module whose rules (invites, fixed members, what can't be
            edited) aren't guessable from the screen. */}
        <button
          type="button"
          className={styles.guideButton}
          onClick={() => setGuideOpen(true)}
          aria-label="راهنمای مخزن جلسه"
        >
          <QuestionCircleOutline />
        </button>
      </header>

      <div className={styles.tabs} role="tablist">
        <TabButton
          active={tab === 'sessions'}
          onClick={() => setTab('sessions')}
          icon={<TeamOutline />}
          label="جلسات"
          count={sessions.data?.length}
        />
        <TabButton
          active={tab === 'decisions'}
          onClick={() => setTab('decisions')}
          icon={<FileOutline />}
          label="مصوبات"
          count={decisions.data?.length}
        />
      </div>

      {/* Under the tabs, above the list — the row reads as "which of these", so
          it belongs to the list it filters rather than to the page. */}
      {!isLoading && !isError && (
        <div className={styles.filters} role="tablist" aria-label="فیلتر وضعیت">
          {tab === 'sessions'
            ? SESSION_FILTERS.map((option) => (
                <FilterChip
                  key={option.key}
                  label={option.label}
                  active={sessionFilter === option.key}
                  onClick={() => setSessionFilter(option.key)}
                />
              ))
            : DECISION_FILTERS.map((option) => (
                <FilterChip
                  key={option.key}
                  label={option.label}
                  active={decisionFilter === option.key}
                  onClick={() => setDecisionFilter(option.key)}
                />
              ))}
        </div>
      )}

      <div className={styles.body}>
        {isLoading && <EmptyState icon={<DotLoading />} title="در حال بارگذاری…" />}

        {!isLoading && isError && (
          <EmptyState
            icon={<ExclamationCircleOutline />}
            title="ارتباط برقرار نشد"
            description="بارگذاری اطلاعات با خطا مواجه شد. دوباره تلاش کنید."
          />
        )}

        {!isLoading && !isError && tab === 'sessions' && (
          <SessionsTab upcoming={upcoming} past={past} filtered={filtered} onOpen={(id) => navigate(`/sessions/${id}`)} />
        )}

        {!isLoading && !isError && tab === 'decisions' && (
          <DecisionsTab
            decisions={visibleDecisions}
            filtered={filtered}
            onOpenSession={(id) => navigate(`/sessions/${id}`)}
          />
        )}
      </div>

      <div className={styles.footer}>
        <Button block color="primary" size="large" onClick={() => navigate('/sessions/new')}>
          <AddOutline /> جلسه جدید
        </Button>
      </div>

      {guideOpen && <MeetingGuideSheet visible={guideOpen} onClose={() => setGuideOpen(false)} />}
    </div>
  );
}

/**
 * «همه» first, then the statuses in their natural order — the same lists the
 * session screen and the مصوبات rows use, so nothing here can drift out of sync
 * with what a status actually means.
 */
const SESSION_FILTERS: { key: SessionStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'همه' },
  ...SESSION_STATUSES.map((status) => ({ key: status, label: SESSION_STATUS_LABEL[status] })),
];

const DECISION_FILTERS: { key: DecisionStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'همه' },
  ...DECISION_STATUSES.map((status) => ({ key: status, label: DECISION_STATUS_LABEL[status] })),
];

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`${styles.filter} ${active ? styles.filterActive : ''}`}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
  count: number | undefined;
}

function TabButton({ active, onClick, icon, label, count }: TabButtonProps) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`${styles.tab} ${active ? styles.tabActive : ''}`}
      onClick={onClick}
    >
      <span className={styles.tabIcon} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.tabLabel}>{label}</span>
      {/* Zero is shown, not hidden: «مصوبات ۰» is information — it says the tab
          was loaded and is genuinely empty, rather than not loaded yet. */}
      {count !== undefined && <span className={styles.tabCount}>{toPersianDigits(count)}</span>}
    </button>
  );
}

/**
 * Sessions before and after now. The boundary is the session's own start time,
 * not its status: a meeting nobody remembered to mark «برگزار شده» has still
 * happened, and leaving it at the top of «پیش رو» forever would be a lie the
 * status field can't fix on its own.
 */
function splitByTime(sessions: Session[]): { upcoming: Session[]; past: Session[] } {
  const now = Date.now();
  const upcoming: Session[] = [];
  const past: Session[] = [];

  for (const session of sessions) {
    if (new Date(session.startsAt).getTime() >= now) upcoming.push(session);
    else past.push(session);
  }

  // The API returns them ascending; the archive reads newest-first.
  past.reverse();
  return { upcoming, past };
}

function SessionsTab({
  upcoming,
  past,
  filtered,
  onOpen,
}: {
  upcoming: Session[];
  past: Session[];
  /** Whether a status filter is narrowing the list — changes what empty means. */
  filtered: boolean;
  onOpen: (id: string) => void;
}) {
  if (upcoming.length === 0 && past.length === 0) {
    return filtered ? (
      <EmptyState icon={<TeamOutline />} title="جلسه‌ای با این وضعیت نیست" description="فیلتر را روی «همه» بگذارید." />
    ) : (
      <EmptyState
        icon={<TeamOutline />}
        title="هنوز جلسه‌ای ثبت نشده"
        description="جلسه بسازید تا زمان و نشانی‌اش برای شرکت‌کنندگان فرستاده شود و مصوبه‌هایش همین‌جا بماند."
      />
    );
  }

  return (
    <div className={styles.sections}>
      {upcoming.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>پیش رو</h2>
          <div className={styles.list}>
            {upcoming.map((session) => (
              <SessionCard key={session.id} session={session} onOpen={onOpen} />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>برگزارشده</h2>
          <div className={styles.list}>
            {past.map((session) => (
              <SessionCard key={session.id} session={session} onOpen={onOpen} past />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SessionCard({ session, onOpen, past }: { session: Session; onOpen: (id: string) => void; past?: boolean }) {
  const startsAt = new Date(session.startsAt);

  return (
    <button
      type="button"
      className={`${styles.card} ${past ? styles.cardPast : ''}`}
      onClick={() => onOpen(session.id)}
    >
      {/* The day, as a block — the one thing you scan a meeting list for. */}
      <span className={styles.when} aria-hidden="true">
        <span className={styles.whenDate}>{formatShortDate(startsAt)}</span>
        <span className={styles.whenTime}>{formatTime(startsAt)}</span>
      </span>

      <span className={styles.cardBody}>
        <span className={styles.cardTitle}>{session.title}</span>
        <span className={styles.cardMeta}>
          <span className={styles.metaItem}>
            <EnvironmentOutline aria-hidden="true" />
            {session.isOnline ? 'آنلاین' : 'حضوری'}
          </span>
          <span className={styles.metaItem}>
            <TeamOutline aria-hidden="true" />
            {toPersianDigits(session.memberCount)} نفر
          </span>
          {session.projectName && <span className={styles.metaItem}>{session.projectName}</span>}
        </span>
      </span>

      {/* notStarted has no tone of its own — the chip's neutral default already
          says "nothing has happened to this yet", so only the three states that
          mean something get a colour. Hence the ?? ''. */}
      <span className={`${styles.statusChip} ${styles[`status_${session.status}`] ?? ''}`}>
        {SESSION_STATUS_LABEL[session.status]}
      </span>
    </button>
  );
}

function DecisionsTab({
  decisions,
  filtered,
  onOpenSession,
}: {
  decisions: Decision[];
  filtered: boolean;
  onOpenSession: (id: string) => void;
}) {
  // One mutation for the whole tab: which decision it targets travels in the
  // payload, so toggling a row doesn't need a hook per row.
  const updateStatus = useUpdateDecisionStatus();
  const me = useMe();

  /**
   * «انجام شد» belongs to the person who owes the commitment and to the person
   * who wrote it down — the same rule the session screen and the API apply.
   * Everyone else in the room reads the row; ticking someone else's box would be
   * a claim about their work.
   *
   * With no identity to compare (the /me lookup is allowed to fail), the box
   * stays live and the API answers.
   */
  function canMark(decision: Decision) {
    if (!me.data) return true;
    return decision.ownerRefId === me.data.id || decision.assigneeId === me.data.id;
  }

  if (decisions.length === 0) {
    return filtered ? (
      <EmptyState icon={<FileOutline />} title="مصوبه‌ای با این وضعیت نیست" description="فیلتر را روی «همه» بگذارید." />
    ) : (
      <EmptyState
        icon={<FileOutline />}
        title="هنوز مصوبه‌ای ثبت نشده"
        description="مصوبه‌ها داخل هر جلسه ثبت می‌شوند و اینجا کنار هم دیده می‌شوند."
      />
    );
  }

  const now = Date.now();

  return (
    <div className={styles.list}>
      {decisions.map((decision) => {
        const dueAt = new Date(decision.dueAt);
        // Only an open one can be late; a decision that was done or dropped has
        // no deadline left to miss.
        const overdue = decision.status === 'open' && dueAt.getTime() < now;

        return (
          <div key={decision.id} className={styles.decision}>
            <button
              type="button"
              className={`${styles.check} ${decision.status === 'done' ? styles.checkDone : ''}`}
              aria-label={decision.status === 'done' ? 'بازگرداندن به در انتظار اجرا' : 'انجام شد'}
              disabled={updateStatus.isPending || !canMark(decision)}
              onClick={() =>
                updateStatus.mutate({
                  decisionId: decision.id,
                  status: decision.status === 'done' ? 'open' : 'done',
                })
              }
            >
              <CheckCircleOutline />
            </button>

            <div className={styles.decisionBody}>
              <div className={`${styles.decisionTitle} ${decision.status !== 'open' ? styles.decisionClosed : ''}`}>
                {decision.title}
              </div>
              <div className={styles.cardMeta}>
                <span className={`${styles.metaItem} ${overdue ? styles.overdue : ''}`}>
                  <ClockCircleOutline aria-hidden="true" />
                  {formatShortDate(dueAt)}
                </span>
                {decision.assigneeName && <span className={styles.metaItem}>{decision.assigneeName}</span>}
                {decision.sessionId && decision.sessionTitle && (
                  <button
                    type="button"
                    className={styles.sessionLink}
                    onClick={() => onOpenSession(decision.sessionId!)}
                  >
                    {decision.sessionTitle}
                  </button>
                )}
              </div>
            </div>

            {decision.status !== 'open' && (
              <span className={`${styles.statusChip} ${styles[`decision_${decision.status}`] ?? ''}`}>
                {DECISION_STATUS_LABEL[decision.status]}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
