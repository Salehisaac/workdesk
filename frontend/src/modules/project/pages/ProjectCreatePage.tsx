import { NavBar, Toast } from 'antd-mobile';
import { CheckOutline } from 'antd-mobile-icons';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { bridge } from '../../../bridge';
import type { PickedItem } from '../../../bridge/types';
import { StepMembers } from '../components/create-wizard/StepMembers';
import { StepNameAvatar } from '../components/create-wizard/StepNameAvatar';
import { StepVisibility } from '../components/create-wizard/StepVisibility';
import { useCreateProject } from '../api';
import type { CreateProjectInput, ProjectVisibility } from '../types';
import styles from './ProjectCreatePage.module.css';

const STEP_TITLES = ['یک پروژه ایجاد کنید', 'نوع پروژه', 'اضافه کردن اعضاء'];
const STEP_VALIDATION_MESSAGE = [
  'نامی برای پروژه وارد کنید',
  'شناسه باید به زبان انگلیسی و با حرف شروع شود',
  'حداقل یک عضو اضافه کنید',
];
const SLUG_PATTERN = /^[A-Za-z][A-Za-z0-9_-]*$/;

interface WizardState {
  name: string;
  avatarUrl: string | null;
  visibility: ProjectVisibility;
  joinSlug: string;
  members: PickedItem[];
}

const INITIAL_STATE: WizardState = {
  name: '',
  avatarUrl: null,
  visibility: 'private',
  joinSlug: '',
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
    if (step === 1) return state.visibility === 'private' || SLUG_PATTERN.test(state.joinSlug);
    return state.members.length > 0;
  }

  async function handleNext() {
    if (submitting) return;
    if (!isStepValid()) {
      Toast.show({ content: STEP_VALIDATION_MESSAGE[step] });
      return;
    }
    if (step < 2) {
      setStep((s) => s + 1);
      return;
    }
    await handleSubmit();
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      // Group creation happens client-side, via the bridge, before WorkDesk
      // ever hears about this project — see plan section 8. bridge.createGroup
      // is unconfirmed (plan "Open Risks" #1); this call will throw with a
      // clear message until that method exists on Rasagram.WebApp.
      const { userId } = bridge.getEnv();
      const { chatId } = await bridge.createGroup({
        title: state.name,
        forum: true,
        memberIds: [...state.members.map((member) => member.id), userId],
      });

      const input: CreateProjectInput = {
        name: state.name,
        avatarUrl: state.avatarUrl ?? undefined,
        visibility: state.visibility,
        joinSlug: state.visibility === 'public' ? state.joinSlug : undefined,
        chatId,
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
        {step === 0 && (
          <StepNameAvatar name={state.name} avatarUrl={state.avatarUrl} onChange={patch} />
        )}
        {step === 1 && (
          <StepVisibility visibility={state.visibility} joinSlug={state.joinSlug} onChange={patch} />
        )}
        {step === 2 && (
          <StepMembers members={state.members} onChange={(members) => patch({ members })} />
        )}
      </div>
    </div>
  );
}
