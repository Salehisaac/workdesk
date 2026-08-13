import { Button, DotLoading, Input, Popup, Toast } from 'antd-mobile';
import {
  AddOutline,
  CheckCircleOutline,
  ClockCircleOutline,
  EnvironmentOutline,
  ExclamationCircleOutline,
  RightOutline,
  TeamOutline,
} from 'antd-mobile-icons';
import type { CSSProperties } from 'react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { monogramGradient, monogramInitial, paletteForSeed } from '../../../shared/brand/monogram';
import { formatLongDate, formatShortDate, formatTime, toLocalIso, toPersianDigits } from '../../../shared/date/jalali';
import { DateTimeSheet } from '../../../shared/ui/datetime/DateTimeSheet';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { useAgendaCalendar } from '../../agenda/api';
import { useCreateDecision, useSession, useUpdateDecisionStatus, useUpdateSessionStatus } from '../api';
import { DECISION_STATUS_LABEL, SESSION_STATUSES, SESSION_STATUS_LABEL } from '../types';
import type { SessionMember, SessionStatus } from '../types';
import styles from './SessionDetailPage.module.css';

/**
 * One meeting — and the screen the invite message opens.
 *
 * That second job is why this page exists at all rather than the list expanding
 * in place: the DM the backend sends every member carries a link that launches
 * the mini app with `startapp=session-<id>` (app/services/sessioninvite), and
 * that parameter has to land on a real route. See readStartParam in
 * app/router.tsx for the other half.
 *
 * What it shows, in order: when and where, who was invited (and who the invite
 * actually reached), and the resolutions. مصوبات are recorded here rather than
 * on the repository's مصوبات tab because a resolution only means anything
 * attached to the meeting that produced it — the tab is the read-across view.
 */
