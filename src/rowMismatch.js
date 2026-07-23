/**
 * rowMismatch.js
 * Row-level auditor for mismatched hashes
 *
 * - Reads mismatched hash_values from hash_tracker (SQLite)
 * - For each mismatch, queries Oracle 19c via yrunner.js
 * - Converts the row into a one-line INSERT statement
 * - Logs SQL with comments into ./logs/mismatch_<MacauTimestamp>.log
 */
import 'dotenv/config';
import db from './db.js';              // SQLite hash_tracker
import fs from 'fs';
import path from 'path';
import oracledb from 'oracledb';
import { createRunner } from './yrunner.js';
import { createDbConfig } from './config/dbConfig.js';

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

// Utility: Macau timestamp for log filename
const macauTime = new Date().toLocaleString('zh-CN', {
  timeZone: 'Asia/Macau',
  hour12: false
}).replace(/[^\d]/g, '-');
const logFile = path.join('./logs', `mismatch_${macauTime}.log`);
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

// Create config for source and target schemas
const sourceConfig = createDbConfig({
  user: process.env.SOURCE_ORACLEDB_USER,
  password: process.env.SOURCE_ORACLEDB_PASSWORD,
  connectString: process.env.SOURCE_ORACLEDB_CONNECTIONSTRING
});
const targetConfig = createDbConfig({
  user: process.env.TARGET_ORACLEDB_USER,
  password: process.env.TARGET_ORACLEDB_PASSWORD,
  connectString: process.env.TARGET_ORACLEDB_CONNECTIONSTRING
});
// Create runners for source and target schemas
const sourceRunner = createRunner(sourceConfig);
const targetRunner = createRunner(targetConfig);

// Query 3: mismatched hashes
const mismatchedHashesQuery = `
SELECT table_name,
       hash_value,
       SUM(CASE WHEN schema_type='SOURCE' THEN 1 ELSE 0 END) AS source_count,
       SUM(CASE WHEN schema_type='TARGET' THEN 1 ELSE 0 END) AS target_count
FROM   hash_tracker
GROUP BY table_name, hash_value
HAVING source_count != target_count
ORDER BY table_name, hash_value;
`;

function formatValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return val.toString();
  if (val instanceof Date) {
    return `TO_DATE('${val.toISOString().slice(0,19)}','YYYY-MM-DD"T"HH24:MI:SS')`;
  }
  let s = String(val).trim().replace(/'/g, "''");
  if (s === '') s = ' ';
  return `'${s}'`;
}

const mismatches = db.prepare(mismatchedHashesQuery).all();

(async () => {
  for (const m of mismatches) {
    // Source Schema 
    if (m.source_count !== 0) {
      // Get full detail from hash_tracker    
      const details = db.prepare(
        `SELECT schema_name, schema_type, table_name, common_columns, row_seq FROM hash_tracker WHERE table_name=? AND hash_value=? ORDER BY schema_name, table_name`
      ).all(m.table_name, m.hash_value);

      for (const detail of details) {
        // Always use sourceRunner as requested
        const selectSQL = `SELECT ${detail.common_columns}
                          FROM ${detail.schema_name}.${detail.table_name}
                          OFFSET ${detail.row_seq - 1} ROWS FETCH FIRST 1 ROWS ONLY`;

        // Run SELECT
        const result = await sourceRunner.runSelectSQL(selectSQL);
        if (!result.success || result.rows.length === 0) {
          logStream.write(`-- Failed to fetch row for hash_value=${detail.hash_value} (${result.message})\n`);
          continue;
        }

        // Each row is an object → extract values
        const rowObj = result.rows[0];
        const values = Object.values(rowObj).map(formatValue).join(',');

        // Build INSERT
        const insertSQL = `INSERT INTO ${detail.schema_name}.${detail.table_name} (${detail.common_columns}) VALUES (${values});`;

        // Log with comment
        logStream.write(`-- Mismatch hash_value=${m.hash_value} from ${detail.schema_name}.${detail.table_name}\n`);
        logStream.write(`${insertSQL}\n\n`);
      }
    }
    // Target Schema
    if (m.target_count !== 0) {
      // Get full detail from hash_tracker    
      const details = db.prepare(
        `SELECT schema_name, schema_type, table_name, common_columns, row_seq FROM hash_tracker WHERE table_name=? AND hash_value=? ORDER BY schema_name, table_name`
      ).all(m.table_name, m.hash_value);

      for (const detail of details) {
        // Always use targetRunner as requested
        const selectSQL = `SELECT ${detail.common_columns}
                          FROM ${detail.schema_name}.${detail.table_name}
                          OFFSET ${detail.row_seq - 1} ROWS FETCH FIRST 1 ROWS ONLY`;

        // Run SELECT
        const result = await targetRunner.runSelectSQL(selectSQL);
        if (!result.success || result.rows.length === 0) {
          logStream.write(`-- Failed to fetch row for hash_value=${detail.hash_value} (${result.message})\n`);
          continue;
        }

        // Each row is an object → extract values
        const rowObj = result.rows[0];
        const values = Object.values(rowObj).map(formatValue).join(',');

        // Build INSERT
        const insertSQL = `INSERT INTO ${detail.schema_name}.${detail.table_name} (${detail.common_columns}) VALUES (${values});`;

        // Log with comment
        logStream.write(`-- Mismatch hash_value=${m.hash_value} from ${detail.schema_name}.${detail.table_name}\n`);
        logStream.write(`${insertSQL}\n\n`);
      }
    }

    // Print a dot for each completed hash
    //process.stdout.write('.');
    // Print progress to console
    console.log(`✔ Processed hash: ${m.hash_value}`);
  }

  // End log and print summary
  logStream.end();
  // console.log(`Row mismatch log written to ${logFile}`);
  console.log(`Row mismatch log written to ${logFile} — ${mismatches.length} hashes processed.`);
})();

/*
   node src/rowMismatch.js
*/