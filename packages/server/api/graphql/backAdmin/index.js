const fs = require('fs')
const path = require('path')
const resolvers = require('./backAdmin.resolvers')

module.exports = {
  resolvers,
  typeDefs: fs.readFileSync(path.join(__dirname, 'backAdmin.graphql'), 'utf-8'),
}
