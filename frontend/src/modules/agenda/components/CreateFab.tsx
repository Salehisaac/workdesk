import { Popup } from 'antd-mobile';
import { AddOutline } from 'antd-mobile-icons';
import type { CSSProperties } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CREATABLE_MODULES, PLANNED_MODULES } from '../../../shared/workdesk/modules';
import styles from './CreateFab.module.css';

/**
 * The one create entry point.
 *
 * The menu is split by what it can actually do: the modules with a flow behind
 * them get real cards, and the four that don't get a single «به‌زودی» strip of
 * labels underneath. That split is the point — the previous version listed all
 * six identically and put a lock badge on the ones that only showed a toast,
 * which spends four of six rows' worth of attention teaching people which
 * buttons don't work. A roadmap strip says the same thing without pretending to
 * be tappable.
 *
 * Built on Popup rather than ActionSheet: there's no cancel button, so the two
 * ways out are tapping the app behind it and swiping the sheet down — and
 * `closeOnSwipe` is a Popup prop that ActionSheet doesn't forward.
 */
export function CreateFab() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={styles.fab}
        data-open={open || undefined}
        onClick={() => setOpen(true)}
        aria-label="ساختن مورد تازه"
        aria-expanded={open}
      >
        <AddOutline />
      </button>

      <Popup
        visible={open}
        position="bottom"
        closeOnSwipe
        closeOnMaskClick
        onClose={() => setOpen(false)}
        onMaskClick={() => setOpen(false)}
        bodyStyle={{ background: 'transparent' }}
      >
        <div className={styles.sheet} role="group" aria-label="ساختن مورد تازه">
          {/* The only visible affordance for "this closes by dragging down",
              now that there's no cancel button to point at. */}
          <span className={styles.handle} aria-hidden="true" />

          <h2 className={styles.title}>چه چیز تازه‌ای بسازیم؟</h2>

          <div className={styles.cards}>
            {CREATABLE_MODULES.map((module, index) => (
              <button
                key={module.key}
                type="button"
                className={styles.card}
                style={{ '--tone': module.tone, '--card-index': index } as CSSProperties}
                onClick={() => {
                  setOpen(false);
                  navigate(module.createTo!);
                }}
              >
                <span className={styles.cardIcon}>{module.icon}</span>
                <span className={styles.cardLabel}>{module.label}</span>
                <span className={styles.cardAction}>{module.action}</span>
              </button>
            ))}
          </div>

          <div className={styles.planned}>
            <span className={styles.plannedLabel}>به‌زودی</span>
            <span className={styles.plannedItems}>
              {PLANNED_MODULES.map((module) => (
                <span key={module.key} className={styles.plannedItem} style={{ '--tone': module.tone } as CSSProperties}>
                  <span className={styles.plannedIcon} aria-hidden="true">
                    {module.icon}
                  </span>
                  {module.label}
                </span>
              ))}
            </span>
          </div>
        </div>
      </Popup>
    </>
  );
}
