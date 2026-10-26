export interface LanguageOption {
  code: string;
  label: string;
  locale: string;
  nativeName?: string;
  isIndian?: boolean;
}

export const INDIAN_LANGUAGES: LanguageOption[] = [
  { code: 'hi', label: 'Hindi (हिंदी)', locale: 'hi-IN', nativeName: 'हिन्दी', isIndian: true },
  { code: 'hi-en', label: 'Hinglish (Hindi + English)', locale: 'en-IN', nativeName: 'हिंग्लिश', isIndian: true },
  { code: 'ta', label: 'Tamil (தமிழ்)', locale: 'ta-IN', nativeName: 'தமிழ்', isIndian: true },
  { code: 'te', label: 'Telugu (తెలుగు)', locale: 'te-IN', nativeName: 'తెలుగు', isIndian: true },
  { code: 'bn', label: 'Bengali (বাংলা)', locale: 'bn-IN', nativeName: 'বাংলা', isIndian: true },
  { code: 'mr', label: 'Marathi (मराठी)', locale: 'mr-IN', nativeName: 'मराठी', isIndian: true },
  { code: 'gu', label: 'Gujarati (ગુજરાતી)', locale: 'gu-IN', nativeName: 'ગુજરાતી', isIndian: true },
  { code: 'kn', label: 'Kannada (ಕನ್ನಡ)', locale: 'kn-IN', nativeName: 'ಕನ್ನಡ', isIndian: true },
  { code: 'ml', label: 'Malayalam (മലയാളം)', locale: 'ml-IN', nativeName: 'മലയാളം', isIndian: true },
  { code: 'pa', label: 'Punjabi (ਪੰਜਾਬੀ)', locale: 'pa-IN', nativeName: 'ਪੰਜਾਬੀ', isIndian: true },
  { code: 'or', label: 'Odia (ଓଡ଼ିଆ)', locale: 'or-IN', nativeName: 'ଓଡ଼ିଆ', isIndian: true },
  { code: 'ur', label: 'Urdu (اردو)', locale: 'ur-IN', nativeName: 'اردو', isIndian: true },
  { code: 'as', label: 'Assamese (অসমীয়া)', locale: 'as-IN', nativeName: 'অসমীয়া', isIndian: true },
  { code: 'ne', label: 'Nepali (नेपाली)', locale: 'ne-NP', nativeName: 'नेपाली', isIndian: true },
];

export const GLOBAL_LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English (US / International)', locale: 'en-US' },
  { code: 'es', label: 'Spanish (Español)', locale: 'es-ES' },
  { code: 'fr', label: 'French (Français)', locale: 'fr-FR' },
  { code: 'de', label: 'German (Deutsch)', locale: 'de-DE' },
  { code: 'ja', label: 'Japanese (日本語)', locale: 'ja-JP' },
  { code: 'pt', label: 'Portuguese (Português)', locale: 'pt-BR' },
  { code: 'it', label: 'Italian (Italiano)', locale: 'it-IT' },
  { code: 'ar', label: 'Arabic (العربية)', locale: 'ar-SA' },
  { code: 'zh', label: 'Chinese (Mandarin / 中文)', locale: 'zh-CN' },
  { code: 'nl', label: 'Dutch (Nederlands)', locale: 'nl-NL' },
  { code: 'ko', label: 'Korean (한국어)', locale: 'ko-KR' },
  { code: 'ru', label: 'Russian (Русский)', locale: 'ru-RU' },
  { code: 'tr', label: 'Turkish (Türkçe)', locale: 'tr-TR' },
  { code: 'pl', label: 'Polish (Polski)', locale: 'pl-PL' },
  { code: 'sv', label: 'Swedish (Svenska)', locale: 'sv-SE' },
  { code: 'id', label: 'Indonesian (Bahasa Indonesia)', locale: 'id-ID' },
];

export const BUILDER_LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English (US / International)', locale: 'en-US' },
  { code: 'hi', label: 'Hindi (हिंदी)', locale: 'hi-IN', nativeName: 'हिन्दी', isIndian: true },
  { code: 'es', label: 'Spanish (Español)', locale: 'es-ES' },
  { code: 'fr', label: 'French (Français)', locale: 'fr-FR' },
  { code: 'de', label: 'German (Deutsch)', locale: 'de-DE' },
];

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  ...INDIAN_LANGUAGES,
  ...GLOBAL_LANGUAGES,
];

export function getLanguageLocale(code?: string): string {
  if (!code) return 'en-US';
  const cleanCode = code.trim().toLowerCase();
  const match = SUPPORTED_LANGUAGES.find(
    (l) => l.code === cleanCode || l.locale.toLowerCase() === cleanCode
  );
  if (match) return match.locale;
  if (cleanCode.startsWith('hi')) return 'hi-IN';
  if (cleanCode.startsWith('ta')) return 'ta-IN';
  if (cleanCode.startsWith('te')) return 'te-IN';
  if (cleanCode.startsWith('bn')) return 'bn-IN';
  if (cleanCode.startsWith('mr')) return 'mr-IN';
  if (cleanCode.startsWith('gu')) return 'gu-IN';
  if (cleanCode.startsWith('kn')) return 'kn-IN';
  if (cleanCode.startsWith('ml')) return 'ml-IN';
  if (cleanCode.startsWith('pa')) return 'pa-IN';
  if (cleanCode.startsWith('or')) return 'or-IN';
  if (cleanCode.startsWith('ur')) return 'ur-IN';
  if (cleanCode.startsWith('as')) return 'as-IN';
  if (cleanCode.startsWith('ne')) return 'ne-NP';
  if (cleanCode.startsWith('es')) return 'es-ES';
  if (cleanCode.startsWith('fr')) return 'fr-FR';
  if (cleanCode.startsWith('de')) return 'de-DE';
  if (cleanCode.startsWith('ja')) return 'ja-JP';
  if (cleanCode.startsWith('zh')) return 'zh-CN';
  if (cleanCode.startsWith('ar')) return 'ar-SA';
  return 'en-US';
}

export function getLanguageLabel(code?: string): string {
  if (!code) return 'English';
  const match = SUPPORTED_LANGUAGES.find((l) => l.code === code.toLowerCase());
  return match ? match.label : code.toUpperCase();
}
