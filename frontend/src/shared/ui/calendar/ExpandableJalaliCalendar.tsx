import { LeftOutline, RightOutline } from 'antd-mobile-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import {
  addDays,
  addMonths,
  buildMonthGrid,
  findWeekIndex,
  formatLongDate,
  formatMonthYear,
  isSameDay,
  isSameMonth,
  isWeekend,
  startOfMonth,
  toDayKey,
  today,
  WEEKDAY_LABELS_SHORT,
} from '../../date/jalali';
import { CalendarDay } from './CalendarDay';
import styles from './Calendar.module.css';
import type { CalendarMarker } from './types';

/** Must match --cal-row-height in Calendar.module.css — the geometry is computed in JS. */
const ROW_HEIGHT_PX = 50;
/** Below this a drag is still a tap, so tapping a day never nudges the calendar. */
const DRAG_THRESHOLD_PX = 6;
const WHEEL_THRESHOLD_PX = 48;
const WHEEL_IDLE_RESET_MS = 220;
/**
 * Share of the full travel a drag has to cover before releasing commits to the
 * other state. Snapping at the halfway mark reads as unresponsive: a month grid
 * is ~250px tall, so "half" is a 125px drag, and anything shorter springs back
 * even though the intent was obvious. A third of the way is decisive enough.
 */
const DRAG_COMMIT_RATIO = 0.3;

// RTL: the week runs right→left, so ArrowLeft moves *forward* in time. Getting
// this backwards is the classic RTL calendar bug.
const KEY_STEP: Record<string, number> = {
  ArrowLeft: 1,
  ArrowRight: -1,
  ArrowUp: -7,
  ArrowDown: 7,
};

const EMPTY_MARKERS: readonly CalendarMarker[] = [];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

interface ExpandableJalaliCalendarProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  /** dayKey (see toDayKey) → that day's indicator dots. */
  markers?: ReadonlyMap<string, readonly CalendarMarker[]>;
  /**
   * Which state to open in. The home dashboard starts on the week (the day's
   * content is the subject there); a date picker starts on the month, because
   * picking a date is the whole reason it's on screen.
   */
  defaultExpanded?: boolean;
}

/**
 * A Jalali calendar that lives between two states: one week tall, or the whole
 * month.
 *
 * Both states are the *same* DOM — the full month grid is always rendered, the
 * viewport just clips it to one row and slides the selected week into view.
 * That's what makes the transition continuous: expanding animates a height and
 * a translate, it doesn't swap one component for another. A single `progress`
 * value (0 = week, 1 = month) drives both, which is also what lets a drag
 * follow the finger 1:1 instead of only snapping at the end.
 */
