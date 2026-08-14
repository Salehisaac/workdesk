import { Button, DotLoading, Input, Toast } from 'antd-mobile';
import { RightOutline } from 'antd-mobile-icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PickedItem } from '../../../bridge/types';
import { meDisplayName, useMe } from '../../../shared/api/me';
import { toPersianDigits } from '../../../shared/date/jalali';
import { PeoplePicker } from '../../../shared/ui/people/PeoplePicker';
import { useCreateLedger } from '../api';
import styles from './LedgerCreatePage.module.css';

/**
 * Creating a «دفتر مالی» — the same screen a session gets, and now the same
 * ending too.
 *
 * A name and the people, and that is the whole flow: no group is provisioned,
 * unlike a project. What that leaves is the session's problem — with nothing
 * appearing in anyone's chat list, a member who isn't messaged has no way of
 * learning the book exists — so the backend sends each of them a link that opens
 * the mini app on this ledger.
 *
 * Which is why this screen is honest about delivery instead of showing a flat
 * "done": the bot can only DM someone who has already started it, so an invite
 * legitimately fails for a member who never has, and the toast says how many
 * were reached rather than implying all of them were.
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

      // members[] comes back stamped with who the bot actually reached — the
      // owner is in there too and was never messaged, so they're excluded from
      // the count rather than inflating it.
      const invited = ledger.members.filter((member) => member.role !== 'owner');
      const notified = invited.filter((member) => member.notifiedAt).length;
      Toast.show({
        content:
          invited.length === 0
            ? 'دفتر ساخته شد'
            : notified === invited.length
              ? `دفتر ساخته شد و دعوت‌نامه برای ${toPersianDigits(notified)} نفر فرستاده شد`
              : `دفتر ساخته شد؛ دعوت‌نامه برای ${toPersianDigits(notified)} نفر از ${toPersianDigits(invited.length)} نفر فرستاده شد`,
      });
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
            placeholder="نام دفتر"
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
        />
      </div>

      <div className={styles.footer}>
        <Button block color="primary" size="large" loading={submitting} onClick={handleSubmit}>
          ساخت دفتر
        </Button>
      </div>

      {/* One message per member, each a round trip to the Bot API — honest about
          taking a moment, the same way session creation is. */}
      {submitting && (
        <div className={styles.creating} role="status" aria-live="polite">
          <div className={styles.creatingCard}>
            <DotLoading color="primary" />
            <div className={styles.creatingTitle}>در حال ساخت دفتر…</div>
            <div className={styles.creatingBody}>دعوت‌نامه‌ها برای افراد دفتر فرستاده می‌شود.</div>
          </div>
        </div>
      )}
    </div>
  );
}
