#!/usr/bin/env bash
# Guards release-please's bootstrap-sha, which keeps the modelers' imported history out of the
# suite's changelogs: release-please collects commits back to it for as long as one component has
# no release in this repository yet. It has to be on the branch, or release-please walks back
# through the whole imported history. And a releasable commit to a component that has a release
# but that the bootstrap commit does not precede (one merged to main beside the migration) may be
# walked past and never reach a changelog. Needs the full history and the tags.
set -euo pipefail

config=release-please-config.json
manifest=.release-please-manifest.json
bootstrap=$(jq -r '."bootstrap-sha" // empty' "$config")
if [[ -z "$bootstrap" ]]; then
  echo "No bootstrap-sha: release-please starts at each component's latest release."
  exit 0
fi
if ! git merge-base --is-ancestor "$bootstrap" HEAD 2> /dev/null; then
  echo "::error file=$config::bootstrap-sha $bootstrap is not a commit of this branch, so release-please would collect the imported history into the changelogs. Point it at a commit on main after the migration, or remove it once every component has released."
  exit 1
fi

descendants=$(mktemp)
git rev-list --ancestry-path "$bootstrap..HEAD" > "$descendants"
releasable='^(feat|fix|perf|revert|deps)(\([^)]*\))?!?: '
failed=0
while IFS=$'\t' read -r path component; do
  version=$(jq -r --arg path "$path" '.[$path]' "$manifest")
  tag="$component-v$version"
  # A component without a release here starts at the bootstrap commit anyway.
  git rev-parse -q --verify "refs/tags/$tag" > /dev/null || continue
  while IFS=$'\t' read -r sha subject; do
    [[ "$subject" =~ $releasable ]] || continue
    grep -qx "$sha" "$descendants" && continue
    echo "::error file=$config::$sha \"$subject\" changed $path after $tag, but the bootstrap commit $bootstrap does not precede it, so release-please may never list it. Release $component first (merge its release pull request), then land the migration."
    failed=1
  done < <(git log --format=$'%H\t%s' "$tag..HEAD" -- "$path")
done < <(jq -r '.packages | to_entries[] | "\(.key)\t\(.value.component)"' "$config")

if [[ "$failed" -eq 0 ]]; then
  echo "bootstrap-sha $bootstrap is on this branch and precedes every unreleased releasable commit."
fi
exit "$failed"
