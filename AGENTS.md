# @fromforgesoftware/ts-kit — framework-agnostic TypeScript toolkit

Base TS library for the forge frontends (vue-kit, angular-kit, the console).
No forge dependencies (base). Published to GitHub Packages on tag.

## Commands
- Install: `npm install`
- Build: `npm run build` (tsc → `dist/`)
- Test: `npm test` (vitest)

## Stack
TypeScript 5.9 (ESM) · axios · luxon. Multiple entry points — see `exports` in package.json.

## Capabilities
logger · storage · resource-state · JSON:API codec + client · i18n · date · errors ·
http · reactive · number.

## Conventions / Boundaries
- Commits: one-line conventional, ≤72 chars, no body/footer, no Co-Authored-By.
- NEVER edit `dist/` (generated). NEVER commit secrets/tokens. Don't add dependabot.
