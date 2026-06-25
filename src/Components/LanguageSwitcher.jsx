import React from 'react';
import { useLanguage } from '../Contexts/LanguageContext';
import { useTheme } from '../Contexts/ThemeContext';

const LANGUAGES = [
  { code: 'english', label: 'English' },
  { code: 'tamil', label: 'தமிழ்' },
  { code: 'hindi', label: 'हिन्दी' },
  { code: 'telugu', label: 'తెలుగు' },
  { code: 'malayalam', label: 'മലയാളം' },
  { code: 'kannada', label: 'ಕನ್ನಡ' },
];

const LanguageSwitcher = () => {
  const { language, changeLanguage } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const standardCodes = LANGUAGES.map(l => l.code);
  const options = [...LANGUAGES];
  if (language && !standardCodes.includes(language)) {
    const capitalizedLabel = language.charAt(0).toUpperCase() + language.slice(1);
    options.push({ code: language, label: capitalizedLabel });
  }

  return (
    <div style={{ marginLeft: 12 }}>
      <select
        value={language}
        onChange={e => changeLanguage(e.target.value)}
        style={{
          borderRadius: 8,
          padding: '6px 12px',
          fontWeight: 600,
          border: isDark ? '1.5px solid rgba(148, 163, 184, 0.35)' : '1.5px solid #2563eb',
          background: isDark ? '#0f172a' : '#fff',
          color: isDark ? '#e2e8f0' : '#2563eb',
          cursor: 'pointer',
          minWidth: 80,
          colorScheme: isDark ? 'dark' : 'light',
          boxShadow: isDark ? '0 0 0 1px rgba(15, 23, 42, 0.6) inset' : 'none',
        }}
        aria-label="Switch language"
      >
        {options.map(lang => (
          <option key={lang.code} value={lang.code}>{lang.label}</option>
        ))}
      </select>
    </div>
  );
};

export default LanguageSwitcher; 
