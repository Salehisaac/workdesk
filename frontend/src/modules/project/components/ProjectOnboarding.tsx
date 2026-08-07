import { Button, NavBar, Toast } from 'antd-mobile';
import {
  AddCircleOutline,
  PlayOutline,
  QuestionCircleOutline,
  SetOutline,
  StarOutline,
  FireFill,
} from 'antd-mobile-icons';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { bridge } from '../../../bridge';
import styles from './ProjectOnboarding.module.css';

interface OnboardingItem {
  icon: ReactNode;
  color: string;
  title: string;
  description: string;
}

const ITEMS: OnboardingItem[] = [
  {
    icon: <FireFill />,
    color: '#f5a623',
    title: 'امکانات جدید',
    description: 'از آخرین تغییرات پروژه خبر شوید',
  },
  {
    icon: <AddCircleOutline />,
    color: 'var(--rasagram-theme-link-color)',
    title: 'نحوه کار و امکانات',
    description: 'روش ایجاد پروژه و امکانات آن را یاد بگیرید',
  },
  {
    icon: <SetOutline />,
    color: '#00b578',
    title: 'کاربردهای پروژه',
    description: 'در چه مواردی می‌توانید از پروژه استفاده کنید',
  },
  {
    icon: <PlayOutline />,
    color: 'var(--rasagram-theme-link-color)',
    title: 'راهنمای تصویری',
    description: 'فیلم‌های آموزشی نحوه کار با پروژه را ببینید',
  },
  {
    icon: <StarOutline />,
    color: 'var(--rasagram-theme-destructive-text-color)',
    title: 'واژگان و عبارات تخصصی',
    description: 'اصطلاحات و عبارات تخصصی پروژه را بیاموزید',
  },
  {
    icon: <QuestionCircleOutline />,
    color: 'var(--rasagram-theme-link-color)',
    title: 'سؤالات متداول',
    description: 'پاسخ پرسش‌های رایج کاربران را ببینید',
  },
];

export function ProjectOnboarding() {
  const navigate = useNavigate();

  return (
    <div className={styles.wrap}>
      <NavBar onBack={() => bridge.close()}>&nbsp;</NavBar>

      <div className={styles.body}>
        <div className={styles.illustration}>
          <div className={styles.illustrationCircle}>
            <FireFill />
          </div>
        </div>

        <div className={styles.title}>پروژه</div>
        <div className={styles.subtitle}>
          تعریف یک پروژه و درج لیستی از کارها و اختصاص هر کار به یک نفر از اعضا
        </div>

        <div className={styles.items}>
          {ITEMS.map((item) => (
            <button
              key={item.title}
              type="button"
              className={styles.item}
              onClick={() => Toast.show({ content: 'به‌زودی اضافه می‌شود' })}
            >
              <span className={styles.itemIcon} style={{ color: item.color, background: 'var(--rasagram-theme-secondary-bg-color)' }}>
                {item.icon}
              </span>
              <span className={styles.itemText}>
                <div className={styles.itemTitle}>{item.title}</div>
                <div className={styles.itemDescription}>{item.description}</div>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.footer}>
        <Button block color="primary" size="large" onClick={() => navigate('/projects/new')}>
          شروع
        </Button>
      </div>
    </div>
  );
}
