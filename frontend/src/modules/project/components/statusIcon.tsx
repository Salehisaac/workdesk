import { CheckOutline, MinusCircleOutline, PlayOutline, StopOutline, UndoOutline } from 'antd-mobile-icons';
import type { ReactNode } from 'react';
import type { JobStatus } from '../types';
import styles from './statusIcon.module.css';

/**
 * One glyph per job status, shared by everything that shows a status: the
 * status sheet's chips and the report's legend and breakdown rows.
 *
 * The point of hoisting it out of the sheet is that the six --wd-status-*
 * colours are not allowed to be the only thing telling the statuses apart —
 * roughly one reader in twelve can't separate the paused amber from the done
 * green. Every place that paints a status therefore has to pair the colour with
 * this icon *and* JOB_STATUS_LABEL, and sharing one map is what keeps a second
 * copy from quietly picking a different glyph for the same state.
 */
export const STATUS_ICON: Record<JobStatus, ReactNode> = {
  notStarted: <span className={styles.square} />,
  inProgress: <PlayOutline />,
  paused: <MinusCircleOutline />,
  // A circle-and-slash — the "forbidden" mark, not a plain close cross.
  canceled: <StopOutline />,
  done: <CheckOutline />,
  rejected: <UndoOutline />,
};
