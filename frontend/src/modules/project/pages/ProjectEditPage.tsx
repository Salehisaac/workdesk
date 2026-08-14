import { Button, Dialog, DotLoading, Toast } from 'antd-mobile';
import { DeleteOutline, ExclamationCircleOutline, RightOutline } from 'antd-mobile-icons';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMe } from '../../../shared/api/me';
import { DEFAULT_PALETTE, paletteByKey, renderMonogramFile } from '../../../shared/brand/monogram';
import { EmptyState } from '../../../shared/ui/EmptyState';
import { useDeleteProject, useProject, useUpdateProject, useUploadAvatar } from '../api';
import { ProjectIdentityCard } from '../components/create/ProjectIdentityCard';
import type { UpdateProjectInput } from '../types';
import styles from './ProjectEditPage.module.css';

/**
 * Editing a project — the create screen with its fields already filled, plus the
 * one thing only this screen can do: delete the project.
 *
 * What's editable is deliberately narrow. A project's members are the members of
 * its Rasagram group, and people are added or removed there, not here — so this
 * is its identity and nothing else: the name and the picture.
 *
 * Both actions are the creator's alone. The backend enforces that on every write
 * (403 otherwise); this screen only avoids offering what would be refused, and
 * says so plainly rather than showing a form that can't be saved.
 */
