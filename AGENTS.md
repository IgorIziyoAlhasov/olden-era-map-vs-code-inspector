# Agent and contributor guide

Olden Era Map Inspector is a VS Code custom editor for inspecting and editing Heroes of Might and Magic: Olden Era maps. The extension host lives in `src/extension.cjs`, parsing and map writes run in `src/map-worker.js`, and the React webview lives in `webview/`.

- Use Node.js 24 LTS. Run `npm ci`, `npm test`, and `npm run package`.
- Run the fixture suites with `OLDEN_ERA_FIXTURES`, `OLDEN_ERA_PREVIEW_FIXTURES`, and `OLDEN_ERA_EDIT_FIXTURES` pointing to the appropriate local map fixtures. Report skipped tests separately. See [QA notes](docs/qa.md).
- Keep original maps untouched. Stage edits in memory and write a new copy only on explicit save. Preserve unknown fields, section bytes, placement identity, and linked property records.
- Keep all five layouts on the same editor state. Scope map cursors to the map canvas and retain keyboard access to controls.
- Document format findings with reproducible evidence. Keep private fixtures, game assets, and credentials out of commits. Record upstream references and applicable notices when adding third-party material.

See [architecture](docs/architecture.md), [map format notes](docs/map-format.md), and [licensing and credits](LICENSE-NOTICE.md).
