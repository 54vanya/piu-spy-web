import React, { Component } from 'react';
import toBe from 'prop-types';
import { connect } from 'react-redux';
import matchSorter from 'match-sorter';
import { Range, getTrackBackground } from 'react-range';
import _ from 'lodash/fp';
import { createSelector } from 'reselect';
import Select from 'react-select';
import classNames from 'classnames';
import numeral from 'numeral';
import localForage from 'localforage';
import TimeAgo from 'javascript-time-ago';
import ru from 'javascript-time-ago/locale/ru';
import { convenient } from 'javascript-time-ago/gradation';
import Tooltip from 'react-responsive-ui/modules/Tooltip';
import moment from 'moment';
import { FaRedoAlt, FaCaretLeft, FaCaretRight, FaSearch } from 'react-icons/fa';

import Overlay from 'components/Shared/Overlay/Overlay';
import ToggleButton from 'components/Shared/ToggleButton/ToggleButton';
import Input from 'components/Shared/Input/Input';
import Toggle from 'components/Shared/Toggle/Toggle';
import CollapsibleBar from 'components/Shared/CollapsibleBar';

import 'react-responsive-ui/style.css';
import './rankings.scss';

import { fetchTopScores } from 'reducers/top';

import { colorsArray } from 'utils/colors';

TimeAgo.addLocale(ru);
const timeAgo = new TimeAgo('ru-RU');

const timeStyle = {
  flavour: 'long',
  gradation: convenient,
  units: ['day', 'week', 'month'],
};
const tooltipFormatter = date => date.toLocaleDateString();
const tooltipFormatterForBests = date => (
  <div style={{ display: 'flex', alignItems: 'center', flexDirection: 'column' }}>
    <div>точная дата взятия неизвестна</div>
    <div>скор был записан с my best или machine best</div>
    <div>дата записи: {date.toLocaleDateString()}</div>
  </div>
);

const nowDate = new Date();
const getTimeAgo = date => {
  const strTimeAgo = timeAgo.format(date, timeStyle);
  if (!strTimeAgo) {
    const dayDiff = moment(nowDate)
      .startOf('day')
      .diff(moment(date).startOf('day'), 'days');
    return dayDiff === 0 ? 'сегодня' : dayDiff === 1 ? 'вчера' : '';
  } else {
    return strTimeAgo;
  }
};

const SORT = {
  DEFAULT: 'default',
  PROTAGONIST: 'protagonist',
};
const sortingOptions = [
  {
    label: 'новизне скоров',
    value: SORT.DEFAULT,
  },
  {
    label: 'отставанию от остальных',
    value: SORT.PROTAGONIST,
  },
];

const chartMinMax = [1, 28];
const filterCharts = (filter, rows) => {
  const range = _.getOr(chartMinMax, 'range', filter);
  const type = _.getOr(null, 'type', filter);

  const filtered = _.flow(
    _.filter(row => {
      return (
        row.chartLevel >= range[0] &&
        row.chartLevel <= range[1] &&
        (!type || type === row.chartType)
      );
    })
  )(rows);
  return filtered;
};

