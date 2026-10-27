# Testing MapCtrl

## Automated checks

From the repository root, with Node.js 20 or later:

```sh
npm run check
```

There are no npm dependencies to install. This rebuilds the vendored geometry and standalone panel, then exercises geometry and host logic. GitHub Actions also verifies that generated files match their sources.

Automated host mocks cannot prove ScriptUI rendering or After Effects expression evaluation. The initial release has not been run in After Effects; the available workstation contains a residual AE folder but no executable. Complete the checks below on the AE version you intend to use.

## After Effects smoke script

1. Download or clone the entire repository, retaining the folder structure.
2. In AE, choose **File > Scripts > Run Script File** and run `tests/smoke-ae.jsx`.
3. The script adds a new 12-second composition to the current project and checks map construction, duplicate prevention, state fill keyframes, pins, route reveal, and expressions after renaming/reordering a pin. It does not replace your current project.
4. Keep the resulting test composition open for visual checks. Delete it yourself when finished.

## Panel and animation checklist

- Install `dist/MapCtrl.jsx`, restart AE, and open **Window > MapCtrl**. Also test the floating panel via Run Script File.
- Resize and dock the panel. Check that every action icon is visible, usable, and has a hover description.
- Create a map in an empty project, an existing composition, and a portrait composition. Check all states, Alaska/Hawaii insets, and DC. A second create action must reuse the map.
- Pick states by map and by the searchable list. Check tiny states and multi-selection. Apply a static fill, then animate to another fill with duration and stagger. Scrub before, during, and after the animation.
- Confirm individual state position, scale, opacity, and native fill properties remain editable in the timeline.
- Click a location in Pins, add a labeled pin, and animate it in. Move the pin in the Composition panel and confirm its label follows.
- In Routes, add at least three waypoints. Mix map points with pin-linked points, reorder the list, then create a dashed route. Check reveal timing, dash/gap, width, and dash flow.
- Rename, reorder, move, and keyframe a linked pin. Confirm the route follows it. Transform the map controller and confirm all artwork moves together.
- Delete a linked pin. The route should use its stored fallback point without an expression error.
- Try an empty selection, malformed hex color, negative duration, out-of-bounds waypoint, and an animation that runs past the composition end. Check for a clear error and no partial edits.
- Undo each action once and verify it is grouped. Switch compositions, refresh the panel, and check that actions target the active composition.
- Save/reopen the project, close the panel, and check that native layers and animations still work.

Record the AE version, OS, failures, and a minimal reproduction when reporting an issue.
