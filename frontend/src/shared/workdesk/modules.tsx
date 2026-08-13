import { BellOutline, BillOutline, ContentOutline, FileOutline, FolderOutline, UnorderedListOutline } from 'antd-mobile-icons';
import type { ReactNode } from 'react';

/**
 * WorkDesk's modules, in one place.
 *
 * Six tools, of which Project, Meeting-repo and Reminder are built; the rest are
 * declared here anyway so the home page's tool grid and the create menu describe
 * the product's real shape instead of only the finished parts. Both surfaces read
 * this list, so they can't drift apart — they're two views of the same set.
 *
 * `action` is the imperative the create menu puts on each card («پروژه‌ای
 * بسازید»), and it is deliberately per-module rather than a "«<label>» جدید"
 * template: what you do with a ledger is not what you do with a form, and a
 * menu that says so is worth more than one that repeats the same word six
 * times.
 */
export interface WorkdeskModule {
  key: string;
  /** Tile caption, and the create card's heading. */
  label: string;
  /** What the module is for — the home grid's tooltip-in-prose. */
  description: string;
  /** Imperative shown under the label in the create menu. */
  action: string;
  icon: ReactNode;
  /** CSS custom property holding this module's tone — see shared/styles/tokens.css. */
  tone: string;
  /** The module's own screen. Undefined = not built yet. */
  to?: string;
  /** The module's creation flow. Undefined = not built yet. */
  createTo?: string;
  /** Whether it belongs in the home page's tool grid. */
  inToolGrid: boolean;
}

export const WORKDESK_MODULES: WorkdeskModule[] = [
  {
    key: 'form',
    label: 'فرم',
    description: 'ساخت فرم و جمع‌آوری پاسخ‌ها',
    action: 'پرسش‌ها را بچینید و پاسخ‌ها را جمع کنید',
    icon: <ContentOutline />,
    tone: 'var(--wd-module-form)',
    inToolGrid: true,
  },
  // The third module that gathers people without provisioning anything: no
  // group like a project, and unlike a session no invite either — its members
  // find the book waiting in their own list.
  {
    key: 'ledger',
    label: 'دفترمالی',
    description: 'ثبت درآمد و هزینه',
    action: 'درآمد و هزینه را ثبت و مانده را دنبال کنید',
    icon: <BillOutline />,
    tone: 'var(--wd-module-ledger)',
    to: '/ledgers',
    createTo: '/ledgers/new',
    inToolGrid: true,
  },
  {
    key: 'project',
    label: 'پروژه',
    description: 'ساخت پروژه و دعوت اعضا',
    action: 'کارهای تیم را کنار گفتگوی تیم بگذارید',
    icon: <UnorderedListOutline />,
    tone: 'var(--wd-module-project)',
    to: '/projects',
    createTo: '/projects/new',
    inToolGrid: true,
  },
  // The second module that messages people directly rather than posting into a
  // group: creating a session DMs every participant a link back into the app.
  {
    key: 'meeting-repo',
    label: 'مخزن‌جلسه',
    description: 'بایگانی جلسه‌ها و مصوبه‌ها',
    action: 'جلسه‌ها و مصوبه‌ها را یک‌جا بایگانی کنید',
    icon: <FolderOutline />,
    tone: 'var(--wd-module-meeting-repo)',
    to: '/sessions',
    createTo: '/sessions/new',
    inToolGrid: true,
  },
  // The one module that talks to a person instead of a project: creating a
  // reminder sends it to the owner's direct chat with the bot.
  {
    key: 'reminder',
    label: 'یادآور',
    description: 'یادآوری که به پیام‌های شما فرستاده می‌شود',
    action: 'زمانی را انتخاب کنید تا پیامش را برایتان بفرستیم',
    icon: <BellOutline />,
    tone: 'var(--wd-module-reminder)',
    to: '/reminders',
    createTo: '/reminders/new',
    inToolGrid: true,
  },
  // Not a tile — the grid holds the five team-facing tools — but it is
  // creatable, and the day dashboard has a یادداشت‌ها section to put one in.
  {
    key: 'note',
    label: 'یادداشت',
    description: 'یادداشت شخصی برای این روز',
    action: 'چیزی را برای همین روز یادداشت کنید',
    icon: <FileOutline />,
    tone: 'var(--wd-module-note)',
    // No `to`: a note has no screen of its own — it is written here and read on
    // the day dashboard.
    createTo: '/notes/new',
    inToolGrid: false,
  },
];

export const TOOL_GRID_MODULES = WORKDESK_MODULES.filter((module) => module.inToolGrid);

/** What the create menu can actually open, in the order it offers them. */
export const CREATABLE_MODULES = WORKDESK_MODULES.filter((module) => module.createTo);

/** Declared, not built — the create menu lists these as a roadmap strip, not as buttons. */
export const PLANNED_MODULES = WORKDESK_MODULES.filter((module) => !module.createTo);
