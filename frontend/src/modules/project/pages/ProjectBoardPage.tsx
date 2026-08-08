import { Button, DotLoading, List, NavBar, SwipeAction, Toast } from 'antd-mobile';
import { AddOutline, ClockCircleOutline, ExclamationCircleOutline } from 'antd-mobile-icons';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { useCreateList, useDeleteList, useProject } from '../api';
import { CreateListSheet } from '../components/CreateListSheet';
import type { CreateListInput } from '../types';
import styles from './ProjectBoardPage.module.css';

export function ProjectBoardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { data: project, isLoading, isError } = useProject(projectId);
  const createList = useCreateList(projectId ?? '');
  const deleteList = useDeleteList(projectId ?? '');
  const [sheetOpen, setSheetOpen] = useState(false);

  async function handleCreateList(input: CreateListInput) {
    try {
      await createList.mutateAsync(input);
      setSheetOpen(false);
    } catch (error) {
      Toast.show({ content: error instanceof Error ? error.message : 'ساخت لیست با خطا مواجه شد' });
    }
  }

  async function handleDeleteList(listId: string) {
    try {
      await deleteList.mutateAsync(listId);
    } catch (error) {
      Toast.show({ content: error instanceof Error ? error.message : 'حذف لیست با خطا مواجه شد' });
    }
  }

  if (isError) {
    return (
      <div className={styles.page}>
        <NavBar onBack={() => navigate('/projects')}>&nbsp;</NavBar>
        <EmptyState
          icon={<ExclamationCircleOutline />}
          title="ارتباط برقرار نشد"
          description="بارگذاری این پروژه با خطا مواجه شد. دوباره تلاش کنید."
        />
      </div>
    );
  }

  if (isLoading || !project) {
    return (
      <div className={styles.page}>
        <NavBar onBack={() => navigate('/projects')}>&nbsp;</NavBar>
        <EmptyState icon={<DotLoading />} title="در حال بارگذاری…" />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <NavBar onBack={() => navigate('/projects')}>
        <div className={styles.titleBlock}>
          <span className={styles.titleName}>{project.name}</span>
          <span className={styles.titleMeta}>
            {project.memberCount} عضو، {project.onlineCount} نفر آنلاین
          </span>
        </div>
      </NavBar>

      <div className={styles.body}>
        {project.lists.length === 0 ? (
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
        ) : (
          <List>
            {project.lists.map((list) => (
              <SwipeAction
                key={list.id}
                rightActions={[{ key: 'delete', text: 'حذف', color: 'danger', onClick: () => handleDeleteList(list.id) }]}
              >
                <List.Item
                  onClick={() => {
                    Toast.show({ content: 'جزئیات کارهای هر لیست بعدا اضافه می‌شود' });
                  }}
                >
                  <span className={styles.listTitle}>
                    {list.iconEmoji && <span className={styles.listIcon}>{list.iconEmoji}</span>}
                    {list.name}
                  </span>
                </List.Item>
              </SwipeAction>
            ))}
          </List>
        )}
      </div>

      <div className={styles.footer}>
        <Button fill="none" onClick={() => setSheetOpen(true)}>
          <AddOutline /> لیست
        </Button>
        <Button
          fill="none"
          onClick={() => {
            Toast.show({ content: 'فعالیت‌ها بعدا اضافه می‌شود' });
          }}
        >
          <ClockCircleOutline /> فعالیت‌ها
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
