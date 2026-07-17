/**
 * copyTable.js
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import oracledb from 'oracledb';
import { createRunner } from './yrunner.js';
import { createDbConfig } from './config/dbConfig.js';

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

const [,, rawSourceSchema, rawTargetSchema, manifestFile, truncateFlag] = process.argv;
if (!rawSourceSchema || !rawTargetSchema || !manifestFile) {
  console.error(`
    Usage:
      node src/copyTable.js <source schema> <target schema> <files.txt> [truncate]

    Example: 
        node src/copyTable.js DCDEVDTA DCUATDTA files.txt truncate`);
  process.exit(1);
}

const sourceSchema = rawSourceSchema.toUpperCase();
const targetSchema = rawTargetSchema.toUpperCase();
const tables = fs.readFileSync(manifestFile, 'utf-8')
  .trim()
  .split('\n')
  .map(t => t.trim().toUpperCase());

const doTruncate = truncateFlag && truncateFlag.toLowerCase() === 'truncate';

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

// Macau timestamp for logs
function getLocalTimestamp() {
  const now = new Date();
  const options = { timeZone: 'Asia/Macau', year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', second: '2-digit' };
  const parts = new Intl.DateTimeFormat('en-GB', options).formatToParts(now);
  const lookup = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${lookup.year}${lookup.month}${lookup.day}${lookup.hour}${lookup.minute}${lookup.second}`;
}
function formatLocalTime(date) {
  return date.toLocaleString('en-GB', { timeZone: 'Asia/Macau', hour12: false });
}
function formatDuration(ms) {
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
  const nnn = String(ms % 1000).padStart(3, '0');
  return `${h}:${m}:${s}:${nnn}`;
}

const logFile = path.join('./logs', `copyFailure_${getLocalTimestamp()}.log`);

let filesProcessed = 0;
let successCount = 0;
let failureCount = 0;

function normalizeColumns(rows) {
  return rows
    .map(r => {
      let dt = r.DATA_TYPE.trim().toUpperCase();
      // Treat CHAR and VARCHAR2 as the same
      if (dt === 'CHAR') dt = 'VARCHAR2';
      return {
        column_name: r.COLUMN_NAME.trim().toUpperCase(),
        data_type: dt
      };
    })
    .filter(c => !c.column_name.startsWith("OGG_"));
}

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

(async () => {
  const startTime = new Date();

  for (const table of tables) {
    if (table.length === 0 || table.startsWith("--")) continue;
    filesProcessed++;
    console.log(`\n=== Copying ${sourceSchema}.${table} → ${targetSchema}.${table} ===`);

    try {
      const srcCols = await getColumns(sourceRunner, sourceSchema, table);
      const tgtCols = await getColumns(targetRunner, targetSchema, table);

      const tgtMap = new Map(tgtCols.map(c => [c.column_name, c.data_type]));
      const commonCols = srcCols.filter(c =>
        tgtMap.has(c.column_name) && tgtMap.get(c.column_name) === c.data_type
      ).map(c => c.column_name);

      if (commonCols.length === 0) {
        console.warn(`No intersected columns for ${table}, skipping.`);
        failureCount++;
        await fs.promises.appendFile(logFile, `-- No intersected columns for ${table}\n`);
        continue;
      }

      if (doTruncate) {
        console.log(`Truncating ${targetSchema}.${table}...`);
        await targetRunner.runSQL([`TRUNCATE TABLE ${targetSchema}.${table}`]);
      }

      let rowCount = 0;
      let offset = 0;
      const batchSize = 1000;

      while (true) {
        const sql = `
          SELECT ${commonCols.join(', ')}
          FROM   ${sourceSchema}.${table}
          OFFSET ${offset} ROWS FETCH NEXT ${batchSize} ROWS ONLY
        `;
        const result = await sourceRunner.runSelectSQL(sql);
        if (!result.success) {
          failureCount++;
          await fs.promises.appendFile(logFile, `-- Failed select for ${table} at offset ${offset}\n${sql}\n`);
          break;
        }
        if (result.rows.length === 0) break;

        for (const row of result.rows) {
          const vals = commonCols.map(c => formatValue(row[c])).join(', ');
          const insertSQL = `INSERT INTO ${targetSchema}.${table} (${commonCols.join(', ')}) VALUES (${vals})`;
          try {
            const insResult = await targetRunner.runSQL([insertSQL]);
            if (insResult.success) {
              console.log(`✅ SUCCESS: ${table} [row ${rowCount+1}]`);
              successCount++;
            } else {
              console.error(`❌ FAILURE: ${table} [row ${rowCount+1}] → ${insResult.message}`);
              await fs.promises.appendFile(logFile, insertSQL + ";\n");
              failureCount++;
            }
          } catch (err) {
            console.error(`❌ FAILURE: ${table} [row ${rowCount+1}] → ${err.message}`);
            await fs.promises.appendFile(logFile, insertSQL + ";\n");
            failureCount++;
          }
          rowCount++;
        }

        offset += batchSize;
      }

      console.log(`✔️ Copied ${rowCount} rows from ${sourceSchema}.${table} to ${targetSchema}.${table}`);
    } catch (err) {
      failureCount++;
      await fs.promises.appendFile(logFile, `-- Exception for ${table}: ${err.message}\n`);
      console.log(`❌ Failed to copy ${table}`);
    }
  }

  const endTime = new Date();
  const duration = formatDuration(endTime - startTime);

  console.log("\n=== SUMMARY ===");
  console.log(`Files processed: ${filesProcessed}`);
  console.log(`Successful inserts: ${successCount}`);
  console.log(`Failed inserts: ${failureCount}`);
  console.log(`Start time: ${formatLocalTime(startTime)}`);
  console.log(`End time:   ${formatLocalTime(endTime)}`);
  console.log(`Duration:   ${duration}`);

  if (failureCount > 0) {
    console.log(`⚠️ Some copies failed. Please check the log file: ${logFile}`);
  }
})();
