# Licensing and credits

Olden Era Map Inspector is an independent fan-made tool. The project is shared without charge for community use. Its purpose is to help map makers inspect and edit maps, and it is not offered for sale or commercial gain.

The project maintainer claims no ownership of third-party code, documentation, game names, trademarks, maps, or assets referenced by this project. Rights in those materials remain with their respective owners. References acknowledge the work that informed development and do not imply endorsement. Third-party materials remain subject to their own terms.

This notice records attribution and the project's distribution intent. It does not grant a license to the project's own source code or impose new terms on third-party work.

## Research and development references

| Source | How it informed the project |
|---|---|
| [Scenario Script Editor by mimiasei](https://github.com/mimiasei/map-editor-json-tool) | Scenario JSON and publishing workflow reference. |
| [STDU fork](https://github.com/IgorIziyoAlhasov/map-editor-json-tool-stdu) | Map container framing, grid indexing, property handling, and Map Grid interaction reference. The [format notes](docs/map-format.md) link the specific revision and files. |
| [Olden Era RMG Editor](https://github.com/GendizerGaming/olden-era-rmg-editor) | Generator-template research reference. |
| [OldenEraExplorer](https://github.com/laszlo-gilanyi/OldenEraExplorer) | Game asset and entity metadata research reference. |
| [VS Code Custom Editor API](https://code.visualstudio.com/api/extension-guides/custom-editors) | Custom editor and webview architecture. |
| Heroes of Might and Magic III and Heroes of Might and Magic: Olden Era | Visual and interaction inspiration. Map structure and coordinate behavior were checked against local fixtures and editor observations. |

## Build dependencies

The [package manifest](package.json) and [lockfile](package-lock.json) identify the direct and transitive dependencies. The webview uses [React and React DOM](https://github.com/facebook/react). Development and packaging use [Vite](https://github.com/vitejs/vite), [Vitest](https://github.com/vitest-dev/vitest), and [VS Code Extension Manager](https://github.com/microsoft/vscode-vsce). Each dependency is governed by its upstream terms.