export function ProjectEditPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const me = useMe();
  const { data: project, isLoading, isError } = useProject(projectId);
  const updateProject = useUpdateProject(projectId ?? '');
  const deleteProject = useDeleteProject(projectId ?? '');
  const uploadAvatar = useUploadAvatar();

  const [name, setName] = useState('');
  const [paletteKey, setPaletteKey] = useState(DEFAULT_PALETTE.key);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [nameInvalid, setNameInvalid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // The form is filled from the project once, when it arrives. A ref rather than
  // a dependency on `project`, because the query refetches (creating a list from
  // the board invalidates it) and a refetch must not overwrite what someone is
  // in the middle of typing.
  const filled = useRef(false);
  useEffect(() => {
    if (filled.current || !project) return;
    filled.current = true;
    setName(project.name);
    setPhotoUrl(project.avatarUrl);
  }, [project]);

  // Only when we positively know it's someone else's project: `me` is allowed to
  // fail (see useMe), and a failed identity lookup must not lock the owner out
  // of their own screen — the backend is what actually decides.
  const notOwner = !!project && !!me.data && project.ownerRefId !== me.data.id;

  async function handlePhotoPicked(file: File) {
    setUploadingPhoto(true);
    try {
      const { url } = await uploadAvatar.mutateAsync(file);
      setPhotoUrl(url);
    } catch (error) {
      Toast.show({ content: error instanceof Error ? error.message : 'بارگذاری عکس با خطا مواجه شد' });
    } finally {
      setUploadingPhoto(false);
    }
  }

  /**
   * The picture to save. An uploaded photo (or the one the project already had)
   * wins; with none — «حذف عکس» puts the screen back here — a monogram is
   * painted in the chosen palette and uploaded, exactly as the create screen
   * does, so a project is never left without one.
   *
   * Returns undefined when that fails, which the caller reads as "leave the
   * picture alone": losing a repaint is cosmetic, and it must not cost the
   * rename it was saved alongside.
   */
  async function resolveAvatarUrl(projectName: string): Promise<string | undefined> {
    if (photoUrl) return photoUrl;
    try {
      const monogram = await renderMonogramFile(projectName, paletteByKey(paletteKey));
      if (!monogram) return undefined;
      const { url } = await uploadAvatar.mutateAsync(monogram);
      return url;
    } catch {
      return undefined;
    }
  }

  async function handleSave() {
    if (submitting || uploadingPhoto || !project) return;

    const trimmed = name.trim();
    if (!trimmed) {
      setNameInvalid(true);
      return;
    }

    setSubmitting(true);
    try {
      // PATCH: only what actually changed goes up, so saving a screen the user
      // only looked at writes nothing.
      const input: UpdateProjectInput = {};
      if (trimmed !== project.name) input.name = trimmed;

      const avatarUrl = await resolveAvatarUrl(trimmed);
      if (avatarUrl && avatarUrl !== project.avatarUrl) input.avatarUrl = avatarUrl;

      if (Object.keys(input).length > 0) await updateProject.mutateAsync(input);
      navigate(`/projects/${project.id}`, { replace: true });
    } catch (error) {
      Toast.show({ content: error instanceof Error ? error.message : 'ذخیره‌ی پروژه با خطا مواجه شد' });
    } finally {
      setSubmitting(false);
    }
  }

  /**
   * The warning is the point of this handler. Deleting a project deletes its
   * group in the messenger — every list is a topic in that group, so the lists,
   * the jobs and every conversation held in them go with it, for everyone, with
   * no undo on either side. Nobody should discover that after the fact, so it is
   * spelled out before anything is called.
   */
  async function handleDelete() {
    if (deleting || !project) return;

    const confirmed = await Dialog.confirm({
      title: `«${project.name}» حذف شود؟`,
      content: (
        <div className={styles.dangerBody}>
          گروه این پروژه در پیام‌رسان هم حذف می‌شود: همه‌ی لیست‌ها (موضوع‌های گروه)، کارها و گفتگوهای داخلشان برای
          همه‌ی اعضا از بین می‌رود. این کار برگشت‌پذیر نیست.
        </div>
      ),
      confirmText: 'حذف پروژه',
      cancelText: 'انصراف',
    });
    if (!confirmed) return;

    setDeleting(true);
    try {
      await deleteProject.mutateAsync();
      Toast.show({ content: 'پروژه حذف شد' });
      navigate('/projects', { replace: true });
    } catch (error) {
      Toast.show({ content: error instanceof Error ? error.message : 'حذف پروژه با خطا مواجه شد' });
    } finally {
      setDeleting(false);
    }
  }

  const header = (
    <header className={styles.header}>
      <button type="button" className={styles.back} onClick={() => navigate(-1)} aria-label="بازگشت">
        <RightOutline />
      </button>
      <h1 className={styles.headerTitle}>ویرایش پروژه</h1>
      <span className={styles.headerSpacer} aria-hidden="true" />
    </header>
  );

  if (isError || notOwner) {
    return (
      <div className={styles.page}>
        {header}
        <div className={styles.fill}>
          <EmptyState
            icon={<ExclamationCircleOutline />}
            title={notOwner ? 'دسترسی ندارید' : 'ارتباط برقرار نشد'}
            description={
              notOwner
                ? 'ویرایش و حذف پروژه فقط از سازنده‌ی آن برمی‌آید.'
                : 'بارگذاری این پروژه با خطا مواجه شد. دوباره تلاش کنید.'
            }
          />
        </div>
      </div>
    );
  }

  if (isLoading || !project) {
    return (
      <div className={styles.page}>
        {header}
        <div className={styles.fill}>
          <EmptyState icon={<DotLoading />} title="در حال بارگذاری…" />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {header}

      <div className={styles.body}>
        <ProjectIdentityCard
          name={name}
          paletteKey={paletteKey}
          photoUrl={photoUrl}
          uploading={uploadingPhoto}
          invalid={nameInvalid}
          onNameChange={(value) => {
            setName(value);
            if (nameInvalid && value.trim()) setNameInvalid(false);
          }}
          onPaletteChange={setPaletteKey}
          onPhotoPicked={handlePhotoPicked}
          onPhotoCleared={() => setPhotoUrl(null)}
        />

        <section className={styles.danger}>
          <span className={styles.dangerTitle}>حذف پروژه</span>
          <span className={styles.dangerBody}>
            پروژه و گروهش در پیام‌رسان با هم حذف می‌شوند — همراه با همه‌ی لیست‌ها و کارها. پیش از حذف یک بار
            می‌پرسیم، اما بعد از آن راه برگشتی نیست.
          </span>
          <button type="button" className={styles.dangerButton} onClick={handleDelete} disabled={deleting}>
            {deleting ? <DotLoading color="white" /> : <DeleteOutline />}
            حذف پروژه
          </button>
        </section>
      </div>

      <div className={styles.footer}>
        <Button
          block
          color="primary"
          size="large"
          loading={submitting}
          disabled={uploadingPhoto || deleting}
          onClick={handleSave}
        >
          ذخیره‌ی تغییرات
        </Button>
      </div>
    </div>
  );
}
