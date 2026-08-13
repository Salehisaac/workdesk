import { Button, DotLoading, Input, Popover, Popup, TextArea, Toast } from 'antd-mobile';
import {
  AddOutline,
  CalendarOutline,
  CheckCircleOutline,
  ClockCircleOutline,
  DownOutline,
  EnvironmentOutline,
  ExclamationCircleOutline,
  LinkOutline,
  RightOutline,
  TeamOutline,
  UnorderedListOutline,
  UserAddOutline,
} from 'antd-mobile-icons';
import type { CSSProperties } from 'react';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { bridge } from '../../../bridge';
import { monogramGradient, monogramInitial, paletteForSeed } from '../../../shared/brand/monogram';
import { formatLongDate, formatShortDate, formatTime, toLocalIso, toPersianDigits } from '../../../shared/date/jalali';
import { DateTimeSheet } from '../../../shared/ui/datetime/DateTimeSheet';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { DurationSheet, formatDuration } from '../../../shared/ui/time/DurationSheet';
import { useAgendaCalendar } from '../../agenda/api';
import {
  useCreateAgenda,
  useCreateDecision,
  useSession,
  useUpdateDecisionStatus,
  useUpdateSessionStatus,
} from '../api';
import { DECISION_STATUS_LABEL, SESSION_STATUSES, SESSION_STATUS_LABEL } from '../types';
import type { SessionAgenda, SessionMember, SessionStatus } from '../types';
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
 * actually reached), the running order, and the resolutions. The last two are
 * both written here rather than anywhere else, and they are the module's two
 * halves: «دستورات جلسه» is what the room means to get through, «مصوبات» is what
 * it committed to afterwards. The repository's مصوبات tab is the read-across
 * view of the second; the first is never read outside its own meeting.
 */
