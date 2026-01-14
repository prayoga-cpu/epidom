#!/usr/bin/env node
/**
 * Comprehensive Lottie Migration Script
 * Updates ALL Loader2 instances to LottieLoader across the entire codebase
 */

const fs = require('fs');
const path = require('path');

// File patterns to process
const TARGET_EXTENSIONS = ['.tsx', '.ts'];
const EXCLUDE_DIRS = ['node_modules', '.next', '.git', 'dist', 'build'];

// Replacement patterns
const REPLACEMENTS = {
  // Import statement - remove Loader2, add LottieLoader import
  importRemoveLoader2: {
    pattern: /^(\s*import\s*\{[^}]*?),\s*Loader2\s*,([^}]*?\}\s*from\s*"lucide-react";)/gm,
    replace: '$1,$2'
  },
  importRemoveLoader2End: {
    pattern: /^(\s*import\s*\{[^}]*?),\s*Loader2\s*\}\s*from\s*"lucide-react";/gm,
    replace: '$1} from "lucide-react";'
  },
  importRemoveLoader2Start: {
    pattern: /^(\s*import\s*\{\s*)Loader2\s*,\s*([^}]*?\}\s*from\s*"lucide-react";)/gm,
    replace: '$1$2'
  },

  // Usage patterns - replace with LottieLoader based on size
  loaderXL: {
    pattern: /<Loader2\s+className="([^"]*?h-12[^"]*?|[^"]*?w-12[^"]*?)animate-spin([^"]*?)"\s*\/>/g,
    replace: '<LottieLoader size="xl" />'
  },
  loaderLG: {
    pattern: /<Loader2\s+className="([^"]*?h-10[^"]*?|[^"]*?w-10[^"]*?)animate-spin([^"]*?)"\s*\/>/g,
    replace: '<LottieLoader size="lg" />'
  },
  loaderMD: {
    pattern: /<Loader2\s+className="([^"]*?h-8[^"]*?|[^"]*?w-8[^"]*?)animate-spin([^"]*?)"\s*\/>/g,
    replace: (match, p1, p2) => {
      // Preserve className if has other important classes
      const preservedClasses = [p1, p2].join(' ')
        .replace(/h-\d+/g, '')
        .replace(/w-\d+/g, '')
        .replace(/animate-spin/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      return preservedClasses
        ? `<LottieLoader size="md" className="${preservedClasses}" />`
        : '<LottieLoader size="md" />';
    }
  },
  loaderSM: {
    pattern: /<Loader2\s+className="([^"]*?h-5[^"]*?|[^"]*?w-5[^"]*?)animate-spin([^"]*?)"\s*\/>/g,
    replace: '<LottieLoader size="sm" />'
  },
  loaderXS: {
    pattern: /<Loader2\s+className="([^"]*?h-4[^"]*?|[^"]*?w-4[^"]*?)animate-spin([^"]*?)"\s*\/>/g,
    replace: (match, p1, p2) => {
      const preservedClasses = [p1, p2].join(' ')
        .replace(/h-\d+/g, '')
        .replace(/w-\d+/g, '')
        .replace(/animate-spin/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      return preservedClasses
        ? `<LottieLoader size="xs" className="${preservedClasses}" />`
        : '<LottieLoader size="xs" />';
    }
  },
};

const LOTTIE_IMPORT = `import { LottieLoader } from "@/components/ui/lottie-loader";`;

function shouldProcessFile(filePath) {
  const ext = path.extname(filePath);
  return TARGET_EXTENSIONS.includes(ext);
}

function shouldSkipDirectory(dirName) {
  return EXCLUDE_DIRS.includes(dirName);
}

function processFile(filePath, dryRun = false) {
  let content = fs.readFileSync(filePath, 'utf8');
  let hasChanges = false;
  let needsImport = false;

  // Check if file uses Loader2
  if (!content.includes('Loader2')) {
    return { hasChanges: false, path: filePath };
  }

  let newContent = content;

  // Apply all replacement patterns
  Object.entries(REPLACEMENTS).forEach(([name, config]) => {
    const before = newContent;
    if (typeof config.replace === 'function') {
      newContent = newContent.replace(config.pattern, config.replace);
    } else {
      newContent = newContent.replace(config.pattern, config.replace);
    }
    if (before !== newContent) {
      hasChanges = true;
    }
  });

  // Add LottieLoader import if we made changes and it's not already there
  if (hasChanges && !content.includes('lottie-loader')) {
    // Find lucide-react import line
    const lucideImportMatch = newContent.match(/import\s*\{[^}]+\}\s*from\s*"lucide-react";/);
    if (lucideImportMatch) {
      const insertPosition = newContent.indexOf(lucideImportMatch[0]) + lucideImportMatch[0].length;
      newContent = newContent.slice(0, insertPosition) + '\n' + LOTTIE_IMPORT + newContent.slice(insertPosition);
      needsImport = true;
    }
  }

  // Write file if not dry run
  if (hasChanges && !dryRun) {
    fs.writeFileSync(filePath, newContent, 'utf8');
  }

  return { hasChanges, needsImport, path: filePath };
}

function scanDirectory(dir, dryRun = false) {
  const results = { files: [], changed: 0, errors: 0 };

  function walk(directory) {
    try {
      const files = fs.readdirSync(directory);

      files.forEach(file => {
        const filePath = path.join(directory, file);

        try {
          const stat = fs.statSync(filePath);

          if (stat.isDirectory()) {
            if (!shouldSkipDirectory(file)) {
              walk(filePath);
            }
          } else if (shouldProcessFile(filePath)) {
            const result = processFile(filePath, dryRun);
            if (result.hasChanges) {
              results.files.push(result);
              results.changed++;

              if (dryRun) {
                console.log(`✓ Would update: ${filePath}`);
              } else {
                console.log(`✓ Updated: ${filePath}`);
              }
            }
          }
        } catch (error) {
          console.error(`✗ Error processing ${filePath}:`, error.message);
          results.errors++;
        }
      });
    } catch (error) {
      console.error(`✗ Error reading directory ${directory}:`, error.message);
      results.errors++;
    }
  }

  walk(dir);
  return results;
}

// Main execution
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const targetPath = args.find(arg => arg.startsWith('--path='))?.split('=')[1] || 'src/';

console.log('🎨 Comprehensive Lottie Migration Script');
console.log(`📁 Scanning: ${targetPath}`);
console.log(`🔍 Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}\n`);

const results = scanDirectory(targetPath, dryRun);

console.log('\n📊 Summary:');
console.log(`   Files changed: ${results.changed}`);
console.log(`   Errors: ${results.errors}`);

if (dryRun && results.changed > 0) {
  console.log('\n💡 Run without --dry-run to apply changes');
} else if (!dryRun && results.changed > 0) {
  console.log('\n✅ Migration complete! All Loader2 instances updated to LottieLoader.');
}

console.log('\n✅ Done!');

process.exit(results.errors > 0 ? 1 : 0);
