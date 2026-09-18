const knex = require('knex');
const knexConfig = require('../../knexfile');

// A single shared connection/pool for the whole process. Repositories
// require() this module rather than constructing their own knex instance.
const db = knex(knexConfig);

module.exports = db;
