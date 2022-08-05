import React, { useContext } from 'react';

import _ from 'lodash/fp';

import en from 'constants/translations/en';
import ru from 'constants/translations/ru';
import ua from 'constants/translations/ua';

console.log('navigator.languages = ', navigator.languages.join(', '));

const isUkrainian = _.some(lang => (lang === 'ua' || lang.endsWith('-UA')), navigator.languages);
console.log('isUkrainian = ', isUkrainian);

const isRussian = !isUkrainian && _.some(lang => (lang === 'ru' || lang.endsWith('-RU')), navigator.languages);
console.log('isRussian = ', isRussian);

export const detectedLanguage = isUkrainian ? ua : (isRussian ? ru : en);

const Language = React.createContext(detectedLanguage);
Language.displayName = 'Language';

export const useLanguage = () => {
  return useContext(Language);
};

export { Language };
