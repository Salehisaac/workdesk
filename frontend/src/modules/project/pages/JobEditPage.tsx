import { Dialog, DotLoading, Toast } from 'antd-mobile';
import { ExclamationCircleOutline } from 'antd-mobile-icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useMe } from '../../../shared/api/me';
import { toLocalIso } from '../../../shared/date/jalali';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { useDeleteJob, useJobs, useProject, useUpdateJob } from '../api';
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
  const me = useMe();
  const updateJob = useUpdateJob(projectId ?? '', jobId ?? '');
  const deleteJob = useDeleteJob(projectId ?? '', jobId ?? '');

  const job = (jobs.data ?? []).find((candidate) => candidate.id === jobId);

  // The board already declines to open this screen for anyone else, but a screen
  // has its own URL and this one can be arrived at directly — so it makes the
  // same check rather than trusting the way in. The API makes it a third time,
  // which is the one that actually protects anything.
  //
  // Phrased as "known to be someone else's", not "known to be mine", for the
  // same reason ProjectEditPage is: `me` is allowed to fail and never retries
  // (see useMe), and a failed identity lookup must not lock someone out of their
  // own job — with nothing to compare, the screen opens and the API decides.
  const notAllowed =
    !!job &&
    !!project.data &&
    !!me.data &&
    project.data.ownerRefId !== me.data.id &&
    job.createdBy !== me.data.id;

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

  async function handleDelete() {
    const confirmed = await Dialog.confirm({
      title: 'این کار حذف شود؟',
      content: 'کار با همه‌ی چک‌لیست، برچسب‌ها و مسئول‌هایش پاک می‌شود و برگشتی ندارد.',
      confirmText: 'حذف کار',
      cancelText: 'انصراف',
    });
    if (!confirmed) return;

    try {
      await deleteJob.mutateAsync();
      Toast.show({ content: 'کار حذف شد' });
      navigate(`/projects/${projectId}`, { replace: true });
    } catch (error) {
      Toast.show({ content: error instanceof Error ? error.message : 'حذف کار با خطا مواجه شد' });
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

  if (notAllowed) {
    return (
      <div className={styles.page}>
        <EmptyState
          icon={<ExclamationCircleOutline />}
          title="دسترسی ندارید"
          description="ویرایش و حذف این کار فقط از سازنده‌اش یا سازنده‌ی پروژه برمی‌آید."
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
      onDelete={handleDelete}
      deleting={deleteJob.isPending}
    />
  );
}
