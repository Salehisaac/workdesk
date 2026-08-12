import { Toast } from 'antd-mobile';
import { LockOutline } from 'antd-mobile-icons';
import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAgenda } from '../../modules/agenda/api';
import { CreateFab } from '../../modules/agenda/components/CreateFab';
import { DayDashboard } from '../../modules/agenda/components/DayDashboard';
import { AGENDA_KIND_LABEL } from '../../modules/agenda/types';
import type { AgendaItem, AgendaKind } from '../../modules/agenda/types';
import { toDayKey, today } from '../../shared/date/jalali';
import { ExpandableJalaliCalendar } from '../../shared/ui/calendar/ExpandableJalaliCalendar';
import type { CalendarMarker } from '../../shared/ui/calendar/types';
import { TOOL_GRID_MODULES } from '../../shared/workdesk/modules';
import { HomeHeader } from './HomeHeader';
import styles from './HomePage.module.css';

// Kept in the same order as the dots are drawn, so a day always shows its
// kinds in a stable sequence. Colours come from tokens.css — the calendar dot
// and the dashboard's section badge for a kind are the same variable.
const MARKER_COLOR: Record<AgendaKind, string> = {
  session: 'var(--wd-kind-session)',
  decision: 'var(--wd-kind-decision)',
  job: 'var(--wd-kind-job)',
  note: 'var(--wd-kind-note)',
};

const NO_ITEMS: AgendaItem[] = [];

export function HomePage() {
  const navigate = useNavigate();
  // A calendar day, normalized to local midnight — never a UTC instant, so the
  // selection can't drift to the neighbouring day. See shared/date/jalali.ts.
  const [selectedDate, setSelectedDate] = useState(() => today());
  const agenda = useAgenda();

  const markers = useMemo(() => {
    const map = new Map<string, CalendarMarker[]>();
    for (const [dayKey, kinds] of agenda.kindsByDay) {
      map.set(
        dayKey,
        kinds.map((kind) => ({ id: kind, color: MARKER_COLOR[kind], label: AGENDA_KIND_LABEL[kind] })),
      );
    }
    return map;
  }, [agenda.kindsByDay]);

  const dayItems = agenda.byDay.get(toDayKey(selectedDate)) ?? NO_ITEMS;

  return (
    <div className={styles.page}>
      <div className={styles.content}>
        <HomeHeader />

        <ExpandableJalaliCalendar selectedDate={selectedDate} onSelectDate={setSelectedDate} markers={markers} />

        <DayDashboard
          selectedDate={selectedDate}
          items={dayItems}
          isLoading={agenda.isLoading}
          isError={agenda.isError}
        />

        <div className={styles.tools}>
          <div className={styles.sectionLabel}>همه ابزارها</div>
          <div className={styles.grid}>
            {TOOL_GRID_MODULES.map((module, index) => (
              <button
                key={module.key}
                type="button"
                className={`${styles.tile} ${module.to ? '' : styles.tileLocked}`}
                style={{ '--tile-index': index } as CSSProperties}
                onClick={() => (module.to ? navigate(module.to) : Toast.show({ content: 'به‌زودی اضافه می‌شود' }))}
              >
                <span className={styles.tileCard}>
                  {module.icon}
                  {!module.to && (
                    <span className={styles.lockBadge}>
                      <LockOutline />
                    </span>
                  )}
                </span>
                <span className={styles.tileLabel}>{module.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <CreateFab />
    </div>
  );
}
