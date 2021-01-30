import React from 'react';
import _ from 'lodash/fp';
// import numeral from 'numeral';
import classNames from 'classnames';
import { GiQueenCrown } from 'react-icons/gi';
import { FaAngleDoubleUp, FaAngleDoubleDown } from 'react-icons/fa';
import { NavLink } from 'react-router-dom';

import { routes } from 'constants/routes';

import Grade from 'components/Shared/Grade';
import Loader from 'components/Shared/Loader';
import Flag from 'components/Shared/Flag';
import Toggle from 'components/Shared/Toggle/Toggle';
// import CheckBox from 'components/Shared/CheckBox';

import { getRankImg } from 'utils/exp';

export default function RankingList({ ranking, isLoading, preferences, updatePreferences }) {
  return (
    <div className="ranking-list">
      {_.isEmpty(ranking) && !isLoading && 'ничего не найдено'}
      {isLoading && <Loader />}
      {!isLoading && (
        <table>
          <thead>
            <tr>
              <th className="place"></th>
              <th className="change"></th>
              <th className="exp-rank">rank</th>
              <th className="name">name</th>
              <th className="name name-piu">piu name</th>
              <th className="rating">elo</th>
              <th className="rating-change-cell"></th>
              <th className="rating">pp</th>
              {/* <th className="total-score">total score</th> */}
              <th className="grades sss">
                <Grade grade="SSS" />
              </th>
              <th className="grades ss">
                <Grade grade="SS" />
              </th>
              <th className="grades s">
                <Grade grade="S" />
              </th>
              <th className="grades a">
                <Grade grade="A+" />
              </th>
              <th className="grades b">
                <Grade grade="B" />
              </th>
              <th className="grades c">
                <Grade grade="C" />
              </th>
              <th className="grades d">
                <Grade grade="D" />
              </th>
              <th className="grades f">
                <Grade grade="F" />
              </th>
              <th className="playcount">scores</th>
              {/* <th className="calories">kcal</th> */}
              <th className="accuracy">accuracy</th>
              <th className="hide-col"> </th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((player, playerIndex) => {
              const isHidden = preferences.playersHiddenStatus[player.id];
              if (isHidden && !preferences.showHiddenPlayersInRanking) {
                return null;
              }
              return (
                <tr
                  className={classNames('player', { 'hidden-player': isHidden })}
                  key={player.name}
                >
                  <td className="place">
                    {playerIndex === 0 ? <GiQueenCrown /> : `#${playerIndex + 1}`}
                  </td>
                  <td className="change">
                    {player.change > 0 && (
                      <div className="change-holder up">
                        <span>{player.change}</span>
                        <FaAngleDoubleUp />
                      </div>
                    )}
                    {player.change < 0 && (
                      <div className="change-holder down">
                        <span>{-player.change}</span>
                        <FaAngleDoubleDown />
                      </div>
                    )}
                    {!!player.change && _.isString(player.change) && (
                      <div className="change-holder text">
                        <span>{player.change}</span>
                      </div>
                    )}
                  </td>
                  <td className="exp-rank">{getRankImg(player.expRank)}</td>
                  <td className="name">
                    <div className="name-container">
                      <Flag region={player.region} />
                      <NavLink exact to={routes.profile.getPath({ id: player.id })}>
                        {player.name}
                      </NavLink>
                    </div>
                  </td>
                  <td className="name name-piu">
                    <NavLink exact to={routes.profile.getPath({ id: player.id })}>
                      {player.nameArcade}
                    </NavLink>
                  </td>
                  <td className="rating">{player.rating}</td>
                  <td className="rating-change-cell">
                    {!!player.prevRating && player.prevRating !== player.rating && (
                      <span
                        className={classNames('rating-change', {
                          down: player.prevRating > player.rating,
                          up: player.prevRating < player.rating,
                        })}
                      >
                        {player.prevRating < player.rating ? '+' : ''}
                        {player.rating - player.prevRating}
                      </span>
                    )}
                  </td>
                  <td className="rating secondary">{Math.round(player.pp.pp)}</td>
                  <td className="grades sss">{player.grades.SSS}</td>
                  <td className="grades ss">{player.grades.SS}</td>
                  <td className="grades s">{player.grades.S}</td>
                  <td className="grades a">{player.grades.A}</td>
                  <td className="grades b">{player.grades.B}</td>
                  <td className="grades c">{player.grades.C}</td>
                  <td className="grades d">{player.grades.D}</td>
                  <td className="grades f">{player.grades.F}</td>
                  <td className="playcount">{player.count}</td>
                  <td className="accuracy">
                    {player.accuracy ? `${player.accuracy.toFixed(2)}%` : ''}
                  </td>
                  <td className="hide-col">
                    <Toggle
                      onChange={() => {
                        updatePreferences(
                          _.set(['playersHiddenStatus', player.id], !isHidden, preferences)
                        );
                      }}
                      checked={!isHidden}
                    />
                    {/* <CheckBox
                      onChange={() => {
                        updatePreferences(
                          _.set(['playersHiddenStatus', player.id], !isHidden, preferences)
                        );
                      }}
                      isChecked={isHidden}
                    /> */}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
