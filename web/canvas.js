"use strict";

// View state is transient; nodes and edges live on the plan and use its save queue.
const canvasUI = { planId: null, selected: null, source: null, zoom: 1, left: 0, top: 0 };
let canvasDrag = null;
function currentCanvasPlan() {
  return ui.page === "plans" && ui.detailTab === "canvas" ? plan(ui.planId) : null;
}
function rememberCanvas() {
  const viewport = document.querySelector(".canvas-viewport");
  if (!viewport) return;
  canvasUI.left = viewport.scrollLeft;
  canvasUI.top = viewport.scrollTop;
}
function restoreCanvas() {
  const viewport = document.querySelector(".canvas-viewport");
  if (viewport) {
    viewport.scrollLeft = canvasUI.left;
    viewport.scrollTop = canvasUI.top;
  }
}
function canvasEdgePath(edge, nodes) {
  const a = nodes.find((n) => n.id === edge.from);
  const b = nodes.find((n) => n.id === edge.to);
  const right = b.x >= a.x;
  const x1 = a.x + (right ? NODE_WIDTH : 0), y1 = a.y + NODE_HEIGHT / 2;
  const x2 = b.x + (right ? 0 : NODE_WIDTH), y2 = b.y + NODE_HEIGHT / 2;
  const bend = Math.max(60, Math.abs(x2 - x1) / 2) * (right ? 1 : -1);
  return `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
}
function canvasEdges(canvas) {
  return canvas.edges.map((edge) => {
    const a = canvas.nodes.find((n) => n.id === edge.from);
    const b = canvas.nodes.find((n) => n.id === edge.to);
    return `<path class="canvas-edge ${canvasUI.selected === edge.id ? "selected" : ""}" d="${canvasEdgePath(edge, canvas.nodes)}" data-action="canvas-edge" data-id="${edge.id}" tabindex="0" role="button" aria-label="连线：${esc(a.title)} — ${esc(b.title)}"/>`;
  }).join("");
}
function canvasView(p) {
  if (canvasUI.planId !== p.id) Object.assign(canvasUI, { planId: p.id, selected: null, source: null, zoom: 1, left: 0, top: 0 });
  const canvas = p.canvas || { nodes: [], edges: [] };
  const selectedNode = canvas.nodes.find((n) => n.id === canvasUI.selected);
  const selectedEdge = canvas.edges.find((e) => e.id === canvasUI.selected);
  const source = canvas.nodes.find((n) => n.id === canvasUI.source);
  return `<section class="canvas-panel" aria-label="项目画布看板"><div class="canvas-toolbar"><div class="row"><h2>画布看板</h2><span class="small muted">${canvas.nodes.length} 个节点 · ${canvas.edges.length} 条连线</span></div><div class="row canvas-tools">${!p.closed ? btn("canvas-new", "创建节点", "btn primary", "", "plus") : '<span class="badge">已归档 · 只读</span>'}${selectedNode ? btn("canvas-edit", p.closed ? "查看节点" : "编辑节点", "btn", `data-id="${selectedNode.id}"`, "edit") : ""}${!p.closed && (selectedNode || selectedEdge) ? btn("canvas-delete", selectedNode ? "删除节点" : "删除连线", "btn ghost danger") : ""}<div class="canvas-zoom">${btn("canvas-zoom-out", "−", "icon-btn", 'aria-label="缩小画布"' + (canvasUI.zoom <= .5 ? " disabled" : ""))}${btn("canvas-zoom-reset", `${Math.round(canvasUI.zoom * 100)}%`, "text-btn", 'aria-label="恢复原始缩放"')}${btn("canvas-zoom-in", "+", "icon-btn", 'aria-label="放大画布"' + (canvasUI.zoom >= 1.5 ? " disabled" : ""))}</div></div></div><div class="canvas-hint" role="status">${p.closed ? "本周期画布已保留，可查看节点与关系。" : source ? `正在从「${esc(source.title)}」连线：点击另一节点的连接点。${btn("canvas-cancel", "取消连线", "text-btn")}` : "拖动节点标题调整位置 · 点击两个节点的连接点建立连线 · 双击空白处创建节点"}</div><div class="canvas-viewport" tabindex="0" aria-label="画布区域，可滚动浏览"><div class="canvas-space" style="width:${CANVAS_WIDTH * canvasUI.zoom}px;height:${CANVAS_HEIGHT * canvasUI.zoom}px"><div class="canvas-world" style="width:${CANVAS_WIDTH}px;height:${CANVAS_HEIGHT}px;transform:scale(${canvasUI.zoom})"><svg class="canvas-lines" width="${CANVAS_WIDTH}" height="${CANVAS_HEIGHT}" aria-label="节点连线">${canvasEdges(canvas)}</svg>${canvas.nodes.map((n) => `<article class="canvas-node ${canvasUI.selected === n.id ? "selected" : ""} ${canvasUI.source === n.id ? "connecting" : ""}" data-node="${n.id}" style="left:${n.x}px;top:${n.y}px"><button class="canvas-node-title" data-action="canvas-select" data-id="${n.id}" aria-label="${esc(n.title)}，选择后可用方向键移动" ${p.closed ? "" : 'title="拖动调整位置；方向键移动"'}>${icon("grip", 13)}<strong>${esc(n.title)}</strong></button><button class="canvas-node-body" data-action="canvas-edit" data-id="${n.id}" aria-label="${p.closed ? "查看" : "编辑"}节点：${esc(n.title)}">${esc(n.text || "写下想法、线索或观察……")}</button>${!p.closed ? ["left", "right"].map((side) => `<button class="canvas-port ${side}" data-action="canvas-connect" data-id="${n.id}" aria-label="连接节点：${esc(n.title)}（${side === "left" ? "左" : "右"}）" aria-pressed="${canvasUI.source === n.id}" title="点击此处，再点击另一节点的连接点"></button>`).join("") : ""}</article>`).join("")}</div></div>${!canvas.nodes.length ? `<div class="canvas-empty">${icon("matrix", 30)}<h3>把想法放在一起，让关系变得清晰。</h3><p>用节点记录问题、观察和灵感，再用连线串联它们。</p>${!p.closed ? btn("canvas-new", "创建第一个节点", "btn", "", "plus") : ""}</div>` : ""}</div></section>`;
}
function canvasNodeModal(id = "", position) {
  const p = currentCanvasPlan();
  if (!p || (p.closed && !id)) return;
  const n = p.canvas?.nodes.find((node) => node.id === id);
  const viewport = document.querySelector(".canvas-viewport");
  const x = Math.round(Math.max(0, Math.min(CANVAS_WIDTH - NODE_WIDTH, position?.x ?? (viewport.scrollLeft + viewport.clientWidth / 2) / canvasUI.zoom - NODE_WIDTH / 2)));
  const y = Math.round(Math.max(0, Math.min(CANVAS_HEIGHT - NODE_HEIGHT, position?.y ?? (viewport.scrollTop + viewport.clientHeight / 2) / canvasUI.zoom - NODE_HEIGHT / 2)));
  open(p.closed ? "查看节点" : n ? "编辑节点" : "创建节点", "记录这个项目中的一个想法、问题或观察。", `<form id="canvas-node-form" data-plan="${p.id}" data-id="${id}" data-x="${x}" data-y="${y}">${field("节点标题", "title", "text", n?.title || "", `required maxlength="80" ${p.closed ? "readonly" : ""} placeholder="例如：什么会影响我的坚持？"`)}<div class="field"><label for="f-text">内容 <span>· 可选</span></label><textarea id="f-text" name="text" maxlength="3000" ${p.closed ? "readonly" : ""} placeholder="补充具体的观察与想法……">${esc(n?.text || "")}</textarea></div><div class="modal-footer">${btn("close", p.closed ? "关闭" : "取消", "btn ghost")}${!p.closed ? '<button class="btn primary" type="submit">保存节点</button>' : ""}</div></form>`);
}
document.addEventListener("submit", (event) => {
  const form = event.target;
  if (form.id !== "canvas-node-form") return;
  event.preventDefault();
  const p = plan(form.dataset.plan);
  if (!p || p.closed) return;
  const values = new FormData(form), title = String(values.get("title")).trim();
  if (!title) return error(form, "请填写节点标题。");
  const canvas = p.canvas ||= { nodes: [], edges: [] };
  let node = canvas.nodes.find((n) => n.id === form.dataset.id);
  if (!node) {
    node = { id: uid("node"), x: Number(form.dataset.x), y: Number(form.dataset.y) };
    // Repeated toolbar creation fans nodes out instead of hiding the previous one.
    while (canvas.nodes.some((n) => Math.abs(n.x - node.x) < 20 && Math.abs(n.y - node.y) < 20) && node.x < CANVAS_WIDTH - NODE_WIDTH && node.y < CANVAS_HEIGHT - NODE_HEIGHT) {
      node.x = Math.min(CANVAS_WIDTH - NODE_WIDTH, node.x + 32);
      node.y = Math.min(CANVAS_HEIGHT - NODE_HEIGHT, node.y + 32);
    }
    canvas.nodes.push(node);
  }
  Object.assign(node, { title, text: String(values.get("text") || "").trim() });
  canvasUI.selected = node.id;
  close(); render(); toast("节点已保存。");
});
document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button || button.disabled || !button.dataset.action.startsWith("canvas-")) return;
  const p = currentCanvasPlan();
  if (!p) return;
  const action = button.dataset.action, id = button.dataset.id;
  if (action === "canvas-new") return canvasNodeModal();
  if (action === "canvas-edit") return canvasNodeModal(id);
  if (action === "canvas-select" || action === "canvas-edge") canvasUI.selected = id;
  if (action === "canvas-cancel") canvasUI.source = null;
  if (action === "canvas-connect" && !p.closed) {
    if (!canvasUI.source) canvasUI.source = id;
    else if (canvasUI.source === id) canvasUI.source = null;
    else {
      const created = connectCanvasNodes(p.canvas, canvasUI.source, id);
      canvasUI.source = null;
      toast(created ? "已建立连线。" : "这两个节点已有连线。");
    }
  }
  if (action === "canvas-delete" && !p.closed) {
    const node = p.canvas?.nodes.find((n) => n.id === canvasUI.selected);
    if (node) {
      open("删除这个节点？", "与它相连的连线也会一并删除。", `<p>${esc(node.title)}</p><div class="modal-footer">${btn("close", "保留", "btn ghost")}${btn("canvas-confirm-delete", "删除节点", "btn danger", `data-id="${node.id}"`)}</div>`);
      return;
    }
    if (p.canvas) p.canvas.edges = p.canvas.edges.filter((edge) => edge.id !== canvasUI.selected);
    canvasUI.selected = null;
  }
  if (action === "canvas-confirm-delete" && !p.closed) {
    removeCanvasNode(p.canvas, id);
    canvasUI.selected = null; canvasUI.source = null;
    close();
  }
  if (action.startsWith("canvas-zoom-")) {
    rememberCanvas();
    const old = canvasUI.zoom;
    canvasUI.zoom = action === "canvas-zoom-reset" ? 1 : Math.max(.5, Math.min(1.5, Math.round((old + (action === "canvas-zoom-in" ? .1 : -.1)) * 10) / 10));
    const viewport = document.querySelector(".canvas-viewport");
    // RememberCanvas in render reads these values before replacing the viewport.
    viewport.scrollLeft = (canvasUI.left + viewport.clientWidth / 2) * canvasUI.zoom / old - viewport.clientWidth / 2;
    viewport.scrollTop = (canvasUI.top + viewport.clientHeight / 2) * canvasUI.zoom / old - viewport.clientHeight / 2;
  }
  render();
});
document.addEventListener("dblclick", (event) => {
  if (!event.target.closest(".canvas-viewport") || event.target.closest(".canvas-node, [data-action]")) return;
  const rect = document.querySelector(".canvas-world").getBoundingClientRect();
  canvasNodeModal("", { x: (event.clientX - rect.left) / canvasUI.zoom, y: (event.clientY - rect.top) / canvasUI.zoom });
});
function paintCanvasNode(node) {
  const element = document.querySelector(`[data-node="${node.id}"]`);
  if (!element) return;
  element.style.left = `${node.x}px`; element.style.top = `${node.y}px`;
  document.querySelector(".canvas-lines").innerHTML = canvasEdges(currentCanvasPlan().canvas);
}
document.addEventListener("pointerdown", (event) => {
  const handle = event.target.closest(".canvas-node-title");
  const p = currentCanvasPlan();
  if (!handle || !p || p.closed || event.button !== 0) return;
  const node = p.canvas.nodes.find((n) => n.id === handle.dataset.id);
  canvasDrag = { node, handle, pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, x: node.x, y: node.y };
  handle.setPointerCapture(event.pointerId);
});
document.addEventListener("pointermove", (event) => {
  if (!canvasDrag || event.pointerId !== canvasDrag.pointerId) return;
  const d = canvasDrag;
  d.node.x = Math.round(Math.max(0, Math.min(CANVAS_WIDTH - NODE_WIDTH, d.x + (event.clientX - d.clientX) / canvasUI.zoom)));
  d.node.y = Math.round(Math.max(0, Math.min(CANVAS_HEIGHT - NODE_HEIGHT, d.y + (event.clientY - d.clientY) / canvasUI.zoom)));
  paintCanvasNode(d.node);
});
function finishCanvasDrag(event) {
  if (!canvasDrag || event.pointerId !== canvasDrag.pointerId) return;
  const d = canvasDrag;
  canvasDrag = null;
  if (event.type === "pointercancel") { d.node.x = d.x; d.node.y = d.y; paintCanvasNode(d.node); }
  else persist();
  if (d.handle.hasPointerCapture(event.pointerId)) d.handle.releasePointerCapture(event.pointerId);
}
document.addEventListener("pointerup", finishCanvasDrag);
document.addEventListener("pointercancel", finishCanvasDrag);
document.addEventListener("lostpointercapture", finishCanvasDrag);
document.addEventListener("keydown", (event) => {
  if (modal.open || !currentCanvasPlan()) return;
  if (event.key === "Escape") { canvasUI.source = null; render(); return; }
  if (event.target.matches(".canvas-edge") && ["Enter", " "].includes(event.key)) {
    event.preventDefault(); canvasUI.selected = event.target.dataset.id; render(); return;
  }
  const handle = event.target.closest(".canvas-node-title");
  const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
  const p = currentCanvasPlan();
  if (!handle || !delta || p.closed) return;
  event.preventDefault();
  const node = p.canvas.nodes.find((n) => n.id === handle.dataset.id), step = event.shiftKey ? 40 : 10;
  node.x = Math.max(0, Math.min(CANVAS_WIDTH - NODE_WIDTH, node.x + delta[0] * step));
  node.y = Math.max(0, Math.min(CANVAS_HEIGHT - NODE_HEIGHT, node.y + delta[1] * step));
  paintCanvasNode(node); persist();
});
