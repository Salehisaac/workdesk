import { Popup } from 'antd-mobile';
import { AppstoreOutline, CalendarOutline, CheckOutline, CloseOutline } from 'antd-mobile-icons';
import { useEffect, useMemo, useState } from 'react';
import { formatLongDate, startOfDay, toDayKey, today as todayDate, toPersianDigits } from '../../date/jalali';
import { ExpandableJalaliCalendar } from '../calendar/ExpandableJalaliCalendar';
import { JalaliYearView } from '../calendar/JalaliYearView';
import type { CalendarMarker } from '../calendar/types';
import { ClockTimePicker } from '../time/ClockTimePicker';
import type { TimeValue } from '../time/ClockTimePicker';
import styles from './DateTimeSheet.module.css';

interface DateTimeSheetProps {
  visible: boolean;
  /** The moment being edited, or null when there isn't one yet. */
  value: Date | null;
  title: string;
  /** dayKey → indicator dots. Supplied by the caller (see useAgendaCalendar). */
  markers?: ReadonlyMap<string, readonly CalendarMarker[]>;
  /** dayKey → how many items that day already holds, for the footnote. */
  dayCounts?: ReadonlyMap<string, number>;
  onClose: () => void;
  onConfirm: (value: Date) => void;
}

/**
 * Picking a moment in two steps: the day on a calendar, then the time on a
 * clock. Shared by job deadlines and reminders — both want exactly this, and
 * the calendar it wraps is the same one the home dashboard uses (opened on the
 * month, since picking a date is the entire reason the sheet is on screen).
 */
export function DateTimeSheet({
  visible,
  value,
  title,
  markers,
  dayCounts,
  onClose,
  onConfirm,
}: DateTimeSheetProps) {
  const today = useMemo(() => todayDate(), []);
  const [day, setDay] = useState<Date>(value ?? today);
  const [showYear, setShowYear] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setDay(value ?? today);
    setShowYear(false);
    setTimeOpen(false);
  }, [visible, value, today]);

  const dayItemCount = dayCounts?.get(toDayKey(day)) ?? 0;

  function handleTimeConfirm(time: TimeValue) {
    // Built from the *local* calendar day plus the chosen time, never from a
    // UTC instant — so the result stays on the Jalali day that was tapped.
    const result = startOfDay(day);
    result.setHours(time.hour, time.minute, 0, 0);
    setTimeOpen(false);
    onConfirm(result);
  }

  return (
    <>
      <Popup
        // Step one hides while step two is up, rather than sitting behind the
        // dial: the calendar has done its job by then, and leaving it on screen
        // is what made confirming a day look like nothing had happened.
        visible={visible && !timeOpen}
        position="bottom"
        closeOnSwipe
        closeOnMaskClick
        onClose={onClose}
        onMaskClick={onClose}
        bodyStyle={{ borderTopLeftRadius: 12, borderTopRightRadius: 12 }}
        // antd-mobile renders popups *inline* by default (getContainer: null).
        // Mounted inside another sheet — which antd-mobile animates with a
        // transform — an inline popup stops being fixed to the viewport and
        // becomes fixed to that sheet instead, so it lands behind it. Portaling
        // to the body makes this work wherever it is mounted.
        getContainer={() => document.body}
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

            <span className={styles.headTitle}>{showYear ? title : formatLongDate(day)}</span>

            {/* Whole-year view, for a date outside the month on screen. */}
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

      {/* Step two: the clock dial. Its keyboard-entry mode is what keeps this
          reachable without pointing at a circle. */}
      <ClockTimePicker
        visible={timeOpen}
        value={{ hour: day.getHours(), minute: day.getMinutes() }}
        onCancel={() => setTimeOpen(false)}
        onConfirm={handleTimeConfirm}
      />
    </>
  );
}
