import { Popup } from 'antd-mobile';
import {
  AddCircleOutline,
  AppOutline,
  CalendarOutline,
  CheckCircleOutline,
  CloseOutline,
  ContentOutline,
  MessageOutline,
  MinusCircleOutline,
  PieOutline,
  TagOutline,
  UnorderedListOutline,
  UserAddOutline,
} from 'antd-mobile-icons';
import type { ReactNode } from 'react';
import { JOB_STATUS_LABEL, JOB_STATUSES } from '../types';
import { STATUS_ICON } from './statusIcon';
import styles from './ProjectsGuideSheet.module.css';

interface GuideEntry {
  icon: ReactNode;
  title: string;
  body: string;
  /** The status entry renders the six live chips instead of naming them. */
  chips?: boolean;
}

interface GuideChapter {
  title: string;
  entries: GuideEntry[];
}

/**
 * The guide to the *service*, not to whichever project happens to be open —
 * same text from the project list and from inside a board, because what it
 * explains is the same either way.
 *
 * Every claim is written against what the code and API_CONTRACT.md actually do,
 * including the parts that are unflattering: creating a project really does
 * create a Rasagram group, members really are fixed at creation, a job really
 * can't be deleted. A guide that only describes the happy path sends people
 * hunting for buttons that don't exist, which is worse than saying so.
 */
const CHAPTERS: GuideChapter[] = [
  {
    title: 'شروع',
    entries: [
      {
        icon: <AppOutline />,
        title: 'پروژه چیست؟',
        body: 'هر پروژه در «همکار»، یک گروه واقعی در رساگرام است. وقتی پروژه‌ای می‌سازید، گروهی با همان نام و همان تصویر ساخته می‌شود، موضوع‌ها (Topics) در آن فعال می‌شود و افرادی که انتخاب کرده‌اید به آن اضافه می‌شوند. یعنی پروژه‌ی شما هم تخته‌ی کارهاست و هم محل گفتگوی تیم — نه دو جای جدا.',
      },
      {
        icon: <AddCircleOutline />,
        title: 'ساختن پروژه',
        body: 'از فهرست پروژه‌ها، «پروژه جدید» را بزنید. در گام اول نام و (اختیاری) تصویر پروژه را می‌دهید؛ همان تصویر، عکس گروه هم می‌شود. در گام دوم اعضا را از میان مخاطبان و کاربران انتخاب می‌کنید. با تأیید، گروه ساخته می‌شود و پروژه در فهرست شما ظاهر می‌شود.',
      },
      {
        icon: <UserAddOutline />,
        title: 'اعضا',
        body: 'اعضا هنگام ساخت پروژه انتخاب می‌شوند و سازنده‌ی پروژه، مالک آن است. هر عضو می‌تواند لیست و کار بسازد و کارها را به دیگران بسپارد. فهرست کامل اعضا را در گزارش پروژه، بخش «کارها بر اساس افراد»، همراه با سهم هرکس می‌بینید.',
      },
    ],
  },
  {
    title: 'ساختار کار',
    entries: [
      {
        icon: <UnorderedListOutline />,
        title: 'لیست‌ها',
        body: 'کارهای هر پروژه در لیست‌ها دسته‌بندی می‌شوند و هر لیست، یک موضوع در گفتگوی گروهی همان پروژه است. با ساختن لیست، موضوع آن هم در گروه ساخته می‌شود؛ می‌توانید برایش نام، شکلک و رنگ انتخاب کنید. صفحه‌ی پروژه با کشیدن انگشت بین لیست‌ها جابه‌جا می‌شود.',
      },
      {
        icon: <ContentOutline />,
        title: 'کارها',
        body: 'کار، کوچک‌ترین واحد پروژه است و داخل یک لیست قرار می‌گیرد. هر کار می‌تواند شرح، مسئول (یک یا چند نفر)، برچسب، چک‌لیست و سررسید داشته باشد. برای جابه‌جایی یک کار بین لیست‌ها، بازش کنید و لیستش را عوض کنید.',
      },
      {
        icon: <CheckCircleOutline />,
        title: 'وضعیت کار',
        body: 'هر کار همیشه یکی از این شش وضعیت را دارد و از «آغاز نشده» شروع می‌کند. مربع رنگی گوشه‌ی هر کارت، همین وضعیت را نشان می‌دهد.',
        chips: true,
      },
      {
        icon: <TagOutline />,
        title: 'برچسب‌ها',
        body: 'برچسب‌ها به کل پروژه تعلق دارند، نه به یک لیست. برچسبی که روی یک کار بسازید، از آن پس برای کارهای همه‌ی لیست‌های همان پروژه هم در دسترس است. اگر برای برچسبی رنگی انتخاب نکنید، رنگ ثابتی از روی نامش انتخاب می‌شود تا همه‌جا یکسان دیده شود.',
      },
      {
        icon: <CalendarOutline />,
        title: 'سررسید و تقویم',
        body: 'سررسید تنها تاریخ موجود در این ساختار است و روی خودِ کار می‌نشیند، نه روی لیست یا پروژه. کارهای سررسیددار — از همه‌ی پروژه‌ها — در تقویم شمسی صفحه‌ی اصلی هم دیده می‌شوند. کاری که سررسیدش گذشته و هنوز بسته نشده، «معوق» شمرده می‌شود.',
      },
    ],
  },
  {
    title: 'پیگیری',
    entries: [
      {
        icon: <PieOutline />,
        title: 'گزارش پروژه',
        body: 'دکمه‌ی «گزارش» در بالای صفحه‌ی هر پروژه، وضعیت آن را از چهار زاویه نشان می‌دهد: سهم هر وضعیت از کل کارها، زمان‌بندی (کارهای معوق، نزدیک‌ترین سررسید و پایان کارهای باز)، سهم هر فرد، و سهم هر برچسب. نوار سبز کنار همان دکمه هم درصد کارهای انجام‌شده است.',
      },
      {
        icon: <MessageOutline />,
        title: 'گفتگو و پیگیری روزانه',
        body: 'تاریخچه‌ی گفتگوی هر بخش، در موضوع همان لیست داخل گروه پروژه است. دکمه‌ی «فعالیت‌ها» در پایین صفحه، شما را به گفتگوی همان لیستی می‌برد که رویش هستید — پس بحث درباره‌ی کارها همان‌جا در رساگرام ادامه پیدا می‌کند.',
      },
    ],
  },
];

