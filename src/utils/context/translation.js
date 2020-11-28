import React, { useContext } from 'react';

import en from 'constants/translations/en';
import ru from 'constants/translations/ru';

const isRussian = navigator.language.includes('ru');

export const detectedLanguage = isRussian ? ru : en;

const Language = React.createContext(detectedLanguage);
Language.displayName = 'Language';

export const useLanguage = () => {
  return useContext(Language);
};

export { Language };
