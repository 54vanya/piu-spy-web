import _ from 'lodash/fp';
import regression from 'regression';

import { ranks as expRanks } from 'utils/expRanks';
/*
const processBattles = ({ battles, profiles, debug, resultInfo: dictScoreInfo }) => {
  let logText = '';
  const dictChartElo = {};
  const getDictChartEloId = (score, enemyScore) =>
    `${score.playerId}vs${enemyScore.playerId}-${score.sharedChartId}-${score.isRank}`;
  const dictRatingDiff = {};
  const getDictRatingDiffId = (score) => `${score.playerId}-${score.sharedChartId}-${score.isRank}`;
  // const dictScoreInfo = {};
  battles.forEach(([score, enemyScore, song]) => {
    // For each battle
    const p1 = profiles[score.playerId];
    const p2 = profiles[enemyScore.playerId];

    const scoreMultiplier = score.isRank ? 1.2 : 1;
    let maxScore = null;
    if (song.maxScore) {
      maxScore = song.maxScore * scoreMultiplier;
      if (
        Math.max(maxScore, score.score, enemyScore.score) !== maxScore &&
        !score.isRank &&
        (!score.isExactDate || !enemyScore.isExactDate)
      ) {
        maxScore *= 1.2;
        // Rank from machine best wasn't recognized most likely.
        // Increasing max score by 20% is fine
      }
      if (Math.max(maxScore, score.score, enemyScore.score) !== maxScore) {
        // If calculated max score isn't max score anyway, use current scores as max + cherry on top
        maxScore = Math.max(maxScore, score.score, enemyScore.score) + 10000;
      }
    }

    // Data to be appended to every score outside of this thread
    if (!dictScoreInfo[score.id]) dictScoreInfo[score.id] = {};
    if (!dictScoreInfo[enemyScore.id]) dictScoreInfo[enemyScore.id] = {};
    const scoreInfo = dictScoreInfo[score.id];
    const enemyScoreInfo = dictScoreInfo[enemyScore.id];

    // Rating at the start of battle for this score
    if (!scoreInfo.startingRating) scoreInfo.startingRating = p1.rating;
    if (!enemyScoreInfo.startingRating) enemyScoreInfo.startingRating = p2.rating;

    // Counting the number of battles
    p1.battleCount++;
    p2.battleCount++;

    // This is one match between two players
    //// Elo formula
    // const r1 = score.startingRating;
    // const r2 = enemyScore.startingRating;
    const r1 = p1.rating;
    const r2 = p2.rating;
    const R1 = 10 ** (r1 / 400);
    const R2 = 10 ** (r2 / 400);
    const E1 = R1 / (R1 + R2);
    const E2 = R2 / (R1 + R2);
    let A = score.score;
    let B = enemyScore.score;
    let S1, S2;
    if (A === B) {
      S1 = S2 = 0.5;
    } else if (maxScore && A !== 0 && B !== 0) {
      A = maxScore / A - 1;
      B = maxScore / B - 1;
      S1 = (B / (A + B) - 0.5) * 5 + 0.5;
      S2 = (A / (A + B) - 0.5) * 5 + 0.5;
    } else {
      S1 = A > B ? 1 : B < A ? 0 : 0.5;
      S2 = 1 - S1;
    }
    S1 = Math.max(0, Math.min(1, S1)); // Set strict boundaries to [0, 1]
    S2 = Math.max(0, Math.min(1, S2));

    const kRating1 = Math.max(0, Math.min(1, (r1 - 700) / 800));
    const kRating2 = Math.max(0, Math.min(1, (r2 - 700) / 800));
    const maxK1 = 20 + 20 * kRating1;
    const maxK2 = 20 + 20 * kRating2;
    const chartLevel = Number(song.interpolatedDifficulty || song.chartLevel);
    const kLevel1 = Math.max(
      1,
      Math.min(maxK1, (chartLevel / 25) ** ((kRating1 - 0.5) * 5 + 2.5) * maxK1)
    );
    const kLevel2 = Math.max(
      1,
      Math.min(maxK2, (chartLevel / 25) ** ((kRating2 - 0.5) * 5 + 2.5) * maxK2)
    );
    const kLevel = Math.min(kLevel1, kLevel2);

    // When YOU vs ENEMY both have SS/SSS, and both scores are very close to SSS, this battle will NOT affect ELO too much
    let kMinimizer = 1;
    const kDropCutoff = 0.98; // Score is 98% of max score or higher -- K will be lower
    if (
      song.maxScore &&
      (score.grade.startsWith('SS') || (score.miss === 0 && score.bad === 0)) &&
      (enemyScore.grade.startsWith('SS') || (enemyScore.miss === 0 && enemyScore.bad === 0)) &&
      score.score / maxScore > kDropCutoff &&
      enemyScore.score / maxScore > kDropCutoff
    ) {
      kMinimizer =
        Math.max(
          Math.min(
            1,
            Math.max(
              100 - (100 * score.score) / maxScore,
              100 - (100 * enemyScore.score) / maxScore
            ) /
              (100 - kDropCutoff * 100)
          ),
          0
        ) ** 2;
    }

    const K1 = kLevel * kMinimizer;
    const K2 = kLevel * kMinimizer;
    let dr1 = K1 * (S1 - E1);
    let dr2 = K2 * (S2 - E2);
    // Do not decrease rating if you have SSS - RIP zero-sum algorithm
    dr1 = dr1 < 0 && score.grade === 'SSS' ? 0 : dr1;
    dr2 = dr2 < 0 && enemyScore.grade === 'SSS' ? 0 : dr2;
    // Recording this value for display
    const baseEloId1 = getDictChartEloId(score, enemyScore);
    const baseEloId2 = getDictChartEloId(enemyScore, score);
    const baseEloP1 = dictChartElo[baseEloId1] || 0;
    const baseEloP2 = dictChartElo[baseEloId2] || 0;
    dictChartElo[baseEloId1] = dr1;
    dictChartElo[baseEloId2] = dr2;

    // Change rating as a result of this battle
    p1.rating = p1.rating + dr1 - baseEloP1;
    p2.rating = p2.rating + dr2 - baseEloP2;

    const ratingDiffId1 = getDictRatingDiffId(score);
    const ratingDiffId2 = getDictRatingDiffId(enemyScore);
    dictRatingDiff[ratingDiffId1] = (dictRatingDiff[ratingDiffId1] || 0) + dr1 - baseEloP1;
    dictRatingDiff[ratingDiffId2] = (dictRatingDiff[ratingDiffId2] || 0) + dr2 - baseEloP2;

    // Q
    scoreInfo.ratingDiff = dictRatingDiff[ratingDiffId1];
    scoreInfo.ratingDiffLast = dr1 - baseEloP1;

    enemyScoreInfo.ratingDiff = dictRatingDiff[ratingDiffId2];
    enemyScoreInfo.ratingDiffLast = dr2 - baseEloP2;

    if (debug) {
      // if (score.sharedChartId === 5292) {
      // if (song.song === 'Club Night') {
      // if (score.nickname === 'Liza' || enemyScore.nickname === 'Liza') {
      // if (!song.maxScore) {
      logText += `${song.chartLabel} - ${song.song} (${song.sharedChartId}) - ${
        profiles[score.playerId].name
      } / ${profiles[enemyScore.playerId].name}
- ${score.score} / ${enemyScore.score} (${Math.floor(maxScore)} (${Math.floor(
        song.maxScore * scoreMultiplier
      )})) - R ${S1.toFixed(2)}/${S2.toFixed(2)} E ${E1.toFixed(2)} / ${E2.toFixed(2)}
- Rating ${r1.toFixed(2)} / ${r2.toFixed(2)} - ${dr1.toFixed(2)} / ${dr2.toFixed(
        2
      )} - K ${K1.toFixed(2)} ${K2.toFixed(2)}${
        kMinimizer === 1 ? '' : ` (coef ${kMinimizer.toFixed(2)})`
      }
- Base elo: ${baseEloP1.toFixed(2)} / ${baseEloP2.toFixed(2)}
- Elo change: ${(dr1 - baseEloP1).toFixed(2)} / ${(dr2 - baseEloP2).toFixed(2)}
- New base elo: ${dictChartElo[baseEloId1].toFixed(2)} / ${dictChartElo[baseEloId2].toFixed(2)}
- RD: ${dictRatingDiff[ratingDiffId1].toFixed(2)} / ${dictRatingDiff[ratingDiffId2].toFixed(2)}\n`;
    }
    // Rating floor
    p1.rating = Math.max(100, p1.rating);
    p2.rating = Math.max(100, p2.rating);

    const playersSorted = _.flow(
      _.keys,
      _.map((id) => ({ id, rating: profiles[id].rating })),
      _.orderBy(['rating'], ['desc'])
    )(profiles);
    const battleDate =
      score.dateObject > enemyScore.dateObject ? score.dateObject : enemyScore.dateObject;
    playersSorted.forEach((player, index) => {
      const lastPlace = profiles[player.id].lastPlace;
      if (lastPlace !== index + 1) {
        profiles[player.id].rankingHistory.push({
          place: index + 1,
          date: battleDate.getTime(),
        });
        profiles[player.id].lastPlace = index + 1;
      }
    });

    const p1LastRating = _.last(p1.ratingHistory);
    const p2LastRating = _.last(p2.ratingHistory);
    if (p1LastRating !== p1.rating) {
      p1.ratingHistory.push({
        rating: p1.rating,
        date: battleDate.getTime(),
        date: battleDate.getTime(),
      });
    }
    if (p2LastRating !== p2.rating) {
      p2.ratingHistory.push({
        rating: p2.rating,
        date: battleDate.getTime(),
      });
    }
  });

  _.flow(
    _.keys,
    _.forEach((key) => {
      profiles[key].id = _.toInteger(key);
      profiles[key].accuracy =
        profiles[key].countAcc > 0
          ? Math.round((profiles[key].sumAccuracy / profiles[key].countAcc) * 100) / 100
          : null;
      profiles[key].ratingRaw = profiles[key].rating;
      profiles[key].rating = Math.round(profiles[key].rating);
      profiles[key].rankingHistory = [
        ...profiles[key].rankingHistory,
        { place: _.get('place', _.last(profiles[key].rankingHistory)), date: Date.now() },
      ];
    })
  )(profiles);
  return { logText };
};
*/
const postProcessProfiles = (profiles, tracklist) => {
  const getBonusForLevel = (level) => (30 * (1 + 2 ** (level / 4))) / 11;
  const getMinimumNumber = (totalCharts) =>
    Math.round(
      Math.min(totalCharts, 1 + totalCharts / 20 + Math.sqrt(Math.max(totalCharts - 1, 0)) * 0.7)
    );

  const newProfiles = _.mapValues((profile) => {
    const neededGrades = ['A', 'A+', 'S', 'SS', 'SSS'];
    profile.expRank = _.findLast((rank) => rank.threshold <= profile.exp, expRanks);
    profile.expRankNext = _.find((rank) => rank.threshold > profile.exp, expRanks);
    profile.progress = {
      double: {
        SS: {},
        S: {},
        'A+': {},
        A: {},
      },
      single: {
        SS: {},
        S: {},
        'A+': {},
        A: {},
      },
    };
    const gradeIncrementMap = {
      SSS: ['SS', 'S', 'A+', 'A'],
      SS: ['SS', 'S', 'A+', 'A'],
      S: ['S', 'A+', 'A'],
      'A+': ['A+', 'A'],
      A: ['A'],
    };
    const incrementLevel = (l, g, chartType) => {
      const prog =
        chartType === 'S' || chartType === 'SP'
          ? profile.progress.single
          : chartType === 'D' || chartType === 'DP'
          ? profile.progress.double
          : null;
      if (prog) {
        prog[g][l] = prog[g][l] ? prog[g][l] + 1 : 1;
      }
    };

    profile.accuracyPointsRaw = [];
    _.keys(profile.resultsByLevel).forEach((level) => {
      profile.resultsByLevel[level].forEach((res) => {
        if (!res.result.isRank && res.result.accuracyRaw) {
          profile.accuracyPointsRaw.push([
            _.toNumber(level),
            res.result.accuracyRaw,
            res.result.sharedChartId,
          ]);
        }

        const thisGrade = res.result.grade;
        const thisPlayerId = res.result.playerId;
        const otherResults = res.chart.results.filter((r) => r.playerId === thisPlayerId);
        if (otherResults.length > 1) {
          const sortedResults = otherResults.sort(
            (a, b) => neededGrades.indexOf(b.grade) - neededGrades.indexOf(a.grade)
          );
          if (sortedResults[0].grade !== thisGrade) {
            return; // Don't do anything when we have a different result with better grade
          }
        }
        const gradeIncArray = gradeIncrementMap[thisGrade];
        if (gradeIncArray) {
          gradeIncArray.forEach((gradeInc) => {
            incrementLevel(level, gradeInc, res.chart.chartType);
          });
        }
      });
    });

    ['single', 'double'].forEach((chartType) => {
      profile.progress[`${chartType}-bonus`] = 0;
      _.keys(profile.progress[chartType]).forEach((grade) => {
        profile.progress[chartType][`${grade}-bonus`] = 0;
        _.keys(profile.progress[chartType][grade]).forEach((level) => {
          const number = profile.progress[chartType][grade][level];
          const totalCharts = tracklist.data[`${chartType}sLevels`][level];
          const minimumNumber = getMinimumNumber(totalCharts);
          const bonusCoefficientNumber = Math.min(1, number / minimumNumber);
          const rawBonus = getBonusForLevel(level);
          const bonus = rawBonus * bonusCoefficientNumber;
          profile.progress[chartType][grade][`${level}-bonus`] = bonus;
          profile.progress[chartType][grade][`${level}-bonus-coef`] = bonusCoefficientNumber;
          profile.progress[chartType][grade][`${level}-min-number`] = minimumNumber;
          profile.progress[chartType][grade][`${level}-achieved-number`] = number;
          if (bonus >= profile.progress[chartType][`${grade}-bonus`]) {
            profile.progress[chartType][`${grade}-bonus`] = bonus;
            profile.progress[chartType][`${grade}-bonus-level`] = level;
            profile.progress[chartType][`${grade}-bonus-level-coef`] = bonusCoefficientNumber;
            profile.progress[chartType][`${grade}-bonus-level-min-number`] = minimumNumber;
            profile.progress[chartType][`${grade}-bonus-level-achieved-number`] = number;
          }
        });
        profile.progress[`${chartType}-bonus`] += profile.progress[chartType][`${grade}-bonus`];
      });
    });
    profile.progress.bonus = profile.progress['double-bonus'] + profile.progress['single-bonus'];
    profile.achievementBonus = profile.progress.bonus;
    profile.accuracy =
      profile.countAcc > 0
        ? Math.round((profile.sumAccuracy / profile.countAcc) * 100) / 100
        : null;
    return profile;
  }, profiles);
  return newProfiles;
};

