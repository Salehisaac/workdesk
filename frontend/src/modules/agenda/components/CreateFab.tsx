import { ActionSheet, Toast } from 'antd-mobile';
import type { Action } from 'antd-mobile/es/components/action-sheet';
import { AddOutline, LockOutline } from 'antd-mobile-icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WORKDESK_MODULES } from '../../../shared/workdesk/modules';
import styles from './CreateFab.module.css';

/**
 * The one create entry point: every WorkDesk module, nothing else. Project is
 * the only one with a flow behind it (the three-step wizard at /projects/new);
 * the rest carry the same lock badge and "coming soon" toast the home page's
 * tool tiles already use, rather than opening a form that can't save anything.
 */
export function CreateFab() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const actions: Action[] = WORKDESK_MODULES.map((module) => ({
    key: module.key,
    text: (
      <span className={styles.option}>
        <span className={styles.optionIcon}>{module.icon}</span>
        <span className={styles.optionText}>
          <span className={styles.optionLabel}>
            {module.label} جدید
            {!module.createTo && (
              <span className={styles.optionLock}>
                <LockOutline />
              </span>
            )}
          </span>
          <span className={styles.optionDescription}>{module.description}</span>
        </span>
      </span>
    ),
    onClick: () => {
      setOpen(false);
      if (module.createTo) navigate(module.createTo);
      else Toast.show({ content: 'به‌زودی اضافه می‌شود' });
    },
  }));

  return (
    <>
      <button type="button" className={styles.fab} onClick={() => setOpen(true)} aria-label="ایجاد مورد جدید">
        <AddOutline />
      </button>

      <ActionSheet
        visible={open}
        actions={actions}
        cancelText="انصراف"
        onClose={() => setOpen(false)}
        onMaskClick={() => setOpen(false)}
      />
    </>
  );
}
