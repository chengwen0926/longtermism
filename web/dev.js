// Included in release assets, but only active on the development server.
(() => {
  if (!["127.0.0.1", "localhost"].includes(location.hostname)) return;
  const events = new EventSource("/__longtermism/events");
  let initialVersion;
  let reloading = false;
  async function reloadWhenReady() {
    if (reloading) return;
    reloading = true;
    // Preserve an in-progress form; saved model changes survive every reload.
    while (document.querySelector("dialog")?.open || !window.longtermismReady) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    if (await window.longtermismFlush()) location.reload();
    else reloading = false;
  }
  events.addEventListener("version", (event) => {
    if (initialVersion && initialVersion !== event.data) {
      if (document.querySelector("dialog")?.open) {
        toast("代码已更新，关闭编辑窗口后自动刷新。");
      }
      reloadWhenReady();
    }
    initialVersion = event.data;
  });
  events.onerror = () => console.info("[longtermism] 等待开发服务重新连接…");
})();
