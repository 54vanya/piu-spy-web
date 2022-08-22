import _ from 'lodash/fp';
import { createSelector } from 'reselect';
import matchSorter from 'match-sorter';

import { SORT, CHART_MIN_MAX, DURATION_DEFAULT, RANK_FILTER } from 'constants/leaderboard';
import { defaultFilter } from 'reducers/results';
import { EMPTY_OBJECT } from '../utils/emptyObjects';

export const playersSelector = createSelector(
  (state) => state.results.players,
  (state) => state.user.data.player.id,
  (players, playerId) =>
    _.flow(
      _.toPairs,
      _.map(([, { nickname, arcade_name, id, region }]) => ({
        label: `${nickname} (${arcade_name})`,
        value: nickname,
        isCurrentPlayer: playerId === id,
      })),
      _.sortBy((it) => (it.isCurrentPlayer ? '!' : _.toLower(it.label)))
    )(players)
);

const filterCharts = (filter, rows) => {
  const range = _.getOr(CHART_MIN_MAX, 'range', filter);
  const type = _.getOr(null, 'type', filter);
  const duration = _.getOr(DURATION_DEFAULT, 'duration', filter);

  return _.filter((row) => {
    if (duration !== DURATION_DEFAULT && !duration.includes(row.duration)) {
      return false;
    }
    return (
      row.chartLevel >= range[0] &&
      row.chartLevel <= range[1] &&
      (!type || row.chartType.startsWith(type))
    );
  }, rows);
};

