const { modelerDependencyCruiserConfig } = require("../../tooling/dependency-cruiser.cjs");

module.exports = modelerDependencyCruiserConfig(__dirname, {
  forbidden: [
    {
      name: "libraries-no-ui",
      comment: "schema-model and renderer stay React-free: they must not depend on the ui package.",
      severity: "error",
      from: { path: "^packages/(schema-model|renderer)/" },
      to: { path: "^packages/ui/" },
    },
    {
      name: "ui-no-apps",
      comment: "The shared ui package is host-agnostic: it must not import from an app.",
      severity: "error",
      from: { path: "^packages/ui/" },
      to: { path: "^apps/" },
    },
  ],
});
