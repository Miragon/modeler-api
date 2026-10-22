// @vitest-environment node
/// <reference types="node" />
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import semver from "semver";
import { describe, expect, it } from "vitest";

interface Manifest {
  name: string;
  version: string;
  workspaces?: string[];
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

interface Workspace {
  path: string;
  manifest: Manifest;
}

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));

function readManifest(manifestPath: string): Manifest {
  return JSON.parse(readFileSync(manifestPath, "utf8")) as Manifest;
}

const workspaces: Workspace[] = (
  readManifest(join(repositoryRoot, "package.json")).workspaces ?? []
).map((path) => ({ path, manifest: readManifest(join(repositoryRoot, path, "package.json")) }));

const publishers = workspaces.filter((workspace) => workspace.manifest.peerDependencies);

function peersOf(workspace: Workspace): [name: string, range: string][] {
  return Object.entries(workspace.manifest.peerDependencies ?? {});
}

function isExactVersionInside(version: string | undefined, range: string): boolean {
  return (
    version !== undefined && semver.valid(version) !== null && semver.satisfies(version, range)
  );
}

function installedManifest(packageName: string, fromWorkspace: Workspace): Manifest {
  let directory = join(repositoryRoot, fromWorkspace.path);
  for (;;) {
    const candidate = join(directory, "node_modules", packageName, "package.json");
    if (existsSync(candidate)) return readManifest(candidate);
    const parent = dirname(directory);
    if (parent === directory) throw new Error(`${packageName} is not installed`);
    directory = parent;
  }
}

/**
 * A consumer's npm checks the published peer ranges, while this repository builds and tests
 * against the mirroring devDependencies and ships the apps' pins. A range that excludes them
 * publishes a package that a host pinning the same versions cannot install (ERESOLVE), and the
 * `pin-check` job ignores `peerDependencies`, so nothing else would notice.
 */
describe("peer dependency ranges", () => {
  it("are read from the packages that publish them", () => {
    expect(publishers.map((workspace) => workspace.manifest.name)).toEqual(
      expect.arrayContaining([
        "@miragon/context-maps-schema-model",
        "@miragon/context-maps-renderer",
      ]),
    );
  });

  it("admit the exact devDependency that mirrors each peer", () => {
    const violations = publishers.flatMap((workspace) =>
      peersOf(workspace)
        .filter(
          ([name, range]) =>
            !isExactVersionInside(workspace.manifest.devDependencies?.[name], range),
        )
        .map(
          ([name, range]) =>
            `${workspace.path}: peer ${name}@"${range}", ` +
            `devDependency ${workspace.manifest.devDependencies?.[name] ?? "(none)"}`,
        ),
    );
    expect(violations).toEqual([]);
  });

  it("admit the version each workspace that depends on the package pins", () => {
    const violations = workspaces.flatMap((consumer) => {
      const pinned = { ...consumer.manifest.devDependencies, ...consumer.manifest.dependencies };
      return publishers
        .filter((publisher) => pinned[publisher.manifest.name] !== undefined)
        .flatMap((publisher) =>
          peersOf(publisher)
            .filter(([name]) => pinned[name] !== undefined)
            .filter(([name, range]) => !isExactVersionInside(pinned[name], range))
            .map(
              ([name, range]) =>
                `${consumer.path}: pins ${name} ${pinned[name]}, ` +
                `outside the peer ${name}@"${range}" of ${publisher.manifest.name}`,
            ),
        );
    });
    expect(violations).toEqual([]);
  });

  it("admit what the other peers require, so a host can pin one version that both accept", () => {
    const violations = publishers.flatMap((workspace) =>
      peersOf(workspace).flatMap(([requiringPeer]) => {
        const requiringManifest = installedManifest(requiringPeer, workspace);
        const required = {
          ...requiringManifest.peerDependencies,
          ...requiringManifest.dependencies,
        };
        return peersOf(workspace)
          .filter(([name]) => required[name] !== undefined)
          .filter(([name, range]) => !semver.intersects(required[name]!, range))
          .map(
            ([name, range]) =>
              `${workspace.path}: peer ${name}@"${range}" excludes ${name}@"${required[name]}", ` +
              `which ${requiringPeer} ${requiringManifest.version} requires`,
          );
      }),
    );
    expect(violations).toEqual([]);
  });
});
