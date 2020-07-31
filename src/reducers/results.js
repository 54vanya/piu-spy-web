import _ from 'lodash/fp';
import localForage from 'localforage';
import queryString from 'query-string';

import { fetchJson } from 'utils/fetch';
import { getExp } from 'utils/exp';
import { achievements, initialAchievementState } from 'utils/achievements';
import { parseDate } from 'utils/date';
import { getScoreWithoutBonus } from 'utils/score';

import WorkerProfilesProcessing from 'workerize-loader!utils/workers/profilesPostProcess'; // eslint-disable-line import/no-webpack-loader-syntax
import * as profilesProcessing from 'utils/workers/profilesPostProcess';

import { HOST } from 'constants/backend';
import { DEBUG } from 'constants/env';

const LOADING = `TOP/LOADING`;
const STOP_LOADING = `TOP/STOP_LOADING`;
const SUCCESS = `TOP/SUCCESS`;
const ERROR = `TOP/ERROR`;
const SET_FILTER = `TOP/SET_FILTER`;
const RESET_FILTER = `TOP/RESET_FILTER`;
const RANKING_CHANGE_SET = `TOP/RANKING_CHANGE_SET`;
const PROFILES_UPDATE = `TOP/PROFILES_UPDATE`;

const highscoresUrl = process.env.REACT_APP_SOCKET
  ? 'results/highscores/trusted'
  : 'results/highscores';

export const defaultFilter = { showRank: true, showRankAndNorank: true };

const initialState = {
  isLoading: false,
  isLoadingRanking: false,
  data: [],
  filter: defaultFilter,
  players: {},
  profiles: {},
  results: [],
  resultInfo: {},
  sharedCharts: {},
};

export const gradeComparator = {
  '?': 0,
  F: 1,
  D: 2,
  'D+': 3,
  C: 4,
  'C+': 5,
  B: 6,
  'B+': 7,
  A: 8,
  'A+': 9,
  S: 10,
  SS: 11,
  SSS: 12,
};

const tryFixIncompleteResult = (result, maxTotalSteps) => {
  if (!maxTotalSteps) {
    return;
  }
  const infos = [result.perfect, result.great, result.good, result.bad, result.miss];
  let fixableIndex = -1,
    absentNumbersCount = 0,
    localStepSum = 0;
  for (let i = 0; i < 5; ++i) {
    if (!_.isNumber(infos[i])) {
      fixableIndex = i;
      absentNumbersCount++;
    } else {
      localStepSum += infos[i];
    }
  }
  if (absentNumbersCount === 1) {
    result[['perfect', 'great', 'good', 'bad', 'miss'][fixableIndex]] =
      maxTotalSteps - localStepSum;
  }
};

const guessGrade = result => {
  if (result.misses === 0 && result.bads === 0 && result.goods === 0) {
    if (result.greats === 0) {
      return 'SSS';
    } else {
      return 'SS';
    }
  }
  return result.grade;
};

