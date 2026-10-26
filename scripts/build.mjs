import { spawn } from "node:child_process";
import { mkdir, cp, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

export const root = fileURLToPath(new URL("../", import.meta.url));
export function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      ...options,
    });
    child.once("error", reject);
    child.once("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${command} exited with ${code}`)),
    );
  });
}

export async function build(development = false) {
  if (process.platform !== "darwin")
    throw new Error(
      "桌面版需要在 macOS 上构建；可用 npm run dev:web 预览界面。",
    );
  const app = path.join(
    root,
    "build",
    development ? "longtermism-dev.app" : "longtermism.app",
  );
  const contents = path.join(app, "Contents");
  const binary = path.join(contents, "MacOS", "longtermism");
  await mkdir(path.join(contents, "MacOS"), { recursive: true });
  await mkdir(path.join(contents, "Resources"), { recursive: true });
  await mkdir(path.join(root, ".build", "module-cache"), { recursive: true });
  const temporaryBinary = path.join(
    root,
    ".build",
    development ? "longtermism-dev" : "longtermism",
  );
  await run("xcrun", [
    "swiftc",
    "native/main.swift",
    "-o",
    temporaryBinary,
    "-module-cache-path",
    path.join(root, ".build", "module-cache"),
    "-framework",
    "AppKit",
    "-framework",
    "WebKit",
    "-target",
    `${process.arch === "arm64" ? "arm64" : "x86_64"}-apple-macosx13.3`,
    ...(development ? ["-g", "-Onone"] : ["-O"]),
  ]);
  await cp(temporaryBinary, binary);
  const iconBuilder = path.join(root, ".build", "make-icon");
  const iconset = path.join(root, ".build", "longtermism.iconset");
  await run("xcrun", [
    "swiftc", "scripts/icon.swift", "-o", iconBuilder,
    "-module-cache-path", path.join(root, ".build", "module-cache"),
    "-framework", "AppKit",
    "-target", `${process.arch === "arm64" ? "arm64" : "x86_64"}-apple-macosx13.3`,
  ]);
  await run(iconBuilder, [path.join(root, "web", "rocket.svg"), iconset]);
  await run("/usr/bin/iconutil", [
    "-c", "icns", iconset, "-o", path.join(contents, "Resources", "longtermism.icns"),
  ]);
  await cp(path.join(root, "web"), path.join(contents, "Resources", "web"), {
    recursive: true,
  });
  // Bundle identifiers intentionally stay stable across the product rename.
  await writeFile(
    path.join(contents, "Info.plist"),
    `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleName</key><string>longtermism</string>
<key>CFBundleDisplayName</key><string>${development ? "longtermism 开发版" : "longtermism"}</string>
<key>CFBundleIdentifier</key><string>local.field${development ? ".dev" : ""}</string>
<key>CFBundleExecutable</key><string>longtermism</string>
<key>CFBundleIconFile</key><string>longtermism.icns</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>0.1.0</string>
<key>CFBundleVersion</key><string>1</string>
<key>LSMinimumSystemVersion</key><string>13.3</string>
<key>NSHighResolutionCapable</key><true/>
<key>NSPrincipalClass</key><string>NSApplication</string>
${development ? "<key>NSAppTransportSecurity</key><dict><key>NSAllowsLocalNetworking</key><true/></dict>" : ""}
</dict></plist>`,
  );
  await run("/usr/bin/codesign", ["--force", "--sign", "-", app]);
  return { app, binary };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    const result = await build(process.argv.includes("--dev"));
    console.log(
      `\n构建完成：${result.app}\n双击应用即可运行。此构建仅供本机使用，未做发行公证。`,
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
