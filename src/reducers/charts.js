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

import WorkerProfilesProcessing from 'workerize-loader!utils/workers/profilesPostProcess'; // eslint-disable-line import/no-webpack-loader-syntax
import * as profilesProcessing from 'utils/workers/profilesPostProcess';

import { fetchJson } from 'utils/fetch';
import {
  labelToTypeLevel,
  gradeComparator,
  mapResult,
  initializeProfile,
  getProfileInfoFromResult,
  getMaxRawScore,
} from 'utils/leaderboards';

const processChartsData = (chartsData, players) => {
  // let a0, a1, b0, b1, bSum, c0, c1;
  // a0 = performance.now();
  // bSum = 0;

  //// Initialization
  // Init for TOP
  const getTopResultId = (result) => `${result.sharedChartId}-${result.playerId}-${result.isRank}`;
  const getBestGradeResultId = (result) => `${result.sharedChartId}-${result.playerId}`;
  const top = {}; // Main top scores pbject

  // Battles for ELO calculation
  const battles = [];
  const allResults = [];

  // Profiles for every player
  let profiles = {};

  // Loop 1
  for (let sharedChartId in chartsData) {
    const chartEntry = chartsData[sharedChartId];
    // console.log(chartEntry);
    // Initialize chart info
    const chartInfo = chartEntry.chart;
    const label = _.toUpper(chartInfo.chart_label);
    const [chartType, chartLevel] = labelToTypeLevel(label);
    top[sharedChartId] = {
      song: chartInfo.track_name,
      chartLabel: label,
      chartLevel,
      chartType,
      duration: chartInfo.duration,
      sharedChartId: sharedChartId,
      maxTotalSteps: chartInfo.max_total_steps,
      results: [],
      previousResults: [],
      eachResultPlayerIds: [],
      latestScoreDate: _.last(chartEntry.results).gained,
      maxScore: null,
    };

    // Parsing results
    const topResults = {};
    const bestGradeResults = {};
    _.forEachRight((_result) => {
      if (!players[_result.player]) {
        // Player of this result was not found in list of players. Ignoring this result like it doesn't exist
        return;
      }

      const chartTop = top[sharedChartId];
      const result = mapResult(_result, players, chartTop, sharedChartId);
      const topResultId = getTopResultId(result);
      const bestGradeResultId = getBestGradeResultId(result);

      // b0 = performance.now();
      // Chronological results array to calculate battles order
      const resultIndex = _.sortedLastIndexBy((r) => r.dateObject, result, allResults);
      allResults.splice(resultIndex, 0, result);
      // b1 = performance.now();
      // bSum += b1 - b0;

      // Recording player ids just to calculate total number of results made on this chart (and be able to filter out hidden players)
      chartTop.eachResultPlayerIds.push(result.id);

      // Recording best grade for every player on every chart
      if (
        !bestGradeResults[bestGradeResultId] ||
        gradeComparator[bestGradeResults[bestGradeResultId].grade] < gradeComparator[result.grade]
      ) {
        if (bestGradeResults[bestGradeResultId]) {
          bestGradeResults[bestGradeResultId].isBestGradeOnChart = false;
        }
        result.isBestGradeOnChart = true;
        bestGradeResults[bestGradeResultId] = result;
      }

      // Splitting all results into best results and previous results
      if (!topResults[topResultId]) {
        const newScoreIndex = _.sortedIndexBy((r) => -r.score, result, chartTop.results);
        // Sorted from higher score to lower score
        chartTop.results.splice(newScoreIndex, 0, result);
        topResults[topResultId] = result;

        // Additional info that can be derived from best results:
        if (!result.isRank) {
          if (result.accuracy) {
            const maxScoreCandidate = getMaxRawScore(result);
            if (chartTop.maxScore < maxScoreCandidate) {
              chartTop.maxScore = maxScoreCandidate;
            }
          } else if (chartTop.maxScore && chartTop.maxScore < result.score) {
            chartTop.maxScore = result.score;
          }
        }
        if (!result.isUnknownPlayer && !result.isIntermediateResult) {
          if (!profiles[result.playerId]) {
            initializeProfile(result, profiles, players);
          }
          getProfileInfoFromResult(result, chartTop, profiles);
        }
      } else {
        result.isIntermediateResult = true;
        // Sorted from latest to oldest
        chartTop.previousResults.push(result);
      }
    }, chartsData[sharedChartId].results);
  }

  // c0 = performance.now();
  allResults.forEach((res) => {
    if (!res.isUnknownPlayer) {
      const chartTop = top[res.sharedChartId];

      for (let i = 0; i < chartTop.results.length; i++) {
        const enemyResult = chartTop.results[i];
        if (res.dateObject < enemyResult.dateObject) {
          break;
        }
        if (
          !enemyResult.isUnknownPlayer &&
          enemyResult.isRank === res.isRank &&
          enemyResult.playerId !== res.playerId &&
          res.score &&
          enemyResult.score
        ) {
          battles.push([res, enemyResult, chartTop]);
        }
      }
    }
  });
  // c1 = performance.now();

  // a1 = performance.now();
  // console.log('Perf data:', a1 - a0, bSum, c1 - c0);
  return { profiles, sharedCharts: top, battles };
};

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
    ...(cachedData || {}),
    ...fetchedData,
  };

  await dispatch(setAndCacheData(newData, newLastUpdated));

  const players = getState().players.data;
  performance.mark('process_start');
  const { profiles, sharedCharts, battles } = processChartsData(newData, players);
  performance.measure('time spent building charts with results', 'process_start');

  performance.mark('display_start');
  dispatch({
    type: RESULTS_SUCCESS,
    data: _.values(sharedCharts),
    players: _.flow(
      _.toPairs,
      _.map(([id, player]) => ({ ...player, id: _.toInteger(id) }))
    )(players),
    profiles,
    sharedCharts,
  });
  dispatch(endLoadingCharts());
  performance.measure('time spent rendering charts', 'display_start');
  performance.measure('time from page open to displaying first data');

  // Parallelized calculation of ELO and profile data
  const { tracklist } = getState();
  const input = { sharedCharts, profiles, tracklist, battles, debug: DEBUG };

  performance.mark('elo_calc_start');
  let output;
  if (window.Worker) {
    const worker = new WorkerProfilesProcessing();
    output = await worker.getProcessedProfiles(input);
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
        .sort((a, b) => b.pp.pp - a.pp.pp)
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
      .join('\n')
  );
  performance.clearMarks();
  performance.clearMeasures();
};
