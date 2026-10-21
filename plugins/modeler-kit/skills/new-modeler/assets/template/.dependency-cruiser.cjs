/**
 * The DOM boundary (P1) and the dependency direction of the modeler platform on the module graph,
 * next to the same rules in eslint.config.js: a violating import fails `npm run depcruise`.
 */
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'dom-free-no-diagram-js',
      comment: 'DOM-free packages must not import diagram-js / DOM libraries (P1).',
      severity: 'error',
      from: { path: '^packages/(schema-model|dsl)/src' },
      to: { path: 'node_modules/(diagram-js|tiny-svg|min-dom)' },
    },
    {
      name: 'dom-free-no-renderer',
      comment: 'DOM-free packages must not depend on the DOM-dependent renderer.',
      severity: 'error',
      from: { path: '^packages/(schema-model|dsl)/src' },
      to: { path: '^packages/renderer/src' },
    },
    {
      name: 'packages-no-shell',
      comment: 'Renderers and the DOM-free packages never import @miragon/modeler-shell.',
      severity: 'error',
      from: { path: '^packages/[^/]+/src' },
      // Also an unresolved specifier (the shell not installed next to the package) must fail.
      to: { path: '@miragon/modeler-shell' },
    },
    {
      name: 'dom-free-contract-types-only',
      comment: 'DOM-free packages take only types from @miragon/modeler-api, never runtime code.',
      severity: 'error',
      from: { path: '^packages/(schema-model|dsl)/src' },
      to: { path: '@miragon/modeler-api', dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'no-circular',
      comment: 'No circular dependencies.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
    },
  },
};
