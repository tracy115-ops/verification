import {
  parseArtifact,
  isCases,
  isDesign,
  isRequirements,
  isRequirementIncrement,
  isDesignIncrement,
} from '../../domain/runtime/artifacts';
import { isImplementation, isVerdict } from '../../domain/execution/schema';
import { useI18n } from '../../shared/i18n/context';

export function CliReplyPreview({ text, batch = false }: { text: string; batch?: boolean }) {
  const { t, locale } = useI18n();
  let value: unknown;
  try {
    value = parseArtifact(text);
  } catch {
    /* Non-JSON replies are shown as public CLI text. */
  }
  if (batch && isRequirementIncrement(value) && !value.requirements.length)
    return (
      <div className="session-cli-preview">
        <p>{t('analysisEmptyRequirements')}</p>
        {value.questions.map((item, index) => (
          <p key={index}>{item}</p>
        ))}
      </div>
    );
  if (batch && isDesignIncrement(value) && !value.scenarios.length)
    return (
      <div className="session-cli-preview">
        <p>{t('analysisEmptyCross')}</p>
        <p>{value.strategy}</p>
        {value.gaps.map((item, index) => (
          <p key={index}>{item}</p>
        ))}
      </div>
    );
  if (isRequirements(value))
    return (
      <div className="session-cli-preview">
        <p>
          {t('artifactRequirementsCount').replace(
            '{count}',
            new Intl.NumberFormat(locale).format(value.requirements.length),
          )}
        </p>
        <ul>
          {value.requirements.slice(0, 5).map((item) => (
            <li key={item.id}>
              <code>{item.id}</code> {item.text}
            </li>
          ))}
        </ul>
      </div>
    );
  if (isDesign(value))
    return (
      <div className="session-cli-preview">
        <p>{value.strategy}</p>
        <ul>
          {value.scenarios.slice(0, 5).map((item) => (
            <li key={item.id}>
              <code>{item.id}</code> {item.title}
            </li>
          ))}
        </ul>
      </div>
    );
  if (isCases(value))
    return (
      <div className="session-cli-preview">
        <p>
          {t('artifactCasesCount').replace(
            '{count}',
            new Intl.NumberFormat(locale).format(value.cases.length),
          )}
        </p>
        <ul>
          {value.cases.slice(0, 5).map((item) => (
            <li key={item.id}>
              <code>{item.id}</code> {item.title}
            </li>
          ))}
        </ul>
      </div>
    );
  if (isImplementation(value))
    return (
      <div className="session-cli-preview">
        <p>
          {t('artifactTestsCount').replace(
            '{count}',
            new Intl.NumberFormat(locale).format(value.tests.length),
          )}
        </p>
        <ul>
          {value.tests.slice(0, 5).map((item) => (
            <li key={item.testName}>
              <code>{item.testName}</code>
            </li>
          ))}
        </ul>
        {value.questions.map((question, i) => (
          <p key={i}>{question}</p>
        ))}
      </div>
    );
  if (isVerdict(value))
    return (
      <div className="session-cli-preview">
        {value.candidates.slice(0, 5).map((item) => (
          <p key={item.id}>
            <strong>{item.title}</strong>
            <br />
            {item.explanation}
          </p>
        ))}
        {value.notes.map((note, i) => (
          <p key={i}>{note}</p>
        ))}
      </div>
    );
  return <div className="session-message-text">{text.length > 1600 ? `${text.slice(0, 1600)}…` : text}</div>;
}
