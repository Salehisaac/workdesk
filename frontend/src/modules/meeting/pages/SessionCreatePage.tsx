import { Button, Dialog, DotLoading, Input, Switch, Toast } from 'antd-mobile';
import {
  ClockCircleOutline,
  EnvironmentOutline,
  InformationCircleOutline,
  RightOutline,
} from 'antd-mobile-icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PickedItem } from '../../../bridge/types';
import { meDisplayName, useMe } from '../../../shared/api/me';
import { formatShortDate, formatTime, toLocalIso, toPersianDigits } from '../../../shared/date/jalali';
import { DateTimeSheet } from '../../../shared/ui/datetime/DateTimeSheet';
import { PeoplePicker } from '../../../shared/ui/people/PeoplePicker';
import { useAgendaCalendar } from '../../agenda/api';
import { useCreateSession } from '../api';
import type { CreateSessionInput } from '../types';
import styles from './SessionCreatePage.module.css';

/**
 * Creating a session — one screen, the same shape as ProjectCreatePage.
 *
 * The two flows are deliberately twins: an identity (here a title, since a
 * meeting has no chat list entry to wear a picture in), the people, one primary
 * button that says what it does. The single difference is what submitting does,
 * and it's the difference that defines the module — a project provisions a
 * Rasagram group and the group *is* how everyone finds out; a session provisions
 * nothing, so the backend messages each person a link that opens the mini app on
 * this meeting.
 *
 * That's also why this screen is honest about delivery afterwards instead of
 * showing a flat "done": the bot can only DM someone who has already started it,
 * so an invite legitimately fails for a member who never has, and the toast says
 * how many were reached rather than implying all of them were.
 */
