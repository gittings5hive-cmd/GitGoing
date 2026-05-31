import js from '@eslint/js';
import globals from 'globals';

export default [
    {
        ignores: ['node_modules/**'],
    },
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'script',
            globals: {
                ...globals.browser,
            },
        },
        rules: {
            ...js.configs.recommended.rules,

            // Possible problems
            'no-duplicate-imports': 'error',
            'no-self-compare': 'error',

            // Best practices
            'curly': ['error', 'all'],
            'eqeqeq': ['error', 'always', { null: 'ignore' }],
            'no-var': 'error',
            'prefer-const': 'error',
            'no-console': 'warn',

            // Style (auto-fixable)
            'semi': ['error', 'always'],
            'quotes': ['error', 'single', { avoidEscape: true }],
            'indent': ['error', 4, { SwitchCase: 1 }],
            'no-trailing-spaces': 'error',
            'eol-last': ['error', 'always'],
            'comma-dangle': ['error', 'always-multiline'],
        },
    },
    // The flat config file itself is an ES module — override sourceType last so it wins
    {
        files: ['eslint.config.js'],
        languageOptions: {
            sourceType: 'module',
        },
    },
];
