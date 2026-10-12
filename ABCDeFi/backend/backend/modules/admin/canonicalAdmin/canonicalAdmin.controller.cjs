const chronological = (records) => [...records].sort((left, right) => {
  const byBlock = BigInt(left.blockNumber || 0) - BigInt(right.blockNumber || 0);
  if (byBlock !== 0n) return byBlock < 0n ? -1 : 1;
  const byTransaction = Number(left.transactionIndex || 0) - Number(right.transactionIndex || 0);
  return byTransaction || Number(left.logIndex || 0) - Number(right.logIndex || 0);
});

function createCanonicalAdminController({ moduleRegistry, eventSources = [], checkpointSources = [], authoritativeSources = [] }) {
  const source = { kind: 'canonical-indexed-on-chain-admin' };
  const status = async (req, res, next) => {
    try {
      const modules = moduleRegistry();
      // A deployment manifest proves configuration, not indexer readiness.  Keep
      // those signals distinct so the Admin UI cannot represent an unindexed
      // module as a ready source of canonical activity.
      const health = await Promise.all(checkpointSources.map(async (checkpointSource) => {
        try {
          const checkpoint = await checkpointSource.read();
          return { module: checkpointSource.module, available: Boolean(checkpoint), checkpoint: checkpoint || null };
        } catch {
          return { module: checkpointSource.module, available: false, checkpoint: null };
        }
      }));
      const byModule = new Map(health.map((entry) => [entry.module, entry]));
      const authorities = await Promise.all(authoritativeSources.map(async (authoritativeSource) => {
        try {
          return { module: authoritativeSource.module, available: true, snapshot: await authoritativeSource.read({ walletAddress: req.query?.wallet }) };
        } catch (error) {
          return { module: authoritativeSource.module, available: false, snapshot: null, reason: error instanceof Error ? error.message : String(error) };
        }
      }));
      const authorityByModule = new Map(authorities.map((entry) => [entry.module, entry]));
      const enriched = modules.map((module) => {
        const checkpoint = byModule.get(module.name);
        const authority = authorityByModule.get(module.name);
        if (authority && !authority.available) return { ...module, available: false, status: 'UNAVAILABLE', reason: authority.reason, authority: { kind: 'AUTHORITATIVE_ON_CHAIN', available: false, snapshot: null } };
        const withAuthority = authority ? { ...module, authority: { kind: 'AUTHORITATIVE_ON_CHAIN', available: true, snapshot: authority.snapshot } } : module;
        return checkpoint ? { ...withAuthority, indexer: checkpoint } : withAuthority;
      });
      const configured = enriched.filter((entry) => entry.available).length;
      res.json({ source, available: configured > 0, status: configured > 0 ? 'AVAILABLE' : 'UNAVAILABLE', modules: enriched });
    } catch (error) { next(error); }
  };
  const history = async (req, res, next) => {
    try {
      const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 200);
      const records = [];
      for (const eventSource of eventSources) {
        try {
          const events = await eventSource.read();
          for (const event of events) records.push({ module: eventSource.module, ...event });
        } catch { /* A module projection is reported unavailable by status; never synthesize history. */ }
      }
      res.json({ source, available: true, status: 'AVAILABLE', data: chronological(records).slice(0, limit) });
    } catch (error) { next(error); }
  };
  return { status, history };
}

module.exports = { createCanonicalAdminController };
