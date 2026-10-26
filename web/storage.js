"use strict";

// One ordered queue for all writes. UI navigation never creates an extra write.
// Fallback supports an older native host during a development hot reload.
const nativeBridge = window.webkit?.messageHandlers?.longtermism ?? window.webkit?.messageHandlers?.field;
const appEnvironment = window.LONGTERMISM_ENV ?? window.FIELD_ENV;
// Persistent key intentionally stays stable so existing browser records remain visible.
const previewStorageKey = "field.preview.v1";
const storageLabel = nativeBridge
  ? appEnvironment?.development
    ? "开发数据"
    : "本机数据"
  : "浏览器预览数据";
let lastSnapshot = "";
let saveQueue = Promise.resolve();
let storageReady = false;
let storageError = "";
let writesPending = 0;

async function storageCall(action, value) {
  if (nativeBridge) return nativeBridge.postMessage({ action, value });
  if (action === "load") {
    const raw = localStorage.getItem(previewStorageKey);
    return raw ? JSON.parse(raw) : null;
  }
  localStorage.setItem(previewStorageKey, JSON.stringify(value));
}

function updateStorageStatus() {
  const status = document.querySelector("#storage-status");
  const dot = document.querySelector("#storage-dot");
  if (status)
    status.textContent = `${storageLabel} · ${storageError ? "保存失败" : writesPending ? "保存中…" : "已保存"}`;
  if (dot)
    dot.className = `notice-dot ${storageError ? "error" : writesPending ? "saving" : "saved"}`;
  const banner = document.querySelector("#storage-banner");
  banner.hidden = !storageError;
  if (storageError) {
    banner.replaceChildren(
      document.createTextNode(
        `尚未保存到本机：${storageError}。请保留窗口并重试。`,
      ),
    );
    const retry = document.createElement("button");
    retry.textContent = "重新保存";
    retry.onclick = () => {
      lastSnapshot = "";
      persist();
    };
    banner.append(retry);
  }
}

function persist() {
  if (!storageReady) return;
  const snapshot = JSON.stringify({ schemaVersion: 1, ...data });
  if (snapshot === lastSnapshot) return;
  lastSnapshot = snapshot;
  writesPending++;
  saveQueue = saveQueue.then(async () => {
    try {
      await storageCall("save", JSON.parse(snapshot));
      storageError = "";
    } catch (error) {
      storageError = error.message || String(error);
      // A failed write must remain retryable, even if the model hasn't changed.
      if (lastSnapshot === snapshot) lastSnapshot = "";
      console.error("[longtermism] save failed", error);
    } finally {
      writesPending--;
      updateStorageStatus();
    }
  });
}

window.longtermismFlush = async () => {
  if (!storageReady) return false;
  persist();
  await saveQueue;
  return !storageError;
};

// Compatibility for an already-running old native host.
window.fieldFlush = window.longtermismFlush;

async function boot() {
  try {
    const saved = await storageCall("load");
    if (saved !== null) {
      validateState(saved);
      data = { plans: saved.plans, tasks: saved.tasks };
      lastSnapshot = JSON.stringify({ schemaVersion: 1, ...data });
    } else {
      seed();
    }
    storageReady = true;
    render();
    window.longtermismReady = true;
    window.fieldReady = true; // Older native hosts use this readiness flag.
  } catch (error) {
    console.error("[longtermism] load failed", error);
    const box = document.createElement("div");
    box.className = "boot";
    const title = document.createElement("h2");
    title.textContent = "暂时无法读取本地数据";
    const message = document.createElement("p");
    message.textContent = `${error.message || error}。原文件没有被覆盖，请检查数据文件或重新打开。`;
    const retry = document.createElement("button");
    retry.className = "btn";
    retry.textContent = "重新读取";
    retry.onclick = boot;
    box.append(title, message, retry);
    document.querySelector("#app").replaceChildren(box);
  }
}

// Long-lived desktop windows should notice a new local day without losing drafts.
setInterval(() => {
  const nextDay = ds(new Date());
  if (
    storageReady &&
    nextDay !== today &&
    !document.querySelector("dialog")?.open
  ) {
    today = nextDay;
    render();
  }
}, 30000);

window.addEventListener("beforeunload", (event) => {
  if (writesPending || storageError) {
    event.preventDefault();
    event.returnValue = "";
  }
});
