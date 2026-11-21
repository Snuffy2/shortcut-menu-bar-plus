# Change Log

All notable changes to the "Shortcut-Menu-Bar" extension will be documented in this file.

<!-- Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file. -->

## [3.2.1](https://github.com/Snuffy2/shortcut-menu-bar-plus/compare/v3.2.0...v3.2.1) (2026-11-21)


### Bug Fixes

* align @types/vscode with engine and patch audit findings ([#145](https://github.com/Snuffy2/shortcut-menu-bar-plus/issues/145)) ([bebcb44](https://github.com/Snuffy2/shortcut-menu-bar-plus/commit/bebcb447b5a02b0a86295029c14d43fb117fdd5b))
* secure dependencies and unblock extension packaging ([#131](https://github.com/Snuffy2/shortcut-menu-bar-plus/issues/131)) ([1433c8f](https://github.com/Snuffy2/shortcut-menu-bar-plus/commit/1433c8fb95eb6265c8dea1dbf28eec90d54dfeff))


### Dependencies

* Bump @azure/msal-node and @azure/identity ([#140](https://github.com/Snuffy2/shortcut-menu-bar-plus/issues/140)) ([c4a6794](https://github.com/Snuffy2/shortcut-menu-bar-plus/commit/c4a67944a42cef47c502446dd23b353660c001d0))
* Bump handlebars from 4.7.9 to 4.7.10 ([#134](https://github.com/Snuffy2/shortcut-menu-bar-plus/issues/134)) ([3278f59](https://github.com/Snuffy2/shortcut-menu-bar-plus/commit/3278f599cc0ecccde81bd3aa52af2c3b749094ad))
* Bump qs from 6.16.0 to 6.17.1 ([#139](https://github.com/Snuffy2/shortcut-menu-bar-plus/issues/139)) ([682ecb4](https://github.com/Snuffy2/shortcut-menu-bar-plus/commit/682ecb464407f574f2804ad17e3a596d012b8e6b))
* Bump the development-dependencies group across 1 directory with 5 updates ([#143](https://github.com/Snuffy2/shortcut-menu-bar-plus/issues/143)) ([b08ffe9](https://github.com/Snuffy2/shortcut-menu-bar-plus/commit/b08ffe9ba623f4c86d2fc9b0ed4ad0134b837cd1))
* Bump the development-dependencies group across 1 directory with 7 updates ([#138](https://github.com/Snuffy2/shortcut-menu-bar-plus/issues/138)) ([5f2dd2b](https://github.com/Snuffy2/shortcut-menu-bar-plus/commit/5f2dd2bb41ab55496fc440ab0763823e9887037b))
* Bump the development-dependencies group with 4 updates ([#133](https://github.com/Snuffy2/shortcut-menu-bar-plus/issues/133)) ([e652069](https://github.com/Snuffy2/shortcut-menu-bar-plus/commit/e652069dd388abb6a79d793554f76bc8e00b95bc))
* Bump the development-dependencies group with 5 updates ([#141](https://github.com/Snuffy2/shortcut-menu-bar-plus/issues/141)) ([dd34826](https://github.com/Snuffy2/shortcut-menu-bar-plus/commit/dd34826d5c25648512c648e242fe65518fb65656))
* Override minimatch to &gt;=11.0.1 (GHSA-g3hv-75wg-m249) ([#144](https://github.com/Snuffy2/shortcut-menu-bar-plus/issues/144)) ([978b345](https://github.com/Snuffy2/shortcut-menu-bar-plus/commit/978b345f4ad0cbbfb800d6baf56e97b32e08836c))


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
