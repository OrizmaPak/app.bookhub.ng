const { eslint } = require('@coko/lint')

eslint.settings = {
  jest: {
    version: '27',
  },
}

module.exports = eslint
