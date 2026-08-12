import { NavBar, Toast } from 'antd-mobile';
import { CheckOutline } from 'antd-mobile-icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PickedItem } from '../../../bridge/types';
import { StepMembers } from '../components/create-wizard/StepMembers';
import { StepNameAvatar } from '../components/create-wizard/StepNameAvatar';
import { useCreateProject } from '../api';
import type { CreateProjectInput } from '../types';
import styles from './ProjectCreatePage.module.css';

const STEP_TITLES = ['یک پروژه ایجاد کنید', 'اضافه کردن اعضاء'];
const STEP_VALIDATION_MESSAGE = ['نامی برای پروژه وارد کنید', 'حداقل یک عضو اضافه کنید'];
const LAST_STEP = STEP_TITLES.length - 1;

interface WizardState {
  name: string;
  avatarUrl: string | null;
  members: PickedItem[];
}

const INITIAL_STATE: WizardState = {
  name: '',
  avatarUrl: null,
  members: [],
};

export function ProjectCreatePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [submitting, setSubmitting] = useState(false);
  const createProject = useCreateProject();

  function patch(partial: Partial<WizardState>) {
    setState((prev) => ({ ...prev, ...partial }));
  }

  function isStepValid(): boolean {
    if (step === 0) return state.name.trim().length > 0;
    return state.members.length > 0;
  }

  async function handleNext() {
    if (submitting) return;
    if (!isStepValid()) {
      Toast.show({ content: STEP_VALIDATION_MESSAGE[step] });
      return;
    }
    if (step < LAST_STEP) {
      setStep((s) => s + 1);
      return;
    }
    await handleSubmit();
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      // The backend provisions the project's dedicated topic-group itself
      // now, server-side, via the internal admin API (plan section 8) — no
      // client-side group creation needed before this call.
      // Always private, and no joinSlug: the wizard no longer asks. The API
      // still accepts "public" + a slug, so nothing server-side had to change
      // to drop the question — this is the only caller, and it stopped asking.
      const input: CreateProjectInput = {
        name: state.name,
        avatarUrl: state.avatarUrl ?? undefined,
        visibility: 'private',
        members: state.members,
      };
      const project = await createProject.mutateAsync(input);
      navigate(`/projects/${project.id}`, { replace: true });
    } catch (error) {
      Toast.show({ content: error instanceof Error ? error.message : 'ساخت پروژه با خطا مواجه شد' });
    } finally {
      setSubmitting(false);
    }
  }

  function handleBack() {
    if (step === 0) {
      navigate(-1);
      return;
    }
    setStep((s) => s - 1);
  }

  return (
    <div className={styles.page}>
      <NavBar onBack={handleBack} right={<CheckOutline className={styles.confirm} onClick={handleNext} />}>
        {STEP_TITLES[step]}
      </NavBar>

      <div className={styles.body}>
        <div className={styles.card}>
          {step === 0 && (
            <StepNameAvatar name={state.name} avatarUrl={state.avatarUrl} onChange={patch} />
          )}
          {step === 1 && (
            <StepMembers members={state.members} onChange={(members) => patch({ members })} />
          )}
        </div>
      </div>
    </div>
  );
}
