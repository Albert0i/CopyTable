### 🛠️ Guide: Running and Verifying Oracle XE 21c in Docker


#### 1. Run the Container
Use your command:
```bash
docker run -d \
  -p 1521:1521 \
  -e ORACLE_PASSWORD=123456 \
  -v oracle-volume:/opt/oracle/oradata \
  --name oracle-xe21c \
  gvenzl/oracle-xe:21
```

- `-p 1521:1521` → Exposes the SQL*Net listener port.  
- `-e ORACLE_PASSWORD=123456` → Sets the admin password.  
- `-v oracle-volume:/opt/oracle/oradata` → Persists database files.  
- `--name oracle-xe21c` → Names the container for easy reference.  


#### 2. Verify the Version
##### Method A: Check Logs
```bash
docker logs oracle-xe21c | grep "Oracle Database"
```
You should see:
```
Oracle Database 21c Express Edition Release 21.0.0.0.0 - Production
```

##### Method B: Query from SQL*Plus
```bash
docker exec -it oracle-xe21c sqlplus system/123456@//localhost:1521/XEPDB1
```
Then run:
```sql
SELECT * FROM v$version;
```
This will display the database version string.

##### Method C: SQL*Plus Client Version
```bash
docker exec -it oracle-xe21c sqlplus -V
```
This prints the SQL*Plus client version, which matches the installed Oracle XE version.


#### ✅ Quick Check
If any of the above outputs show **“Oracle Database 21c Express Edition”**, you’re running the correct XE 21c image.


### EOF 