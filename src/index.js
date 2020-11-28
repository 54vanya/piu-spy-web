import 'promise-polyfill';
import 'whatwg-fetch';
import 'utils/polyfills';

import React from 'react';
import ReactDOM from 'react-dom';
import { HashRouter } from 'react-router-dom';
import { Provider } from 'react-redux';

import './index.scss';

import { Language, detectedLanguage } from 'utils/context/translation';

import App from 'components/App';

import { store } from 'reducers';

ReactDOM.render(
  <Language.Provider value={detectedLanguage}>
    <Provider store={store}>
      <HashRouter>
        <App />
      </HashRouter>
    </Provider>
  </Language.Provider>,
  document.getElementById('root')
);
