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

export const store = createStore(
  rootReducer,
  window.__REDUX_DEVTOOLS_EXTENSION__ && process.env.NODE_ENV === 'development'
    ? compose(
        applyMiddleware(thunk),
        window.__REDUX_DEVTOOLS_EXTENSION__({
          stateSanitizer: (state) => ({
            ...state,
            charts: {
              ...state.charts,
              data: `big object`,
            },
            results: {
              ...state.results,
              data: `big array`,
              results: `big array`,
              sharedCharts: 'big object',
              originalData: 'big object',
              resultInfo: 'big object',
              profiles: `big object`,
            },
          }),
        })
      )
    : applyMiddleware(thunk)
);
