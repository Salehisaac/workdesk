import { NavBar, Toast } from 'antd-mobile';
import { BillOutline, ContentOutline, FolderOutline, TeamOutline, UnorderedListOutline } from 'antd-mobile-icons';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './HomePage.module.css';

interface Tile {
  icon: ReactNode;
  label: string;
  to?: string; // undefined = not built yet, shows "coming soon"
}

// The 5 middle-row WorkDesk modules from Balonet's original create-menu
// (فرم/دفترمالی/پروژه/کارگروه/مخزن‌جلسه) — only Project exists so far, per
// the plan's explicit v1 scoping. The rest are here so the hub reflects
// WorkDesk's real shape, not just what's built.
const TILES: Tile[] = [
  { icon: <ContentOutline />, label: 'فرم' },
  { icon: <BillOutline />, label: 'دفترمالی' },
  { icon: <UnorderedListOutline />, label: 'پروژه', to: '/projects' },
  { icon: <TeamOutline />, label: 'کارگروه' },
  { icon: <FolderOutline />, label: 'مخزن‌جلسه' },
];

export function HomePage() {
  const navigate = useNavigate();

  return (
    <div className={styles.page}>
      <NavBar backArrow={false}>ورک‌دسک</NavBar>

      <div className={styles.grid}>
        {TILES.map((tile) => (
          <button
            key={tile.label}
            type="button"
            className={`${styles.tile} ${tile.to ? '' : styles.disabled}`}
            onClick={() => (tile.to ? navigate(tile.to) : Toast.show({ content: 'به‌زودی اضافه می‌شود' }))}
          >
            <span className={styles.tileIcon}>{tile.icon}</span>
            <span className={styles.tileLabel}>{tile.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
