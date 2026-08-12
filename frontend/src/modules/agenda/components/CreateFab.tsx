import { ActionSheet, Toast } from 'antd-mobile';
import type { Action } from 'antd-mobile/es/components/action-sheet';
import { AddOutline, CheckCircleOutline, ClockCircleOutline, FileOutline, LockOutline, UnorderedListOutline } from 'antd-mobile-icons';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './CreateFab.module.css';

interface CreateOption {
  key: string;
  label: string;
  description: string;
  icon: ReactNode;
  /** An existing route in the app. Undefined = the module isn't built yet. */
  to?: string;
}

// Mirrors the tool tiles on the home page: Project is the one WorkDesk module
// that exists (POST /projects, three-step wizard at /projects/new), the rest are
// listed so the create menu reflects the product's real shape and get the same
// "coming soon" treatment the locked tiles already use — rather than opening a
// form that can't save anything.
const CREATE_OPTIONS: CreateOption[] = [
  { key: 'session', label: 'جلسه جدید', description: 'زمان‌بندی یک جلسه', icon: <ClockCircleOutline /> },
  { key: 'decision', label: 'مصوبه جدید', description: 'ثبت مصوبه‌ی یک جلسه', icon: <CheckCircleOutline /> },
  { key: 'project', label: 'پروژه جدید', description: 'ساخت پروژه و دعوت اعضا', icon: <UnorderedListOutline />, to: '/projects/new' },
  { key: 'note', label: 'یادداشت جدید', description: 'یادداشت شخصی برای این روز', icon: <FileOutline /> },
];

export function CreateFab() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const actions: Action[] = CREATE_OPTIONS.map((option) => ({
    key: option.key,
    text: (
      <span className={styles.option}>
        <span className={styles.optionIcon}>{option.icon}</span>
        <span className={styles.optionText}>
          <span className={styles.optionLabel}>
            {option.label}
            {!option.to && (
              <span className={styles.optionLock}>
                <LockOutline />
              </span>
            )}
          </span>
          <span className={styles.optionDescription}>{option.description}</span>
        </span>
      </span>
    ),
    onClick: () => {
      setOpen(false);
      if (option.to) navigate(option.to);
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
