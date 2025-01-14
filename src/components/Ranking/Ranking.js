import React, { Component } from 'react';
import toBe from 'prop-types';
import { connect } from 'react-redux';
import { FaSearch, FaQuestionCircle } from 'react-icons/fa';
import { Link, Route, withRouter } from 'react-router-dom';
import { createSelector } from 'reselect';
import _ from 'lodash/fp';

// styles
import './ranking.scss';

// components
import RankingList from './RankingList';
import RankingFaq from './RankingFaq';

// constants
import { routes } from 'constants/routes';

// reducers
import { fetchChartsData } from 'reducers/charts';
import { updatePreferences } from 'reducers/preferences';

// utils
import { Language } from 'utils/context/translation';

// code
const rankingSelector = createSelector(
  (state) => state.results.profiles,
  _.flow(_.values, _.orderBy('pp', ['desc']))
);

const mapStateToProps = (state) => {
  return {
    preferences: state.preferences.data,
    ranking: rankingSelector(state),
    error: state.charts.error || state.tracklist.error,
    isLoading:
      state.charts.isLoading || state.results.isLoadingRanking || state.tracklist.isLoading,
  };
};

const mapDispatchToProps = {
  fetchChartsData,
  updatePreferences,
};

class Ranking extends Component {

  static contextType = Language;

  static propTypes = {
    ranking: toBe.array,
    error: toBe.object,
    preferences: toBe.object,
    isLoading: toBe.bool.isRequired,
    updatePreferences: toBe.func.isRequired,
  };

  static defaultProps = {
    ranking: [],
  };

  onChangeHidingPlayers = () => {
    const { preferences, updatePreferences } = this.props;

    updatePreferences(
      _.set(['showHiddenPlayersInRanking'], !preferences.showHiddenPlayersInRanking, preferences)
    );
  };

  onRefresh = () => {
    const { isLoading } = this.props;
    !isLoading && this.props.fetchChartsData();
  };

  render() {
    const lang = this.context;
    const { isLoading, ranking, error, preferences, updatePreferences } = this.props;
    return (
      <div className="ranking-page">
        <div className="content">
          {error && error.message}
          <div className="top-controls">
            <div className="_flex-fill" />
            <Route
              exact
              path={routes.ranking.path}
              render={() => (
                <>
                  <button
                    className="btn btn-sm btn-dark btn-icon _margin-right"
                    onClick={this.onChangeHidingPlayers}
                  >
                    {preferences.showHiddenPlayersInRanking
                      ? lang.HIDE_UNSELECTED
                      : lang.SHOW_ALL}
                  </button>
                  <Link to={routes.ranking.faq.path}>
                    <button className="btn btn-sm btn-dark btn-icon _margin-right">
                      <FaQuestionCircle /> faq
                    </button>
                  </Link>
                  <button
                    disabled={isLoading}
                    className="btn btn-sm btn-dark btn-icon"
                    onClick={this.onRefresh}
                  >
                    <FaSearch /> {lang.UPDATE}
                  </button>
                </>
              )}
            />
            <Route
              exact
              path={routes.ranking.faq.path}
              render={() => (
                <Link to={routes.ranking.path}>
                  <button className="btn btn-sm btn-dark btn-icon">назад</button>
                </Link>
              )}
            />
          </div>
          <Route
            exact
            path={routes.ranking.path}
            render={() => (
              <RankingList
                ranking={ranking}
                isLoading={isLoading}
                preferences={preferences}
                updatePreferences={updatePreferences}
              />
            )}
          />
          <Route exact path={routes.ranking.faq.path} component={RankingFaq} />
        </div>
      </div>
    );
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(withRouter(Ranking));
