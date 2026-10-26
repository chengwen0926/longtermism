"use strict";

function calendarView() {
  const eligible = data.plans.filter((p) => ui.calendarFilter === "all" ||
    (ui.calendarFilter === "open" ? !p.closed : p.closed));
  const month = calendarSummary(eligible, ui.calendarMonth);
  const [year, number] = month.month.split("-").map(Number);
  const todayIndex = today >= month.start && today <= month.end ? days(today, month.start) : -1;
  const dayCells = month.counts.map((count, i) => {
    const d = add(month.start, i), weekday = date(d).getDay();
    return `<div class="calendar-day ${weekday === 0 || weekday === 6 ? "weekend" : ""} ${i === todayIndex ? "is-today" : ""}" ${i === todayIndex ? 'aria-current="date"' : ""} title="${d} · ${count} 个考察项目"><span>${i + 1}</span><small>${["日", "一", "二", "三", "四", "五", "六"][weekday]}</small></div>`;
  }).join("");
  const guide = `<div class="calendar-gridlines" aria-hidden="true">${month.counts.map((_, i) => {
    const weekday = date(add(month.start, i)).getDay();
    return `<span class="${weekday === 0 || weekday === 6 ? "weekend" : ""} ${i === todayIndex ? "today-column" : ""}"></span>`;
  }).join("")}</div>`;
  return `<header class="heading"><div><h1>考察日历</h1><p>把每一段尝试放在时间里，看见起止、重叠与节奏。</p></div>${btn("new-plan", "新建考察计划", "btn primary", "", "plus")}</header>
    <section class="calendar-panel" aria-label="考察项目月度时间轴">
      <div class="calendar-toolbar"><div class="row calendar-month-controls">
        ${btn("calendar-prev", icon("left", 16), "icon-btn", 'aria-label="上个月"' + (year <= 1900 && number === 1 ? ' disabled' : ''))}
        <h2>${year} 年 ${number} 月</h2>
        ${btn("calendar-next", icon("arrow", 16), "icon-btn", 'aria-label="下个月"' + (year >= 9999 && number === 12 ? ' disabled' : ''))}
        ${btn("calendar-today", "本月", "btn small")}
      </div><div class="row calendar-filters"><label class="sr-only" for="calendar-month">跳转月份</label><input id="calendar-month" type="month" value="${month.month}" min="1900-01" max="9999-12" aria-label="跳转月份"><label class="sr-only" for="calendar-filter">筛选考察周期</label><select id="calendar-filter">${[["all", "全部周期"], ["open", "未归档"], ["closed", "已回顾"]].map(([value, label]) => `<option value="${value}" ${ui.calendarFilter === value ? "selected" : ""}>${label}</option>`).join("")}</select></div></div>
      <div class="calendar-summary" role="status"><span>本月涉及 <strong>${month.rows.length}</strong> 个项目</span><span>覆盖 <strong>${month.covered}</strong> / ${month.length} 天</span><span>最多同时 <strong>${month.peak}</strong> 个</span></div>
      ${month.rows.length ? `<div class="calendar-scroll" tabindex="0" aria-label="月度时间轴，可横向滚动查看日期"><div class="calendar-table" style="--calendar-days:${month.length}">
        <div class="calendar-row calendar-header"><div class="calendar-label">考察项目 / 完整周期</div><div class="calendar-track calendar-dates">${dayCells}</div></div>
        ${month.rows.map(({ plan: p, offset, length, before, after }) => {
          const s = stats(p);
          const description = `${p.name}，${p.start} 至 ${p.end}，共 ${s.length} 天，本月 ${length} 天，${stateLabel(p)}，已完成 ${s.done}/${s.total} 件行动`;
          return `<div class="calendar-row"><button class="calendar-label calendar-project" data-action="open-plan" data-id="${p.id}" title="${esc(description)}"><span class="calendar-project-title">${esc(p.name)}</span><span class="calendar-period">${p.start} → ${p.end}</span><span class="calendar-project-meta">${badge(p)}${sample(p)}<span>${s.length} 天 · 行动 ${s.done}/${s.total}</span></span></button><div class="calendar-track">${guide}<button class="calendar-bar ${stateOf(p)} ${before ? "continues-before" : ""} ${after ? "continues-after" : ""}" style="grid-column:${offset + 1} / span ${length}" data-action="open-plan" data-id="${p.id}" aria-label="${esc(description)}" title="${esc(description)}"><span>${before ? "‹ " : ""}${length > 3 ? `${md(p.start)} — ${md(p.end)}` : `${length}天`}${after ? " ›" : ""}</span></button></div></div>`;
        }).join("")}
        <div class="calendar-row calendar-load"><div class="calendar-label">每日考察项目数</div><div class="calendar-track calendar-dates">${month.counts.map((count, i) => `<span class="calendar-load-day ${count > 1 ? "overlap" : ""}" title="${add(month.start, i)} · ${count} 个项目">${count || "·"}</span>`).join("")}</div></div>
      </div></div>` : `<div class="calendar-empty"><span class="trial-symbol">${icon("calendar", 24)}</span><h2>这个月没有${ui.calendarFilter === "closed" ? "已回顾的" : ui.calendarFilter === "open" ? "未归档的" : ""}考察项目</h2><p>切换月份或筛选，也可以开始一段新的尝试。</p>${btn("new-plan", "新建考察计划", "btn", "", "plus")}</div>`}
      <div class="calendar-legend"><span class="status active">考察中</span><span class="status upcoming">未开始</span><span class="status review">待回顾</span><span class="status closed">已回顾</span><span>‹ / › 延续到相邻月份 · 点击时间条查看详情</span></div>
    </section><p class="calendar-note">首尾日期均计入；覆盖天数按日期去重，重叠项目不重复计算。统计基于当前筛选的计划周期，不代表实际投入时长；行动完成情况统计整个周期。</p>`;
}

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button || button.disabled) return;
  const action = button.dataset.action;
  if (!["calendar-prev", "calendar-next", "calendar-today", "calendar-plan"].includes(action)) return;
  if (action === "calendar-plan") {
    const p = plan(button.dataset.id);
    if (!p) return;
    ui.calendarMonth = (p.start <= today && p.end >= today ? today : p.start).slice(0, 7);
    ui.calendarFilter = "all";
  } else if (action === "calendar-today") ui.calendarMonth = today.slice(0, 7);
  else ui.calendarMonth = calendarMonth(ui.calendarMonth, action === "calendar-prev" ? -1 : 1).month;
  ui.page = "calendar";
  ui.planId = null;
  render();
});
document.addEventListener("change", (event) => {
  if (event.target.id === "calendar-month") {
    if (!event.target.value || !event.target.validity.valid) {
      event.target.value = ui.calendarMonth;
      return;
    }
    ui.calendarMonth = event.target.value;
    render();
  }
  if (event.target.id === "calendar-filter") {
    ui.calendarFilter = event.target.value;
    render();
  }
});
