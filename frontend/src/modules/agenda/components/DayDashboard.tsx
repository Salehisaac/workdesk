import { DotLoading } from 'antd-mobile';
import { BellOutline, CalendarOutline, ExclamationCircleOutline, FileOutline, PieOutline } from 'antd-mobile-icons';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { formatLongDate, isSameDay, today, toPersianDigits } from '../../../shared/date/jalali';
import { AGENDA_GROUP_OF } from '../types';
import type { AgendaGroup, AgendaItem } from '../types';
import { AgendaSection } from './AgendaSection';
import styles from './DayDashboard.module.css';

interface SectionConfig {
  group: AgendaGroup;
  title: string;
  icon: ReactNode;
  emptyText: string;
}

const SECTIONS: SectionConfig[] = [
  {
    group: 'meetings',
    title: 'جلسات و مصوبات',
    icon: <CalendarOutline />,
    emptyText: 'برای این روز جلسه یا مصوبه‌ای ثبت نشده است.',
  },
  {
    group: 'projects',
    title: 'پروژه‌ها',
    icon: <PieOutline />,
    emptyText: 'کاری با مهلت این روز در پروژه‌های شما ثبت نشده است.',
  },
  {
    group: 'reminders',
    title: 'یادآورها',
    icon: <BellOutline />,
    emptyText: 'یادآوری برای این روز تنظیم نکرده‌اید.',
  },
  {
    group: 'notes',
    title: 'یادداشت‌ها',
    icon: <FileOutline />,
    emptyText: 'یادداشتی برای این روز ثبت نشده است.',
  },
];

type Filter = AgendaGroup | 'all' | 'overdue';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'همه' },
  { key: 'overdue', label: 'معوقه‌ها' },
  { key: 'meetings', label: 'جلسات و مصوبات' },
  { key: 'projects', label: 'پروژه‌ها' },
  { key: 'reminders', label: 'یادآورها' },
  { key: 'notes', label: 'یادداشت‌ها' },
];

interface DayDashboardProps {
  selectedDate: Date;
  /** Already narrowed to the selected day by the caller. */
  items: AgendaItem[];
  /**
   * Everything still owed past its deadline, from every day — see Agenda.overdue.
   * Not narrowed to the selected day on purpose: arrears are a standing list, not
   * part of what a particular date holds.
   */
  overdue: AgendaItem[];
  isLoading: boolean;
  isError: boolean;
}

export function DayDashboard({ selectedDate, items, overdue, isLoading, isError }: DayDashboardProps) {
  const [filter, setFilter] = useState<Filter>('all');

  const byGroup = useMemo(() => {
    const groups: Record<AgendaGroup, AgendaItem[]> = { meetings: [], projects: [], reminders: [], notes: [] };
    // An overdue card belongs to the معوقه‌ها box and to nothing else. Leaving it
    // in its own section too would print the same card twice on the day its
    // deadline was — and quietly demote the alert to "just another row".
    for (const item of items) if (!item.overdue) groups[AGENDA_GROUP_OF[item.kind]].push(item);
    return groups;
  }, [items]);

  // A group filter narrows the arrears to that group rather than hiding them, so
  // «پروژه‌ها» still answers "everything I owe on projects" in one screen.
  const visibleOverdue = useMemo(
    () =>
      filter === 'all' || filter === 'overdue'
        ? overdue
        : overdue.filter((item) => AGENDA_GROUP_OF[item.kind] === filter),
    [overdue, filter],
  );

  const isToday = isSameDay(selectedDate, today());
  // The معوقه‌ها tab is the one view that is *only* arrears — the day's own
  // sections would be noise under a list of things that are already late.
  const visibleSections =
    filter === 'overdue' ? [] : SECTIONS.filter((section) => filter === 'all' || section.group === filter);
  // Everywhere else the box appears only when it has something in it: an empty
  // one every day would train the eye to skip the colour that means "act now".
  const showOverdue = filter === 'overdue' || visibleOverdue.length > 0;

  return (
    <div className={styles.dashboard}>
      <div className={styles.head}>
        <div>
          <div className={styles.title}>میزکار شما</div>
          <div className={styles.date}>{isToday ? `امروز، ${formatLongDate(selectedDate)}` : formatLongDate(selectedDate)}</div>
        </div>
      </div>

      <div className={styles.filters} role="tablist" aria-label="دسته‌بندی موارد روز">
        {FILTERS.map((option) => (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={filter === option.key}
            className={`${styles.filter} ${filter === option.key ? styles.filterActive : ''}`}
            onClick={() => setFilter(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {isError && (
        <div className={styles.notice} role="alert">
          جهت اهراز هویت برنامه را داخل پیامرسان باز کنید.
        </div>
      )}

      {isLoading && items.length === 0 && overdue.length === 0 ? (
        <div className={styles.loading}>
          <DotLoading />
          <span>در حال بارگذاری…</span>
        </div>
      ) : (
        <div className={styles.sections}>
          {showOverdue && (
            <AgendaSection
              group="overdue"
              title="معوقه‌ها"
              icon={<ExclamationCircleOutline />}
              headline={`${toPersianDigits(visibleOverdue.length)} مورد معوقه دارید!`}
              emptyText="هیچ کار یا مصوبه‌ای از مهلتش نگذشته است."
              items={visibleOverdue}
            />
          )}

          {visibleSections.map((section) => (
            <AgendaSection
              key={section.group}
              group={section.group}
              title={section.title}
              icon={section.icon}
              emptyText={section.emptyText}
              items={byGroup[section.group]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
