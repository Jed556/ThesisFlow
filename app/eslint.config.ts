import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import { defineConfig } from "eslint/config";

export default defineConfig([
    // Global ignores
    {
        ignores: ["dist", "build", "node_modules"],
    },
    {
        files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
        plugins: {
            js,
            "@typescript-eslint": tseslint,
        },
        extends: [
            js.configs.recommended, // ESLint's recommended rules
            "plugin:@typescript-eslint/recommended", // TypeScript ESLint recommended rules
            "plugin:@typescript-eslint/recommended-type-checked", // Type-aware rules
        ],
        languageOptions: {
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
                project: ["./tsconfig.json"], // Required for type-aware linting
            },
            globals: { ...globals.browser, ...globals.node }
        },
        rules: {
            "no-unused-vars": "warn",
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-unused-vars": "warn",
            quotes: ["error", "single", { avoidEscape: true }],
            semi: ["error", "always"],

        },
    },
    tseslint.configs.recommended,
    pluginReact.configs.flat.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,

    // Specific configuration for test files
    {
        files: ["**/*.test.{js,ts,jsx,tsx}"],
        rules: {
            "no-console": "off", // Allow console logs in tests
        },
    },
]);
