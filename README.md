### “CopyTable — A Practitioner’s Sweat and Tears in Data Migration” <br />
*The ideals of seamless migration versus the hard reality of mismatches and reconciliation*

![alt 理想很豐滿，現實很骨感](img/Copilot_20260723_理想很豐滿，現實很骨感.png)

> "Freedom is the possibility of isolation. You are free if you can withdraw from people, not having to seek them out for the sake of money, company, love, glory or curiosity, none of which can thrive in silence and solitude. If you can’t live alone, you were born a slave."<br /><br />"A liberdade é a possibilidade do isolamento. És livre se podes afastar-te dos homens, sem que te obrigue a procurá-los a necessidade do dinheiro, ou a necessidade gregária, ou o amor, ou a glória, ou a curiosidade, que no silêncio e na solidão não podem ter alimento. Se te é impossível viver só, nasceste escravo."<br/>--- The Book of Disquiet by Fernando Pessoa


#### Prologue 
*Copying tables is easy for talkers but not for doers*. Database table looks like worksheet in Excel, and the copying is alike, many people thinks so... I was responsible for creating database tables and moving data betwixt and between. Here is my observation: 

1. Some people adds extra columns on tables for monitoring purpose; 
2. Schemas may not align properly, either in name or type ;
3. Foreign keys are used to enfore integrity which impedes erasing data; 
4. Most data copying tools are on ad hoc basis and not systematic ways. 


#### I. [DBeaver Task management](https://dbeaver.com/docs/dbeaver/Task-Management/)
> Use tasks to save and reuse configurations for database tools like data transfer or import/export. Tasks help you automate routine actions and run them with one click. You can create tasks from tool wizards or from the main menu, group them in folders, and manage them in a dedicated view.

> This feature is available in Community, Enterprise, and Ultimate editions only.

![alt DBeaver-Database-Tasks](img/DBeaver-Database-Tasks.JPG)

Importing redacted data with Tasks may trigger error like so: 

![alt by-zero](img/by-zero.JPG)

Inserting redacted data with `INSERT` triggers error like so: 

![alt the-command-references-a-redacted-object](img/the-command-references-a-redacted-object.JPG)

The only way is to export tables in SQL source and load them into target database. 

> Alongside that, DBeaver provides **Common** tasks. They work with any supported database and cover typical cross-database workflows:

| Task | Description |
| --- | --- |
| Composite task | Run multiple tasks as a single workflow. |
| Data compare | Compare data between sources and review differences. |
| Data export | Export data to files or external targets. |
| Data import | Import data from files. |
| Mock data | Generate test data. |
| SQL Script | Execute one or more SQL scripts automatically. |
| Schema changelog | Create a changelog for selected data containers. |
| Schema compare | Compare database metadata between schemas or databases. |
| Shell command | Run a shell command as part of a task. |

**Tasks can be scheduled or executed from the command line. They are an indispensable tool for day‑to‑day data migration.
**

#### II. A typical workflow 
Following is a workflow involved in moving data from `PROD` to `UAT`, ie: 
```
PROD → DEV → (Redact) → UAT 
```
Here is my main concern: 
- **Error detection**: identify which table rows incur the failure; 
- **Failure retry**: *partially* re-do, not total *undo* and *redo*; 
- **Target verify**: ensure identity on both sides; 
- **Optimize copy**: identify which tables have been changed since last copy and only copy them again on next round; 
- **Observably**: when row changed dete3cted, what is the pair of rows looks like. 


#### III. DumpTable and InsertTable
To dump all tables enlisted on `files.txt` from source database into `./data` folder, optionally add `TRUNCATE` on top of `INSERT`.
```
Usage:
  node src/dumpTable.js <source schema> <target schema> <files.txt> [truncate]

Example:
  node src/dumpTable.js DCDEVDTA DCUATDTA files.txt truncate
```

`dumpTable.js` would first get the columns name and type on both sides, compute the *common columns* which are supposed to have the same name and type (`CHAR` and `VARCHAR2` are considered the same), in addition all managerial fields are stripped off. 

And then, It queries source database in batch mode, format, compose and output `INSERT` statement like so: 
```
        for (const row of result.rows) {
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
```

To insert SQL dumps into target database.
```
Usage:
  node src/insertTable.js <sourceFolder>

Example:
  node src/insertTable.js H:\\UAT
```

The implementation of `insertTable.js` is straightforward, reads and runs, writes failure log if come accors error. You can run `insertTable.js` with any folder parameter, in this way, you can reuse the SQL dumps created by DBeaver. 


#### IV. CopyTable
To copy all tables enlisted on `files.txt` from source database into target database, optionally truncate target table before insert. 
```
Usage:
  node src/copyTable.js <source schema> <target schema> <files.txt> [truncate]

Example:
  node src/copyTable.js DCDEVDTA DCUATDTA files.txt truncate
```

