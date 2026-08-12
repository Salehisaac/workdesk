import { Popup, Toast } from 'antd-mobile';
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
 *
 * Built on Popup rather than ActionSheet: there's no cancel button, so the two
 * ways out are tapping the app behind it and swiping the sheet down — and
 * `closeOnSwipe` is a Popup prop that ActionSheet doesn't forward.
 */
export function CreateFab() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  function handleSelect(createTo: string | undefined) {
    setOpen(false);
    if (createTo) navigate(createTo);
    else Toast.show({ content: 'به‌زودی اضافه می‌شود' });
  }

  return (
    <>
      <button type="button" className={styles.fab} onClick={() => setOpen(true)} aria-label="ایجاد مورد جدید">
        <AddOutline />
      </button>

      <Popup
        visible={open}
        position="bottom"
        closeOnSwipe
        closeOnMaskClick
        onClose={() => setOpen(false)}
        onMaskClick={() => setOpen(false)}
        bodyStyle={{ borderTopLeftRadius: 12, borderTopRightRadius: 12 }}
      >
        <div className={styles.sheet} role="group" aria-label="ایجاد مورد جدید">
          {/* The only visible affordance for "this closes by dragging down",
              now that there's no cancel button to point at. */}
          <span className={styles.sheetHandle} aria-hidden="true" />

          {WORKDESK_MODULES.map((module) => (
            <button key={module.key} type="button" className={styles.option} onClick={() => handleSelect(module.createTo)}>
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
            </button>
          ))}
        </div>
      </Popup>
    </>
  );
}
