import globals from 'globals';
import eslint from '@eslint/js';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';
import pluginReact from 'eslint-plugin-react';

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
                "code": 135,
                "tabWidth": 4,
                "comments": 200,
            }],
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": ["warn", {
                "argsIgnorePattern": "^_",
                "varsIgnorePattern": "^_",
            }],
            "no-lonely-if": "error",
            "no-lone-blocks": "error",
            "dot-notation": "off",
            "@typescript-eslint/dot-notation": "error",
            "@typescript-eslint/no-duplicate-enum-values": "error",
            "eqeqeq": ["error", "smart"],
            "@typescript-eslint/array-type": "error",
            "@typescript-eslint/consistent-type-exports": "error",
            "no-empty-function": "off",
            "@typescript-eslint/no-empty-function": "error",
            "@typescript-eslint/no-empty-object-type": "error",
            "@typescript-eslint/consistent-indexed-object-style": "error",
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
                    "format": null,
                },
                {
                    "selector": "variable",
                    "format": ["camelCase", "PascalCase", "UPPER_CASE"],
                    "leadingUnderscore": "allow",
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
            "react/no-unescaped-entities": "off",
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
