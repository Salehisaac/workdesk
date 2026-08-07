import { Toast } from 'antd-mobile';
import {
  AppOutline,
  BillOutline,
  ContentOutline,
  FolderOutline,
  LeftOutline,
  LockOutline,
  TeamOutline,
  UnorderedListOutline,
} from 'antd-mobile-icons';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './HomePage.module.css';

interface Tile {
  icon: ReactNode;
  label: string;
  to?: string; // undefined = not built yet, shows a lock badge + "coming soon"
}

// The 5 middle-row WorkDesk modules from Balonet's original create-menu
// (فرم/دفترمالی/پروژه/کارگروه/مخزن‌جلسه) — only Project exists so far, per
// the plan's explicit v1 scoping. The rest are here so the hub reflects
// WorkDesk's real shape, not just what's built; locked the same way the
// Mayno reference locks not-yet-available features.
const TILES: Tile[] = [
  { icon: <ContentOutline />, label: 'فرم' },
  { icon: <BillOutline />, label: 'دفترمالی' },
  { icon: <UnorderedListOutline />, label: 'پروژه', to: '/projects' },
  { icon: <TeamOutline />, label: 'کارگروه' },
  { icon: <FolderOutline />, label: 'مخزن‌جلسه' },
];

export function HomePage() {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.brandTitle}>ورک‌دسک</div>
          <div className={styles.brandSubtitle}>ابزارهای کاری در دل مسنجر</div>
        </div>
        <div className={styles.logo}>
          <AppOutline />
        </div>
      </div>

      <div className={styles.hero}>
        <div className={styles.heroTitle}>پروژه‌های خود را مدیریت کنید</div>
        <div className={styles.heroSubtitle}>
          یک پروژه بسازید، کارها را در لیست دسته‌بندی کنید و هرکدام را به یکی از اعضا بسپارید.
        </div>
        <button type="button" className={styles.heroButton} onClick={() => navigate('/projects')}>
          <LeftOutline />
          مشاهده پروژه‌ها
        </button>
      </div>

      <div className={styles.sectionLabel}>همه ابزارها</div>
      <div className={styles.grid}>
        {TILES.map((tile) => (
          <button
            key={tile.label}
            type="button"
            className={`${styles.tile} ${tile.to ? '' : styles.tileLocked}`}
            onClick={() => (tile.to ? navigate(tile.to) : Toast.show({ content: 'به‌زودی اضافه می‌شود' }))}
          >
            <span className={styles.tileCard}>
              {tile.icon}
              {!tile.to && (
                <span className={styles.lockBadge}>
                  <LockOutline />
                </span>
              )}
            </span>
            <span className={styles.tileLabel}>{tile.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
