/**
 * testConn.js
 */
import 'dotenv/config'
import oracledb from 'oracledb';
import { createDbConfig } from './config/dbConfig.js';
import { createRunner } from './yrunner.js';

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

const testConnection = async (label, config) => {
  const runner = createRunner(config);
  try {
    const result = await runner.runSelectSQL(
      "SELECT sys_context('USERENV','DB_NAME') AS db_name, user AS current_user FROM dual"
    );
    if (result.success) {
      console.log(`${label} connection OK:`, result.rows[0]);
    } else {
      console.error(`${label} connection FAILED:`, result.message);
    }
  } catch (err) {
    console.error(`${label} connection ERROR:`, err);
  }
};

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

(async () => {
  await testConnection("SOURCE", sourceConfig);
  await testConnection("TARGET", targetConfig);
})();
