import {
  AddCircleOutline,
  CalendarOutline,
  CheckCircleOutline,
  ClockCircleOutline,
  LinkOutline,
  SendOutline,
  TeamOutline,
  UnorderedListOutline,
} from 'antd-mobile-icons';
import { GuideSheet } from '../../../shared/ui/guide/GuideSheet';
import type { GuideChapter } from '../../../shared/ui/guide/GuideSheet';
import { DECISION_STATUS_LABEL, DECISION_STATUSES, SESSION_STATUS_LABEL, SESSION_STATUSES } from '../types';
import styles from './MeetingGuideSheet.module.css';

/** The four session states, shown rather than named — same trick the job guide plays. */
const SESSION_CHIPS = (
  <div className={styles.chips}>
    {SESSION_STATUSES.map((status) => (
      <span key={status} className={styles.chip} data-status={status}>
        {SESSION_STATUS_LABEL[status]}
      </span>
    ))}
  </div>
);

const DECISION_CHIPS = (
  <div className={styles.chips}>
    {DECISION_STATUSES.map((status) => (
      <span key={status} className={styles.chip} data-decision={status}>
        {DECISION_STATUS_LABEL[status]}
      </span>
    ))}
  </div>
);

/**
 * The guide to «مخزن جلسه», written against what the module actually does —
 * including the parts that are unflattering (an invite can silently fail to
 * reach someone, nothing about a meeting is editable afterwards).
 */
const CHAPTERS: GuideChapter[] = [
  {
    title: 'شروع',
    entries: [
      {
        icon: <TeamOutline />,
        title: 'جلسه چیست؟',
        body: 'جلسه، برخلاف پروژه، گروهی در رساگرام نمی‌سازد. به‌جایش برای هر شرکت‌کننده پیامی از سوی ربات فرستاده می‌شود که زمان و نشانی جلسه در آن است و با زدنش، همین برنامه روی صفحه‌ی همان جلسه باز می‌شود. پس آن پیام، هم دعوت‌نامه است و هم تنها راه اطلاع‌رسانی.',
      },
      {
        icon: <AddCircleOutline />,
        title: 'ساختن جلسه',
        body: 'از «مخزن جلسه»، «جلسه جدید» را بزنید. زمان جلسه از ابتدا روی «همین حالا» است و با زدن روی آن، تقویم شمسی و سپس ساعت باز می‌شود. جلسه یا حضوری است یا آنلاین؛ برای جلسه‌ی آنلاین می‌توانید نشانی (لینک) اتاق را هم بگذارید تا در دعوت‌نامه فرستاده شود.',
      },
      {
        icon: <SendOutline />,
        title: 'دعوت‌نامه‌ها',
        body: 'ربات فقط با کسی می‌تواند گفتگو را آغاز کند که پیش‌تر خودش رباتی را استارت کرده باشد. اگر کسی این کار را نکرده باشد، دعوت‌نامه‌اش نمی‌رسد — و صفحه‌ی جلسه دقیقاً همین را می‌گوید تا نشانی جلسه را دستی برایش بفرستید.',
      },
    ],
  },
  {
    title: 'داخل جلسه',
    entries: [
      {
        icon: <UnorderedListOutline />,
        title: 'دستور جلسه',
        body: 'دستورهای جلسه، فهرست چیزهایی است که قرار است در جلسه به آن‌ها پرداخته شود، به‌ترتیب. هر دستور می‌تواند شرح، «مدت زمان» و «مسئول اجرایی» داشته باشد. مدت زمان، سهم آن دستور از وقت جلسه است؛ جمع‌شان به شما می‌گوید دو ساعت کار در جلسه‌ی یک‌ساعته گذاشته‌اید یا نه.',
      },
      {
        icon: <CheckCircleOutline />,
        title: 'مصوبه',
        body: 'مصوبه، تعهدی است که از جلسه بیرون می‌آید: یک جمله، یک مسئول و یک سررسید. می‌توانید مشخص کنید از کدام دستور جلسه درآمده تا بعدها معلوم باشد سر چه بحثی به آن رسیده‌اید. تفاوتش با دستور جلسه همین است — دستور جلسه وقتِ داخل جلسه را می‌گیرد، مصوبه به تقویم بعد از جلسه می‌رود.',
      },
      {
        icon: <ClockCircleOutline />,
        title: 'وضعیت‌ها',
        body: 'جلسه یکی از این چهار وضعیت را دارد و از «آغاز نشده» شروع می‌کند؛ در صفحه‌ی جلسه با یک زدن عوض می‌شود. مصوبه‌ها هم سه وضعیت دارند و با زدن دایره‌ی کنارشان بین «در انتظار اجرا» و «انجام شد» جابه‌جا می‌شوند.',
        extra: (
          <>
            {SESSION_CHIPS}
            {DECISION_CHIPS}
          </>
        ),
      },
    ],
  },
  {
    title: 'پیگیری',
    entries: [
      {
        icon: <CalendarOutline />,
        title: 'تقویم و فهرست‌ها',
        body: 'جلسه‌ها روی زمان برگزاری‌شان و مصوبه‌ها روی سررسیدشان، در تقویم شمسی صفحه‌ی اصلی دیده می‌شوند. در «مخزن جلسه» هم دو زبانه دارید: «جلسات» که پیش‌رو و برگزارشده را جدا نشان می‌دهد، و «مصوبات» که همه‌ی مصوبه‌های همه‌ی جلسه‌ها را کنار هم می‌آورد. هر دو را می‌توانید بر اساس وضعیت فیلتر کنید.',
      },
      {
        icon: <LinkOutline />,
        title: 'جلسه‌ی آنلاین',
        body: 'اگر برای جلسه‌ی آنلاین نشانی گذاشته باشید، هم در دعوت‌نامه فرستاده می‌شود و هم در صفحه‌ی جلسه دکمه‌ای می‌شود که آن را در مرورگر باز می‌کند.',
      },
    ],
  },
];

