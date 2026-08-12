import { Dialog, Toast } from 'antd-mobile';
import { AppOutline, UserOutline } from 'antd-mobile-icons';
import { apiClient } from '../../shared/api/client';
import styles from './HomeHeader.module.css';

interface MeResponse {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  languageCode: string;
}

/**
 * The home page's own header. Unchanged in function from before the dashboard
 * redesign — brand, the /me diagnostic (the one thing that proves the auth
 * guard end-to-end from the UI), and the app mark — just laid out tighter so
 * the calendar sits near the top of the screen where it belongs.
 */
export function HomeHeader() {
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
    <header className={styles.header}>
      <div className={styles.brand}>
        <span className={styles.logo}>
          <AppOutline />
        </span>
        <span className={styles.brandText}>
          <span className={styles.brandTitle}>همکار</span>
          <span className={styles.brandSubtitle}>ابزارهای کاری در دل مسنجر</span>
        </span>
      </div>

      <button type="button" className={styles.iconButton} onClick={handleShowMe} aria-label="نمایش اطلاعات کاربر">
        <UserOutline />
      </button>
    </header>
  );
}