export function ExpandableJalaliCalendar({
  selectedDate,
  onSelectDate,
  markers,
  defaultExpanded = false,
}: ExpandableJalaliCalendarProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(selectedDate));
  /** Non-null only mid-drag; overrides the settled 0/1 so the grid tracks the finger. */
  const [dragProgress, setDragProgress] = useState<number | null>(null);

  const rootRef = useRef<HTMLElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ id: number; startY: number; from: number; progress: number; moved: boolean } | null>(null);
  /** Tears down the in-flight drag's window listeners — also used on unmount. */
  const releaseDragRef = useRef<(() => void) | null>(null);
  /** A drag ends in a click event too — this stops that click acting as a tap. */
  const suppressClickRef = useRef(false);
  /** dayKey to focus once the grid has re-rendered, for keyboard navigation. */
  const pendingFocusRef = useRef<string | null>(null);
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;

  const todayDate = useMemo(() => today(), []);
  const viewMonthKey = toDayKey(viewMonth);
  const weeks = useMemo(() => buildMonthGrid(viewMonth), [viewMonthKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // The row the collapsed view shows. Falls back to the first row only in the
  // transient case where the user browsed to a month the selection isn't in —
  // collapsing resets viewMonth back to the selection's month (effect below).
  const anchorRow = Math.max(0, findWeekIndex(weeks, selectedDate));
  const progress = dragProgress ?? (expanded ? 1 : 0);
  const dragRange = Math.max(1, (weeks.length - 1) * ROW_HEIGHT_PX);

  const viewportHeight = ROW_HEIGHT_PX * (1 + progress * (weeks.length - 1));
  const gridOffset = -(1 - progress) * anchorRow * ROW_HEIGHT_PX;
  const settling = dragProgress === null;

  const selectDay = useCallback(
    (date: Date) => {
      if (!isSameMonth(date, viewMonth)) setViewMonth(startOfMonth(date));
      onSelectDate(date);
    },
    [onSelectDate, viewMonth],
  );

  // Keeps requirement "collapse shows the week of the *selected* date": whenever
  // we're in week mode, the rendered month is always the selection's month, so
  // anchorRow can't miss. Also covers the selection being changed from outside.
  useEffect(() => {
    if (expanded || isSameMonth(selectedDate, viewMonth)) return;
    setViewMonth(startOfMonth(selectedDate));
  }, [expanded, selectedDate, viewMonth]);

  // Roving tabindex: arrow keys move the selection, so focus has to follow it
  // onto whichever button now represents that day.
  useEffect(() => {
    const key = pendingFocusRef.current;
    if (!key) return;
    pendingFocusRef.current = null;
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-day="${key}"]`)?.focus();
  }, [selectedDate, viewMonthKey]);

  // Unmounting mid-drag would otherwise leave the window listeners behind.
  useEffect(() => () => releaseDragRef.current?.(), []);

  // Wheel = the desktop equivalent of the drag. Only swallowed when it actually
  // toggles the calendar; once expanded, scrolling further down belongs to the
  // page, so the dashboard below stays reachable with a mouse.
  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;

    let accumulated = 0;
    let resetTimer = 0;

    function handleWheel(event: WheelEvent) {
      if (expandedRef.current && event.deltaY > 0) return;
      accumulated += event.deltaY;
      window.clearTimeout(resetTimer);
      resetTimer = window.setTimeout(() => {
        accumulated = 0;
      }, WHEEL_IDLE_RESET_MS);
      if (Math.abs(accumulated) < WHEEL_THRESHOLD_PX) return;
      accumulated = 0;
      event.preventDefault();
      setExpanded(!expandedRef.current);
    }

    node.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      node.removeEventListener('wheel', handleWheel);
      window.clearTimeout(resetTimer);
    };
  }, []);

  // The rest of the gesture is tracked on `window`, not on the element that got
  // the pointerdown. A touch pointer keeps implicit capture, but a mouse drag
  // doesn't — move fast enough and the cursor leaves the calendar mid-gesture,
  // and every subsequent event goes to whatever is underneath instead. Listening
  // globally for the duration is what makes flicks and slow drags behave the
  // same, and it doesn't hijack the click target the way setPointerCapture does.
  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (dragRef.current) return;

    suppressClickRef.current = false;
    const from = expanded ? 1 : 0;
    const drag = { id: event.pointerId, startY: event.clientY, from, progress: from, moved: false };
    dragRef.current = drag;

    function handleMove(moveEvent: globalThis.PointerEvent) {
      if (moveEvent.pointerId !== drag.id) return;
      const dy = moveEvent.clientY - drag.startY;

      if (!drag.moved) {
        // Under the threshold this is still a tap, so tapping a day never
        // nudges the calendar open.
        if (Math.abs(dy) < DRAG_THRESHOLD_PX) return;
        drag.moved = true;
        suppressClickRef.current = true;
      }

      // Collapsed, a pull either way opens the month — the intent people have
      // is "move the calendar", and forcing one direction makes half the drags
      // do nothing. Expanded, only an upward pull closes it; downward clamps.
      const travel = drag.from === 0 ? Math.abs(dy) : dy;
      drag.progress = clamp(drag.from + travel / dragRange, 0, 1);
      setDragProgress(drag.progress);
    }

    function handleEnd(endEvent: globalThis.PointerEvent) {
      if (endEvent.pointerId !== drag.id) return;
      detach();
      setDragProgress(null);
      if (!drag.moved) return;
      const committed = Math.abs(drag.progress - drag.from) > DRAG_COMMIT_RATIO;
      setExpanded(committed ? drag.from === 0 : drag.from === 1);
    }

    function detach() {
      dragRef.current = null;
      releaseDragRef.current = null;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleEnd);
      window.removeEventListener('pointercancel', handleEnd);
    }

    releaseDragRef.current = detach;
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleEnd);
    window.addEventListener('pointercancel', handleEnd);
  }

  const dragHandlers = { onPointerDown: handlePointerDown };

  function toggleExpanded() {
    // The click that closes a drag gesture isn't a tap on the toggle.
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    setExpanded((prev) => !prev);
  }

  // Expanded, the arrows browse months. Collapsed, there's only one week on
  // screen, so browsing by month would jump past everything in between — they
  // step a week, carrying the selection (and therefore the day's content) along.
  function step(direction: 1 | -1) {
    if (expanded) setViewMonth((month) => addMonths(month, direction));
    else selectDay(addDays(selectedDate, direction * 7));
  }

  const handleDayKeyDown = useCallback(
    (event: KeyboardEvent<HTMLButtonElement>, date: Date) => {
      const stepDays = KEY_STEP[event.key];
      if (stepDays === undefined) return;
      event.preventDefault();
      const next = addDays(date, stepDays);
      pendingFocusRef.current = toDayKey(next);
      selectDay(next);
    },
    [selectDay],
  );

  const isTodaySelected = isSameDay(selectedDate, todayDate);

  return (
    <section className={styles.calendar} ref={rootRef} aria-label="تقویم">
      <header className={styles.head}>
        <button
          type="button"
          className={styles.navButton}
          onClick={() => step(-1)}
          aria-label={expanded ? 'ماه قبل' : 'هفته قبل'}
        >
          <RightOutline />
        </button>

        {/* Collapsed there's one week on screen and the selected day is the
            subject, so it gets the title; expanded, the subject is the month
            being browsed. Tapping either way toggles between the two. */}
        <button
          type="button"
          className={styles.monthTitle}
          onClick={toggleExpanded}
          aria-expanded={expanded}
          aria-controls="calendar-grid"
        >
          {expanded ? formatMonthYear(viewMonth) : formatLongDate(selectedDate)}
        </button>

        <button
          type="button"
          className={styles.navButton}
          onClick={() => step(1)}
          aria-label={expanded ? 'ماه بعد' : 'هفته بعد'}
        >
          <LeftOutline />
        </button>
      </header>

      <div className={styles.weekdays} aria-hidden="true">
        {WEEKDAY_LABELS_SHORT.map((label, index) => (
          <span key={label} className={index === 6 ? `${styles.weekday} ${styles.weekdayWeekend}` : styles.weekday}>
            {label}
          </span>
        ))}
      </div>

      <div
        className={styles.viewport}
        style={{ height: `${viewportHeight}px`, transition: settling ? undefined : 'none' }}
        {...dragHandlers}
      >
        <div
          id="calendar-grid"
          ref={gridRef}
          role="grid"
          aria-label={`تقویم ${formatMonthYear(viewMonth)}`}
          aria-rowcount={weeks.length}
          className={styles.grid}
          style={{ transform: `translateY(${gridOffset}px)`, transition: settling ? undefined : 'none' }}
        >
          {weeks.map((week, rowIndex) => {
            const isAnchorRow = rowIndex === anchorRow;
            return (
              <div
                key={toDayKey(week[0])}
                role="row"
                className={styles.row}
                // The clipped rows fade rather than pop as the month opens.
                style={{ opacity: isAnchorRow ? 1 : progress }}
                aria-hidden={!expanded && !isAnchorRow}
              >
                {week.map((day) => {
                  const dayKey = toDayKey(day);
                  const isSelected = isSameDay(day, selectedDate);
                  return (
                    <CalendarDay
                      key={dayKey}
                      date={day}
                      dayKey={dayKey}
                      isSelected={isSelected}
                      isToday={isSameDay(day, todayDate)}
                      isOutsideMonth={!isSameMonth(day, viewMonth)}
                      isWeekend={isWeekend(day)}
                      markers={markers?.get(dayKey) ?? EMPTY_MARKERS}
                      tabIndex={isSelected ? 0 : -1}
                      onSelect={selectDay}
                      onKeyDown={handleDayKeyDown}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.foot}>
        <button
          type="button"
          className={styles.grabber}
          onClick={toggleExpanded}
          aria-expanded={expanded}
          aria-controls="calendar-grid"
          aria-label={expanded ? 'بستن نمای ماه' : 'نمایش کل ماه'}
          {...dragHandlers}
        >
          <span className={styles.grabberBar} />
        </button>

        {!isTodaySelected && (
          <button type="button" className={styles.todayButton} onClick={() => selectDay(todayDate)}>
            امروز
          </button>
        )}
      </div>

      {/* Announced to screen readers only — the grid's shape changing is a
          visual cue that otherwise has no spoken equivalent. */}
      <span className={styles.srOnly} role="status">
        {expanded ? 'نمای ماه' : 'نمای هفته'}
      </span>
    </section>
  );
}
