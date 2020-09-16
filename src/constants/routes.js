export const routes = {
  leaderboard: {
    path: `/leaderboard`,
    sharedChart: {
      path: `/leaderboard/chart/:sharedChartId`,
      getPath: (params) => `/leaderboard/chart/${params.sharedChartId}`,
    },
  },
  songs: {
    path: `/songs`,
  },
  ranking: {
    path: `/ranking`,
    faq: {
      path: '/ranking/faq',
    },
  },
  tournaments: {
    path: `/tournaments`,
  },
  profile: {
    path: `/profiles/:id`,
    getPath: (params) => `/profiles/${params.id}`,
    compare: {
      path: `/profiles/:id/vs/:compareToId`,
      getPath: (params) => `/profiles/${params.id}/vs/${params.compareToId}`,
    },
  },
};
