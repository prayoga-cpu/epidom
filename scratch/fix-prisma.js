const fs = require('fs');

const file = 'd:/Projects/epidom/src/types/prisma.ts';
let content = fs.readFileSync(file, 'utf8');

const target = `export type SerializeDecimal<T> = T extends Prisma.Decimal
  ? number
  : T extends Date`;

const replace = `export type SerializeDecimal<T> = T extends Prisma.Decimal
  ? number
  : T extends { s: number; e: number; d: number[] }
  ? number
  : T extends Date`;

content = content.replace(target, replace);
fs.writeFileSync(file, content, 'utf8');

console.log('Fixed SerializeDecimal in prisma.ts');
