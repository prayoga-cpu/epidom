/**
 * Writes the English and Indonesian copies of the sales pages
 * (public/sales-pages/sales-page-N.{en,id}.html) from the French originals and
 * the tables in src/features/marketing/sales-pages/translations/.
 *
 *   tsx scripts/build-sales-pages.ts                      write every copy that has no problems
 *   tsx scripts/build-sales-pages.ts --check              report problems, write nothing
 *   tsx scripts/build-sales-pages.ts --only sales-page-1.en   limit to one copy (with or without --check)
 *   tsx scripts/build-sales-pages.ts --list sales-page-1  print the French pieces a table has to cover
 *
 * Exits 1 when any copy has a problem (untranslated text, a price still in
 * euros, a pair that matches nothing…). See translate-sales-page.ts.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  listTranslatablePieces,
  translateSalesPage,
} from "../src/features/marketing/sales-pages/lib/translate-sales-page";
import { SALES_PAGE_TRANSLATIONS } from "../src/features/marketing/sales-pages/translations";

const DIR = join(__dirname, "..", "public", "sales-pages");
const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : (args[i + 1] ?? "");
};

const listPage = flag("--list");
if (listPage !== undefined) {
  const src = readFileSync(join(DIR, `${listPage}.html`), "utf8");
  for (const piece of listTranslatablePieces(src)) console.log(JSON.stringify(piece));
  process.exit(0);
}

const check = args.includes("--check");
const only = flag("--only");
let failed = false;

for (const [page, byLocale] of Object.entries(SALES_PAGE_TRANSLATIONS)) {
  const src = readFileSync(join(DIR, `${page}.html`), "utf8");
  for (const translation of Object.values(byLocale)) {
    const name = `${page}.${translation.locale}`;
    if (only && only !== name) continue;
    const { html, problems } = translateSalesPage(src, translation);
    if (problems.length) {
      failed = true;
      console.log(`✗ ${name}: ${problems.length} problem(s)`);
      for (const p of problems) console.log(`  - ${p}`);
      continue;
    }
    if (check) {
      console.log(`✓ ${name}`);
      continue;
    }
    writeFileSync(join(DIR, `${name}.html`), html);
    console.log(`✓ ${name} → public/sales-pages/${name}.html`);
  }
}

process.exit(failed ? 1 : 0);
