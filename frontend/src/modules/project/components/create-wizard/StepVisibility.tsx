import { Input, Radio, Space } from 'antd-mobile';
import type { ProjectVisibility } from '../../types';
import styles from './StepVisibility.module.css';

// Placeholder domain — correct once the real public join-link host is known.
const JOIN_BASE_URL = import.meta.env.VITE_JOIN_BASE_URL ?? 'https://rasagram.rso-co.ir/join/';

interface StepVisibilityProps {
  visibility: ProjectVisibility;
  joinSlug: string;
  onChange: (patch: { visibility?: ProjectVisibility; joinSlug?: string }) => void;
}

export function StepVisibility({ visibility, joinSlug, onChange }: StepVisibilityProps) {
  return (
    <div className={styles.wrap}>
      <Radio.Group value={visibility} onChange={(value) => onChange({ visibility: value as ProjectVisibility })}>
        <Space direction="vertical" block>
          <Radio value="private" block className={styles.option}>
            <div className={styles.optionTitle}>پروژه خصوصی</div>
            <div className={styles.optionDescription}>عضویت تنها از طریق دعوت امکان‌پذیر است</div>
          </Radio>
          <Radio value="public" block className={styles.option}>
            <div className={styles.optionTitle}>پروژه عمومی</div>
            <div className={styles.optionDescription}>
              قابل دسترسی از طریق جستجو با امکان عضویت آزاد برای همه کاربران
            </div>
          </Radio>
        </Space>
      </Radio.Group>

      {visibility === 'public' && (
        <div className={styles.slugSection}>
          <div className={styles.slugPreview}>
            {JOIN_BASE_URL}
            {joinSlug}
          </div>
          <Input placeholder="شناسه" value={joinSlug} onChange={(value) => onChange({ joinSlug: value })} />
          <div className={styles.slugHint}>شناسه به زبان انگلیسی باشد. کاراکتر اول، حتما حرف باشد.</div>
        </div>
      )}
    </div>
  );
}
