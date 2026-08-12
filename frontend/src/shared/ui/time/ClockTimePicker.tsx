import { CenterPopup } from 'antd-mobile';
import { AaOutline, ClockCircleOutline } from 'antd-mobile-icons';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { fromPersianDigits, toPersianDigits } from '../../date/jalali';
import styles from './ClockTimePicker.module.css';

/**
 * A 24-hour clock dial, built rather than installed.
 *
 * The only packaged dial that matches is MUI's, which would mean pulling
 * @mui/material and emotion in alongside antd-mobile — a second design system
 * for one control — and it would still need its digits and RTL wired up. The
 * geometry here is a few dozen lines, so it's cheaper to own it.
 *
 * Hours use both rings the way Material's 24h clock does: 0–11 outside, 12–23
 * inside, which is what makes a whole day reachable without an AM/PM toggle.
 */

const DIAL_SIZE = 260;
const CENTER = DIAL_SIZE / 2;
const RADIUS_OUTER = 106;
const RADIUS_INNER = 70;
/** Halfway between the rings — which side of this the finger is on picks a ring. */
const RING_BOUNDARY = (RADIUS_OUTER + RADIUS_INNER) / 2;
const SELECTOR_RADIUS = 19;

const HOURS_OUTER = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const HOURS_INNER = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
const MINUTE_LABELS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

type Mode = 'hour' | 'minute';

export interface TimeValue {
  hour: number;
  minute: number;
}

/** Angle is measured clockwise from 12 o'clock, matching how a clock reads. */
function polar(angleDeg: number, radius: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CENTER + radius * Math.sin(rad), y: CENTER - radius * Math.cos(rad) };
}

