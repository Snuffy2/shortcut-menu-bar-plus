# Change Log

All notable changes to the "Shortcut-Menu-Bar" extension will be documented in this file.

<!-- Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file. -->

## [3.2.1](https://github.com/Snuffy2/shortcut-menu-bar-plus/compare/v3.2.0...v3.2.1) (2026-10-02)


### Bug Fixes

* secure dependencies and unblock extension packaging ([#131](https://github.com/Snuffy2/shortcut-menu-bar-plus/issues/131)) ([1433c8f](https://github.com/Snuffy2/shortcut-menu-bar-plus/commit/1433c8fb95eb6265c8dea1dbf28eec90d54dfeff))


### Miscellaneous Chores

* integrate prek hooks and automated maintenance ([#125](https://github.com/Snuffy2/shortcut-menu-bar-plus/issues/125)) ([d63c9b8](https://github.com/Snuffy2/shortcut-menu-bar-plus/commit/d63c9b86ddfdce69cfb788336db6ef55c7df231e))


### Continuous Integration

* adopt release-please and lint PR titles ([#130](https://github.com/Snuffy2/shortcut-menu-bar-plus/issues/130)) ([0b90da6](https://github.com/Snuffy2/shortcut-menu-bar-plus/commit/0b90da618d1a89fd3d273064f4804cefdc302bf8))
* compile extension and run Jest on pull requests ([#129](https://github.com/Snuffy2/shortcut-menu-bar-plus/issues/129)) ([92da48e](https://github.com/Snuffy2/shortcut-menu-bar-plus/commit/92da48eec2102856422ae2eb404716b42bdaea5f))

## [3.0.3] - 2021-05-12

- fixed icons not showing properly
- added indent/outdent buttons
- added open settings button
- added Toggle word wrap button

## [3.0.1] - 2021-02-22

- [Much awaited feature] you can finally create user-defined buttons. See [README](https://github.com/Snuffy2/shortcut-menu-bar-plus#create-buttons-with-custom-commands) for instruction. Huge thanks to [@GitMensch](https://github.com/GitMensch) for this contribution.
- If there's a bug, please [report it on GitHub](https://github.com/Snuffy2/shortcut-menu-bar-plus/issues).

Please support this project. [Buy me a Coffee](https://ko-fi.com/gorvgoyl).

## [2.2.0] - 2021-01-11

- removed deprecated configs due to conflicts. if some icon is lost, please re-enable it from extension settings.

## [2.1.0] - 2021-01-11

- fixed non working config due to invalid conditions (thanks @YPetremann for PR)

## [2.0.0] - 2021-01-10

- Commands without namespace are deprecated. For example in `settings.json` instead of `"Quick Open": true` use `"ShortcutMenuBar.quickOpen": true`. (thanks @bbugl for PR)
- fixed navigate back and forward button alignment

## [1.5.0] - 2020-10-03

- added many more buttons like cut,copy,paste,debug etc

## [1.3.0]

- fixed bug for 'opened files' button
- added undo/redo buttons
- added Toggle line comment button
- added save all button
- Beautify/format document or selection with multiple formatters

## [1.2.0]

- added quick open/go to file.. Ctrl+P
- added Find/replace.. Ctrl+H
- improved README

## [1.0.1]

- added navigate back and forward buttons
- added switch header and source file button
- added toggle render whitespace button

## [1.0.0]

- user can now hide/show icons in settings
- added toggle terminal, activity bar

## 0.1.5

- Fixed issue to properly show "opened files"

## 0.1.2

- Initial Release
