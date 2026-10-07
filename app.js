/* Heyshift Demobox: a self-contained, browser-only sandbox with sample data. */
(function () {
  "use strict";

  var STORE_KEY = "heyshift-demobox-v1";
  var DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  var TARGET_LABOR = 30; // percent of revenue
  var AV_COLORS = ["#059669", "#0d9488", "#0891b2", "#7c3aed", "#db2777", "#ea580c", "#4f46e5", "#65a30d"];

  var AREAS = [
    { id: "kitchen", name: "Kitchen", color: "#f97316", tpl: [["07:00", "15:00"], ["14:00", "22:00"]] },
    { id: "foh", name: "Front of house", color: "#10b981", tpl: [["08:00", "16:00"], ["16:00", "23:00"]] },
    { id: "bar", name: "Bar", color: "#6366f1", tpl: [["15:00", "23:00"], ["17:00", "23:30"]] }
  ];

  var LOCATIONS = [
    {
      id: "aus", name: "Lone Star Kitchen, Austin Downtown", revBase: 2700,
      staff: [
        ["Maria Lopez", "Head chef", "kitchen", 26, [6]],
        ["Jamal Carter", "Line cook", "kitchen", 19, [2]],
        ["Ethan Brooks", "Prep cook", "kitchen", 17, [0, 1]],
        ["Sofia Nguyen", "Shift lead", "foh", 21, [5]],
        ["Olivia Reed", "Server", "foh", 15, [3]],
        ["Liam Patel", "Server", "foh", 15, [6]],
        ["Ava Johnson", "Bartender", "bar", 18, [0]],
        ["Noah Kim", "Barback", "bar", 15, [1, 2]]
      ]
    },
    {
      id: "dal", name: "Lone Star Kitchen, Dallas Uptown", revBase: 3000,
      staff: [
        ["Carlos Rivera", "Head chef", "kitchen", 27, [0]],
        ["Grace Miller", "Line cook", "kitchen", 19, [3]],
        ["Tyler Evans", "Dishwasher", "kitchen", 15, [6]],
        ["Hannah Scott", "Shift lead", "foh", 22, [1]],
        ["Marcus Hill", "Server", "foh", 15, [2]],
        ["Chloe Adams", "Host", "foh", 14, [5, 6]],
        ["Diego Torres", "Bartender", "bar", 18, [0]],
        ["Emma Wright", "Bartender", "bar", 18, [4]]
      ]
    },
    {
      id: "hou", name: "Lone Star Kitchen, Houston Heights", revBase: 2200,
      staff: [
        ["Aisha Brown", "Head chef", "kitchen", 25, [1]],
        ["Ryan Cooper", "Line cook", "kitchen", 18, [6]],
        ["Mia Garcia", "Server", "foh", 15, [0]],
        ["Jacob Lee", "Server", "foh", 15, [3]],
        ["Zoe Martin", "Host", "foh", 14, [2, 5]],
        ["Isaac Young", "Bartender", "bar", 18, [6]]
      ]
    }
  ];
  LOCATIONS.forEach(function (loc) {
    loc.staff = loc.staff.map(function (s, i) {
      return { id: loc.id + "-" + i, name: s[0], role: s[1], area: s[2], rate: s[3], unavail: s[4], color: AV_COLORS[i % AV_COLORS.length] };
    });
  });
  var REV_MULT = [0.75, 0.8, 0.9, 1.0, 1.35, 1.5, 1.15];

  var TASKS = [
    { id: "addShift", text: "Add a shift: click any empty cell on the schedule", go: function () { setTab("schedule"); } },
    { id: "approveLeave", text: "Approve a leave request and watch the schedule update", go: function () { setTab("leave"); } },
    { id: "publish", text: "Publish next week's schedule to your team", go: function () { state.offset = 1; setTab("schedule"); } },
    { id: "labor", text: "Check labor cost against forecast revenue", go: function () { setTab("labor"); } },
    { id: "attendance", text: "Approve last week's timesheets for payroll", go: function () { state.offset = -1; setTab("attendance"); } },
    { id: "claim", text: "Claim an open shift from the staff app", go: function () { setTab("app"); } }
  ];

  /* ---------- helpers ---------- */
  function $(s, el) { return (el || document).querySelector(s); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function mins(t) { var p = t.split(":"); return (+p[0]) * 60 + (+p[1]); }
  function fmtT(m) { m = ((m % 1440) + 1440) % 1440; var h = Math.floor(m / 60), mm = m % 60; return String(h).padStart(2, "0") + ":" + String(mm).padStart(2, "0"); }
  function nice(t) { var m = typeof t === "number" ? t : mins(t); m = ((m % 1440) + 1440) % 1440; var h = Math.floor(m / 60), mm = m % 60, ap = h >= 12 ? "pm" : "am"; h = h % 12 || 12; return h + (mm ? ":" + String(mm).padStart(2, "0") : "") + ap; }
  function shiftLen(sh) { var d = mins(sh.end) - mins(sh.start); if (d <= 0) d += 1440; return d; }
  function paidHours(sh) { return Math.max(0, shiftLen(sh) - (sh.brk || 0)) / 60; }
  function money(n) { return "$" + Math.round(n).toLocaleString("en-US"); }
  function hrs(n) { return (Math.round(n * 10) / 10).toLocaleString("en-US") + "h"; }
  function initials(n) { return n.split(" ").map(function (p) { return p[0]; }).join("").slice(0, 2); }
  function uid() { return "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function startOfWeek(d) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); var wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); return x; }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function iso(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function md(d) { return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }); }

  var TODAY = new Date(); TODAY = new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate());
  var THIS_MONDAY = startOfWeek(TODAY);
  function mondayFor(offset) { return addDays(THIS_MONDAY, offset * 7); }
  function weekKey(offset) { return iso(mondayFor(offset)); }
  function dateOf(offset, day) { return addDays(mondayFor(offset), day); }

  /* ---------- state ---------- */
  var state;
  function freshState() {
    var s = { loc: "aus", tab: "schedule", offset: 0, tasks: {}, appStaff: {}, locs: {} };
    LOCATIONS.forEach(function (loc) {
      var st = loc.staff;
      s.locs[loc.id] = {
        weeks: {},
        unavail: st.reduce(function (o, p) { o[p.id] = p.unavail.slice(); return o; }, {}),
        leave: [
          { id: "l1", staff: st[1].id, from: iso(dateOf(1, 3)), to: iso(dateOf(1, 4)), type: "Vacation", note: "Family wedding in San Antonio", status: "pending" },
          { id: "l2", staff: st[4].id, from: iso(dateOf(0, 5)), to: iso(dateOf(0, 5)), type: "Personal", note: "Moving apartments", status: "pending" },
          { id: "l3", staff: st[st.length - 1].id, from: iso(dateOf(2, 0)), to: iso(dateOf(2, 2)), type: "Sick", note: "Doctor's note attached", status: "pending" },
          { id: "l4", staff: st[3].id, from: iso(dateOf(0, 2)), to: iso(dateOf(0, 2)), type: "Vacation", note: "", status: "approved" }
        ],
        notes: []
      };
    });
    return s;
  }
  function load() {
    try { var raw = localStorage.getItem(STORE_KEY); if (raw) { var s = JSON.parse(raw); if (s && s.locs) return s; } } catch (e) {}
    return freshState();
  }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {} }
  state = load();

  function L() { return LOCATIONS.filter(function (l) { return l.id === state.loc; })[0]; }
  function LS() { return state.locs[state.loc]; }
  function staffById(id) { return L().staff.filter(function (s) { return s.id === id; })[0]; }
  function area(id) { return AREAS.filter(function (a) { return a.id === id; })[0]; }

  function onLeave(staffId, date, statuses) {
    var d = iso(date);
    return LS().leave.some(function (l) { return l.staff === staffId && statuses.indexOf(l.status) >= 0 && d >= l.from && d <= l.to; });
  }
  function isUnavail(staffId, day) { return (LS().unavail[staffId] || []).indexOf(day) >= 0; }

  /* Lazily seed a week with a believable schedule. */
  function week(offset) {
    var ls = LS(), key = weekKey(offset);
    if (ls.weeks[key]) return ls.weeks[key];
    var loc = L(), shifts = [], draft = offset > 0;
    loc.staff.forEach(function (p, idx) {
      var a = area(p.area), h = hash(p.id + key), offDays = 0;
      for (var day = 0; day < 7; day++) {
        if (isUnavail(p.id, day)) continue;
        if (onLeave(p.id, dateOf(offset, day), ["approved"])) continue;
        // give each person roughly 5 shifts, with one extra day off
        if (offDays < 1 && ((h >> day) & 7) === 0) { offDays++; continue; }
        var t = a.tpl[(idx + day + (h & 1)) % 2];
        shifts.push({ id: uid() + day + idx, staff: p.id, day: day, start: t[0], end: t[1], area: p.area, brk: 30, draft: draft });
      }
    });
    // open shifts on the busy days
    shifts.push({ id: uid() + "o1", staff: null, day: 4, start: "17:00", end: "23:00", area: "foh", brk: 30, draft: draft });
    shifts.push({ id: uid() + "o2", staff: null, day: 5, start: "10:00", end: "16:00", area: "kitchen", brk: 30, draft: draft });
    ls.weeks[key] = { shifts: shifts, tsApproved: false, published: !draft };
    save();
    return ls.weeks[key];
  }

  function conflictsFor(sh, w, offset) {
    var out = [];
    if (!sh.staff) return out;
    if (isUnavail(sh.staff, sh.day)) out.push("Marked unavailable on " + DAY_NAMES[sh.day] + "s");
    if (onLeave(sh.staff, dateOf(offset, sh.day), ["approved"])) out.push("On approved leave");
    var s0 = mins(sh.start), s1 = s0 + shiftLen(sh);
    w.shifts.forEach(function (o) {
      if (o === sh || o.id === sh.id || o.staff !== sh.staff || o.day !== sh.day) return;
      var o0 = mins(o.start), o1 = o0 + shiftLen(o);
      if (s0 < o1 && o0 < s1) out.push("Overlaps another shift");
    });
    return out;
  }
  function weeklyHours(staffId, w) { return w.shifts.reduce(function (t, s) { return s.staff === staffId ? t + paidHours(s) : t; }, 0); }
  function revenue(offset, day) { var loc = L(); return Math.round(loc.revBase * REV_MULT[day] * (0.94 + (hash(loc.id + weekKey(offset) + day) % 13) / 100)); }
  function costOf(sh) { var p = staffById(sh.staff); var rate = p ? p.rate : 15; return paidHours(sh) * rate; }

  /* Simulated punches for attendance (deterministic per shift). */
  function actualFor(sh, offset) {
    var date = dateOf(offset, sh.day);
    if (date >= TODAY || sh.draft || !sh.staff) return null;
    var h = hash(sh.id), s0 = mins(sh.start), s1 = s0 + shiftLen(sh);
    var late = (h % 9 === 0) ? 5 + (h % 11) : (h % 4 === 0 ? -5 : 0);
    var over = (h % 5 === 0) ? 20 + (h % 25) : ((h >> 3) % 3 === 0 ? -10 : 0);
    var reasons = ["", "Busy close", "Covered late delivery", "Traffic", "Stayed for inventory", "Left early, quiet night"];
    var reason = "";
    if (over >= 20) reason = reasons[1 + (h % 2) * 3];
    else if (late > 0) reason = reasons[3];
    else if (over < 0) reason = reasons[5];
    return { start: s0 + late, end: s1 + over, brk: sh.brk || 0, reason: reason };
  }
  function actualHours(a) { return Math.max(0, a.end - a.start - a.brk) / 60; }

  /* ---------- UI shell ---------- */
  var main = $("#main");
  function toast(msg) { var t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("show"); }, 2600); }
  function done(id) { if (!state.tasks[id]) { state.tasks[id] = true; save(); renderTasks(); var t = TASKS.filter(function (x) { return x.id === id; })[0]; if (t) setTimeout(function () { toast("Step complete: " + t.text.split(":")[0]); }, 900); } }

  function setTab(tab) { state.tab = tab; save(); render(); window.scrollTo({ top: 0, behavior: "smooth" }); }

  function renderTasks() {
    var n = 0;
    $("#tasks").innerHTML = TASKS.map(function (t, i) {
      var d = !!state.tasks[t.id]; if (d) n++;
      return '<li data-task="' + i + '" class="' + (d ? "done" : "") + '"><span class="chk">' + (d ? "✓" : "") + '</span><span class="txt">' + esc(t.text) + "</span></li>";
    }).join("");
    $("#progressBar").style.width = (n / TASKS.length * 100) + "%";
    $("#progressText").textContent = n + " of " + TASKS.length + " steps done";
    $("#ctaCard").hidden = n < 4;
  }

  function weekNav() {
    var m = mondayFor(state.offset), e = addDays(m, 6);
    var lbl = state.offset === 0 ? "This week" : state.offset === 1 ? "Next week" : state.offset === -1 ? "Last week" : "";
    return '<div class="weeknav"><button class="btn sm" data-act="prev" aria-label="Previous week">‹</button><strong>' + md(m) + " to " + md(e) +
      (lbl ? ' <span class="pill">' + lbl + "</span>" : "") + '</strong><button class="btn sm" data-act="next" aria-label="Next week">›</button>' +
      (state.offset !== 0 ? '<button class="btn sm ghost" data-act="today">Today</button>' : "") + "</div>";
  }

  function render() {
    document.querySelectorAll("#tabs button").forEach(function (b) { b.classList.toggle("active", b.dataset.tab === state.tab); });
    $("#locSelect").value = state.loc;
    ({ schedule: renderSchedule, leave: renderLeave, labor: renderLabor, attendance: renderAttendance, app: renderApp }[state.tab] || renderSchedule)();
    renderTasks();
  }

  /* ---------- Schedule ---------- */
  function renderSchedule() {
    var off = state.offset, w = week(off), loc = L();
    var drafts = w.shifts.filter(function (s) { return s.draft; }).length;
    var totalH = 0, totalC = 0, rev = 0, conflicts = 0, open = 0;
    w.shifts.forEach(function (s) {
      if (!s.staff) { open++; return; }
      totalH += paidHours(s); totalC += costOf(s);
      if (conflictsFor(s, w, off).length) conflicts++;
    });
    for (var d = 0; d < 7; d++) rev += revenue(off, d);
    var pct = rev ? totalC / rev * 100 : 0;
    var status = drafts === 0 ? '<span class="pill green">Published</span>' : (w.published ? '<span class="pill amber">' + drafts + " unpublished change" + (drafts > 1 ? "s" : "") + "</span>" : '<span class="pill amber">Draft</span>');

    var h = '<div class="head"><h1>Schedule</h1>' + status + '<span class="spacer"></span>' + weekNav() + "</div>";
    h += '<div class="stats">' +
      stat(hrs(totalH), "Scheduled hours") +
      stat(money(totalC), "Labor cost") +
      stat(pct.toFixed(1) + "%", "Labor vs. forecast revenue (target " + TARGET_LABOR + "%)", pct > TARGET_LABOR ? "bad" : "good") +
      stat(conflicts + " / " + open, "Conflicts / open shifts", conflicts ? "bad" : "") + "</div>";
    h += '<div class="head"><button class="btn primary" data-act="publish"' + (drafts ? "" : " disabled") + ">" + (drafts ? "Publish " + drafts + " shift" + (drafts > 1 ? "s" : "") : "Everything is published") + "</button>" +
      '<button class="btn" data-act="copy">Copy previous week</button><button class="btn ghost" data-act="clear">Clear week</button>' +
      '<span class="spacer"></span><span class="muted small">Tip: click a cell to add, click a shift to edit</span></div>';

    h += '<div class="gridwrap"><table class="sched"><thead><tr><th>Team</th>';
    for (d = 0; d < 7; d++) {
      var dt = dateOf(off, d), isT = iso(dt) === iso(TODAY);
      h += '<th class="' + (isT ? "today" : "") + '">' + DAY_NAMES[d] + " " + dt.getDate() + "<small>" + money(revenue(off, d)) + " forecast</small></th>";
    }
    h += "</tr></thead><tbody>";

    // open shifts row
    h += '<tr class="arearow"><td colspan="8"><span class="dot" style="background:#94a3b8"></span>Open shifts (anyone qualified can claim)</td></tr><tr><td class="who"><b>Open shifts</b><small>Visible in the staff app</small></td>';
    for (d = 0; d < 7; d++) {
      h += '<td class="cell" data-cell="open|' + d + '">' + w.shifts.filter(function (s) { return !s.staff && s.day === d; }).map(function (s) { return shiftChip(s, w, off); }).join("") + '<span class="plus">+</span></td>';
    }
    h += "</tr>";

    AREAS.forEach(function (a) {
      var people = loc.staff.filter(function (p) { return p.area === a.id; });
      if (!people.length) return;
      h += '<tr class="arearow"><td colspan="8"><span class="dot" style="background:' + a.color + '"></span>' + esc(a.name) + "</td></tr>";
      people.forEach(function (p) {
        var wh = weeklyHours(p.id, w);
        h += '<tr><td class="who"><span class="hrs' + (wh > 40 ? " over" : "") + '" title="' + (wh > 40 ? "Overtime: over 40 hours" : "Weekly hours") + '">' + hrs(wh) + (wh > 40 ? " OT" : "") + "</span><b>" + esc(p.name) + "</b><small>" + esc(p.role) + " · $" + p.rate + "/h</small></td>";
        for (var d2 = 0; d2 < 7; d2++) {
          var un = isUnavail(p.id, d2), lv = onLeave(p.id, dateOf(off, d2), ["approved"]), pend = onLeave(p.id, dateOf(off, d2), ["pending"]);
          var mine = w.shifts.filter(function (s) { return s.staff === p.id && s.day === d2; });
          h += '<td class="cell' + (lv ? " onleave" : un ? " unavail" : "") + '" data-cell="' + p.id + "|" + d2 + '">' +
            (lv ? '<div class="tag">On leave</div>' : un ? '<div class="tag">Unavailable</div>' : pend ? '<div class="tag">Leave requested</div>' : "") +
            mine.map(function (s) { return shiftChip(s, w, off); }).join("") + (mine.length ? "" : '<span class="plus">+</span>') + "</td>";
        }
        h += "</tr>";
      });
    });
    h += "</tbody></table></div>";
    h += '<div class="legend"><span><i style="background:#fff;outline:1px dashed #94a3b8"></i>Draft (not yet sent to staff)</span><span><i style="background:#fff;box-shadow:0 0 0 2px #dc2626"></i>Conflict</span><span><i style="background:repeating-linear-gradient(135deg,#f8fafc 0 3px,#e2e8f0 3px 6px)"></i>Unavailable</span><span><i style="background:#fde68a"></i>On leave</span></div>';
    main.innerHTML = h;
  }
  function stat(v, l, cls) { return '<div class="stat ' + (cls || "") + '"><b>' + v + "</b><span>" + l + "</span></div>"; }
  function shiftChip(s, w, off) {
    var a = area(s.area), c = conflictsFor(s, w, off);
    return '<div class="shift' + (s.draft ? " draft" : "") + (c.length ? " conflict" : "") + (s.staff ? "" : " open") + '" data-shift="' + s.id + '" style="border-left-color:' + a.color + '" title="' + esc(c.join(", ")) + '">' +
      nice(s.start) + " to " + nice(s.end) + "<small>" + esc(a.name) + (c.length ? " · ⚠ " + esc(c[0]) : "") + "</small></div>";
  }

  /* ---------- Shift dialog ---------- */
  var dlg = $("#shiftDialog"), editing = null;
  function openShift(sh, staffId, day) {
    var loc = L();
    editing = sh ? { id: sh.id } : { id: null, day: day };
    $("#fStaff").innerHTML = '<option value="">Open shift (anyone can claim)</option>' + loc.staff.map(function (p) { return '<option value="' + p.id + '">' + esc(p.name) + " (" + esc(p.role) + ")</option>"; }).join("");
    $("#fArea").innerHTML = AREAS.map(function (a) { return '<option value="' + a.id + '">' + esc(a.name) + "</option>"; }).join("");
    var p = staffById(sh ? sh.staff : staffId);
    var ar = sh ? sh.area : (p ? p.area : "foh");
    var tpl = area(ar).tpl[0];
    $("#fStaff").value = sh ? (sh.staff || "") : (staffId || "");
    $("#fStart").value = sh ? sh.start : tpl[0];
    $("#fEnd").value = sh ? sh.end : tpl[1];
    $("#fArea").value = ar;
    $("#fBreak").value = String(sh ? sh.brk : 30);
    $("#shiftDialogTitle").textContent = sh ? "Edit shift" : "Add shift";
    var d = sh ? sh.day : day;
    editing.day = d;
    $("#shiftDialogSub").textContent = DAY_NAMES[d] + ", " + md(dateOf(state.offset, d)) + " · " + L().name;
    $("#fDelete").style.visibility = sh ? "visible" : "hidden";
    checkDialog();
    dlg.showModal();
  }
  function draftFromForm() {
    return { id: editing.id || "__new", staff: $("#fStaff").value || null, day: editing.day, start: $("#fStart").value, end: $("#fEnd").value, area: $("#fArea").value, brk: +$("#fBreak").value };
  }
  function checkDialog() {
    var w = week(state.offset), s = draftFromForm(), msgs = conflictsFor(s, w, state.offset);
    if (s.staff) {
      var others = w.shifts.reduce(function (t, o) { return o.staff === s.staff && o.id !== s.id ? t + paidHours(o) : t; }, 0);
      var tot = others + paidHours(s);
      if (tot > 40) msgs.push("Puts " + staffById(s.staff).name.split(" ")[0] + " at " + hrs(tot) + " this week (overtime after 40h)");
      if (onLeave(s.staff, dateOf(state.offset, s.day), ["pending"])) msgs.push("Has a pending leave request for this day");
    }
    if (s.start && s.end && paidHours(s) > 12) msgs.push("Shift is longer than 12 hours");
    if (s.start && s.end && shiftLen(s) > 360 && !s.brk) msgs.push("Break rule: shifts over 6 hours need a break");
    var box = $("#fWarn");
    box.hidden = !msgs.length;
    box.innerHTML = msgs.map(function (m) { return "⚠ " + esc(m); }).join("<br>") + (msgs.length ? "<br><span class='small'>You can still save, Heyshift just makes sure you know.</span>" : "");
  }
  $("#shiftForm").addEventListener("input", checkDialog);
  $("#fStaff").addEventListener("change", function () { var p = staffById(this.value); if (p && !editing.id) { $("#fArea").value = p.area; var t = area(p.area).tpl[0]; $("#fStart").value = t[0]; $("#fEnd").value = t[1]; } checkDialog(); });
  $("#fCancel").addEventListener("click", function () { dlg.close(); });
  $("#fDelete").addEventListener("click", function () {
    var w = week(state.offset);
    w.shifts = w.shifts.filter(function (s) { return s.id !== editing.id; });
    save(); dlg.close(); render(); toast("Shift deleted");
  });
  $("#shiftForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var w = week(state.offset), s = draftFromForm();
    if (!s.start || !s.end) return;
    s.draft = true;
    if (editing.id) { w.shifts = w.shifts.map(function (o) { return o.id === editing.id ? s : o; }); }
    else { s.id = uid(); w.shifts.push(s); done("addShift"); }
    save(); dlg.close(); render();
    toast(editing.id ? "Shift updated (draft)" : "Shift added as a draft. Publish to notify your team.");
  });

  /* ---------- Leave & availability ---------- */
  function renderLeave() {
    var ls = LS(), loc = L();
    var pending = ls.leave.filter(function (l) { return l.status === "pending"; });
    var past = ls.leave.filter(function (l) { return l.status !== "pending"; });
    var h = '<div class="head"><h1>Availability &amp; leave</h1><span class="pill ' + (pending.length ? "amber" : "green") + '">' + pending.length + " pending</span></div>";
    h += '<div class="twocol"><div class="card"><h2>Leave requests</h2><p class="muted small">Approving leave frees the employee and turns their shifts on those days into open shifts.</p><div class="list">';
    if (!pending.length) h += '<p class="muted">All caught up. No pending requests.</p>';
    pending.concat(past).forEach(function (l) {
      var p = staffById(l.staff);
      var range = l.from === l.to ? md(new Date(l.from + "T00:00")) : md(new Date(l.from + "T00:00")) + " to " + md(new Date(l.to + "T00:00"));
      h += '<div class="req"><div class="avatar" style="background:' + p.color + '">' + initials(p.name) + '</div><div class="grow"><b>' + esc(p.name) + '</b> <span class="pill">' + esc(l.type) + '</span><br><span class="small">' + range + '</span>' + (l.note ? '<br><span class="muted small">' + esc(l.note) + "</span>" : "") + "</div>" +
        (l.status === "pending" ? '<button class="btn sm ghost" data-leave="decline|' + l.id + '">Decline</button><button class="btn sm primary" data-leave="approve|' + l.id + '">Approve</button>'
          : '<span class="pill ' + (l.status === "approved" ? "green" : "red") + '">' + (l.status === "approved" ? "Approved" : "Declined") + "</span>") + "</div>";
    });
    h += '</div></div><div class="card"><h2>Recurring availability</h2><p class="muted small">Click a day to toggle. Unavailable days are shaded on the schedule and flagged if someone gets booked.</p><table class="plain"><thead><tr><th>Employee</th>' + DAY_NAMES.map(function (d) { return "<th>" + d[0] + d[1] + "</th>"; }).join("") + "</tr></thead><tbody>";
    loc.staff.forEach(function (p) {
      h += "<tr><td><b>" + esc(p.name.split(" ")[0]) + '</b> <span class="muted small">' + esc(p.role) + "</span></td>";
      for (var d = 0; d < 7; d++) { var u = isUnavail(p.id, d); h += '<td><button class="av ' + (u ? "n" : "y") + '" style="border:0;cursor:pointer" data-avail="' + p.id + "|" + d + '" title="' + (u ? "Unavailable" : "Available") + '">' + (u ? "×" : "✓") + "</button></td>"; }
      h += "</tr>";
    });
    h += "</tbody></table></div></div>";
    main.innerHTML = h;
  }
  function decideLeave(action, id) {
    var ls = LS(), l = ls.leave.filter(function (x) { return x.id === id; })[0];
    if (!l) return;
    l.status = action === "approve" ? "approved" : "declined";
    var moved = 0;
    if (l.status === "approved") {
      Object.keys(ls.weeks).forEach(function (key) {
        var mon = new Date(key + "T00:00");
        ls.weeks[key].shifts.forEach(function (s) {
          if (s.staff !== l.staff) return;
          var d = iso(addDays(mon, s.day));
          if (d >= l.from && d <= l.to) { s.staff = null; s.draft = true; moved++; }
        });
      });
      done("approveLeave");
    }
    save(); render();
    var p = staffById(l.staff);
    toast(l.status === "approved" ? "Leave approved for " + p.name.split(" ")[0] + (moved ? ". " + moved + " shift" + (moved > 1 ? "s" : "") + " moved to open shifts." : ".") : "Leave declined. " + p.name.split(" ")[0] + " has been notified.");
  }

  /* ---------- Labor ---------- */
  function renderLabor() {
    var off = state.offset, w = week(off);
    var days = [];
    for (var d = 0; d < 7; d++) days.push({ s: 0, a: null, rev: revenue(off, d), sh: 0 });
    var byArea = {};
    w.shifts.forEach(function (s) {
      if (!s.staff) return;
      var c = costOf(s); days[s.day].s += c; days[s.day].sh += paidHours(s);
      byArea[s.area] = (byArea[s.area] || 0) + c;
      var a = actualFor(s, off);
      if (a) { days[s.day].a = (days[s.day].a || 0) + actualHours(a) * staffById(s.staff).rate; }
    });
    var max = Math.max.apply(null, days.map(function (x) { return Math.max(x.s, x.a || 0); })) || 1;
    var tS = 0, tA = 0, tR = 0, hasA = false;
    days.forEach(function (x) { tS += x.s; tR += x.rev; if (x.a != null) { tA += x.a; hasA = true; } });
    var pct = tS / tR * 100;

    var h = '<div class="head"><h1>Labor costs</h1><span class="spacer"></span>' + weekNav() + "</div>";
    h += '<div class="stats">' + stat(money(tR), "Forecast revenue") + stat(money(tS), "Scheduled labor cost") + stat(hasA ? money(tA) : "n/a", "Actual cost so far (from punches)") +
      stat(pct.toFixed(1) + "%", "Labor % (target " + TARGET_LABOR + "%)", pct > TARGET_LABOR ? "bad" : "good") + "</div>";
    h += '<div class="card"><div class="head"><h2>Daily labor cost vs. revenue</h2><span class="spacer"></span><span class="legend" style="margin:0"><span><i style="background:#6ee7b7"></i>Scheduled</span><span><i style="background:#047857"></i>Actual</span></span></div><div class="bars">';
    days.forEach(function (x) {
      h += '<div class="bargrp"><div class="bar s" style="height:' + (x.s / max * 100) + '%" title="Scheduled ' + money(x.s) + '"></div><div class="bar a" style="height:' + ((x.a || 0) / max * 100) + '%" title="' + (x.a != null ? "Actual " + money(x.a) : "No punches yet") + '"></div></div>';
    });
    h += '</div><div class="barlbl">';
    days.forEach(function (x, i) {
      var p = x.s / x.rev * 100;
      h += "<div><b>" + DAY_NAMES[i] + "</b>" + money(x.s) + '<br><span class="pct ' + (p > TARGET_LABOR ? "bad" : "good") + '">' + p.toFixed(0) + "%</span></div>";
    });
    h += "</div></div>";
    h += '<div class="twocol" style="margin-top:16px"><div class="card"><h2>Cost by area</h2>';
    AREAS.forEach(function (a) { var v = byArea[a.id] || 0; h += '<div style="margin:10px 0"><div style="display:flex;justify-content:space-between"><span><span class="av" style="background:' + a.color + ';width:10px;height:10px;display:inline-block;margin-right:6px"></span>' + esc(a.name) + "</span><b>" + money(v) + '</b></div><div class="meter"><div style="width:' + (tS ? v / tS * 100 : 0) + "%;background:" + a.color + '"></div></div></div>'; });
    h += '</div><div class="card"><h2>Labor % against target</h2><p class="muted small">Heyshift compares scheduled cost to forecast revenue before you publish, so you can trim or add coverage early.</p>';
    h += '<div class="meter" style="height:14px;margin:18px 0 8px"><div style="width:' + Math.min(100, pct / 50 * 100) + "%;background:" + (pct > TARGET_LABOR ? "#dc2626" : "#10b981") + '"></div><span class="target" style="left:' + (TARGET_LABOR / 50 * 100) + '%"></span></div>';
    h += '<div class="small muted" style="display:flex;justify-content:space-between"><span>0%</span><span>Target ' + TARGET_LABOR + '%</span><span>50%</span></div>';
    h += '<p style="margin-top:14px">' + (pct > TARGET_LABOR ? "You are <b>" + (pct - TARGET_LABOR).toFixed(1) + " points over</b> target. Try trimming a shift on a slower day (Mon to Wed) on the schedule." : "You are <b>within target</b> with " + (TARGET_LABOR - pct).toFixed(1) + " points to spare.") + "</p>";
    h += '<button class="btn" data-goto="schedule">Open schedule</button></div></div>';
    main.innerHTML = h;
    done("labor");
  }

  /* ---------- Attendance ---------- */
  function renderAttendance() {
    var off = state.offset, w = week(off);
    var rows = w.shifts.filter(function (s) { return s.staff; }).map(function (s) { return { s: s, a: actualFor(s, off) }; })
      .sort(function (x, y) { return x.s.day - y.s.day || mins(x.s.start) - mins(y.s.start); });
    var withA = rows.filter(function (r) { return r.a; });
    var schedH = 0, actH = 0, flagged = 0;
    withA.forEach(function (r) { schedH += paidHours(r.s); actH += actualHours(r.a); if (Math.abs(actualHours(r.a) - paidHours(r.s)) * 60 >= 15) flagged++; });
    var h = '<div class="head"><h1>Attendance</h1>' + (w.tsApproved ? '<span class="pill green">Approved for payroll</span>' : "") + '<span class="spacer"></span>' + weekNav() + "</div>";
    h += '<div class="stats">' + stat(hrs(schedH), "Scheduled (completed shifts)") + stat(hrs(actH), "Actual punched hours") + stat((actH - schedH >= 0 ? "+" : "") + hrs(actH - schedH), "Variance", actH - schedH > 1 ? "bad" : "good") + stat(String(flagged), "Shifts with 15+ min variance", flagged ? "bad" : "") + "</div>";
    if (!withA.length) {
      h += '<div class="card"><p>No punches yet for this week. Timesheets fill in as staff clock in and out on the app or kiosk.</p><button class="btn" data-act="lastweek">View last week</button></div>';
      main.innerHTML = h; return;
    }
    h += '<div class="card"><div class="head"><h2>Timesheets</h2><span class="spacer"></span><button class="btn primary" data-act="approveTs"' + (w.tsApproved ? " disabled" : "") + ">" + (w.tsApproved ? "Approved" : "Approve " + withA.length + " timesheets") + '</button><button class="btn" data-act="export">Export CSV</button></div>';
    h += '<div style="overflow-x:auto"><table class="plain"><thead><tr><th>Day</th><th>Employee</th><th>Scheduled</th><th>Clocked</th><th class="num">Paid hours</th><th class="num">Variance</th><th>Note</th></tr></thead><tbody>';
    withA.forEach(function (r) {
      var p = staffById(r.s.staff), v = Math.round((actualHours(r.a) - paidHours(r.s)) * 60);
      h += "<tr><td>" + DAY_NAMES[r.s.day] + " " + dateOf(off, r.s.day).getDate() + "</td><td><b>" + esc(p.name) + "</b></td><td>" + nice(r.s.start) + " to " + nice(r.s.end) + "</td><td>" + nice(r.a.start) + " to " + nice(r.a.end) + '</td><td class="num">' + hrs(actualHours(r.a)) +
        '</td><td class="num"><span class="pill ' + (Math.abs(v) >= 15 ? (v > 0 ? "red" : "amber") : "green") + '">' + (v > 0 ? "+" : "") + v + ' min</span></td><td class="muted small">' + esc(r.a.reason) + "</td></tr>";
    });
    h += "</tbody></table></div></div>";
    main.innerHTML = h;
  }
  function exportCsv() {
    var off = state.offset, w = week(off), lines = [["Date", "Employee", "Scheduled start", "Scheduled end", "Clock in", "Clock out", "Paid hours", "Rate", "Pay"].join(",")];
    w.shifts.forEach(function (s) {
      var a = s.staff && actualFor(s, off); if (!a) return;
      var p = staffById(s.staff), hh = actualHours(a);
      lines.push([iso(dateOf(off, s.day)), '"' + p.name + '"', s.start, s.end, fmtT(a.start), fmtT(a.end), hh.toFixed(2), p.rate, (hh * p.rate).toFixed(2)].join(","));
    });
    var blob = new Blob([lines.join("\n")], { type: "text/csv" }), a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "heyshift-timesheets-" + weekKey(off) + ".csv"; a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  /* ---------- Staff app ---------- */
  function renderApp() {
    var loc = L(), me = staffById(state.appStaff[loc.id]) || loc.staff[4] || loc.staff[0];
    var items = [];
    [0, 1].forEach(function (off) {
      week(off).shifts.forEach(function (s) { if (!s.draft) { var d = dateOf(off, s.day); if (d >= TODAY) items.push({ s: s, off: off, d: d }); } });
    });
    items.sort(function (a, b) { return a.d - b.d || mins(a.s.start) - mins(b.s.start); });
    var mine = items.filter(function (x) { return x.s.staff === me.id; });
    var open = items.filter(function (x) { return !x.s.staff; });
    var myH = mine.filter(function (x) { return x.off === 0; }).reduce(function (t, x) { return t + paidHours(x.s); }, 0);

    var h = '<div class="head"><h1>Staff app</h1><span class="pill">iOS and Android</span></div><div class="phonewrap"><div class="phone"><div class="screen">';
    h += '<div class="phead"><small>' + esc(loc.name.split(", ")[1] || loc.name) + "</small><h3 style=\"margin:4px 0 0\">Hi, " + esc(me.name.split(" ")[0]) + " 👋</h3><small>" + hrs(myH) + " scheduled this week</small></div><div class=\"pbody\">";
    h += '<div class="psec">My upcoming shifts</div>';
    if (!mine.length) h += '<div class="pempty">No published shifts yet.</div>';
    mine.slice(0, 6).forEach(function (x) {
      var a = area(x.s.area);
      h += '<div class="pcard" style="border-left:4px solid ' + a.color + '"><div class="t">' + x.d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) + '</div><div>' + nice(x.s.start) + " to " + nice(x.s.end) + '</div><div class="d">' + esc(a.name) + " · " + (x.s.brk || 0) + ' min break</div><button class="btn sm" style="margin-top:8px" data-offer="' + x.off + "|" + x.s.id + '">Offer shift</button></div>';
    });
    h += '<div class="psec">Open shifts</div>';
    if (!open.length) h += '<div class="pempty">No open shifts right now.</div>';
    open.forEach(function (x) {
      h += '<div class="pcard"><div class="t">' + x.d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) + " · " + nice(x.s.start) + " to " + nice(x.s.end) + '</div><div class="d">' + esc(area(x.s.area).name) + " · earns about " + money(paidHours(x.s) * me.rate) + '</div><button class="btn sm primary" style="margin-top:8px" data-claim="' + x.off + "|" + x.s.id + '">Claim shift</button></div>';
    });
    h += '<div class="psec">Team channel</div><div class="pcard"><div class="t">' + esc(loc.staff[0].name) + '</div><div class="d">Delivery moved to 9am Friday, kitchen team please plan prep.</div></div>';
    h += "</div></div></div>";
    h += '<div class="side-note card"><h2>See it as your staff do</h2><p class="muted">Pick an employee to view their phone. Only <b>published</b> shifts appear here, so try publishing next week on the schedule and come back.</p><label class="small muted" for="appStaff">Viewing as</label><br><select id="appStaff" style="font:inherit;padding:8px;border-radius:8px;border:1px solid #e2e8f0;margin:6px 0 14px;width:100%">' +
      loc.staff.map(function (p) { return '<option value="' + p.id + '"' + (p.id === me.id ? " selected" : "") + ">" + esc(p.name) + " (" + esc(p.role) + ")</option>"; }).join("") + "</select>" +
      "<ul class=\"muted\" style=\"padding-left:18px;margin:0\"><li>Claim open shifts in one tap</li><li>Offer a shift to the team when plans change</li><li>Clock in and out on the phone or a shared kiosk</li><li>Location channels keep updates out of group texts</li></ul></div></div>";
    main.innerHTML = h;
  }
  function findShift(off, id) { return week(off).shifts.filter(function (s) { return s.id === id; })[0]; }

  /* ---------- events ---------- */
  $("#locSelect").innerHTML = LOCATIONS.map(function (l) { return '<option value="' + l.id + '">' + esc(l.name) + "</option>"; }).join("");
  $("#locSelect").addEventListener("change", function () { state.loc = this.value; save(); render(); toast("Switched to " + L().name); });
  $("#tabs").addEventListener("click", function (e) { var b = e.target.closest("button[data-tab]"); if (b) setTab(b.dataset.tab); });
  $("#tasks").addEventListener("click", function (e) { var li = e.target.closest("li[data-task]"); if (li) TASKS[+li.dataset.task].go(); });
  $("#resetBtn").addEventListener("click", function () {
    if (!confirm("Reset the demo? This restores all sample data and clears your progress.")) return;
    state = freshState(); save(); render(); toast("Demo reset");
  });

  main.addEventListener("change", function (e) {
    if (e.target.id === "appStaff") { state.appStaff[state.loc] = e.target.value; save(); render(); }
  });
  main.addEventListener("click", function (e) {
    var t = e.target, el;
    if ((el = t.closest("[data-shift]"))) { var sh = findShift(state.offset, el.dataset.shift); if (sh) openShift(sh); return; }
    if ((el = t.closest("[data-cell]"))) { var p = el.dataset.cell.split("|"); openShift(null, p[0] === "open" ? null : p[0], +p[1]); return; }
    if ((el = t.closest("[data-leave]"))) { var q = el.dataset.leave.split("|"); decideLeave(q[0], q[1]); return; }
    if ((el = t.closest("[data-goto]"))) { setTab(el.dataset.goto); return; }
    if ((el = t.closest("[data-avail]"))) {
      var r = el.dataset.avail.split("|"), list = LS().unavail[r[0]] = LS().unavail[r[0]] || [], d = +r[1], i = list.indexOf(d);
      if (i >= 0) list.splice(i, 1); else list.push(d);
      save(); render(); return;
    }
    if ((el = t.closest("[data-claim]"))) {
      var c = el.dataset.claim.split("|"), s = findShift(+c[0], c[1]), me = $("#appStaff").value;
      if (s) { s.staff = me; save(); done("claim"); render(); toast("Shift claimed. It is now on " + staffById(me).name.split(" ")[0] + "'s schedule."); }
      return;
    }
    if ((el = t.closest("[data-offer]"))) {
      var o = el.dataset.offer.split("|"), s2 = findShift(+o[0], o[1]);
      if (s2) { s2.staff = null; save(); render(); toast("Shift offered to the team as an open shift."); }
      return;
    }
    if (!(el = t.closest("[data-act]"))) return;
    var act = el.dataset.act, w = week(state.offset);
    if (act === "prev") { state.offset--; save(); render(); }
    else if (act === "next") { state.offset++; save(); render(); }
    else if (act === "today") { state.offset = 0; save(); render(); }
    else if (act === "lastweek") { state.offset = -1; save(); render(); }
    else if (act === "publish") {
      var n = 0; w.shifts.forEach(function (s) { if (s.draft) { s.draft = false; n++; } }); w.published = true;
      var people = {}; w.shifts.forEach(function (s) { if (s.staff) people[s.staff] = 1; });
      save(); done("publish"); render();
      toast(n + " shifts published. " + Object.keys(people).length + " team members notified on their phones.");
    } else if (act === "copy") {
      var prev = week(state.offset - 1);
      w.shifts = prev.shifts.map(function (s) { var c2 = Object.assign({}, s, { id: uid() + s.day + Math.random().toString(36).slice(2, 5), draft: true }); return c2; })
        .filter(function (s) { return !s.staff || !onLeave(s.staff, dateOf(state.offset, s.day), ["approved"]); });
      save(); render(); toast("Copied " + w.shifts.length + " shifts from the previous week as drafts.");
    } else if (act === "clear") {
      if (!confirm("Remove every shift from this week?")) return;
      w.shifts = []; save(); render(); toast("Week cleared");
    } else if (act === "approveTs") {
      w.tsApproved = true; save(); done("attendance"); render(); toast("Timesheets approved and ready for payroll export.");
    } else if (act === "export") { exportCsv(); }
  });

  render();
})();
