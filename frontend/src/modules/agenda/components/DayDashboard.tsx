import { DotLoading } from 'antd-mobile';
import { CalendarOutline, FileOutline, PieOutline } from 'antd-mobile-icons';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { formatLongDate, isSameDay, today } from '../../../shared/date/jalali';
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
    emptyText: 'پروژه‌ای در این روز آغاز نشده است.',
  },
  {
    group: 'notes',
    title: 'یادداشت‌ها',
    icon: <FileOutline />,
    emptyText: 'یادداشتی برای این روز ثبت نشده است.',
  },
];

type Filter = AgendaGroup | 'all';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'همه' },
  { key: 'meetings', label: 'جلسات و مصوبات' },
  { key: 'projects', label: 'پروژه‌ها' },
  { key: 'notes', label: 'یادداشت‌ها' },
];

interface DayDashboardProps {
  selectedDate: Date;
  /** Already narrowed to the selected day by the caller. */
  items: AgendaItem[];
  isLoading: boolean;
  isError: boolean;
}

export function DayDashboard({ selectedDate, items, isLoading, isError }: DayDashboardProps) {
  const [filter, setFilter] = useState<Filter>('all');

  const byGroup = useMemo(() => {
    const groups: Record<AgendaGroup, AgendaItem[]> = { meetings: [], projects: [], notes: [] };
    for (const item of items) groups[AGENDA_GROUP_OF[item.kind]].push(item);
    return groups;
  }, [items]);

  const isToday = isSameDay(selectedDate, today());
  const visibleSections = SECTIONS.filter((section) => filter === 'all' || section.group === filter);

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
          بارگذاری موارد این روز با خطا مواجه شد. اتصال خود را بررسی کنید.
        </div>
      )}

      {isLoading && items.length === 0 ? (
        <div className={styles.loading}>
          <DotLoading />
          <span>در حال بارگذاری…</span>
        </div>
      ) : (
        <div className={styles.sections}>
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
