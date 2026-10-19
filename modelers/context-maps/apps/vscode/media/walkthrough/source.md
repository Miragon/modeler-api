# Open the source to the side

The `.cm` file is the map. **Open Source to the Side** (the file icon in the editor title of a
diagram) opens its JSON next to the canvas; **Open Diagram to the Side** does the reverse from the
text editor.

Edit either one and the other follows:

- A change on the canvas is one edit of the file, so `Cmd/Ctrl+Z` undoes it in VS Code's history.
- A change in the text redraws the canvas and keeps its view and selection.
- While the text is not a valid map, the canvas shows the last valid version and is read-only; the
  Problems view shows what to fix, and the semantic rules of strategic DDD appear there too.