/** Boundaries of this version — stated so nobody hunts for a missing button. */
const LIMITS = [
  'بعد از ساخت پروژه، عضو جدیدی به آن اضافه نمی‌شود؛ اعضا را پیش از تأیید انتخاب کنید.',
  'پروژه پس از ساخته‌شدن ویرایش یا حذف نمی‌شود. (لیست‌ها را می‌توانید حذف کنید.)',
  'کار را می‌توانید ویرایش کنید، اما حذف کار هنوز ممکن نیست.',
  'همه‌ی پروژه‌ها خصوصی‌اند و لینک عضویت عمومی ندارند.',
];

interface ProjectsGuideSheetProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * «راهنمای پروژه‌ها» — what the service is, how it fits together, and what it
 * can't do yet. Takes no project: it is reachable from the project list before
 * the user has opened anything, and must read the same from both places.
 */
export function ProjectsGuideSheet({ visible, onClose }: ProjectsGuideSheetProps) {
  return (
    <Popup
      visible={visible}
      position="bottom"
      closeOnSwipe
      closeOnMaskClick
      onClose={onClose}
      onMaskClick={onClose}
      bodyStyle={{ borderTopLeftRadius: 12, borderTopRightRadius: 12 }}
    >
      <div className={styles.sheet}>
        <span className={styles.handle} aria-hidden="true" />

        <div className={styles.head}>
          <button type="button" className={styles.headClose} onClick={onClose} aria-label="بستن">
            <CloseOutline />
          </button>
          <div className={styles.headTitle}>راهنمای پروژه‌ها</div>
          <span className={styles.headSpacer} aria-hidden="true" />
        </div>

        <div className={styles.body}>
          {/* One sentence before any of the detail — someone who reads only this
              much should already know what they're looking at. */}
          <div className={styles.lede}>
            <span className={styles.ledeIcon} aria-hidden="true">
              <AppOutline />
            </span>
            <p className={styles.ledeText}>
              «پروژه‌ها» جایی است که کارهای تیمی‌تان را کنار همان گفتگویی که درباره‌شان دارید نگه می‌دارید:
              هر پروژه یک گروه در رساگرام است، هر لیست یک موضوع در آن گروه، و هر کار یک ردیف با مسئول،
              برچسب و سررسید.
            </p>
          </div>

          {CHAPTERS.map((chapter) => (
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

                      {entry.chips && (
                        <div className={styles.statusChips}>
                          {JOB_STATUSES.map((status) => (
                            <span key={status} className={styles.statusChip} data-status={status}>
                              <span className={styles.statusChipIcon}>{STATUS_ICON[status]}</span>
                              {JOB_STATUS_LABEL[status]}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          <section className={styles.chapter}>
            <h3 className={styles.chapterTitle}>فعلاً ممکن نیست</h3>
            <ul className={styles.limits}>
              {LIMITS.map((limit) => (
                <li key={limit} className={styles.limit}>
                  <MinusCircleOutline className={styles.limitIcon} aria-hidden="true" />
                  {limit}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </Popup>
  );
}
