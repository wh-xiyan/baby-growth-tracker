export default defineAppConfig({
  pages: ['pages/home/index', 'pages/growth/index', 'pages/media/index', 'pages/profile/index'],
  subPackages: [
    { root: 'pages/growth-reference', pages: ['index'] },
    { root: 'pages/onboarding', pages: ['index'] },
    { root: 'pages/record-edit', pages: ['index'] },
    { root: 'pages/record-list', pages: ['index'] },
    { root: 'pages/care-detail', pages: ['index'] },
    { root: 'pages/vaccine-detail', pages: ['index'] },
    { root: 'pages/record-detail', pages: ['index'] },
    { root: 'pages/vaccine', pages: ['index'] },
    { root: 'pages/family', pages: ['index'] },
    { root: 'pages/child-profile', pages: ['index'] },
    { root: 'pages/settings', pages: ['index'] },
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#f7f5ec',
    navigationBarTitleText: '宝宝成长录',
    navigationBarTextStyle: 'black',
  },
  tabBar: {
    color: '#6b7280',
    selectedColor: '#7fa68a',
    backgroundColor: '#ffffff',
    borderStyle: 'black',
    list: [
      { pagePath: 'pages/home/index', text: '首页' },
      { pagePath: 'pages/growth/index', text: '成长' },
      { pagePath: 'pages/media/index', text: '相册' },
      { pagePath: 'pages/profile/index', text: '我的' },
    ],
  },
})
