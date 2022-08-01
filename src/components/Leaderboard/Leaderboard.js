import React, { useCallback, useContext, useMemo, useState } from 'react';
import { connect } from 'react-redux';
import _ from 'lodash/fp';
import Select from 'react-select';
import classNames from 'classnames';
import localForage from 'localforage';
import { FaArrowLeft, FaRedoAlt, FaSearch } from 'react-icons/fa';

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
import { RANK_FILTER, SORT } from 'constants/leaderboard';

// reducers
import { fetchChartsData } from 'reducers/charts';
import { defaultFilter, resetFilter, setFilter } from 'reducers/results';
import { openPreset, selectPreset } from 'reducers/presets';

// utils
import { colorsArray } from 'utils/colors';
import { filteredDataSelector, playersSelector, sharedChartDataSelector } from 'reducers/selectors';
import { Language } from 'utils/context/translation';
import { FilteredDataContext } from '../Contexts/FilteredDataContext';

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

const Leaderboard = (props) => {

  const [showItemsCount, setShowItemsCount] = useState(props.isChartView ? 1 : 20);
  const lang = useContext(Language);

  const setFilter = _.curry((name, value) => {
    const filter = { ...props.filter, [name]: value };
    props.setFilter(filter);
    localForage.setItem('filter', filter);
  });

  const resetFilter = () => {
    props.resetFilter();
    localForage.setItem('filter', defaultFilter);
  };

  const onRefresh = () => {
    const { isLoading } = props;
    !isLoading && props.fetchChartsData();
  };

  const onTypeSongName = _.debounce(300, (value) => {
    setFilter('song', value);
  });

  const renderSimpleSearch = () => {
    const { isLoading, filter } = props;
    return (
      <Language.Consumer>
        {(lang) => (
          <div className="simple-search">
            <div className="song-name _margin-right _margin-bottom">
              <Input
                value={filter.song || ''}
                placeholder={lang.SONG_NAME_PLACEHOLDER}
                className="form-control"
                onChange={onTypeSongName}
              />
            </div>
            <div className="chart-range _margin-right _margin-bottom">
              <ChartFilter
                filterValue={filter.chartRange}
                onChange={setFilter('chartRange')}
              />
            </div>
            <div className="_flex-fill" />
            <div className="_flex-row _margin-bottom">
              <PresetsControl />
              <button
                className="btn btn-sm btn-dark btn-icon _margin-right"
                onClick={resetFilter}
              >
                <FaRedoAlt /> {lang.RESET_FILTERS}
              </button>
              <button
                disabled={isLoading}
                className="btn btn-sm btn-dark btn-icon"
                onClick={onRefresh}
              >
                <FaSearch /> {lang.REFRESH}
              </button>
            </div>
          </div>
        )}
      </Language.Consumer>
    );
  };

  const renderFilters = () => {
    const { players, filter } = props;
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
                    onChange={setFilter('players')}
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
                    onChange={setFilter('playersOr')}
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
                    onChange={setFilter('playersNot')}
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
                    onChange={setFilter('rank')}
                  />
                </div>
              </div>
            </div>
            <div>
              <Toggle
                checked={_.getOr(false, 'showHiddenFromPreferences', filter)}
                onChange={setFilter('showHiddenFromPreferences')}
              >
                {lang.SHOW_HIDDEN_PLAYERS}
              </Toggle>
            </div>
          </div>
        )}
      </Language.Consumer>
    );
  };

  const renderSortings = () => {
    const { players, filter } = props;
    return (
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
            onChange={setFilter('sortingType')}
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
              onChange={setFilter('protagonist')}
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
              onChange={setFilter('excludeAntagonists')}
            />
          </div>
        )}
      </div>
    );
  };

  const { isLoading, isChartView, filteredData, error, filter, presets, history } = props;

  const canShowMore = filteredData.length > showItemsCount;
  // const visibleData = _.slice(0, showItemsCount, filteredData);

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
  const protagonistName = filter?.protagonist?.value;
  const uniqueSelectedNames = useMemo(() => _.slice(
    0,
    colorsArray.length,
    _.uniq(
      _.compact([
        highlightProtagonist && protagonistName,
        ..._.map('value', filter.players),
        ..._.map('value', filter.playersOr),
      ]),
    ),
  ), [filter.players, filter.playersOr, highlightProtagonist, protagonistName]);

  const renderVisibleData = useCallback((chartIndex) => {
    return (
      <Chart
        showHiddenPlayers={isChartView || filter.showHiddenFromPreferences}
        key={filteredData[chartIndex].sharedChartId}
        chartIndex={chartIndex}
        showProtagonistEloChange={showProtagonistEloChange}
        showProtagonistPpChange={showProtagonistPpChange}
        uniqueSelectedNames={uniqueSelectedNames}
        protagonistName={protagonistName}
        isChartView={isChartView}
      />
    );
  }, [filter.showHiddenFromPreferences, isChartView, protagonistName, showProtagonistEloChange, showProtagonistPpChange, uniqueSelectedNames, filteredData])

  return (
    <FilteredDataContext.Provider value={filteredData}>
      <div className="leaderboard-page">
        <div className="content">
          {isChartView && (
            <div className="simple-search">
              {/* <NavLink exact to={routes.leaderboard.path}> */}
              <button className="btn btn-sm btn-dark btn-icon" onClick={() => history.goBack()}>
                <FaArrowLeft /> {lang.BACK_BUTTON}
              </button>
              {/* </NavLink> */}
            </div>
          )}
          {!isChartView && (
            <>
              <div className="search-block">
                {renderSimpleSearch()}
                <CollapsibleBar title={lang.FILTERS}>{renderFilters()}</CollapsibleBar>
                <CollapsibleBar title={lang.SORTING}>{renderSortings()}</CollapsibleBar>
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
                        props.selectPreset(preset);
                        props.openPreset();
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
            {!isLoading && filteredData.length > 0 &&
              Array(showItemsCount).fill(() => undefined).map((_, chartIndex) => renderVisibleData(chartIndex))}
            {!isLoading && canShowMore && (
              <button
                className="btn btn-primary"
                onClick={() => setShowItemsCount(showItemsCount + 10)}
              >
                {lang.SHOW_MORE}
              </button>
            )}
          </div>
        </div>
      </div>
    </FilteredDataContext.Provider>
  );
};

export default connect(mapStateToProps, mapDispatchToProps)(Leaderboard);
