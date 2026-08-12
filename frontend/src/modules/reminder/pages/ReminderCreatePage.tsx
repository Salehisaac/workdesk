import { Input, TextArea, Toast } from 'antd-mobile';
import { AddOutline, CheckOutline, ClockCircleOutline, CloseOutline, RightOutline } from 'antd-mobile-icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAgendaCalendar } from '../../agenda/api';
import { formatShortDate, formatTime, toLocalIso } from '../../../shared/date/jalali';
import { DateTimeSheet } from '../../../shared/ui/datetime/DateTimeSheet';
import { useCreateReminder } from '../api';
import styles from './ReminderCreatePage.module.css';

export function ReminderCreatePage() {
  const navigate = useNavigate();
  const createReminder = useCreateReminder();
  const { markers, dayCounts } = useAgendaCalendar();

  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [remindAt, setRemindAt] = useState<Date | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  async function handleSubmit() {
    if (createReminder.isPending) return;
    if (!title.trim()) {
      Toast.show({ content: 'عنوان یادآور را وارد کنید' });
      return;
    }
    if (!remindAt) {
      Toast.show({ content: 'زمان یادآوری را انتخاب کنید' });
      return;
    }

    try {
      const created = await createReminder.mutateAsync({
        title: title.trim(),
        note: note.trim() || undefined,
        // Offset-carrying, not toISOString(): the backend writes the Persian
        // date into the chat message and needs the user's own wall clock.
        remindAt: toLocalIso(remindAt),
      });
      // notifiedAt is null when the bot couldn't reach the user's chat — saying
      // so beats a blanket success message the message never backed up.
      Toast.show({
        content: created.notifiedAt ? 'یادآور ثبت و به پیام‌های شما ارسال شد' : 'یادآور ثبت شد، اما ارسال پیام انجام نشد',
      });
      navigate('/reminders');
    } catch (error) {
      Toast.show({ content: error instanceof Error ? error.message : 'ثبت یادآور با خطا مواجه شد' });
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={() => navigate(-1)} aria-label="بازگشت">
          <RightOutline />
        </button>
        <h1 className={styles.headerTitle}>یادآور جدید</h1>
        <button
          type="button"
          className={styles.submit}
          onClick={handleSubmit}
          disabled={createReminder.isPending}
          aria-label="ثبت یادآور"
        >
          <CheckOutline />
        </button>
      </header>

      <div className={styles.form}>
        <div className={styles.field}>
          <Input className={styles.titleInput} placeholder="عنوان" value={title} onChange={setTitle} />
        </div>

        <div className={styles.field}>
          <TextArea
            className={styles.noteInput}
            placeholder="توضیح"
            value={note}
            onChange={setNote}
            autoSize={{ minRows: 1, maxRows: 6 }}
          />
        </div>

        <div className={styles.row}>
          <span className={styles.rowIcon}>
            <ClockCircleOutline />
          </span>
          <span className={styles.rowLabel}>زمان یادآوری</span>
          <div className={styles.rowValue}>
            {remindAt ? (
              <span className={styles.whenChip}>
                {formatShortDate(remindAt)}
                <span className={styles.whenTime}>{formatTime(remindAt)}</span>
                <button
                  type="button"
                  className={styles.chipRemove}
                  onClick={() => setRemindAt(null)}
                  aria-label="حذف زمان یادآوری"
                >
                  <CloseOutline />
                </button>
              </span>
            ) : (
              <button
                type="button"
                className={styles.rowAdd}
                onClick={() => setSheetOpen(true)}
                aria-label="تعیین زمان یادآوری"
              >
                <AddOutline />
              </button>
            )}
          </div>
        </div>

        <p className={styles.hint}>یادآور به پیام‌های خصوصی شما فرستاده می‌شود.</p>
      </div>

      <DateTimeSheet
        visible={sheetOpen}
        value={remindAt}
        title="انتخاب روز"
        markers={markers}
        dayCounts={dayCounts}
        onClose={() => setSheetOpen(false)}
        onConfirm={(value) => {
          setRemindAt(value);
          setSheetOpen(false);
        }}
      />
    </div>
  );
}
