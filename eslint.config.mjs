const eslintConfig = [
  {
    ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
  {
    rules: {
      // Basic rules for Next.js project
      "no-unused-vars": "warn",
      "no-console": "warn",
    },
  },
];

export default eslintConfig;
