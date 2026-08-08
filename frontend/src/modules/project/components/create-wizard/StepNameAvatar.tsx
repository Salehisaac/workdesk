import { ImageUploader, Input } from 'antd-mobile';
import { useUploadAvatar } from '../../api';
import styles from './StepNameAvatar.module.css';

interface StepNameAvatarProps {
  name: string;
  avatarUrl: string | null;
  onChange: (patch: { name?: string; avatarUrl?: string | null }) => void;
}

export function StepNameAvatar({ name, avatarUrl, onChange }: StepNameAvatarProps) {
  const uploadAvatar = useUploadAvatar();
  const fileList = avatarUrl ? [{ url: avatarUrl }] : [];

  return (
    <div className={styles.wrap}>
      <div className={styles.hint}>نام پروژه را مشخص و یک نگاره برایش انتخاب کنید</div>
      <div className={styles.row}>
        <div className={styles.uploader}>
          <ImageUploader
            value={fileList}
            maxCount={1}
            upload={async (file: File) => {
              const { url } = await uploadAvatar.mutateAsync(file);
              return { url };
            }}
            onChange={(items) => onChange({ avatarUrl: items[0]?.url ?? null })}
          />
        </div>
        <Input
          className={styles.input}
          placeholder="نامی برای پروژه وارد کنید"
          value={name}
          onChange={(value) => onChange({ name: value })}
        />
      </div>
    </div>
  );
}
