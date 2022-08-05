import React, { useContext } from 'react';

import en from 'constants/translations/en';
import ru from 'constants/translations/ru';
import ua from 'constants/translations/ua';

const isUkrainian = navigator.languages.includes('ua') || navigator.languages.includes('ru-UA');
const isRussian = !isUkrainian && navigator.language.includes('ru');

export const detectedLanguage = isUkrainian ? ua : (isRussian ? ru : en);

const Language = React.createContext(detectedLanguage);
Language.displayName = 'Language';

export const useLanguage = () => {
  return useContext(Language);
};

export { Language };
