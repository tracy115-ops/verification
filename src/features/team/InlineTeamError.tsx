import { isMessageKey, useI18n } from '../../shared/i18n/context';
export function InlineTeamError({ code }: { code: string | null }) {
  const { t } = useI18n();
  return code ? (
    <p className="wb-error" role="alert">
      {isMessageKey(code) ? t(code) : t('team_server_error')}
    </p>
  ) : null;
}
