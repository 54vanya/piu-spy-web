import React from 'react';
import { connect } from 'react-redux';
import { NavLink } from 'react-router-dom';
import classNames from 'classnames';
import numeral from 'numeral';
import { FaExclamationTriangle, FaAngleDoubleUp } from 'react-icons/fa';
import Tooltip from 'react-responsive-ui/modules/Tooltip';

import { routes } from 'constants/routes';
import { DEBUG } from 'constants/env';

import Flag from 'components/Shared/Flag';
import Grade from 'components/Shared/Grade';
import Overlay from 'components/Shared/Overlay/Overlay';

import { getTimeAgo as getShortTimeAgo } from 'components/SocketTracker/helpers';

import { tooltipFormatter } from 'utils/leaderboards';
import { getExp } from 'utils/exp';
import { colorsArray } from 'utils/colors';
import { useLanguage } from 'utils/context/translation';

const mapStateToProps = (state, props) => {
  return {
    region: state.results.profiles[props.res.playerId]?.region,
  };
};

const Result = (
  {
    // shared
    res,
    chart,
    region,
    placeDifference,
    // leaderboard
    showProtagonistPpChange = false,
    protagonistName = null,
    uniqueSelectedNames = [],
    // socket
    leftProfile = {},
    rightProfile = {},
    isSocketView = false,
    bestGradeScore = false,
    notBestGradeResult = false,
  }
) => {
  const lang = useLanguage();
  // Rating info for nickname column:
  let ratingInfoBlock = null;
  if (DEBUG) {
    // In debug mode we show all info
    ratingInfoBlock = (
      <>
        <span className="debug-elo-info">
          {' '}
          {res.pp && `${res.pp}pp`}
        </span>
      </>
    );
  } else if (res.nickname === protagonistName && showProtagonistPpChange) {
    // In non-debug mode we show relevant info for selected protagonist
    ratingInfoBlock = (
      <>
        {' / '}
        {showProtagonistPpChange && res.pp && <span>{res.pp}pp</span>}
      </>
    );
  }

  const flag = region ? <Flag region={region} /> : null;

  const nameIndex = uniqueSelectedNames.indexOf(res.nickname);
  const exp = getExp(res, chart);
  const playerRoute = routes.profile.getPath({ id: res.playerId });

  return (
    <tr
      key={res.id}
      className={classNames({
        empty: !res.accuracy,
        latest: new Date(chart.latestScoreDate) - new Date(res.date) < 12 * 60 * 60 * 1000,
        left: res.nickname === leftProfile.name,
        right: res.nickname === rightProfile.name,
      })}
      style={
        nameIndex > -1
          ? {
              background: colorsArray[nameIndex] + '3A',
              outline: `1px solid ${colorsArray[nameIndex]}A0`,
            }
          : {}
      }
    >
      {!isSocketView && (
        <td className="place">{res.isSecondOccurenceInResults ? '' : res.topPlace && `#${res.topPlace}`}</td>
      )}
      <td className={classNames('nickname', bestGradeScore && 'opacity')} style={nameIndex > -1 ? { fontWeight: 'bold' } : {}}>
        <div className="nickname-container">
          {flag}
          <span className="nickname-text">
            <NavLink exact to={playerRoute}>
              {res.nickname}
            </NavLink>
            {!!placeDifference && (
              <span className="change-holder up">
                <span>{placeDifference}</span>
                <FaAngleDoubleUp />
              </span>
            )}
            {ratingInfoBlock}
          </span>
          {!isSocketView && (
            <div className="mods-container">
              {isSocketView &&
                res.mods &&
                res.mods
                  .split(' ')
                  .filter((mod) => mod.includes('AV'))
                  .map((avMod) => (
                    <div className="mod av-mod">
                      <div className="av-text">AV</div>
                      <div className="av-number">{avMod.replace('AV', '')}</div>
                    </div>
                  ))}
              {isSocketView &&
                res.mods &&
                res.mods
                  .split(' ')
                  .filter((mod) => mod.endsWith('X'))
                  .map((xMod) => (
                    <div className="mod x-mod">
                      <div className="x-number">{xMod}</div>
                    </div>
                  ))}
              {res.isRank && <div className="mod vj">{res.mods ? 'R' : 'R?'}</div>}
              {res.isHJ && <div className="mod hj">HJ</div>}
            </div>
          )}
        </div>
      </td>
      <td className={classNames('score', bestGradeScore && 'opacity')}>
        <Overlay
          overlayClassName="score-overlay-outer"
          overlayItem={
            <span className="score-span">
              {res.scoreIncrease > res.score * 0.8 && '*'}
              {numeral(res.score).format('0,0')}
            </span>
          }
          placement="top"
        >
          <div className="score-overlay">
            {DEBUG && (
              <>
                <div>
                  <span className="_grey">result id: </span>
                  {res.id}
                </div>
                <div>
                  <span className="_grey">player id: </span>
                  {res.playerId}
                </div>
              </>
            )}
            <div>
              <span className="_grey">{lang.PLAYER}: </span>
              <NavLink exact to={playerRoute}>
                {res.nickname} ({res.nicknameArcade})
              </NavLink>
            </div>
            {exp && (
              <div className="important">
                <span className="_grey">{lang.EXP}: </span>+
                {numeral(exp).format('0,0')}
              </div>
            )}
            {res.pp && (
              <div className="important">
                <span className="_grey">{lang.PP}: </span>
                <span>{res.pp}pp</span>
              </div>
            )}
            {!res.isExactDate && (
              <div className="warning">
                <FaExclamationTriangle />
                {lang.MY_BEST_SCORE_WARNING}
              </div>
            )}
            {res.isExactDate && (
              <>
                {res.mods && (
                  <div>
                    <span className="_grey">{lang.MODS}: </span>
                    {res.mods}
                  </div>
                )}
                {res.combo != null && (
                  <div className="mobile-only">
                    <span className="_grey">{lang.COMBO}: </span>
                    {res.combo}
                  </div>
                )}
                {res.calories != null && (
                  <div>
                    <span className="_grey">{lang.CCAL}: </span>
                    {res.calories}
                  </div>
                )}
                {res.scoreIncrease != null && (
                  <div>
                    <span className="_grey">{lang.SCORE_INCREASE}: </span>+
                    {numeral(res.scoreIncrease).format('0,0')}
                  </div>
                )}
                {res.originalChartMix && (
                  <div>
                    <div className="warning">
                      <FaExclamationTriangle />
                      {lang.ORIGINAL_MIX} {res.originalChartMix}
                    </div>
                    {res.originalChartLabel && (
                      <div>
                        <span className="_grey">{lang.ORIGINAL_CHART} </span>
                        {res.originalChartLabel}
                      </div>
                    )}
                    {res.originalScore && (
                      <div>
                        <span className="_grey">{lang.ORIGINAL_SCORE} </span>
                        {res.originalScore}
                      </div>
                    )}
                  </div>
                )}
                {res.scoreIncrease > res.score * 0.8 && lang.SIGHTREAD}
              </>
            )}
          </div>
        </Overlay>
      </td>
      <td className={classNames('grade', notBestGradeResult && 'opacity')}>
        <div className="img-holder">
          <Grade grade={res.grade} />
        </div>
      </td>
      {isSocketView && (
        <td
          className={classNames('mods', {
            vj: res.isRank,
            hj: res.isHJ,
          })}
        >
          <div className="mods-container">
            {isSocketView &&
              res.mods &&
              res.mods
                .filter((mod) => mod.includes('AV'))
                .map((avMod) => (
                  <div className="av-mod">
                    <div className="av-text">AV</div>
                    <div className="av-number">{avMod.replace('AV', '')}</div>
                  </div>
                ))}
            {isSocketView &&
              res.mods &&
              res.mods
                .split(' ')
                .filter((mod) => mod.endsWith('X'))
                .map((xMod) => (
                  <div className="x-mod">
                    <div className="x-number">{xMod}</div>
                  </div>
                ))}
            {res.isRank && <div className="inner">{res.isExactDate ? 'R' : 'R?'}</div>}
            {res.isHJ && <div className="inner">HJ</div>}
          </div>
        </td>
      )}
      <td className={classNames('number', 'miss', bestGradeScore && 'opacity')}>{res.miss}</td>
      <td className={classNames('number', 'bad', bestGradeScore && 'opacity')}>{res.bad}</td>
      <td className={classNames('number', 'good', bestGradeScore && 'opacity')}>{res.good}</td>
      <td className={classNames('number', 'great', bestGradeScore && 'opacity')}>{res.great}</td>
      <td className={classNames('number', 'perfect', bestGradeScore && 'opacity')}>{res.perfect}</td>
      <td className={classNames('combo', 'desktop-only', bestGradeScore && 'opacity')}>
        {res.combo && `${res.combo}x`}
      </td>
      <td className={classNames('accuracy', bestGradeScore && 'opacity')}>
        {res.accuracy === 100 ? 100 : res.accuracy ? res.accuracy.toFixed(2) : ''}
        {res.accuracy ? '%' : ''}
      </td>
      <td
        className={classNames('date', {
          latest: res.date === chart.latestScoreDate,
          opacity: bestGradeScore,
        })}
      >
        {isSocketView ? (
          getShortTimeAgo(lang, res.dateObject)
        ) : (
          <Tooltip content={tooltipFormatter(res)} tooltipClassName="pumpking-tooltip">
            {getShortTimeAgo(lang, res.dateObject)}
            {res.isExactDate ? '' : '?'}
          </Tooltip>
        )}
      </td>
    </tr>
  );
};

export default connect(mapStateToProps)(Result);
