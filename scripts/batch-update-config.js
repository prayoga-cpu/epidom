/**
 * Batch Update Loader2 to LottieLoader
 *
 * This script updates all remaining Loader2 instances to use LottieLoader
 */

const files = [
  // Data sections - Suppliers & Recipes
  {
    path: "src/features/dashboard/data/suppliers/components/suppliers-section.tsx",
    replacements: [
      {
        search: /^import \{([^}]*?)Loader2,([^}]*?)\} from "lucide-react";$/m,
        replace: (match, p1, p2) => `import {${p1}${p2}} from "lucide-react";\nimport { LottieLoader } from "@/components/ui/lottie-loader";`,
      },
      {
        search: /<Loader2 className="mr-1 hidden h-4 w-4 animate-spin sm:inline" \/>/g,
        replace: '<LottieLoader size="xs" className="mr-1 hidden sm:inline" />',
      },
    ],
  },
  {
    path: "src/features/dashboard/data/recipes/components/recipes-section.tsx",
    replacements: [
      {
        search: /^import \{([^}]*?)Loader2,([^}]*?)\} from "lucide-react";$/m,
        replace: (match, p1, p2) => `import {${p1}${p2}} from "lucide-react";\nimport { LottieLoader } from "@/components/ui/lottie-loader";`,
      },
      {
        search: /<Loader2 className="mr-1 hidden h-4 w-4 animate-spin sm:inline" \/>/g,
        replace: '<LottieLoader size="xs" className="mr-1 hidden sm:inline" />',
      },
    ],
  },
];

console.log(`📝 Files to update: ${files.length}`);
console.log("✅ Ready for batch update!");

export { files };