const processPP = ({ profiles, sharedCharts }) => {
  const resultInfo = {};
  // const now = new Date();
  for (const chartId in sharedCharts) {
    const chart = sharedCharts[chartId];
    const chartResults = chart.results;
    const chartLevel = Number(chart.interpolatedDifficulty || chart.chartLevel);
    const maxPP = chartLevel ** 2.2 / 7.6; // 7;
    if (chart.maxScore) {
      const maxScore = chart.maxScore;
      for (const result of chartResults) {
        if (!result.isRank && maxScore) {
          const K1 = Math.max(0, Math.min(1, result.scoreRaw / maxScore - 0.3) / 0.7);
          // Optional: decrease PP values for older scores. Testing showing this doesn't change anything really
          // const millisecOld = now - result.dateObject;
          // const maxDays = 365;
          // const maxTimeDecrease = 0;
          // const K2 =
          //   1 -
          //   maxTimeDecrease * Math.min(1, Math.max(0, millisecOld / 1000 / 60 / 60 / 24 / maxDays));
          // const K = K1 * K2;

          const K = K1;

          // Final PP value
          const pp = K * maxPP;
          // Record result data
          resultInfo[result.id] = {
            pp: {
              pp,
              k: K,
              maxScore,
              maxPP,
              ppPotential: maxPP - pp,
              ppRatio: pp / maxPP,
              ppFixed: Number(pp.toFixed(1)),
            },
          };
          const profile = profiles[result.playerId];
          if (profile) {
            if (!profile.pp) {
              profile.pp = { scores: [], pp: 0 };
            }
            profile.pp.scores.push({
              pp_: Number(pp.toFixed(1)),
              s: chart.song,
              l: chart.chartLabel,
              pp,
              result,
              chart,
              K,
            });
          }
        }
      }
    }
  }

  // Calculate total pp
  for (const playerId in profiles) {
    const profile = profiles[playerId];
    if (profile.pp) {
      profile.pp.scores.sort((a, b) => b.pp - a.pp);
      profile.pp.pp = 0;
      profile.pp.scores.forEach((score, index) => {
        profile.pp.pp += 0.95 ** index * score.pp;
      });
      profile.rating = Math.round(profile.pp.pp);
    } else {
      profile.pp = {};
      profile.rating = 0;
    }
  }

  // Add first values for rankingHistory and ratingHistory
  _.flow(
    _.values,
    _.orderBy((profile) => profile.rating, 'desc'),
    (items) =>
      items.forEach((profile, index) => {
        profile.ratingHistory.push({
          rating: profile.rating,
          date: profile.firstResultDate.getTime(),
        });
        profile.rankingHistory.push({
          place: index + 1,
          date: profile.firstResultDate.getTime(),
        });
      })
  )(profiles);

  return resultInfo;
};

