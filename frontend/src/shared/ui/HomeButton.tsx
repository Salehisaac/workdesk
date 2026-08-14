import { useNavigate } from 'react-router-dom';
import styles from './HomeButton.module.css';

/**
 * «خانه» — the day dashboard, one tap from wherever you are.
 *
 * Deliberately NOT on every screen. It belongs where «بازگشت» doesn't already
 * lead home, which is the screens two or more steps down: a report, a book, a
 * meeting. On the four top-level lists back *is* home, and a second button doing
 * the same thing an inch away is clutter; on a create form it would be worse
 * than clutter, since one tap would discard whatever had been typed with no
 * warning. The project board is the one deep screen without one — the header
 * there has no room to spare, and ProjectHeader says why.
 *
 * The case it really answers is arriving from outside: a ledger or session
 * invite opens the app directly on that screen (see app/services/invite), so
 * the person reading it never passed through the front door and has no history
 * to go back through. Back gives them the list they were never on; this gives
 * them the app.
 *
 * Placed beside back, at the header's start edge — navigation on one side, the
 * screen's own actions on the other — so it stays in the same place on every
 * screen that has one.
 *
 * The glyph is drawn here rather than imported: antd-mobile-icons ships no
 * house, and the nearest alternatives (a grid, a compass) need a label to be
 * understood, which is exactly what a 36px button has no room for.
 */
export function HomeButton() {
  const navigate = useNavigate();

  return (
    <button type="button" className={styles.button} onClick={() => navigate('/')} aria-label="خانه">
      <svg viewBox="0 0 24 24" className={styles.icon} aria-hidden="true" focusable="false">
        <path d="M3.6 10.9 12 4.3l8.4 6.6" />
        <path d="M6.3 10v9.4h11.4V10" />
      </svg>
    </button>
  );
}
