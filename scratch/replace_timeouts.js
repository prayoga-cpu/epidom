const fs = require('fs');
const glob = require('fs').readdirSync('src/lib/services').filter(f => f.endsWith('.ts'));

glob.forEach(file => {
  const path = 'src/lib/services/' + file;
  let content = fs.readFileSync(path, 'utf8');
  if (content.includes('maxWait: 10000')) {
    // Add import
    if (!content.includes('TRANSACTION_TIMEOUTS')) {
      content = content.replace(
        'import { prisma } from "@/lib/prisma";',
        'import { prisma, TRANSACTION_TIMEOUTS } from "@/lib/prisma";'
      );
    }
    // Replace the block
    content = content.replace(
      /\{\s*maxWait:\s*10000,\s*\/\/[^\n]*\n\s*timeout:\s*20000,?\s*\/\/[^\n]*\n\s*\}/g,
      'TRANSACTION_TIMEOUTS'
    );
    // Replace block without comments just in case
    content = content.replace(/\{\s*maxWait:\s*10000,\s*timeout:\s*20000\s*\}/g, 'TRANSACTION_TIMEOUTS');
    
    fs.writeFileSync(path, content);
    console.log('Fixed ' + file);
  }
});
