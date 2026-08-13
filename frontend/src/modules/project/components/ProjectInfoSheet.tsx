import { Popup, Toast } from 'antd-mobile';
import {
  CalendarOutline,
  CheckCircleOutline,
  CloseOutline,
  ContentOutline,
  LeftOutline,
  LockOutline,
  MessageOutline,
  PieOutline,
  TagOutline,
  UnorderedListOutline,
} from 'antd-mobile-icons';
import type { ReactNode } from 'react';
import { formatLongDate, toPersianDigits } from '../../../shared/date/jalali';
import { openProjectTopic } from '../links';
import type { ReportStats } from '../report';
import { JOB_STATUS_LABEL, JOB_STATUSES } from '../types';
import type { ProjectDetail } from '../types';
import { STATUS_ICON } from './statusIcon';
import styles from './ProjectInfoSheet.module.css';

/** Past this the chips stop being a roster and start being a wall. */
const MAX_VISIBLE_MEMBERS = 12;

interface GuideEntry {
  icon: ReactNode;
  title: string;
  body: string;
  /** The status entry shows the six chips instead of naming them in prose. */
  chips?: boolean;
}

/**
 * What this project actually *is*, written against how the app really behaves —
 * lists really are forum topics, tags really are project-scoped, `dueAt` really
 * is the only date in the hierarchy. Every claim here is checkable in the code
 * it describes; if one of these stops being true, this copy is wrong and has to
 * move with it.
 */
const GUIDE: GuideEntry[] = [
  {
    icon: <UnorderedListOutline />,
    title: 'لیست‌ها',
    body: 'هر لیست، یک موضوع در گفتگوی گروهی همین پروژه است. وقتی لیستی می‌سازید، موضوع آن هم در گروه ساخته می‌شود و گفتگوی آن بخش همان‌جا ادامه پیدا می‌کند. صفحه‌ی پروژه با کشیدن انگشت بین لیست‌ها جابه‌جا می‌شود.',
  },
  {
    icon: <ContentOutline />,
    title: 'کارها',
    body: 'هر کار داخل یک لیست قرار می‌گیرد و می‌تواند مسئول، برچسب، چک‌لیست و سررسید داشته باشد. برای جابه‌جایی یک کار بین لیست‌ها، کافی است بازش کنید و لیستش را عوض کنید.',
  },
  {
    icon: <CheckCircleOutline />,
    title: 'وضعیت کار',
    body: 'هر کار یکی از این شش وضعیت را دارد. مربع رنگی گوشه‌ی هر کارت، همین وضعیت را نشان می‌دهد.',
    chips: true,
  },
  {
    icon: <CalendarOutline />,
    title: 'سررسید',
    body: 'سررسید تنها تاریخ موجود در پروژه است و روی خودِ کار می‌نشیند، نه روی لیست یا پروژه. کارهای سررسیددار در تقویم صفحه‌ی اصلی هم دیده می‌شوند. کاری که سررسیدش گذشته و هنوز بسته نشده، «معوق» شمرده می‌شود.',
  },
  {
    icon: <TagOutline />,
    title: 'برچسب‌ها',
    body: 'برچسب‌ها به کل پروژه تعلق دارند، نه به یک لیست. برچسبی که روی یک کار ساخته شود، بعد از آن برای کارهای همه‌ی لیست‌های همین پروژه هم در دسترس است.',
  },
  {
    icon: <PieOutline />,
    title: 'گزارش',
    body: 'دکمه‌ی «گزارش» در بالای صفحه، پیشرفت پروژه را بر اساس وضعیت کارها، زمان‌بندی، افراد و برچسب‌ها نشان می‌دهد. نوار سبز کنار همان دکمه هم درصد کارهای انجام‌شده است.',
  },
];

interface ProjectInfoSheetProps {
  visible: boolean;
  project: ProjectDetail;
  /** Null until the jobs land — the counters wait rather than show a wrong zero. */
  stats: ReportStats | null;
  onClose: () => void;
  onOpenReport: () => void;
}

/**
 * The project's «درباره» sheet: what it is, what you can do with it, and how the
 * thing works. One surface rather than three, because all three answer the same
 * question — "what am I looking at?" — and none of them alone is worth a screen.
 */
