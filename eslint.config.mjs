import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

const eslintConfig = [
  {
    // Global ignores for Next.js build folders and declaration files
    ignores: [".next/**", "next-env.d.ts"]
  },

  // Base configuration extended from Next.js and TypeScript presets
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  {
    rules: {
      // Disables React Hooks dependency array checks
      "react-hooks/exhaustive-deps": "off",

      // Disables warnings for unused variables (e.g., 'message', 'error')
      "@typescript-eslint/no-unused-vars": "off",

      // Disables warnings forcing the use of Next.js <Image /> over <img>
      "@next/next/no-img-element": "off",
    },
  },
];

export default eslintConfig;
