import { Popup } from 'antd-mobile';
import { CloseOutline, MinusCircleOutline } from 'antd-mobile-icons';
import type { ReactNode } from 'react';
import styles from './GuideSheet.module.css';

/**
 * The shape every module's guide takes: one sentence of lede, chapters of
 * icon + heading + paragraph, and a plain list of what the version can't do.
 *
 * Extracted from «راهنمای پروژه‌ها» when the meeting repository wanted the same
 * thing. Only the chrome lives here — each module keeps its own text, because
 * the text is the part that has to be true about that module specifically.
 *
 * The «فعلاً ممکن نیست» block is not decoration: a guide that only describes the
 * happy path sends people hunting for buttons that don't exist, so a module
 * without limits to state probably hasn't looked hard enough.
 */

export interface GuideEntry {
  icon: ReactNode;
  title: string;
  body: string;
  /** Rendered under the paragraph — live chips, a legend, whatever shows better than it tells. */
  extra?: ReactNode;
}

export interface GuideChapter {
  title: string;
  entries: GuideEntry[];
}

interface GuideSheetProps {
  visible: boolean;
  onClose: () => void;
  /** «راهنمای پروژه‌ها», «راهنمای مخزن جلسه» … */
  title: string;
  ledeIcon: ReactNode;
  /** The one-sentence answer, for someone who reads no further. */
  lede: ReactNode;
  chapters: GuideChapter[];
  limits: string[];
}

export function GuideSheet({ visible, onClose, title, ledeIcon, lede, chapters, limits }: GuideSheetProps) {
  return (
    <Popup
      visible={visible}
      position="bottom"
      closeOnSwipe
      closeOnMaskClick
      onClose={onClose}
      onMaskClick={onClose}
      bodyStyle={{ borderTopLeftRadius: 12, borderTopRightRadius: 12 }}
      getContainer={() => document.body}
    >
      <div className={styles.sheet}>
        <span className={styles.handle} aria-hidden="true" />

        <div className={styles.head}>
          <button type="button" className={styles.headClose} onClick={onClose} aria-label="بستن">
            <CloseOutline />
          </button>
          <div className={styles.headTitle}>{title}</div>
          <span className={styles.headSpacer} aria-hidden="true" />
        </div>

        <div className={styles.body}>
          <div className={styles.lede}>
            <span className={styles.ledeIcon} aria-hidden="true">
              {ledeIcon}
            </span>
            <p className={styles.ledeText}>{lede}</p>
          </div>

          {chapters.map((chapter) => (
            <section key={chapter.title} className={styles.chapter}>
              <h3 className={styles.chapterTitle}>{chapter.title}</h3>

              <div className={styles.entries}>
                {chapter.entries.map((entry) => (
                  <div key={entry.title} className={styles.entry}>
                    <span className={styles.entryIcon} aria-hidden="true">
                      {entry.icon}
                    </span>
                    <div className={styles.entryText}>
                      <h4 className={styles.entryTitle}>{entry.title}</h4>
                      <p className={styles.entryBody}>{entry.body}</p>
                      {entry.extra}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {limits.length > 0 && (
            <section className={styles.chapter}>
              <h3 className={styles.chapterTitle}>فعلاً ممکن نیست</h3>
              <ul className={styles.limits}>
                {limits.map((limit) => (
                  <li key={limit} className={styles.limit}>
                    <MinusCircleOutline className={styles.limitIcon} aria-hidden="true" />
                    {limit}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </Popup>
  );
}
