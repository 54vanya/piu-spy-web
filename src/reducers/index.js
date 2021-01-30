import _ from 'lodash/fp';
import { combineReducers, createStore, applyMiddleware, compose } from 'redux';
import thunk from 'redux-thunk';

import charts from 'reducers/charts';
import login from 'reducers/login';
import players from 'reducers/players';
import popups from 'reducers/popups';
import preferences from 'reducers/preferences';
import presets from 'reducers/presets';
import profiles from 'reducers/profiles';
import results from 'reducers/results';
import topPerSong from 'reducers/topPerSong';
import tournament from 'reducers/tournament';
import tracklist from 'reducers/tracklist';
import trackStats from 'reducers/trackStats';
import user from 'reducers/user';

const rootReducer = combineReducers({
  charts,
  login,
  players,
  popups,
  preferences,
  presets,
  profiles,
  results,
  topPerSong,
  tournament,
  tracklist,
  trackStats,
  user,
});

const stateSanitizer = (x) => {
  if (_.isArray(x)) {
    return x.length > 20 ? [{ length: x.length }, ...x.slice(0, 20)] : x;
  }
  if (_.isPlainObject(x)) {
    const keys = _.keys(x);
    if (keys.length > 20) {
      return keys.slice(0, 20).reduce((acc, key) => {
        acc[key] = stateSanitizer(x[key]);
        return acc;
      }, {});
    } else {
      return _.mapValues(stateSanitizer, x);
    }
  }
  return x;
};

export const store = createStore(
  rootReducer,
  window.__REDUX_DEVTOOLS_EXTENSION__ && process.env.NODE_ENV === 'development'
    ? compose(
        applyMiddleware(thunk),
        window.__REDUX_DEVTOOLS_EXTENSION__({
          stateSanitizer,
          // ({
          //   ...state,
          //   charts: {
          //     ...state.charts,
          //     data: `big object`,
          //   },
          //   results: {
          //     ...state.results,
          //     data: `big array`,
          //     results: `big array`,
          //     sharedCharts: 'big object',
          //     originalData: 'big object',
          //     resultInfo: 'big object',
          //     profiles: `big object`,
          //   },
          // }),
        })
      )
    : applyMiddleware(thunk)
);