const interpolateDifficulties = ({ sharedCharts, profiles, debug }) => {
  let newSharedCharts = _.mapValues((chart) => {
    const datas = chart.results
      .map((r) => {
        const profile = profiles[r.playerId];
        if (!profile || !r.accuracy || r.isRank || _.size(profile.accuracyPointsRaw) < 50) {
          return null;
        }

        if (!profile.accuracyPointsInterpolated) {
          const maxAccuracy = _.maxBy(([x, y]) => y, profile.accuracyPointsRaw)[1];
          const maxLevelWithMaxAcc = _.maxBy(
            ([x, y]) => x,
            _.filter(([x, y]) => y === maxAccuracy, profile.accuracyPointsRaw)
          )[0];
          const points = profile.accuracyPointsRaw
            .filter(([x, y]) => x >= maxLevelWithMaxAcc - 1)
            .map(([x, y]) => [30 - x, 101 - y]);
          const result = regression.logarithmic(points);

          const f = (x) => {
            const calculated = 101 - result.predict(30 - x)[1];
            return Math.max(0, Math.min(calculated, 100));
          };
          const yx = [];
          for (let i = 1; i <= 28; i += 0.05) {
            yx.push([i, f(i)]);
          }

          profile.accuracyPointsInterpolated = yx;
        }

        const interpolatedPoint = _.find(
          (pair) => pair[1] < r.accuracyRaw,
          profile.accuracyPointsInterpolated
        );
        const returnValue = {
          interpolatedDifficulty: interpolatedPoint && interpolatedPoint[0],
          weight:
            r.accuracyRaw > 98
              ? 1 - (r.accuracyRaw - 98) / (100 - 98)
              : r.accuracyRaw < 80
              ? Math.max(0, (r.accuracyRaw - 50) / (80 - 50))
              : 1,
        };
        returnValue.weight *= Math.min(
          1,
          Math.max(0.1, (8 - Math.abs(returnValue.interpolatedDifficulty - chart.chartLevel)) / 8)
        );
        if (debug) {
          r.interpolation = returnValue;
        }
        return returnValue;
      })
      .filter(_.identity);
    const sums = datas.reduce(
      (acc, item) => {
        if (!item.interpolatedDifficulty) {
          return acc;
        }
        return {
          diffSum: acc.diffSum + item.interpolatedDifficulty * item.weight,
          weightSum: acc.weightSum + item.weight,
        };
      },
      { diffSum: 0, weightSum: 0 }
    );
    sums.diffSum += _.toNumber(chart.chartLevel) * 2;
    sums.weightSum += 2;
    const averageDifficulty = sums.diffSum / sums.weightSum;
    // console.log(chart.song, chart.chartLabel, JSON.stringify(datas), averageDifficulty);

    return {
      ...chart,
      interpolatedDifficulty: averageDifficulty,
    };
  }, sharedCharts);
  return newSharedCharts;
};

// export const getProcessedProfiles = ({ profiles, sharedCharts, tracklist, battles, debug }) => {
export const getProcessedProfiles = ({ profiles, sharedCharts, tracklist, debug }) => {
  // Calculate Progress achievements and bonus for starting Elo
  profiles = postProcessProfiles(profiles, tracklist);

  // Recalculate chart difficulty
  sharedCharts = interpolateDifficulties({ debug, sharedCharts, profiles });

  // Calculate PP
  const resultInfo = processPP({
    profiles,
    sharedCharts,
  });

  /*
  // Calculate ELO
  const { logText } = processBattles({
    battles,
    profiles,
    resultInfo,
    debug,
  });
  */
  return { profiles, resultInfo, sharedCharts, logText: '' };
};

export default getProcessedProfiles;