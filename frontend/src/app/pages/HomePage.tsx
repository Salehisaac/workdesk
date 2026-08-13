import { useState } from 'react';
import { useAgenda, useAgendaCalendar } from '../../modules/agenda/api';
import { CreateFab } from '../../modules/agenda/components/CreateFab';
import { DayDashboard } from '../../modules/agenda/components/DayDashboard';
import type { AgendaItem } from '../../modules/agenda/types';
import { toDayKey, today } from '../../shared/date/jalali';
import { ExpandableJalaliCalendar } from '../../shared/ui/calendar/ExpandableJalaliCalendar';
import { useHideOnScroll } from '../../shared/ui/useHideOnScroll';
import { HomeHeader } from './HomeHeader';
import styles from './HomePage.module.css';
import { ToolDock } from './ToolDock';

const NO_ITEMS: AgendaItem[] = [];

export function HomePage() {
  // A calendar day, normalized to local midnight — never a UTC instant, so the
  // selection can't drift to the neighbouring day. See shared/date/jalali.ts.
  const [selectedDate, setSelectedDate] = useState(() => today());
  const agenda = useAgenda();

  const { markers } = useAgendaCalendar();

  const dayItems = agenda.byDay.get(toDayKey(selectedDate)) ?? NO_ITEMS;

  // One source of truth for both fixed elements in the bottom corner: the dock
  // slides out, and the create button drops into the space it leaves.
  const dockHidden = useHideOnScroll();

  return (
    <div className={styles.page} data-dock-hidden={dockHidden || undefined}>
      <div className={styles.content}>
        <HomeHeader />

        <ExpandableJalaliCalendar selectedDate={selectedDate} onSelectDate={setSelectedDate} markers={markers} />

        <DayDashboard
          selectedDate={selectedDate}
          items={dayItems}
          isLoading={agenda.isLoading}
          isError={agenda.isError}
        />
      </div>

      <ToolDock hidden={dockHidden} />
      <CreateFab />
    </div>
  );
}
