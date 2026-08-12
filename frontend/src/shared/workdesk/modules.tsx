import { BillOutline, ContentOutline, FileOutline, FolderOutline, TeamOutline, UnorderedListOutline } from 'antd-mobile-icons';
import type { ReactNode } from 'react';

/**
 * WorkDesk's modules, in one place.
 *
 * These are the 5 tools from Balonet's original create-menu
 * (فرم/دفترمالی/پروژه/کارگروه/مخزن‌جلسه) plus یادداشت. Only Project exists so
 * far, per the plan's v1 scoping; the rest are listed so the hub and the create
 * menu reflect WorkDesk's real shape rather than only what's built, and are
 * locked the same way the Mayno reference locks not-yet-available features.
 *
 * The home page's tool grid and the create sheet both read this list, so the
 * two can't drift out of sync — they're two views of the same set.
 */
export interface WorkdeskModule {
  key: string;
  /** Tile caption. The create menu says «<label> جدید». */
  label: string;
  description: string;
  icon: ReactNode;
  /** The module's own screen. Undefined = not built yet. */
  to?: string;
  /** The module's creation flow. Undefined = not built yet. */
  createTo?: string;
  /** Whether it belongs in the home page's tool grid. */
  inToolGrid: boolean;
}

export const WORKDESK_MODULES: WorkdeskModule[] = [
  { key: 'form', label: 'فرم', description: 'ساخت فرم و جمع‌آوری پاسخ‌ها', icon: <ContentOutline />, inToolGrid: true },
  { key: 'ledger', label: 'دفترمالی', description: 'ثبت درآمد و هزینه', icon: <BillOutline />, inToolGrid: true },
  {
    key: 'project',
    label: 'پروژه',
    description: 'ساخت پروژه و دعوت اعضا',
    icon: <UnorderedListOutline />,
    to: '/projects',
    createTo: '/projects/new',
    inToolGrid: true,
  },
  { key: 'workgroup', label: 'کارگروه', description: 'ساخت کارگروه و اعضای آن', icon: <TeamOutline />, inToolGrid: true },
  {
    key: 'meeting-repo',
    label: 'مخزن‌جلسه',
    description: 'بایگانی جلسه‌ها و مصوبه‌ها',
    icon: <FolderOutline />,
    inToolGrid: true,
  },
  // Not a tile — the reference's tool row is the 5 above — but it is creatable,
  // and the day dashboard has a یادداشت‌ها section to put one in.
  { key: 'note', label: 'یادداشت', description: 'یادداشت شخصی برای این روز', icon: <FileOutline />, inToolGrid: false },
];

export const TOOL_GRID_MODULES = WORKDESK_MODULES.filter((module) => module.inToolGrid);
