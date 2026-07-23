/**
 * buildHashes.js
 */
import 'dotenv/config';
import fs from 'fs';
import crypto from 'crypto';
import oracledb from 'oracledb';
import { createRunner } from './yrunner.js';
import { createDbConfig } from './config/dbConfig.js';
import db from './db.js';   // <-- use your db.js wrapper

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

const [,, rawSourceSchema, rawTargetSchema, manifestFile] = process.argv;
if (!rawSourceSchema || !rawTargetSchema || !manifestFile) {
  console.error(`
    Usage:
      node src/buildHashes.js <source schema> <target schema> <files.txt>

    Example: 
        node src/buildHashes.js DCDEVDTA DCUATDTA files.txt`);
  process.exit(1);
}

const sourceSchema = rawSourceSchema.toUpperCase();
const targetSchema = rawTargetSchema.toUpperCase();
const tables = fs.readFileSync(manifestFile, 'utf-8')
  .trim()
  .split('\n')
  .map(t => t.trim().toUpperCase());

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

const sourceRunner = createRunner(sourceConfig);
const targetRunner = createRunner(targetConfig);

// Truncate hash_tracker table
db.prepare('DELETE FROM hash_tracker').run();
// Reset id to restart at 1 each run:
db.prepare("DELETE FROM sqlite_sequence WHERE name='hash_tracker'").run();

let sourceCount = 0;
let targetCount = 0;

// Normalize Oracle column metadata
function normalizeColumns(rows) {
  return rows.map(r => {
    let dt = r.DATA_TYPE.trim().toUpperCase();
    if (dt === 'CHAR') dt = 'VARCHAR2';
    return {
      column_name: r.COLUMN_NAME.trim().toUpperCase(),
      data_type: dt
    };
  }).filter(c => !c.column_name.startsWith("OGG_"));
}

// Retrieve column metadata
async function getColumns(runner, schema, table) {
  const sql = `
    SELECT column_name, data_type
    FROM   all_tab_columns
    WHERE  owner = '${schema}'
    AND    table_name = '${table}'
    ORDER BY column_id
  `;
  const result = await runner.runSelectSQL(sql);
  return result.success ? normalizeColumns(result.rows) : [];
}

// Convert JS values into SQL-safe literals (NULL, numbers, dates, strings)
function formatValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return val.toString();
  if (val instanceof Date) {
    return `TO_DATE('${val.toISOString().slice(0,19)}','YYYY-MM-DD"T"HH24:MI:SS')`;
  }
  let s = String(val).trim().replace(/'/g, "''");
  if (s === '') s = ' ';
  return `'${s.replace(/\r?\n/g, ' ')}'`; // sanitize embedded linebreaks
}
function computeHash(row, commonCols) {
  const vals = commonCols.map(c => formatValue(row[c]));
  return crypto.createHash('md5')
    .update(vals.join('|'))
    .digest('hex');
}

function formatDuration(ms) {
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
  const nnn = String(ms % 1000).padStart(3, '0');
  return `${h}:${m}:${s}.${nnn}`;
}