const mapResult = (res, players, chart) => {
  if (typeof res.recognition_notes === 'undefined') {
    // Short result, minimum info, only for ELO calculation
    // Will be replaced with better result later
    return {
      id: res.id,
      isUnknownPlayer: players[res.player].arcade_name === 'PUMPITUP',
      isIntermediateResult: true,
      sharedChartId: res.shared_chart,
      playerId: res.player,
      nickname: players[res.player].nickname,
      nicknameArcade: players[res.player].arcade_name,
      date: res.gained,
      dateObject: parseDate(res.gained),
      grade: res.grade,
      isExactDate: !!res.exact_gain_date,
      score: res.score,
      scoreRaw: getScoreWithoutBonus(res.score, res.grade),
      isRank: !!res.rank_mode,
    };
  }
  // Full best result
  let _r = {
    isUnknownPlayer: players[res.player].arcade_name === 'PUMPITUP',
    isIntermediateResult: false,
    sharedChartId: res.shared_chart,
    id: res.id,
    playerId: res.player,
    nickname: players[res.player].nickname,
    nicknameArcade: players[res.player].arcade_name,
    originalChartMix: res.original_mix,
    originalChartLabel: res.original_label,
    originalScore: res.original_score,
    date: res.gained,
    dateObject: parseDate(res.gained),
    grade: res.grade !== '?' ? res.grade : guessGrade(res),
    isExactDate: !!res.exact_gain_date,
    score: res.score,
    scoreRaw: getScoreWithoutBonus(res.score, res.grade),
    scoreIncrease: res.score_increase,
    calories: res.calories && res.calories / 1000,
    perfect: res.perfects,
    great: res.greats,
    good: res.goods,
    bad: res.bads,
    miss: res.misses,
    combo: res.max_combo,
    mods: res.mods_list,
    isRank: !!res.rank_mode,
    isHJ: (res.mods_list || '').split(' ').includes('HJ'),
    isMachineBest: res.recognition_notes === 'machine_best',
    isMyBest: res.recognition_notes === 'personal_best',
  };

  tryFixIncompleteResult(_r, chart.maxTotalSteps);

  const perfects = Math.sqrt(_r.perfect) * 10;
  const acc = perfects
    ? Math.floor(
        ((perfects * 100 + _r.great * 85 + _r.good * 50 + _r.miss * -20) /
          (perfects + _r.great + _r.good + _r.bad + _r.miss)) *
          100
      ) / 100
    : null;
  const accRaw = _r.perfect
    ? Math.floor(
        ((_r.perfect * 100 + _r.great * 85 + _r.good * 50 + _r.miss * -20) /
          (_r.perfect + _r.great + _r.good + _r.bad + _r.miss)) *
          100
      ) / 100
    : null;

  _r.accuracy = acc < 0 ? 0 : accRaw === 100 ? 100 : acc && +acc.toFixed(2);
  _r.accuracyRaw = _.toNumber(_r.accuracy);
  return _r;
};

const getMaxRawScore = score => {
  return ((score.scoreRaw / score.accuracy) * 100) / (score.isRank ? 1.2 : 1);
};

const initializeProfile = (result, profiles, players) => {
  const id = result.playerId;
  const resultsByLevel = _.fromPairs(Array.from({ length: 28 }).map((x, i) => [i + 1, []]));
  profiles[id] = {
    name: result.nickname,
    nameArcade: result.nicknameArcade,
    resultsByGrade: {},
    resultsByLevel,
    lastResultDate: result.dateObject,
    count: 0,
    battleCount: 0,
    countAcc: 0,
    grades: { F: 0, D: 0, C: 0, B: 0, A: 0, S: 0, SS: 0, SSS: 0 },
    sumAccuracy: 0,
    rankingHistory: [],
    ratingHistory: [],
    lastPlace: null,
    lastBattleDate: 0,
    region: players[id].region,
  };
  profiles[id].achievements = _.flow(
    _.keys,
    _.map(achName => [
      achName,
      { ...(achievements[achName].initialState || initialAchievementState) },
    ]),
    _.fromPairs
  )(achievements);
  profiles[id].exp = 0;
};

const getProfileInfoFromResult = (result, chart, profiles) => {
  const profile = profiles[result.playerId];

  profile.count++;
  if (result.accuracy) {
    profile.countAcc++;
    profile.sumAccuracy += result.accuracy;
  }
  profile.grades[result.grade.replace('+', '')]++;
  if (chart.chartType !== 'COOP' && result.isBestGradeOnChart) {
    profile.resultsByGrade[result.grade] = [
      ...(profile.resultsByGrade[result.grade] || []),
      { result, chart },
    ];
    profile.resultsByLevel[chart.chartLevel] = [
      ...(profile.resultsByLevel[chart.chartLevel] || []),
      { result, chart },
    ];
  }
  if (result.isExactDate && profile.lastResultDate < result.dateObject) {
    profile.lastResultDate = result.dateObject;
  }
  profile.achievements = _.mapValues.convert({ cap: false })((achState, achName) => {
    return achievements[achName].resultFunction(result, chart, achState, profile);
  }, profile.achievements);
  profile.exp += getExp(result, chart);
};

