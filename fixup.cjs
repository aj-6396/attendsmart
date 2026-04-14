const fs = require('fs');

['patch_teacher.cjs', 'patch_student.cjs'].forEach(file => {
  let code = fs.readFileSync(file, 'utf8');
  
  // Inject the line-ending normalizer safely into the patch script
  code = code.replace(
    /fs\.readFileSync\(([^)]+)\);/,
    "fs.readFileSync($1).replace(/\\r\\n/g, '\\n');"
  );
  
  fs.writeFileSync(file, code);
  console.log(`Fixed ${file}`);
});
