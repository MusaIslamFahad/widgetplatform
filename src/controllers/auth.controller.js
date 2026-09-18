const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const AppError = require('../utils/AppError');
const tenantRepo = require('../repositories/tenant.repo');
const { registerSchema, loginSchema } = require('../validation/auth.schema');

function issueToken(tenant) {
  return jwt.sign({ sub: tenant.id, email: tenant.email }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
}

async function register(req, res) {
  const { name, email, password } = registerSchema.parse(req.body);

  const existing = await tenantRepo.findByEmail(email);
  if (existing) {
    throw new AppError(409, 'email_taken', 'An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const tenant = await tenantRepo.createTenant({ name, email, passwordHash });

  res.status(201).json({
    tenant: { id: tenant.id, name: tenant.name, email: tenant.email },
    token: issueToken(tenant),
  });
}

async function login(req, res) {
  const { email, password } = loginSchema.parse(req.body);

  const tenant = await tenantRepo.findByEmail(email);
  if (!tenant) {
    throw new AppError(401, 'invalid_credentials', 'Email or password is incorrect');
  }

  const valid = await bcrypt.compare(password, tenant.password_hash);
  if (!valid) {
    throw new AppError(401, 'invalid_credentials', 'Email or password is incorrect');
  }

  res.json({
    tenant: { id: tenant.id, name: tenant.name, email: tenant.email },
    token: issueToken(tenant),
  });
}

module.exports = { register, login };
