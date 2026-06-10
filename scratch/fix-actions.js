const fs = require('fs');
const path = 'd:/Projects/epidom/src/features/dashboard/data/actions.ts';
let content = fs.readFileSync(path, 'utf8');

// Add import if not present
if (!content.includes('import { parseNumber }')) {
  content = content.replace('import { z } from "zod";', 'import { z } from "zod";\nimport { parseNumber } from "@/lib/utils/number-parser";');
}

// Remove the parseGlobalNumber function definition
const parseFuncRegex = /function parseGlobalNumber\(value: any\): number \{[\s\S]*?return isNaN\(result\) \? 0 : result;\n\}\n/m;
content = content.replace(parseFuncRegex, '');

// Replace specific parseGlobalNumber usages
content = content.replace(/parseGlobalNumber\(([^)]+)\) \|\| parseGlobalNumber\(([^)]+)\) \|\| 0/g, 'parseNumber($1, { defaultValue: parseNumber($2, { defaultValue: 0 }) })');
content = content.replace(/parseGlobalNumber\(([^)]+)\) \|\| parseGlobalNumber\(([^)]+)\) \|\| 1/g, 'parseNumber($1, { defaultValue: parseNumber($2, { defaultValue: 1 }) })');

content = content.replace(/parseGlobalNumber\(([^)]+)\) \|\| 0/g, 'parseNumber($1, { defaultValue: 0 })');
content = content.replace(/parseGlobalNumber\(([^)]+)\) \|\| 1/g, 'parseNumber($1, { defaultValue: 1 })');
content = content.replace(/parseGlobalNumber\(([^)]+)\)/g, 'parseNumber($1, { defaultValue: 0 })');

// Replace console.log / console.error with logger.debug / logger.error
if (!content.includes('import { logger }')) {
  content = content.replace('import { parseNumber }', 'import { logger } from "@/lib/logger";\nimport { parseNumber }');
}
content = content.replace(/console\.error\("Bulk Import Error:", error\);/g, 'logger.error("Bulk Import Error", error);');
content = content.replace(/console\.error\("Material import error:", error\);/g, 'logger.error("Material import error", error);');
content = content.replace(/console\.error\(`Product import error at row \$\{i\+1\}:`, error\);/g, 'logger.error(`Product import error at row ${i+1}`, error);');
content = content.replace(/console\.error\("Product import fatal error:", error\);/g, 'logger.error("Product import fatal error", error);');
content = content.replace(/console\.log\("\[importSuppliers\] Raw data received:", JSON\.stringify\(data, null, 2\)\);/g, 'logger.debug("[importSuppliers] Raw data received", { recordCount: data.length });');
content = content.replace(/console\.log\("\[importSuppliers\] Cleaned supplier:", cleaned\);/g, 'logger.debug("[importSuppliers] Cleaned supplier", { cleaned });');
content = content.replace(/console\.error\("Supplier import error:", error\);/g, 'logger.error("Supplier import error", error);');
content = content.replace(/console\.log\("\[Smart Import\] Entity grouping:", \{/g, 'logger.debug("[Smart Import] Entity grouping", {');
content = content.replace(/console\.error\("Multi-Entity Import Error:", error\);/g, 'logger.error("Multi-Entity Import Error", error);');

fs.writeFileSync(path, content, 'utf8');
console.log('actions.ts updated successfully');
