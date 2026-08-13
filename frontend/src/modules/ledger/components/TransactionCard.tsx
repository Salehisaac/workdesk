import { DownOutline, UpOutline } from 'antd-mobile-icons';
import type { CSSProperties } from 'react';
import { formatNumericDate } from '../../../shared/date/jalali';
import { monogramGradient, monogramInitial, paletteForSeed } from '../../../shared/brand/monogram';
import { formatToman } from '../money';
import { ACCOUNT_GROUP_LABEL } from '../types';
import type { LedgerTag, LedgerTransaction } from '../types';
// A pure helper that happens to live in the project module because that is
// where the first tag chip was drawn. Imported rather than copied: a tag with
// no colour of its own must derive the SAME colour in both modules, or the two
// screens would disagree about what «فوری» looks like.
import { tagColor } from '../../project/components/job/tagColor';
import styles from './TransactionCard.module.css';

interface TransactionCardProps {
  transaction: LedgerTransaction;
  /** The ledger's whole tag pool — the row carries ids, not names. */
  tags: LedgerTag[];
  onOpen: (transaction: LedgerTransaction) => void;
}

/**
 * One line of the book, as a card.
 *
 * The direction is said three times over — the frame's colour, the arrow, and
 * the sign of the amount — which is deliberate: this is the screen where a
 * reader who can't tell the green frame from the red one still has to be able
 * to tell income from expense at a glance.
 *
 * The account group leads rather than the description, because scanning a
 * ledger is looking for a *kind* of movement («حقوق», «فروش») far more often
 * than for one particular note somebody typed.
 */
export function TransactionCard({ transaction, tags, onOpen }: TransactionCardProps) {
  const income = transaction.type === 'income';
  const cardTags = tags.filter((tag) => transaction.tagIds.includes(tag.id));

  return (
    <button
      type="button"
      className={`${styles.card} ${income ? styles.cardIncome : styles.cardExpense}`}
      onClick={() => onOpen(transaction)}
    >
      <span className={styles.head}>
        <span className={styles.group}>{ACCOUNT_GROUP_LABEL[transaction.accountGroup]}</span>
        <span className={`${styles.amount} ${income ? styles.income : styles.expense}`}>
          {income ? <UpOutline aria-hidden="true" /> : <DownOutline aria-hidden="true" />}
          {formatToman(transaction.amount)}
        </span>
      </span>

      {transaction.description && <span className={styles.description}>{transaction.description}</span>}

      {cardTags.length > 0 && (
        <span className={styles.tags}>
          {cardTags.map((tag) => (
            <span key={tag.id} className={styles.tag} style={{ background: tag.color ?? tagColor(tag.name) } as CSSProperties}>
              {tag.name}
            </span>
          ))}
        </span>
      )}

      <span className={styles.foot}>
        <span className={styles.when}>{formatNumericDate(new Date(transaction.occurredAt))}</span>
        {transaction.sourceName && <span className={styles.source}>{transaction.sourceName}</span>}
        {transaction.assigneeName && (
          <span
            className={styles.avatar}
            style={{ background: monogramGradient(paletteForSeed(transaction.assigneeId ?? transaction.assigneeName)) } as CSSProperties}
            // The name, not the initial: a single letter is not something a
            // screen reader can say anything useful about.
            aria-label={`مسئول: ${transaction.assigneeName}`}
          >
            {monogramInitial(transaction.assigneeName) || '؟'}
          </span>
        )}
      </span>
    </button>
  );
}
