// Bundles each test/*.test.ts with esbuild, then runs them with node --test.
const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const outDir = path.join(__dirname, "..", "dist-test");
fs.rmSync(outDir, { recursive: true, force: true });

const files = fs.readdirSync(__dirname).filter((f) => f.endsWith(".test.ts"));
const outputs = files.map((f) => {
  const outfile = path.join(outDir, f.replace(/\.ts$/, ".js"));
  esbuild.buildSync({
    entryPoints: [path.join(__dirname, f)],
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
    outfile,
    logLevel: "error",
  });
  return outfile;
});

const result = spawnSync(process.execPath, ["--test", ...outputs], { stdio: "inherit" });
process.exit(result.status ?? 1);