export function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { data: session, isLoading, isError } = useSession(sessionId);
  const updateStatus = useUpdateSessionStatus(sessionId ?? '');
  const updateDecision = useUpdateDecisionStatus(sessionId);
  const [decisionOpen, setDecisionOpen] = useState(false);

  if (isLoading) {
    return (
      <div className={styles.page}>
        <Header onBack={() => navigate('/sessions')} title="جلسه" />
        <EmptyState icon={<DotLoading />} title="در حال بارگذاری…" />
      </div>
    );
  }

  if (isError || !session) {
    return (
      <div className={styles.page}>
        <Header onBack={() => navigate('/sessions')} title="جلسه" />
        <EmptyState
          icon={<ExclamationCircleOutline />}
          title="جلسه پیدا نشد"
          description="ممکن است حذف شده باشد یا شما در آن نباشید."
          action={
            <Button color="primary" onClick={() => navigate('/sessions')}>
              بازگشت به مخزن جلسه
            </Button>
          }
        />
      </div>
    );
  }

  const startsAt = new Date(session.startsAt);
  const invited = session.members.filter((member) => member.role !== 'owner');
  const unreached = invited.filter((member) => !member.notifiedAt).length;

  return (
    <div className={styles.page}>
      <Header onBack={() => navigate('/sessions')} title="جلسه" />

      <div className={styles.body}>
        <section className={styles.hero}>
          <h1 className={styles.title}>{session.title}</h1>
          {session.projectName && <div className={styles.project}>در پروژه‌ی {session.projectName}</div>}

          <div className={styles.facts}>
            <div className={styles.fact}>
              <ClockCircleOutline aria-hidden="true" />
              {formatLongDate(startsAt)}، ساعت {formatTime(startsAt)}
            </div>
            <div className={styles.fact}>
              <EnvironmentOutline aria-hidden="true" />
              {session.isOnline ? 'آنلاین' : session.location || 'مکان مشخص نشده'}
            </div>
          </div>

          {/* The status row is a segmented control, not a sheet: there are four
              states and the whole point of opening a past meeting is to mark
              what happened to it. Burying that behind a tap would be perverse. */}
          <div className={styles.statuses} role="group" aria-label="وضعیت جلسه">
            {SESSION_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                className={`${styles.statusButton} ${session.status === status ? styles[`statusActive_${status}`] : ''}`}
                aria-pressed={session.status === status}
                disabled={updateStatus.isPending}
                onClick={() => {
                  if (session.status === status) return;
                  updateStatus.mutate(status as SessionStatus, {
                    onError: (error) =>
                      Toast.show({ content: error instanceof Error ? error.message : 'تغییر وضعیت انجام نشد' }),
                  });
                }}
              >
                {SESSION_STATUS_LABEL[status]}
              </button>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>
              <TeamOutline aria-hidden="true" /> شرکت‌کنندگان
            </h2>
            <span className={styles.sectionCount}>{toPersianDigits(session.members.length)} نفر</span>
          </div>

          <div className={styles.rail}>
            {session.members.map((member) => (
              <MemberChip key={`${member.source}-${member.id}`} member={member} />
            ))}
          </div>

          {/* Said plainly, because it is the one thing that silently doesn't
              work: the bot can't open a chat with someone who has never started
              it, so their invite goes nowhere and only this screen knows. */}
          {unreached > 0 && (
            <p className={styles.warn}>
              دعوت‌نامه برای {toPersianDigits(unreached)} نفر فرستاده نشد — کسی که هنوز گفتگویی با ربات شروع نکرده باشد،
              پیام دریافت نمی‌کند. نشانی جلسه را دستی برایشان بفرستید.
            </p>
          )}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>مصوبات</h2>
            <button type="button" className={styles.addDecision} onClick={() => setDecisionOpen(true)}>
              <AddOutline /> مصوبه‌ی تازه
            </button>
          </div>

          {session.decisions.length === 0 ? (
            <p className={styles.emptyLine}>هنوز مصوبه‌ای برای این جلسه ثبت نشده.</p>
          ) : (
            <div className={styles.decisions}>
              {session.decisions.map((decision) => {
                const dueAt = new Date(decision.dueAt);
                const overdue = decision.status === 'open' && dueAt.getTime() < Date.now();

                return (
                  <div key={decision.id} className={styles.decision}>
                    <button
                      type="button"
                      className={`${styles.check} ${decision.status === 'done' ? styles.checkDone : ''}`}
                      aria-label={decision.status === 'done' ? 'بازگرداندن به در انتظار اجرا' : 'انجام شد'}
                      disabled={updateDecision.isPending}
                      onClick={() =>
                        updateDecision.mutate({
                          decisionId: decision.id,
                          status: decision.status === 'done' ? 'open' : 'done',
                        })
                      }
                    >
                      <CheckCircleOutline />
                    </button>

                    <div className={styles.decisionBody}>
                      <div
                        className={`${styles.decisionTitle} ${decision.status !== 'open' ? styles.decisionClosed : ''}`}
                      >
                        {decision.title}
                      </div>
                      <div className={styles.decisionMeta}>
                        <span className={overdue ? styles.overdue : undefined}>{formatShortDate(dueAt)}</span>
                        {decision.assigneeName && <span>{decision.assigneeName}</span>}
                        {decision.status !== 'open' && <span>{DECISION_STATUS_LABEL[decision.status]}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <DecisionSheet
        visible={decisionOpen}
        sessionId={session.id}
        members={session.members}
        onClose={() => setDecisionOpen(false)}
      />
    </div>
  );
}

function Header({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <header className={styles.header}>
      <button type="button" className={styles.back} onClick={onBack} aria-label="بازگشت">
        <RightOutline />
      </button>
      <h1 className={styles.headerTitle}>{title}</h1>
      <span className={styles.headerSpacer} aria-hidden="true" />
    </header>
  );
}

function MemberChip({ member }: { member: SessionMember }) {
  const reached = member.role === 'owner' || !!member.notifiedAt;

  return (
    <div className={styles.chip}>
      <span
        className={styles.chipAvatar}
        style={{ background: monogramGradient(paletteForSeed(member.id)) } as CSSProperties}
        aria-hidden="true"
      >
        {monogramInitial(member.displayName) || '؟'}
      </span>
      <span className={styles.chipName}>{member.displayName}</span>
      <span className={styles.chipRole}>
        {member.role === 'owner' ? 'برگزارکننده' : reached ? 'دعوت شد' : 'دعوت‌نامه نرسید'}
      </span>
    </div>
  );
}

/**
 * Recording a resolution — a sheet, not a route, because it is three fields and
 * belongs to the meeting on screen behind it.
 */
function DecisionSheet({
  visible,
  sessionId,
  members,
  onClose,
}: {
  visible: boolean;
  sessionId: string;
  members: SessionMember[];
  onClose: () => void;
}) {
  const createDecision = useCreateDecision(sessionId);
  const { markers, dayCounts } = useAgendaCalendar();

  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState<Date | null>(null);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [dateOpen, setDateOpen] = useState(false);

  function reset() {
    setTitle('');
    setDueAt(null);
    setAssigneeId(null);
  }

  async function handleSubmit() {
    if (createDecision.isPending) return;
    if (!title.trim()) {
      Toast.show({ content: 'متن مصوبه را وارد کنید' });
      return;
    }
    if (!dueAt) {
      Toast.show({ content: 'مهلت انجام را انتخاب کنید' });
      return;
    }

    try {
      await createDecision.mutateAsync({
        title: title.trim(),
        dueAt: toLocalIso(dueAt),
        assigneeId: assigneeId ?? undefined,
      });
      reset();
      onClose();
    } catch (error) {
      Toast.show({ content: error instanceof Error ? error.message : 'ثبت مصوبه با خطا مواجه شد' });
    }
  }

  return (
    <Popup visible={visible} onMaskClick={onClose} bodyClassName={styles.sheet} destroyOnClose>
      <div className={styles.sheetBody}>
        <h2 className={styles.sheetTitle}>مصوبه‌ی تازه</h2>

        <Input className={styles.sheetInput} placeholder="چه چیزی مصوب شد؟" value={title} onChange={setTitle} />

        <button type="button" className={styles.sheetRow} onClick={() => setDateOpen(true)}>
          <span className={styles.sheetRowLabel}>مهلت انجام</span>
          <span className={styles.sheetRowValue}>{dueAt ? formatShortDate(dueAt) : 'انتخاب کنید'}</span>
        </button>

        <div className={styles.assignees}>
          <span className={styles.sheetRowLabel}>بر عهده‌ی</span>
          <div className={styles.assigneeRail}>
            {/* Nobody-in-particular is a real answer — a decision the whole room
                owns shouldn't have to be pinned on someone to be recorded. */}
            <button
              type="button"
              className={`${styles.assignee} ${assigneeId === null ? styles.assigneeActive : ''}`}
              onClick={() => setAssigneeId(null)}
            >
              همه
            </button>
            {members.map((member) => (
              <button
                key={`${member.source}-${member.id}`}
                type="button"
                className={`${styles.assignee} ${assigneeId === member.id ? styles.assigneeActive : ''}`}
                onClick={() => setAssigneeId(member.id)}
              >
                {member.displayName}
              </button>
            ))}
          </div>
        </div>

        <Button block color="primary" size="large" loading={createDecision.isPending} onClick={handleSubmit}>
          ثبت مصوبه
        </Button>
      </div>

      <DateTimeSheet
        visible={dateOpen}
        value={dueAt}
        title="مهلت مصوبه"
        markers={markers}
        dayCounts={dayCounts}
        onClose={() => setDateOpen(false)}
        onConfirm={(value) => {
          setDueAt(value);
          setDateOpen(false);
        }}
      />
    </Popup>
  );
}
