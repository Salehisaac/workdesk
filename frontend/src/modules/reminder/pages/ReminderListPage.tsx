import { Button, DotLoading, NavBar } from 'antd-mobile';
import { AddOutline, BellOutline, CheckCircleOutline, ExclamationCircleOutline } from 'antd-mobile-icons';
import { useNavigate } from 'react-router-dom';
import { formatLongDate, formatTime } from '../../../shared/date/jalali';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { useReminders } from '../api';
import styles from './ReminderListPage.module.css';

export function ReminderListPage() {
  const navigate = useNavigate();
  const { data: reminders, isLoading, isError } = useReminders();

  return (
    <div className={styles.page}>
      <NavBar onBack={() => navigate('/')}>یادآورها</NavBar>

      <div className={styles.body}>
        {isLoading && <EmptyState icon={<DotLoading />} title="در حال بارگذاری…" />}

        {isError && (
          <EmptyState
            icon={<ExclamationCircleOutline />}
            title="ارتباط برقرار نشد"
            description="بارگذاری یادآورها با خطا مواجه شد. دوباره تلاش کنید."
          />
        )}

        {!isLoading && !isError && (reminders?.length ?? 0) === 0 && (
          <EmptyState
            icon={<BellOutline />}
            title="هنوز یادآوری ندارید"
            description="یادآور بسازید تا در زمان مقرر به پیام‌های خصوصی شما فرستاده شود."
            action={
              <Button color="primary" onClick={() => navigate('/reminders/new')}>
                یادآور جدید
              </Button>
            }
          />
        )}

        {!isLoading && !isError && (reminders?.length ?? 0) > 0 && (
          <div className={styles.list}>
            {reminders!.map((reminder) => {
              const when = reminder.remindAt ? new Date(reminder.remindAt) : null;
              return (
                <article key={reminder.id} className={styles.card}>
                  <div className={styles.cardTop}>
                    <h3 className={styles.title}>{reminder.title}</h3>
                    {/* Whether the bot actually reached the user's chat — the
                        one thing about a reminder they can't otherwise tell. */}
                    {reminder.notifiedAt && (
                      <span className={styles.sent} title="به پیام‌های شما ارسال شد">
                        <CheckCircleOutline />
                      </span>
                    )}
                  </div>
                  {reminder.note && <p className={styles.note}>{reminder.note}</p>}
                  {when && (
                    <div className={styles.when}>
                      {formatLongDate(when)}، ساعت {formatTime(when)}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <Button block color="primary" size="large" onClick={() => navigate('/reminders/new')}>
          <AddOutline /> یادآور جدید
        </Button>
      </div>
    </div>
  );
}