export function SessionDetailPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { data: session, isLoading, isError } = useSession(sessionId);
  const updateStatus = useUpdateSessionStatus(sessionId ?? '');
  const updateDecision = useUpdateDecisionStatus(sessionId);
  const [agendaOpen, setAgendaOpen] = useState(false);
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
  const agendas = session.agendas ?? [];

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
              {session.isOnline ? 'آنلاین' : 'حضوری'}
            </div>

            {/* The link is a row of its own, not a word inside the one above:
                for an online meeting it is the thing you came to this screen
                to press. Handed to the client rather than followed in place —
                a mini app that navigates away from itself doesn't come back. */}
            {session.isOnline && session.url && (
              <button
                type="button"
                className={styles.linkButton}
                onClick={() => {
                  if (!bridge.openLink(session.url!)) {
                    Toast.show({ content: 'نشانی باز نشد؛ آن را دستی کپی کنید.' });
                  }
                }}
              >
                <LinkOutline aria-hidden="true" />
                <span className={styles.linkText} dir="ltr">
                  {session.url}
                </span>
              </button>
            )}
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
            <h2 className={styles.sectionTitle}>
              <UnorderedListOutline aria-hidden="true" /> دستورات جلسه
            </h2>
            <button type="button" className={styles.addButton} onClick={() => setAgendaOpen(true)}>
              <AddOutline /> افزودن
            </button>
          </div>

          {agendas.length === 0 ? (
            <p className={styles.emptyLine}>هنوز دستور جلسه‌ای ثبت نشده.</p>
          ) : (
            <div className={styles.agendas}>
              {agendas.map((agenda, index) => (
                <AgendaCard key={agenda.id} agenda={agenda} index={index} />
              ))}
            </div>
          )}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>مصوبات</h2>
            <button type="button" className={styles.addButton} onClick={() => setDecisionOpen(true)}>
              <AddOutline /> افزودن
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
                      {decision.description && <p className={styles.itemDescription}>{decision.description}</p>}
                      <div className={styles.decisionMeta}>
                        <span className={overdue ? styles.overdue : undefined}>
                          سررسید: {formatShortDate(dueAt)} ساعت {formatTime(dueAt)}
                        </span>
                        {decision.assigneeName && <span>{decision.assigneeName}</span>}
                        {decision.status !== 'open' && <span>{DECISION_STATUS_LABEL[decision.status]}</span>}
                      </div>
                      {/* Which item of the running order produced it — the pair
                          the whole session screen exists to hold together. */}
                      {decision.agendaTitle && (
                        <div className={styles.decisionAgenda}>دستور جلسه: {decision.agendaTitle}</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <AgendaSheet
        visible={agendaOpen}
        sessionId={session.id}
        members={session.members}
        onClose={() => setAgendaOpen(false)}
      />

      <DecisionSheet
        visible={decisionOpen}
        sessionId={session.id}
        members={session.members}
        agendas={agendas}
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

/** One line of the running order, numbered — an agenda is read in sequence. */
function AgendaCard({ agenda, index }: { agenda: SessionAgenda; index: number }) {
  const duration = formatDuration(agenda.durationMinutes);

  return (
    <div className={styles.agenda}>
      <span className={styles.agendaIndex} aria-hidden="true">
        {toPersianDigits(index + 1)}
      </span>

      <div className={styles.agendaBody}>
        <div className={styles.agendaTitle}>{agenda.title}</div>
        {agenda.description && <p className={styles.itemDescription}>{agenda.description}</p>}
        {(duration || agenda.assigneeName) && (
          <div className={styles.decisionMeta}>
            {duration && (
              <span className={styles.agendaDuration}>
                <ClockCircleOutline aria-hidden="true" /> {duration}
              </span>
            )}
            {agenda.assigneeName && <span>{agenda.assigneeName}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Picking the «مسئول اجرایی» — the one member who is to carry an item.
 *
 * Shared by both sheets because both ask the same question of the same list.
 * "Nobody in particular" leads and is the default: a slot on the agenda the
 * whole room works through, or a resolution it owns collectively, shouldn't have
 * to be pinned on someone before it can be written down.
 */
function AssigneePicker({
  members,
  value,
  onChange,
}: {
  members: SessionMember[];
  value: string | null;
  onChange: (assigneeId: string | null) => void;
}) {
  return (
    <div className={styles.assignees}>
      <span className={styles.sheetRowLabel}>
        <UserAddOutline aria-hidden="true" /> مسئول اجرایی
      </span>
      <div className={styles.assigneeRail}>
        <button
          type="button"
          className={`${styles.assignee} ${value === null ? styles.assigneeActive : ''}`}
          onClick={() => onChange(null)}
        >
          همه
        </button>
        {members.map((member) => (
          <button
            key={`${member.source}-${member.id}`}
            type="button"
            className={`${styles.assignee} ${value === member.id ? styles.assigneeActive : ''}`}
            onClick={() => onChange(member.id)}
          >
            {member.displayName}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Adding to the running order — «دستور جلسه».
 *
 * A sheet rather than a route, like the مصوبه one: four fields that belong to
 * the meeting on screen behind it. What it asks for that the other doesn't is
 * «مدت زمان» — an agenda item is a slice of the meeting's own time, and adding
 * up what the room has scheduled is the only way anyone finds out beforehand
 * that two hours of items were put into a one-hour meeting.
 */
function AgendaSheet({
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
  const createAgenda = useCreateAgenda(sessionId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState<number | null>(null);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [durationOpen, setDurationOpen] = useState(false);

  function reset() {
    setTitle('');
    setDescription('');
    setDurationMinutes(null);
    setAssigneeId(null);
  }

  async function handleSubmit() {
    if (createAgenda.isPending) return;
    if (!title.trim()) {
      Toast.show({ content: 'عنوان دستور جلسه را وارد کنید' });
      return;
    }

    try {
      await createAgenda.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        durationMinutes: durationMinutes ?? undefined,
        assigneeId: assigneeId ?? undefined,
      });
      reset();
      onClose();
    } catch (error) {
      Toast.show({ content: error instanceof Error ? error.message : 'ثبت دستور جلسه با خطا مواجه شد' });
    }
  }

  // The duration wheel is a sibling of the sheet, never a child of it: a popup
  // mounted inside another popup's animated body is positioned against that
  // body instead of the viewport. See DateTimeSheet's getContainer note.
  return (
    <>
      <Popup visible={visible} onMaskClick={onClose} bodyClassName={styles.sheet} destroyOnClose>
        <div className={styles.sheetBody}>
          <h2 className={styles.sheetTitle}>دستور جلسه‌ی تازه</h2>

          <Input className={styles.sheetInput} placeholder="عنوان" value={title} onChange={setTitle} />

          <TextArea
            className={styles.sheetInput}
            placeholder="شرح (اختیاری)"
            value={description}
            onChange={setDescription}
            autoSize={{ minRows: 1, maxRows: 5 }}
          />

          <button type="button" className={styles.sheetRow} onClick={() => setDurationOpen(true)}>
            <span className={styles.sheetRowLabel}>
              <ClockCircleOutline aria-hidden="true" /> مدت زمان
            </span>
            <span className={styles.sheetRowValue}>{formatDuration(durationMinutes) ?? 'انتخاب کنید (اختیاری)'}</span>
          </button>

          <AssigneePicker members={members} value={assigneeId} onChange={setAssigneeId} />

          <Button block color="primary" size="large" loading={createAgenda.isPending} onClick={handleSubmit}>
            ثبت دستور جلسه
          </Button>
        </div>
      </Popup>

      <DurationSheet
        visible={durationOpen}
        value={durationMinutes}
        onClose={() => setDurationOpen(false)}
        onConfirm={(minutes) => {
          // Zero is how the wheel says "no duration after all" — stored as null
          // rather than a nought, which would render as «۰ دقیقه».
          setDurationMinutes(minutes > 0 ? minutes : null);
          setDurationOpen(false);
        }}
      />
    </>
  );
}

/**
 * Recording a resolution — a sheet, not a route, because it belongs to the
 * meeting on screen behind it.
 *
 * «سررسید» is the field that makes it a مصوبه rather than a note: it is picked
 * on the same Jalali calendar the rest of the app uses, and it is what puts the
 * resolution on the home dashboard on its day. The optional «دستور جلسه» above
 * it links the commitment back to whichever item of the running order produced
 * it — offered only when the meeting has a running order to point at.
 */
function DecisionSheet({
  visible,
  sessionId,
  members,
  agendas,
  onClose,
}: {
  visible: boolean;
  sessionId: string;
  members: SessionMember[];
  agendas: SessionAgenda[];
  onClose: () => void;
}) {
  const createDecision = useCreateDecision(sessionId);
  const { markers, dayCounts } = useAgendaCalendar();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [agendaId, setAgendaId] = useState<string | null>(null);
  const [dueAt, setDueAt] = useState<Date | null>(null);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [agendaMenuOpen, setAgendaMenuOpen] = useState(false);

  const selectedAgenda = agendas.find((agenda) => agenda.id === agendaId);

  function reset() {
    setTitle('');
    setDescription('');
    setAgendaId(null);
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
      Toast.show({ content: 'سررسید مصوبه را انتخاب کنید' });
      return;
    }

    try {
      await createDecision.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        dueAt: toLocalIso(dueAt),
        agendaId: agendaId ?? undefined,
        assigneeId: assigneeId ?? undefined,
      });
      reset();
      onClose();
    } catch (error) {
      Toast.show({ content: error instanceof Error ? error.message : 'ثبت مصوبه با خطا مواجه شد' });
    }
  }

  // Calendar outside the sheet, for the reason AgendaSheet spells out.
  return (
    <>
      <Popup visible={visible} onMaskClick={onClose} bodyClassName={styles.sheet} destroyOnClose>
        <div className={styles.sheetBody}>
          <h2 className={styles.sheetTitle}>مصوبه‌ی تازه</h2>

          <Input className={styles.sheetInput} placeholder="عنوان" value={title} onChange={setTitle} />

          <TextArea
            className={styles.sheetInput}
            placeholder="شرح (اختیاری)"
            value={description}
            onChange={setDescription}
            autoSize={{ minRows: 1, maxRows: 5 }}
          />

          {agendas.length > 0 && (
            <Popover.Menu
              visible={agendaMenuOpen}
              onVisibleChange={setAgendaMenuOpen}
              trigger="click"
              // antd-mobile's placements are physical, not logical — "start" is
              // the left edge regardless of direction, which under dir="rtl"
              // would put the menu on the opposite side from its trigger.
              placement="bottom-end"
              actions={[
                { key: '', text: 'بدون دستور جلسه' },
                ...agendas.map((agenda) => ({ key: agenda.id, text: agenda.title })),
              ]}
              onAction={(action) => {
                setAgendaId(String(action.key) || null);
                setAgendaMenuOpen(false);
              }}
            >
              <button type="button" className={styles.sheetRow} aria-label="انتخاب دستور جلسه">
                <span className={styles.sheetRowLabel}>
                  <UnorderedListOutline aria-hidden="true" /> دستور جلسه
                </span>
                <span className={styles.sheetRowValue}>
                  {selectedAgenda?.title ?? 'انتخاب کنید (اختیاری)'}
                  <DownOutline className={styles.sheetRowChevron} />
                </span>
              </button>
            </Popover.Menu>
          )}

          <button type="button" className={styles.sheetRow} onClick={() => setDateOpen(true)}>
            <span className={styles.sheetRowLabel}>
              <CalendarOutline aria-hidden="true" /> سررسید
            </span>
            <span className={styles.sheetRowValue}>
              {dueAt ? `${formatShortDate(dueAt)} ساعت ${formatTime(dueAt)}` : 'انتخاب کنید'}
            </span>
          </button>

          <AssigneePicker members={members} value={assigneeId} onChange={setAssigneeId} />

          <Button block color="primary" size="large" loading={createDecision.isPending} onClick={handleSubmit}>
            ثبت مصوبه
          </Button>
        </div>
      </Popup>

      <DateTimeSheet
        visible={dateOpen}
        value={dueAt}
        title="سررسید مصوبه"
        markers={markers}
        dayCounts={dayCounts}
        onClose={() => setDateOpen(false)}
        onConfirm={(value) => {
          setDueAt(value);
          setDateOpen(false);
        }}
      />
    </>
  );
}
