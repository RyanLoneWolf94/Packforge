const fs = require('fs');
const path = require('path');
const dir = './src/pages';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf-8');
  let modified = false;
  
  const regex = /<button(?![^>]*onClick)[^>]*>/g;
  content = content.replace(regex, (match) => {
    if (match.includes('className=')) {
        modified = true;
        return match.replace('className=', `onClick={() => toast.info('Feature coming soon!')} className=`);
    } else if (!match.includes('/>')) {
        modified = true;
        return match.replace('<button', `<button onClick={() => toast.info('Feature coming soon!')}`);
    }
    return match;
  });

  if (modified) {
    if (!content.includes("import { toast } from 'sonner'")) {
       content = `import { toast } from 'sonner';\n` + content;
    }
    fs.writeFileSync(filePath, content);
    console.log("Fixed", file);
  }
}
