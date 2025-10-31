import globals from "globals";
import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import pluginReact from "eslint-plugin-react";

export default defineConfig(
    // Base configuration
    eslint.configs.recommended,
    tseslint.configs.recommended,
    // Global ignores
    {
        ignores: ["dist", "build", "node_modules", "*.config.ts", "*.config.js"],
    },

    // React rules
    pluginReact.configs.flat.recommended,

    // Project-specific configuration
    {
        files: ["**/*.{ts,tsx}"],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module",
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
            globals: {
                ...globals.browser,
                ...globals.node
            }
        },
        settings: {
            react: {
                version: "detect",
            },
        },
        rules: {
            "max-len": ["warn", {
                "code": 130,
                "tabWidth": 4,
                "comments": 200,
            }],
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": "warn",
            "no-lonely-if": "error",
            "no-lone-blocks": "error",
            "dot-notation": "off",
            "@typescript-eslint/dot-notation": "error",
            "@typescript-eslint/no-duplicate-enum-values": "error",
            "eqeqeq": ["error", "smart"],
            "@typescript-eslint/consistent-type-exports": "error",
            "no-empty-function": "off",
            "@typescript-eslint/no-empty-function": "error",
            "@typescript-eslint/no-empty-object-type": "error",
            "@typescript-eslint/no-deprecated": "error",
            "@typescript-eslint/consistent-type-imports": [
                "error",
                {
                    "prefer": "type-imports",
                    "fixStyle": "separate-type-imports"
                }
            ],
            "@typescript-eslint/no-require-imports": "error",
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/naming-convention": [
                "error",
                {
                    "selector": "default",
                    "format": ["camelCase", "PascalCase"],
                    "leadingUnderscore": "allow",
                    "trailingUnderscore": "allow",
                },
                {
                    "selector": "variable",
                    "format": ["camelCase", "PascalCase", "UPPER_CASE"],
                },
                {
                    "selector": "function",
                    "format": ["camelCase", "PascalCase"],
                },
                {
                    "selector": "typeLike",
                    "format": ["PascalCase"],
                },
            ],
            "@typescript-eslint/method-signature-style": ["error", "property"],
            "quotes": ["error", "single", { avoidEscape: true }],
            "semi": ["error", "always"],
            "react/react-in-jsx-scope": "off",
        },
    },

    // Specific configuration for test files
    {
        files: ["**/*.test.{js,ts,jsx,tsx}"],
        rules: {
            "no-console": "off",
        },
    },
);
