import { Toast } from 'antd-mobile';
import { LockOutline } from 'antd-mobile-icons';
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { TOOL_GRID_MODULES } from '../../shared/workdesk/modules';
import styles from './ToolDock.module.css';

/**
 * The five tools, docked to the bottom of the screen instead of parked at the
 * end of the day's list.
 *
 * As the last block in the scroll flow the grid was reachable in inverse
 * proportion to how much work the day held — a busy day, the one where you most
 * want to open a tool, pushed it furthest away. Fixed to the viewport it costs
 * one constant strip of height no matter how long the list gets, and it hides
 * on scroll-down (see useHideOnScroll) so that strip isn't spent while reading.
 *
 * Icon-first and label-small, unlike the 52px cards it replaces: a permanent
 * bar has to earn its height back, and these are five destinations the reader
 * learns by position within a day of use.
 */

interface ToolDockProps {
  /** Driven by useHideOnScroll — the dock owns the animation, not the state. */
  hidden: boolean;
}

export function ToolDock({ hidden }: ToolDockProps) {
  const navigate = useNavigate();

  return (
    <nav
      className={styles.dock}
      // `visibility: hidden` in the hidden state (see the stylesheet) is what
      // takes these buttons out of the tab order and off the accessibility
      // tree, so there's no aria-hidden/inert to keep in sync here.
      data-hidden={hidden || undefined}
      aria-label="همه ابزارها"
    >
      <div className={styles.row}>
        {TOOL_GRID_MODULES.map((module, index) => (
          <button
            key={module.key}
            type="button"
            className={`${styles.tool} ${module.to ? '' : styles.toolLocked}`}
            style={{ '--tool-index': index } as CSSProperties}
            onClick={() => (module.to ? navigate(module.to) : Toast.show({ content: 'به‌زودی اضافه می‌شود' }))}
          >
            <span className={styles.toolIcon}>
              {module.icon}
              {!module.to && (
                <span className={styles.lockBadge}>
                  <LockOutline />
                </span>
              )}
            </span>
            <span className={styles.toolLabel}>{module.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
