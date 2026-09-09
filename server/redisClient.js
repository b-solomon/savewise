import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

const REVOKED_TOKENS_SET = 'revoked_tokens';

/**
 * Adds a token to the revoked set.
 * @param {string} token JWT to revoke
 */
export const revokeToken = async (token) => {
  if (!token) return;
  // Store token; set a TTL to avoid indefinite growth (e.g., 24h)
  await redis.sadd(REVOKED_TOKENS_SET, token);
  await redis.expire(REVOKED_TOKENS_SET, 24 * 60 * 60);
};

/**
 * Checks whether a token is revoked.
 * @param {string} token JWT to check
 * @returns {Promise<boolean>} true if revoked
 */
export const isTokenRevoked = async (token) => {
  if (!token) return false;
  const result = await redis.sismember(REVOKED_TOKENS_SET, token);
  return result === 1;
};

/**
 * Clears all revoked tokens (useful for forced logout of all users).
 */
export const clearRevokedTokens = async () => {
  await redis.del(REVOKED_TOKENS_SET);
};
