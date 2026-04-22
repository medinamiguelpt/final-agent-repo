import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // React 19 flags setState-in-useEffect, but our legitimate init-from-localStorage
      // and mount-fetch patterns in dashboard/page.tsx trigger it. Downgrade to warn
      // until the file is split and effects can be properly refactored.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "*.mjs",
    "crop-toast.mjs",
    "mobile-debug*.mjs",
    "responsive-test.mjs",
    "test-*.mjs",
    "modal-test.js",
  ]),
]);

export default eslintConfig;
