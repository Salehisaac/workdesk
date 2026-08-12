import { DotLoading, Toast } from 'antd-mobile';
import { ExclamationCircleOutline } from 'antd-mobile-icons';
import { useNavigate, useParams } from 'react-router-dom';
import { toLocalIso } from '../../../shared/date/jalali';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { useCreateJob, useProject } from '../api';
import { JobForm } from '../components/job/JobForm';
import type { JobFormValues } from '../components/job/JobForm';
import styles from '../components/job/JobForm.module.css';
import { DEFAULT_JOB_STATUS } from '../types';

export function JobCreatePage() {
  const { projectId, listId } = useParams<{ projectId: string; listId: string }>();
  const navigate = useNavigate();
  const project = useProject(projectId);
  const createJob = useCreateJob(projectId ?? '');

  async function handleSubmit(values: JobFormValues) {
    try {
      await createJob.mutateAsync({
        listId: values.listId,
        title: values.title,
        description: values.description || undefined,
        assigneeIds: values.assigneeIds,
        tagIds: values.tagIds,
        // Built from a local calendar day + time and sent with this device's
        // offset, so it round-trips back to the Jalali day the user tapped —
        // see toLocalIso.
        dueAt: values.dueAt ? toLocalIso(values.dueAt) : undefined,
        // No `done` on the way in: nothing is ticked off on a job that does
        // not exist yet. Editing one is where that starts to matter.
        checklist: values.checklist.map((item) => ({ text: item.text })),
        status: values.status,
      });
      Toast.show({ content: 'کار ساخته شد' });
      navigate(`/projects/${projectId}`);
    } catch (error) {
      Toast.show({ content: error instanceof Error ? error.message : 'ساخت کار با خطا مواجه شد' });
    }
  }

  if (project.isError) {
    return (
      <div className={styles.page}>
        <EmptyState
          icon={<ExclamationCircleOutline />}
          title="ارتباط برقرار نشد"
          description="بارگذاری این پروژه با خطا مواجه شد. دوباره تلاش کنید."
        />
      </div>
    );
  }

  if (project.isLoading || !project.data) {
    return (
      <div className={styles.page}>
        <EmptyState icon={<DotLoading />} title="در حال بارگذاری…" />
      </div>
    );
  }

  const lists = project.data.lists ?? [];
  const activeList = lists.find((list) => list.id === listId);

  return (
    <JobForm
      projectId={projectId ?? ''}
      lists={lists}
      members={project.data.members ?? []}
      title={`کار جدید در ${activeList?.name ?? '—'}`}
      initialValues={{
        listId: listId ?? '',
        title: '',
        description: '',
        assigneeIds: [],
        tagIds: [],
        dueAt: null,
        checklist: [],
        status: DEFAULT_JOB_STATUS,
      }}
      submitting={createJob.isPending}
      onSubmit={handleSubmit}
    />
  );
}