export function ProjectInfoSheet({ visible, project, stats, onClose, onOpenReport }: ProjectInfoSheetProps) {
  const members = project.members ?? [];
  const visibleMembers = members.slice(0, MAX_VISIBLE_MEMBERS);
  const hiddenMembers = members.length - visibleMembers.length;

  // Same fallback chain the board's «فعالیت‌ها» uses — an old client and a
  // project with no group are different failures and get different words.
  function handleOpenChat() {
    if (openProjectTopic(project.chatId)) return;
    Toast.show({
      content: project.chatId
        ? 'نسخه‌ی رساگرام شما از باز کردن گفتگو پشتیبانی نمی‌کند'
        : 'گفتگوی این پروژه در دسترس نیست',
    });
  }

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
          <div className={styles.headTitle}>درباره‌ی پروژه</div>
          <span className={styles.headSpacer} aria-hidden="true" />
        </div>

        <div className={styles.body}>
          <div className={styles.identity}>
            {project.avatarUrl ? (
              <img className={styles.avatar} src={project.avatarUrl} alt="" />
            ) : (
              <span className={styles.avatar} aria-hidden="true">
                {project.name.trim().charAt(0) || '؟'}
              </span>
            )}

            <div className={styles.identityText}>
              <span className={styles.name}>{project.name}</span>
              <div className={styles.badges}>
                <span className={styles.badge}>
                  <LockOutline className={styles.badgeIcon} />
                  {project.visibility === 'public' ? 'عمومی' : 'خصوصی'}
                </span>
                <span className={styles.badge}>
                  <CalendarOutline className={styles.badgeIcon} />
                  ساخته شده در {formatLongDate(new Date(project.createdAt))}
                </span>
              </div>
            </div>
          </div>

          <div className={styles.facts}>
            <div className={styles.fact}>
              <span className={styles.factValue}>{toPersianDigits(project.memberCount)}</span>
              <span className={styles.factLabel}>عضو</span>
            </div>
            <div className={styles.fact}>
              <span className={styles.factValue}>{toPersianDigits(project.lists?.length ?? 0)}</span>
              <span className={styles.factLabel}>لیست</span>
            </div>
            <div className={styles.fact}>
              <span className={styles.factValue}>{stats ? toPersianDigits(stats.total) : '—'}</span>
              <span className={styles.factLabel}>کار</span>
            </div>
            <div className={styles.fact}>
              <span className={styles.factValue}>{stats ? `٪${toPersianDigits(stats.completion)}` : '—'}</span>
              <span className={styles.factLabel}>انجام شده</span>
            </div>
          </div>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>گزینه‌ها</h3>

            <button type="button" className={styles.option} onClick={handleOpenChat}>
              <span className={styles.optionIcon} aria-hidden="true">
                <MessageOutline />
              </span>
              <span className={styles.optionText}>
                <span className={styles.optionTitle}>باز کردن گفتگوی پروژه</span>
                <span className={styles.optionHint}>گروهی که هر لیست، یک موضوع در آن است</span>
              </span>
              <LeftOutline className={styles.optionChevron} aria-hidden="true" />
            </button>

            <button
              type="button"
              className={styles.option}
              onClick={() => {
                onClose();
                onOpenReport();
              }}
            >
              <span className={styles.optionIcon} aria-hidden="true">
                <PieOutline />
              </span>
              <span className={styles.optionText}>
                <span className={styles.optionTitle}>گزارش پروژه</span>
                <span className={styles.optionHint}>پیشرفت بر اساس وضعیت، زمان، افراد و برچسب‌ها</span>
              </span>
              <LeftOutline className={styles.optionChevron} aria-hidden="true" />
            </button>
          </section>

          {members.length > 0 && (
            <section className={styles.section}>
              {/* No count in the heading: a lone digit after a «·» sits
                  ambiguously against RTL text, and the facts grid above already
                  states it. */}
              <h3 className={styles.sectionTitle}>اعضا</h3>
              <div className={styles.members}>
                {visibleMembers.map((member) => (
                  <span key={member.id} className={styles.member}>
                    <span className={styles.memberAvatar} aria-hidden="true">
                      {member.displayName.trim().charAt(0) || '؟'}
                    </span>
                    {member.displayName}
                  </span>
                ))}
                {hiddenMembers > 0 && (
                  <span className={styles.member}>+{toPersianDigits(hiddenMembers)} نفر دیگر</span>
                )}
              </div>
            </section>
          )}

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>راهنما</h3>
            <div className={styles.guide}>
              {GUIDE.map((entry) => (
                <div key={entry.title} className={styles.guideItem}>
                  <span className={styles.guideIcon} aria-hidden="true">
                    {entry.icon}
                  </span>
                  <div className={styles.guideText}>
                    <h4 className={styles.guideTitle}>{entry.title}</h4>
                    <p className={styles.guideBody}>{entry.body}</p>

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
        </div>
      </div>
    </Popup>
  );
}