const getFilteredData = (data, filter) => {
  const names = _.map('value', filter.players);
  const namesOr = _.map('value', filter.playersOr);
  const namesNot = _.map('value', filter.playersNot);
  const sortingType = _.get('value', filter.sortingType);
  const protagonist = _.get('value', filter.protagonist);
  const excludeAntagonists = _.map('value', filter.excludeAntagonists);

  const defaultSorting = [_.orderBy(['latestScoreDate'], ['desc'])];
  const sortingFunctions =
    {
      [SORT.DEFAULT]: defaultSorting,
      [SORT.PROTAGONIST]: [
        _.filter(row => _.map('nickname', row.results).includes(protagonist)),
        _.map(row => {
          const protIndex = _.findIndex({ nickname: protagonist }, row.results);
          const protScore = row.results[protIndex].score;
          const enemies = _.flow([
            _.take(protIndex),
            _.uniqBy('nickname'),
            _.remove(res => excludeAntagonists.includes(res.nickname) || res.score === protScore),
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
      ],
    }[sortingType] || defaultSorting;

  return _.flow(
    _.compact([
      filter.chartRange && (items => filterCharts(filter.chartRange, items)),
      !filter.showRank &&
        _.map(row => ({ ...row, results: _.filter(res => !res.isRank, row.results) })),
      filter.showRank &&
        filter.showOnlyRank &&
        _.map(row => ({ ...row, results: _.filter(res => res.isRank, row.results) })),
      filter.showRank &&
        !filter.showOnlyRank &&
        !filter.showRankAndNorank &&
        _.map(row => {
          const occuredNames = [];
          return {
            ...row,
            results: _.filter(res => {
              const alreadyOccured = occuredNames.includes(res.nickname);
              occuredNames.push(res.nickname);
              return !alreadyOccured;
            }, row.results),
          };
        }),
      (names.length || namesOr.length || namesNot.length) &&
        _.filter(row => {
          const rowNames = _.map('nickname', row.results);
          return (
            (!names.length || _.every(name => rowNames.includes(name), names)) &&
            (!namesOr.length || _.some(name => rowNames.includes(name), namesOr)) &&
            (!namesNot.length || !_.some(name => rowNames.includes(name), namesNot))
          );
        }),
      _.filter(row => _.size(row.results)),
      ...sortingFunctions,
      filter.song && (items => matchSorter(items, filter.song, { keys: ['song'] })),
      _.map(song => {
        let topPlace = 1;
        const occuredNicknames = [];
        return {
          ...song,
          results: song.results.map((res, index) => {
            const isSecondOccurenceInResults = occuredNicknames.includes(res.nickname);
            occuredNicknames.push(res.nickname);
            if (index === 0) {
              topPlace = 1;
            } else if (
              !isSecondOccurenceInResults &&
              res.score !== _.get([index - 1, 'score'], song.results)
            ) {
              topPlace += 1;
            }
            return {
              ...res,
              topPlace,
              isSecondOccurenceInResults,
            };
          }),
        };
      }),
    ])
  )(data);
};

function ChartFilter({ filterValue, onChange }) {
  const range = _.getOr(chartMinMax, 'range', filterValue);
  const type = _.getOr(null, 'type', filterValue);
  let buttonText = 'фильтр чартов';
  if (filterValue) {
    const t = type || '';
    buttonText = range[0] === range[1] ? `${t}${range[0]}` : `${t}${range[0]} - ${t}${range[1]}`;
    buttonText = 'чарты: ' + buttonText;
  }

  return (
    <div>
      <Overlay
        overlayClassName="chart-range-overlay-outer"
        overlayItem={
          <button className="filter-charts-button btn btn-sm btn-dark">{buttonText}</button>
        }
      >
        <div className="chart-range-overlay">
          <div className="buttons">
            <ToggleButton
              text="S"
              active={!type || type === 'S'}
              onToggle={active => {
                onChange({
                  range,
                  type: !active ? 'D' : null,
                });
              }}
            />
            <ToggleButton
              text="D"
              active={!type || type === 'D'}
              onToggle={active => {
                onChange({
                  range,
                  type: !active ? 'S' : null,
                });
              }}
            />
          </div>
          <Range
            values={range}
            step={1}
            min={chartMinMax[0]}
            max={chartMinMax[1]}
            onChange={r => onChange({ type, range: r })}
            renderTrack={({ props, children }) => (
              <div
                onMouseDown={props.onMouseDown}
                onTouchStart={props.onTouchStart}
                style={{
                  ...props.style,
                  height: '10px',
                  display: 'flex',
                  width: '100%',
                }}
              >
                <div
                  ref={props.ref}
                  style={{
                    height: '6px',
                    width: '100%',
                    borderRadius: '3px',
                    background: getTrackBackground({
                      values: range,
                      colors: ['#ccc', '#337ab7', '#ccc'],
                      min: chartMinMax[0],
                      max: chartMinMax[1],
                    }),
                    alignSelf: 'center',
                  }}
                >
                  {children}
                </div>
              </div>
            )}
            renderThumb={({ props, isDragged }) => (
              <div
                {...props}
                style={{
                  ...props.style,
                  height: '12px',
                  width: '12px',
                  borderRadius: '6px',
                  backgroundColor: '#FFF',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  boxShadow: '0px 2px 3px #AAA',
                }}
              >
                <div
                  style={{
                    height: '6px',
                    width: '6px',
                    borderRadius: '3px',
                    backgroundColor: isDragged ? '#337ab7' : '#CCC',
                  }}
                />
              </div>
            )}
          />
          <div className="inputs">
            <button
              className="btn btn-sm btn-dark"
              onClick={() =>
                onChange({
                  type,
                  range: [Math.max(range[0] - 1, chartMinMax[0]), range[1]],
                })
              }
            >
              <FaCaretLeft />
            </button>
            <Input
              type="number"
              className="form-control"
              min={chartMinMax[0]}
              max={Math.min(chartMinMax[1], range[1])}
              value={range[0]}
              onBlur={value => {
                onChange({ type, range: [value, range[1]] });
              }}
            />
            <button
              className="btn btn-sm btn-dark"
              onClick={() => {
                const newMin = Math.min(range[0] + 1, chartMinMax[1]);
                onChange({
                  type,
                  range: [newMin, range[1] < newMin ? newMin : range[1]],
                });
              }}
            >
              <FaCaretRight />
            </button>
            <div className="_flex-fill" />
            <button
              className="btn btn-sm btn-dark"
              onClick={() => {
                const newMax = Math.max(range[1] - 1, chartMinMax[0]);
                onChange({
                  type,
                  range: [range[0] > newMax ? newMax : range[0], newMax],
                });
              }}
            >
              <FaCaretLeft />
            </button>
            <Input
              type="number"
              className="form-control"
              min={Math.max(chartMinMax[0], range[0])}
              max={chartMinMax[1]}
              value={range[1]}
              onBlur={value => onChange({ type, range: [range[0], value] })}
            />
            <button
              className="btn btn-sm btn-dark"
              onClick={() =>
                onChange({
                  type,
                  range: [range[0], Math.min(range[1] + 1, chartMinMax[1])],
                })
              }
            >
              <FaCaretRight />
            </button>
          </div>
        </div>
      </Overlay>
    </div>
  );
}

const playersSelector = createSelector(
  state => state.top.data,
  _.flow(
    _.flatMap(_.get('results')),
    _.map('nickname'),
    _.uniq,
    _.sortBy(_.toLower),
    _.map(name => ({ label: name, value: name }))
  )
);

const defaultFilter = { showRank: true };

const mapStateToProps = state => {
  return {
    players: playersSelector(state),
    data: state.top.data,
    error: state.top.error,
    isLoading: state.top.isLoading,
  };
};

const mapDispatchToProps = {
  fetchTopScores,
};

class TopScores extends Component {
  static propTypes = {
    match: toBe.object,
    data: toBe.array,
    error: toBe.object,
    isLoading: toBe.bool.isRequired,
  };

  state = { filter: defaultFilter, showItemsCount: 20 };

  componentDidMount() {
    const { isLoading } = this.props;
    if (!isLoading) {
      this.props.fetchTopScores();
    }
    localForage
      .getItem('filter')
      .then(
        filter =>
          filter &&
          this.setState({
            filter: {
              ...filter,
              chartRange: {
                ...filter.chartRange,
                range: _.every(
                  r => r >= chartMinMax[0] && r <= chartMinMax[1],
                  filter.chartRange.range
                )
                  ? filter.chartRange.range
                  : chartMinMax,
              },
            },
          })
      )
      .catch(error => console.warn('Cannot get filter from local storage', error));
  }

  setFilter = _.curry((name, value) => {
    this.setState(
      state => ({ filter: { ...state.filter, [name]: value } }),
      () => {
        localForage.setItem('filter', this.state.filter);
      }
    );
  });

  onRefresh = () => {
    const { isLoading } = this.props;
    if (!isLoading) {
      this.props.fetchTopScores();
    }
  };

  renderSimpleSearch() {
    const { isLoading } = this.props;
    return (
      <div className="simple-search">
        <div className="song-name _margin-right _margin-bottom">
          <Input
            value={this.state.filter.song || ''}
            placeholder="название песни..."
            className="form-control"
            onChange={this.setFilter('song')}
          />
        </div>
        <div className="chart-range _margin-right _margin-bottom">
          <ChartFilter
            filterValue={this.state.filter.chartRange}
            onChange={this.setFilter('chartRange')}
          />
        </div>
        <div className="_flex-fill" />
        <div className="_flex-row _margin-bottom">
          <button
            className="btn btn-sm btn-dark btn-icon _margin-right"
            onClick={() => this.setState({ filter: defaultFilter })}
          >
            <FaRedoAlt /> сбросить фильтры
          </button>
          <button
            disabled={isLoading}
            className="btn btn-sm btn-dark btn-icon"
            onClick={this.onRefresh}
          >
            <FaSearch /> обновить
          </button>
        </div>
      </div>
    );
  }

  renderFilters() {
    const { players } = this.props;
    const { filter } = this.state;

    return (
      <div className="filters">
        <div className="people-filters">
          <label className="label">показывать чарты, которые сыграл:</label>
          <div className="players-block">
            <div className="_margin-right">
              <label className="label">каждый из этих</label>
              <Select
                closeMenuOnSelect={false}
                className="select players"
                classNamePrefix="select"
                placeholder="игроки..."
                isMulti
                options={players}
                value={_.getOr(null, 'players', filter)}
                onChange={this.setFilter('players')}
              />
            </div>
            <div className="_margin-right">
              <label className="label">и хоть один из этих</label>
              <Select
                closeMenuOnSelect={false}
                className="select players"
                classNamePrefix="select"
                placeholder="игроки..."
                isMulti
                options={players}
                value={_.getOr(null, 'playersOr', filter)}
                onChange={this.setFilter('playersOr')}
              />
            </div>
            <div className="_margin-right">
              <label className="label">и никто из этих</label>
              <Select
                closeMenuOnSelect={false}
                className="select players"
                classNamePrefix="select"
                placeholder="игроки..."
                isMulti
                options={players}
                value={_.getOr(null, 'playersNot', filter)}
                onChange={this.setFilter('playersNot')}
              />
            </div>
          </div>
        </div>
        <div>
          <Toggle
            checked={_.getOr(false, 'showRank', filter)}
            onChange={this.setFilter('showRank')}
          >
            показывать скоры на ранке
          </Toggle>
        </div>
        {_.get('showRank', filter) && (
          <>
            <div>
              <Toggle
                checked={_.getOr(false, 'showOnlyRank', filter)}
                onChange={value => {
                  this.setFilter('showOnlyRank', value);
                  if (_.get('showRankAndNorank', filter)) {
                    this.setFilter('showRankAndNorank', false);
                  }
                }}
              >
                <strong>только</strong> на ранке
              </Toggle>
            </div>
            <div>
              <Toggle
                checked={_.getOr(false, 'showRankAndNorank', filter)}
                onChange={value => {
                  this.setFilter('showRankAndNorank', value);
                  if (_.get('showOnlyRank', filter)) {
                    this.setFilter('showOnlyRank', false);
                  }
                }}
              >
                показывать лучшие скоры с ранком и без
              </Toggle>
            </div>
          </>
        )}
      </div>
    );
  }

  renderSortings() {
    const { filter } = this.state;
    const { players } = this.props;
    return (
      <div className="sortings">
        <div>
          <label className="label">сортировать по</label>
          <Select
            placeholder="выберите сортировку"
            className="select"
            classNamePrefix="select"
            clearable={false}
            options={sortingOptions}
            value={_.getOr(sortingOptions[0], 'sortingType', filter)}
            onChange={this.setFilter('sortingType')}
          />
        </div>
        {_.get('sortingType.value', filter) === SORT.PROTAGONIST && (
          <>
            <div>
              <label className="label">протагонист (кого сравнивать с остальными):</label>
              <Select
                className={classNames('select players', {
                  'red-border': !_.get('protagonist', filter),
                })}
                classNamePrefix="select"
                placeholder="игроки..."
                options={players}
                value={_.getOr(null, 'protagonist', filter)}
                onChange={this.setFilter('protagonist')}
              />
            </div>
            <div>
              <label className="label">не учитывать в сравнении:</label>
              <Select
                closeMenuOnSelect={false}
                className="select players"
                classNamePrefix="select"
                placeholder="игроки..."
                options={players}
                isMulti
                value={_.getOr([], 'excludeAntagonists', filter)}
                onChange={this.setFilter('excludeAntagonists')}
              />
            </div>
          </>
        )}
      </div>
    );
  }

  render() {
    const { isLoading, data, error } = this.props;
    const { showItemsCount, filter } = this.state;

    const filteredData = getFilteredData(data, filter);

    const canShowMore = filteredData.length > showItemsCount;
    const visibleData = _.slice(0, showItemsCount, filteredData);

    const uniqueSelectedNames = _.slice(
      0,
      colorsArray.length,
      _.uniq(
        _.compact([
          _.get('sortingType.value', filter) === SORT.PROTAGONIST &&
            _.get('protagonist.value', filter),
          ..._.map('value', filter.players),
          ..._.map('value', filter.playersOr),
        ])
      )
    );

    return (
      <div className="rankings">
        <header>leaderboard</header>
        <div className="content">
          {error && error.message}
          <div className="search-block">
            {this.renderSimpleSearch()}
            <CollapsibleBar title="фильтры">{this.renderFilters()}</CollapsibleBar>
            <CollapsibleBar title="сортировка">{this.renderSortings()}</CollapsibleBar>
          </div>
          {isLoading && 'Loading...'}
          <div className="top-list">
            {_.isEmpty(filteredData) && !isLoading && 'ничего не найдено'}
            {visibleData.map((chart, chartIndex) => {
              return (
                <div className="song-block" key={chart.song + chart.chartLabel}>
                  <div className="song-name">
                    <div
                      className={classNames('chart-name', {
                        single: chart.chartType === 'S',
                      })}
                    >
                      {chart.chartType}
                      <span className="chart-separator" />
                      {chart.chartLevel}
                    </div>
                    <div>{chart.song}</div>
                  </div>
                  <div className="charts">
                    <div className="chart">
                      <div className="results">
                        <table>
                          {chartIndex === 0 && (
                            <thead>
                              <tr>
                                <th className="place"></th>
                                <th className="nickname"></th>
                                <th className="rank"></th>
                                <th className="score">score</th>
                                <th className="grade"></th>
                                <th className="number">miss</th>
                                <th className="number">bad</th>
                                <th className="number">good</th>
                                <th className="number">great</th>
                                <th className="number">perfect</th>
                                <th className="combo">combo</th>
                                <th className="accuracy">accuracy</th>
                                <th className="date"></th>
                              </tr>
                            </thead>
                          )}
                          <tbody>
                            {chart.results.map(res => {
                              const nameIndex = uniqueSelectedNames.indexOf(res.nickname);
                              return (
                                <tr
                                  key={res.score + res.nickname}
                                  className={classNames({ empty: !res.isExactDate })}
                                >
                                  <td className="place">
                                    {res.isSecondOccurenceInResults ? '' : `#${res.topPlace}`}
                                  </td>
                                  <td
                                    className="nickname"
                                    style={
                                      nameIndex > -1
                                        ? { fontWeight: 'bold', color: colorsArray[nameIndex] }
                                        : {}
                                    }
                                  >
                                    {res.nickname}
                                    {_.get('sortingType.value', filter) === SORT.PROTAGONIST &&
                                      res.nickname === _.get('protagonist.value', filter) &&
                                      chart.distanceFromProtagonist > 0 && (
                                        <span className="protagonist-diff">
                                          {' '}
                                          -{(chart.distanceFromProtagonist * 100).toFixed(1)}%
                                        </span>
                                      )}
                                  </td>
                                  <td className={classNames('rank', { vj: res.isRank })}>
                                    {res.isRank &&
                                      (res.isExactDate ? (
                                        'VJ'
                                      ) : (
                                        <Tooltip
                                          content={
                                            <>
                                              <div>
                                                наличие ранка на этом результате было угадано,
                                                основываясь на скоре
                                              </div>
                                            </>
                                          }
                                          tooltipClassName="timeago-tooltip"
                                        >
                                          VJ?
                                        </Tooltip>
                                      ))}
                                  </td>
                                  <td className="score">{numeral(res.score).format('0,0')}</td>
                                  <td className="grade">
                                    <div className="img-holder">
                                      {res.grade && res.grade !== '?' && (
                                        <img
                                          src={`${process.env.PUBLIC_URL}/grades/${res.grade}.png`}
                                          alt={res.grade}
                                        />
                                      )}
                                      {res.grade === '?' && null}
                                    </div>
                                  </td>
                                  <td className="number miss">{res.miss}</td>
                                  <td className="number bad">{res.bad}</td>
                                  <td className="number good">{res.good}</td>
                                  <td className="number great">{res.great}</td>
                                  <td className="number perfect">{res.perfect}</td>
                                  <td className="combo">
                                    {res.combo}
                                    {res.combo ? 'x' : ''}
                                  </td>
                                  <td className="accuracy">
                                    {res.accuracy}
                                    {res.accuracy ? '%' : ''}
                                  </td>
                                  <td
                                    className={classNames('date', {
                                      latest: res.date === chart.latestScoreDate,
                                    })}
                                  >
                                    <Tooltip
                                      content={
                                        res.isExactDate
                                          ? tooltipFormatter(res.dateObject)
                                          : tooltipFormatterForBests(res.dateObject)
                                      }
                                      tooltipClassName="timeago-tooltip"
                                    >
                                      {getTimeAgo(res.dateObject)}
                                      {res.isExactDate ? '' : '?'}
                                    </Tooltip>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            {!isLoading && canShowMore && (
              <button
                className="btn btn-sm btn-primary"
                onClick={() =>
                  this.setState(state => ({ showItemsCount: state.showItemsCount + 10 }))
                }
              >
                show more...
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(TopScores);