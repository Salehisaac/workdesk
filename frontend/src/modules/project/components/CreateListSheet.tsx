import { Button, Input, Popup } from 'antd-mobile';
import { CheckOutline } from 'antd-mobile-icons';
import type { CSSProperties } from 'react';
import { useState } from 'react';
import { FORUM_TOPIC_COLORS } from '../api';
import type { CreateListInput } from '../types';
import styles from './CreateListSheet.module.css';

interface CreateListSheetProps {
  visible: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (input: CreateListInput) => void;
}

export function CreateListSheet({ visible, submitting, onClose, onSubmit }: CreateListSheetProps) {
  const [name, setName] = useState('');
  const [iconColor, setIconColor] = useState<number | undefined>(undefined);

  function handleSubmit() {
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), iconColor });
    setName('');
    setIconColor(undefined);
  }

  return (
    <Popup visible={visible} onMaskClick={onClose} onClose={onClose} bodyStyle={{ borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
      <div className={styles.sheet}>
        <div className={styles.title}>لیست جدید</div>
        <Input placeholder="نام لیست را وارد کنید" value={name} onChange={setName} autoFocus />

        <div className={styles.colorSection}>
          <div className={styles.colorLabel}>آیکون موضوع</div>
          <div className={styles.colorRow}>
            {FORUM_TOPIC_COLORS.map((color) => (
              <button
                key={color.value}
                type="button"
                aria-label={color.label}
                className={styles.colorSwatch}
                style={{ '--swatch-color': `#${color.value.toString(16).padStart(6, '0')}` } as CSSProperties}
                onClick={() => setIconColor(color.value === iconColor ? undefined : color.value)}
              >
                {iconColor === color.value && <CheckOutline className={styles.colorCheck} />}
              </button>
            ))}
          </div>
        </div>

        <Button block color="primary" loading={submitting} disabled={!name.trim()} onClick={handleSubmit}>
          ساخت لیست
        </Button>
      </div>
    </Popup>
  );
}
