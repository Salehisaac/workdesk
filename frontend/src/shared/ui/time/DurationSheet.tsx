import { Picker } from 'antd-mobile';
import type { CSSProperties } from 'react';
import { useMemo } from 'react';
import { toPersianDigits } from '../../date/jalali';

/**
 * How long something takes — a wheel, not the clock dial next door.
 *
 * ClockTimePicker answers "at what time", and its whole design says so: a
 * 24-hour face you point at. A duration has no place on a face — ۰۰:۳۰ is half
 * an hour, not half past midnight — so it gets the plainer control, two columns
 * you spin. Used for «مدت زمان» on a دستور جلسه; nothing stops a job estimate
 * from using it later, which is why it lives here rather than in the module.
 *
 * The value is minutes, one number rather than an {hours, minutes} pair: the
 * columns are an input device, not the shape of the thing.
 */

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, hour) => ({
  // Units on every row, because two bare digit columns don't say which is
  // which — and under RTL the reader can't fall back on "hours are on the left".
  label: `${toPersianDigits(hour)} ساعت`,
  value: String(hour),
}));

const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, minute) => ({
  label: `${toPersianDigits(minute)} دقیقه`,
  value: String(minute),
}));

/** «۱ ساعت و ۳۰ دقیقه» — null when there is no duration to render. */
export function formatDuration(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${toPersianDigits(hours)} ساعت`);
  if (rest > 0) parts.push(`${toPersianDigits(rest)} دقیقه`);
  return parts.join(' و ');
}

interface DurationSheetProps {
  visible: boolean;
  /** Minutes, or null when nothing has been chosen yet. */
  value: number | null;
  title?: string;
  onClose: () => void;
  /** Minutes. Zero is a legitimate answer — it means "no duration after all". */
  onConfirm: (minutes: number) => void;
}

export function DurationSheet({ visible, value, title = 'مدت', onClose, onConfirm }: DurationSheetProps) {
  const selected = useMemo(() => {
    const minutes = value ?? 0;
    return [String(Math.floor(minutes / 60)), String(minutes % 60)];
  }, [value]);

  return (
    <Picker
      visible={visible}
      title={title}
      columns={[HOUR_OPTIONS, MINUTE_OPTIONS]}
      value={selected}
      onClose={onClose}
      onCancel={onClose}
      onConfirm={(picked) => {
        const [hours, minutes] = picked.map((entry) => Number(entry) || 0);
        onConfirm(hours * 60 + minutes);
      }}
      // Same two guards ClockTimePicker needs: lifted above the sheet that
      // opened it, and portaled to the body so it is fixed to the viewport
      // rather than to that sheet's transformed body.
      popupStyle={{ '--z-index': '1100' } as CSSProperties}
      getContainer={() => document.body}
      destroyOnClose
    />
  );
}
