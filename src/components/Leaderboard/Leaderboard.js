import React, { Component } from 'react';
import toBe from 'prop-types';
import { connect } from 'react-redux';
import { NavLink } from 'react-router-dom';
import _ from 'lodash/fp';
import Select from 'react-select';
import classNames from 'classnames';
import localForage from 'localforage';
import { FaRedoAlt, FaSearch, FaArrowLeft } from 'react-icons/fa';

// styles
import './leaderboard.scss';

// components
import ToggleButton from 'components/Shared/ToggleButton/ToggleButton';
import Loader from 'components/Shared/Loader';
import Input from 'components/Shared/Input/Input';
import Toggle from 'components/Shared/Toggle/Toggle';
import CollapsibleBar from 'components/Shared/CollapsibleBar';
import ChartFilter from './ChartFilter';
import PresetsControl from './PresetsControl';
import Chart from './Chart';

// constants
import { routes } from 'constants/routes';
import { SORT, RANK_FILTER } from 'constants/leaderboard';

// reducers
import { fetchChartsData } from 'reducers/charts';
import { setFilter, resetFilter, defaultFilter } from 'reducers/results';
import { selectPreset, openPreset } from 'reducers/presets';

// utils
import { colorsArray } from 'utils/colors';
import { playersSelector, filteredDataSelector, sharedChartDataSelector } from 'reducers/selectors';

// code
const sortingOptions = [
  {
    label: 'от новых скоров',
    value: SORT.DEFAULT,
  },
  {
    label: 'от новых скоров конкретного игрока',
    value: SORT.NEW_SCORES_PLAYER,
  },
  // {
  //   label: 'отставанию от остальных',
  //   value: SORT.PROTAGONIST,
  // },
  {
    label: 'от худших результатов (эло)',
    value: SORT.RANK_ASC,
  },
  {
    label: 'от лучших результатов (эло)',
    value: SORT.RANK_DESC,
  },
  {
    label: 'от худших результатов (pp)',
    value: SORT.PP_ASC,
  },
  {
    label: 'от лучших результатов (pp)',
    value: SORT.PP_DESC,
  },
  {
    label: 'от лёгких чартов',
    value: SORT.EASIEST_SONGS,
  },
  {
    label: 'от сложных чартов',
    value: SORT.HARDEST_SONGS,
  },
];

const rankOptions = [
  {
    label: 'показывать все скоры',
    value: RANK_FILTER.SHOW_ALL,
  },
  {
    label: 'один лучший скор каждого игрока (ранк или нет)',
    value: RANK_FILTER.SHOW_BEST,
  },
  {
    label: 'только на ранке',
    value: RANK_FILTER.SHOW_ONLY_RANK,
  },
  {
    label: 'только без ранка',
    value: RANK_FILTER.SHOW_ONLY_NORANK,
  },
];

const mapStateToProps = (state, props) => {
  const isChartView = !!props.match.params.sharedChartId;

  return {
    isChartView,
    players: playersSelector(state),
    filteredData: isChartView ? sharedChartDataSelector(state, props) : filteredDataSelector(state),
    filter: isChartView ? defaultFilter : state.results.filter,
    error: state.charts.error || state.tracklist.error,
    isLoading: state.charts.isLoading || state.tracklist.isLoading,
    presets: state.presets.presets,
  };
};

const mapDispatchToProps = {
  fetchChartsData,
  setFilter,
  resetFilter,
  selectPreset,
  openPreset,
};

class Leaderboard extends Component {
  static propTypes = {
    match: toBe.object,
    error: toBe.object,
    isLoading: toBe.bool.isRequired,
  };

  state = { showItemsCount: 20 };

  setFilter = _.curry((name, value) => {
    const filter = { ...this.props.filter, [name]: value };
    this.props.setFilter(filter);
    localForage.setItem('filter', filter);
  });

  resetFilter = () => {
    this.props.resetFilter();
    localForage.setItem('filter', defaultFilter);
  };

  onRefresh = () => {
    const { isLoading } = this.props;
    !isLoading && this.props.fetchChartsData();
  };

  onTypeSongName = _.debounce(300, (value) => {
    this.setFilter('song', value);
  });

  renderSimpleSearch() {
    const { isLoading, filter } = this.props;
    return (
      <div className="simple-search">
        <div className="song-name _margin-right _margin-bottom">
          <Input
            value={filter.song || ''}
            placeholder="название песни..."
            className="form-control"
            onChange={this.onTypeSongName}
          />
        </div>
        <div className="chart-range _margin-right _margin-bottom">
          <ChartFilter filterValue={filter.chartRange} onChange={this.setFilter('chartRange')} />
        </div>
        <div className="_flex-fill" />
        <div className="_flex-row _margin-bottom">
          <PresetsControl />
          <button className="btn btn-sm btn-dark btn-icon _margin-right" onClick={this.resetFilter}>
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
    const { players, filter } = this.props;
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
        <div className="people-filters">
          <div className="players-block">
            <div className="_margin-right">
              <label className="label">показывать ранк:</label>
              <Select
                closeMenuOnSelect={false}
                className="select"
                classNamePrefix="select"
                placeholder="..."
                options={rankOptions}
                value={_.getOr(null, 'rank', filter) || RANK_FILTER.SHOW_ALL}
                onChange={this.setFilter('rank')}
              />
            </div>
          </div>
        </div>
        <div>
          <Toggle
            checked={_.getOr(false, 'showHiddenFromPreferences', filter)}
            onChange={this.setFilter('showHiddenFromPreferences')}
          >
            показывать скрытых игроков
          </Toggle>
        </div>
      </div>
    );
  }

