import { Dialog, Toast } from 'antd-mobile';
import {
  AppOutline,
  BillOutline,
  ContentOutline,
  FolderOutline,
  LeftOutline,
  LockOutline,
  TeamOutline,
  UnorderedListOutline,
  UserOutline,
} from 'antd-mobile-icons';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../shared/api/client';
import styles from './HomePage.module.css';

interface MeResponse {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  languageCode: string;
}

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

  async function handleShowMe() {
    try {
      const me = await apiClient.get<MeResponse>('/me');
      Dialog.alert({
        title: 'اطلاعات کاربر (از /api/v1/me)',
        content: (
          <div className={styles.meDialog}>
            <div>
              <b>id:</b> {me.id}
            </div>
            <div>
              <b>firstName:</b> {me.firstName || '—'}
            </div>
            <div>
              <b>lastName:</b> {me.lastName || '—'}
            </div>
            <div>
              <b>username:</b> {me.username || '—'}
            </div>
            <div>
              <b>languageCode:</b> {me.languageCode || '—'}
            </div>
          </div>
        ),
      });
    } catch (error) {
      Toast.show({ content: error instanceof Error ? error.message : 'دریافت اطلاعات کاربر با خطا مواجه شد' });
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.brand}>
          <div className={styles.brandTitle}>ورک‌دسک</div>
          <div className={styles.brandSubtitle}>ابزارهای کاری در دل مسنجر</div>
        </div>
        <div className={styles.headerActions}>
          <button type="button" className={styles.iconButton} onClick={handleShowMe} aria-label="نمایش اطلاعات کاربر">
            <UserOutline />
          </button>
          <div className={styles.logo}>
            <AppOutline />
          </div>
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
