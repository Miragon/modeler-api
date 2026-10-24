const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");

function readModelerBoundaries(modelerRoot) {
  const packageJson = JSON.parse(readFileSync(join(modelerRoot, "package.json"), "utf8"));
  const manifest = packageJson.modelerSuite;
  if (!Array.isArray(manifest?.domFreePackages) || manifest.domFreePackages.length === 0) {
    throw new Error(`${packageJson.name}: package.json needs "modelerSuite.domFreePackages".`);
  }
  const boundaries = {
    domFreePackages: manifest.domFreePackages,
    shellImportingPackages: manifest.shellImportingPackages ?? [],
  };
  for (const packageName of [...boundaries.domFreePackages, ...boundaries.shellImportingPackages]) {
    if (!existsSync(join(modelerRoot, "packages", packageName))) {
      throw new Error(
        `${packageJson.name}: "modelerSuite" names packages/${packageName}, which does not exist.`,
      );
    }
  }
  return boundaries;
}

module.exports = { readModelerBoundaries };
