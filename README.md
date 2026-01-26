# Variant Layer Selector

Select matching layers across variants and components without hunting the layer tree. The plugin reads your selection, builds a grouped layer tree per variant option, and lets you select equivalent layers across variants with a single click.

## Features
- Works with component sets (variants) and standalone components.
- Accepts instances, frames, groups, and sections by resolving to a component.
- Matches layers by structural position to keep equivalent layers aligned across variants.
- Hierarchical tree view with per-option bulk select.
- Selects and zooms to layers on the canvas.
- Live updates when the selection changes.

## How it works
- When you select a component set, the plugin groups layers by variant property (e.g., State, Size) and option values.
- For each option, layers are matched by their structural index path, not just name, so “Header/Icon” stays aligned across variants.
- Standalone components are treated as a single group called “Component Layers.”

## How to use
1. Select a component set, a variant within a set, or an instance on the canvas.
2. Run: Plugins > Variant Layer Selector.
3. Expand a property group and pick a variant option.
4. Check the layers you want (use the option checkbox to select all).
5. Click Select Layers to highlight them on the canvas.

## Start development
1. Figma: Plugins > Development > Import plugin from manifest.
2. Select `layer-selector/manifest.json`.
3. Run from Plugins > Development > Variant Layer Selector.
4. Edit `code.js` (main thread) or `ui.html` (UI).
5. Reload the plugin: Plugins > Development > Reload.

## Project structure
- `manifest.json` - Figma plugin manifest.
- `code.js` - Core selection + grouping logic.
- `ui.html` - UI rendering and interactions.

## Notes
- If nothing is selected, the plugin prompts you to select a component, variant, or instance.
- Instances resolve to their main component; containers resolve to the first component/instance inside.
