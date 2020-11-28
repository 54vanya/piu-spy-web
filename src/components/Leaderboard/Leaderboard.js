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
import { Language } from 'utils/context/translation';

// code
const getSortingOptions = _.memoize((lang) => [
  {
    label: lang.NEW_TO_OLD_SCORES,
    value: SORT.DEFAULT,
  },
  {
    label: lang.NEW_TO_OLD_SCORES_OF_A_PLAYER,
    value: SORT.NEW_SCORES_PLAYER,
  },
  // {
  //   label: lang.SCORE_DIFFERENCE,
  //   value: SORT.PROTAGONIST,
  // },
  {
    label: lang.WORST_TO_BEST_BY_ELO,
    value: SORT.RANK_ASC,
  },
  {
    label: lang.BEST_TO_WORST_BY_ELO,
    value: SORT.RANK_DESC,
  },
  {
    label: lang.WORST_TO_BEST_BY_PP,
    value: SORT.PP_ASC,
  },
  {
    label: lang.BEST_TO_WORST_BY_PP,
    value: SORT.PP_DESC,
  },
  {
    label: lang.EASY_TO_HARD_CHARTS,
    value: SORT.EASIEST_SONGS,
  },
  {
    label: lang.HARD_TO_EASY_CHARTS,
    value: SORT.HARDEST_SONGS,
  },
]);

const getRankOptions = _.memoize((lang) => [
  {
    label: lang.SHOW_ALL_SCORES,
    value: RANK_FILTER.SHOW_ALL,
  },
  {
    label: lang.BEST_SCORE,
    value: RANK_FILTER.SHOW_BEST,
  },
  {
    label: lang.RANK_ONLY,
    value: RANK_FILTER.SHOW_ONLY_RANK,
  },
  {
    label: lang.ONLY_NO_RANK,
    value: RANK_FILTER.SHOW_ONLY_NORANK,
  },
]);

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
      <Language.Consumer>
        {(lang) => (
          <div className="simple-search">
            <div className="song-name _margin-right _margin-bottom">
              <Input
                value={filter.song || ''}
                placeholder={lang.SONG_NAME_PLACEHOLDER}
                className="form-control"
                onChange={this.onTypeSongName}
              />
            </div>
            <div className="chart-range _margin-right _margin-bottom">
              <ChartFilter
                filterValue={filter.chartRange}
                onChange={this.setFilter('chartRange')}
              />
            </div>
            <div className="_flex-fill" />
            <div className="_flex-row _margin-bottom">
              <PresetsControl />
              <button
                className="btn btn-sm btn-dark btn-icon _margin-right"
                onClick={this.resetFilter}
              >
                <FaRedoAlt /> {lang.RESET_FILTERS}
              </button>
              <button
                disabled={isLoading}
                className="btn btn-sm btn-dark btn-icon"
                onClick={this.onRefresh}
              >
                <FaSearch /> {lang.REFRESH}
              </button>
            </div>
          </div>
        )}
      </Language.Consumer>
    );
  }

  renderFilters() {
    const { players, filter } = this.props;
    return (
      <Language.Consumer>
        {(lang) => (
          <div className="filters">
            <div className="people-filters">
              <label className="label">{lang.SHOW_CHARTS_PLAYED_BY}</label>
              <div className="players-block">
                <div className="_margin-right">
                  <label className="label">{lang.EACH_OF_THESE}</label>
                  <Select
                    closeMenuOnSelect={false}
                    className="select players"
                    classNamePrefix="select"
                    placeholder={lang.PLAYERS_PLACEHOLDER}
                    isMulti
                    options={players}
                    value={_.getOr(null, 'players', filter)}
                    onChange={this.setFilter('players')}
                  />
                </div>
                <div className="_margin-right">
                  <label className="label">{lang.AND_ANY_OF_THESE}</label>
                  <Select
                    closeMenuOnSelect={false}
                    className="select players"
                    classNamePrefix="select"
                    placeholder={lang.PLAYERS_PLACEHOLDER}
                    isMulti
                    options={players}
                    value={_.getOr(null, 'playersOr', filter)}
                    onChange={this.setFilter('playersOr')}
                  />
                </div>
                <div className="_margin-right">
                  <label className="label">{lang.AND_NONE_OF_THESE}</label>
                  <Select
                    closeMenuOnSelect={false}
                    className="select players"
                    classNamePrefix="select"
                    placeholder={lang.PLAYERS_PLACEHOLDER}
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
                  <label className="label">{lang.SHOW_RANK}</label>
                  <Select
                    closeMenuOnSelect={false}
                    className="select"
                    classNamePrefix="select"
                    placeholder="..."
                    options={getRankOptions(lang)}
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
                {lang.SHOW_HIDDEN_PLAYERS}
              </Toggle>
            </div>
          </div>
        )}
      </Language.Consumer>
    );
  }

  renderSortings() {
    const { players, filter } = this.props;
    return (
      <Language.Consumer>
        {(lang) => (
          <div className="sortings">
            <div>
              <label className="label">{lang.SORTING_LABEL}</label>
              <Select
                placeholder={lang.SORTING_PLACEHOLDER}
                className="select"
                classNamePrefix="select"
                isClearable={false}
                options={getSortingOptions(lang)}
                value={_.getOr(getSortingOptions(lang)[0], 'sortingType', filter)}
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
                <label className="label">{lang.PLAYER_LABEL}</label>
                <Select
                  className={classNames('select players', {
                    'red-border': !_.get('protagonist', filter),
                  })}
                  classNamePrefix="select"
                  placeholder={lang.PLAYERS_PLACEHOLDER}
                  options={players}
                  value={_.getOr(null, 'protagonist', filter)}
                  onChange={this.setFilter('protagonist')}
                />
              </div>
            )}
            {[SORT.PROTAGONIST].includes(_.get('sortingType.value', filter)) && (
              <div>
                <label className="label">{lang.EXCLUDE_FROM_COMPARISON}</label>
                <Select
                  closeMenuOnSelect={false}
                  className="select players"
                  classNamePrefix="select"
                  placeholder={lang.PLAYERS_PLACEHOLDER}
                  options={players}
                  isMulti
                  value={_.getOr([], 'excludeAntagonists', filter)}
                  onChange={this.setFilter('excludeAntagonists')}
                />
              </div>
            )}
          </div>
        )}
      </Language.Consumer>
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
      <Language.Consumer>
        {(lang) => (
          <div className="leaderboard-page">
            <div className="content">
              {isChartView && (
                <div className="simple-search">
                  <NavLink exact to={routes.leaderboard.path}>
                    <button className="btn btn-sm btn-dark btn-icon">
                      <FaArrowLeft /> {lang.BACK_TO_ALL_CHARTS}
                    </button>
                  </NavLink>
                </div>
              )}
              {!isChartView && (
                <>
                  <div className="search-block">
                    {this.renderSimpleSearch()}
                    <CollapsibleBar title={lang.FILTERS}>{this.renderFilters()}</CollapsibleBar>
                    <CollapsibleBar title={lang.SORTING}>{this.renderSortings()}</CollapsibleBar>
                  </div>
                  {!!presets.length && (
                    <div className="presets-buttons">
                      <span>{lang.PRESETS}:</span>
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
                {_.isEmpty(filteredData) && !isLoading && (error ? error.message : lang.NO_RESULTS)}
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
                    {lang.SHOW_MORE}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </Language.Consumer>
    );
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(Leaderboard);
