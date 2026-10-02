# AGENTS

## Project Summary

- Project: `Shortcut Menu Bar Plus`
- Type: VS Code extension
- Language: TypeScript
- Runtime: Node.js inside the VS Code extension host
- Purpose: add built-in and user-defined editor menu bar buttons, plus hotkey-triggerable user buttons

## Repository Layout

- `src/extension.ts`: extension activation, command registration, user button execution flow, startup reapplication of custom icon/name settings, reload prompt handling
- `src/iconGenerator.ts`: copies a codicon SVG into generated `images/userButtonXX*.svg` assets with theme-specific fill colors
- `src/packageUpdater.ts`: rewrites `package.json` command titles for user button display names
- `tests/`: Jest coverage for the helper modules
- `images/`: packaged extension icons, including generated user button SVG targets
- `CONTRIBUTE.md`: contributor-oriented instructions for adding buttons
- `README.md`: marketplace-facing documentation
- `.github/release.yml`: release note filtering configuration
- `.vscodeignore`: packaging allow/deny list for `vsce`

## Current Tooling

Use the repo's existing Node-based tooling unless the user explicitly asks to change it.

- Install dependencies: `npm install`
- Compile: `npm run compile`
- Watch: `npm run watch`
- Test: `npm test`
- CI tests: `npm test -- --ci --coverage`
- Repository checks: `prek run --all-files`
- Test watch: `npm run test:watch`
- Lint: `npm run lint`
- Build package: `npm run package`
- Publish: `npm run publish`

## Workflow Expectations

- Do not create branches, tags, releases, or PRs unless explicitly asked.
- All PR titles must use a Conventional Commit prefix: `build:`, `chore:`, `ci:`, `deps:`, `docs:`, `feat:`, `fix:`, `perf:`, `refactor:`, `revert:`, `style:`, or `test:`. Optional scopes and breaking-change markers are supported, for example `feat(configurator): add a button` or `fix!: remove a legacy command`.
- Prefer root-cause fixes over narrow patches.
- Add or update tests for behavior changes.
- Update docs when user-visible behavior, setup, or contributor workflow changes.
- Before committing or pushing changes, run `prek run --all-files`, `npm run compile`, `npm test -- --ci --coverage`, and `npm run lint`. Report what passed and any checks that could not run.

## Technology-Specific Overrides

This is a Node/TypeScript extension repository.

- Use the existing npm/Jest/TypeScript toolchain.

## VS Code Extension Conventions

- Preserve compatibility with the declared VS Code engine in `package.json`.
- Keep `package.json` contributions, registered commands, and implementation code in sync.
- Prefer small, explicit extension-host logic; avoid unnecessary abstractions in `src/extension.ts` unless complexity justifies it.
- When adding commands, verify command IDs, titles, icons, menus, configuration, and activation behavior all line up.

## Button Implementation Rules

When adding or changing a built-in button:

- Update `package.json` configuration and command contributions as needed.
- Register the command in `src/extension.ts`.
- If it is a simple pass-through command, add it to the `commandArray`.
- If it needs editor state or special handling, register it as a separate command like `beautify`, `formatWith`, or `openFilesList`.
- Update `README.md` and `CONTRIBUTE.md` if contributor or user-facing behavior changes.
- Add or update tests if logic moves into helper modules.

## User Button Rules

The extension currently supports 10 user buttons: `userButton01` through `userButton10`.

- Command strings are read from `ShortcutMenuBarPlus.userButtonXXCommand`.
- A config value may contain comma-separated commands to run sequentially.
- Individual commands may contain pipe-delimited arguments.
- Empty or whitespace-only user button commands should be treated as disabled.
- Startup behavior re-applies saved custom icon and name settings from workspace configuration.

When touching user button behavior:

- Preserve the `01`-`10` zero-padded indexing convention.
- Keep `button 10` behavior aligned with the existing title convention of `user action 0`.
- Do not break startup restoration of custom icons and names.
- Be careful with `package.json` mutation logic because this extension intentionally rewrites its installed manifest at runtime to update command titles.

## Generated Asset Rules

`src/iconGenerator.ts` writes these generated files:

- `images/userButtonXX.svg`
- `images/userButtonXX_light.svg`

When editing icon-generation behavior:

- Preserve dark/light output generation unless the user explicitly requests a format change.
- Keep graceful handling for missing codicons.
- Preserve detailed logging for read/write failures.
- Validate that generated asset paths remain package-relative and are included by the extension package.

## `package.json` Mutation Rules

`src/packageUpdater.ts` rewrites the installed extension `package.json` using a temp file plus rename.

- Keep writes atomic.
- Log enough context to debug failures, including command identity.
- Do not silently change unrelated manifest content.
- Preserve two-space JSON indentation and trailing newline.

## Packaging Constraints

The extension package excludes source and test material through `.vscodeignore`.

- Anything required at runtime must exist outside excluded paths, or be emitted into included output.
- Changes under `src/` are not packaged directly; they must compile into `out/`.
- Be careful when introducing runtime assets, docs, or config files. Confirm `.vscodeignore` does not accidentally exclude them.

## Testing Expectations

- For logic changes in `src/iconGenerator.ts` or `src/packageUpdater.ts`, update Jest coverage in `tests/`.
- Prefer focused unit tests around parsing, file-path generation, and failure handling.
- If changing activation flow in `src/extension.ts`, add tests if practical; otherwise explain the validation gap and cover with manual reasoning.
- Run the full prek and CI checks listed under Workflow Expectations before committing or pushing.

## Documentation Expectations

Update these files when applicable:

- `README.md`: user-visible features, settings, marketplace-facing guidance
- `CONTRIBUTE.md`: contributor steps, especially for adding buttons or extending the manifest/menus

## Existing Known Facts

- The repo currently uses Jest tests in `tests/`, not `pytest`.
- `package.json` currently exposes 41 commands and 61 configuration properties.
- Release notes exclude changes labeled `ignore-for-release` and `dependencies`.
- `.worktrees/` and `*.vsix` are gitignored.

## Practical Editing Guidance

- Search with `rg` before changing command IDs or config keys.
- Check for corresponding README/CONTRIBUTE text whenever you touch `package.json` contributions.
- Avoid reformatting large JSON or TypeScript sections unless needed for the task.
- Do not revert unrelated dirty-worktree changes.
