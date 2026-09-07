export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/growth/index',
    'pages/media/index',
    'pages/profile/index',
    'pages/onboarding/index',
    'pages/record-edit/index',
    'pages/record-detail/index',
    'pages/vaccine/index',
    'pages/family/index',
    'pages/child-profile/index',
    'pages/settings/index',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: '宝宝成长录',
    navigationBarTextStyle: 'black',
  },
  tabBar: {
    color: '#6b7280',
    selectedColor: '#2563eb',
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