  renderSortings() {
    const { players, filter } = this.props;
    return (
      <div className="sortings">
        <div>
          <label className="label">сортировка:</label>
          <Select
            placeholder="выберите сортировку"
            className="select"
            classNamePrefix="select"
            isClearable={false}
            options={sortingOptions}
            value={_.getOr(sortingOptions[0], 'sortingType', filter)}
            onChange={this.setFilter('sortingType')}
          />
        </div>
        {[
          SORT.PROTAGONIST,
          SORT.RANK_ASC,
          SORT.RANK_DESC,
          SORT.PP_ASC,
          SORT.PP_DESC,
          SORT.NEW_SCORES_PLAYER,
        ].includes(_.get('sortingType.value', filter)) && (
          <div>
            <label className="label">игрок:</label>
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
        )}
        {[SORT.PROTAGONIST].includes(_.get('sortingType.value', filter)) && (
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
        )}
      </div>
    );
  }

  render() {
    const { isLoading, isChartView, filteredData, error, filter, presets } = this.props;
    const { showItemsCount } = this.state;
    const canShowMore = filteredData.length > showItemsCount;
    const visibleData = _.slice(0, showItemsCount, filteredData);

    const sortingType = _.get('sortingType.value', filter);
    const showProtagonistEloChange = [SORT.RANK_ASC, SORT.RANK_DESC].includes(sortingType);
    const showProtagonistPpChange = [SORT.PP_ASC, SORT.PP_DESC].includes(sortingType);
    const highlightProtagonist = [
      SORT.PROTAGONIST,
      SORT.RANK_ASC,
      SORT.RANK_DESC,
      SORT.PP_ASC,
      SORT.PP_DESC,
      SORT.NEW_SCORES_PLAYER,
    ].includes(sortingType);
    const protagonistName = _.get('protagonist.value', filter);
    const uniqueSelectedNames = _.slice(
      0,
      colorsArray.length,
      _.uniq(
        _.compact([
          highlightProtagonist && protagonistName,
          ..._.map('value', filter.players),
          ..._.map('value', filter.playersOr),
        ])
      )
    );

    return (
      <div className="leaderboard-page">
        <div className="content">
          {isChartView && (
            <div className="simple-search">
              <NavLink exact to={routes.leaderboard.path}>
                <button className="btn btn-sm btn-dark btn-icon">
                  <FaArrowLeft /> ко всем чартам
                </button>
              </NavLink>
            </div>
          )}
          {!isChartView && (
            <>
              <div className="search-block">
                {this.renderSimpleSearch()}
                <CollapsibleBar title="фильтры">{this.renderFilters()}</CollapsibleBar>
                <CollapsibleBar title="сортировка">{this.renderSortings()}</CollapsibleBar>
              </div>
              {!!presets.length && (
                <div className="presets-buttons">
                  <span>пресеты:</span>
                  {presets.map((preset) => (
                    <ToggleButton
                      key={preset.name}
                      text={preset.name}
                      className="btn btn-sm btn-dark _margin-right"
                      active={_.get('filter', preset) === filter}
                      onToggle={() => {
                        this.props.selectPreset(preset);
                        this.props.openPreset();
                      }}
                    ></ToggleButton>
                  ))}
                </div>
              )}
            </>
          )}
          <div className="top-list">
            {isLoading && <Loader />}
            {_.isEmpty(filteredData) && !isLoading && (error ? error.message : 'ничего не найдено')}
            {!isLoading &&
              visibleData.map((chart, chartIndex) => {
                return (
                  <Chart
                    showHiddenPlayers={isChartView || filter.showHiddenFromPreferences}
                    key={chart.sharedChartId}
                    chart={chart}
                    chartIndex={chartIndex}
                    showProtagonistEloChange={showProtagonistEloChange}
                    showProtagonistPpChange={showProtagonistPpChange}
                    uniqueSelectedNames={uniqueSelectedNames}
                    protagonistName={protagonistName}
                  />
                );
              })}
            {!isLoading && canShowMore && (
              <button
                className="btn btn-sm btn-primary"
                onClick={() =>
                  this.setState((state) => ({ showItemsCount: state.showItemsCount + 10 }))
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

export default connect(mapStateToProps, mapDispatchToProps)(Leaderboard);
