/**
   insertTable.js
*/
import 'dotenv/config'; 
import fs from 'fs-extra';
import path from 'path';
import oracledb from 'oracledb';

// Import runSQL from your yrunner.js
import { createRunner } from './yrunner.js';
import { createDbConfig } from './config/dbConfig.js';
//import { runSQL } from './yrunner.js';

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

const targetConfig = createDbConfig({
  user: process.env.TARGET_ORACLEDB_USER,
  password: process.env.TARGET_ORACLEDB_PASSWORD,
  connectString: process.env.TARGET_ORACLEDB_CONNECTIONSTRING
});

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

// Format local Macau time
function formatLocalTime(date) {
  return date.toLocaleString('en-GB', { 
    timeZone: 'Asia/Macau',
    hour12: false
  });
}

function formatDuration(ms) {
  const h = String(Math.floor(ms / 3600000)).padStart(2, '0');
  const m = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
  const s = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
  const nnn = String(ms % 1000).padStart(3, '0');
  return `${h}:${m}:${s}:${nnn}`;
}

async function main() {
  const sourceFolder = process.argv[2];
  if (!sourceFolder) {
    console.error(`
      Usage: 
        node src/insertTable.js <sourceFolder>

      Example: 
        node src/insertTable.js H:\\\\UAT`);

    process.exit(1);
  }

  // Ensure logs folder exists
  const logsDir = path.resolve("./logs");
  await fs.ensureDir(logsDir);

  //const logFile = path.join(logsDir, `insertFailure.${getTimestamp()}.log`);
  const logFile = path.join(logsDir, `insertFailure.${getLocalTimestamp()}.log`);

  let filesProcessed = 0;
  let successCount = 0;
  let failureCount = 0;

  // Record start time
  const startTime = new Date();

  try {
    let files = await fs.readdir(sourceFolder);

    // Force alphabetical order
    files.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

    for (const file of files) {
      if (!file.endsWith(".txt") && !file.endsWith(".sql")) continue;
      filesProcessed++;

      const filePath = path.join(sourceFolder, file);
      const content = await fs.readFile(filePath, "utf8");
      const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim(); // keep semicolon intact

        // Skip SQL comment lines
        if (line.startsWith("--")) {
          continue;
        }
        
        try {
          // Strip semicolon only for execution, not for logging
          const cleanLine = line.replace(/;$/, "");
          const result = await targetRunner.runSQL([cleanLine]);
          if (result.success) {
            console.log(`✅ SUCCESS: ${file} [line ${i+1}]`);
            successCount++;
          } else {
            console.error(`❌ FAILURE: ${file} [line ${i+1}] → ${result.message}`);
            await fs.appendFile(logFile, line + "\n"); // log with semicolon
            failureCount++;
          }
        } catch (err) {
          console.error(`❌ FAILURE: ${file} [line ${i+1}] → ${err.message}`);
          await fs.appendFile(logFile, line + "\n"); // log with semicolon
          failureCount++;
        }
      }
    }

    // Record end time and duration
    const endTime = new Date();
    const duration = formatDuration(endTime - startTime);

    console.log("\n=== SUMMARY ===");
    console.log(`Start time: ${formatLocalTime(startTime)}`);
    console.log(`End time:   ${formatLocalTime(endTime)}`);
    console.log(`Duration:   ${formatDuration(endTime - startTime)}`);

    console.log(`Files processed: ${filesProcessed}`);
    console.log(`Successful inserts: ${successCount}`);
    console.log(`Failed inserts: ${failureCount}`);
    if (failureCount > 0) {
      console.log(`⚠️ Some inserts failed. Please check the log file: ${logFile}`);
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

main();

/*
   node src/insertTable.js data
*/