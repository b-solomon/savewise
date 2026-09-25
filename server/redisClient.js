import Redis from 'ioredis';

let redis = null;
let redisAvailable = false;
const inMemoryBlacklist = new Set();
const REVOKED_TOKENS_SET = 'revoked_tokens';

// Only attempt Redis connection if REDIS_URL is provided, or in production
if (process.env.REDIS_URL) {
  try {
    redis = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      enableOfflineQueue: false,
      retryStrategy(times) {
        if (times > 3) return null; // stop retrying after 3 attempts
        return Math.min(times * 200, 1000);
      }
    });

    redis.on('connect', () => {
      redisAvailable = true;
      console.log('Connected to Redis for token revocation.');
    });

    redis.on('error', (err) => {
      redisAvailable = false;
      // Silently fall back to memory blacklist - do not crash process
    });

    redis.connect().catch(() => {
      redisAvailable = false;
    });
  } catch {
    redisAvailable = false;
  }
}

/**
 * Adds a token to the revoked set.
 * @param {string} token JWT to revoke
 */
export const revokeToken = async (token) => {
  if (!token) return;
  inMemoryBlacklist.add(token);
  if (redis && redisAvailable) {
    try {
      await redis.sadd(REVOKED_TOKENS_SET, token);
      await redis.expire(REVOKED_TOKENS_SET, 24 * 60 * 60);
    } catch {
      // Memory fallback active
    }
  }
};

/**
 * Checks whether a token is revoked.
 * @param {string} token JWT to check
 * @returns {Promise<boolean>} true if revoked
 */
export const isTokenRevoked = async (token) => {
  if (!token) return false;
  if (inMemoryBlacklist.has(token)) return true;
  if (redis && redisAvailable) {
    try {
      const result = await redis.sismember(REVOKED_TOKENS_SET, token);
      return result === 1;
    } catch {
      return inMemoryBlacklist.has(token);
    }
  }
  return false;
};

/**
 * Clears all revoked tokens.
 */
export const clearRevokedTokens = async () => {
  inMemoryBlacklist.clear();
  if (redis && redisAvailable) {
    try {
      await redis.del(REVOKED_TOKENS_SET);
    } catch {
      // ignore
    }
  }
};

