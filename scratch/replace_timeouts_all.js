const fs = require('fs');
const glob = require('fs').readdirSync('src/lib/services').filter(f => f.endsWith('.ts'));
const globRepo = require('fs').readdirSync('src/lib/repositories').filter(f => f.endsWith('.ts'));

function processFile(path) {
  let content = fs.readFileSync(path, 'utf8');
  if (/\{\s*maxWait:\s*\d+,[\s\S]*?timeout:\s*\d+,?[\s\S]*?\}/.test(content)) {
    if (!content.includes('TRANSACTION_TIMEOUTS')) {
      if (content.includes('import { prisma }')) {
        content = content.replace(
          /import \{ prisma \} from [\"']@\/lib\/prisma[\"'];/,
          'import { prisma, TRANSACTION_TIMEOUTS } from "@/lib/prisma";'
        );
      } else {
        content = 'import { TRANSACTION_TIMEOUTS } from "@/lib/prisma";\n' + content;
      }
    }
    content = content.replace(/\{\s*maxWait:\s*\d+,[^\n]*\n\s*timeout:\s*\d+,?[^\n]*\n\s*\}/g, 'TRANSACTION_TIMEOUTS');
    content = content.replace(/\{\s*maxWait:\s*\d+,\s*timeout:\s*\d+\s*\}/g, 'TRANSACTION_TIMEOUTS');
    fs.writeFileSync(path, content);
    console.log('Fixed ' + path);
  }
}

glob.forEach(file => processFile('src/lib/services/' + file));
globRepo.forEach(file => processFile('src/lib/repositories/' + file));
// Also check MVP features
const mvpActions = 'src/features/mvp/pos/actions.ts';
if (fs.existsSync(mvpActions)) processFile(mvpActions);
