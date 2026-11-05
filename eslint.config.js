import js from "@eslint/js";
import globals from "globals";
import hooks from "eslint-plugin-react-hooks";
import refresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
export default [
  { ignores: ["dist", "node_modules", ".publication", ".vercel"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  hooks.configs.flat.recommended,
  { files: ["tests/**/*.mjs", "scripts/**/*.mjs"], languageOptions: { globals: globals.node } },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser, ...globals.worker } },
    plugins: { "react-refresh": refresh },
    rules: {
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
];
