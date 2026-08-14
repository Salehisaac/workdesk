import { Avatar, Button, DotLoading, NavBar } from 'antd-mobile';
import { AddOutline, LeftOutline, QuestionCircleOutline, TeamOutline } from 'antd-mobile-icons';
import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { monogramGradient, monogramInitial, paletteForSeed } from '../../../shared/brand/monogram';
import { today, toPersianDigits } from '../../../shared/date/jalali';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { useJobs, useProjects } from '../api';
import { ProjectOnboarding } from '../components/ProjectOnboarding';
import { ProjectsGuideSheet } from '../components/ProjectsGuideSheet';
import { summarize } from '../report';
import type { ReportStats } from '../report';
import type { Job, Project } from '../types';
import styles from './ProjectListPage.module.css';

/**
 * «پروژه‌ها» — the module's front door.
 *
 * Each row used to carry a name and a member count, which made every project on
 * the screen look identical and answered a question nobody asks: what you want
 * from a list of projects is which one needs you today. So a row now says how
 * much of its work is done, and shouts if any of it is overdue — the same reason
 * `GET /ledgers` totals each book server-side, reached the other way. The
 * numbers cost no request: /jobs is already loaded and cached for the home
 * calendar, and `summarize` is the report's own arithmetic, so «معوق» means
 * exactly here what it means on the report screen.
 *
 * The other half of the fix is identity. A project that never had a picture was
 * a grey tile with a letter in it, the same grey on every row; it now wears a
 * colour derived from its own id — the palette the create screen paints
 * monograms from — and the card carries a wash of it. Nothing here is decoration
 * for its own sake: it is what lets someone find «فروشگاه مرکزی» by shape and
 * colour instead of reading seven names in a column.
 */
export function ProjectListPage() {
  const navigate = useNavigate();
  const { data: projects, isLoading, isError } = useProjects();
  const jobs = useJobs();
  const [guideOpen, setGuideOpen] = useState(false);

  // One pass over the flat job list, bucketed by project. Done here rather than
  // per card so a hundred jobs are walked once instead of once per row.
  const statsByProject = useMemo(() => {
    const buckets = new Map<string, Job[]>();
    for (const job of jobs.data ?? []) {
      const bucket = buckets.get(job.projectId);
      if (bucket) bucket.push(job);
      else buckets.set(job.projectId, [job]);
    }

    const now = today();
    const stats = new Map<string, ReportStats>();
    buckets.forEach((list, projectId) => stats.set(projectId, summarize(list, now)));
    return stats;
  }, [jobs.data]);

  const overdueTotal = useMemo(() => {
    let total = 0;
    statsByProject.forEach((stats) => {
      total += stats.overdue;
    });
    return total;
  }, [statsByProject]);

  // No projects yet → the onboarding/"getting started" screen is the landing
  // page (matches the reference screenshots' first screen). Once the user has
  // at least one project, this page becomes the actual list on later visits.
  if (!isLoading && !isError && (projects?.length ?? 0) === 0) {
    return <ProjectOnboarding />;
  }

  return (
    <div className={styles.page}>
      {/* The service's front door is where someone who doesn't yet know what a
          project *is* actually stands, so the guide has to be reachable from
          here and not only from inside a board they haven't opened. */}
      <NavBar
        onBack={() => navigate('/')}
        right={
          <button
            type="button"
            className={styles.guideButton}
            onClick={() => setGuideOpen(true)}
            aria-label="راهنمای پروژه‌ها"
          >
            <QuestionCircleOutline />
          </button>
        }
      >
        پروژه‌ها
      </NavBar>

      <div className={styles.body}>
        {isLoading && <EmptyState icon={<DotLoading />} title="در حال بارگذاری…" />}

        {isError && (
          <EmptyState
            icon={<TeamOutline />}
            title="ارتباط برقرار نشد"
            description="بارگذاری پروژه‌ها با خطا مواجه شد. دوباره تلاش کنید."
          />
        )}

        {!isLoading && !isError && (projects?.length ?? 0) > 0 && (
          <>
            {/* One line of context above a column of cards: how many there are,
                and the single number worth interrupting for. The overdue chip is
                absent — not zeroed — when nothing is late, so its presence is
                itself the signal. */}
            <div className={styles.summary}>
              <span className={styles.summaryCount}>{toPersianDigits(projects!.length)} پروژه</span>
              {overdueTotal > 0 && (
                <span className={styles.summaryOverdue}>{toPersianDigits(overdueTotal)} کار معوق</span>
              )}
            </div>

            <div className={styles.list}>
              {projects!.map((project, index) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  stats={statsByProject.get(project.id)}
                  jobsLoading={jobs.isLoading}
                  index={index}
                  onOpen={() => navigate(`/projects/${project.id}`)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <div className={styles.footer}>
        <Button block color="primary" size="large" onClick={() => navigate('/projects/new')}>
          <AddOutline /> پروژه جدید
        </Button>
      </div>

      {guideOpen && <ProjectsGuideSheet visible={guideOpen} onClose={() => setGuideOpen(false)} />}
    </div>
  );
}

interface ProjectCardProps {
  project: Project;
  /** Undefined for a project with no jobs at all — not the same as zero progress. */
  stats: ReportStats | undefined;
  jobsLoading: boolean;
  /** Drives the staggered reveal; purely presentational. */
  index: number;
  onOpen: () => void;
}

function ProjectCard({ project, stats, jobsLoading, index, onOpen }: ProjectCardProps) {
  // Seeded on the id, not the name: renaming a project shouldn't change the
  // colour someone has learned to find it by.
  const palette = paletteForSeed(project.id);
  const total = stats?.total ?? 0;

  return (
    <button
      type="button"
      className={styles.card}
      style={
        {
          '--tone': palette.from,
          '--tone-deep': palette.to,
          '--card-index': index,
        } as CSSProperties
      }
      onClick={onOpen}
    >
      <span className={styles.cardHead}>
        {project.avatarUrl ? (
          <Avatar src={project.avatarUrl} style={{ '--size': '46px', '--border-radius': '15px' }} />
        ) : (
          <span className={styles.monogram} style={{ background: monogramGradient(palette) }} aria-hidden="true">
            {monogramInitial(project.name) || '؟'}
          </span>
        )}

        <span className={styles.identity}>
          <span className={styles.name}>{project.name}</span>
          <span className={styles.meta}>
            <span className={styles.metaItem}>
              <TeamOutline aria-hidden="true" />
              {toPersianDigits(project.memberCount)} عضو
            </span>
            {total > 0 && <span className={styles.metaItem}>{toPersianDigits(total)} کار</span>}
          </span>
        </span>

        <LeftOutline className={styles.chevron} aria-hidden="true" />
      </span>

      {/* One slot, always the same height, whatever it ends up holding — a row
          that appears only once /jobs lands would make the whole column jump
          under a thumb that is already reaching for it. */}
      <span className={styles.progress}>
        {jobsLoading ? (
          <span className={styles.track} aria-hidden="true" />
        ) : total === 0 ? (
          <span className={styles.noJobs}>هنوز کاری ثبت نشده</span>
        ) : (
          <>
            <span className={styles.track}>
              <span className={styles.fill} style={{ width: `${stats!.completion}%` }} />
            </span>
            <span className={styles.share}>{toPersianDigits(stats!.completion)}٪</span>
            {stats!.overdue > 0 && (
              <span className={styles.overdue}>{toPersianDigits(stats!.overdue)} معوق</span>
            )}
          </>
        )}
      </span>
    </button>
  );
}
