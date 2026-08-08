import { Button, Input, Popup } from 'antd-mobile';
import { CloseOutline, SmileOutline } from 'antd-mobile-icons';
import { useState } from 'react';
import { useTopicIcons } from '../api';
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
  const [icon, setIcon] = useState<{ customEmojiId: string; emoji: string } | undefined>(undefined);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Only fetched once the picker is actually opened — the backend route
  // this proxies doesn't exist on the messenger's platform yet, so there's
  // no reason to fire a doomed request on every sheet mount.
  const topicIcons = useTopicIcons(pickerOpen);

  function handleSubmit() {
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), iconCustomEmojiId: icon?.customEmojiId, iconEmoji: icon?.emoji });
    setName('');
    setIcon(undefined);
    setPickerOpen(false);
  }

  return (
    <Popup visible={visible} onMaskClick={onClose} onClose={onClose} bodyStyle={{ borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
      <div className={styles.sheet}>
        <div className={styles.title}>لیست جدید</div>

        <div className={styles.nameRow}>
          <div className={styles.iconTriggerWrap}>
            <button
              type="button"
              className={styles.iconTrigger}
              aria-label={icon ? 'تغییر شکلک' : 'انتخاب شکلک'}
              onClick={() => setPickerOpen((open) => !open)}
            >
              {icon ? icon.emoji : <SmileOutline />}
            </button>
            {icon && (
              <button
                type="button"
                className={styles.iconClear}
                aria-label="حذف شکلک"
                onClick={() => {
                  setIcon(undefined);
                  setPickerOpen(false);
                }}
              >
                <CloseOutline />
              </button>
            )}
          </div>
          <Input className={styles.input} placeholder="نام لیست را وارد کنید" value={name} onChange={setName} autoFocus />
        </div>

        {pickerOpen && (
          <div className={styles.emojiGridWrap}>
            {topicIcons.isLoading && <div className={styles.emojiStatus}>در حال بارگذاری…</div>}
            {topicIcons.isError && <div className={styles.emojiStatus}>بارگذاری شکلک‌ها با خطا مواجه شد</div>}
            {topicIcons.data && topicIcons.data.length === 0 && (
              <div className={styles.emojiStatus}>شکلکی موجود نیست</div>
            )}
            {topicIcons.data && topicIcons.data.length > 0 && (
              <div className={styles.emojiGrid}>
                {topicIcons.data.map((option) => (
                  <button
                    key={option.customEmojiId}
                    type="button"
                    className={styles.emojiOption}
                    onClick={() => {
                      setIcon(option);
                      setPickerOpen(false);
                    }}
                  >
                    {option.emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <Button block color="primary" loading={submitting} disabled={!name.trim()} onClick={handleSubmit}>
          ساخت لیست
        </Button>
      </div>
    </Popup>
  );
}
