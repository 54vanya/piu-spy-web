import { combineReducers, createStore, applyMiddleware, compose } from 'redux';
import thunk from 'redux-thunk';
import _ from 'lodash/fp';

import login from 'reducers/login';
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
  login,
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
            results: {
              ...state.results,
              data: `big array, ${_.size(state.results.data)}`,
              results: `big array, ${_.size(state.results.results)}`,
              sharedCharts: 'big object',
              originalData: 'big object',
              resultInfo: 'big object',
              profiles: _.mapValues(
                (pl) => ({
                  ...pl,
                  resultsByGrade: '...',
                  resultsByLevel: '...',
                  rankingHistory: '...',
                  ratingHistory: '...',
                  pp: {
                    pp: pl.pp && pl.pp.pp,
                    scores: '...',
                  },
                }),
                state.results.profiles
              ),
            },
          }),
        })
      )
    : applyMiddleware(thunk)
);
