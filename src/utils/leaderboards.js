import React from 'react';
import _ from 'lodash/fp';
import TimeAgo from 'javascript-time-ago';
import ru from 'javascript-time-ago/locale/ru';
import { convenient } from 'javascript-time-ago/gradation';
import moment from 'moment';

import { parseDate } from 'utils/date';
import { getScoreWithoutBonus } from 'utils/score';
import { getExp } from 'utils/exp';
import { achievements, initialAchievementState } from 'utils/achievements';

TimeAgo.addLocale(ru);
const timeAgo = new TimeAgo('ru-RU');

const timeStyle = {
  flavour: 'long',
  gradation: convenient,
  units: ['day', 'week', 'month'],
};
export const tooltipFormatter = (result) => {
  if (!result.isExactDate) {
    const resultType =
      result.isMyBest === undefined && result.isMachineBest === undefined
        ? 'с my best или machine best'
        : result.isMyBest
        ? 'с my best'
        : result.isMachineBest
        ? 'с machine best'
        : 'хз откуда';
    return (
      <div style={{ display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
        <div>точная дата взятия неизвестна</div>
        <div>скор был записан {resultType}</div>
        <div>дата записи: {result.dateObject.toLocaleDateString()}</div>
      </div>
    );
  } else {
    return result.dateObject.toLocaleDateString();
  }
};

export const getTimeAgo = (lang, date) => {
  const dayDiff = moment().startOf('day').diff(moment(date).startOf('day'), 'days');
  const hour = moment(date).hour();
  if (moment().hour() < 5) {
    return dayDiff <= 1 ? lang.TODAY : timeAgo.format(date, timeStyle);
  }
  return dayDiff === 0
    ? hour < 5
      ? lang.YESTERDAY_NIGHT
      : lang.TODAY
    : dayDiff === 1
    ? lang.YESTERDAY
    : timeAgo.format(date, timeStyle);  // TODO: translate date!
};

export const labelToTypeLevel = (label) => {
  const [type, level] = label ? label.match(/(\D+)|(\d+)/g) : [];
  return [type, level];
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

const guessGrade = (result) => {
  if (result.misses === 0 && result.bads === 0 && result.goods === 0) {
    if (result.greats === 0) {
      return 'SSS';
    } else {
      return 'SS';
    }
  }
  return result.grade;
};

export const mapResult = (res, players, chart, chartId) => {
  const grade = res.grade !== '?' ? res.grade : guessGrade(res);

  if (typeof res.recognition_notes === 'undefined') {
    // Short result, minimum info, only for ELO calculation
    // Will be replaced with better result later
    return {
      id: res.id,
      isUnknownPlayer: players[res.player].arcade_name === 'PUMPITUP',
      isIntermediateResult: true,
      sharedChartId: res.shared_chart || chartId,
      playerId: res.player,
      nickname: players[res.player].nickname,
      nicknameArcade: players[res.player].arcade_name,
      date: res.gained,
      dateObject: parseDate(res.gained),
      grade,
      isExactDate: !!res.exact_gain_date,
      score: res.score,
      scoreRaw: getScoreWithoutBonus(res.score, grade),
      isRank: !!res.rank_mode,
    };
  }
  // Full best result
  let _r = {
    isUnknownPlayer: players[res.player].arcade_name === 'PUMPITUP',
    isIntermediateResult: false,
    sharedChartId: res.shared_chart || chartId,
    id: res.id,
    playerId: res.player,
    nickname: players[res.player].nickname,
    nicknameArcade: players[res.player].arcade_name,
    originalChartMix: res.original_mix,
    originalChartLabel: res.original_label,
    originalScore: res.original_score,
    date: res.gained,
    dateObject: parseDate(res.gained),
    grade,
    isExactDate: !!res.exact_gain_date,
    score: res.score,
    scoreRaw: getScoreWithoutBonus(res.score, grade),
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
    isHJ: (res.mods_list || '').includes('HJ'),
    isMachineBest: res.recognition_notes === 'machine_best',
    isMyBest: res.recognition_notes === 'personal_best',
  };

  tryFixIncompleteResult(_r, chart.maxTotalSteps);

  const perfects = Math.sqrt(_r.perfect) * 10;
  const acc = perfects
    ? Math.floor(
        ((perfects * 100 + _r.great * 85 + _r.good * 60 + _r.bad * 20 + _r.miss * -25) /
          (perfects + _r.great + _r.good + _r.bad + _r.miss)) *
          100
      ) / 100
    : null;
  const accRaw = _r.perfect
    ? Math.floor(
        ((_r.perfect * 100 + _r.great * 85 + _r.good * 60 + _r.bad * 20 + _r.miss * -25) /
          (_r.perfect + _r.great + _r.good + _r.bad + _r.miss)) *
          100
      ) / 100
    : null;

  _r.accuracy = acc < 0 ? 0 : accRaw === 100 ? 100 : acc && +acc.toFixed(2);
  _r.accuracyRaw = _.toNumber(_r.accuracy);
  return _r;
};

export const initializeProfile = (result, profiles, players) => {
  const id = result.playerId;
  const resultsByLevel = _.fromPairs(Array.from({ length: 28 }).map((x, i) => [i + 1, []]));

  profiles[id] = {
    id: id,
    name: players[id].nickname,
    nameArcade: players[id].arcade_name,
    resultsByGrade: {},
    resultsByLevel,
    firstResultDate: result.dateObject,
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
    _.map((achName) => [
      achName,
      { ...(achievements[achName].initialState || initialAchievementState) },
    ]),
    _.fromPairs
  )(achievements);
  profiles[id].exp = 0;
};

export const getProfileInfoFromResult = (result, chart, profiles) => {
  const profile = profiles[result.playerId];

  profile.count++;
  if (result.accuracy) {
    profile.countAcc++;
    profile.sumAccuracy += result.accuracy;
  }
  profile.grades[result.grade.replace('+', '')]++;
  if (chart.chartType !== 'COOP') {
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
  if (result.isExactDate && profile.firstResultDate > result.dateObject) {
    profile.firstResultDate = result.dateObject;
  }
  profile.exp += getExp(result, chart);
};

export const getMaxRawScore = (score) => {
  return ((score.scoreRaw / score.accuracy) * 100) / (score.isRank ? 1.2 : 1);
};
