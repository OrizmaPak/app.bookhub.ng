const fs = require('fs')
const path = require('path')
const resolvers = require('./thoth.resolvers')

module.exports = {
  resolvers,
  typeDefs: fs.readFileSync(path.join(__dirname, 'thoth.graphql'), 'utf-8'),
}
