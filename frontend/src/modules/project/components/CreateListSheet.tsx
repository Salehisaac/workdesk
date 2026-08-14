import { Button, Input, Popup } from 'antd-mobile';
import { CloseOutline, SmileOutline } from 'antd-mobile-icons';
import { useState } from 'react';
import { useTopicIcons } from '../api';
import type { CreateListInput, TopicIcon } from '../types';
import { AnimatedTopicIcon } from './AnimatedTopicIcon';
import styles from './CreateListSheet.module.css';

interface CreateListSheetProps {
  visible: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (input: CreateListInput) => void;
}

export function CreateListSheet({ visible, submitting, onClose, onSubmit }: CreateListSheetProps) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<TopicIcon | undefined>(undefined);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Only fetched once the picker is actually opened — no reason to fire it
  // on every sheet mount.
  const topicIcons = useTopicIcons(pickerOpen);

  function handleSubmit() {
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), iconCustomEmojiId: icon?.customEmojiId, iconEmoji: icon?.emoji, iconFileId: icon?.fileId });
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
              {icon ? <AnimatedTopicIcon fileId={icon.fileId} fallbackEmoji={icon.emoji} size={24} /> : <SmileOutline />}
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
                {/* Plain emoji, not AnimatedTopicIcon — deliberately.

                    Every animated icon costs a request (which the backend turns
                    into two Bot API round trips), a Lottie parse, an SVG tree and
                    a requestAnimationFrame loop that never stops. Opening this
                    grid started all of that for every icon on screen at once —
                    ~35 at seven columns — and more with every scroll, which is
                    exactly the freeze this picker had; closing it, and killing
                    35 render loops, is why the app recovered the moment an icon
                    was chosen.

                    Nothing is lost: you come here to *identify* an icon, and the
                    static glyph is what identifies it — the animation is a
                    property of the icon you picked, so it plays where that one
                    is shown (the trigger below, and the list's own header on the
                    board). */}
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
                    <span className={styles.emojiGlyph} aria-hidden="true">
                      {option.emoji}
                    </span>
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
