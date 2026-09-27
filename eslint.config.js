import js from "@eslint/js";
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import prettier from "eslint-config-prettier";

export default [
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/coverage/**",
      "apps/ai/**",
      "**/test-results/**",
      "**/playwright-report/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,jsx}"],
    languageOptions: { ecmaVersion: "latest", sourceType: "module" },
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["apps/api/**/*.js", "*.js", "apps/web/scripts/**/*.js", "apps/web/vite.config.js"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["apps/web/src/**/*.{js,jsx}"],
    plugins: { react, "react-hooks": reactHooks, "react-refresh": reactRefresh },
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { react: { version: "18.3" } },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules,
      ...reactHooks.configs.recommended.rules,
      "react/prop-types": "off",
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
  {
    // Playwright tests run in Node but pass small functions into the browser page.
    files: ["e2e/**/*.js"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  {
    files: ["**/*.test.{js,jsx}", "**/test/**/*.{js,jsx}"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  prettier,
];
