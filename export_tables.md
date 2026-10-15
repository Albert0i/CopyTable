### A Practical Guide to Automated Oracle Data Extraction with SQL*Plus


#### Prologue
*Every export begins as a question.*

Somewhere within the silent chambers of an Oracle database, rows of data wait patiently in tables and columns, carrying stories written by applications, users, and time itself. A customer name, a transaction number, an address in Chinese characters, a date entered years ago and never touched again. Hidden beneath layers of schemas, services, and protocols, these records remain invisible until someone chooses to bring them into the light.

SQL*Plus, despite its age and simplicity, remains a faithful bridge between those worlds. It asks for no grand framework, no complex installation, and no graphical interface. It simply listens to a query, retrieves the truth preserved within the database, and writes it faithfully onto paper made of pixels.

This article was born during a practical journey: a simple requirement to export Oracle tables into CSV files. What began as a straightforward task soon wandered into the subtle territories of Unicode, character encodings, Windows code pages, SQL*Plus options, and the mysterious appearance of Chinese characters transformed into question marks.

Along the way, every assumption was questioned, every clue examined, and every result verified. The outcome was more than a working batch file; it became a reminder that successful troubleshooting is rarely about finding the correct answer immediately. Rather, it is about patiently narrowing the unknown until only the truth remains.

The pages that follow document that journey and present a dependable method for exporting Oracle data using SQL*Plus. May they save future readers a few hours of investigation, a few unnecessary configuration changes, and perhaps a few cups of coffee.

So let us begin, not merely with commands and scripts, but with curiosity. For every successful export tells a story, and every story starts with a single query.


#### I. Introduction
Oracle databases are widely used in enterprise environments, and one of the most common administrative tasks is exporting table data for reporting, backup, migration, testing, or data sharing purposes.

Although Oracle provides powerful utilities such as Data Pump (`expdp` and `impdp`), there are many situations where a simple CSV export is sufficient. Examples include:

- Sending reference data to another team
- Creating data snapshots for testing
- Loading data into Excel
- Transferring lookup tables between environments
- Archiving application configuration data

A convenient way to accomplish this is by using **SQL*Plus** together with a **Windows batch (`.bat`) file**.

This article explains how to create a fully automated export process that:

- Connects to Oracle
- Generates a SQL script dynamically
- Exports multiple tables into CSV files
- Produces minimal console output
- Records start and finish times
- Requires only a single command to execute


#### II. The Complete Batch File
The following example exports three Oracle tables:

- `employees`
- `customers`
- `products`

`export_tables.bat`
```
@echo off

REM === Oracle Connection ===
set HOST=my-oracle-host
set DB=mypdb
set USERID=albertoi
set PASSWORD=mypassword

REM === Create SQL Script ===
(
echo SET MARKUP CSV ON
echo SET FEEDBACK OFF
echo SET HEADING OFF
echo SET PAGESIZE 0
echo SET TERMOUT OFF
echo SET ECHO OFF
echo SET VERIFY OFF

echo SPOOL employees.csv
echo SELECT * FROM employees;
echo SPOOL OFF

echo SPOOL customers.csv
echo SELECT * FROM customers;
echo SPOOL OFF

echo SPOOL products.csv
echo SELECT * FROM products;
echo SPOOL OFF

echo EXIT
) > export_tables.sql

REM === MAIN ===

set STARTDATE=%DATE%
set STARTTIME=%TIME%

echo.
echo Export started at %STARTDATE% %STARTTIME%

REM === Run Export ===
sqlplus -S %USERID%/%PASSWORD%@%HOST%:1521/%DB% @export_tables.sql

set ENDDATE=%DATE%
set ENDTIME=%TIME%

echo.
echo Export completed at %ENDDATE% %ENDTIME%
echo.
```


#### III. Understanding the Execution Flow
The batch file performs four major tasks:

1. Set Oracle connection information
2. Dynamically generate a SQL script
3. Execute the SQL script using SQL*Plus
4. Create multiple CSV files

The entire process is automatic and requires only:

```
export_tables.bat
```

**Step 1 - Define Oracle Connection Information**

```
set HOST=oracle-dev-scan
set DB=pdbdev_srv
set USERID=dcdevdta
set PASSWORD=poonsio$da
```

These variables contain the Oracle connection details used by SQL*Plus.

**Step 2 - Dynamically Create a SQL Script**

The following construct creates a temporary SQL script:

```
(
...
) > export_tables.sql
```

After execution, the script `export_tables.sql` contains:

```sql
SET MARKUP CSV ON
SET FEEDBACK OFF
SET HEADING OFF
SET PAGESIZE 0
SET TERMOUT OFF
SET ECHO OFF
SET VERIFY OFF

SPOOL employees.csv
SELECT * FROM employees;
SPOOL OFF

SPOOL customers.csv
SELECT * FROM customers;
SPOOL OFF

SPOOL products.csv
SELECT * FROM products;
SPOOL OFF

EXIT
```

