import _ from 'lodash/fp';
import localForage from 'localforage';
import queryString from 'query-string';

import { RESULTS_CACHE } from 'constants/storageKeys';
import { HOST } from 'constants/backend';
import { DEBUG } from 'constants/env';

import {
  SUCCESS as RESULTS_SUCCESS,
  PROFILES_UPDATE as RESULTS_PROFILES_UPDATE,
  calculateRankingChanges,
} from 'reducers/results';

import WorkerChartsProcessing from 'workerize-loader?inline!utils/workers/chartsPostProcess'; // eslint-disable-line import/no-webpack-loader-syntax
import * as chartsProcessing from 'utils/workers/chartsPostProcess';

import WorkerProfilesProcessing from 'workerize-loader?inline!utils/workers/profilesPostProcess'; // eslint-disable-line import/no-webpack-loader-syntax
import * as profilesProcessing from 'utils/workers/profilesPostProcess';

import { fetchJson } from 'utils/fetch';
import { EMPTY_OBJECT } from '../utils/emptyObjects';

const resultsUrl = process.env.REACT_APP_SOCKET ? 'results/best/trusted' : 'results/best';

const CHARTS_LOADING = `CHARTS_LOADING`;
const CHARTS_LOADING_FINISH = `CHARTS_LOADING_FINISH`;
const SET_CHARTS = `SET_CHARTS`;
const RESET_CHARTS = `RESET_CHARTS`;

const initialState = {
  isLoading: false,
  data: null,
  lastUpdatedOn: null,
};

export default function reducer(state = initialState, action) {
  switch (action.type) {
    case CHARTS_LOADING:
      return {
        ...state,
        isLoading: true,
      };
    case CHARTS_LOADING_FINISH:
      return {
        ...state,
        isLoading: false,
      };
    case SET_CHARTS:
      return {
        ...state,
        data: action.data,
        lastUpdatedOn: action.lastUpdatedOn,
      };
    case RESET_CHARTS:
      return initialState;
    default:
      return state;
  }
}

export const setChartsData = (data, lastUpdatedOn) => ({
  type: SET_CHARTS,
  data,
  lastUpdatedOn,
});
export const startLoadingCharts = () => ({
  type: CHARTS_LOADING,
});
export const endLoadingCharts = () => ({
  type: CHARTS_LOADING_FINISH,
});

export const setAndCacheData = (data, lastUpdatedOn) => (dispatch, getState) => {
  localForage.setItem(RESULTS_CACHE, { data, lastUpdatedOn });
  dispatch(setChartsData(data, lastUpdatedOn));
};

export const resetChartsData = () => ({
  type: RESET_CHARTS,
});

export const loadCachedData = () => async (dispatch, getState) => {
  const cache = await localForage.getItem(RESULTS_CACHE);
  if (cache) {
    console.log('Found cached data from', cache.lastUpdatedOn);
    dispatch(setChartsData(cache.data, cache.lastUpdatedOn));
  }
};

export const fetchChartsData = () => async (dispatch, getState) => {
  dispatch(startLoadingCharts());

  if (!getState().charts.data) {
    // Check if we have any cached data
    performance.mark('cache_start');
    await dispatch(loadCachedData());
    performance.measure('time spent on getting cached data', 'cache_start');
  }

  const { data: cachedData, lastUpdatedOn } = getState().charts;
  const queryParams = lastUpdatedOn ? '?' + queryString.stringify({ since: lastUpdatedOn }) : '';
  const url = `${HOST}/${resultsUrl}${queryParams}`;
  performance.measure('time from page open to requesting /results/best');
  performance.mark('request_start');
  const { charts: fetchedData, lastUpdatedAt: newLastUpdated } = await dispatch(fetchJson({ url }));
  performance.measure('time spent on requesting /results/best', 'request_start');
  const newData = {
    ...(cachedData || EMPTY_OBJECT),
    ...fetchedData,
  };

  await dispatch(setAndCacheData(newData, newLastUpdated));
};

export const postChartsProcessing = () => async (dispatch, getState) => {
  const players = getState().players.data;
  const data = getState().charts.data;
  performance.mark('process_start');

  let processedChartsData = {}
  if (window.Worker) {
    const worker = new WorkerChartsProcessing();
    processedChartsData = worker.processChartsData ? await worker.processChartsData(data, players) : chartsProcessing.processChartsData(data, players);
    worker.terminate();
  } else {
    processedChartsData = chartsProcessing.processChartsData(data, players);
  }
  const { profiles, sharedCharts, /* battles */ } = processedChartsData;
  performance.measure('time spent building charts with results', 'process_start');

  performance.mark('display_start');

  dispatch({
    type: RESULTS_SUCCESS,
    data: _.values(sharedCharts),
    players: _.flow(
      _.toPairs,
      _.map(([id, player]) => ({ ...player, id: _.toInteger(id) })),
    )(players),
    profiles,
    sharedCharts,
  });

  dispatch(endLoadingCharts());

  performance.measure('time spent rendering charts', 'display_start');
  performance.measure('time from page open to displaying first data');

  // Parallelized calculation of ELO and profile data
  const { tracklist } = getState();
  const input = { sharedCharts, profiles, tracklist, /* battles, */ debug: DEBUG };

  performance.mark('elo_calc_start');
  let output;
  if (window.Worker) {
    const worker = new WorkerProfilesProcessing();
    output = worker.getProcessedProfiles ? await worker.getProcessedProfiles(input) : profilesProcessing.getProcessedProfiles(input);
    worker.terminate();
  } else {
    output = profilesProcessing.getProcessedProfiles(input);
  }
  performance.measure('time spent calculating elo/pp and graphs for profiles', 'elo_calc_start');

  DEBUG && console.log(output.logText);
  DEBUG &&
  console.log(
    'Processed profiles:',
    Object.values(output.profiles)
      .filter((q) => q.pp)
      .sort((a, b) => b.pp.pp - a.pp.pp),
  );
  performance.mark('display2_start');
  dispatch({
    type: RESULTS_PROFILES_UPDATE,
    ...output,
  });
  dispatch(calculateRankingChanges(output.profiles));
  performance.measure('time spent rendering update with elo/pp', 'display2_start');
  performance.measure('time from page open to displaying everything');

  console.log(
    performance
      .getEntriesByType('measure')
      .map((x) => `${x.name}: ${x.duration} ms`)
      .join('\n'),
  );
  performance.clearMarks();
  performance.clearMeasures();
};
