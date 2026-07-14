
const convertToCreateSQL = (table, schema) => {
    let sql = ''
    let line = ''
    let primaryKeys = ''

    if (schema.length===0)
        return '';
    else {        
        for (i=0; i< schema.length; i++)
        {
            if (sql !=='') sql += ', '
            line = `${schema[i].column_name.toLowerCase()} `
            switch(schema[i].data_type) {                
                case 'CHAR':
                case 'VARCHAR':
                case 'VARCHAR2':                  
                    line += `CHAR(${schema[i].data_length})`
                    break;
                case 'NUMBER':
                    if (schema[i].data_precision && schema[i].data_scale)
                        line += `DECIMAL(${schema[i].data_precision}, ${schema[i].data_scale})` 
                    else 
                        line += 'INTEGER' 
                    break;
                case 'TEXT': 
                case 'DATE': 
                case 'TIMESTAMP':
                case 'TIMESTAMP(6)': 
                    line += 'TEXT'
                    break
                default:                    
                    line += schema[i].data_type
            }
            if (schema[i].position) 
            {
                if (primaryKeys !== '')
                    primaryKeys += ', ';
                primaryKeys += schema[i].column_name.toLowerCase()
            }
            sql += line 
        }
        if (primaryKeys !== '')                
            line = `, CONSTRAINT ${table}_pk PRIMARY KEY(${primaryKeys})`;
        else 
            line = ''
            
        sql = `CREATE TABLE ${table.toLowerCase()} ( ${sql}${line} ); `
        
        return sql 
    }
}

const convertToInsertSQL = (table, rows) => {
    let sql = ''
    let fields = ''
    let values = ''

    if (rows.length===0)
        return '';
    else {        
        for (i=0; i< rows.length; i++)
        {            
            fields = ''
            values = '';
            for (const [key, value] of Object.entries(rows[i])) {
                if (fields !== '') fields += ', '
                fields += key.toLowerCase()
                if (values !== '') values += ', '

                switch (typeof value) {
                    case "string": 
                        values += "'" + value.trim().replace(/'/g, "''").replace(/;/g, ",").replace(/&#/g, "") + "'"
                        break;
                    case "number": 
                        values += value
                        break;
                    default:
                        values += "'" + String(value) + "'"
                }
            }            
            sql += `INSERT INTO ${table} (${fields}) VALUES(${values}); `
        }

        return sql 
    }
}

export { convertToCreateSQL, convertToInsertSQL } 

/*
   Object.entries()
   https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/entries

   How to Replace Multiple Words and Characters in JavaScript
   https://muhimasri.com/blogs/how-to-replace-multiple-words-and-characters-in-javascript/
*/