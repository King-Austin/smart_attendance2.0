import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const cli = resolve(
  dirname(require.resolve("expo-modules-autolinking/package.json")),
  "bin/expo-modules-autolinking.js",
);
const result = JSON.parse(
  execFileSync(process.execPath, [cli, "resolve", "--platform", "android", "--json"], {
    cwd: root,
    encoding: "utf8",
  }),
);
const scanner = result.modules.find((module) => module.packageName === "smart-face-scanner");
if (
  !scanner?.projects.some((project) =>
    project.modules.some(
      (module) => module.classifier === "expo.modules.smartfacescanner.SmartFaceScannerModule",
    ),
  )
) {
  throw new Error(
    "SmartFaceScanner is missing from Android autolinking. Build from native/ and include native/modules before generating an APK.",
  );
}
console.log(
  "SmartFaceScanner Android registration verified. A native rebuild is required to install module changes.",
);
