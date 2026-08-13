import { DotLoading } from 'antd-mobile';
import { CameraOutline, CloseOutline } from 'antd-mobile-icons';
import type { CSSProperties } from 'react';
import { MONOGRAM_PALETTES, monogramGradient, monogramInitial, paletteByKey } from '../../../../shared/brand/monogram';
import styles from './ProjectIdentityCard.module.css';

interface ProjectIdentityCardProps {
  name: string;
  paletteKey: string;
  /** An uploaded photo, once POST /uploads has returned its URL. Null = monogram. */
  photoUrl: string | null;
  uploading: boolean;
  /** Set after a submit attempt with an empty name — drives the inline error, no toast. */
  invalid: boolean;
  onNameChange: (name: string) => void;
  onPaletteChange: (paletteKey: string) => void;
  onPhotoPicked: (file: File) => void;
  onPhotoCleared: () => void;
}

/** What the file input will accept — the same four types the backend allows. */
const ACCEPTED_IMAGE_TYPES = 'image/png,image/jpeg,image/gif,image/webp';

/**
 * The project's identity: its picture and its name, shown as the thing being
 * made rather than as two form fields.
 *
 * The card is painted in the chosen palette and the monogram updates on every
 * keystroke, so the screen answers "what will this look like in my chat list?"
 * while it is still being filled in — which matters more here than in an
 * ordinary form, because this picture leaves the app: it becomes the photo of
 * the Rasagram group the backend provisions for the project.
 */
export function ProjectIdentityCard({
  name,
  paletteKey,
  photoUrl,
  uploading,
  invalid,
  onNameChange,
  onPaletteChange,
  onPhotoPicked,
  onPhotoCleared,
}: ProjectIdentityCardProps) {
  const palette = paletteByKey(paletteKey);
  const initial = monogramInitial(name);

  return (
    <section
      className={styles.card}
      style={{ '--from': palette.from, '--to': palette.to } as CSSProperties}
    >
      <div className={styles.wash} aria-hidden="true" />

      <label className={styles.avatar}>
        <input
          type="file"
          accept={ACCEPTED_IMAGE_TYPES}
          className={styles.fileInput}
          onChange={(event) => {
            const file = event.target.files?.[0];
            // Cleared so picking the *same* file twice still fires a change
            // event — otherwise a failed upload can't be retried by reselecting
            // the image that failed.
            event.target.value = '';
            if (file) onPhotoPicked(file);
          }}
        />

        {photoUrl ? (
          <img className={styles.photo} src={photoUrl} alt="" />
        ) : (
          <span className={styles.monogram} style={{ background: monogramGradient(palette) }}>
            {initial || <CameraOutline />}
          </span>
        )}

        <span className={styles.avatarBadge} aria-hidden="true">
          <CameraOutline />
        </span>

        {uploading && (
          <span className={styles.avatarBusy}>
            <DotLoading color="white" />
          </span>
        )}
        <span className={styles.srOnly}>انتخاب نگاره‌ی پروژه</span>
      </label>

      <input
        className={`${styles.nameInput} ${invalid ? styles.nameInputInvalid : ''}`}
        value={name}
        placeholder="نام پروژه"
        maxLength={64}
        aria-label="نام پروژه"
        aria-invalid={invalid}
        onChange={(event) => onNameChange(event.target.value)}
      />

      {invalid && <span className={styles.error}>نامی برای پروژه بنویسید</span>}

      {photoUrl ? (
        <button type="button" className={styles.clearPhoto} onClick={onPhotoCleared}>
          <CloseOutline />
          حذف عکس
        </button>
      ) : (
        <div className={styles.palette} role="radiogroup" aria-label="رنگ نگاره">
          {MONOGRAM_PALETTES.map((option) => (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={option.key === palette.key}
              aria-label={option.label}
              className={styles.swatch}
              data-selected={option.key === palette.key || undefined}
              style={{ background: monogramGradient(option) }}
              onClick={() => onPaletteChange(option.key)}
            />
          ))}
        </div>
      )}

      <p className={styles.caption}>
        {photoUrl ? 'همین عکس، عکس گروه پروژه هم می‌شود.' : 'اگر عکسی انتخاب نکنید، همین نگاره‌ی رنگی عکس گروه پروژه می‌شود.'}
      </p>
    </section>
  );
}
