import { useState } from 'react';
import type { WorkflowRun } from '../../domain/runtime/types';
import type { Conversations } from '../../app/useConversations';
import { isImplementation } from '../../domain/execution/schema';
import { useI18n } from '../../shared/i18n/context';
import { ReviewDialog } from './ReviewDialog';

export function ScriptQuestions({ run, actions }: { run: WorkflowRun; actions: Conversations }) {
  const { t } = useI18n();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);
  const artifact = Object.values(run.artifacts).find((item) => item.type === 'ImplementationBundle');
  if (
    run.status !== 'failed' ||
    run.errorCode !== 'review_unresolved' ||
    !artifact ||
    !isImplementation(artifact.value)
  )
    return null;
  const questions = [...new Set(artifact.value.questions)];
  if (!questions.length) return null;
  return (
    <>
      <button className="workbench-btn" onClick={() => setOpen(true)}>
        {t('openScriptQuestions')}
      </button>
      <ReviewDialog open={open} close={() => setOpen(false)}>
        <section className="session-script-questions">
          <h3>{t('scriptQuestions')}</h3>
          <p>{t('scriptQuestionsHint')}</p>
          {questions.map((question) => (
            <label className="wb-field" key={question}>
              {question}
              <textarea
                className="workbench-textarea"
                value={answers[question] ?? ''}
                maxLength={12000}
                disabled={actions.busy}
                onChange={(event) =>
                  setAnswers((current) => ({ ...current, [question]: event.target.value }))
                }
              />
            </label>
          ))}
          <button
            className="workbench-btn wb-primary"
            disabled={actions.busy || questions.some((question) => !answers[question]?.trim())}
            onClick={() => void actions.reviseScript(run, artifact.digest, answers)}
          >
            {t('regenerateScript')}
          </button>
        </section>
      </ReviewDialog>
    </>
  );
}
