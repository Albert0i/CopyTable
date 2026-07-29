/**
 * db.js
 */
import 'dotenv/config';
import Database from 'better-sqlite3';

// 1. Open the main database connection
const db = new Database(process.env.DATABASE, {
    // Optional: prints executed queries to your terminal
    // verbose: console.log 
});

// 2. Performance pragmas
if (process.env.DB_FAST_MODE === 'true') {
  // ⚡ Fast mode: maximum speed, less durability
  db.pragma('synchronous = OFF');
  db.pragma('journal_mode = MEMORY');
  db.pragma('temp_store = MEMORY');
  db.pragma('cache_size = -200000'); // ~200 MB cache
} else {
  // 🛡️ Safe mode: balanced durability
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
}

// 3. Export the fully connected instance
export default db;

/**
 * Performance PRAGMAs explained:
 *
 * PRAGMA synchronous = OFF;
 *   - Disables waiting for data to be flushed to disk.
 *   - ⚡ Much faster writes, but unsafe if the system crashes (risk of data loss).
 *
 * PRAGMA journal_mode = MEMORY;
 *   - Keeps the rollback journal in RAM instead of on disk.
 *   - ⚡ Reduces disk I/O, speeds up transactions.
 *   - ❌ If the process crashes, recovery is impossible.
 *
 * PRAGMA temp_store = MEMORY;
 *   - Stores temporary tables and indices in RAM.
 *   - ⚡ Faster joins, sorts, and intermediate operations.
 *
 * PRAGMA cache_size = -200000;
 *   - Negative value means KB units; here ~200 MB page cache.
 *   - ⚡ Reduces disk reads/writes by keeping more pages in memory.
 *   - ❌ Large cache may consume significant RAM.
 *
 * Together, these settings can make bulk inserts or hash builds
 * several times faster (5×–10×), but they trade away durability.
 * Use them for ephemeral workloads where data can be regenerated,
 * and switch back to WAL + NORMAL for production safety.
 */
