function resolveAuthMode({ nodeEnv = process.env.NODE_ENV, authMode = process.env.AUTH_MODE } = {}) {
  const environment = String(nodeEnv || "development").trim().toLowerCase();
  const requested = String(authMode || "production").trim().toLowerCase();

  if (!['production', 'development'].includes(requested)) {
    throw new Error("AUTH_MODE must be either 'production' or 'development'.");
  }
  if (environment === 'production' && requested === 'development') {
    throw new Error("AUTH_MODE=development is forbidden when NODE_ENV=production.");
  }

  return { mode: requested, developmentEnabled: environment !== 'production' && requested === 'development' };
}

module.exports = { resolveAuthMode };