export function SessionCreatePage() {
  const navigate = useNavigate();
  const me = useMe();
  const createSession = useCreateSession();
  const { markers, dayCounts } = useAgendaCalendar();

  const [title, setTitle] = useState('');
  // Now, seeded once on mount. A meeting is most often being written down as it
  // is about to happen — or while it already is — so the empty state that made
  // everyone pick today's date by hand was answering a question nobody had. It
  // stays fully editable; tapping the chip reopens the calendar.
  const [startsAt, setStartsAt] = useState<Date>(() => new Date());
  const [isOnline, setIsOnline] = useState(false);
  const [location, setLocation] = useState('');
  const [members, setMembers] = useState<PickedItem[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (submitting) return;

    const trimmed = title.trim();
    if (!trimmed) {
      Toast.show({ content: 'عنوان جلسه را وارد کنید' });
      return;
    }

    // A meeting with nobody in it is a note to self, and the module's whole
    // point is the invite. Asked once rather than refused — a placeholder for a
    // meeting whose attendees aren't settled yet is a legitimate thing to want.
    if (members.length === 0) {
      const confirmed = await Dialog.confirm({
        title: 'بدون شرکت‌کننده ساخته شود؟',
        content: 'دعوت‌نامه‌ای فرستاده نمی‌شود و جلسه فقط برای خودتان ثبت می‌شود.',
        confirmText: 'بساز',
        cancelText: 'افزودن شرکت‌کننده',
      });
      if (!confirmed) return;
    }

    setSubmitting(true);
    try {
      const input: CreateSessionInput = {
        title: trimmed,
        // Offset-carrying, not toISOString(): the invite message renders the
        // Persian wall clock and needs the user's own, not the server's.
        startsAt: toLocalIso(startsAt),
        isOnline,
        location: isOnline ? undefined : location.trim() || undefined,
        members,
      };
      const session = await createSession.mutateAsync(input);

      // members[] comes back stamped with who the bot actually reached — the
      // owner is in there too and was never messaged, so they're excluded from
      // the count rather than inflating it.
      const invited = session.members.filter((member) => member.role !== 'owner');
      const notified = invited.filter((member) => member.notifiedAt).length;
      Toast.show({
        content:
          invited.length === 0
            ? 'جلسه ثبت شد'
            : notified === invited.length
              ? `جلسه ثبت شد و دعوت‌نامه برای ${toPersianDigits(notified)} نفر فرستاده شد`
              : `جلسه ثبت شد؛ دعوت‌نامه برای ${toPersianDigits(notified)} نفر از ${toPersianDigits(invited.length)} نفر فرستاده شد`,
      });
      navigate(`/sessions/${session.id}`, { replace: true });
    } catch (error) {
      Toast.show({ content: error instanceof Error ? error.message : 'ساخت جلسه با خطا مواجه شد' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={() => navigate(-1)} aria-label="بازگشت">
          <RightOutline />
        </button>
        <h1 className={styles.headerTitle}>جلسه‌ی تازه</h1>
        <span className={styles.headerSpacer} aria-hidden="true" />
      </header>

      <div className={styles.body}>
        <section className={styles.card}>
          <Input
            className={styles.titleInput}
            placeholder="موضوع جلسه"
            value={title}
            onChange={setTitle}
            maxLength={120}
          />
        </section>

        <section className={styles.card}>
          <div className={styles.row}>
            <span className={styles.rowIcon} aria-hidden="true">
              <ClockCircleOutline />
            </span>
            <span className={styles.rowLabel}>زمان برگزاری</span>
            <div className={styles.rowValue}>
              {/* The chip is the control, not a removable token: a session
                  always has a time, so there is nothing to clear — only
                  another time to pick. */}
              <button
                type="button"
                className={styles.whenChip}
                onClick={() => setSheetOpen(true)}
                aria-label="تغییر زمان جلسه"
              >
                {formatShortDate(startsAt)}
                <span className={styles.whenTime}>{formatTime(startsAt)}</span>
              </button>
            </div>
          </div>

          <div className={styles.row}>
            <span className={styles.rowIcon} aria-hidden="true">
              <EnvironmentOutline />
            </span>
            <span className={styles.rowLabel}>جلسه آنلاین است</span>
            <div className={styles.rowValue}>
              <Switch checked={isOnline} onChange={setIsOnline} />
            </div>
          </div>

          {/* Online is its own kind of location, so the room field goes away
              rather than sitting there greyed out asking to be filled in. */}
          {!isOnline && (
            <div className={styles.row}>
              <span className={styles.rowIcon} aria-hidden="true" />
              <Input className={styles.locationInput} placeholder="مکان جلسه (اختیاری)" value={location} onChange={setLocation} />
            </div>
          )}
        </section>

        <PeoplePicker
          members={members}
          ownerName={meDisplayName(me.data)}
          onChange={setMembers}
          title="شرکت‌کنندگان"
          ownerRoleLabel="برگزارکننده"
          hint="شرکت‌کنندگان فقط همین حالا انتخاب می‌شوند؛ پس از ساخت جلسه، کسی به آن اضافه نمی‌شود."
        />

        <p className={styles.note}>
          <InformationCircleOutline className={styles.noteIcon} aria-hidden="true" />
          برخلاف پروژه، برای جلسه گروهی ساخته نمی‌شود. به‌جایش برای هر شرکت‌کننده پیامی با نشانی جلسه فرستاده می‌شود که با
          زدنش همین صفحه‌ی جلسه باز می‌شود.
        </p>
      </div>

      <div className={styles.footer}>
        <Button block color="primary" size="large" loading={submitting} onClick={handleSubmit}>
          ساخت جلسه
        </Button>
      </div>

      <DateTimeSheet
        visible={sheetOpen}
        value={startsAt}
        title="زمان جلسه"
        markers={markers}
        dayCounts={dayCounts}
        onClose={() => setSheetOpen(false)}
        onConfirm={(value) => {
          setStartsAt(value);
          setSheetOpen(false);
        }}
      />

      {/* One message per member, each a round trip to the Bot API — honest about
          taking a moment, the same way project creation is about provisioning
          its group. */}
      {submitting && (
        <div className={styles.creating} role="status" aria-live="polite">
          <div className={styles.creatingCard}>
            <DotLoading color="primary" />
            <div className={styles.creatingTitle}>در حال ساخت جلسه…</div>
            <div className={styles.creatingBody}>دعوت‌نامه‌ها برای شرکت‌کنندگان فرستاده می‌شود.</div>
          </div>
        </div>
      )}
    </div>
  );
}
