/**
 * yrunner.js
 */
import oracledb from 'oracledb';
import { lowerObjKeyArray } from './utils/lowerKeys.js';

export const createRunner = (dbConfig) => {
  // Each runner instance is bound to its own config
  const runSelectSQL = async (cmdText, lowerKeys=false) => {
    let connection;
    try {
      connection = await oracledb.getConnection(dbConfig);
      const result = await connection.execute(cmdText);
      return {
        success: true,
        rows: lowerKeys ? lowerObjKeyArray(result.rows) : result.rows,
        meta: result.metaData   // <-- includes column names
      };
    } catch (err) {
      return { success: false, error: err, message: err.message, cmdText };
    } finally {
      if (connection) await connection.close();
    }
  };

  const runValueSQL = async (cmdText, lowerKeys=false) => {
    let connection;
    try {
      connection = await oracledb.getConnection(dbConfig);
      const result = await connection.execute(cmdText);
      const row = lowerKeys ? lowerObjKeyArray(result.rows)[0] : result.rows[0];
      return { success: true, ...row };
    } catch (err) {
      return { success: false, error: err, message: err.message, cmdText };
    } finally {
      if (connection) await connection.close();
    }
  };

  const runSQL = async (cmdTextArray) => {
    let connection;
    let rowsAffected = 0;
    try {
      connection = await oracledb.getConnection(dbConfig);
      for (const cmdText of cmdTextArray) {
        const result = await connection.execute(cmdText);
        rowsAffected += result.rowsAffected;
      }
      await connection.commit();
      return { success: true, rowsAffected };
    } catch (err) {
      return { success: false, error: err, message: err.message };
    } finally {
      if (connection) await connection.close();
    }
  };

  const runInsertSQLYieldRowID = async (cmdText, rowIdName="id") => {
    let connection;
    try {
      connection = await oracledb.getConnection(dbConfig);
      const result = await connection.execute(
        cmdText + ` returning ${rowIdName} into :temp_id`,
        { temp_id: { type: oracledb.NUMBER, dir: oracledb.BIND_OUT } }
      );
      await connection.commit();
      return { success: true, [rowIdName]: result.outBinds.temp_id[0] };
    } catch (err) {
      return { success: false, error: err, message: err.message, cmdText };
    } finally {
      if (connection) await connection.close();
    }
  };

  return { runSQL, runValueSQL, runSelectSQL, runInsertSQLYieldRowID };
};

/*
   node-oracledb | SQL Execution
   https://node-oracledb.readthedocs.io/en/latest/user_guide/sql_execution.html#queryoutputformats
*/