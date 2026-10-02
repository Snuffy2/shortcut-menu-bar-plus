### Setup (one time)

Install dependencies with `npm install`, install [prek](https://prek.j178.dev/installation/)
(`brew install prek` on macOS), and run `prek install` to enable pre-commit hooks.
Run `prek run --all-files` for repository checks and `npm test` for the Jest suites.
GitHub Actions use prek-autoupdate to keep hooks current and prek-autofix to apply
automatic fixes to pull requests.

### Run & Debug

- Press `F5` to open a new window with your extension loaded.
- Set breakpoints in your code inside `src/extension.ts` to debug your extension.
- Find output from your extension in the debug console.

### Make changes

- You can relaunch the extension from the debug toolbar after changing code in `src/extension.ts`.
- You can also reload (`Ctrl+R` or `Cmd+R` on Mac) the VS Code window with your extension to load your changes.

### Adding new buttons

Button metadata lives in `src/buttonModel.ts`, and the graphical configurator writes `ShortcutMenuBarPlus.buttons`. Legacy per-button settings remain for compatibility, but new user-facing customization should go through the configurator.

When adding a built-in button:

1. Add its canonical entry to `BUILTIN_BUTTONS` in `src/buttonModel.ts`.

2. Add both icons i.e dark `#C5C5C5` and light `#424242` to `images/` folder. Set SVG dimensions: `width="16"`, `height="16"` and, `viewBox` (see existing icons to get idea). You can get free svg icons from flaticon.com

3. Add command behavior to `src/extension.ts`.

4. Inside `package.json`:

   1. add entry to `activationEvents`
   2. add an entry to `contributes.configuration` and set its `default` to `false`
   3. add your icons path under `contributes.commands`
   4. add an entry under `contributes.menus["editor/title"]`

5. Update tests for the default button model, legacy migration, and manifest ordering.

6. Test (`F5` to run in Debug mode). Make sure both icons (light, dark) are showing properly and command is working fine.

### Button configurator architecture

The 3.2.0 configurator rewrites the old scattered settings workflow around a structured model:

- `src/buttonModel.ts` owns the canonical built-in buttons, the 10 user button slots, model normalization, and legacy setting migration.
- `src/configuratorWebview.ts` renders `Shortcut Menu Bar Plus: Configure Buttons`, including enable/disable toggles, drag-and-drop ordering, user-button command fields, label fields, and the searchable Codicon picker.
- `src/manifestUpdater.ts` applies ordered `editor/title` menu contributions from the model while preserving unrelated package manifest content and legacy visibility predicates when legacy mode is active.
- `src/iconGenerator.ts` copies selected Codicon SVGs into `images/userButtonXX.svg` and `images/userButtonXX_light.svg`.
- `src/packageUpdater.ts` updates user-button command titles in the installed extension manifest with an atomic temp-file rename.

`ShortcutMenuBarPlus.buttons` is stored globally because order, visibility, titles, and generated icons are applied to installed extension files rather than to a single workspace. If the structured setting does not exist, the extension still reads legacy button visibility, command, name, and icon settings so existing installs keep working.

Changes to command strings can run without a reload. Changes to toolbar order, visibility, user-button labels, or user-button icons require a VS Code reload because VS Code reads contributed editor title menu metadata during window load. The configurator reports this by enabling its `Reload Window` buttons after a successful save.

### Testing configurator changes

Use the existing Node toolchain:

- `npm test` for the Jest suites.
- `npm run compile` for TypeScript validation.
- `npm run lint` for lint validation.

For configurator or manifest work, update the focused tests in `tests/buttonModel.test.ts`, `tests/configuratorWebview.test.ts`, `tests/manifestUpdater.test.ts`, `tests/iconGenerator.test.ts`, `tests/packageUpdater.test.ts`, and `tests/extensionConfigurator.test.ts` as appropriate.

### Explore the API

https://code.visualstudio.com/api/references/contribution-points#Command-icon-specifications
https://code.visualstudio.com/docs/getstarted/keybindings
https://code.visualstudio.com/docs/extensionAPI/vscode-api
https://code.visualstudio.com/api/references/contribution-points#contributes.menus
https://code.visualstudio.com/updates/v1_42#_workbench
https://code.visualstudio.com/api/references/extension-manifest

- You can open the full set of our API when you open the file `node_modules/vscode/vscode.d.ts`.

## Development Notes

- The Codicon enum in `package.json` is duplicated across every `ShortcutMenuBarPlus.userButtonXXIcon` setting. Keep those enum lists in sync whenever adding or removing supported Codicons.

PR titles must use a Conventional Commit prefix, such as `feat: add a button`,
`fix: restore an icon`, or `ci: update a workflow`. The PR title lint enforces this requirement.
