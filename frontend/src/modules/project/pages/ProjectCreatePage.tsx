import { Button, Dialog, DotLoading, Toast } from 'antd-mobile';
import { InformationCircleOutline, RightOutline } from 'antd-mobile-icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PickedItem } from '../../../bridge/types';
import { meDisplayName, useMe } from '../../../shared/api/me';
import { DEFAULT_PALETTE, paletteByKey, renderMonogramFile } from '../../../shared/brand/monogram';
import { PeoplePicker } from '../../../shared/ui/people/PeoplePicker';
import { useCreateProject, useUploadAvatar } from '../api';
import { ProjectIdentityCard } from '../components/create/ProjectIdentityCard';
import type { CreateProjectInput } from '../types';
import styles from './ProjectCreatePage.module.css';

/**
 * Creating a project — one screen, not a wizard.
 *
 * The two-step version (name+avatar, then members, with a ✓ in the nav bar)
 * borrowed the shape of a messenger's "new group" flow, and paid for it twice:
 * the confirm button was a 22px glyph in the corner that also served as "next",
 * so its meaning changed under the user between steps, and the second step was
 * a hard gate — no members, no project — even though the backend has always
 * been happy to create a solo one. Both facts are gone here. Everything that
 * makes up a project is visible at once, the only primary button says what it
 * does, and an empty team asks once instead of refusing.
 *
 * What the API receives is unchanged: name, an uploaded avatarUrl, private
 * visibility, and the picked members.
 */
export function ProjectCreatePage() {
  const navigate = useNavigate();
  const me = useMe();
  const createProject = useCreateProject();
  const uploadAvatar = useUploadAvatar();

  const [name, setName] = useState('');
  const [paletteKey, setPaletteKey] = useState(DEFAULT_PALETTE.key);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [members, setMembers] = useState<PickedItem[]>([]);
  const [nameInvalid, setNameInvalid] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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
   * The picture the project ships with. An uploaded photo wins; otherwise the
   * monogram is painted and uploaded so the project's Rasagram group isn't
   * created blank.
   *
   * Every failure here is swallowed on purpose: a project without a picture is
   * a cosmetic loss, and refusing to create one over it would be absurd — the
   * backend takes the same position when it can't read the file back.
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

  async function handleSubmit() {
    if (submitting || uploadingPhoto) return;

    const trimmed = name.trim();
    if (!trimmed) {
      setNameInvalid(true);
      return;
    }

    if (members.length === 0) {
      const confirmed = await Dialog.confirm({
        title: 'بدون هم‌تیمی ساخته شود؟',
        content: 'پس از ساخت پروژه نمی‌توانید عضو تازه‌ای اضافه کنید. اگر قرار است کسی در این پروژه باشد، همین حالا اضافه‌اش کنید.',
        confirmText: 'بساز',
        cancelText: 'افزودن هم‌تیمی',
      });
      if (!confirmed) return;
    }

    setSubmitting(true);
    try {
      // The backend provisions the project's dedicated topic-group itself,
      // server-side, via the internal admin API (plan section 8) — no
      // client-side group creation before this call.
      // Always private, and no joinSlug: this screen doesn't ask. The API still
      // accepts "public" + a slug, so nothing server-side had to change to drop
      // the question — this is the only caller, and it stopped asking.
      const input: CreateProjectInput = {
        name: trimmed,
        avatarUrl: await resolveAvatarUrl(trimmed),
        visibility: 'private',
        members,
      };
      const project = await createProject.mutateAsync(input);
      navigate(`/projects/${project.id}`, { replace: true });
    } catch (error) {
      Toast.show({ content: error instanceof Error ? error.message : 'ساخت پروژه با خطا مواجه شد' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={() => navigate(-1)} aria-label="بازگشت">
          <RightOutline />
        </button>
        <h1 className={styles.headerTitle}>پروژه‌ی تازه</h1>
        <span className={styles.headerSpacer} aria-hidden="true" />
      </header>

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

        <PeoplePicker
          members={members}
          ownerName={meDisplayName(me.data)}
          onChange={setMembers}
          title="هم‌تیمی‌ها"
          ownerRoleLabel="مالک"
          hint="اعضا فقط همین حالا انتخاب می‌شوند؛ پس از ساخت پروژه، عضو تازه‌ای به آن اضافه نمی‌شود."
        />

        <p className={styles.note}>
          <InformationCircleOutline className={styles.noteIcon} aria-hidden="true" />
          با ساخت پروژه، گروهی به همین نام در رساگرام ساخته می‌شود و هم‌تیمی‌های بالا به آن دعوت می‌شوند. هر لیستی که
          بعداً بسازید، یک موضوع در همان گروه است.
        </p>
      </div>

      <div className={styles.footer}>
        <Button block color="primary" size="large" loading={submitting} disabled={uploadingPhoto} onClick={handleSubmit}>
          ساخت پروژه
        </Button>
      </div>

      {/* Provisioning the group is several round trips to the admin API and can
          take a few seconds. An honest "this is happening, it takes a moment"
          beats a fake step-by-step progress bar for work whose steps this
          screen genuinely can't observe. */}
      {submitting && (
        <div className={styles.creating} role="status" aria-live="polite">
          <div className={styles.creatingCard}>
            <DotLoading color="primary" />
            <div className={styles.creatingTitle}>در حال ساخت پروژه…</div>
            <div className={styles.creatingBody}>گروه پروژه ساخته می‌شود و اعضا به آن اضافه می‌شوند. چند لحظه طول می‌کشد.</div>
          </div>
        </div>
      )}
    </div>
  );
}
