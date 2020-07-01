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
import { fetchResults } from 'reducers/results';
import { updatePreferences } from 'reducers/preferences';

// utils

// code
const rankingSelector = createSelector(
  (state) => state.results.profiles,
  // _.flow(_.values, _.orderBy(['pp.pp'], ['desc']))
  _.flow(_.values, _.orderBy(['ratingRaw'], ['desc']))
);

const mapStateToProps = (state) => {
  return {
    preferences: state.preferences.data,
    ranking: rankingSelector(state),
    error: state.results.error || state.tracklist.error,
    isLoading:
      state.results.isLoading || state.results.isLoadingRanking || state.tracklist.isLoading,
  };
};

const mapDispatchToProps = {
  fetchResults,
  updatePreferences,
};

class Ranking extends Component {
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

  onRefresh = () => {
    const { isLoading } = this.props;
    !isLoading && this.props.fetchResults();
  };

  render() {
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
                    <FaSearch /> обновить
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
