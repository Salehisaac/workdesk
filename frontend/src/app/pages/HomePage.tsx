import { Toast } from 'antd-mobile';
import { LockOutline } from 'antd-mobile-icons';
import type { CSSProperties } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAgenda, useAgendaCalendar } from '../../modules/agenda/api';
import { CreateFab } from '../../modules/agenda/components/CreateFab';
import { DayDashboard } from '../../modules/agenda/components/DayDashboard';
import type { AgendaItem } from '../../modules/agenda/types';
import { toDayKey, today } from '../../shared/date/jalali';
import { ExpandableJalaliCalendar } from '../../shared/ui/calendar/ExpandableJalaliCalendar';
import { TOOL_GRID_MODULES } from '../../shared/workdesk/modules';
import { HomeHeader } from './HomeHeader';
import styles from './HomePage.module.css';

const NO_ITEMS: AgendaItem[] = [];

export function HomePage() {
  const navigate = useNavigate();
  // A calendar day, normalized to local midnight — never a UTC instant, so the
  // selection can't drift to the neighbouring day. See shared/date/jalali.ts.
  const [selectedDate, setSelectedDate] = useState(() => today());
  const agenda = useAgenda();

  const { markers } = useAgendaCalendar();

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
