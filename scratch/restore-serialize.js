const fs = require('fs');

const code = `
/**
 * Deeply transforms a type, replacing all instances of Prisma.Decimal with number.
 * This is used for safe serialization of server data to client components.
 */
export type SerializeDecimal<T> = T extends Prisma.Decimal
  ? number
  : T extends { s: number; e: number; d: number[] }
  ? number
  : T extends Date
  ? T // Preserve Date objects as they are serialized by Next.js automatically
  : T extends Array<infer U>
  ? Array<SerializeDecimal<U>>
  : T extends object
  ? { [K in keyof T]: SerializeDecimal<T[K]> }
  : T;

export function deepSerializeDecimal<T>(obj: T): SerializeDecimal<T> {
  if (obj === null || obj === undefined) return obj as any;
  
  if (isPrismaDecimal(obj)) {
    return decimalToNumber(obj) as any;
  }
  
  // Duck typing for Decimal.js internally
  if (typeof obj === 'object' && obj !== null && 'd' in obj && 'e' in obj && 's' in obj && Array.isArray((obj as any).d)) {
    return decimalToNumber(obj as any) as any;
  }

  if (obj instanceof Date) {
    return obj as any;
  }

  if (Array.isArray(obj)) {
    return obj.map(deepSerializeDecimal) as any;
  }

  if (typeof obj === 'object') {
    const serialized = {} as any;
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        serialized[key] = deepSerializeDecimal((obj as any)[key]);
      }
    }
    return serialized;
  }

  return obj as any;
}
`;

fs.appendFileSync('d:/Projects/epidom/src/types/prisma.ts', code);
console.log('Appended SerializeDecimal and deepSerializeDecimal');