const processData = (data, tracklist) => {
  const { players, results, shared_charts } = data;
  //// Initialization
  // Init for TOP
  const mappedResults = [];
  const getTopResultId = result => `${result.sharedChartId}-${result.playerId}-${result.isRank}`;
  const getBestGradeResultId = result => `${result.sharedChartId}-${result.playerId}`;
  const topResults = {}; // Temp object
  const bestGradeResults = {}; // Temp object
  const top = {}; // Main top scores pbject

  // Battles for ELO calculation
  const battles = [];

  // Profiles for every player
  let profiles = {};

  // Loop 1
  for (let resRaw of results) {
    if (!players[resRaw.player]) {
      // Player of this result was not found in list of players. Ignoring this result like it doesn't exist
      continue;
    }

    const sharedChartId = resRaw.shared_chart;
    // Initialize Song
    if (!top[sharedChartId]) {
      const sharedChart = shared_charts[sharedChartId];
      const label = _.toUpper(sharedChart.chart_label);
      const [chartType, chartLevel] = label.match(/(\D+)|(\d+)/g);
      top[sharedChartId] = {
        song: sharedChart.track_name,
        chartLabel: label,
        chartLevel,
        chartType,
        duration: sharedChart.duration,
        sharedChartId: sharedChartId,
        maxTotalSteps: sharedChart.max_total_steps,
        results: [],
        totalResultsCount: 0,
      };
    }

    // Getting current chart and result (mapped)
    const chartTop = top[sharedChartId];
    const result = mapResult(resRaw, players, chartTop);
    mappedResults.push(result);

    // Inserting result into TOP
    const topResultId = getTopResultId(result);
    const currentTopResult = topResults[topResultId];
    if (!currentTopResult || currentTopResult.score < result.score) {
      if (currentTopResult) {
        const oldScoreIndex = chartTop.results.indexOf(currentTopResult);
        if (oldScoreIndex !== -1) {
          chartTop.results.splice(oldScoreIndex, 1);
        }
      }
      const newScoreIndex = _.sortedLastIndexBy(r => -r.score, result, chartTop.results);
      if (!result.isUnknownPlayer || newScoreIndex === 0) {
        chartTop.results.splice(newScoreIndex, 0, result);
        chartTop.latestScoreDate = result.date;
        chartTop.totalResultsCount++;
        topResults[topResultId] = result;
      }
      if (!result.isUnknownPlayer) {
        chartTop.results.forEach(enemyResult => {
          if (
            !enemyResult.isUnknownPlayer &&
            enemyResult.isRank === result.isRank &&
            enemyResult.playerId !== result.playerId &&
            result.score &&
            enemyResult.score
          ) {
            battles.push([result, enemyResult, chartTop]);
          }
        });
      }
    }

    // Getting best grade of player on this chart
    if (!result.isIntermediateResult) {
      const bestGradeResultId = getBestGradeResultId(result);
      const currentBestGradeRes = bestGradeResults[bestGradeResultId];
      if (
        !currentBestGradeRes ||
        gradeComparator[currentBestGradeRes.grade] <= gradeComparator[result.grade]
      ) {
        // Using <= here, so newer scores always win and rewrite old scores
        currentBestGradeRes && (currentBestGradeRes.isBestGradeOnChart = false);
        result.isBestGradeOnChart = true;
        bestGradeResults[bestGradeResultId] = result;
      }
    }
  }

  // Loop 2, when the TOP is already set up
  for (let chartId in top) {
    const chart = top[chartId];
    chart.maxScore = null;
    for (let result of chart.results) {
      if (!result.isRank) {
        if (result.accuracy) {
          const maxScoreCandidate = getMaxRawScore(result, chart);
          if (chart.maxScore < maxScoreCandidate) {
            chart.maxScore = maxScoreCandidate;
          }
        } else if (chart.maxScore && chart.maxScore < result.score) {
          chart.maxScore = result.score;
        }
      }
      // Getting some info about players
      if (!result.isUnknownPlayer && !result.isIntermediateResult) {
        if (!profiles[result.playerId]) {
          initializeProfile(result, profiles, players);
        }
        getProfileInfoFromResult(result, chart, profiles);
      }
    }
  }

  return { mappedResults, profiles, sharedCharts: top, battles };
};

