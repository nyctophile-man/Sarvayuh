import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Lang, LANGUAGES, localeFor, translations } from './translations';

const STORAGE_KEY = 'sarvayuh.lang';

/** Replace `{placeholders}` in a translated string. */
export function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.prototype.hasOwnProperty.call(params, key) ? String(params[key]) : match,
  );
}

/**
 * Translate `key` for `lang`. Falls back to English and finally to the key
 * itself so a missing translation never breaks a screen.
 */
export function translate(lang: Lang, key: string, params?: Record<string, string | number>): string {
  const dict = translations[lang] ?? translations.en;
  const value = dict[key] ?? translations.en[key] ?? key;
  return interpolate(value, params);
}

/** Best-effort device language detection (Hindi only, everything else is English). */
export function detectDeviceLang(): Lang {
  try {
    const locale =
      (typeof Intl !== 'undefined' && Intl.DateTimeFormat().resolvedOptions().locale) ||
      (typeof navigator !== 'undefined' ? navigator.language : '') ||
      '';
    const lang = String(locale).toLowerCase().split(/[-_]/)[0];
    return lang === 'hi' ? 'hi' : 'en';
  } catch {
    return 'en';
  }
}

type I18nValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  locale: string;
  languages: typeof LANGUAGES;
  ready: boolean;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      let next: Lang | null = null;
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored === 'en' || stored === 'hi') next = stored;
      } catch {
        // storage unavailable — fall back to the device language
      }
      if (!active) return;
      setLangState(next ?? detectDeviceLang());
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => translate(lang, key, params),
    [lang],
  );

  const value = useMemo<I18nValue>(
    () => ({ lang, setLang, t, locale: localeFor(lang), languages: LANGUAGES, ready }),
    [lang, setLang, t, ready],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Access the active language and the `t()` helper.
 * Falls back to a no-op English translator when used outside the provider so
 * isolated components (or tests) never crash.
 */
export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  const fallback = useMemo<I18nValue>(
    () => ({
      lang: 'en',
      setLang: () => {},
      t: (key, params) => translate('en', key, params),
      locale: localeFor('en'),
      languages: LANGUAGES,
      ready: true,
    }),
    [],
  );
  return ctx ?? fallback;
}

export type { Lang };
export default I18nProvider;
