import { useWealthStore } from './useWealthStore';
import { translations } from '../i18n/translations';

export function useTranslation() {
  const language = useWealthStore((state) => state.language);
  const setLanguage = useWealthStore((state) => state.setLanguage);

  const t = (key: string): string => {
    const keys = key.split('.');
    let current: any = translations[language];

    for (const k of keys) {
      if (current === undefined || current === null) {
        return key;
      }
      current = current[k];
    }

    if (typeof current === 'string') {
      return current;
    }

    return key;
  };

  return { t, language, setLanguage };
}
