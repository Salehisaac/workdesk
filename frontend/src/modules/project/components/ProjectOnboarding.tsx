import { Button, NavBar } from 'antd-mobile';
import { CheckCircleOutline, QuestionCircleOutline, TeamOutline, UnorderedListOutline } from 'antd-mobile-icons';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WorkdeskMark } from '../../../shared/brand/WorkdeskMark';
import { ProjectsGuideSheet } from './ProjectsGuideSheet';
import styles from './ProjectOnboarding.module.css';

interface Step {
  icon: ReactNode;
  title: string;
  body: string;
}

/**
 * What actually happens, in the order it happens — not a menu of help topics.
 *
 * This screen used to be six rows («امکانات جدید», «راهنمای تصویری», «واژگان و
 * عبارات تخصصی» …) that every one of them answered with a "به‌زودی" toast: a
 * table of contents for documentation that does not exist, standing between
 * someone and the only button on the screen that does anything. Three sentences
 * describing the real hierarchy — project, list, job — teach more in less
 * space, and the one help affordance left («راهنمای پروژه‌ها») opens the guide
 * that is genuinely written.
 */
const STEPS: Step[] = [
  {
    icon: <TeamOutline />,
    title: 'پروژه را بسازید',
    body: 'یک نام، یک نگاره، و همکارانی که در آن کار می‌کنند. همین‌جا گروه پروژه هم ساخته می‌شود.',
  },
  {
    icon: <UnorderedListOutline />,
    title: 'کارها را در لیست‌ها بچینید',
    body: 'هر لیست یک موضوع در گفتگوی همان پروژه است، پس بحث درباره‌ی هر بخش همان‌جا می‌ماند.',
  },
  {
    icon: <CheckCircleOutline />,
    title: 'کار را به کسی بسپارید',
    body: 'با مسئول، برچسب، چک‌لیست و سررسید. سررسیدها در تقویم صفحه‌ی اصلی هم پیدایشان می‌شود.',
  },
];

export function ProjectOnboarding() {
  const navigate = useNavigate();
  const [guideOpen, setGuideOpen] = useState(false);

  return (
    <div className={styles.wrap}>
      <NavBar onBack={() => navigate('/')}>&nbsp;</NavBar>

      <div className={styles.body}>
        <div className={styles.hero}>
          <span className={styles.mark} aria-hidden="true">
            <WorkdeskMark />
          </span>
          <h1 className={styles.title}>پروژه‌ها</h1>
          <p className={styles.subtitle}>کارِ تیم، کنارِ گفتگوی تیم.</p>
        </div>

        {/* Numbered and rail-connected: the three are a sequence, and a plain
            list of cards would let them be read as three separate features. */}
        <ol className={styles.steps}>
          {STEPS.map((step, index) => (
            <li key={step.title} className={styles.step}>
              <span className={styles.stepMarker} aria-hidden="true">
                <span className={styles.stepIcon}>{step.icon}</span>
                <span className={styles.stepNumber}>{index + 1}</span>
              </span>
              <div className={styles.stepText}>
                <h2 className={styles.stepTitle}>{step.title}</h2>
                <p className={styles.stepBody}>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>

        {/* Said before the first project is made, not discovered afterwards:
            creating one provisions a real Rasagram group with real people in
            it, which is not a side effect anyone should meet by surprise. */}
        <p className={styles.note}>
          هر پروژه یک <b>گروه واقعی در رساگرام</b> است — با ساخت پروژه، گروهی با همان نام و همان نگاره ساخته می‌شود
          و کسانی که انتخاب کرده‌اید به آن دعوت می‌شوند.
        </p>
      </div>

      <div className={styles.footer}>
        <Button block color="primary" size="large" onClick={() => navigate('/projects/new')}>
          ساخت اولین پروژه
        </Button>
        <button type="button" className={styles.guideLink} onClick={() => setGuideOpen(true)}>
          <QuestionCircleOutline />
          راهنمای پروژه‌ها
        </button>
      </div>

      {guideOpen && <ProjectsGuideSheet visible={guideOpen} onClose={() => setGuideOpen(false)} />}
    </div>
  );
}