This approach eliminates the need to manually maintain a separate SQL file.

**Step 3 - Configure SQL*Plus Output**

Several SQL*Plus settings are used to produce clean CSV files.

*SET MARKUP CSV ON*

```
SET MARKUP CSV ON
```

This tells SQL*Plus to generate comma-separated values.

Without this option:

```
1001 JOHN
1002 MARY
```

With this option:

```csv
1001,JOHN
1002,MARY
```

This is the key setting that makes CSV export possible.


*SET FEEDBACK OFF*

```
SET FEEDBACK OFF
```

Suppresses messages such as:

```
125 rows selected.
```

This prevents unwanted text from appearing in output.

*SET HEADING OFF*

```
SET HEADING OFF
```

Suppresses column names.

Without it:

```
EMPNO,ENAME
1001,JOHN
1002,MARY
```

With it:

```
1001,JOHN
1002,MARY
```

If column headers are desired, use:

```
SET HEADING ON
```

instead.

*SET PAGESIZE 0*

```
SET PAGESIZE 0
```

Removes page breaks and report formatting.

This is useful when exporting large datasets.

*SET TERMOUT OFF*

```
SET TERMOUT OFF
```

Suppresses query output on the screen.

Without it, every exported row would scroll through the console window.

Instead, data is written directly to the CSV file.

*SET ECHO OFF*

```sql
SET ECHO OFF
```

Suppresses SQL statement display.

Without it:

```
SELECT * FROM pfihmd1;
```

would appear during execution.

*SET VERIFY OFF*

```
SET VERIFY OFF
```

Suppresses substitution-variable messages and keeps execution clean.

**Step 4 - Export Data Using SPOOL**

SQL*Plus uses the `SPOOL` command to write output to a file.

*Export employees*

```sql
SPOOL employees.csv

SELECT * FROM employees;

SPOOL OFF
```

Execution flow:

1. Open `employees.csv`
2. Execute the query
3. Write rows to the file
4. Close the file

Result:

```
employees.csv
```

**Export Customers**

**Export Products**


#### IV. Why Create Separate CSV Files?
Keeping one table per CSV file offers several benefits.

**Easier Data Analysis**

```
employees.csv
customers.csv
products.csv
```

Each file contains only one dataset.


**Easier Data Import**

Most tools expect one table per file:

- Microsoft Excel
- Power BI
- Python Pandas
- SQL Server Import Wizard
- Oracle SQL Developer

**Easier Troubleshooting**

If one export fails, the remaining files are unaffected.


#### V. Understanding the SQL*Plus Command
The actual export is performed by:

```
sqlplus -S %USERID%/%PASSWORD%@%HOST%:1521/%DB% @export_tables.sql
```

After variable substitution:

```
sqlplus -S albertoi/mypassword@my-oracle-host:1521/mypdb @export_tables.sql

```

The connection format is:

```
username/password@host:port/service
```

**What Does the -S Option Mean?**

```
sqlplus -S
```

The `-S` option means:

```text
Silent Mode
```

SQL*Plus suppresses:

- Banner text
- Version information
- Copyright information
- Connection messages

Without `-S`:

```text
SQL*Plus: Release 19.0.0.0.0

Connected to:
Oracle Database 19c ...
```

With `-S`:

```text
(no banner output)
```

This creates a much cleaner experience for automation.


#### VI. Recording Start and End Time
Before running the export:

```bat
set STARTDATE=%DATE%
set STARTTIME=%TIME%
```

Example:

```text
Wed 10/14/2026
9:40:11.39
```

Displayed as:

```text
Export started at Wed 10/14/2026 9:40:11.39
```

---

After the export:

```bat
set ENDDATE=%DATE%
set ENDTIME=%TIME%
```

Displayed as:

```text
Export completed at Wed 10/14/2026 9:40:31.99
```

This provides a simple execution audit trail.


#### VII. Sample Execution
Running the batch file:

```cmd
D:\Export>export_tables.bat
```

Produces:

```text
Export started at Wed 10/14/2026 9:40:11.39

Export completed at Wed 10/14/2026 9:40:31.99
```

Generated files:

```text
export_tables.sql
employees.csv
customers.csv
products.csv
```

**Example CSV Output**

Suppose `employees` contains:

```text
1001 JOHN
1002 MARY
1003 DAVID
```

The generated CSV might contain:

```csv
1001,JOHN
1002,MARY
1003,DAVID
```

If `SET HEADING ON` is used:

```csv
EMPNO,ENAME
1001,JOHN
1002,MARY
1003,DAVID
```


