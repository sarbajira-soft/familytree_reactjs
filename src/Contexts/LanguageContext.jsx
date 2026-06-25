import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useUser } from './UserContext';
// Simple language management without external translations

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

// Simple language functions
const getCurrentLanguage = () => {
  console.log("language", localStorage.getItem('language'));
  return localStorage.getItem('language') || 'tamil';
};

const setLanguage = (language) => {
  localStorage.setItem('language', language);
};

export const LanguageProvider = ({ children }) => {
  const userContext = useUser();
  const userInfo = userContext?.userInfo;
  const [currentLanguage, setCurrentLanguage] = useState(getCurrentLanguage());
  
  const lastProfileLanguageRef = useRef(null);
  const lastUserIdRef = useRef(null);

  const changeLanguage = (language) => {
    setCurrentLanguage(language);
    setLanguage(language);
  };

  useEffect(() => {
    // Set initial language
    setLanguage(currentLanguage);
  }, []);

  useEffect(() => {
    if (!userInfo?.userId) {
      lastProfileLanguageRef.current = null;
      lastUserIdRef.current = null;
      return;
    }

    if (lastUserIdRef.current !== userInfo.userId) {
      lastProfileLanguageRef.current = null;
      lastUserIdRef.current = userInfo.userId;
    }

    const profileLang = userInfo?.raw?.userProfile?.language?.name || 
                        userInfo?.raw?.userProfile?.language?.isoCode;
    if (profileLang) {
      let resolvedLang = profileLang.toLowerCase().trim();
      if (resolvedLang === 'ml') resolvedLang = 'malayalam';
      if (resolvedLang === 'ta') resolvedLang = 'tamil';
      if (resolvedLang === 'en') resolvedLang = 'english';
      if (resolvedLang === 'hi') resolvedLang = 'hindi';
      if (resolvedLang === 'te') resolvedLang = 'telugu';
      if (resolvedLang === 'kn') resolvedLang = 'kannada';
      if (resolvedLang === 'pa') resolvedLang = 'punjabi';

      if (resolvedLang && resolvedLang !== lastProfileLanguageRef.current) {
        if (resolvedLang !== currentLanguage) {
          setCurrentLanguage(resolvedLang);
          setLanguage(resolvedLang);
        }
        lastProfileLanguageRef.current = resolvedLang;
      }
    }
  }, [userInfo, currentLanguage]);

  const value = {
    language: currentLanguage,
    changeLanguage,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};