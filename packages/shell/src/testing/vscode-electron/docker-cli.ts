#!/usr/bin/env node
// The `modeler-shell-vscode-docker` command: the VS Code smoke test in a Linux container.
import {
  VSCODE_SMOKE_DOCKER_USAGE,
  parseVsCodeSmokeDockerArguments,
  runVsCodeSmokeInDocker,
} from "./docker.js";

try {
  const parsed = parseVsCodeSmokeDockerArguments(process.argv.slice(2));
  if (parsed.help) {
    console.log(VSCODE_SMOKE_DOCKER_USAGE);
  } else {
    const result = await runVsCodeSmokeInDocker(parsed.options);
    process.exitCode = result.exitCode;
  }
} catch (error) {
  console.error(
    `modeler-shell-vscode-docker: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exitCode = 2;
}
