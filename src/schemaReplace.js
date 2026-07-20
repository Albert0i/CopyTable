/**
 * schemaReplace.js
 */
import fs from 'fs';
import path from 'path';

function showUsage() {
  console.error(`Usage: 
      node src/schemaReplace.js <folder> <fromSchema> <toSchema>

      Example: node src/schemaReplace.js "H:\\\\UAT" DCWRKDTA DCUATDTA`);
}

function main() {
  const [folder, fromSchema, toSchema] = process.argv.slice(2);

  if (!folder || !fromSchema || !toSchema) {
    showUsage();
    process.exit(1);
  }

  let totalFiles = 0;
  let totalOccurrences = 0;

  const files = fs.readdirSync(folder).filter(f => f.endsWith('.txt') || f.endsWith('.sql'));

  for (const file of files) {
    const filePath = path.join(folder, file);
    let content = fs.readFileSync(filePath, 'utf8');

    const regex = new RegExp(fromSchema, 'gi');
    const matches = (content.match(regex) || []).length;

    if (matches > 0) {
      content = content.replace(regex, toSchema);
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`\x1b[32m✔\x1b[0m ${file}: replaced ${matches} occurrence(s).`);
      totalOccurrences += matches;
    } else {
      // Cross in red
      console.log(`\x1b[31m✘ ${file}: no occurrences found.\x1b[0m`);
    }

    // Rename file if schema name appears in filename
    if (file.includes(fromSchema)) {
      const newFileName = file.replace(fromSchema, toSchema);
      const newFilePath = path.join(folder, newFileName);
      fs.renameSync(filePath, newFilePath);
      console.log(`\x1b[32m➜\x1b[0m ${file} → renamed to ${newFileName}`);
    }

    totalFiles++;
  }

  console.log(`\nProcessed ${totalFiles} files.`);
  console.log(`Replaced ${totalOccurrences} occurrences of "${fromSchema}" with "${toSchema}".`);
}

main();


/*
   node src/schemaReplace.js "H:\\UAT" DCWRKDTA DCUATDTA
   node src/schemaReplace.js "H:\\UAT" DCDEVDTA DCUATDTA

   npm run schemarep -- "H:\\UAT" DCWRKDTA DCUATDTA
   npm run schemarep -- "H:\\UAT" DCDEVDTA DCUATDTA
*/