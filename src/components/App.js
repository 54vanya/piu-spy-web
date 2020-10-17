import React, { useEffect } from 'react';
import { Route, Redirect, Switch } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
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
import { fetchChartsData } from 'reducers/charts';
import { fetchPlayers } from 'reducers/players';

ReactModal.setAppElement('#root');

function App() {
  const dispatch = useDispatch();
  const userData = useSelector(state => state.user.data);
  const isLoading = useSelector(state => state.user.isLoading);

  // const resultsStore = useSelector(state => state.results);
  // console.log(resultsStore)

  useEffect(() => {
    if (!process.env.REACT_APP_SOCKET) {
      dispatch(fetchUser());
      localForage
        .getItem('filter')
        .then((filter) => {
          if (filter) {
            dispatch(setFilter({
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
            }));
          }
        })
        .catch((error) => console.error('Cannot get filter from local storage', error));
    }
  }, [dispatch]);

  useEffect(() => {
    if (!process.env.REACT_APP_SOCKET && userData && userData.player) {
      Promise.all([dispatch(fetchPlayers()), dispatch(fetchTracklist()), dispatch(fetchPreferences())]).then(() => {
        // dispatch(fetchResults());
        dispatch(fetchChartsData());
      });
    }
  }, [dispatch, userData]);

  useEffect(() => {
    if (process.env.REACT_APP_SOCKET) {
      dispatch(fetchTracklist()).then(() => {
        dispatch(fetchResults());
      });
    }
  }, [dispatch]);

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

export default App;
