"use strict";
document.documentElement.classList.toggle("native", Boolean(nativeBridge));
const $ = (s) => document.querySelector(s);
const paths = {
  leaf: '<path d="M19 3C9 2 3 7 5 14c3 8 15 5 14-11Z"/><path d="M4 21 15 8M8 16l-1-5M11 13h5"/>',
  matrix:
    '<rect x="3" y="3" width="7" height="7" rx="1.4"/><rect x="14" y="3" width="7" height="7" rx="1.4"/><rect x="3" y="14" width="7" height="7" rx="1.4"/><rect x="14" y="14" width="7" height="7" rx="1.4"/>',
  flag: '<path d="M5 21V4c4-4 10 4 14 0v10c-4 4-10-4-14 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="m9 5 7 7-7 7"/>',
  left: '<path d="m15 5-7 7 7 7"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  grip: '<path d="M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01" stroke-width="3"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>',
  calendar:
    '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 11h18"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  edit: '<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-4-4L5 15l-1 5Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',
};
function icon(n, s = 17) {
  return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[n] || paths.leaf}</svg>`;
}
function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
const Q = {
  q1: {
    name: "立即行动",
    label: "重要且紧急",
    sub: "先处理真正需要现在做的事",
  },
  q2: {
    name: "计划推进",
    label: "重要不紧急",
    sub: "给长期重要的事情，留出空间",
  },
  q3: {
    name: "简化处理",
    label: "不重要但紧急",
    sub: "能委托就委托，也可以降低投入",
  },
  q4: { name: "暂时放下", label: "不重要不紧急", sub: "允许延后，也允许不做" },
};
let data,
  ui = {
    page: "matrix",
    filter: "all",
    showDone: false,
    planId: null,
    planTab: "all",
    detailTab: "overview",
    calendarMonth: today.slice(0, 7),
    calendarFilter: "all",
    planReturn: "plans",
  };
const plan = (id) => data.plans.find((p) => p.id === id),
  task = (id) => data.tasks.find((t) => t.id === id);
function stateOf(p) {
  return p.closed
    ? "closed"
    : p.end < today
      ? "review"
      : p.start > today
        ? "upcoming"
        : "active";
}
const stateLabel = (p) =>
  ({
    closed: "已回顾",
    review: "待回顾",
    upcoming: "未开始",
    active: "考察中",
  })[stateOf(p)];
const badge = (p) =>
  `<span class="status ${stateOf(p)}">${stateLabel(p)}</span>`;
const sample = (x) => (x.sample ? '<span class="badge">示例</span>' : "");
function tasksOf(p) {
  return data.tasks.filter((t) => t.planId === p.id);
}
function stats(p) {
  const ts = tasksOf(p),
    done = ts.filter((t) => t.done).length;
  return {
    total: ts.length,
    done,
    percent: ts.length ? Math.round((done / ts.length) * 100) : 0,
    elapsed: Math.max(
      0,
      Math.min(days(today, p.start) + 1, days(p.end, p.start) + 1),
    ),
    length: days(p.end, p.start) + 1,
  };
}
function seed() {
  data = {
    plans: [
      {
        id: "run",
        name: "跑步，能否融入我的生活？",
        question: "先用两周感受一下：我的时间和精力，能否支持每周跑步三次？",
        start: add(today, -7),
        end: add(today, 6),
        duration: "14",
        closed: false,
        review: null,
        sample: true,
      },
      {
        id: "read",
        name: "把睡前的十分钟留给阅读",
        question: "每天睡前少看一会儿手机，是否会让我更平静？",
        start: add(today, -15),
        end: add(today, -2),
        duration: "14",
        closed: false,
        review: null,
        sample: true,
      },
    ],
    tasks: [],
  };
  const t = (title, q, planId = "", done = false, due = "") =>
    data.tasks.push({
      id: uid("task"),
      title,
      q,
      planId,
      done,
      due,
      doneAt: done ? add(today, -2) : "",
      sample: true,
    });
  t("确认明天的体检预约", "q1", "", false, today);
  t("完成本周第三次跑步", "q2", "run", false, add(today, 1));
  t("和朋友一起轻松跑一次", "q2", "run");
  t("完成考察期最后一次跑步", "q2", "run");
  t("完成第一次跑步", "q2", "run", true);
  t("完成第二次跑步", "q2", "run", true);
  t("完成第三次跑步", "q2", "run", true);
  t("回复活动群里的时间确认", "q3", "", false, today);
  t("研究一副新耳机", "q4");
  t("整理收藏夹里的旧链接", "q4");
  t("第一周：睡前三次短阅读", "q2", "read", true);
  t("第二周：睡前三次短阅读", "q2", "read", true);
  t("回想阅读对睡眠的影响", "q2", "read");
}
function btn(action, label, cls = "btn", attrs = "", ico = "") {
  return `<button type="button" data-action="${action}" class="${cls}" ${attrs}>${ico ? icon(ico, 14) : ""}${label}</button>`;
}
function visibleTasks() {
  return data.tasks.filter((t) => {
    const p = plan(t.planId);
    return (
      (ui.filter === "all"
        ? !p || !p.closed
        : ui.filter === "loose"
          ? !t.planId
          : t.planId === ui.filter) &&
      (ui.showDone || !t.done)
    );
  });
}
function render() {
  rememberCanvas();
  const focused = document.activeElement;
  const restoreFocus = focused && $("#app").contains(focused)
    ? { elementId: focused.id, ...focused.dataset }
    : null;
  persist();
  const active = data.plans.filter((p) => !p.closed),
    remaining = data.tasks.filter(
      (t) => !t.done && (!t.planId || !plan(t.planId)?.closed),
    ).length;
  $("#app").innerHTML =
    `<div class="shell"><aside class="sidebar"><div class="brand"><span class="brandmark" aria-hidden="true"></span><span class="brandname">longtermism</span></div><div class="side-scroll"><div class="side-label">规划</div><nav class="nav" aria-label="主导航"><button data-action="nav" data-page="matrix" class="${ui.page === "matrix" ? "active" : ""}" ${ui.page === "matrix" ? 'aria-current="page"' : ""}>${icon("matrix", 17)}行动矩阵<span class="count">${remaining}</span></button><button data-action="nav" data-page="plans" class="${ui.page === "plans" ? "active" : ""}" ${ui.page === "plans" ? 'aria-current="page"' : ""}>${icon("flag", 17)}考察计划</button><button data-action="nav" data-page="calendar" class="${ui.page === "calendar" ? "active" : ""}" ${ui.page === "calendar" ? 'aria-current="page"' : ""}>${icon("calendar", 17)}考察日历</button></nav>${btn("new-task", `记下一件事${nativeBridge ? " <kbd>⌘N</kbd>" : ""}`, "btn quick", "", "plus")}<div class="side-label">未归档的考察</div>${active
      .slice(0, 5)
      .map(
        (p) =>
          `<button class="side-plan ${stateOf(p)} ${ui.page === "plans" && ui.planId === p.id ? "is-current" : ""}" data-action="open-plan" data-id="${p.id}" title="${esc(p.name)} · ${stateLabel(p)}" ${ui.page === "plans" && ui.planId === p.id ? 'aria-current="page"' : ""}><span class="dot"></span><span class="grow">${esc(p.name)}</span>${icon("arrow", 12)}</button>`,
      )
      .join(
        "",
      ) || '<p class="side-empty">还没有考察计划</p>'}</div><div class="side-bottom"><button class="side-help" data-action="help">${icon("info", 17)}使用说明</button><div class="side-version"><span class="dot"></span><span>${nativeBridge ? (appEnvironment?.development ? "macOS · 开发版" : "macOS · 本机保存") : "浏览器 · 界面预览"}</span></div></div></aside><main class="main"><div class="topbar"><div class="breadcrumb">${icon(ui.page === "matrix" ? "matrix" : ui.page === "calendar" ? "calendar" : "flag", 16)}<span>规划</span><span class="slash">/</span><strong>${ui.page === "matrix" ? "行动矩阵" : ui.page === "calendar" ? "考察日历" : ui.planId ? esc(plan(ui.planId)?.name || "考察计划") : "考察计划"}</strong></div><div class="notice"><span id="storage-dot" class="notice-dot"></span><span id="storage-status" role="status"></span><button class="text-btn" data-action="reset">重置</button></div></div>${ui.page === "matrix" ? matrixView() : ui.page === "calendar" ? calendarView() : ui.planId ? detailView(plan(ui.planId)) : plansView()}</main></div>`;
  restoreCanvas();
  updateStorageStatus();
  // Rendering replaces the controls; keep keyboard users on the same action.
  if (restoreFocus) {
    const replacement = [...$("#app").querySelectorAll("button, input, select, .canvas-edge")]
      .find((el) => restoreFocus.elementId ? el.id === restoreFocus.elementId :
        restoreFocus.action && ["action", "id", "page", "value", "q", "plan"]
          .every((key) => el.dataset[key] === restoreFocus[key]));
    const target = replacement || $("main h1");
    if (target) {
      if (!replacement) target.tabIndex = -1;
      target.focus({ preventScroll: true });
    }
  }
}
function taskCard(t, detail = false) {
  const p = plan(t.planId),
    locked = p?.closed;
  return `<article class="task ${t.done ? "done" : ""}" draggable="${!locked}" data-drag="${t.id}"><button class="check ${t.done ? "on" : ""}" data-action="toggle" data-id="${t.id}" aria-label="${t.done ? "撤销完成" : "完成"}：${esc(t.title)}" aria-pressed="${t.done}" ${locked ? "disabled" : ""}>${t.done ? icon("check", 12) : ""}</button><div class="grow"><button class="task-main" data-action="edit-task" data-id="${t.id}"><span class="task-title">${esc(t.title)}</span><span class="task-meta">${detail ? `<span class="priority-chip ${t.q}">${Q[t.q].label}</span>` : p ? `<span class="project-chip">${icon("leaf", 10)} ${esc(p.name)}</span>` : ""}${t.due ? `<span class="${t.due < today && !t.done ? "overdue" : ""}">${t.due === today ? "今天" : md(t.due)}${t.due < today && !t.done ? " · 已过期" : ""}</span>` : ""}${sample(t)}</span></button></div><span class="grip">${icon("grip", 12)}</span></article>`;
}
function trialStrip() {
  const p =
    ui.filter !== "all" && ui.filter !== "loose"
      ? plan(ui.filter)
      : data.plans.find((p) => stateOf(p) === "active") ||
        data.plans.find((p) => !p.closed);
  if (!p)
    return `<div class="trial-strip"><span class="trial-symbol">${icon("leaf", 20)}</span><div class="grow"><h3>有些事情，值得先试一段时间。</h3><p>创建一个考察计划，再把行动放进矩阵。</p></div>${btn("new-plan", "开始考察", "btn small", "", "plus")}</div>`;
  const s = stats(p);
  return `<div class="trial-strip"><span class="trial-symbol">${icon("leaf", 21)}</span><div class="grow"><div class="kicker">${stateLabel(p)} · ${range(p.start, p.end)}</div><h3>${esc(p.name)} ${sample(p)}</h3><p>${p.closed ? "这段尝试已留下回顾。" : stateOf(p) === "review" ? "期限已到，给自己一点时间回头看看。" : `第 ${s.elapsed} / ${s.length} 天 · 先找到适合自己的节奏。`}</p></div><div class="strip-progress"><div class="row between"><span>关联行动</span><span>${s.done} / ${s.total} 已完成</span></div><div class="progress" role="progressbar" aria-label="关联行动完成进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${s.percent}" aria-valuetext="已完成 ${s.done} / ${s.total} 件行动"><span style="width:${s.percent}%"></span></div></div>${btn("open-plan", stateOf(p) === "review" ? "去回顾" : "查看计划", "btn small ghost", `data-id="${p.id}"`, "arrow")}</div>`;
}
function matrixView() {
  const ts = visibleTasks(),
    n = ts.filter((t) => !t.done).length;
  return `<header class="heading"><div><h1>行动矩阵</h1><p>用轻重缓急做取舍，用一段考察找到自己的节奏。</p></div>${btn("new-plan", "新建考察计划", "btn primary", "", "plus")}</header>${trialStrip()}<div class="matrix-toolbar"><div class="row"><label class="sr-only" for="project-filter">按计划筛选任务</label><select id="project-filter"><option value="all" ${ui.filter === "all" ? "selected" : ""}>全部未归档任务</option><option value="loose" ${ui.filter === "loose" ? "selected" : ""}>独立待办</option>${data.plans.map((p) => `<option value="${p.id}" ${ui.filter === p.id ? "selected" : ""}>${esc(p.name)}${p.closed ? "（已回顾）" : ""}</option>`).join("")}</select><span class="toolbar-caption">${n} 件事，留给现在的自己</span></div><label class="completion-toggle"><input id="show-done" type="checkbox" ${ui.showDone ? "checked" : ""}>显示已完成</label></div><div class="matrix-wrap"><div class="col-labels"><span>紧 急</span><span>不 紧 急</span></div><div class="matrix">${Object.entries(
    Q,
  )
    .map(([key, q], i) => {
      const list = ts.filter((t) => t.q === key),
        closed = plan(ui.filter)?.closed;
      return `<section class="quadrant ${key}" data-quadrant="${key}" aria-label="${q.label}">${i === 0 || i === 2 ? `<span class="row-axis">${i === 0 ? "重 要" : "不 重 要"}</span>` : ""}<div class="qhead"><span class="qnum">0${i + 1}</span><h2>${q.name}</h2><span class="count">${list.length}</span><span class="grow"></span><span class="q-description">${q.label}</span></div><p class="qsub">${q.sub}</p><div class="task-list">${list.map((t) => taskCard(t)).join("") || `<div class="qempty">${closed ? "这里没有记录。" : key === "q2" ? "把想长期坚持的小事，放在这里。" : "没有待办，也很好。"}</div>`}</div>${!closed ? btn("new-task", "添一件事", "qadd", `data-q="${key}"`, "plus") : ""}</section>`;
    })
    .join(
      "",
    )}</div></div><div class="bottom-note"><span>${icon("grip", 12)} 拖动或点开调整象限 · 象限内可滚动查看更多。</span><span>重要与紧急由你判断，不因截止日期自动改变。</span></div>`;
}
function plansView() {
  const ps = data.plans.filter(
    (p) =>
      ui.planTab === "all" ||
      (ui.planTab === "active"
        ? ["active", "upcoming"].includes(stateOf(p))
        : stateOf(p) === ui.planTab),
  );
  return `<header class="heading"><div><h1>考察计划</h1><p>给一个计划设定期限，看看它是否适合真实的生活。</p></div>${btn("new-plan", "新建考察计划", "btn primary", "", "plus")}</header><div class="tabs" role="group" aria-label="筛选考察计划">${[
    ["all", "全部"],
    ["active", "考察中 / 未开始"],
    ["review", "待回顾"],
    ["closed", "已回顾"],
  ]
    .map(([v, l]) =>
      btn(
        "plan-tab",
        `${l}<span class="tab-count">${data.plans.filter((p) => v === "all" || (v === "active" ? ["active", "upcoming"].includes(stateOf(p)) : stateOf(p) === v)).length}</span>`,
        `tab ${ui.planTab === v ? "active" : ""}`,
        `data-value="${v}" aria-pressed="${ui.planTab === v}"`,
      ),
    )
    .join("")}</div><div class="plans-grid">${!ps.length ? `<div class="empty-page">${icon("flag", 28)}<h2>${ui.planTab === "all" ? "从一个想尝试的计划开始" : "这里还没有" + ({active:"进行中的考察",review:"待回顾的计划",closed:"已回顾的计划"}[ui.planTab])}</h2><p>${ui.planTab === "all" ? "给自己一段时间，用具体的行动验证一个想法。" : "切换筛选查看其他计划，也可以开始一次新的尝试。"}</p>${btn("new-plan", "新建考察计划", "btn", "", "plus")}</div>` : ""}${ps
    .map((p) => {
      const s = stats(p);
      return `<button class="plan-card" data-action="open-plan" data-id="${p.id}"><div class="row between"><span class="trial-symbol">${icon("leaf", 20)}</span><span class="row">${sample(p)}${badge(p)}</span></div><h2>${esc(p.name)}</h2><p class="question">${esc(p.question || "先用这段时间，看看它是否适合自己。")}</p><div class="date">${icon("calendar", 13)} ${range(p.start, p.end)} · ${s.length} 天</div><div class="progress" role="progressbar" aria-label="关联行动完成进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${s.percent}" aria-valuetext="已完成 ${s.done} / ${s.total} 件行动"><span style="width:${s.percent}%"></span></div><div class="foot"><span>已完成 ${s.done} / ${s.total} 件关联行动</span><span>${p.closed ? "查看回顾" : stateOf(p) === "review" ? "回头看看" : "查看计划"} ${icon("arrow", 12)}</span></div></button>`;
    })
    .join(
      "",
    )}${ps.length ? `<button class="plan-new" data-action="new-plan">${icon("plus", 24)}<span>还有什么，是你想试试的？</span><span class="small">从一周、两周或一个月开始</span></button>` : ""}</div>`;
}
function detailView(p) {
  if (!p) {
    ui.planId = null;
    return plansView();
  }
  const s = stats(p),
    ts = tasksOf(p);
  const header = `${btn("plans-back", ui.planReturn === "calendar" ? "返回考察日历" : "所有考察计划", "text-btn back", "", "left")}<header class="heading"><div><h1>${esc(p.name)}</h1><p>${range(p.start, p.end)} · ${s.length} 天的尝试 ${sample(p)}</p></div>${badge(p)}</header><div class="tabs" role="group" aria-label="项目视图">${[["overview", "行动与回顾"], ["canvas", "画布看板"]].map(([value, label]) => btn("detail-tab", label, `tab ${ui.detailTab === value ? "active" : ""}`, `data-value="${value}" aria-pressed="${ui.detailTab === value}"`)).join("")}</div>`;
  if (ui.detailTab === "canvas") return header + canvasView(p);
  return `${header}<div class="detail-layout"><section><div class="question-box"><div class="eyebrow">这段时间，我想验证</div><p>${esc(p.question || "先用这段时间，看看它是否适合自己。")}</p></div><div class="panel"><div class="row between panel-heading"><h2>为这次尝试，做一些小事</h2>${!p.closed ? btn("new-task", "添加行动", "btn small", `data-plan="${p.id}"`, "plus") : ""}</div><p class="help" style="margin:0 0 16px">关联行动与矩阵共用同一条记录。这里的进度只计算完成情况，不自动判断考察成功。</p>${p.closed ? '<div class="closed-info">本周期已归档，行动和回顾保留。旧行动不会自动进入下一周期。</div>' : ""}<div class="detail-tasks">${ts.map((t) => taskCard(t, true)).join("") || `<div class="empty-tasks"><p>还没有关联行动。先加一件具体的小事吧。</p>${!p.closed ? btn("new-task", "添加第一步", "btn small", `data-plan="${p.id}"`, "plus") : ""}</div>`}</div></div><div class="detail-footer">${btn("calendar-plan", "在日历中查看", "text-btn", `data-id="${p.id}"`, "calendar")}${btn("filter-plan", "在矩阵里看这些行动", "text-btn", `data-id="${p.id}"`, "matrix")}${p.parentId ? btn("open-plan", "回看上一周期", "text-btn", `data-id="${p.parentId}"`, "left") : ""}</div></section><aside class="detail-aside"><div class="panel"><div class="eyebrow">实际发生了什么</div><div class="metrics"><div><span class="metric-label">已完成行动</span><div class="metric-value">${s.done}<span> / ${s.total}</span></div></div><div><span class="metric-label">已经过时间</span><div class="metric-value">${s.elapsed}<span> / ${s.length} 天</span></div></div></div><div class="progress" role="progressbar" aria-label="关联行动完成进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${s.percent}" aria-valuetext="已完成 ${s.done} / ${s.total} 件行动"><span style="width:${s.percent}%"></span></div><p class="help">${s.total ? "每一步完成，都会在这里留下痕迹。" : "添加关联行动后，这里会显示完成进度。"}</p><div class="divider"></div><p class="small muted">${p.end < today ? "考察期限已经结束。" : p.start > today ? `${md(p.start)} 开始。` : `还有 ${Math.max(0, days(p.end, today))} 天，慢慢找到节奏。`}</p></div><div class="panel review-panel"><div class="row">${icon("sun", 19)}<h3>${p.closed ? "留给下一段生活" : "这段尝试怎么样？"}</h3></div>${p.review ? `<div class="review-text">${esc(p.review.text || "已留下本周期的决定。")}</div><div class="review-date">${md(p.review.date)} · ${{ continue: "继续尝试", adjust: "调整后再试", stop: "先告一段落", draft: "回顾草稿" }[p.review.decision]}</div>` : "<p>时间和精力是否够用？哪些部分舒服，哪些需要调整？</p>"}${btn("review", p.closed ? "编辑回顾" : p.review ? "继续回顾" : "写下回顾", "btn", `data-id="${p.id}"`, "edit")}${p.nextId ? btn("open-plan", "看看下一周期", "btn ghost", `data-id="${p.nextId}" style="margin-top:9px"`, "arrow") : ""}</div></aside></div>`;
}
const modal = $("#modal");
function open(title, subtitle, body) {
  modal.innerHTML = `<div class="modal-head"><div class="grow"><h2 id="modal-title">${title}</h2><p id="modal-description">${subtitle}</p></div><button class="icon-btn" data-action="close" aria-label="关闭">${icon("close", 18)}</button></div><div class="modal-body">${body}</div>`;
  const contentRoot = modal.querySelector("form") || modal.querySelector(".modal-body");
  const footer = contentRoot.querySelector(".modal-footer");
  const content = document.createElement("div");
  content.className = "form-content";
  for (const child of [...contentRoot.childNodes]) {
    if (child !== footer) content.append(child);
  }
  contentRoot.prepend(content);
  modal.setAttribute("aria-describedby", "modal-description");
  if (!modal.open) modal.showModal();
  const firstField = modal.querySelector("textarea:not([readonly]), input:not([disabled]):not([readonly]), select:not([disabled])");
  firstField?.focus({ preventScroll: true });
  modal.scrollTop = 0;
}
function close() {
  modal.close();
  modal.innerHTML = "";
}
function toast(s) {
  $("#toast").textContent = s;
  $("#toast").classList.add("visible");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("visible"), 2800);
}
function field(label, name, type, value = "", attrs = "") {
  return `<div class="field"><label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" type="${type}" value="${esc(value)}" ${attrs}></div>`;
}
const durations = (v) =>
  [
    ["7", "一周"],
    ["14", "两周"],
    ["month", "一个月"],
  ]
    .map(
      ([k, l]) =>
        `<option value="${k}" ${k === v ? "selected" : ""}>${l}</option>`,
    )
    .join("");
