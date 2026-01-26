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
- For each option, layers are matched by their structural index path, not just name, so "Header/Icon" stays aligned across variants.
- Standalone components are treated as a single group called "Component Layers."

## How to use (Figma)
1. Select a component set, a variant within a set, or an instance on the canvas.
2. Run: Plugins > Variant Layer Selector.
3. Expand a property group and pick a variant option.
4. Check the layers you want (use the option checkbox to select all).
5. Click Select Layers to highlight them on the canvas.

## Development
1. Figma: Plugins > Development > Import plugin from manifest.
2. Select `layer-selector/manifest.json`.
3. Run from Plugins > Development > Variant Layer Selector.
4. Edit `code.js` (main thread) or `ui.html` (UI).
5. Reload the plugin: Plugins > Development > Reload.

## Project structure
- `manifest.json` - Figma plugin manifest.
- `code.js` - Core selection and grouping logic.
- `ui.html` - UI rendering and interactions.
- `index.html` - Project landing page (not shipped in the plugin zip).
- `RELEASES.md` - Human-readable release history.

## Auto release (full guide)
This repo is set up for fully automated releases using GitHub Actions. A single commit to `main` can create a new tag, a GitHub Release, and a plugin zip asset.

### What the automation does
- Calculates the next version from commit messages since the last tag.
- Updates `RELEASES.md` with bullet points derived from commit subjects.
- Creates and pushes a `vX.Y.Z` tag.
- Packages the plugin zip based on `manifest.json`.
- Creates a GitHub Release and uploads the zip as an asset.

### Trigger rules
The workflow runs on **push to `main`**, but ignores commits that only change `RELEASES.md`.

**Commit prefix rules (case-sensitive):**
- `Breaking:` -> **major** bump (X.0.0)
- `Release:` or `Releases:` -> **minor** bump (0.X.0)
- `Fix:` -> **patch** bump (0.0.X)

If multiple commits exist since the last tag, the highest priority wins:
`Breaking` > `Release(s)` > `Fix`.

### Standard release flow (recommended)
1. Make your changes (touch any file other than only `RELEASES.md`).
2. Commit with a release prefix, for example:
   - `Release: add layer tree bulk select`
3. Push to `main`:
   - `git push`
4. GitHub Actions will:
   - calculate the next `vX.Y.Z` tag
   - update `RELEASES.md`
   - create the tag
   - create the GitHub Release + zip asset

### Release notes
- The automation extracts release notes from `RELEASES.md`.
- It looks for a section header that starts with the tag name, for example:
  - `## v2.4.0`
- All lines after that header (until the next `## ` header) become the release body.

**Tip:** If you include a date, keep the tag at the start of the header, e.g.:
- `## v2.4.0 - 2026-01-26`

If no matching section is found, the release body defaults to:
- The tag name
- `- Release created by CI`

### What goes into the release zip
The zip is built from `manifest.json` and includes only:
- `manifest.json`
- the `main` file from `manifest.json` (currently `code.js`)
- the `ui` file from `manifest.json` (currently `ui.html`)
- optional `assets/` folder (if present)

It does **not** include `README.md`, `RELEASES.md`, `index.html`, or `.github/`.

### How to adapt the automation
You can change behavior by editing `.github/workflows/releases-auto-version.yml`:
- **Prefixes**: change the `grep -E '^Breaking:'`, `'^Releases?:'`, `'^Fix:'` rules.
- **Versioning**: adjust the bump logic (`major`, `minor`, `patch`).
- **Release notes**: change how the header is matched in the `awk` block.
- **Zip contents**: change the packaging step to include or exclude files.
- **Branches**: update `on.push.branches` if you use a different default branch.

### Common issues and fixes
- **No release created**:
  - The commit subject did not start with `Breaking:`, `Release:`, `Releases:`, or `Fix:`.
  - The commit only changed `RELEASES.md` (ignored by the workflow).
  - The commit was not pushed to `main`.
- **Tag created but no release**:
  - The release notes header did not match `## vX.Y.Z`. Add a matching header.
  - Check the Actions run log for the release step.

### Manual release (fallback)
If you need to release manually:
1. Create and push a tag yourself:
   - `git tag -a v1.2.3 -m "Release v1.2.3"`
   - `git push origin v1.2.3`
2. The release workflow will package the zip and create the GitHub Release.

## Notes
- If nothing is selected, the plugin prompts you to select a component, variant, or instance.
- Instances resolve to their main component; containers resolve to the first component/instance inside.