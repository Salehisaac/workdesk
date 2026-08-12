import { Picker, Popup } from 'antd-mobile';
import type { PickerValue } from 'antd-mobile/es/components/picker-view';
import { AppstoreOutline, CalendarOutline, CheckOutline, CloseOutline } from 'antd-mobile-icons';
import { useEffect, useMemo, useState } from 'react';
import { useAgenda } from '../../../agenda/api';
import { formatLongDate, startOfDay, toDayKey, today as todayDate, toPersianDigits } from '../../../../shared/date/jalali';
import { ExpandableJalaliCalendar } from '../../../../shared/ui/calendar/ExpandableJalaliCalendar';
import { JalaliYearView } from '../../../../shared/ui/calendar/JalaliYearView';
import styles from './JobSheets.module.css';

const HOURS = Array.from({ length: 24 }, (_, hour) => ({ label: toPersianDigits(String(hour).padStart(2, '0')), value: String(hour) }));
const MINUTES = Array.from({ length: 60 }, (_, minute) => ({
  label: toPersianDigits(String(minute).padStart(2, '0')),
  value: String(minute),
}));

interface JobDueDateSheetProps {
  visible: boolean;
  /** The deadline being edited, or null when the job has none yet. */
  value: Date | null;
  onClose: () => void;
  onConfirm: (value: Date) => void;
}

/**
 * Deadline picking in two steps, the way the reference does it: choose the day
 * on a calendar, then the time. The calendar is the same
 * ExpandableJalaliCalendar the home dashboard uses — opened on the month, since
 * picking a date is the entire reason this sheet exists — and it shows the same
 * agenda dots, so a deadline can be placed against what's already on that day.
 */
export function JobDueDateSheet({ visible, value, onClose, onConfirm }: JobDueDateSheetProps) {
  const today = useMemo(() => todayDate(), []);
  const [day, setDay] = useState<Date>(value ?? today);
  const [showYear, setShowYear] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);

  const agenda = useAgenda();
  const markers = useMemo(() => {
    const map = new Map<string, { id: string; color: string; label: string }[]>();
    for (const [dayKey, kinds] of agenda.kindsByDay) {
      map.set(dayKey, kinds.map((kind) => ({ id: kind, color: `var(--wd-kind-${kind})`, label: kind })));
    }
    return map;
  }, [agenda.kindsByDay]);

  useEffect(() => {
    if (!visible) return;
    setDay(value ?? today);
    setShowYear(false);
    setTimeOpen(false);
  }, [visible, value, today]);

  const dayItemCount = agenda.byDay.get(toDayKey(day))?.length ?? 0;

  function handleTimeConfirm(selected: PickerValue[]) {
    const [hour, minute] = selected;
    // Built from the *local* calendar day plus the chosen time, never from a
    // UTC instant — so the deadline stays on the Jalali day that was tapped.
    const result = startOfDay(day);
    result.setHours(Number(hour ?? 0), Number(minute ?? 0), 0, 0);
    setTimeOpen(false);
    onConfirm(result);
  }

  return (
    <>
      <Popup
        visible={visible}
        position="bottom"
        closeOnSwipe
        closeOnMaskClick
        onClose={onClose}
        onMaskClick={onClose}
        bodyStyle={{ borderTopLeftRadius: 12, borderTopRightRadius: 12 }}
      >
        <div className={styles.sheet}>
          <span className={styles.handle} aria-hidden="true" />

          {/* DOM order is right-to-left on screen: confirm and "today" lead,
              the year toggle and dismiss trail. */}
          <div className={styles.sheetHead}>
            <button
              type="button"
              className={styles.headConfirm}
              onClick={() => setTimeOpen(true)}
              aria-label="تأیید روز و انتخاب ساعت"
            >
              <CheckOutline />
            </button>
            <button type="button" className={styles.headTool} onClick={() => setDay(today)} aria-label="برو به امروز">
              <CalendarOutline />
            </button>

            <span className={styles.headTitle}>{showYear ? 'انتخاب روز' : formatLongDate(day)}</span>

            {/* Whole-year view, for a deadline outside the month on screen. */}
            <button
              type="button"
              className={`${styles.headTool} ${showYear ? styles.headToolActive : ''}`}
              onClick={() => setShowYear((prev) => !prev)}
              aria-pressed={showYear}
              aria-label={showYear ? 'نمایش ماه' : 'نمایش کل سال'}
            >
              <AppstoreOutline />
            </button>
            <button type="button" className={styles.headClose} onClick={onClose} aria-label="بستن">
              <CloseOutline />
            </button>
          </div>

          {showYear ? (
            <div className={styles.yearScroll}>
              <JalaliYearView
                year={day}
                selectedDate={day}
                today={today}
                onSelectDate={(selected) => {
                  setDay(selected);
                  setShowYear(false);
                }}
              />
            </div>
          ) : (
            <ExpandableJalaliCalendar selectedDate={day} onSelectDate={setDay} markers={markers} defaultExpanded />
          )}

          <p className={styles.dayNote}>
            {dayItemCount > 0
              ? `${toPersianDigits(dayItemCount)} مورد در این روز ثبت شده است.`
              : 'در این روز هیچ فعالیتی برای شما ثبت نشده است.'}
          </p>
        </div>
      </Popup>

      {/* Step two. antd-mobile's wheel picker rather than the reference's clock
          face: it's the control the rest of this app already uses, and it's
          reachable by keyboard and screen reader, which a clock dial is not. */}
      <Picker
        title="انتخاب زمان"
        columns={[HOURS, MINUTES]}
        visible={timeOpen}
        value={[String(day.getHours()), String(day.getMinutes())]}
        onClose={() => setTimeOpen(false)}
        onConfirm={handleTimeConfirm}
        confirmText="تأیید"
        cancelText="لغو"
      />
    </>
  );
}
