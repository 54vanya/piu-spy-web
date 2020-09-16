import React, { useEffect } from 'react';
import { Route, Redirect, Switch } from 'react-router-dom';
import { connect } from 'react-redux';
import localForage from 'localforage';
import ReactModal from 'react-modal';
import _ from 'lodash/fp';

import 'react-responsive-ui/style.css';
import './App.scss';

import { routes } from 'constants/routes';
import { CHART_MIN_MAX } from 'constants/leaderboard';

import SongsTop from 'components/SongsTop/SongsTop';
import Leaderboard from 'components/Leaderboard/Leaderboard';
import Ranking from 'components/Ranking/Ranking';
import Profile from 'components/Profile/Profile';
import ProfileCompare from 'components/ProfileCompare/ProfileCompare';
import TopBar from 'components/Shared/TopBar/TopBar';
import Loader from 'components/Shared/Loader';
import LoginScreen from 'components/LoginScreen/LoginScreen';
import SocketTracker from 'components/SocketTracker/SocketTracker';
import Tournaments from 'components/Tournaments/Tournaments';

import { fetchResults, setFilter } from 'reducers/results';
import { fetchTracklist } from 'reducers/tracklist';
import { fetchUser } from 'reducers/user';
import { fetchPreferences } from 'reducers/preferences';

ReactModal.setAppElement('#root');

const mapStateToProps = (state) => {
  return {
    userData: state.user.data,
    isLoading: state.user.isLoading,
  };
};

const mapDispatchToProps = {
  setFilter,
  fetchResults,
  fetchTracklist,
  fetchUser,
  fetchPreferences,
};

function App({
  fetchUser,
  fetchTracklist,
  fetchResults,
  fetchPreferences,
  setFilter,
  userData,
  isLoading,
}) {
  useEffect(() => {
    if (!process.env.REACT_APP_SOCKET) {
      fetchUser();
      localForage
        .getItem('filter')
        .then((filter) => {
          if (filter) {
            setFilter({
              ..._.omit('song', filter),
              chartRange: filter.chartRange && {
                ...filter.chartRange,
                range: _.every(
                  (r) => r >= CHART_MIN_MAX[0] && r <= CHART_MIN_MAX[1],
                  filter.chartRange.range
                )
                  ? filter.chartRange.range
                  : CHART_MIN_MAX,
              },
            });
          }
        })
        .catch((error) => console.error('Cannot get filter from local storage', error));
    }
  }, [fetchUser, fetchTracklist, fetchResults, setFilter]);

  useEffect(() => {
    if (!process.env.REACT_APP_SOCKET && userData && userData.player) {
      Promise.all([fetchTracklist(), fetchPreferences()]).then(() => {
        fetchResults();
      });
    }
  }, [userData, fetchPreferences, fetchResults, fetchTracklist]);

  useEffect(() => {
    if (process.env.REACT_APP_SOCKET) {
      fetchTracklist().then(() => {
        fetchResults();
      });
    }
  }, [fetchResults, fetchTracklist]);

  if (isLoading) {
    return (
      <div className="container">
        <Loader />
      </div>
    );
  }

  if (process.env.REACT_APP_SOCKET) {
    return <SocketTracker />;
  }

  if (!userData || !userData.player) {
    return <LoginScreen />;
  }

  return (
    <div className="container">
      <TopBar />
      <Route exact path="/" render={() => <Redirect to={routes.leaderboard.path} />} />
      <Route exact path={routes.leaderboard.path} component={Leaderboard} />
      <Route exact path={routes.leaderboard.sharedChart.path} component={Leaderboard} />
      <Route path={routes.ranking.path} component={Ranking} />
      <Route path={routes.profile.path}>
        <Switch>
          <Route path={routes.profile.path} exact component={Profile} />
          <Route path={routes.profile.compare.path} exact component={ProfileCompare} />
        </Switch>
      </Route>
      <Route path={routes.songs.path} component={SongsTop} />
      <Route path={routes.tournaments.path} component={Tournaments} />
    </div>
  );
}

export default connect(mapStateToProps, mapDispatchToProps)(App);
