# Repository Guidelines

## Project Structure & Module Organization
This Expo app uses file-based routing in `app/`, where route files such as `app/dashboard.tsx` and `app/sign-up.tsx` map directly to screens. Keep reusable screen implementations in `features/<domain>/screens/`, shared UI in `components/`, app-wide state in `state/`, and API/query helpers in `lib/`. Static assets live in `assets/`, shared constants in `constants/`, theme tokens in `theme/`, and TypeScript models in `types/`. Place tests under `__tests__/` near the code they cover.

## Build, Test, and Development Commands
Install dependencies with `npm ci`.

- `npm run start` or `npm run start:expo`: start Expo for Expo Go.
- `npm run web`: run the app in a browser.
- `npm run ios` / `npm run android`: launch native builds locally.
- `npm run docker:start`: run the app in Docker with tunnel mode and live reload.
- `npm run docker:stop`: stop the Docker environment.
- `npm run docker:reset`: rebuild containers and volumes from scratch.

## Coding Style & Naming Conventions
Use TypeScript with `strict` mode enabled. Follow the existing style in the repo: 2-space indentation, semicolons, and single quotes. Name React components and screen files in PascalCase inside `features/` and `components/` (example: `DashboardScreen.tsx`), hooks in camelCase with a `use` prefix (example: `useSelectedDevice.ts`), and Expo route files in kebab-case when they represent URLs (example: `register-device.tsx`). Prefer the `@/*` path alias when it keeps imports clearer.

## Testing Guidelines
The repo currently includes a snapshot test in `components/__tests__/StyledText-test.js` using `react-test-renderer`, but no dedicated `npm test` script or coverage gate is configured yet. For new tests, keep the `__tests__/` convention and name files `*.test.ts`, `*.test.tsx`, or `*-test.js` to match existing usage. For UI changes, include manual verification steps for Expo Go, web, and any affected device flows.

## Commit & Pull Request Guidelines
Recent commits use short, lowercase, outcome-focused messages such as `fixed preset experience` and `refactored to react query`. Keep commits narrowly scoped and descriptive. Pull requests should include a concise summary, linked issue or task, manual test notes, and screenshots or recordings for route or visual changes.

## Configuration Tips
The API base URL resolves from `EXPO_PUBLIC_SERVER_URL`, then `SERVER_URL`, and otherwise falls back to production defaults in `lib/api.ts`. Do not commit secrets; prefer local environment variables for server overrides.
