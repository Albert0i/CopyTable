/**
 * copyTable.js
 */
import 'dotenv/config'
import fs from 'fs';
import oracledb from 'oracledb';
import { createRunner } from './yrunner.js';
import { createDbConfig } from './config/dbConfig.js';

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

// --- CLI parameter parsing ---
const [,, sourceSchema, targetSchema, manifestFile] = process.argv;
if (!sourceSchema || !targetSchema || !manifestFile) {
  console.error("Usage: node copytable.js <source schema> <target schema> <files.txt>");
  process.exit(1);
}

// --- Load table names from manifest ---
const tables = fs.readFileSync(manifestFile, 'utf-8').trim().split('\n');

// --- Build runners ---
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

// --- Timestamp for log file ---
function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
}
const logFile = `insertFailure.${getTimestamp()}.log`;

// --- Counters ---
let filesProcessed = 0;
let successCount = 0;
let failureCount = 0;

// --- Helpers ---
function normalizeColumns(rows) {
  return rows
    .map(r => ({
      column_name: r.COLUMN_NAME.trim().toUpperCase(),
      data_type: r.DATA_TYPE.trim().toUpperCase()
    }))
    .filter(c => !c.column_name.startsWith("OGG_"));
}

async function getColumns(runner, schema, table) {
  const sql = `
    SELECT column_name, data_type
    FROM   all_tab_columns
    WHERE  owner = '${schema.toUpperCase()}'
    AND    table_name = '${table.toUpperCase()}'
    ORDER BY column_id
  `;
  const result = await runner.runSelectSQL(sql);
  return result.success ? normalizeColumns(result.rows) : [];
}

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

// --- Main loop ---
(async () => {
  const startTime = new Date();

  for (const table of tables) {
    console.log(`\n=== Copying ${table} ===`);
    filesProcessed++;

    const srcCols = await getColumns(sourceRunner, sourceSchema, table);
    const tgtCols = await getColumns(targetRunner, targetSchema, table);

    const tgtMap = new Map(tgtCols.map(c => [c.column_name, c.data_type]));
    const commonCols = srcCols.filter(c =>
      tgtMap.has(c.column_name) && tgtMap.get(c.column_name) === c.data_type
    ).map(c => c.column_name);

    if (commonCols.length === 0) {
      console.warn(`No common columns for ${table}, skipping.`);
      continue;
    }

    console.log(`Common columns: ${commonCols.join(', ')}`);

    let offset = 0;
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
            const cols = commonCols.join(', ');
            const vals = commonCols.map(c => formatValue(row[c])).join(', ');
            const insertSQL = `INSERT INTO ${targetSchema}.${table} (${cols}) VALUES (${vals})`;

            try {
                const res = await targetRunner.runSQL([insertSQL]); // no semicolon here
                if (res.success) {
                successCount++;
                console.log(`✔️ Inserted row into ${table}`);   // green tick
                } else {
                failureCount++;
                console.log(`❌ Failed to insert row into ${table}`); // red cross
                await fs.promises.appendFile(logFile, insertSQL + ";\n"); // semicolon in log
                }
            } catch (err) {
                failureCount++;
                console.log(`❌ Failed to insert row into ${table}`); // red cross
                await fs.promises.appendFile(logFile, insertSQL + ";\n"); // semicolon in log
            }
        }

      offset += batchSize;
    }
  }

  const endTime = new Date();
  const durationMs = endTime - startTime;
  const hh = String(Math.floor(durationMs / 3600000)).padStart(2, '0');
  const mm = String(Math.floor((durationMs % 3600000) / 60000)).padStart(2, '0');
  const ss = String(Math.floor((durationMs % 60000) / 1000)).padStart(2, '0');
  const nnn = String(durationMs % 1000).padStart(3, '0');

  console.log("\n=== SUMMARY ===");
  console.log(`Files processed: ${filesProcessed}`);
  console.log(`Successful inserts: ${successCount}`);
  console.log(`Failed inserts: ${failureCount}`);
  console.log(`Start time: ${startTime.toISOString()}`);
  console.log(`End time:   ${endTime.toISOString()}`);
  console.log(`Duration:   ${hh}:${mm}:${ss}:${nnn}`);

  if (failureCount > 0) {
    console.log(`⚠️ Some inserts failed. Please check the log file: ${logFile}`);
  }
})();
