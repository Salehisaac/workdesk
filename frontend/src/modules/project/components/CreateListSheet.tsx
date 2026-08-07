import { Button, Input, Popup } from 'antd-mobile';
import { useState } from 'react';
import styles from './CreateListSheet.module.css';

interface CreateListSheetProps {
  visible: boolean;
  submitting: boolean;
  onClose: () => void;
  onSubmit: (name: string) => void;
}

export function CreateListSheet({ visible, submitting, onClose, onSubmit }: CreateListSheetProps) {
  const [name, setName] = useState('');

  function handleSubmit() {
    if (!name.trim()) return;
    onSubmit(name.trim());
    setName('');
  }

  return (
    <Popup visible={visible} onMaskClick={onClose} onClose={onClose} bodyStyle={{ borderTopLeftRadius: 12, borderTopRightRadius: 12 }}>
      <div className={styles.sheet}>
        <div className={styles.title}>لیست جدید</div>
        <Input placeholder="نام لیست را وارد کنید" value={name} onChange={setName} autoFocus />
        <Button block color="primary" loading={submitting} disabled={!name.trim()} onClick={handleSubmit}>
          ساخت لیست
        </Button>
      </div>
    </Popup>
  );
}
