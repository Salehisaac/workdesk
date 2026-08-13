import { Popup } from 'antd-mobile';
import { CheckOutline } from 'antd-mobile-icons';
import { JOB_STATUS_LABEL, JOB_STATUSES } from '../../types';
import type { JobStatus } from '../../types';
import { STATUS_ICON } from '../statusIcon';
import styles from './JobSheets.module.css';

interface JobStatusSheetProps {
  visible: boolean;
  value: JobStatus;
  onClose: () => void;
  onSelect: (status: JobStatus) => void;
}

export function JobStatusSheet({ visible, value, onClose, onSelect }: JobStatusSheetProps) {
  return (
    <Popup
      visible={visible}
      position="bottom"
      closeOnSwipe
      closeOnMaskClick
      onClose={onClose}
      onMaskClick={onClose}
      bodyStyle={{ borderTopLeftRadius: 12, borderTopRightRadius: 12 }}
    >
      <div className={styles.sheet}>
        <span className={styles.handle} aria-hidden="true" />
        <div className={styles.statusTitle}>وضعیت کار</div>

        <div className={styles.statusList} role="radiogroup" aria-label="وضعیت کار">
          {JOB_STATUSES.map((status) => {
            const selected = status === value;
            return (
              <button
                key={status}
                type="button"
                role="radio"
                aria-checked={selected}
                className={styles.statusRow}
                onClick={() => onSelect(status)}
              >
                {/* The tick, not just the chip's colour, is what marks the
                    current status — the six chips are already colour-coded. */}
                <span className={styles.statusTick}>{selected && <CheckOutline />}</span>
                <span className={styles.statusChip} data-status={status}>
                  <span className={styles.statusIcon}>{STATUS_ICON[status]}</span>
                  {JOB_STATUS_LABEL[status]}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </Popup>
  );
}