const getFilteredData = (
  data,
  sharedCharts,
  filter = defaultFilter,
  resultInfo = {},
  preferences
) => {
  if (data.length === 0 || Object.keys(resultInfo).length === 0) {
    return [];
  }
  const start = performance.now();
  const playersHiddenStatus = preferences.playersHiddenStatus;
  const showHidden = filter.showHiddenFromPreferences;
  const names = _.map('value', filter.players);
  const namesOr = _.map('value', filter.playersOr);
  const namesNot = _.map('value', filter.playersNot);
  const sortingType = _.get('value', filter.sortingType);
  const rankFilter = _.get('value', filter.rank) || RANK_FILTER.SHOW_ALL;
  const protagonist = [
    SORT.PROTAGONIST,
    SORT.PP_ASC,
    SORT.PP_DESC,
    SORT.NEW_SCORES_PLAYER,
  ].includes(sortingType)
    ? _.get('value', filter.protagonist)
    : null;
  const excludeAntagonists = _.map('value', filter.excludeAntagonists);

  const defaultSorting = [
    _.orderBy(
      [
        (song) =>
          _.max(
            _.map(
              (res) =>
                showHidden || !playersHiddenStatus[res.playerId] ? res.dateObject.getTime() : 0,
              song.results
            )
          ),
      ],
      ['desc']
    ),
  ];
  const newScoresProtagonistSorting = !protagonist
    ? defaultSorting
    : [
        _.orderBy(
          [
            (song) =>
              _.max(
                _.map(
                  (res) => (res.nickname === protagonist ? res.dateObject.getTime() : 0),
                  song.results
                )
              ),
          ],
          ['desc']
        ),
      ];
  const protagonistSorting = [
    _.filter((row) => _.map('nickname', row.results).includes(protagonist)),
    _.map((row) => {
      const protIndex = _.findIndex({ nickname: protagonist }, row.results);
      const protScore = row.results[protIndex].score;
      const enemies = _.flow([
        _.take(protIndex),
        _.uniqBy('nickname'),
        _.remove((res) => excludeAntagonists.includes(res.nickname) || res.score === protScore),
      ])(row.results);
      const distance = Math.sqrt(
        _.reduce((dist, enemy) => dist + (enemy.score / protScore - 0.99) ** 2, 0, enemies)
      );
      return {
        ...row,
        distanceFromProtagonist: distance,
      };
    }),
    _.orderBy(['distanceFromProtagonist'], ['desc']),
  ];
  const getPpSorting = (field, direction = 'desc') => [
    _.filter((row) => _.map('nickname', row.results).includes(protagonist)),
    _.orderBy(
      [
        (row) => {
          const result = _.find({ nickname: protagonist }, row.results);
          const info = resultInfo[result.id] || EMPTY_OBJECT;
          return _.getOr(direction === 'desc' ? -Infinity : Infinity, field, info);
        },
      ],
      [direction]
    ),
  ];

  const getDiffSorting = (direction = 'desc') => [
    _.orderBy(
      [
        (row) => {
          const chartInfo = sharedCharts[row.sharedChartId];
          return _.getOr(_.toNumber(row.chartLevel), 'interpolatedDifficulty', chartInfo);
        },
      ],
      [direction]
    ),
  ];
  const sortingFunctions =
    {
      [SORT.DEFAULT]: defaultSorting,
      [SORT.NEW_SCORES_PLAYER]: newScoresProtagonistSorting,
      [SORT.PROTAGONIST]: protagonistSorting,
      [SORT.PP_ASC]: getPpSorting('pp.ppRatio', 'asc'),
      [SORT.PP_DESC]: getPpSorting('pp.pp'),
      [SORT.EASIEST_SONGS]: getDiffSorting('asc'),
      [SORT.HARDEST_SONGS]: getDiffSorting('desc'),
    }[sortingType] || defaultSorting;

  const result = _.flow(
    _.compact([
      _.map((row) => {
        let latestScoreDate = null;
        const occuredIds = [];
        const results = row.results.filter((res, index) => {
          const isVisibleWithRankFilter =
            !rankFilter || rankFilter === RANK_FILTER.SHOW_ALL
              ? true
              : rankFilter === RANK_FILTER.SHOW_ONLY_RANK
              ? res.isRank
              : rankFilter === RANK_FILTER.SHOW_ONLY_NORANK
              ? !res.isRank
              : rankFilter === RANK_FILTER.SHOW_BEST
              ? !occuredIds.includes(res.playerId)
              : true;
          rankFilter === RANK_FILTER.SHOW_BEST && occuredIds.push(res.playerId);

          const isVisible = (!res.isUnknownPlayer || index === 0) && isVisibleWithRankFilter;
          if (isVisible && (!latestScoreDate || latestScoreDate < res.date)) {
            latestScoreDate = res.date;
          }
          return isVisible;
        }, row.results);
        return {
          ...row,
          latestScoreDate,
          results,
        };
      }),
      filter.chartRange && ((items) => filterCharts(filter.chartRange, items)),
      (names.length || namesOr.length || namesNot.length) &&
        _.filter((row) => {
          const rowNames = _.map('nickname', row.results);
          return (
            (!names.length || _.every((name) => rowNames.includes(name), names)) &&
            (!namesOr.length || _.some((name) => rowNames.includes(name), namesOr)) &&
            (!namesNot.length || !_.some((name) => rowNames.includes(name), namesNot))
          );
        }),
      _.filter((row) => _.size(row.results)),
      ...sortingFunctions,
      filter.song && ((items) => matchSorter(items, filter.song.trim(), { keys: ['song'] })),
    ])
  )(data);
  console.log('Sorting took', performance.now() - start, 'ms');
  return result;
};

export const filteredDataSelector = createSelector(
  (state) => state.results.data,
  (state) => state.results.sharedCharts,
  (state) => state.results.filter,
  (state) => state.results.resultInfo,
  (state) => state.preferences.data,
  getFilteredData
);

export const sharedChartDataSelector = createSelector(
  (state) => state.results.data,
  (state, props) => props.match.params.sharedChartId,
  (data, sharedChartId) => {
    // eslint-disable-next-line eqeqeq
    const chart = data.filter((chart) => chart.sharedChartId == sharedChartId);
    // console.log(chart);
    return chart;
  }
);
