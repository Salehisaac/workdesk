import { ActionSheet, Input, TextArea, Toast } from 'antd-mobile';
import { AddOutline, CalendarOutline, CheckOutline, CloseOutline, RightOutline, UnorderedListOutline } from 'antd-mobile-icons';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatLongDate, isSameDay, startOfDay, toLocalIso, today } from '../../../shared/date/jalali';
import { useProjects } from '../../project/api';
import { useCreateNote } from '../api';
import styles from './NoteCreatePage.module.css';

/**
 * «یادداشت جدید» — the whole note flow, because a note is only ever created.
 *
 * There is no date picker on this screen, and that's the feature: a note is
 * filed under the day it was written on, and the only day you can write on is
 * today. So the day is shown, not chosen. The backend enforces the same rule
 * (`POST /notes` refuses any other day), so the two can't disagree.
 */
export function NoteCreatePage() {
  const navigate = useNavigate();
  const createNote = useCreateNote();
  const projects = useProjects();

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectSheetOpen, setProjectSheetOpen] = useState(false);
  // The day this note is being written on. Held in state rather than read at
  // render time so it can be re-checked at submit — see handleSubmit.
  const [day, setDay] = useState(() => today());

  const selectedProject = projects.data?.find((project) => project.id === projectId) ?? null;

  const projectActions = useMemo(
    () => [
      { key: 'none', text: 'بدون پروژه' },
      ...(projects.data ?? []).map((project) => ({ key: project.id, text: project.name })),
    ],
    [projects.data],
  );

  async function handleSubmit() {
    if (createNote.isPending) return;
    if (!title.trim()) {
      Toast.show({ content: 'عنوان یادداشت را وارد کنید' });
      return;
    }

    // The form was open across midnight: the note would be filed under a day
    // other than the one on screen. Move the screen to the new day and let the
    // user confirm, rather than filing it somewhere they weren't looking.
    const now = new Date();
    const currentDay = startOfDay(now);
    if (!isSameDay(currentDay, day)) {
      setDay(currentDay);
      Toast.show({ content: 'روز عوض شد؛ این یادداشت برای امروز ثبت می‌شود. دوباره تأیید کنید.' });
      return;
    }

    try {
      await createNote.mutateAsync({
        title: title.trim(),
        body: body.trim() || undefined,
        projectId: projectId ?? undefined,
        // Offset-carrying, not toISOString(): the backend compares this against
        // its own clock to confirm it really is the writer's today.
        date: toLocalIso(now),
      });
      Toast.show({ content: 'یادداشت برای امروز ثبت شد' });
      navigate('/');
    } catch (error) {
      Toast.show({ content: error instanceof Error ? error.message : 'ثبت یادداشت با خطا مواجه شد' });
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={() => navigate(-1)} aria-label="بازگشت">
          <RightOutline />
        </button>
        <h1 className={styles.headerTitle}>یادداشت جدید</h1>
        <button
          type="button"
          className={styles.submit}
          onClick={handleSubmit}
          disabled={createNote.isPending}
          aria-label="ثبت یادداشت"
        >
          <CheckOutline />
        </button>
      </header>

      <div className={styles.form}>
        <div className={styles.field}>
          <Input className={styles.titleInput} placeholder="عنوان" value={title} onChange={setTitle} />
        </div>

        <div className={styles.field}>
          <TextArea
            className={styles.bodyInput}
            placeholder="متن یادداشت"
            value={body}
            onChange={setBody}
            autoSize={{ minRows: 4, maxRows: 12 }}
          />
        </div>

        {/* Read-only on purpose: the day isn't a choice. */}
        <div className={styles.row}>
          <span className={styles.rowIcon}>
            <CalendarOutline />
          </span>
          <span className={styles.rowLabel}>روز</span>
          <div className={styles.rowValue}>
            <span className={styles.dayChip}>امروز، {formatLongDate(day)}</span>
          </div>
        </div>

        <div className={styles.row}>
          <span className={styles.rowIcon}>
            <UnorderedListOutline />
          </span>
          <span className={styles.rowLabel}>پروژه</span>
          <div className={styles.rowValue}>
            {selectedProject ? (
              <span className={styles.projectChip}>
                {selectedProject.name}
                <button
                  type="button"
                  className={styles.chipRemove}
                  onClick={() => setProjectId(null)}
                  aria-label="حذف پروژه"
                >
                  <CloseOutline />
                </button>
              </span>
            ) : (
              <button
                type="button"
                className={styles.rowAdd}
                onClick={() => setProjectSheetOpen(true)}
                aria-label="انتخاب پروژه"
              >
                <AddOutline />
              </button>
            )}
          </div>
        </div>

        <p className={styles.hint}>یادداشت فقط برای امروز ثبت می‌شود و روز آن بعداً تغییر نمی‌کند.</p>
      </div>

      <ActionSheet
        visible={projectSheetOpen}
        actions={projectActions}
        cancelText="انصراف"
        onClose={() => setProjectSheetOpen(false)}
        onMaskClick={() => setProjectSheetOpen(false)}
        onAction={(action) => {
          setProjectId(action.key === 'none' ? null : String(action.key));
          setProjectSheetOpen(false);
        }}
      />
    </div>
  );
}
