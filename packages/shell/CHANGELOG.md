# Changelog

## [0.5.0](https://github.com/Miragon/modeler-api/compare/modeler-shell-v0.4.1...modeler-shell-v0.5.0) (2026-10-23)


### Features

* **shell:** start the legend closed in every container ([#79](https://github.com/Miragon/modeler-api/issues/79)) ([1542838](https://github.com/Miragon/modeler-api/commit/1542838111f604f22ce654e5940601839f3aec14))

## [0.4.1](https://github.com/Miragon/modeler-api/compare/modeler-shell-v0.4.0...modeler-shell-v0.4.1) (2026-10-23)


### Bug Fixes

* **shell:** retry a theme switch VS Code did not pick up in the VS Code driver ([2376d54](https://github.com/Miragon/modeler-api/commit/2376d54bb1d7cbebcc183cc69f111cf906233aa7))
* **shell:** set extensions.autoUpdate to "off" so VS Code does not rewrite the driver's settings ([2376d54](https://github.com/Miragon/modeler-api/commit/2376d54bb1d7cbebcc183cc69f111cf906233aa7))

## [0.4.0](https://github.com/Miragon/modeler-api/compare/modeler-shell-v0.3.3...modeler-shell-v0.4.0) (2026-10-23)


### Features

* report the content bounds a host fits to (contract 1.3) and fit to them in connectDiagramJs ([#62](https://github.com/Miragon/modeler-api/issues/62)) ([3ebb72b](https://github.com/Miragon/modeler-api/commit/3ebb72bca0b39ca4a5ace3410e6c9d6b9f83bbd4))
* **shell:** check that the shell's fit, zoom and refit never commit an open label editor ([#64](https://github.com/Miragon/modeler-api/issues/64)) ([eee7840](https://github.com/Miragon/modeler-api/commit/eee7840dc7decfebcac4bbd8d163cdbfcf646dd2))
* **shell:** start the legend closed up to 440px wide and tighten the kit to the settled guide readings ([#68](https://github.com/Miragon/modeler-api/issues/68)) ([16baa0a](https://github.com/Miragon/modeler-api/commit/16baa0a9b667349d89e2b526fc42481a81c854ef))


### Bug Fixes

* **shell:** keep the menu's shortcut chip out of the item's accessible name ([#63](https://github.com/Miragon/modeler-api/issues/63)) ([22517d5](https://github.com/Miragon/modeler-api/commit/22517d5ba8151f3b28eebd122b18f0289586cf49))

## [0.3.3](https://github.com/Miragon/modeler-api/compare/modeler-shell-v0.3.2...modeler-shell-v0.3.3) (2026-10-22)


### Bug Fixes

* **shell:** let concurrent VS Code smoke runs share the download cache ([#53](https://github.com/Miragon/modeler-api/issues/53)) ([f932060](https://github.com/Miragon/modeler-api/commit/f932060bc3368eef5d6f9eca24a6b77feb63e7d8))

## [0.3.2](https://github.com/Miragon/modeler-api/compare/modeler-shell-v0.3.1...modeler-shell-v0.3.2) (2026-10-22)


### Bug Fixes

* **shell:** empty the Docker results folder in place instead of replacing it ([#32](https://github.com/Miragon/modeler-api/issues/32)) ([c1e93d0](https://github.com/Miragon/modeler-api/commit/c1e93d01719c7792eff8f9401937278bed4b3648))

## [0.3.1](https://github.com/Miragon/modeler-api/compare/modeler-shell-v0.3.0...modeler-shell-v0.3.1) (2026-10-21)


### Bug Fixes

* **shell:** wait for a complete save and run the VS Code smoke test in Docker ([#29](https://github.com/Miragon/modeler-api/issues/29)) ([41163fc](https://github.com/Miragon/modeler-api/commit/41163fc85e18d622e4d1af7d9e84115c759870d9))

## [0.3.0](https://github.com/Miragon/modeler-api/compare/modeler-shell-v0.2.2...modeler-shell-v0.3.0) (2026-10-21)


### Features

* **shell:** smoke-test a modeler's extension in a real VS Code ([f81428b](https://github.com/Miragon/modeler-api/commit/f81428bb55a7e7c18d0ba47bc2b1b348fc1c2cff))

## [0.2.2](https://github.com/Miragon/modeler-api/compare/modeler-shell-v0.2.1...modeler-shell-v0.2.2) (2026-10-21)


### Bug Fixes

* **shell:** hand the keyboard focus to the canvas after a pointer click on chrome ([#22](https://github.com/Miragon/modeler-api/issues/22)) ([7874575](https://github.com/Miragon/modeler-api/commit/7874575e0196a898e6a1b1650483b0f4c52bd615))

## [0.2.1](https://github.com/Miragon/modeler-api/compare/modeler-shell-v0.2.0...modeler-shell-v0.2.1) (2026-10-19)


### Bug Fixes

* **shell:** place a tooltip again when it grows after it is shown ([#17](https://github.com/Miragon/modeler-api/issues/17)) ([f0149e4](https://github.com/Miragon/modeler-api/commit/f0149e468b0c7aab786b081ff15c50aee082e55b))

## [0.2.0](https://github.com/Miragon/modeler-api/compare/modeler-shell-v0.1.0...modeler-shell-v0.2.0) (2026-10-19)


### Features

* **shell:** render the web-app chrome on the web host (0.2) ([#11](https://github.com/Miragon/modeler-api/issues/11)) ([e08d63a](https://github.com/Miragon/modeler-api/commit/e08d63a2c7720768622ae75c2735e62fd6c508b0))

## 0.1.0 (2026-10-19)


### Features

* **shell:** add @miragon/modeler-shell 0.1, the shared chrome around Miragon diagram-js modelers ([#8](https://github.com/Miragon/modeler-api/issues/8)) ([fde99a8](https://github.com/Miragon/modeler-api/commit/fde99a8a4ba29d66c3cf570d21ba8f0e93c02618))
