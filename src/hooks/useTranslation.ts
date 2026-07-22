import { useWealthStore } from './useWealthStore';
import { translateI18n } from '../i18n/translations';

export function useTranslation() {
  const language = useWealthStore((state) => state.language);
  const setLanguage = useWealthStore((state) => state.setLanguage);

  const t = (key: string): string => translateI18n(language, key);

  return { t, language, setLanguage };
}
