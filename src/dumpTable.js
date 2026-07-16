
/**
 * dumpTable.js
 */
import 'dotenv/config'
import fs from 'fs';
import path from 'path';
import oracledb from 'oracledb';
import { createRunner } from './yrunner.js';
import { createDbConfig } from './config/dbConfig.js';

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

const [,, rawSourceSchema, rawTargetSchema, manifestFile, truncateFlag] = process.argv;
if (!rawSourceSchema || !rawTargetSchema || !manifestFile) {
  console.error(`Usage: 
      node src/dumpTable.js <source schema> <target schema> <files.txt> [truncate]
      
      Example: 
        node src/dumpTable.js DCDEVDTA DCUATDTA files.txt truncate`);
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

// Local Macau timestamp for log file naming
function getLocalTimestamp() {
  const now = new Date();
  const options = { 
    timeZone: 'Asia/Macau',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  };
  const parts = new Intl.DateTimeFormat('en-GB', options).formatToParts(now);
  
  // Build YYYYMMDDHHMMSS format
  const lookup = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${lookup.year}${lookup.month}${lookup.day}${lookup.hour}${lookup.minute}${lookup.second}`;
}

const logFile = path.join('./logs', `selectFailure_${getLocalTimestamp()}.log`);

let filesProcessed = 0;
let successCount = 0;
let failureCount = 0;

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
  return `'${s}'`;
}

(async () => {
  const startTime = new Date();

  for (const table of tables) {
      // 🔧 Skip SQL comment lines and blank lines
    if (table.length === 0 || table.startsWith("--")) {
      continue;
    }

    filesProcessed++;
    console.log(`\n=== Dumping ${sourceSchema}.${table} ===`);

    try {
      const srcCols = await getColumns(sourceRunner, sourceSchema, table);
      const tgtCols = await getColumns(targetRunner, targetSchema, table);

      const tgtMap = new Map(tgtCols.map(c => [c.column_name, c.data_type]));
      const commonCols = srcCols.filter(c =>
        tgtMap.has(c.column_name) && tgtMap.get(c.column_name) === c.data_type
      ).map(c => c.column_name);

      if (commonCols.length === 0) {
        console.warn(`No intersected columns for ${sourceSchema}.${table}, skipping.`);
        failureCount++;
        await fs.promises.appendFile(logFile, `-- No intersected columns for ${sourceSchema}.${table}\n`);
        continue;
      }

      const dumpFile = path.join('./data', `${table}_${getLocalTimestamp()}.sql`);
      const writeStream = fs.createWriteStream(dumpFile, { flags: 'w' });

      let rowCount = 0;
      writeStream.write(`-- Dump for ${sourceSchema}.${table} at ${new Date().toISOString()}\n`);
      if (doTruncate) {
        writeStream.write(`TRUNCATE TABLE ${targetSchema}.${table};\n\n`);
      }

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
          await fs.promises.appendFile(logFile, `-- Failed select for ${sourceSchema}.${table} at offset ${offset}\n${sql}\n`);
          break;
        }
        if (result.rows.length === 0) break;

        for (const row of result.rows) {
          //const vals = commonCols.map(c => formatValue(row[c])).join(', ');
          const vals = commonCols.map(c => {
                  let v = formatValue(row[c]);
                  // 🔧 sanitize embedded linebreaks
                  if (typeof v === 'string') {
                    v = v.replace(/\r?\n/g, ' '); // replace newline with space
                  }
                  return v;
                }).join(', ');
          const insertSQL = `INSERT INTO ${targetSchema}.${table} (${commonCols.join(', ')}) VALUES (${vals});\n`;
          writeStream.write(insertSQL);
          rowCount++;
        }

        offset += batchSize;
      }

      // Count lines written
      writeStream.end();
      const fileContent = await fs.promises.readFile(dumpFile, 'utf-8');
      const lineCount = fileContent.split(/\r?\n/).length;

      // Append footer with both counts
      await fs.promises.appendFile(dumpFile, `\n-- Records dumped: ${rowCount}, Lines written: ${lineCount}\n`);

      successCount++;
      console.log(`✔️ Dumped ${sourceSchema}.${table} to ${dumpFile} (Records: ${rowCount}, Lines: ${lineCount})`);
    } catch (err) {
      failureCount++;
      await fs.promises.appendFile(logFile, `-- Exception for ${sourceSchema}.${table}: ${err.message}\n`);
      console.log(`❌ Failed to dump ${sourceSchema}.${table}`);
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
  console.log(`Successful dumps: ${successCount}`);
  console.log(`Failed dumps: ${failureCount}`);
  console.log(`Start time: ${startTime.toISOString()}`);
  console.log(`End time:   ${endTime.toISOString()}`);
  console.log(`Duration:   ${hh}:${mm}:${ss}:${nnn}`);

  if (failureCount > 0) {
    console.log(`⚠️ Some dumps failed. Please check the log file: ${logFile}`);
  }
})();

/*
   node src/dumpTable.js DCDEVDTA DCUATDTA files.txt truncate
*/