export default function reducer(state = initialState, action) {
  switch (action.type) {
    case LOADING:
      return {
        ...state,
        isLoading: true,
      };
    case STOP_LOADING:
      return {
        ...state,
        isLoading: false,
      };
    case ERROR:
      return {
        ...state,
        isLoading: false,
        error: action.error,
        data: initialState.data,
        players: initialState.players,
        profiles: initialState.profiles,
        results: initialState.results,
        sharedCharts: initialState.sharedCharts,
        scoreInfo: {},
      };
    case SUCCESS:
      return {
        ...state,
        isLoading: false,
        isLoadingRanking: true,
        data: action.data,
        players: action.players,
        profiles: action.profiles,
        results: action.results,
        sharedCharts: action.sharedCharts,
        originalData: action.originalData,
        scoreInfo: {},
      };
    case PROFILES_UPDATE:
      return {
        ...state,
        isLoadingRanking: false,
        profiles: action.profiles,
        resultInfo: action.resultInfo,
        sharedCharts: action.sharedCharts,
        data: _.values(action.sharedCharts),
      };
    case SET_FILTER:
      return {
        ...state,
        filter: action.filter,
      };
    case RESET_FILTER:
      return {
        ...state,
        filter: defaultFilter,
      };
    case RANKING_CHANGE_SET:
      const hasPrevList = !_.isEmpty(action.listPrev);
      return {
        ...state,
        profiles: _.mapValues(playerOriginal => {
          const player = {
            ...playerOriginal,
            prevRating: _.get(playerOriginal.id, action.rankingsPointsMap),
          };
          if (!hasPrevList) {
            return player; // First time opening this thing and we didn't have any previous data
          }
          if (!_.includes(player.id, action.listPrev)) {
            return { ...player, change: 'NEW' };
          } else if (!_.includes(player.id, action.listNow)) {
            // Should NEVER happen, idk if this is possible
            return { ...player, change: '?' };
          } else {
            return {
              ...player,
              change: _.indexOf(player.id, action.listPrev) - _.indexOf(player.id, action.listNow),
            };
          }
        }, state.profiles),
      };
    default:
      return state;
  }
}

export const fetchResults = () => {
  return async (dispatch, getState) => {
    dispatch({ type: LOADING });
    try {
      const data = await dispatch(
        fetchJson({
          url: `${HOST}/${highscoresUrl}`,
        })
      );
      if (data.error) {
        throw new Error(data.error);
      }
      // HACKS for test
      // data.results = _.dropRight(500, data.results);
      // data.results = _.dropRight(9500, data.results);
      // console.log(1, data.results);
      // data.results = _.filter((res) => res.gained < '2020-07-05 00:00:00', data.results);
      // data.results = _.filter(res => res.gained < '2020-03-12 16:55:00', data.results);
      // data.results = _.filter(res => res.gained < '2020-03-12 16:34:51', data.results);
      // console.log(2, data.results);

      dispatch(processResultsData(data));
    } catch (error) {
      console.log(error);
      dispatch({ type: ERROR, error });
    }
  };
};

export const appendNewResults = lastDate => {
  return async (dispatch, getState) => {
    const { originalData, sharedCharts } = getState().results;
    if (!lastDate) {
      return dispatch(fetchResults());
    }

    dispatch({ type: LOADING });
    try {
      const data = await dispatch(
        fetchJson({
          url: `${HOST}/${highscoresUrl}?${queryString.stringify({ start_date: lastDate })}`,
        })
      );
      if (data.error) {
        throw new Error(data.error);
      }

      const appendedResults = _.filter(result => {
        const currentResults = sharedCharts[result.shared_chart];
        if (!currentResults) {
          return true;
        }
        const oldResult = _.find(
          old =>
            old.id === result.id ||
            (old.playerId === result.player && old.isRank === !!result.rank_mode),
          currentResults.results
        );
        if (!oldResult) {
          if (result.player === 1 && currentResults.results[0].score > result.score) {
            return false;
          }
          return true;
        }
        if (oldResult.id === result.id || oldResult.score >= result.score) {
          return false;
        }
        return true;
      }, data.results);

      console.log('Received results:', data, '; Will append:', appendedResults);

      if (!_.isEmpty(appendedResults)) {
        const mergedData = {
          players: data.players,
          results: [...originalData.results, ...appendedResults],
          shared_charts: { ...originalData.shared_charts, ...data.shared_charts },
        };
        dispatch(processResultsData(mergedData));
      } else {
        dispatch({ type: STOP_LOADING });
      }
    } catch (error) {
      console.log(error);
      dispatch({ type: ERROR, error });
    }
  };
};

