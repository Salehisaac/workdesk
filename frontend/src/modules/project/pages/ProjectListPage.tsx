import { Avatar, Button, DotLoading, NavBar } from 'antd-mobile';
import { LeftOutline, QuestionCircleOutline, TeamOutline } from 'antd-mobile-icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { useProjects } from '../api';
import { ProjectOnboarding } from '../components/ProjectOnboarding';
import { ProjectsGuideSheet } from '../components/ProjectsGuideSheet';
import styles from './ProjectListPage.module.css';

export function ProjectListPage() {
  const navigate = useNavigate();
  const { data: projects, isLoading, isError } = useProjects();
  const [guideOpen, setGuideOpen] = useState(false);

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
        {isLoading && (
          <EmptyState icon={<DotLoading />} title="در حال بارگذاری…" />
        )}

        {isError && (
          <EmptyState
            icon={<TeamOutline />}
            title="ارتباط برقرار نشد"
            description="بارگذاری پروژه‌ها با خطا مواجه شد. دوباره تلاش کنید."
          />
        )}

        {!isLoading && !isError && (projects?.length ?? 0) > 0 && (
          <div className={styles.list}>
            {projects!.map((project) => (
              <button
                key={project.id}
                type="button"
                className={styles.projectCard}
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                {project.avatarUrl ? (
                  <Avatar src={project.avatarUrl} style={{ '--size': '44px', '--border-radius': '14px' }} />
                ) : (
                  <span className={styles.projectInitial}>{project.name.trim().charAt(0) || '؟'}</span>
                )}
                <span className={styles.projectInfo}>
                  <span className={styles.projectName}>{project.name}</span>
                  <span className={styles.projectMeta}>{project.memberCount} عضو</span>
                </span>
                <LeftOutline className={styles.chevron} />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className={styles.footer}>
        <Button block color="primary" size="large" onClick={() => navigate('/projects/new')}>
          پروژه جدید
        </Button>
      </div>

      {guideOpen && <ProjectsGuideSheet visible={guideOpen} onClose={() => setGuideOpen(false)} />}
    </div>
  );
}
