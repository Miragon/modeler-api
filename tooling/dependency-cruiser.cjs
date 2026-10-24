const { readModelerBoundaries } = require("./modeler-boundaries.cjs");

function modelerDependencyCruiserConfig(modelerRoot, modelerRules = {}) {
  const { domFreePackages, shellImportingPackages } = readModelerBoundaries(modelerRoot);
  const domFreeSources = `^packages/(${domFreePackages.join("|")})/src`;
  const exceptShellImportingPackages =
    shellImportingPackages.length > 0
      ? { pathNot: `^packages/(${shellImportingPackages.join("|")})/` }
      : {};

  return {
    forbidden: [
      {
        name: "dom-free-no-diagram-js",
        comment: "DOM-free packages must not import diagram-js / DOM libraries (P1).",
        severity: "error",
        from: { path: domFreeSources },
        to: { path: "node_modules/(diagram-js|tiny-svg|min-dom)" },
      },
      {
        name: "dom-free-no-renderer",
        comment: "DOM-free packages must not depend on the DOM-dependent renderer.",
        severity: "error",
        from: { path: domFreeSources },
        to: { path: "^packages/renderer/src" },
      },
      {
        name: "packages-no-shell",
        comment:
          "No published package imports @miragon/modeler-shell; only the apps mount the shell " +
          "(dependency direction of Miragon/modeler-suite#4).",
        severity: "error",
        from: { path: "^packages/[^/]+/src", ...exceptShellImportingPackages },
        to: { path: "@miragon/modeler-shell" },
      },
      {
        name: "dom-free-contract-types-only",
        comment: "DOM-free packages take only types from @miragon/modeler-api, never runtime code.",
        severity: "error",
        from: { path: domFreeSources },
        to: { path: "@miragon/modeler-api", dependencyTypesNot: ["type-only"] },
      },
      {
        name: "no-circular",
        comment: "No circular dependencies.",
        severity: "error",
        from: {},
        to: { circular: true },
      },
      ...(modelerRules.forbidden ?? []),
    ],
    options: {
      doNotFollow: { path: "node_modules" },
      preserveSymlinks: true,
      tsConfig: { fileName: "tsconfig.json" },
      tsPreCompilationDeps: true,
      enhancedResolveOptions: {
        exportsFields: ["exports"],
        conditionNames: ["import", "require", "node", "default", "types"],
      },
    },
  };
}

module.exports = { modelerDependencyCruiserConfig };
