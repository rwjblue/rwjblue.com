#!/usr/bin/env node

import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

export function parsePotaUpdateArgs(args) {
  const options = {
    fullBackfill: false,
  };

  for (const arg of args) {
    switch (arg) {
      case "--full-backfill":
        options.fullBackfill = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  return options;
}

export function buildPotaUpdatePlan({ fullBackfill }) {
  if (fullBackfill) {
    return [
      ["mise", "run", "pota:ri:update-parks"],
      ["mise", "run", "pota:ri:update-profile"],
      ["mise", "run", "pota:ri:backfill-activations"],
      ["mise", "run", "pota:ri:build-tracker-data"],
      ["mise", "run", "pota:park:backfill-known"],
    ];
  }

  return [
    ["mise", "run", "pota:ri:update-profile"],
    ["mise", "run", "pota:ri:build-tracker-data"],
    ["mise", "run", "pota:park:backfill-known"],
  ];
}

export async function runPotaUpdate({
  args = process.argv.slice(2),
  spawnCommand = spawn,
  stdout = process.stdout,
} = {}) {
  const options = parsePotaUpdateArgs(args);

  if (options.help) {
    stdout.write(usage());
    return;
  }

  const plan = buildPotaUpdatePlan(options);

  for (const command of plan) {
    stdout.write(`\n$ ${command.join(" ")}\n`);
    await runCommand(command, spawnCommand);
  }
}

function runCommand(command, spawnCommand) {
  return new Promise((resolve, reject) => {
    const child = spawnCommand(command[0], command.slice(1), {
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          signal
            ? `${command.join(" ")} exited with signal ${signal}`
            : `${command.join(" ")} exited with ${code}`,
        ),
      );
    });
  });
}

function usage() {
  return `Usage: update.mjs [--full-backfill]\n\n` +
    `Refresh POTA profile, tracker, and canonical park-page data.\n\n` +
    `Options:\n` +
    `  --full-backfill  Refresh RI park list and backfill activation history too.\n`;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await runPotaUpdate();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
