const fs = require('fs');

const f1 = 'd:/Projects/epidom/src/features/dashboard/data/products/components/products-section.tsx';
let c1 = fs.readFileSync(f1, 'utf8');
if (!c1.includes('import type { SerializeDecimal }')) {
  c1 = c1.replace('import { useState } from "react";', 'import type { SerializeDecimal } from "@/types/prisma";\nimport { useState } from "react";');
  fs.writeFileSync(f1, c1, 'utf8');
}

const f2 = 'd:/Projects/epidom/src/features/dashboard/data/products/components/product-details-dialog.tsx';
let c2 = fs.readFileSync(f2, 'utf8');
if (!c2.includes('import type { SerializeDecimal }')) {
  c2 = c2.replace('import { useState } from "react";', 'import type { SerializeDecimal } from "@/types/prisma";\nimport { useState } from "react";');
  fs.writeFileSync(f2, c2, 'utf8');
}

const f3 = 'd:/Projects/epidom/src/features/dashboard/data/products/components/edit-product-dialog.tsx';
let c3 = fs.readFileSync(f3, 'utf8');
if (!c3.includes('import type { SerializeDecimal }')) {
  // edit-product doesn't have 'import { useState } from "react";' at the top exactly like that maybe?
  // let's just replace '"use client";'
  c3 = c3.replace('"use client";', '"use client";\nimport type { SerializeDecimal } from "@/types/prisma";');
  fs.writeFileSync(f3, c3, 'utf8');
}

console.log('Added SerializeDecimal imports to product UI');
