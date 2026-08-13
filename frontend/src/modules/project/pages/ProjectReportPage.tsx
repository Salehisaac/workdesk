import { DotLoading, NavBar, SearchBar } from 'antd-mobile';
import {
  CalendarOutline,
  CheckCircleOutline,
  ClockCircleOutline,
  ExclamationCircleOutline,
  HistogramOutline,
  PieOutline,
  TagOutline,
  TeamOutline,
} from 'antd-mobile-icons';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toPersianDigits } from '../../../shared/date/jalali';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { useProjectReport } from '../api';
import { describeDue, describeGap } from '../components/report/copy';
import { GroupRow } from '../components/report/GroupRow';
import { ReportSection } from '../components/report/ReportSection';
import { StatusBreakdown } from '../components/report/StatusBreakdown';
import styles from './ProjectReportPage.module.css';

/** Below this the list is short enough to scan; a search box would just be chrome. */
const SEARCH_THRESHOLD = 5;

export function ProjectReportPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { report, project, isLoading, isError } = useProjectReport(projectId);
  const [memberQuery, setMemberQuery] = useState('');

  const members = report?.byMember ?? [];
  const visibleMembers = useMemo(() => {
    const query = memberQuery.trim();
    if (!query) return members;
    return members.filter((group) => group.name.includes(query));
  }, [members, memberQuery]);

  const back = () => navigate(`/projects/${projectId}`);

  if (isError) {
    return (
      <div className={styles.page}>
        <NavBar onBack={back}>گزارش پروژه</NavBar>
        <div className={styles.fill}>
          <EmptyState
            icon={<ExclamationCircleOutline />}
            title="ارتباط برقرار نشد"
            description="بارگذاری گزارش این پروژه با خطا مواجه شد. دوباره تلاش کنید."
          />
        </div>
      </div>
    );
  }

  if (isLoading || !report || !project) {
    return (
      <div className={styles.page}>
        <NavBar onBack={back}>گزارش پروژه</NavBar>
        <div className={styles.fill}>
          <EmptyState icon={<DotLoading />} title="در حال بارگذاری…" />
        </div>
      </div>
    );
  }

  const { overall, timeline } = report;

  // Nothing to report on yet — six zeroed bars and a «٪۰» would look like a
  // broken screen rather than like an empty project.
  if (overall.total === 0) {
    return (
      <div className={styles.page}>
        <NavBar onBack={back}>گزارش {project.name}</NavBar>
        <div className={styles.fill}>
          <EmptyState
            icon={<PieOutline />}
            title="هنوز کاری برای گزارش نیست"
            description="با ساختن اولین کار، پیشرفت پروژه از همین‌جا قابل پیگیری می‌شود."
          />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <NavBar onBack={back}>گزارش {project.name}</NavBar>

      <div className={styles.body}>
        <section className={styles.hero} aria-label="پیشرفت کلی پروژه">
          <span className={styles.heroLabel}>پیشرفت پروژه</span>
          <span className={styles.heroValue}>
            {toPersianDigits(overall.completion)}
            <span className={styles.heroUnit}>درصد</span>
          </span>
          <span className={styles.heroSub}>
            {toPersianDigits(overall.done)} کار از {toPersianDigits(overall.total)} کار انجام شده است
          </span>

          <div className={styles.tiles}>
            <div className={styles.tile}>
              <span className={styles.tileValue}>{toPersianDigits(overall.total)}</span>
              <span className={styles.tileLabel}>کل کارها</span>
            </div>
            <div className={styles.tile}>
              <span className={styles.tileValue}>{toPersianDigits(overall.done)}</span>
              <span className={styles.tileLabel}>انجام شده</span>
            </div>
            <div className={styles.tile}>
              <span className={styles.tileValue}>
                {overall.overdue > 0 && <ExclamationCircleOutline className={styles.tileWarn} />}
                {toPersianDigits(overall.overdue)}
              </span>
              <span className={styles.tileLabel}>معوق</span>
            </div>
            <div className={styles.tile}>
              <span className={styles.tileValue}>{toPersianDigits(overall.undated)}</span>
              <span className={styles.tileLabel}>بدون سررسید</span>
            </div>
          </div>
        </section>

        <ReportSection
          icon={<HistogramOutline />}
          title="کارها بر اساس وضعیت"
          hint={`${toPersianDigits(overall.total)} کار در ${toPersianDigits(project.lists?.length ?? 0)} لیست`}
        >
          <StatusBreakdown slices={overall.byStatus} total={overall.total} />
        </ReportSection>

        <ReportSection
          icon={<ClockCircleOutline />}
          title="گزارش زمانی"
          hint={
            timeline.lastDue
              ? `پایان کارهای باز: ${describeDue(timeline.lastDue)}`
              : 'هیچ کار بازی سررسید ندارد'
          }
        >
          <div className={styles.timeline}>
            <div className={styles.timeRow}>
              <CheckCircleOutline className={styles.timeIcon} />
              <span className={styles.timeLabel}>انجام شده، در مهلت</span>
              <span className={styles.timeValue}>{toPersianDigits(timeline.doneInTime)} کار</span>
            </div>

            <div className={styles.timeRow}>
              <CheckCircleOutline className={styles.timeIcon} />
              <span className={styles.timeLabel}>انجام شده، پس از سررسید</span>
              <span className={styles.timeValue}>{toPersianDigits(timeline.doneLate)} کار</span>
            </div>

            <div className={`${styles.timeRow} ${timeline.overdue > 0 ? styles.timeRowAlert : ''}`}>
              <ExclamationCircleOutline className={styles.timeIcon} />
              <span className={styles.timeLabel}>معوق و باز</span>
              <span className={styles.timeValue}>{toPersianDigits(timeline.overdue)} کار</span>
            </div>

            <div className={styles.timeRow}>
              <CalendarOutline className={styles.timeIcon} />
              <span className={styles.timeLabel}>نزدیک‌ترین سررسید</span>
              <span className={styles.timeValue}>{describeDue(timeline.nextDue)}</span>
            </div>

            <div className={styles.timeRow}>
              <CalendarOutline className={styles.timeIcon} />
              <span className={styles.timeLabel}>پایان کارهای باز</span>
              <span className={styles.timeValue}>{describeDue(timeline.lastDue)}</span>
              <span className={styles.timeMeta}>{describeGap(timeline.daysToLastDue)}</span>
            </div>
          </div>

          <p className={styles.note}>
            «در مهلت» و «پس از سررسید» بر اساس مقایسه‌ی سررسید با امروز محاسبه می‌شوند؛ زمان دقیق انجام هر کار
            ثبت نمی‌شود.
          </p>
        </ReportSection>

        <ReportSection
          icon={<TeamOutline />}
          title="کارها بر اساس افراد"
          hint={`${toPersianDigits(members.length)} نفر`}
          collapsible
          defaultOpen
        >
          {members.length > SEARCH_THRESHOLD && (
            <SearchBar
              className={styles.search}
              placeholder="جستجوی عضو"
              value={memberQuery}
              onChange={setMemberQuery}
            />
          )}

          {visibleMembers.length === 0 ? (
            <p className={styles.empty}>عضوی با این نام پیدا نشد.</p>
          ) : (
            visibleMembers.map((group) => <GroupRow key={group.id} group={group} kind="member" />)
          )}
        </ReportSection>

        <ReportSection
          icon={<TagOutline />}
          title="کارها بر اساس برچسب‌ها"
          hint={`${toPersianDigits(report.byTag.filter((group) => !group.synthetic).length)} برچسب`}
          collapsible
          defaultOpen={false}
        >
          {report.byTag.length === 0 ? (
            <p className={styles.empty}>هنوز به هیچ کاری برچسبی داده نشده است.</p>
          ) : (
            report.byTag.map((group) => <GroupRow key={group.id} group={group} kind="tag" />)
          )}
        </ReportSection>
      </div>
    </div>
  );
}
