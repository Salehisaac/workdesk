import { Input, Popover, TextArea, Toast } from 'antd-mobile';
import {
  AddOutline,
  CalendarOutline,
  CheckOutline,
  CloseOutline,
  DeleteOutline,
  DownOutline,
  RightOutline,
  TagOutline,
  UserAddOutline,
} from 'antd-mobile-icons';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatShortDate, formatTime } from '../../../../shared/date/jalali';
import { DateTimeSheet } from '../../../../shared/ui/datetime/DateTimeSheet';
import { useAgendaCalendar } from '../../../agenda/api';
import { useProjectTags } from '../../api';
import { JOB_STATUS_LABEL } from '../../types';
import type { JobStatus, ProjectListItem, ProjectMember } from '../../types';
import { JobAssigneeSheet } from './JobAssigneeSheet';
import { JobStatusSheet } from './JobStatusSheet';
import { JobTagSheet } from './JobTagSheet';
import { tagColor } from './tagColor';
import styles from './JobForm.module.css';

type OpenSheet = 'assignees' | 'tags' | 'due' | 'status' | null;

/**
 * One checklist row while it is being edited. `done` rides along even on a
 * brand new job (always false there) so creating and editing share one shape —
 * only the submit handlers differ in whether they send it.
 */
export interface JobFormChecklistItem {
  text: string;
  done: boolean;
}

/** Everything the form edits, in the shape it edits it in — dueAt is a real
 * Date here, not the ISO string the wire wants, because that is what the date
 * sheet and the Jalali formatters take. Each page converts on submit. */
export interface JobFormValues {
  listId: string;
  title: string;
  description: string;
  assigneeIds: string[];
  tagIds: string[];
  dueAt: Date | null;
  checklist: JobFormChecklistItem[];
  status: JobStatus;
}

interface JobFormProps {
  projectId: string;
  lists: ProjectListItem[];
  members: ProjectMember[];
  /** Shown in the header — "کار جدید در …" when creating, "ویرایش کار" when editing. */
  title: string;
  /** Seeds the fields once, on mount. Later changes are ignored: this is an
   * uncontrolled form, and re-seeding it from a refetch mid-edit would throw
   * away whatever the user had typed. */
  initialValues: JobFormValues;
  submitting: boolean;
  onSubmit: (values: JobFormValues) => void;
  /**
   * Deletes the job. Only the edit screen passes it, and only when the viewer is
   * allowed to (the job's filer or the project's creator) — creating a job has
   * nothing to delete, and a viewer who may not is refused by the API anyway.
   */
  onDelete?: () => void;
  deleting?: boolean;
}

/**
 * The job editor, shared by JobCreatePage and JobEditPage.
 *
 * It owns the whole screen (header, fields, status footer, every sheet) and
 * knows nothing about which of the two it is serving — the pages supply the
 * starting values and decide what submitting means. That split is what keeps
 * a change to, say, the checklist row from having to be made twice.
 */
export function JobForm({
  projectId,
  lists,
  members,
  title,
  initialValues,
  submitting,
  onSubmit,
  onDelete,
  deleting,
}: JobFormProps) {
  const navigate = useNavigate();
  const { markers, dayCounts } = useAgendaCalendar();

  const [selectedListId, setSelectedListId] = useState(initialValues.listId);
  const [jobTitle, setJobTitle] = useState(initialValues.title);
  const [description, setDescription] = useState(initialValues.description);
  const [assigneeIds, setAssigneeIds] = useState<string[]>(initialValues.assigneeIds);
  const [tagIds, setTagIds] = useState<string[]>(initialValues.tagIds);
  const [dueAt, setDueAt] = useState<Date | null>(initialValues.dueAt);
  const [checklist, setChecklist] = useState<JobFormChecklistItem[]>(initialValues.checklist);
  const [checklistDraft, setChecklistDraft] = useState('');
  const [status, setStatus] = useState<JobStatus>(initialValues.status);
  const [sheet, setSheet] = useState<OpenSheet>(null);
  const [listMenuOpen, setListMenuOpen] = useState(false);

  // Only fetched once the tag sheet has been opened at least once; after that
  // the cache is what resolves the selected ids into chips on this page.
  const tags = useProjectTags(projectId, sheet === 'tags' || tagIds.length > 0);

  const activeList = lists.find((list) => list.id === selectedListId);
  const selectedMembers = useMemo(
    () => members.filter((member) => assigneeIds.includes(member.id)),
    [members, assigneeIds],
  );
  const selectedTags = useMemo(() => (tags.data ?? []).filter((tag) => tagIds.includes(tag.id)), [tags.data, tagIds]);

  function addChecklistItem() {
    const trimmed = checklistDraft.trim();
    if (!trimmed) return;
    setChecklist((prev) => [...prev, { text: trimmed, done: false }]);
    setChecklistDraft('');
  }

  function toggleChecklistItem(index: number) {
    setChecklist((prev) => prev.map((item, i) => (i === index ? { ...item, done: !item.done } : item)));
  }

  function handleSubmit() {
    if (submitting) return;
    if (!selectedListId) {
      Toast.show({ content: 'یک لیست انتخاب کنید' });
      return;
    }
    if (!jobTitle.trim()) {
      Toast.show({ content: 'عنوان کار را وارد کنید' });
      return;
    }

    onSubmit({
      listId: selectedListId,
      title: jobTitle.trim(),
      description: description.trim(),
      assigneeIds,
      tagIds,
      dueAt,
      checklist,
      status,
    });
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={() => navigate(-1)} aria-label="بازگشت">
          <RightOutline />
        </button>
        <h1 className={styles.headerTitle}>{title}</h1>
        <button
          type="button"
          className={styles.submit}
          onClick={handleSubmit}
          disabled={submitting}
          aria-label="ثبت کار"
        >
          <CheckOutline />
        </button>
      </header>

      <div className={styles.form}>
        {/* Which list the job belongs to — seeded from the route/job, changeable. */}
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
          <Input className={styles.titleInput} placeholder="عنوان" value={jobTitle} onChange={setJobTitle} />
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

          {checklist.map((item, index) => (
            <div key={`${item.text}-${index}`} className={styles.checklistItem}>
              {/* A real control, not the decorative box it used to be: an
                  existing job's items can be ticked off from here, which is
                  the whole point of being able to come back to a job. */}
              <button
                type="button"
                className={styles.checklistBox}
                data-done={item.done || undefined}
                onClick={() => toggleChecklistItem(index)}
                aria-pressed={item.done}
                aria-label={item.done ? `برداشتن تیک ${item.text}` : `انجام شد ${item.text}`}
              >
                {item.done && <CheckOutline />}
              </button>
              <span className={styles.checklistText} data-done={item.done || undefined}>
                {item.text}
              </span>
              <button
                type="button"
                className={styles.chipRemove}
                onClick={() => setChecklist((prev) => prev.filter((_, i) => i !== index))}
                aria-label={`حذف ${item.text}`}
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
        {/* Opposite end from the status pill, and quiet: deleting is reachable
            from where the job is worked on, without competing with the thing
            this screen is actually for. */}
        {onDelete && (
          <button
            type="button"
            className={styles.delete}
            onClick={onDelete}
            disabled={deleting || submitting}
            aria-label="حذف کار"
          >
            <DeleteOutline />
            حذف
          </button>
        )}

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
        projectId={projectId}
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
