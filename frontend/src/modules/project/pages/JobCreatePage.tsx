import { DotLoading, Input, Popover, TextArea, Toast } from 'antd-mobile';
import {
  AddOutline,
  CalendarOutline,
  CheckOutline,
  CloseOutline,
  DownOutline,
  ExclamationCircleOutline,
  RightOutline,
  TagOutline,
  UserAddOutline,
} from 'antd-mobile-icons';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatShortDate, formatTime, toLocalIso } from '../../../shared/date/jalali';
import { DateTimeSheet } from '../../../shared/ui/datetime/DateTimeSheet';
import { useAgendaCalendar } from '../../agenda/api';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { useCreateJob, useProject, useProjectTags } from '../api';
import { JobAssigneeSheet } from '../components/job/JobAssigneeSheet';
import { JobStatusSheet } from '../components/job/JobStatusSheet';
import { JobTagSheet } from '../components/job/JobTagSheet';
import { tagColor } from '../components/job/tagColor';
import { DEFAULT_JOB_STATUS, JOB_STATUS_LABEL } from '../types';
import type { JobStatus } from '../types';
import styles from './JobCreatePage.module.css';

type OpenSheet = 'assignees' | 'tags' | 'due' | 'status' | null;

export function JobCreatePage() {
  const { projectId, listId } = useParams<{ projectId: string; listId: string }>();
  const navigate = useNavigate();
  const project = useProject(projectId);
  const createJob = useCreateJob(projectId ?? '');
  const { markers, dayCounts } = useAgendaCalendar();

  const [selectedListId, setSelectedListId] = useState(listId ?? '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [dueAt, setDueAt] = useState<Date | null>(null);
  const [checklist, setChecklist] = useState<string[]>([]);
  const [checklistDraft, setChecklistDraft] = useState('');
  const [status, setStatus] = useState<JobStatus>(DEFAULT_JOB_STATUS);
  const [sheet, setSheet] = useState<OpenSheet>(null);
  const [listMenuOpen, setListMenuOpen] = useState(false);

  // Only fetched once the tag sheet has been opened at least once; after that
  // the cache is what resolves the selected ids into chips on this page.
  const tags = useProjectTags(projectId ?? '', sheet === 'tags' || tagIds.length > 0);

  const lists = project.data?.lists ?? [];
  const members = project.data?.members ?? [];
  const activeList = lists.find((list) => list.id === selectedListId);
  const selectedMembers = useMemo(
    () => members.filter((member) => assigneeIds.includes(member.id)),
    [members, assigneeIds],
  );
  const selectedTags = useMemo(() => (tags.data ?? []).filter((tag) => tagIds.includes(tag.id)), [tags.data, tagIds]);

  function addChecklistItem() {
    const trimmed = checklistDraft.trim();
    if (!trimmed) return;
    setChecklist((prev) => [...prev, trimmed]);
    setChecklistDraft('');
  }

  async function handleSubmit() {
    if (createJob.isPending) return;
    if (!selectedListId) {
      Toast.show({ content: 'یک لیست انتخاب کنید' });
      return;
    }
    if (!title.trim()) {
      Toast.show({ content: 'عنوان کار را وارد کنید' });
      return;
    }

    try {
      await createJob.mutateAsync({
        listId: selectedListId,
        title: title.trim(),
        description: description.trim() || undefined,
        assigneeIds,
        tagIds,
        // Built from a local calendar day + time and sent with this device's
        // offset, so it round-trips back to the Jalali day the user tapped —
        // see toLocalIso.
        dueAt: dueAt ? toLocalIso(dueAt) : undefined,
        checklist: checklist.map((text) => ({ text })),
        status,
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

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={() => navigate(-1)} aria-label="بازگشت">
          <RightOutline />
        </button>
        <h1 className={styles.headerTitle}>کار جدید در {activeList?.name ?? '—'}</h1>
        <button
          type="button"
          className={styles.submit}
          onClick={handleSubmit}
          disabled={createJob.isPending}
          aria-label="ثبت کار"
        >
          <CheckOutline />
        </button>
      </header>

      <div className={styles.form}>
        {/* Which list the job lands in — preselected from the route, changeable. */}
        <Popover.Menu
          visible={listMenuOpen}
          onVisibleChange={setListMenuOpen}
          trigger="click"
          // antd-mobile's placements are physical, not logical — "start" is the
          // left edge regardless of direction, which under dir="rtl" puts the
          // menu on the opposite side from the trigger's text and overflows.
          placement="bottom-end"
          actions={lists.map((list) => ({ key: list.id, text: list.name }))}
          onAction={(action) => {
            setSelectedListId(String(action.key));
            setListMenuOpen(false);
          }}
        >
          <button type="button" className={styles.listRow} aria-label="انتخاب لیست">
            <span className={styles.listName}>{activeList?.name ?? 'انتخاب لیست'}</span>
            <DownOutline className={styles.listChevron} />
          </button>
        </Popover.Menu>

        <div className={styles.field}>
          <Input className={styles.titleInput} placeholder="عنوان" value={title} onChange={setTitle} />
        </div>

        <div className={styles.field}>
          <TextArea
            className={styles.descriptionInput}
            placeholder="شرح"
            value={description}
            onChange={setDescription}
            autoSize={{ minRows: 1, maxRows: 6 }}
          />
        </div>

        <div className={styles.row}>
          <span className={styles.rowIcon}>
            <UserAddOutline />
          </span>
          <span className={styles.rowLabel}>افراد</span>
          <div className={styles.rowValue}>
            {selectedMembers.map((member) => (
              <span key={member.id} className={styles.memberChip}>
                <span className={styles.memberAvatar} aria-hidden="true">
                  {member.displayName.trim().charAt(0) || '؟'}
                </span>
                {member.displayName}
                <button
                  type="button"
                  className={styles.chipRemove}
                  onClick={() => setAssigneeIds((prev) => prev.filter((id) => id !== member.id))}
                  aria-label={`حذف ${member.displayName}`}
                >
                  <CloseOutline />
                </button>
              </span>
            ))}
            <button type="button" className={styles.rowAdd} onClick={() => setSheet('assignees')} aria-label="افزودن فرد">
              <AddOutline />
            </button>
          </div>
        </div>

        <div className={styles.row}>
          <span className={styles.rowIcon}>
            <TagOutline />
          </span>
          <span className={styles.rowLabel}>برچسب‌ها</span>
          <div className={styles.rowValue}>
            {selectedTags.map((tag) => (
              <span key={tag.id} className={styles.tagChip} style={{ background: tag.color ?? tagColor(tag.name) }}>
                {tag.name}
                <button
                  type="button"
                  className={styles.chipRemove}
                  onClick={() => setTagIds((prev) => prev.filter((id) => id !== tag.id))}
                  aria-label={`حذف ${tag.name}`}
                >
                  <CloseOutline />
                </button>
              </span>
            ))}
            <button type="button" className={styles.rowAdd} onClick={() => setSheet('tags')} aria-label="افزودن برچسب">
              <AddOutline />
            </button>
          </div>
        </div>

        <div className={styles.row}>
          <span className={styles.rowIcon}>
            <CalendarOutline />
          </span>
          <span className={styles.rowLabel}>تاریخ سررسید</span>
          <div className={styles.rowValue}>
            {dueAt ? (
              <span className={styles.dueChip}>
                {formatShortDate(dueAt)}
                <span className={styles.dueTime}>{formatTime(dueAt)}</span>
                <button type="button" className={styles.chipRemove} onClick={() => setDueAt(null)} aria-label="حذف تاریخ سررسید">
                  <CloseOutline />
                </button>
              </span>
            ) : (
              <button type="button" className={styles.rowAdd} onClick={() => setSheet('due')} aria-label="تعیین تاریخ سررسید">
                <AddOutline />
              </button>
            )}
          </div>
        </div>

        <div className={styles.checklist}>
          <div className={styles.row}>
            <span className={styles.rowIcon}>
              <CheckOutline />
            </span>
            <span className={styles.rowLabel}>چک لیست</span>
          </div>

          {checklist.map((text, index) => (
            <div key={`${text}-${index}`} className={styles.checklistItem}>
              <span className={styles.checklistBox} aria-hidden="true" />
              <span className={styles.checklistText}>{text}</span>
              <button
                type="button"
                className={styles.chipRemove}
                onClick={() => setChecklist((prev) => prev.filter((_, i) => i !== index))}
                aria-label={`حذف ${text}`}
              >
                <CloseOutline />
              </button>
            </div>
          ))}

          <div className={styles.checklistItem}>
            <span className={styles.checklistBox} aria-hidden="true" />
            <Input
              className={styles.checklistInput}
              placeholder="بنویسید…"
              value={checklistDraft}
              onChange={setChecklistDraft}
              onEnterPress={addChecklistItem}
            />
            <button
              type="button"
              className={styles.rowAdd}
              onClick={addChecklistItem}
              disabled={!checklistDraft.trim()}
              aria-label="افزودن مورد چک لیست"
            >
              <AddOutline />
            </button>
          </div>
        </div>
      </div>

      <footer className={styles.footer}>
        <button type="button" className={styles.statusButton} data-status={status} onClick={() => setSheet('status')}>
          {JOB_STATUS_LABEL[status]}
        </button>
      </footer>

      <JobAssigneeSheet
        visible={sheet === 'assignees'}
        members={members}
        selectedIds={assigneeIds}
        onClose={() => setSheet(null)}
        onConfirm={(ids) => {
          setAssigneeIds(ids);
          setSheet(null);
        }}
      />

      <JobTagSheet
        visible={sheet === 'tags'}
        projectId={projectId ?? ''}
        selectedIds={tagIds}
        onClose={() => setSheet(null)}
        onConfirm={(ids) => {
          setTagIds(ids);
          setSheet(null);
        }}
      />

      <DateTimeSheet
        visible={sheet === 'due'}
        value={dueAt}
        title="انتخاب روز"
        markers={markers}
        dayCounts={dayCounts}
        onClose={() => setSheet(null)}
        onConfirm={(value) => {
          setDueAt(value);
          setSheet(null);
        }}
      />

      <JobStatusSheet
        visible={sheet === 'status'}
        value={status}
        onClose={() => setSheet(null)}
        onSelect={(next) => {
          setStatus(next);
          setSheet(null);
        }}
      />
    </div>
  );
}
