import { build } from "esbuild";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(root, "twitch-extension");
const packageDir = path.join(sourceDir, "build");
const publicDir = path.join(root, "public", "twitch-extension");
const assets = ["index.html", "config.html", "viewer.css", "setup.css", "setup.js"];
const apiBaseUrl = (process.env.MURMUR_EXTENSION_EBS_URL ?? "").trim().replace(/\/+$/, "");
const dashboardUrl = (process.env.MURMUR_DASHBOARD_URL ?? apiBaseUrl).trim().replace(/\/+$/, "");
const configScript = `window.MURMUR_EXTENSION_CONFIG = ${JSON.stringify({ apiBaseUrl, dashboardUrl })};\n`;

await Promise.all([mkdir(packageDir, { recursive: true }), mkdir(publicDir, { recursive: true })]);
for (const file of assets) {
  await copyFile(path.join(sourceDir, file), path.join(packageDir, file));
  await copyFile(path.join(sourceDir, file), path.join(publicDir, file));
}
await Promise.all([
  writeFile(path.join(packageDir, "config.js"), configScript, "utf8"),
  writeFile(path.join(publicDir, "config.js"), configScript, "utf8"),
]);

await build({
  absWorkingDir: root,
  entryPoints: [path.join(sourceDir, "viewer.tsx")],
  outfile: path.join(packageDir, "viewer.js"),
  bundle: true,
  minify: false,
  sourcemap: false,
  format: "iife",
  platform: "browser",
  target: "es2020",
  jsx: "automatic",
  tsconfig: path.join(root, "tsconfig.json"),
  logLevel: "info",
});
await copyFile(path.join(packageDir, "viewer.js"), path.join(publicDir, "viewer.js"));
console.info(`Built Twitch Extension assets in ${packageDir}`);
