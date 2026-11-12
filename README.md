# Olden Era Map Inspector

A read-only VS Code editor for Heroes of Might & Magic: Olden Era maps.
Inspect searchable placements, object details, scenario settings, and a 2D surface preview. VS Code 1.100 or newer is required.

## First public release · v0.6.5

[Download the installable VSIX](https://github.com/IgorIziyoAlhasov/olden-era-map-vs-code-inspector/raw/main/downloads/olden-era-map-inspector-0.6.5.vsix).

The inspector includes five layouts, map rulers and themed map cursors, cross-page
selection and comparison, bulk removal, and staged placement edits for map format
0.82.08. Save edited copy writes to a new file.

## Install and open a map

1. In the VS Code Command Palette, choose **Extensions: Install from VSIX...**
   and select the included VSIX.
2. Right-click a map in Explorer and select **Open Olden Era Map**. You can
   also run that command from the Command Palette and choose a file.
3. To switch editors, use **Reopen Editor With... → Olden Era Map Inspector**.

## Layouts and selection

Use the **Layout** dropdown to switch between Adventure Atlas, Cartographer’s Table,
Guild Ledger, Arcane Workbench, and Wayfarer’s Archive. The extension remembers your
choice. In narrow editor groups, use **2D preview** to switch between the list and map.

Click a row to inspect it. Ctrl+click (Cmd+click on macOS) or use the checkboxes
to toggle individual selections. Compare two to four objects with the same type SID.
Category filtering and map glyphs use recognizable SIDs, with unmatched types under
Other. On dense or zoomed-out views the map uses compact markers.

## 2D preview

Open **Objects → 2D preview**. Drag or use the arrow keys to pan, use the
toolbar to zoom or fit, and click a marked tile to inspect its placement.
Click a tile again to cycle through overlapping placements. Search and type
filters apply to the full surface preview. Switching between the list and
preview preserves the current selection. X increases rightward and Z upward.

## Development

Use Node.js 24 LTS. Open this project folder in VS Code, run `npm ci`, then
press F5 to launch the Extension Development Host. Run `npm run package`
to rebuild the VSIX.

```powershell
node .\src\inspect.js "C:\Maps\Dia.Rush.RS.map" 2688
$env:OLDEN_ERA_FIXTURES = 'C:\Maps'
npm test
```

The fixture tests use the exact Phase 0 files. They skip when the environment
variable is unset. Source documentation is in the docs folder.

Set `OLDEN_ERA_PREVIEW_FIXTURES` to the folder containing `empty.96x64(1).map` to run the editor-coordinate regression.

## Licensing and credits

See [Licensing and credits](LICENSE-NOTICE.md) for project intent and upstream references, and [AGENTS.md](AGENTS.md) for contributor guidance.
