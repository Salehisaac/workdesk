import { Avatar, Button, DotLoading, List, NavBar } from 'antd-mobile';
import { TeamOutline } from 'antd-mobile-icons';
import { useNavigate } from 'react-router-dom';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { useProjects } from '../api';
import { ProjectOnboarding } from '../components/ProjectOnboarding';
import styles from './ProjectListPage.module.css';

export function ProjectListPage() {
  const navigate = useNavigate();
  const { data: projects, isLoading, isError } = useProjects();

  // No projects yet → the onboarding/"getting started" screen is the landing
  // page (matches the reference screenshots' first screen). Once the user has
  // at least one project, this page becomes the actual list on later visits.
  if (!isLoading && !isError && (projects?.length ?? 0) === 0) {
    return <ProjectOnboarding />;
  }

  return (
    <div className={styles.page}>
      <NavBar onBack={() => navigate('/')}>پروژه‌ها</NavBar>

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
          <List>
            {projects!.map((project) => (
              <List.Item
                key={project.id}
                prefix={<Avatar src={project.avatarUrl ?? ''} style={{ '--size': '40px', '--border-radius': '10px' }} />}
                description={
                  <span className={styles.projectMeta}>
                    {project.memberCount} عضو، {project.onlineCount} نفر آنلاین
                  </span>
                }
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                {project.name}
              </List.Item>
            ))}
          </List>
        )}
      </div>

      <div className={styles.footer}>
        <Button block color="primary" size="large" onClick={() => navigate('/projects/new')}>
          پروژه جدید
        </Button>
      </div>
    </div>
  );
}
