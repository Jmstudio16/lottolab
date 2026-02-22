import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en.json';
import fr from './locales/fr.json';
import ht from './locales/ht.json';
import es from './locales/es.json';

const resources = {
  en: { translation: en },
  fr: { translation: fr },
  ht: { translation: ht },
  es: { translation: es }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: ['en', 'fr', 'ht', 'es'],
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'lottolab_language'
    },
    interpolation: {
      escapeValue: false
    },
    react: {
      useSuspense: false
    }
  });

export default i18n;

export const LANGUAGES = [
  { code: 'ht', name: 'Kreyòl Ayisyen', flag: '🇭🇹' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' }
];

export const changeLanguage = (lang) => {
  i18n.changeLanguage(lang);
  localStorage.setItem('lottolab_language', lang);
};
