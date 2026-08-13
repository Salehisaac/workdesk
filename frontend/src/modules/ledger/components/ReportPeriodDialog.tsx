import { Dialog } from 'antd-mobile';
import { useState } from 'react';
import { REPORT_PERIODS, REPORT_PERIOD_LABEL } from '../report';
import type { ReportPeriod } from '../report';
import styles from './ReportPeriodDialog.module.css';

interface ReportPeriodDialogProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (period: ReportPeriod) => void;
}

/**
 * «گزارش» — which slice of time.
 *
 * A dialog with radios rather than a sheet of five buttons, because the answer
 * decides where you are about to be taken and «انصراف» has to be as reachable
 * as the choice itself. «روزانه» leads: it is both the commonest question a
 * shopkeeper asks a ledger and the cheapest one to step through afterwards.
 */
export function ReportPeriodDialog({ visible, onClose, onConfirm }: ReportPeriodDialogProps) {
  const [period, setPeriod] = useState<ReportPeriod>('daily');

  return (
    <Dialog
      visible={visible}
      title="گزارش"
      closeOnMaskClick
      onClose={onClose}
      content={
        <div className={styles.options} role="radiogroup" aria-label="بازه گزارش">
          {REPORT_PERIODS.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={period === option}
              className={styles.option}
              onClick={() => setPeriod(option)}
            >
              {/* The dot leads, so under dir="rtl" it sits at the reading edge
                  where the eye starts the row — not stranded across the dialog
                  from the word it belongs to. */}
              <span className={styles.radio} data-checked={period === option || undefined} aria-hidden="true" />
              <span className={styles.label}>{REPORT_PERIOD_LABEL[option]}</span>
            </button>
          ))}
        </div>
      }
      actions={[
        [
          { key: 'cancel', text: 'انصراف', onClick: onClose },
          { key: 'confirm', text: 'قبول', bold: true, onClick: () => onConfirm(period) },
        ],
      ]}
    />
  );
}