function hourPlacement(hour: number) {
  return { angle: (hour % 12) * 30, radius: hour >= 12 ? RADIUS_INNER : RADIUS_OUTER };
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

interface ClockTimePickerProps {
  visible: boolean;
  value: TimeValue;
  onCancel: () => void;
  onConfirm: (value: TimeValue) => void;
}

export function ClockTimePicker({ visible, value, onCancel, onConfirm }: ClockTimePickerProps) {
  const [draft, setDraft] = useState<TimeValue>(value);
  const [mode, setMode] = useState<Mode>('hour');
  const [typing, setTyping] = useState(false);
  const dialRef = useRef<SVGSVGElement | null>(null);
  const releaseDragRef = useRef<(() => void) | null>(null);

  // Re-seed on each open so cancelling really discards.
  useEffect(() => {
    if (!visible) return;
    setDraft(value);
    setMode('hour');
    setTyping(false);
  }, [visible, value]);

  useEffect(() => () => releaseDragRef.current?.(), []);

  /** Maps a client point onto the dial's own coordinate space, then to a value. */
  function valueAtPoint(clientX: number, clientY: number): number | null {
    const dial = dialRef.current;
    if (!dial) return null;
    const rect = dial.getBoundingClientRect();
    // The SVG can be laid out smaller than its viewBox on a narrow screen.
    const scale = rect.width / DIAL_SIZE || 1;
    const dx = (clientX - rect.left) / scale - CENTER;
    const dy = (clientY - rect.top) / scale - CENTER;

    let degrees = (Math.atan2(dx, -dy) * 180) / Math.PI;
    if (degrees < 0) degrees += 360;

    if (mode === 'minute') return Math.round(degrees / 6) % 60;

    const index = Math.round(degrees / 30) % 12;
    return Math.hypot(dx, dy) < RING_BOUNDARY ? index + 12 : index;
  }

  function apply(next: number | null) {
    if (next === null) return;
    setDraft((prev) => (mode === 'hour' ? { ...prev, hour: next } : { ...prev, minute: next }));
  }

  function handlePointerDown(event: PointerEvent<SVGSVGElement>) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    apply(valueAtPoint(event.clientX, event.clientY));

    // Tracked on window so a drag that leaves the dial keeps working — the same
    // reason the calendar's expand gesture does it this way.
    function handleMove(moveEvent: globalThis.PointerEvent) {
      apply(valueAtPoint(moveEvent.clientX, moveEvent.clientY));
    }
    function handleUp() {
      detach();
      // Picking an hour hands over to the minutes, so the common case is one
      // gesture per field with no extra tap in between.
      setMode((prev) => (prev === 'hour' ? 'minute' : prev));
    }
    function detach() {
      releaseDragRef.current = null;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    }

    releaseDragRef.current = detach;
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  }

  /** Arrow keys drive the dial — it's a slider, and a dial can't be dragged by keyboard. */
  function handleDialKeyDown(event: KeyboardEvent<SVGSVGElement>) {
    const step = event.key === 'ArrowUp' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowDown' || event.key === 'ArrowLeft' ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    setDraft((prev) =>
      mode === 'hour'
        ? { ...prev, hour: (prev.hour + step + 24) % 24 }
        : { ...prev, minute: (prev.minute + step + 60) % 60 },
    );
  }

  function handleTypedChange(field: keyof TimeValue, raw: string) {
    const digits = fromPersianDigits(raw).replace(/\D/g, '');
    if (digits === '') {
      setDraft((prev) => ({ ...prev, [field]: 0 }));
      return;
    }
    const parsed = Number(digits.slice(-2));
    setDraft((prev) => ({ ...prev, [field]: clamp(parsed, 0, field === 'hour' ? 23 : 59) }));
  }

  const selector = mode === 'hour' ? hourPlacement(draft.hour) : { angle: draft.minute * 6, radius: RADIUS_OUTER };
  const selectorPoint = polar(selector.angle, selector.radius);
  const activeValue = mode === 'hour' ? draft.hour : draft.minute;
  const labelIsUnderSelector = mode === 'hour' || draft.minute % 5 === 0;

  function renderRing(values: number[], radius: number, isSelected: (value: number) => boolean) {
    return values.map((entry) => {
      const point = polar(mode === 'minute' ? entry * 6 : (entry % 12) * 30, radius);
      // Minutes are always two digits (۰۵, ۱۰ …); hours are bare except for
      // midnight, which reads as ۰۰ rather than a lone zero.
      const label = mode === 'minute' ? pad(entry) : entry === 0 ? '00' : String(entry);
      return (
        <text
          key={entry}
          x={point.x}
          y={point.y}
          className={isSelected(entry) ? `${styles.tick} ${styles.tickSelected}` : styles.tick}
          textAnchor="middle"
          dominantBaseline="central"
        >
          {toPersianDigits(label)}
        </text>
      );
    });
  }

  return (
    <CenterPopup
      visible={visible}
      onMaskClick={onCancel}
      onClose={onCancel}
      bodyClassName={styles.popup}
      // This opens as step two *on top of* the date sheet, which is itself a
      // Popup at the default z-index — without lifting it the dial renders
      // behind the calendar.
      style={{ '--z-index': '1100' }}
    >
      <div className={styles.dialog}>
        <h2 className={styles.title}>انتخاب زمان</h2>

        {/* A time reads HH:MM in every locale, so this row stays LTR even
            though the dialog around it is RTL. */}
        <div className={styles.readout} dir="ltr">
          <button
            type="button"
            className={`${styles.field} ${mode === 'hour' ? styles.fieldActive : ''}`}
            onClick={() => setMode('hour')}
            aria-label="ساعت"
            aria-pressed={mode === 'hour'}
          >
            {typing ? (
              <input
                className={styles.fieldInput}
                inputMode="numeric"
                value={toPersianDigits(pad(draft.hour))}
                onChange={(event) => handleTypedChange('hour', event.target.value)}
                aria-label="ساعت"
              />
            ) : (
              toPersianDigits(pad(draft.hour))
            )}
          </button>

          <span className={styles.colon}>:</span>

          <button
            type="button"
            className={`${styles.field} ${mode === 'minute' ? styles.fieldActive : ''}`}
            onClick={() => setMode('minute')}
            aria-label="دقیقه"
            aria-pressed={mode === 'minute'}
          >
            {typing ? (
              <input
                className={styles.fieldInput}
                inputMode="numeric"
                value={toPersianDigits(pad(draft.minute))}
                onChange={(event) => handleTypedChange('minute', event.target.value)}
                aria-label="دقیقه"
              />
            ) : (
              toPersianDigits(pad(draft.minute))
            )}
          </button>
        </div>

        {!typing && (
          <svg
            ref={dialRef}
            className={styles.dial}
            viewBox={`0 0 ${DIAL_SIZE} ${DIAL_SIZE}`}
            width={DIAL_SIZE}
            height={DIAL_SIZE}
            role="slider"
            tabIndex={0}
            aria-label={mode === 'hour' ? 'انتخاب ساعت' : 'انتخاب دقیقه'}
            aria-valuemin={0}
            aria-valuemax={mode === 'hour' ? 23 : 59}
            aria-valuenow={activeValue}
            aria-valuetext={toPersianDigits(pad(activeValue))}
            onPointerDown={handlePointerDown}
            onKeyDown={handleDialKeyDown}
          >
            <circle cx={CENTER} cy={CENTER} r={CENTER - 2} className={styles.face} />

            {/* Hand first, so the numbers sit on top of it. */}
            <line x1={CENTER} y1={CENTER} x2={selectorPoint.x} y2={selectorPoint.y} className={styles.hand} />
            <circle cx={CENTER} cy={CENTER} r={4} className={styles.hub} />
            <circle cx={selectorPoint.x} cy={selectorPoint.y} r={SELECTOR_RADIUS} className={styles.selector} />
            {/* A minute that isn't a multiple of 5 has no number to land on, so
                the puck gets a dot to show exactly where it points. */}
            {!labelIsUnderSelector && (
              <circle cx={selectorPoint.x} cy={selectorPoint.y} r={2.5} className={styles.selectorDot} />
            )}

            {mode === 'hour' ? (
              <>
                {renderRing(HOURS_OUTER, RADIUS_OUTER, (entry) => entry === draft.hour)}
                {renderRing(HOURS_INNER, RADIUS_INNER, (entry) => entry === draft.hour)}
              </>
            ) : (
              renderRing(MINUTE_LABELS, RADIUS_OUTER, (entry) => entry === draft.minute)
            )}
          </svg>
        )}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.toggle}
            onClick={() => setTyping((prev) => !prev)}
            aria-pressed={typing}
            aria-label={typing ? 'انتخاب با عقربه' : 'وارد کردن با صفحه‌کلید'}
          >
            {/* The icon shows the mode you'd switch *to*, not the one you're in. */}
            {typing ? <ClockCircleOutline /> : <AaOutline />}
          </button>
          <span className={styles.spacer} />
          <button type="button" className={styles.textButton} onClick={onCancel}>
            لغو
          </button>
          <button type="button" className={styles.textButton} onClick={() => onConfirm(draft)}>
            تأیید
          </button>
        </div>
      </div>
    </CenterPopup>
  );
}
