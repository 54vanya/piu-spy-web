import 'promise-polyfill';
import 'whatwg-fetch';
import 'utils/polyfills';

import React from 'react';
import ReactDOM from 'react-dom';
import { HashRouter } from 'react-router-dom';
import { Provider } from 'react-redux';

import './index.scss';

import { Language, browserLanguage } from 'utils/context/translation';

import App from 'components/App';

import { store } from 'reducers';

ReactDOM.render(
  <Language.Provider value={browserLanguage}>
    <Provider store={store}>
      <HashRouter>
        <App />
      </HashRouter>
    </Provider>
  </Language.Provider>,
  document.getElementById('root')
);
