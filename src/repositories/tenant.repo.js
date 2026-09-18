const db = require('../config/db');
const { newId } = require('../utils/id');

async function createTenant({ name, email, passwordHash }) {
  const id = newId();
  await db('tenants').insert({
    id,
    name,
    email: email.toLowerCase().trim(),
    password_hash: passwordHash,
  });
  return findById(id);
}

function findByEmail(email) {
  return db('tenants').where({ email: email.toLowerCase().trim() }).first();
}

function findById(id) {
  return db('tenants').where({ id }).first();
}

module.exports = { createTenant, findByEmail, findById };