const processResultsData = data => {
  return async (dispatch, getState) => {
    const { tracklist } = getState();
    const { sharedCharts, mappedResults, profiles, battles } = processData(data, tracklist);

    dispatch({
      type: SUCCESS,
      data: _.values(sharedCharts),
      players: _.flow(
        _.toPairs,
        _.map(([id, player]) => ({ ...player, id: _.toInteger(id) }))
      )(data.players),
      results: mappedResults,
      profiles,
      sharedCharts,
      originalData: data,
    });

    // Parallelized calculation of ELO and profile data
    const input = { sharedCharts, profiles, tracklist, battles, debug: DEBUG };
    let promise, worker;
    if (window.Worker) {
      worker = new WorkerProfilesProcessing();
      promise = worker.getProcessedProfiles(input);
    } else {
      promise = new Promise(res => res(profilesProcessing.getProcessedProfiles(input)));
    }

    const output = await promise;
    DEBUG && console.log(output.logText);
    DEBUG &&
      console.log(
        'Processed profiles:',
        Object.values(output.profiles)
          .filter(q => q.pp)
          .sort((a, b) => b.pp.pp - a.pp.pp)
      );

    dispatch({
      type: PROFILES_UPDATE,
      ...output,
    });
    dispatch(calculateRankingChanges(output.profiles));
    if (worker) worker.terminate();
  };
};

export const setFilter = filter => ({
  type: SET_FILTER,
  filter,
});

export const resetFilter = () => ({
  type: RESET_FILTER,
});

const getListOfNames = _.map('id');
const getMapOfRatings = _.flow(
  _.map(q => [q.id, q.rating]),
  _.fromPairs
);

export const calculateRankingChanges = profiles => {
  return async (dispatch, getState) => {
    try {
      const ranking = _.orderBy('ratingRaw', 'desc', _.values(profiles));
      const [lastChangedRanking, lastChangedRankingPoints, lastFetchedRanking] = await Promise.all([
        localForage.getItem('lastChangedRanking_v3'),
        localForage.getItem('lastChangedRankingPoints_v3'),
        localForage.getItem('lastFetchedRanking_v3'),
      ]);
      const listNow = getListOfNames(ranking);
      const listLastFetched = getListOfNames(lastFetchedRanking);
      const listLastChanged = getListOfNames(lastChangedRanking);
      const mapPointsNow = getMapOfRatings(ranking);
      const mapPointsLastFetched = getMapOfRatings(lastFetchedRanking);
      const mapPointsLastChanged = getMapOfRatings(lastChangedRankingPoints);

      let rankingsPointsMap = mapPointsLastChanged;
      // console.log(listNow, listLastFetched, listLastChanged);
      // console.log(mapPointsNow, mapPointsLastFetched, mapPointsLastChanged);
      if (!_.isEqual(mapPointsNow, mapPointsLastFetched)) {
        // Between this fetch and last fetch there was a CHANGE in ranking
        localForage.setItem('lastChangedRankingPoints_v3', lastFetchedRanking);
        rankingsPointsMap = mapPointsLastFetched;
      }
      let listPrev = listLastChanged;
      if (!_.isEqual(listNow, listLastFetched)) {
        // Between this fetch and last fetch there was a CHANGE in ranking
        localForage.setItem('lastChangedRanking_v3', lastFetchedRanking);
        listPrev = listLastFetched;
      }
      dispatch({
        type: RANKING_CHANGE_SET,
        listNow,
        listPrev,
        rankingsPointsMap,
      });
      localForage.setItem('lastFetchedRanking_v3', ranking);
    } catch (error) {
      console.warn('Cannot get ranking from local storage', error);
    }
  };
};
