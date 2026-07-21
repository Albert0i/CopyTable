/**
 * db.js
 */
import 'dotenv/config';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import path from 'path';

// 1. Open the main database connection
const db = new Database(process.env.DATABASE, {
    // Optional: prints executed queries to your terminal
    // verbose: console.log 
});

// 2. Performance pragmas
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL'); // or OFF for maximum speed

// 3. Export the fully connected instance as the default export
export default db;
