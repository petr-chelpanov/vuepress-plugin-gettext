module.exports = {
  locales: {
    // The key is the path for the locale to be nested under.
    // As a special case, the default locale can use '/' as its path.
    '/': {
      lang: 'en-US', // this will be set as the lang attribute on <html>
      title: 'VuePress',
      description: 'Vue-powered Static Site Generator'
    },
    '/ru/': {
      lang: 'ru-RU',
      title: 'VuePress',
      description: 'Vue-powered Static Site Generator'
    }
  },
  plugins: [
    require('../../')
  ]
};