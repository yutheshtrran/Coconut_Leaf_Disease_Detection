const mongoose = require('mongoose');

const RETRYABLE_NAMES = [
  'MongoNetworkError',
  'MongoNetworkTimeoutError',
  'MongoServerSelectionError',
  'MongoTopologyClosedError',
  // Pool-cleared errors: err.name === 'PoolClearedError' but
  // err.constructor.name === 'MongoPoolClearedError' — list both
  'MongoPoolClearedError',
  'PoolClearedOnNetworkError',
  'PoolClearedError',
];

// MongoDB driver stamps errorLabelSet with these when it considers the op retryable.
const RETRYABLE_LABELS = ['RetryableWriteError', 'PoolRequstedRetry'];

function isRetryable(err) {
  // Check both .name (the error's own name property) and .constructor.name
  if (RETRYABLE_NAMES.includes(err.name)) return true;
  if (RETRYABLE_NAMES.includes(err.constructor?.name)) return true;
  // Substring match on the message or code as a last resort
  if (RETRYABLE_NAMES.some(n => err.message?.includes(n))) return true;
  // Honour the driver's own retry signals (errorLabelSet is a Set on MongoError)
  if (Array.isArray(err.errorLabels) && err.errorLabels.some(l => RETRYABLE_LABELS.includes(l))) return true;
  if (err.errorLabelSet instanceof Set &&
      RETRYABLE_LABELS.some(l => err.errorLabelSet.has(l))) return true;
  return false;
}

/**
 * Run a Mongoose operation with automatic retry on transient Atlas errors.
 *
 *   const reports = await dbRetry(() => Report.find({ userId }));
 *
 * Retries up to 4 times with 0.5 s → 1 s → 2 s → 4 s back-off.
 * With serverSelectionTimeoutMS=8000 the worst-case total is
 * 8+0.5+8+1+8+2+8 ≈ 36 s, which covers a 30-second Atlas election.
 * Throws the last error if all attempts fail.
 */
async function dbRetry(fn, attempts = 5) {
  let delay = 1000;  // ECONNRESET clears the pool; give it 1 s before first retry
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (!isRetryable(err) || i === attempts) throw err;
      console.warn(`[dbRetry] attempt ${i} failed (${err.constructor?.name}), retrying in ${delay}ms…`);
      await new Promise(r => setTimeout(r, delay));
      delay *= 2;
    }
  }
}

module.exports = dbRetry;
