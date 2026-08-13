import { Button, Input, Toast } from 'antd-mobile';
import { InformationCircleOutline, RightOutline } from 'antd-mobile-icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PickedItem } from '../../../bridge/types';
import { meDisplayName, useMe } from '../../../shared/api/me';
import { PeoplePicker } from '../../../shared/ui/people/PeoplePicker';
import { useCreateLedger } from '../api';
import styles from './LedgerCreatePage.module.css';

/**
 * Creating a «دفتر مالی» — the same screen a session gets, minus the one thing
 * a session has.
 *
 * A name and the people, and that is the whole flow: no group is provisioned
 * (unlike a project) and no invite goes out (unlike a session). A ledger is not
 * an event, so there is no moment anyone needs summoning to — the people picked
 * here simply find the book waiting in their own «دفتر مالی» list. The note at
 * the bottom says so, because two of the three modules that open this screen do
 * send something, and silence would otherwise read as a failure.
 */
export function LedgerCreatePage() {
  const navigate = useNavigate();
  const me = useMe();
  const createLedger = useCreateLedger();

  const [name, setName] = useState('');
  const [members, setMembers] = useState<PickedItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (submitting) return;

    const trimmed = name.trim();
    if (!trimmed) {
      Toast.show({ content: 'نام دفتر را وارد کنید' });
      return;
    }

    // No "are you sure it's empty?" question here, unlike the session screen:
    // a ledger with nobody else in it is an ordinary personal cash book, not a
    // meeting nobody was invited to.
    setSubmitting(true);
    try {
      const ledger = await createLedger.mutateAsync({ name: trimmed, members });
      Toast.show({ content: 'دفتر ساخته شد' });
      navigate(`/ledgers/${ledger.id}`, { replace: true });
    } catch (error) {
      Toast.show({ content: error instanceof Error ? error.message : 'ساخت دفتر با خطا مواجه شد' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={() => navigate(-1)} aria-label="بازگشت">
          <RightOutline />
        </button>
        <h1 className={styles.headerTitle}>دفتر مالی تازه</h1>
        <span className={styles.headerSpacer} aria-hidden="true" />
      </header>

      <div className={styles.body}>
        <section className={styles.card}>
          <Input
            className={styles.nameInput}
            placeholder="نام دفتر (مثلاً: فروشگاه مرکزی)"
            value={name}
            onChange={setName}
            maxLength={120}
          />
        </section>

        <PeoplePicker
          members={members}
          ownerName={meDisplayName(me.data)}
          onChange={setMembers}
          title="افراد دفتر"
          ownerRoleLabel="سازنده"
          hint="افراد دفتر فقط همین حالا انتخاب می‌شوند؛ پس از ساخت، کسی به آن اضافه نمی‌شود."
        />

        <p className={styles.note}>
          <InformationCircleOutline className={styles.noteIcon} aria-hidden="true" />
          برای دفتر مالی نه گروهی ساخته می‌شود و نه پیامی فرستاده می‌شود؛ افراد انتخاب‌شده این دفتر را در فهرست دفترهای
          خودشان می‌بینند و می‌توانند در آن تراکنش ثبت کنند.
        </p>
      </div>

      <div className={styles.footer}>
        <Button block color="primary" size="large" loading={submitting} onClick={handleSubmit}>
          ساخت دفتر
        </Button>
      </div>
    </div>
  );
}