/** Boundaries of this version — stated so nobody hunts for a missing button. */
const LIMITS = [
  'بعد از ساخت جلسه، شرکت‌کننده‌ی تازه‌ای اضافه نمی‌شود؛ افراد را پیش از تأیید انتخاب کنید.',
  'عنوان، زمان و مکان جلسه پس از ساخت ویرایش نمی‌شوند — دعوت‌نامه‌ها با همان اطلاعات رفته‌اند و برگشتی ندارند. فقط وضعیت جلسه تغییر می‌کند.',
  'دستور جلسه و مصوبه پس از ثبت ویرایش یا حذف نمی‌شوند؛ از مصوبه فقط وضعیتش تغییر می‌کند.',
  'افزودن فایل به جلسه، دستور جلسه یا مصوبه هنوز ممکن نیست.',
  'دعوت‌نامه‌ی نرسیده دوباره فرستاده نمی‌شود؛ تا وقتی طرف مقابل ربات را استارت نکند، تلاش دوباره هم به همان دلیل شکست می‌خورد.',
];

interface MeetingGuideSheetProps {
  visible: boolean;
  onClose: () => void;
}

/** «راهنمای مخزن جلسه» — reachable from the module's front door, like the projects one. */
export function MeetingGuideSheet({ visible, onClose }: MeetingGuideSheetProps) {
  return (
    <GuideSheet
      visible={visible}
      onClose={onClose}
      title="راهنمای مخزن جلسه"
      ledeIcon={<TeamOutline />}
      lede="«مخزن جلسه» جایی است که جلسه‌هایتان را می‌سازید و دعوت‌نامه‌شان مستقیم به شرکت‌کنندگان می‌رسد: هر جلسه دستور جلسه دارد (چه چیزهایی قرار است بررسی شود) و مصوبه (چه چیزی تصویب شد، به عهده‌ی چه کسی، تا چه تاریخی)."
      chapters={CHAPTERS}
      limits={LIMITS}
    />
  );
}