/*
   main
*/
(async () => {
  const startTime = new Date();

  for (const table of tables) {
    if (table.length === 0 || table.startsWith("--")) continue;

    console.log(`\n=== Hashing ${sourceSchema}.${table} & ${targetSchema}.${table} ===`);

    try {
      const srcCols = await getColumns(sourceRunner, sourceSchema, table);
      const tgtCols = await getColumns(targetRunner, targetSchema, table);

      const tgtMap = new Map(tgtCols.map(c => [c.column_name, c.data_type]));
      const commonCols = srcCols.filter(c =>
        tgtMap.has(c.column_name) && tgtMap.get(c.column_name) === c.data_type
      ).map(c => c.column_name);

      if (commonCols.length === 0) {
        console.warn(`No intersected columns for ${table}, skipping.`);
        continue;
      }

      // Source schema rows
      let offset = 0;
      let rowSeq = 1;
      const batchSize = 1000;
      while (true) {
        const sql = `
          SELECT ${commonCols.join(', ')}
          FROM   ${sourceSchema}.${table}
          OFFSET ${offset} ROWS FETCH NEXT ${batchSize} ROWS ONLY
        `;
        const result = await sourceRunner.runSelectSQL(sql);
        if (!result.success || result.rows.length === 0) break;

        for (const row of result.rows) {
          const hash = computeHash(row, commonCols);
        //   db.prepare(
        //     `INSERT INTO hash_tracker (schema_name, table_name, common_columns, row_seq, hash_value)
        //      VALUES (?, ?, ?, ?, ?)`
        //   ).run('SOURCE', table, commonCols.join(','), rowSeq++, hash);
        db.prepare(`
        INSERT INTO hash_tracker (schema_name, schema_type, table_name, common_columns, row_seq, hash_value)
        VALUES (?, ?, ?, ?, ?, ?)
        `).run(sourceSchema, 'SOURCE', table, commonCols.join(','), rowSeq++, hash);
        
          sourceCount++;
        }
        offset += batchSize;
      }

      // Target schema rows
      offset = 0;
      rowSeq = 1;
      while (true) {
        const sql = `
          SELECT ${commonCols.join(', ')}
          FROM   ${targetSchema}.${table}
          OFFSET ${offset} ROWS FETCH NEXT ${batchSize} ROWS ONLY
        `;
        const result = await targetRunner.runSelectSQL(sql);
        if (!result.success || result.rows.length === 0) break;

        for (const row of result.rows) {
          const hash = computeHash(row, commonCols);
        //   db.prepare(
        //     `INSERT INTO hash_tracker (schema_name, table_name, common_columns, row_seq, hash_value)
        //      VALUES (?, ?, ?, ?, ?)`
        //   ).run('TARGET', table, commonCols.join(','), rowSeq++, hash);
        db.prepare(`
        INSERT INTO hash_tracker (schema_name, schema_type, table_name, common_columns, row_seq, hash_value)
        VALUES (?, ?, ?, ?, ?, ?)
        `).run(targetSchema, 'TARGET', table, commonCols.join(','), rowSeq++, hash);

          targetCount++;
        }
        offset += batchSize;
      }

      console.log(`✔️ Hashed ${table}: SOURCE rows=${rowSeq-1}, TARGET rows=${rowSeq-1}`);
    } catch (err) {
      console.error(`❌ Failed to hash ${table}: ${err.message}`);
    }
  }

  const endTime = new Date();
  const duration = formatDuration(endTime - startTime);

  console.log("\n=== SUMMARY ===");
  console.log(`Source hashes: ${sourceCount}`);
  console.log(`Target hashes: ${targetCount}`);
  console.log(`Start time: ${startTime.toLocaleString('en-GB', { timeZone: 'Asia/Macau', hour12: false })}`);
  console.log(`End time:   ${endTime.toLocaleString('en-GB', { timeZone: 'Asia/Macau', hour12: false })}`);
  console.log(`Duration:   ${duration}`);
})();

/*
CREATE TABLE IF NOT EXISTS hash_tracker (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  schema_name    TEXT NOT NULL,        -- actual schema name, e.g. DCDEVDTA
  schema_type    TEXT NOT NULL,        -- 'SOURCE' or 'TARGET'
  table_name     TEXT NOT NULL,        -- table being hashed
  common_columns TEXT,                 -- list of columns used for hashing
  row_seq        INTEGER NOT NULL,     -- starts at 1 for each table
  hash_value     TEXT NOT NULL,        -- computed fingerprint of row content
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_hash_tracker_schema_table
  ON hash_tracker(schema_name, table_name, row_seq);

CREATE INDEX IF NOT EXISTS idx_hash_tracker_hash
  ON hash_tracker(hash_value);

*/
/*
-- Per-table row count comparison
SELECT table_name,
       MAX(CASE WHEN schema_type='SOURCE' THEN cnt END) AS source_rows,
       MAX(CASE WHEN schema_type='TARGET' THEN cnt END) AS target_rows
FROM (
    SELECT table_name, schema_type, COUNT(*) AS cnt
    FROM hash_tracker
    GROUP BY table_name, schema_type
) t
GROUP BY table_name
HAVING source_rows != target_rows;

-- Per-table hash distribution comparison Summary
SELECT table_name
FROM (
    SELECT table_name,
           hash_value,
           SUM(CASE WHEN schema_type='SOURCE' THEN 1 ELSE 0 END) AS source_count,
           SUM(CASE WHEN schema_type='TARGET' THEN 1 ELSE 0 END) AS target_count
    FROM   hash_tracker
    GROUP BY table_name, hash_value
    HAVING source_count != target_count
) sub
GROUP BY table_name
ORDER BY table_name;

-- Per-table hash distribution comparison
SELECT table_name,
       hash_value,
       SUM(CASE WHEN schema_type='SOURCE' THEN 1 ELSE 0 END) AS source_count,
       SUM(CASE WHEN schema_type='TARGET' THEN 1 ELSE 0 END) AS target_count
FROM   hash_tracker
GROUP BY table_name, hash_value
HAVING source_count != target_count
ORDER BY table_name, hash_value;
*/
/*
   node src/buildHashes.js DCDEVDTA DCUATDTA csr.txt
*/
