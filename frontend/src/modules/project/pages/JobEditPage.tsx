import { DotLoading, Toast } from 'antd-mobile';
import { ExclamationCircleOutline } from 'antd-mobile-icons';
import { useNavigate, useParams } from 'react-router-dom';
import { toLocalIso } from '../../../shared/date/jalali';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { useJobs, useProject, useUpdateJob } from '../api';
import { JobForm } from '../components/job/JobForm';
import type { JobFormValues } from '../components/job/JobForm';
import styles from '../components/job/JobForm.module.css';

export function JobEditPage() {
  const { projectId, jobId } = useParams<{ projectId: string; jobId: string }>();
  const navigate = useNavigate();
  const project = useProject(projectId);
  // The job comes from the same flat job query the board and the home calendar
  // already read, so opening a job off a board someone was just looking at is
  // a cache hit rather than a fetch. There is no GET /jobs/{id} to fall back
  // on, which is also why a job id that isn't in that list is treated as gone.
  const jobs = useJobs();
  const updateJob = useUpdateJob(projectId ?? '', jobId ?? '');

  const job = (jobs.data ?? []).find((candidate) => candidate.id === jobId);

  async function handleSubmit(values: JobFormValues) {
    try {
      await updateJob.mutateAsync({
        listId: values.listId,
        title: values.title,
        // Empty string rather than undefined: the user clearing the field has
        // to reach the server as "no description", and undefined would instead
        // mean "leave it as it was" — see UpdateJobInput.
        description: values.description,
        assigneeIds: values.assigneeIds,
        tagIds: values.tagIds,
        // Same reasoning: '' clears the deadline, undefined would keep it.
        dueAt: values.dueAt ? toLocalIso(values.dueAt) : '',
        checklist: values.checklist,
        status: values.status,
      });
      Toast.show({ content: 'کار ذخیره شد' });
      navigate(`/projects/${projectId}`);
    } catch (error) {
      Toast.show({ content: error instanceof Error ? error.message : 'ذخیره کار با خطا مواجه شد' });
    }
  }

  if (project.isError || jobs.isError) {
    return (
      <div className={styles.page}>
        <EmptyState
          icon={<ExclamationCircleOutline />}
          title="ارتباط برقرار نشد"
          description="بارگذاری این کار با خطا مواجه شد. دوباره تلاش کنید."
        />
      </div>
    );
  }

  if (project.isLoading || jobs.isLoading || !project.data) {
    return (
      <div className={styles.page}>
        <EmptyState icon={<DotLoading />} title="در حال بارگذاری…" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className={styles.page}>
        <EmptyState
          icon={<ExclamationCircleOutline />}
          title="این کار پیدا نشد"
          description="شاید حذف شده باشد. به تخته پروژه برگردید."
        />
      </div>
    );
  }

  return (
    <JobForm
      projectId={projectId ?? ''}
      lists={project.data.lists ?? []}
      members={project.data.members ?? []}
      title="ویرایش کار"
      initialValues={{
        listId: job.listId,
        title: job.title,
        description: job.description ?? '',
        assigneeIds: (job.assignees ?? []).map((member) => member.id),
        tagIds: (job.tags ?? []).map((tag) => tag.id),
        dueAt: job.dueAt ? new Date(job.dueAt) : null,
        checklist: (job.checklist ?? []).map((item) => ({ text: item.text, done: item.done })),
        status: job.status,
      }}
      submitting={updateJob.isPending}
      onSubmit={handleSubmit}
    />
  );
}
