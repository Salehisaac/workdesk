import { Button, DotLoading, Toast } from 'antd-mobile';
import { AddOutline, ClockCircleOutline, ExclamationCircleOutline, UnorderedListOutline } from 'antd-mobile-icons';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMe } from '../../../shared/api/me';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { useCreateList, useDeleteList, useJobs, useProject } from '../api';
import { ListColumn } from '../components/board/ListColumn';
import { CreateListSheet } from '../components/CreateListSheet';
import { ProjectHeader } from '../components/ProjectHeader';
import { openProjectTopic } from '../links';
import { summarize } from '../report';
import type { CreateListInput, Job } from '../types';
import styles from './ProjectBoardPage.module.css';

/** A page counts as "the one you're on" once this much of it is in view. */
const ACTIVE_PAGE_RATIO = 0.55;

export function ProjectBoardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { data: project, isLoading, isError } = useProject(projectId);
  const me = useMe();
  const jobs = useJobs();
  const createList = useCreateList(projectId ?? '');
  const deleteList = useDeleteList(projectId ?? '');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeListId, setActiveListId] = useState('');

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const pageRefs = useRef(new Map<string, HTMLElement>());
  /** Live visibility per page — IntersectionObserver only reports what changed. */
  const ratiosRef = useRef(new Map<string, number>());
  /**
   * Set when a list should be scrolled to once it exists in the DOM — by the
   * create sheet, and by `?list=` on arrival.
   *
   * That parameter is what a list's own message in the group links to
   * (startParamRoute + the backend's projectfeed): a list has no screen of its
   * own, so opening one means opening this board on that column. Read once, in
   * the ref's initializer, because it describes how the screen was ENTERED —
   * re-reading it later would fight a user who has since scrolled away.
   */
  const pendingScrollRef = useRef<string | null>(searchParams.get('list'));

  const lists = useMemo(() => project?.lists ?? [], [project]);

  // useJobs() is flat across every project the user can see — and it's the same
  // cached query the home calendar reads, so opening a project doesn't refetch
  // what's already loaded. Narrow it once here; the board buckets it by list and
  // the header summarizes it.
  const projectJobs = useMemo(
    () => (jobs.data ?? []).filter((job) => job.projectId === projectId),
    [jobs.data, projectId],
  );

  const jobsByList = useMemo(() => {
    const map = new Map<string, Job[]>();
    for (const job of projectJobs) {
      const bucket = map.get(job.listId);
      if (bucket) bucket.push(job);
      else map.set(job.listId, [job]);
    }
    return map;
  }, [projectJobs]);

  // The header's meter runs the same summarize() the report page does, over the
  // same jobs — so the number on the board and the number in the report can't
  // drift apart. Held back until the jobs actually arrive: an empty list looks
  // identical to a project with nothing done, and «٪۰» flashing before the data
  // lands reads as bad news rather than as loading.
  const headerStats = useMemo(() => (jobs.data ? summarize(projectJobs) : null), [jobs.data, projectJobs]);

  const openReport = useCallback(() => navigate(`/projects/${projectId}/report`), [navigate, projectId]);

  // Editing (and deleting) a project is its creator's alone — the API refuses
  // everyone else — so the header is only handed the action when it's theirs.
  // `me` failing leaves the button hidden rather than shown-and-refused.
  const isOwner = !!project && !!me.data && project.ownerRefId === me.data.id;
  const openEdit = useCallback(() => navigate(`/projects/${projectId}/edit`), [navigate, projectId]);

  const registerPage = useCallback((listId: string, node: HTMLElement | null) => {
    if (node) pageRefs.current.set(listId, node);
    else pageRefs.current.delete(listId);
  }, []);

  // Which list is on screen, without touching scrollLeft — its sign flips
  // between engines under RTL, whereas intersection ratios don't care about
  // direction at all.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller || lists.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const listId = (entry.target as HTMLElement).dataset.listId;
          if (listId) ratiosRef.current.set(listId, entry.intersectionRatio);
        }
        let best = '';
        let bestRatio = ACTIVE_PAGE_RATIO;
        for (const [listId, ratio] of ratiosRef.current) {
          if (ratio > bestRatio) {
            best = listId;
            bestRatio = ratio;
          }
        }
        if (best) setActiveListId(best);
      },
      { root: scroller, threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    for (const node of pageRefs.current.values()) observer.observe(node);
    return () => observer.disconnect();
  }, [lists]);

  // Default to the first list until the observer has had a chance to report.
  useEffect(() => {
    if (!activeListId && lists.length > 0) setActiveListId(lists[0].id);
  }, [activeListId, lists]);

  // A list created from the sheet doesn't exist in the DOM yet when the
  // mutation resolves — park the id and scroll once the refetch renders it.
  useEffect(() => {
    const pending = pendingScrollRef.current;
    if (!pending) return;
    const node = pageRefs.current.get(pending);
    if (!node) return;
    pendingScrollRef.current = null;
    node.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    setActiveListId(pending);
  }, [lists]);

  async function handleCreateList(input: CreateListInput) {
    try {
      const created = await createList.mutateAsync(input);
      pendingScrollRef.current = created.id;
      setSheetOpen(false);
    } catch (error) {
      Toast.show({ content: error instanceof Error ? error.message : 'ساخت لیست با خطا مواجه شد' });
    }
  }

  async function handleDeleteList(listId: string) {
    try {
      await deleteList.mutateAsync(listId);
      ratiosRef.current.delete(listId);
      if (activeListId === listId) setActiveListId('');
    } catch (error) {
      Toast.show({ content: error instanceof Error ? error.message : 'حذف لیست با خطا مواجه شد' });
    }
  }

  // «فعالیت‌ها» hands the user off to the chat this project already IS: the
  // list currently on screen is a forum topic, so the tap lands them in that
  // topic's conversation rather than in a feed this app would have to build
  // and keep in sync. With no list on screen (or one whose topic the backend
  // has not created yet) it falls back to the project's group.
  function handleOpenActivity() {
    const activeList = lists.find((list) => list.id === activeListId);
    if (openProjectTopic(project?.chatId ?? null, activeList?.topicId)) return;

    Toast.show({
      content: project?.chatId
        ? 'نسخه‌ی رساگرام شما از باز کردن گفتگو پشتیبانی نمی‌کند'
        : 'گفتگوی این پروژه در دسترس نیست',
    });
  }

  if (isError) {
    return (
      <div className={styles.page}>
        <ProjectHeader project={null} stats={null} onBack={() => navigate('/projects')} onOpenReport={openReport} />
        <div className={styles.fill}>
          <EmptyState
            icon={<ExclamationCircleOutline />}
            title="ارتباط برقرار نشد"
            description="بارگذاری این پروژه با خطا مواجه شد. دوباره تلاش کنید."
          />
        </div>
      </div>
    );
  }

  if (isLoading || !project) {
    return (
      <div className={styles.page}>
        <ProjectHeader project={null} stats={null} onBack={() => navigate('/projects')} onOpenReport={openReport} />
        <div className={styles.fill}>
          <EmptyState icon={<DotLoading />} title="در حال بارگذاری…" />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <ProjectHeader
        project={project}
        stats={headerStats}
        onBack={() => navigate('/projects')}
        onOpenReport={openReport}
        onEdit={isOwner ? openEdit : undefined}
      />

      {lists.length === 0 ? (
        <div className={styles.fill}>
          <EmptyState
            icon={<AddOutline />}
            title="هنوز لیستی نساخته‌اید"
            description="با ساختن یک لیست، کارهای این پروژه را دسته‌بندی کنید."
            action={
              <Button color="primary" onClick={() => setSheetOpen(true)}>
                ساخت اولین لیست
              </Button>
            }
          />
        </div>
      ) : (
        <div className={styles.board} ref={scrollerRef} aria-label="لیست‌های پروژه">
          {lists.map((list) => (
            <ListColumn
              key={list.id}
              ref={(node) => registerPage(list.id, node)}
              list={list}
              jobs={jobsByList.get(list.id) ?? []}
              isActive={list.id === activeListId}
              loading={jobs.isLoading}
              onDelete={() => handleDeleteList(list.id)}
              onOpenJob={(jobId) => navigate(`/projects/${projectId}/jobs/${jobId}/edit`)}
            />
          ))}
        </div>
      )}

      {activeListId && (
        <button
          type="button"
          className={styles.fab}
          onClick={() => navigate(`/projects/${projectId}/lists/${activeListId}/jobs/new`)}
        >
          <AddOutline />
          کار جدید
        </button>
      )}

      <div className={styles.footer}>
        <Button fill="none" onClick={handleOpenActivity}>
          <ClockCircleOutline /> فعالیت‌ها
        </Button>
        <Button fill="none" onClick={() => setSheetOpen(true)}>
          <UnorderedListOutline /> لیست
        </Button>
      </div>

      <CreateListSheet
        visible={sheetOpen}
        submitting={createList.isPending}
        onClose={() => setSheetOpen(false)}
        onSubmit={handleCreateList}
      />
    </div>
  );
}