#### VIII. Improving Performance for Large Tables
For tables containing hundreds of thousands or millions of rows, consider adding:

```sql
SET ARRAYSIZE 5000
```

Example:

```sql
SET ARRAYSIZE 5000
SET MARKUP CSV ON
```

This reduces network round-trips between the Oracle client and database server and can noticeably improve export performance.


#### IX. Security Considerations
Avoid storing production passwords in plain text whenever possible.

Instead of:

```bat
set PASSWORD=mypassword
```

you may prompt the user:

```bat
set /p PASSWORD=Enter Password:
```

or use Oracle Wallet in security-sensitive environments.


#### X. Possible Enhancements
The solution can be extended easily.

**Export Additional Tables**

```
SPOOL orders.csv
SELECT * FROM orders;
SPOOL OFF
```

**Export Selected Columns**

```
SELECT
    usrid,
    usrname,
    crtdate
FROM users;
```

**Export Filtered Data**

```
SELECT *
FROM users
WHERE status = 'ACTIVE';
```

**Create Daily Snapshot Files**

```
SPOOL customer_20261014.csv
```

This allows historical exports to be retained.


#### XI. Conclusion
SQL*Plus remains one of the simplest and most reliable tools for exporting Oracle data. By combining SQL*Plus with a Windows batch file, developers and database administrators can build a lightweight, repeatable, and fully automated export process.

The solution described in this article:

- Connects directly to Oracle 19c
- Creates SQL scripts dynamically
- Exports multiple tables to CSV
- Produces minimal screen output
- Records execution timestamps
- Requires only a single command to run

For small-to-medium export requirements, this method is often faster to implement and easier to maintain than a full Data Pump or ETL solution.

Whether the goal is data migration, reporting, testing, development support, or simple archiving, SQL*Plus remains a valuable and efficient tool in every Oracle professional's toolkit.


#### XII. Biblipgraphy 
1. [SQL*Plus Overview](https://docs.oracle.com/cd/B12037_01/server.101/b12170/ch1.htm)
2. [Oracle Instant Client Downloads for Microsoft Windows (64-bit)](https://www.oracle.com/database/technologies/instant-client/winx64-64-downloads.html)
3. [The Book of Disquiet by Fernando Pessoa](./The%20Book%20of%20Disquiet%20-%20Fernando%20Pessoa.pdf)


#### Epilogue 
*In the end, the database was innocent.*

Oracle stored the Chinese characters correctly. SQL*Plus retrieved them correctly. The CSV files preserved them correctly. The data traveled faithfully from table to file, untouched and uncompromised. What appeared at first to be a corruption of information became instead a lesson about interpretation, encoding, and the importance of verifying assumptions before drawing conclusions.

Such moments are common in the life of every developer, analyst, and database administrator. Problems rarely announce themselves openly. They appear as symptoms, disguises, and coincidences. The craft lies not merely in solving them, but in learning how to ask better questions along the way.

This article captures one such investigation: a conversation between curiosity and technology, persistence and evidence. Behind every command executed, every CSV generated, and every line of SQL examined, there existed a simple desire to understand what was truly happening beneath the surface.

There were moments of certainty, moments of doubt, and moments when the evidence seemed to point in conflicting directions. Yet each test brought clarity. A database character set was verified. A SQL*Plus client was examined. A UTF-8 text file whispered the truth from within Notepad. Little by little, the mystery surrendered.

And somewhere throughout that journey sat an unlikely companion: an artificial intelligence assistant. Not as an oracle, nor as an authority, but as a patient partner in discovery. Asking questions, proposing hypotheses, eliminating possibilities, celebrating small victories, and occasionally sharing an imaginary cup of coffee beside the keyboard while another test was running.

To future readers who may follow the same path, may your exports complete successfully, your character sets align gracefully, and your troubleshooting sessions conclude with understanding rather than frustration.

Should you ever find yourself staring at a screen filled with mysterious question marks, remember this lesson well: sometimes the database is not the culprit. Sometimes the export script is not at fault. Sometimes the answer waits quietly in a text editor, hidden behind an assumption yet to be challenged.

**Credits**

This article was inspired by a real-world troubleshooting session and refined through a collaborative exchange between a human practitioner and Microsoft 365 Copilot.

The author provided the practical requirements, testing, validation, and domain expertise. Microsoft 365 Copilot contributed research assistance, technical explanations, troubleshooting guidance, editorial refinement, and documentation support throughout the development of the solution.

In that sense, the article is neither solely human-written nor solely machine-generated. It stands instead as an example of what can be achieved when human experience and artificial intelligence work side by side toward a common goal.

*May your queries return rows, your scripts execute without error, your CSV files preserve every character faithfully, and your coffee remain warm until the final export completes.*


### EOF (2026/10/30)