`copyTable.js` is a composite of `dumpTable.js` and `insertTable.js` without leave SQL dump files. The same read logic as `dumpTable.js` and the same write logic as `insertTable.js`, it is a cleaner approach if your sole purpose is copying tables. 


#### V. BuildHashes
*Copying tables is tedious; verifying them is pure drudgery.* The point is: how can you be so sure that all data are identical? Judging from the rows count is not enough, how can you read out and verify them without knowing the primary key beforehand, if any... 

**MY ASSUMPTION**

if the storage of source and target tables unchanged, querying the table without specifying `ORDER BY` gives the deterministic result! 

My idea is simple: an RDBMS always completes your query with minimal effort — least CPU, least I/O, least RAM — and delivers whatever the result to the user as quickly as possible. He is a mean guy and reluctant to spend extra resources to fulfill your request! He never spends a single extra penny on you!

![alt Copilot_20260724_131627](img/Copilot_20260724_131627.png)

**WARNINGS FROM AI**

> When a database remains unchanged, selecting from a table without an `ORDER BY` clause often appears to return rows in their “arrival sequence,” typically reflecting insertion order or clustered index layout. This behavior can seem stable and repeatable, giving the impression of determinism.

> However, SQL standards do not guarantee row order unless explicitly defined, and internal operations such as index rebuilds, statistics updates, or storage reorganizations may alter the sequence unexpectedly. Thus, while the output may look consistent in an untouched database, practitioners should treat it as incidental rather than deterministic, and enforce ordering when reliability is required.

![alt Copilot_20260724_132038.png](img/Copilot_20260724_132038.png)

The use of hash to verify identity is common practice on internet download. 

First of all, we calculate hashes for common columns of all rows on all tables on both sides. By grouping and counting hash value, we can effectively partition all rows into hash segments, if one hash segment has the same row count  on both sides, it is supposed this segment is identical; if the other hash segment has different count, ie. abs(source_count - target_count) = n for example, that hash segment has n rows changes. 

To keep both sides intact, we use SQLite to store hashes:
```
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
```

To build hashes on all tables enlisted on `files.txt`, source schema is `DCDEVDTA`, target schema is `DCUATDTA`. 
To build hashes on all tables enlisted on `files.txt` with source database and target database.

```
node src/buildHashes.js DCDEVDTA DCUATDTA files.txt
```

![alt buildHashes-1](img/buildHashes-1.JPG)

![alt buildHashes-2](img/buildHashes-2.JPG)


#### VI. VerifyTable
Based on the hashes, we can verify rows count on both sides. 
```
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
```

Next, the hash segment summary. 
```
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
```

At last, the hash segment details. 
```
-- Per-table hash distribution comparison
SELECT table_name,
       hash_value,
       SUM(CASE WHEN schema_type='SOURCE' THEN 1 ELSE 0 END) AS source_count,
       SUM(CASE WHEN schema_type='TARGET' THEN 1 ELSE 0 END) AS target_count
FROM   hash_tracker
GROUP BY table_name, hash_value
HAVING source_count != target_count
ORDER BY table_name, hash_value;
```

To verify the hashes on all tables. 
```
node src/verifyCopy.js
```

![alt verifyCopy-1](img/verifyCopy-1.JPG)

![alt verifyCopy-2](img/verifyCopy-2.JPG)


#### VII. RowMismatch 
To find out mismatch rows on tables of both sides. 
```
node src/rowMismatch.js
```

![alt rowMismatch-1](img/rowMismatch-1.JPG)

![alt rowMismatch-2](img/rowMismatch-2.JPG)

Check the output on `/logs` folder. 

![alt misMatchLog](img/misMatchLog.JPG)


#### VIII. Summary 
```
```

```
```


#### Bibliography 
1. [DBeaver Task Management](https://dbeaver.com/docs/dbeaver/Task-Management/)
2. [Introduction to Oracle Data Redaction](https://docs.oracle.com/en/database/oracle/oracle-database/19/asoag/introduction-to-oracle-data-redaction.html)
3. [The Book of Disquiet by Fernando Pessoa](https://dn720004.ca.archive.org/0/items/english-collections-1/Book%20of%20Disquiet%2C%20The%20-%20Fernando%20Pessoa.pdf)
 

#### Epilogue 
> "Death is a liberation because to die is to need no one. In death the wretched slave is forcibly set free from his pleasures, from his sufferings, from his coveted and ongoing life."

> "A morte é uma libertação porque morrer é não precisar de outrem. O pobre escravo vê-se livre à força dos seus prazeres, das suas mágoas, da sua vida desejada e contínua."


### EOF (2026/07/31)
