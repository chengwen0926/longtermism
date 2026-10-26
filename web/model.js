"use strict";
let today = ds(new Date());
function date(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}
function ds(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function add(s, n) {
  const d = date(s);
  d.setDate(d.getDate() + n);
  return ds(d);
}
function days(a, b) {
  return Math.round((date(a) - date(b)) / 86400000);
}
function end(start, duration) {
  if (duration !== "month") return add(start, Number(duration) - 1);
  const d = date(start),
    day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + 1);
  d.setDate(
    Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()),
  );
  return add(ds(d), -1);
}
function md(s) {
  const d = date(s);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}
const range = (a, b) => `${md(a)} — ${md(b)}`;
const uid = (p) => `${p}-${crypto.randomUUID()}`;

function calendarMonth(month, offset = 0) {
  const first = date(`${month}-01`);
  first.setMonth(first.getMonth() + offset);
  const start = ds(first);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0, 12);
  return { month: start.slice(0, 7), start, end: ds(last), length: last.getDate() };
}

// Inclusive date intervals, clipped only for display. Never change stored periods.
function calendarSummary(plans, month) {
  const period = calendarMonth(month);
  const counts = Array(period.length).fill(0);
  const rows = plans.filter((p) => p.start <= period.end && p.end >= period.start)
    .sort((a, b) => a.start.localeCompare(b.start) || a.name.localeCompare(b.name))
    .map((p) => {
      const start = p.start < period.start ? period.start : p.start;
      const end = p.end > period.end ? period.end : p.end;
      const offset = days(start, period.start), length = days(end, start) + 1;
      for (let i = offset; i < offset + length; i++) counts[i]++;
      return { plan: p, offset, length, before: p.start < period.start, after: p.end > period.end };
    });
  return { ...period, rows, counts, covered: counts.filter(Boolean).length,
    peak: Math.max(0, ...counts) };
}

// Refuse corrupt or newer documents rather than silently replacing user data.
function validateState(value) {
  const fail = (message) => {
    throw new Error(`数据格式不兼容：${message}`);
  };
  if (!value || value.schemaVersion !== 1) fail("需要 schemaVersion 1");
  if (!Array.isArray(value.plans) || !Array.isArray(value.tasks))
    fail("缺少计划或行动列表");
  const validDate = (s) =>
    typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && ds(date(s)) === s;
  const ids = new Set();
  const checkId = (item) => {
    if (
      !item ||
      typeof item.id !== "string" ||
      !/^[a-zA-Z0-9-]+$/.test(item.id) ||
      ids.has(item.id)
    )
      fail("ID 无效或重复");
    ids.add(item.id);
  };
  for (const p of value.plans) {
    checkId(p);
    if (
      typeof p.name !== "string" ||
      typeof p.question !== "string" ||
      typeof p.closed !== "boolean"
    )
      fail("计划字段无效");
    if (
      !validDate(p.start) ||
      !validDate(p.end) ||
      p.end < p.start ||
      !["7", "14", "month"].includes(p.duration)
    )
      fail("考察日期无效");
    if (
      p.review &&
      (typeof p.review.text !== "string" ||
        !validDate(p.review.date) ||
        !["draft", "continue", "adjust", "stop"].includes(p.review.decision))
    )
      fail("回顾字段无效");
    if (p.closed && !p.review) fail("已归档计划缺少回顾");
    if (p.canvas !== undefined) {
      if (!p.canvas || !Array.isArray(p.canvas.nodes) || !Array.isArray(p.canvas.edges))
        fail("画布字段无效");
      const nodes = new Set();
      for (const node of p.canvas.nodes) {
        checkId(node);
        nodes.add(node.id);
        if (typeof node.title !== "string" || !node.title.trim() ||
            typeof node.text !== "string" ||
            !Number.isFinite(node.x) || !Number.isFinite(node.y) ||
            node.x < 0 || node.x > CANVAS_WIDTH - NODE_WIDTH ||
            node.y < 0 || node.y > CANVAS_HEIGHT - NODE_HEIGHT)
          fail("画布节点无效");
      }
      const connections = new Set();
      for (const edge of p.canvas.edges) {
        checkId(edge);
        const key = [edge.from, edge.to].sort().join(":");
        if (!nodes.has(edge.from) || !nodes.has(edge.to) ||
            edge.from === edge.to || connections.has(key)) fail("画布连线无效");
        connections.add(key);
      }
    }
  }
  const plans = new Set(value.plans.map((p) => p.id));
  for (const p of value.plans) {
    if (
      (p.parentId && !plans.has(p.parentId)) ||
      (p.nextId && !plans.has(p.nextId))
    )
      fail("周期关联不存在");
  }
  for (const t of value.tasks) {
    checkId(t);
    if (
      typeof t.title !== "string" ||
      !["q1", "q2", "q3", "q4"].includes(t.q) ||
      typeof t.done !== "boolean"
    )
      fail("行动字段无效");
    if (typeof t.planId !== "string" || (t.planId && !plans.has(t.planId)))
      fail("关联计划不存在");
    if (
      (t.due !== "" && !validDate(t.due)) ||
      (t.doneAt !== "" && !validDate(t.doneAt))
    )
      fail("行动日期无效");
    if (t.done !== Boolean(t.doneAt)) fail("完成状态与日期不一致");
  }
  return value;
}


const CANVAS_WIDTH = 2400, CANVAS_HEIGHT = 1600;
const NODE_WIDTH = 220, NODE_HEIGHT = 140;
function connectCanvasNodes(canvas, from, to) {
  if (from === to || !canvas.nodes.some((n) => n.id === from) ||
      !canvas.nodes.some((n) => n.id === to) ||
      canvas.edges.some((e) => (e.from === from && e.to === to) ||
        (e.from === to && e.to === from))) return false;
  canvas.edges.push({ id: uid("edge"), from, to });
  return true;
}
function removeCanvasNode(canvas, id) {
  canvas.nodes = canvas.nodes.filter((n) => n.id !== id);
  canvas.edges = canvas.edges.filter((e) => e.from !== id && e.to !== id);
}
