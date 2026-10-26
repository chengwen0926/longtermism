import http from "node:http";
import { readFile, readdir, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { build, root } from "./build.mjs";

const webOnly = process.argv.includes("--web-only");
const webRoot = path.join(root, "web");
const clients = new Set();
const port = Number(process.env.LONGTERMISM_PORT || process.env.FIELD_PORT || 4317);
let version = String(Date.now());
let nativeProcess;
let stopping = false;
let rebuilding = false;
let timer;
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
};
const server = http.createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://127.0.0.1").pathname;
  if (request.method !== "GET") {
    response.writeHead(405).end();
    return;
  }
  if (["/__longtermism/events", "/__field/events"].includes(pathname)) {
    response.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    response.write(`event: version\ndata: ${version}\n\n`);
    clients.add(response);
    request.on("close", () => clients.delete(response));
    return;
  }
  try {
    const relative = decodeURIComponent(
      pathname === "/" ? "/index.html" : pathname,
    );
    const file = path.resolve(webRoot, "." + relative);
    if (!file.startsWith(webRoot + path.sep)) {
      response.writeHead(403).end();
      return;
    }
    const body = await readFile(file);
    response.writeHead(200, {
      "Content-Type": `${types[path.extname(file)] || "application/octet-stream"}; charset=utf-8`,
      "Cache-Control": "no-store",
    });
    response.end(body);
  } catch {
    response.writeHead(404).end("Not found");
  }
});

async function fingerprint(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const stamps = await Promise.all(
    entries.map(async (entry) => {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) return fingerprint(file);
      const info = await stat(file);
      return `${entry.name}:${info.mtimeMs}:${info.size}`;
    }),
  );
  return stamps.sort().join("|");
}
function launch(binary) {
  nativeProcess = spawn(binary, [], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, LONGTERMISM_DEV_URL: `http://127.0.0.1:${port}/` },
  });
  nativeProcess.once("error", (error) => {
    console.error(error);
    shutdown(1);
  });
  nativeProcess.once("exit", (code) => {
    if (!rebuilding && !stopping) shutdown(code || 0);
  });
}
function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  clearInterval(timer);
  nativeProcess?.kill("SIGTERM");
  for (const client of clients) client.end();
  server.close(() => {
    process.exitCode = code;
  });
  server.closeAllConnections();
}
process.on("SIGINT", () => shutdown());
process.on("SIGTERM", () => shutdown());

try {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  console.log(
    `longtermism 界面预览：http://127.0.0.1:${port}\n界面保存后自动刷新；编辑中的表单关闭后再刷新。`,
  );
  if (!webOnly) {
    console.log("正在编译 macOS 窗口…");
    const result = await build(true);
    launch(result.binary);
    console.log(
      "开发窗口已启动。修改 native/ 会重新编译并重启应用；Ctrl+C 停止。",
    );
  }
  let webStamp = await fingerprint(webRoot);
  let nativeStamp = await fingerprint(path.join(root, "native"));
  let checking = false;
  timer = setInterval(async () => {
    if (checking || rebuilding || stopping) return;
    checking = true;
    try {
      const nextWeb = await fingerprint(webRoot);
      if (nextWeb !== webStamp) {
        webStamp = nextWeb;
        version = String(Date.now());
        for (const client of clients)
          client.write(`event: version\ndata: ${version}\n\n`);
        console.log("界面已更新。");
      }
      if (!webOnly) {
        const nextNative = await fingerprint(path.join(root, "native"));
        if (nextNative !== nativeStamp) {
          nativeStamp = nextNative;
          rebuilding = true;
          try {
            console.log("原生代码变更，正在重新构建…");
            const result = await build(true);
            if (nativeProcess && nativeProcess.exitCode === null) {
              await new Promise((resolve) => {
                nativeProcess.once("exit", resolve);
                nativeProcess.kill("SIGTERM");
              });
            }
            if (!stopping) launch(result.binary);
          } catch (error) {
            console.error(`构建失败，原窗口保留：${error.message}`);
          } finally {
            rebuilding = false;
          }
        }
      }
    } catch (error) {
      console.error(error.message);
    } finally {
      checking = false;
    }
  }, 500);
} catch (error) {
  console.error(`启动失败：${error.message}`);
  shutdown(1);
}