function error(f, s) {
  let el = f.querySelector(".error");
  if (!el) {
    el = document.createElement("div");
    el.className = "error";
    el.setAttribute("role", "alert");
    f.prepend(el);
  }
  el.textContent = s;
  el.scrollIntoView({ block: "nearest" });
}
function newPlan() {
  open(
    "给一个计划，一段考察期。",
    "先明确想验证的事，再从具体行动开始。",
    `<form id="plan-form">${field("计划名称", "name", "text", "", 'required maxlength="80" placeholder="例如：跑步能否融入我的生活"')}<div class="field"><label for="f-question">我希望验证什么 <span>· 可选</span></label><textarea id="f-question" name="question" maxlength="3000" placeholder="比如：每周跑三次，我的时间和精力够不够？"></textarea></div><div class="fields">${field("开始日期", "start", "date", today, "required")}<div class="field"><label for="f-duration">考察多久</label><select id="f-duration" name="duration">${durations("14")}</select></div></div><div id="period-preview" class="info"></div><p class="help">创建后，把想做的行动关联到计划。考察时间段会显示在考察日历中，不会自动生成任务。</p><div class="modal-footer">${btn("close", "取消", "btn ghost")}<button class="btn primary" type="submit">创建考察计划</button></div></form>`,
  );
  periodPreview();
}
function periodPreview() {
  const f = $("#plan-form");
  if (!f) return;
  const s = f.elements.start.value,
    d = f.elements.duration.value;
  $("#period-preview").textContent = s
    ? `${range(s, end(s, d))} · 首尾日期均计入，共 ${days(end(s, d), s) + 1} 天`
    : "请选择开始日期。";
}
function taskModal(id = "", q = "q2", pid = "") {
  const t = id ? task(id) : null,
    p = plan(t?.planId),
    locked = p?.closed;
  if (t) q = t.q;
  const current = t
    ? t.planId
    : pid ||
      (["all", "loose"].includes(ui.filter) || plan(ui.filter)?.closed
        ? ""
        : ui.filter);
  open(
    locked ? "回看这一步" : t ? "调整这件事" : "先记下一件事",
    locked
      ? "本周期已归档，保留当时的记录。"
      : "重要与紧急，由现在的你来判断。",
    `<form id="task-form" data-id="${id}" data-locked="${!!locked}"><div class="field"><label for="f-title">要做什么</label><textarea id="f-title" name="title" required maxlength="1000" ${locked ? "readonly" : ""} placeholder="写下一个具体、可以行动的小步骤……">${esc(t?.title || "")}</textarea></div><fieldset class="choice-group"><legend class="label">放在哪个象限</legend><div class="priority-picker">${Object.entries(
      Q,
    )
      .map(
        ([key, v]) =>
          `<label class="priority-option"><input type="radio" name="q" value="${key}" ${key === q ? "checked" : ""} ${locked ? "disabled" : ""}><span>${v.name}<small>${v.label}</small></span></label>`,
      )
      .join(
        "",
      )}</div></fieldset><div class="fields"><div class="field"><label for="f-planId">关联考察计划 <span>· 可选</span></label><select id="f-planId" name="planId" ${locked ? "disabled" : ""}><option value="">独立待办</option>${data.plans
      .filter((x) => !x.closed || x.id === current)
      .map(
        (x) =>
          `<option value="${x.id}" ${x.id === current ? "selected" : ""}>${esc(x.name)}</option>`,
      )
      .join(
        "",
      )}</select></div>${field("截止日期 <span>· 可选</span>", "due", "date", t?.due || "", locked ? "readonly" : "")}</div><p class="help">截止日期用于提醒自己，不会自动改变象限或安排日历。</p>${t ? `<label class="completion-label"><input type="checkbox" name="done" ${t.done ? "checked" : ""} ${locked ? "disabled" : ""}>这件事已完成</label>${t.doneAt ? `<p class="modal-note">${md(t.doneAt)} 完成 · 调整象限或截止日期不改变完成记录</p>` : ""}` : ""}<div class="modal-footer">${t && !locked ? btn("delete-task", "删除", "btn ghost danger", `data-id="${id}"`) : ""}<span class="grow"></span>${btn("close", locked ? "关闭" : "取消", "btn ghost")}${!locked ? `<button class="btn primary" type="submit">${t ? "保存修改" : "记下来"}</button>` : ""}</div></form>`,
  );
}
function reviewModal(id) {
  const p = plan(id),
    s = stats(p),
    start = p.end < today ? today : add(p.end, 1);
  open(
    "这段尝试，适合继续吗？",
    "完成多少是一部分，你的真实感受同样重要。",
    `<form id="review-form" data-id="${id}"><div class="review-stats"><span><strong>${s.done} / ${s.total}</strong> 件行动完成</span><span><strong>${s.elapsed} / ${s.length}</strong> 天已经过</span></div><div class="field"><label for="f-text">回顾这段时间</label><textarea id="f-text" name="text" maxlength="5000" style="min-height:120px" placeholder="时间和精力是否够用？有什么收获？下一次想怎样调整？">${esc(p.review?.text || "")}</textarea></div>${p.closed ? '<div class="info">这段尝试已经归档。编辑回顾不会改变历史行动，也不会再次创建下一周期。</div>' : `<fieldset class="choice-group"><legend class="label">接下来，我想……</legend><div class="decision-list"><label class="decision"><input type="radio" name="decision" value="continue" checked>继续尝试</label><label class="decision"><input type="radio" name="decision" value="adjust">调整后再试</label><label class="decision"><input type="radio" name="decision" value="stop">先告一段落</label></div></fieldset><div class="period-section" id="next-period"><div class="fields">${field("下一周期开始", "start", "date", start, `required min="${add(p.end, 1)}"`)}<div class="field"><label for="f-duration">下一周期时长</label><select id="f-duration" name="duration">${durations(p.duration)}</select></div></div><div class="field" id="adjust-question" hidden><label for="f-question">调整后，希望验证什么</label><textarea id="f-question" name="question" maxlength="3000">${esc(p.question)}</textarea></div><p class="help">原周期归档，新周期从空白行动清单开始。没有完成的行动仍留在原周期，便于诚实回顾。</p></div>`}<div class="modal-footer">${btn("close", "取消", "btn ghost")}<button type="submit" class="btn" name="mode" value="save" formnovalidate>${p.closed ? "保存回顾" : "只保存回顾"}</button>${!p.closed ? '<button type="submit" class="btn primary" name="mode" value="decide">确认下一步</button>' : ""}</div></form>`,
  );
}
function changePriority(id, q) {
  const t = task(id);
  if (!t || !Q[q] || plan(t.planId)?.closed) return;
  t.q = q;
  render();
  toast(`已移至「${Q[q].name}」，计划归属和完成记录保持不变。`);
}
function navigatePlan(id) {
  if (ui.page !== "plans" || !ui.planId) ui.planReturn = ui.page === "calendar" ? "calendar" : "plans";
  ui.page = "plans";
  if (ui.planId !== id) ui.detailTab = "overview";
  ui.planId = id;
  if (modal.open) close();
  render();
  window.scrollTo({ top: 0 });
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  const id = b.dataset.id;
  switch (b.dataset.action) {
    case "nav":
      ui.page = b.dataset.page;
      ui.planId = null;
      render();
      window.scrollTo({ top: 0 });
      break;
    case "new-plan":
      newPlan();
      break;
    case "new-task":
      taskModal("", b.dataset.q || "q2", b.dataset.plan || "");
      break;
    case "close":
      close();
      break;
    case "open-plan":
      navigatePlan(id);
      break;
    case "plans-back":
      ui.page = ui.planReturn || "plans";
      ui.planId = null;
      render();
      break;
    case "detail-tab":
      ui.detailTab = b.dataset.value;
      canvasUI.source = null;
      render();
      break;
    case "plan-tab":
      ui.planTab = b.dataset.value;
      render();
      break;
    case "filter-plan":
      ui.page = "matrix";
      ui.filter = id;
      ui.showDone = !!plan(id)?.closed;
      render();
      window.scrollTo({ top: 0 });
      break;
    case "edit-task":
      taskModal(id);
      break;
    case "toggle": {
      const t = task(id);
      if (!t || plan(t.planId)?.closed) return;
      t.done = !t.done;
      t.doneAt = t.done ? today : "";
      render();
      toast(t.done ? "这一步，完成了。" : "已撤销完成。");
      break;
    }
    case "review":
      reviewModal(id);
      break;
    case "delete-task":
      open(
        "移除这件事？",
        "它会同时从矩阵与关联计划中移除。",
        `<p class="small muted">${esc(task(id).title)}</p><div class="modal-footer">${btn("close", "保留", "btn ghost")}${btn("confirm-delete", "确认移除", "btn danger", `data-id="${id}"`)}</div>`,
      );
      break;
    case "confirm-delete":
      if (!plan(task(id)?.planId)?.closed)
        data.tasks = data.tasks.filter((t) => t.id !== id);
      close();
      render();
      toast("已移除这件事。");
      break;
    case "reset":
      open(
        "恢复最初的示例？",
        "当前数据将被示例替换，并保存到本机。此操作不可撤销。",
        `<p class="small muted">恢复跑步考察、阅读回顾和四象限里的示例任务。</p><div class="modal-footer">${btn("close", "保留当前内容", "btn ghost")}${btn("confirm-reset", "恢复示例", "btn primary")}</div>`,
      );
      break;
    case "confirm-reset":
      seed();
      ui = {
        page: "matrix",
        filter: "all",
        showDone: false,
        planId: null,
        planTab: "all",
    detailTab: "overview",
    calendarMonth: today.slice(0, 7),
    calendarFilter: "all",
    planReturn: "plans",
      };
      close();
      render();
      toast("已经恢复示例。");
      break;
    case "help":
      open(
        "只做好两件事。",
        "行动矩阵 × 项目考察期",
        `<ul class="scope-list"><li>用重要性和紧急性，为任务做取舍。</li><li>任务可以拖动，也可以点开修改象限。</li><li>关联到考察计划后，完成情况会同步更新。</li><li>用一周、两周或一个月验证一个想法。</li><li>在考察日历中查看项目时间段、重叠情况和月度统计。</li><li>回顾之后，决定继续、调整，或告一段落。</li></ul><div class="info amber" style="margin-top:18px">行动与考察计划自动保存在本机，刷新或退出后仍会保留。开发版、正式版和浏览器预览各自独立保存；目前没有多设备同步。</div>${btn("close", "开始体验", "btn primary", 'style="width:100%"')}`,
      );
      break;
  }
});
document.addEventListener("change", (e) => {
  if (e.target.id === "project-filter") {
    ui.filter = e.target.value;
    render();
  }
  if (e.target.id === "show-done") {
    ui.showDone = e.target.checked;
    render();
  }
  const f = e.target.form;
  if (f?.id === "review-form" && e.target.name === "decision") {
    const stop = e.target.value === "stop";
    $("#next-period").hidden = stop;
    $("#next-period")
      .querySelectorAll("input,select,textarea")
      .forEach((el) => (el.disabled = stop));
    $("#adjust-question").hidden = e.target.value !== "adjust";
  }
  if (f?.id === "plan-form") periodPreview();
});
document.addEventListener("input", (e) => {
  if (e.target.form?.id === "plan-form") periodPreview();
});
document.addEventListener("submit", (e) => {
  const f = e.target;
  if (!["plan-form", "task-form", "review-form"].includes(f.id)) return;
  e.preventDefault();
  const d = Object.fromEntries(new FormData(f)),
    trim = (v) => String(v || "").trim();
  if (f.id === "plan-form") {
    if (!trim(d.name)) return error(f, "请填写计划名称。");
    const p = {
      id: uid("plan"),
      name: trim(d.name),
      question: trim(d.question),
      start: d.start,
      end: end(d.start, d.duration),
      duration: d.duration,
      closed: false,
      review: null,
      sample: false,
    };
    data.plans.push(p);
    close();
    navigatePlan(p.id);
    toast("计划已创建。添加第一步行动吧。");
  }
  if (f.id === "task-form") {
    if (f.dataset.locked === "true") return;
    if (!trim(d.title)) return error(f, "先写下一件要做的事吧。");
    const p = plan(d.planId);
    if (p?.closed) return error(f, "请选择尚未归档的考察计划。");
    if (d.due && p && (d.due < p.start || d.due > p.end))
      return error(
        f,
        `关联行动的截止日期请设在 ${range(p.start, p.end)} 内，或留空。`,
      );
    let t = task(f.dataset.id);
    if (t) {
      const done = d.done === "on";
      if (done !== t.done) t.doneAt = done ? today : "";
      Object.assign(t, {
        title: trim(d.title),
        q: d.q,
        planId: d.planId,
        due: d.due,
        done,
      });
    } else {
      t = {
        id: uid("task"),
        title: trim(d.title),
        q: d.q,
        planId: d.planId,
        due: d.due,
        done: false,
        doneAt: "",
        sample: false,
      };
      data.tasks.push(t);
    }
    const matches =
      ui.filter === "all" ||
      (ui.filter === "loose" ? !t.planId : t.planId === ui.filter);
    if (!matches) ui.filter = t.planId || "loose";
    close();
    render();
    toast("已保存，矩阵与考察计划同步更新。");
  }
  if (f.id === "review-form") {
    const p = plan(f.dataset.id),
      mode = e.submitter?.value || "save";
    if (mode === "save" || p.closed) {
      p.review = {
        text: trim(d.text),
        decision: p.closed ? p.review.decision : "draft",
        date: today,
      };
      close();
      render();
      toast("回顾已保存。");
      return;
    }
    if (d.decision !== "stop" && (!d.start || d.start <= p.end))
      return error(f, "下一周期请从本周期结束后开始。");
    p.review = { text: trim(d.text), decision: d.decision, date: today };
    p.closed = true;
    if (d.decision !== "stop") {
      const next = {
        id: uid("plan"),
        name: p.name,
        question: d.decision === "adjust" ? trim(d.question) : p.question,
        start: d.start,
        end: end(d.start, d.duration),
        duration: d.duration,
        closed: false,
        review: null,
        parentId: p.id,
        sample: false,
      };
      data.plans.push(next);
      p.nextId = next.id;
    }
    close();
    render();
    toast(
      d.decision === "stop"
        ? "已为这段尝试写下句点。"
        : "新周期已创建，原周期与行动完整保留。",
    );
  }
});
let dragId = "";
document.addEventListener("dragstart", (e) => {
  const el = e.target.closest("[data-drag]");
  if (!el || el.getAttribute("draggable") === "false") return;
  dragId = el.dataset.drag;
  e.dataTransfer.setData("text/plain", dragId);
  e.dataTransfer.effectAllowed = "move";
});
document.addEventListener("dragover", (e) => {
  const q = e.target.closest("[data-quadrant]");
  if (q && dragId) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    q.classList.add("dragover");
  }
});
document.addEventListener("dragleave", (e) => {
  const q = e.target.closest("[data-quadrant]");
  if (q && !q.contains(e.relatedTarget)) q.classList.remove("dragover");
});
document.addEventListener("drop", (e) => {
  const q = e.target.closest("[data-quadrant]");
  if (!q || !dragId) return;
  e.preventDefault();
  const id = e.dataTransfer.getData("text/plain");
  if (id === dragId) changePriority(id, q.dataset.quadrant);
  dragId = "";
  document
    .querySelectorAll(".dragover")
    .forEach((x) => x.classList.remove("dragover"));
});
document.addEventListener("dragend", () => {
  dragId = "";
  document
    .querySelectorAll(".dragover")
    .forEach((x) => x.classList.remove("dragover"));
});
modal.addEventListener("click", (e) => {
  if (e.target === modal) {
    const r = modal.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      close();
  }
});
boot();
