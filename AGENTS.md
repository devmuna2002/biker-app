AGENTS.md

Overview
- This document guides automated coding agents (and humans reviewing changes) on how to build, test, and style the codebase in this repository.
- It also covers common pitfalls exposed by the current project (React Native with Flow), and how to handle errors gracefully.

Known rules
- If you see a .cursor/rules/ or .github/copilot-instructions.md in the repo, fold their requirements into the sections below.
- If such files exist, copy and summarize them here for quick reference.

Build, lint, test commands
- Install dependencies
  - npm ci  (or yarn install)
- Linting
  - npm run lint    (or yarn lint)
- Tests
  - npm test        (or yarn test)
- Run a single test (jest)
  - npm test -- -t 'RouteSelectionScreen'  (quoted test pattern)
- iOS build/run
  - npx react-native run-ios
- Android build/run
  - npx react-native run-android
- Full local verification sequence (recommended)
  - npm ci
  - npm run lint
  - npm test -- -t 'RouteSelectionScreen'  # or your target
  - npx react-native run-ios
  - npx react-native run-android

Code style guidelines
- General philosophy
  - Be explicit, predictable, and readable. Prefer clarity over cleverness.
- Imports
  - Group imports in this order: built-ins, external libraries, then local project files.
  - Use top-level imports only; avoid dynamic imports for module side effects unless necessary.
  - Alphabetize imports within groups when sensible; avoid cyclic dependencies.
  - Do not leave unused imports in the file.
- Formatting and whitespace
  - Use the project’s formatter (Prettier) and linter (ESLint) to enforce style.
  - Indentation: 2 spaces (or as configured by the repo); prefer consistent line breaks.
  - Semicolons: follow project defaults; maintain consistency with existing code.
- Types and props
  - If Flow is enabled, annotate component props with Flow types where practical.
  - If using TypeScript, prefer explicit types and avoid implicit any.
  - PropTypes can be used as a lightweight alternative when Flow/TS is not in use.
- Component design
  - Screen components named with PascalCase and ending in Screen, e.g. RouteSelectionScreen.
  - Stateless helpers should be defined outside render paths; avoid recreating functions on every render.
- Error handling
  - Wrap API calls with try/catch; surface user-friendly messages (Alert/Toast).
  - Do not swallow errors; log them with context (tagged with [AGENT]).
- Async/await patterns
  - Prefer async/await over promise chains for readability.
  - Always handle edge cases (null/undefined responses).
- Rendering and state
  - Use useEffect dependency arrays correctly; include all dependencies.
  - Avoid arrow functions inside render where possible; memoize handlers with useCallback when appropriate.
- Testing
  - Unit tests should cover business logic and edge cases, not just rendering.
  - Tests should be deterministic; mock network calls where possible.
- Accessibility
  - Ensure touch targets are accessible; provide accessible labels and roles where appropriate.
- Performance
  - Debounce expensive searches; avoid unnecessary re-renders.
  - Use memoization and stable function references for callbacks.

Examples
- Import grouping
  - import React, { useState, useEffect } from 'react';
  - import { View, Text } from 'react-native';
- Props typing (Flow)
  - type Props = { navigation: any, route: any };
  - const MyScreen = ({ navigation, route }: Props) => { ... };
- Async call with error handling
  - try {
      const res = await fetch(url);
      const data = await res.json();
      // process data
    } catch (err) {
      console.error('[AGENT] API error:', err);
      Alert.alert('Network error', 'Please try again later.');
    }

Troubleshooting common issues
- Router/Bundle errors: "import" and "export" may only appear at the top level
  - This usually indicates a mismatched brace/semicolon in a nearby function. Check for:
    1) Unmatched braces that cause a top-level export to be parsed inside a function.
    2) A stray closing brace or parenthesis earlier in the file.
    3) A nested function block that accidentally contains a top-level import/export.
  - In particular, RouteSelectionScreen.js showed a potential nesting issue around the end of the handlePlaceSelection function; ensure that all braces close before the top-level export.
  - After fixing, re-run the local build: npx react-native run-ios

Version control and commits
- Use conventional commits when possible: feat:, fix:, refactor:, test:, docs:
- Make small, atomic commits with clear messages describing why, not just what.
- Do not commit secrets or credentials; use environment/config management.

-Appendix: Cursor and Copilot rules
- If there are .cursor/rules/ or .github/copilot-instructions.md files, include their requirements here.
- Ensure AGENTS.md reflects any repository-specific quirks described there.

Extended Agent Workflow
- Before touching code: read related issues/PRs to understand intent and constraints.
- Create a small, atomic change; prefer one logical fix per patch.
- Run local verification: npm ci; npm run lint; npm test -- -t '<TargetTest>' --runInBand; npx react-native run-ios; npx react-native run-android
- If tests fail, capture error messages and reproduce locally with verbose logs when required.
- When you finish, write a concise commit message focusing on why this change was needed.
- Open a PR with a short title and a body that covers what, why, and tradeoffs.

Single-test and targeting guidance
- To run a single Jest test: npm test -- -t 'RouteSelectionScreen'  (quote the test pattern)
- For deterministic runs in CI-like environments, use: npm test -- -t 'RouteSelectionScreen' --runInBand
- You can also limit tests by file path: npm test -- src/screens/RouteSelectionScreen.js
- In React Native projects, after code edits, rebuild to validate bundling: npx react-native run-ios

Code style and conventions (expanded)
- Imports
  - Built-ins, external libs, local modules; alphabetized within groups where sensible.
- Types and props
  - Flow: type Props = { ... } and annotate functional components as needed.
- Error handling
  - Do not let uncaught promises crash UI; show user-friendly alerts and log with context [AGENT].
- Naming conventions
  - Components: PascalCase ending in Screen; helpers: camelCase; constants: UPPER_SNAKE.
- Tests
  - Prefer unit tests around business logic; use mocks for network calls; ensure tests are deterministic.
- Accessibility
  - Add accessible labels and roles for touch targets; test with screen readers if possible.
- Performance
  - Debounce input, memoize expensive computations, avoid re-renders via stable callbacks.
- Security
  - Do not commit secrets; avoid including credentials; use environment config management.
- Localization
  - Prefer resource-based strings; plan for i18n if needed.
- Deployment hints
  - Ensure RN projects have proper pods installed; run npm ci; pod install for iOS as needed.

Code review and collaboration
- Provide a brief, actionable PR description; reference related issues.
- Respond promptly to review feedback; add tests or docs if required.
- If reviewer asks for changes, open a follow-up patch rather than bundling changes.

Cursor rules and Copilot integration
- If there are .cursor/rules/ or .github/copilot-instructions.md files, include their requirements here.
- Ensure any Copilot-generated code adheres to the team's style and lint rules before committing.
- If there are .cursor/rules/ or .github/copilot-instructions.md files, include their requirements here.
- Ensure AGENTS.md reflects any repository-specific quirks described there.
