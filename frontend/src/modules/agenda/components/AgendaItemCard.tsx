import {
  BellOutline,
  CalendarOutline,
  CheckCircleOutline,
  ClockCircleOutline,
  EnvironmentOutline,
  ExclamationCircleOutline,
  FileOutline,
  FlagOutline,
} from 'antd-mobile-icons';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { differenceInCalendarDays, formatShortDate, formatTime, today, toPersianDigits } from '../../../shared/date/jalali';
import { AGENDA_KIND_LABEL } from '../types';
import type { AgendaItem, AgendaKind } from '../types';
import styles from './AgendaItemCard.module.css';

const KIND_ICON: Record<AgendaKind, ReactNode> = {
  session: <ClockCircleOutline />,
  decision: <CheckCircleOutline />,
  job: <FlagOutline />,
  note: <FileOutline />,
  reminder: <BellOutline />,
};

interface AgendaItemCardProps {
  item: AgendaItem;
}

/**
 * «۳ روز تأخیر» — how far past its deadline an overdue item is.
 *
 * Always at least one day: `overdue` is decided at day granularity (see
 * agenda/api.ts), so a deadline that has "passed" is on an earlier calendar day
 * than today by definition.
 */
function lateBy(deadline: Date): string {
  return `${toPersianDigits(differenceInCalendarDays(today(), deadline))} روز تأخیر`;
}

export function AgendaItemCard({ item }: AgendaItemCardProps) {
  const navigate = useNavigate();
  // Only some kinds have a screen to open yet (projects do; sessions, decisions
  // and notes don't have their modules built). Rather than wire a dead onClick,
  // the card renders as a plain div until there's somewhere to go.
  const Tag = item.to ? 'button' : 'div';

  return (
    <Tag
      {...(item.to ? { type: 'button' as const, onClick: () => navigate(item.to!) } : {})}
      className={`${styles.card} ${item.to ? styles.cardInteractive : ''}`}
      data-kind={item.kind}
      data-overdue={item.overdue || undefined}
    >
      <div className={styles.top}>
        <span className={styles.title}>{item.title}</span>
        <span className={styles.kind}>
          {KIND_ICON[item.kind]}
          {AGENDA_KIND_LABEL[item.kind]}
        </span>
      </div>

      {item.subtitle && <div className={styles.subtitle}>{item.subtitle}</div>}

      <div className={styles.meta}>
        <span className={styles.metaItem}>
          <CalendarOutline />
          {/* A job's date is a deadline, not "when it happens" — saying so is
              the difference between a due date and a schedule entry. */}
          {item.kind === 'job' ? `مهلت ${formatShortDate(item.date)}` : formatShortDate(item.date)}
        </span>
        {item.hasTime && (
          <span className={styles.metaItem}>
            <ClockCircleOutline />
            {formatTime(item.date)}
          </span>
        )}
        {item.location && (
          <span className={styles.metaItem}>
            <EnvironmentOutline />
            {item.location}
          </span>
        )}
        {/* The one piece of information the card can't carry any other way: the
            date says *when* it was due, this says how long ago that was. */}
        {item.overdue && (
          <span className={`${styles.metaItem} ${styles.late}`}>
            <ExclamationCircleOutline />
            {lateBy(item.date)}
          </span>
        )}
      </div>

      {item.status && <span className={styles.status}>{item.status}</span>}
    </Tag>
  );
}
