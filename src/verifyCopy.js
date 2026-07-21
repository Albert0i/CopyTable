/**
 * verifyCopy.js
 */
// verifyCopy.js
import db from './db.js';   // <-- use your db.js wrapper

// 1. Per-table row count comparison
const rowCountQuery = `
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
`;

// 2. Per-table hash distribution summary
const hashSummaryQuery = `
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
`;

// 3. Per-table hash distribution details
const hashDetailQuery = `
SELECT table_name,
       hash_value,
       SUM(CASE WHEN schema_type='SOURCE' THEN 1 ELSE 0 END) AS source_count,
       SUM(CASE WHEN schema_type='TARGET' THEN 1 ELSE 0 END) AS target_count
FROM   hash_tracker
GROUP BY table_name, hash_value
HAVING source_count != target_count
ORDER BY table_name, hash_value;
`;

// Run queries and print results
console.log("\n=== Tables with Different Row Count ===");
db.prepare(rowCountQuery).all().forEach(row => {
  console.log(`${row.table_name}: SOURCE=${row.source_rows}, TARGET=${row.target_rows}`);
});

console.log("\n=== Tables with Hash Mismatches ===");
db.prepare(hashSummaryQuery).all().forEach(row => {
  console.log(`${row.table_name}`);
});

console.log("\n=== Hash Mismatches Details ===");
db.prepare(hashDetailQuery).all().forEach(row => {
  console.log(`${row.table_name}|${row.hash_value}|${row.source_count}|${row.target_count}`);
});

// Close DB
db.close();

