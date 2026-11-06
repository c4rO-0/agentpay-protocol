// Exercise the actual packed public interface from an independent temporary project.
import { mkdtemp, readFile, writeFile, rm, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
const root = fileURLToPath(new URL("../", import.meta.url));
const dir = await mkdtemp(join(tmpdir(), "agentpay-package-consumer-"));
function run(command, args, cwd) {
  const r = spawnSync(command, args, {
    cwd,
    stdio: "inherit",
    timeout: 180000,
    env: process.env,
  });
  if (r.error) throw r.error;
  if (r.status !== 0) throw Error(`${command} failed (${r.status})`);
}
try {
  const packages = [];
  for (const name of ["types", "x402-escrow"]) {
    const pkg = JSON.parse(
      await readFile(join(root, "packages", name, "package.json"), "utf8"),
    );
    run(
      "pnpm",
      ["--ignore-workspace", "pack", "--pack-destination", dir],
      join(root, "packages", name),
    );
    packages.push({
      name: pkg.name,
      file: join(dir, `${pkg.name.replace(/^@/, "").replace("/", "-")}-${pkg.version}.tgz`),
    });
  }
  await writeFile(
    join(dir, "package.json"),
    JSON.stringify({
      private: true,
      type: "module",
      dependencies: Object.fromEntries(
        packages.map((p) => [p.name, "file:" + p.file]),
      ),
      pnpm: { overrides: { "@c4roa0/agentpay-protocol": "file:" + packages[0].file } },
    }),
  );
  run(
    "pnpm",
    [
      "--ignore-workspace",
      "install",
      "--ignore-scripts",
      ...(process.env.PROTOCOL_TEST_OFFLINE === "1" ? ["--offline"] : []),
    ],
    dir,
  );
  await copyFile(
    join(root, "scripts/fixtures/package-consumer.mjs"),
    join(dir, "consumer.mjs"),
  );
  run(process.execPath, ["consumer.mjs"], dir);
} finally {
  await rm(dir, { recursive: true, force: true });
}
