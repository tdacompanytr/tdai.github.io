
import { tr } from '../locales/tr';

// The app is now Turkish only.
// We keep the hook structure to minimize refactoring in components.

type TranslationKey = keyof typeof tr;

export const useTranslations = () => {
  const t = (key: TranslationKey): string | string[] => {
    // This function is kept for structural consistency, but it will be removed.
    return tr[key];
  };
  
  const lang = 'tr-TR';

  // No need for state or effects as the language is static.

  return { t, lang };
};