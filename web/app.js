(function () {
  'use strict';

  var DATA_URL = 'https://raw.githubusercontent.com/drgitt/seatseller/main/data/prices.json';
  var KEY = 'ss-v2', OLDKEY = 'ss-v1', PKEY = 'ss-prices';

  var TEAMS = {MIL:"Milwaukee Bucks",TOR:"Toronto Raptors",CHA:"Charlotte Hornets",ATL:"Atlanta Hawks",DET:"Detroit Pistons",HOU:"Houston Rockets",MEM:"Memphis Grizzlies",ORL:"Orlando Magic",BOS:"Boston Celtics",NYK:"New York Knicks",CLE:"Cleveland Cavaliers",POR:"Portland Trail Blazers",SAS:"San Antonio Spurs",LAC:"LA Clippers",LAL:"Los Angeles Lakers",OKC:"Oklahoma City Thunder",MIN:"Minnesota Timberwolves",IND:"Indiana Pacers",SAC:"Sacramento Kings",NOP:"New Orleans Pelicans",CHI:"Chicago Bulls",MIA:"Miami Heat",BKN:"Brooklyn Nets",PHX:"Phoenix Suns",PHI:"Philadelphia 76ers",UTA:"Utah Jazz",DEN:"Denver Nuggets",GSW:"Golden State Warriors",DAL:"Dallas Mavericks"};
  // [game number, date, opponent, tag]
  var GAMES = [
    [1,"2026-10-21","MIL","Home opener"],[2,"2026-10-23","TOR",""],[6,"2026-10-30","CHA","NBA Cup · 7 PM"],[8,"2026-11-04","ATL","Trae Young vs. his old team"],
    [13,"2026-11-12","DET",""],[14,"2026-11-15","HOU",""],[15,"2026-11-16","MEM",""],[18,"2026-11-22","ORL",""],
    [19,"2026-11-24","BOS","NBA Cup · NBC 8 PM"],[20,"2026-11-28","ORL",""],[25,"2026-12-12","CHA",""],[28,"2026-12-18","NYK",""],
    [30,"2026-12-22","TOR",""],[31,"2026-12-23","CLE",""],[32,"2026-12-26","POR","NBA TV"],
    [35,"2027-01-01","SAS","Wembanyama · NBA TV"],[36,"2027-01-03","LAC",""],[37,"2027-01-05","LAL",""],[38,"2027-01-07","OKC",""],[39,"2027-01-08","MIN",""],[40,"2027-01-11","ATL",""],
    [43,"2027-01-17","IND",""],[44,"2027-01-18","BOS",""],[49,"2027-01-28","SAC",""],
    [52,"2027-02-04","NOP",""],[54,"2027-02-08","CHI",""],[55,"2027-02-10","MIA",""],[56,"2027-02-12","BKN",""],[57,"2027-02-13","MIL",""],[58,"2027-02-15","PHX",""],[59,"2027-02-17","MIA",""],
    [65,"2027-03-06","UTA","Dybantsa vs. Utah"],[69,"2027-03-16","NYK",""],[70,"2027-03-18","PHI","NBA TV"],[73,"2027-03-24","DEN",""],[74,"2027-03-27","GSW",""],[75,"2027-03-28","DAL",""],[76,"2027-03-31","CHI",""],
    [77,"2027-04-02","PHI","LeBron visits"],[82,"2027-04-11","DET","Season finale"]
  ];
  var DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  var MON = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  var TIERNAME = {1:["This week","hot"],2:["Next week","warm"],3:["Week after","cool"]};
  var T0 = Date.now(), MIN_SPLASH = 1000, MAX_SPLASH = 8000;


  var WIZ_SEATS = "Section 109, Row E, seats 1-2";
  var WIZ = {id: "wiz", name: "Washington Wizards", league: "NBA", venue: "Capital One Arena", seats: WIZ_SEATS, seatCount: 2, face: "", builtin: true, games: []};
  var MKTS = [["TM","Ticketmaster",15],["SH","StubHub",10],["SG","SeatGeek",10],["VS","Vivid Seats",10],["TP","TickPick",10],["OT","Other",10]];
  var state = {v: 2, active: "wiz", all: false, teams: [WIZ], prices: {}, sales: {}, mhist: {}, prefs: {theme: "system", weeks: 3, view: "soon", drop: 25, jump: 15, usual: "TM", target: 10, digestOn: true, digestHour: 8, setupDone: false, listDays: 3, lastCall: true, sort: "date", spike: 25, weather: true, fees: {TM: 15, SH: 10, SG: 10, VS: 10, TP: 10, OT: 10}}};
  var RECORDS = {}, SCHED = {}, HIST = {}, WX = {};
  var MARKET = {}, ALERTS = [], UPDATED = null, FETCH_NOTE = "";
  var Native = null;

  try {
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
      Native = window.Capacitor.registerPlugin('SeatSeller');
    }
  } catch (e) { Native = null; }

  function load() {
    var s = null;
    try { s = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
    if (s && s.teams && s.teams.length) {
      state.teams = s.teams; state.active = s.active || s.teams[0].id; state.all = !!s.all; state.prices = s.prices || {}; state.sales = s.sales || {}; state.mhist = s.mhist || {};
      for (var k in state.prefs) if (k !== "fees" && s.prefs && s.prefs[k] != null) state.prefs[k] = s.prefs[k];
      if (s.prefs && s.prefs.fees) for (var m in s.prefs.fees) state.prefs.fees[m] = s.prefs.fees[m];
    } else {
      try {
        var o = JSON.parse(localStorage.getItem(OLDKEY) || "null");
        if (o) { WIZ.face = o.face || ""; WIZ.seats = o.label || WIZ.seats; state.prices.wiz = o.prices || {}; state.all = !!o.all; }
      } catch (e) {}
      state.all = state.all || false;
    }
    if (!state.teams.some(function (t) { return t.id === state.active; })) state.active = state.teams[0].id;
    if (!state.prefs.tmDefault) { state.prefs.tmDefault = 1; state.prefs.usual = "TM"; }
    Object.keys(state.sales).forEach(function (tid) { var S = state.sales[tid]; Object.keys(S).forEach(function (g) { if (!Array.isArray(S[g])) S[g] = [S[g]]; }); });
    state.teams.forEach(function (t) { if (t.id === "wiz" && (!t.seats || /rows E1 and E2/i.test(t.seats))) t.seats = WIZ_SEATS; });
    try { var p = JSON.parse(localStorage.getItem(PKEY) || "null"); if (p) applyPrices(p); } catch (e) {}
    try { WX = JSON.parse(localStorage.getItem("ss-wx") || "{}") || {}; } catch (e) { WX = {}; }
  }
  var pushT = null;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
    clearTimeout(pushT); pushT = setTimeout(afterSave, 900);
  }
  function afterSave() {
    if (!Native) return;
    try { Native.setBackupData({json: backupJSON()}); } catch (e) {}
    syncReminders(); pushWidget(); pushDigest();
  }
  function backupJSON() { return JSON.stringify({app: "SeatSeller", version: 1, exportedAt: new Date().toISOString(), state: state}); }
  function applyPrices(p) {
    MARKET = (p && p.games) || {}; ALERTS = (p && p.alerts) || []; UPDATED = (p && p.updatedAt) || null; RECORDS = (p && p.records) || {}; HIST = (p && p.history) || {};
    SCHED = {}; ((p && p.scheduleChanges) || []).forEach(function (c) { if (c && c.game != null && c.to) SCHED["g" + c.game] = c; });
  }

  function $(id) { return document.getElementById(id); }
  function today() { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
  function parse(d) { var p = d.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function daysAway(d) { return Math.round((parse(d) - today()) / 86400000); }
  function weeks() { return Math.min(3, Math.max(1, +state.prefs.weeks || 3)); }
  function tier(n) { return n < 0 ? 0 : n <= 6 ? 1 : n <= 13 ? 2 : n <= 20 ? 3 : 4; }
  function accent(t) { return t >= 1 && t <= weeks(); }
  function enc(s) { return encodeURIComponent(s); }
  function money(v) { return v === "" || v == null ? "" : "$" + Number(v).toLocaleString(); }
  function fmtDay(ts) { var d = new Date(ts); return MON[d.getMonth()].slice(0, 3) + " " + d.getDate(); }
  function fmtTime(ts) {
    var d = new Date(ts), h = d.getHours(), m = d.getMinutes(), ap = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12; return fmtDay(ts) + ", " + h + ":" + (m < 10 ? "0" : "") + m + " " + ap;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }
  function whenLabel(n) { return n === 0 ? "Tonight" : n === 1 ? "Tomorrow" : "In " + n + " days"; }

  /* ---------- teams and games ---------- */
  function salesOf(T, g) { var v = (state.sales[T.id] || {})[g]; return !v ? [] : Array.isArray(v) ? v : [v]; }
  function setSales(T, g, arr) { var S = state.sales[T.id] || (state.sales[T.id] = {}); if (arr.length) S[g] = arr; else delete S[g]; }
  function seatsOwned(T) { return Math.max(1, parseInt(T.seatCount, 10) || 2); }
  function soldN(T, g) { return salesOf(T, g).reduce(function (a, x) { return a + (x.n || 0); }, 0); }
  function seatsLeft(T, g) { return Math.max(0, seatsOwned(T) - soldN(T, g)); }
  function fullySold(T, g) { return soldN(T, g) > 0 && seatsLeft(T, g) === 0; }
  function team() { for (var i = 0; i < state.teams.length; i++) if (state.teams[i].id === state.active) return state.teams[i]; return state.teams[0]; }
  function prices() { return state.prices[state.active] || (state.prices[state.active] = {}); }
  function games(t) {
    t = t || team();
    var list = t.id === "wiz" ? GAMES.map(function (G) { var c = SCHED["g" + G[0]]; return {id: G[0], date: c ? c.to : G[1], was: c ? G[1] : null, opp: TEAMS[G[2]], short: G[2], tag: G[3], builtin: true}; }) : [];
    (t.games || []).forEach(function (g) { list.push({id: g.id, date: g.date, opp: g.opp, tag: g.tag || "", builtin: false}); });
    return list.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  }
  var NICK2 = ["Trail Blazers","Red Sox","White Sox","Blue Jays","Red Wings","Blue Jackets","Maple Leafs","Golden Knights"];
  function nick(n) { n = String(n || ""); for (var i = 0; i < NICK2.length; i++) if (n.slice(-NICK2[i].length) === NICK2[i]) return NICK2[i]; return n.split(" ").pop(); }
  function dbTeam(name, lg) { var c = candidates(name, lg); return c.length === 1 ? c[0] : null; }
  function isDivRival(T, G) {
    var a = dbTeam(T.name, T.league), b = dbTeam(G.opp, T.league || (a && a.lg));
    return !!(a && b && a.div && a.div === b.div && a.name !== b.name);
  }
  function fee(mk) { var f = parseFloat(state.prefs.fees[mk]); return isNaN(f) ? 10 : f; }
  function net(price, mk) { return price * (1 - fee(mk) / 100); }
  function mkName(k) { for (var i = 0; i < MKTS.length; i++) if (MKTS[i][0] === k) return MKTS[i][1]; return k; }
  function recText(T, G) {
    var a = RECORDS[T.name], b = RECORDS[G.opp];
    return nick(T.name) + " " + (a || "—") + " · " + nick(G.opp) + " " + (b || "—");
  }
  function marketFor(G, T) { return (T || team()).id === "wiz" && G.builtin ? MARKET["g" + G.id] : null; }

  function parseGameLines(text) {
    var out = [], bad = 0;
    String(text || "").split(/\r?\n/).forEach(function (line) {
      line = line.trim(); if (!line) return;
      var m = line.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s*[-,:]?\s*(.*)$/), y, mo, d, rest;
      if (m) { y = +m[1]; mo = +m[2]; d = +m[3]; rest = m[4]; }
      else {
        m = line.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})\s*[-,:]?\s*(.*)$/);
        if (!m) { bad++; return; }
        mo = +m[1]; d = +m[2]; y = +m[3]; if (y < 100) y += 2000; rest = m[4];
      }
      if (mo < 1 || mo > 12 || d < 1 || d > 31) { bad++; return; }
      var parts = rest.split("|"), opp = parts[0].replace(/^(vs\.?|v\.?|against)\s+/i, "").trim(), tag = (parts[1] || "").trim();
      if (!opp) { bad++; return; }
      out.push({id: "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), date: y + "-" + (mo < 10 ? "0" : "") + mo + "-" + (d < 10 ? "0" : "") + d, opp: opp, tag: tag});
    });
    return {games: out, bad: bad};
  }

  /* ---------- signals ---------- */
  function signal(g) {
    var p = prices()[g] || {}, face = parseFloat(team().face), lo = parseFloat(p.lo);
    if (isNaN(lo)) return ["No price logged", ""];
    if (isNaN(face) || face <= 0) return ["Low " + money(lo), "cool"];
    var diff = lo - face;
    if (diff >= 0) return ["Resale " + (diff === 0 ? "at" : "$" + Math.round(diff) + " over") + " face", "good"];
    return ["$" + Math.round(-diff) + " under face", "warm"];
  }

  function fastInfo(G, T) {
    T = T || team();
    var p = (state.prices[T.id] || {})[G.id] || {}, h = p.hist || [], now = Date.now(), why = [];
    var drop = Math.max(1, +state.prefs.drop || 25), jump = Math.max(1, +state.prefs.jump || 15);
    if (h.length >= 2) {
      var last = h[h.length - 1], base = null;
      for (var i = 0; i < h.length - 1; i++) { if (now - h[i].t <= 7 * 86400000) { base = h[i]; break; } }
      if (base && base.n > 0 && base.n - last.n >= 2 && last.n <= base.n * (1 - drop / 100)) why.push("seats down " + Math.round((1 - last.n / base.n) * 100) + "% since " + fmtDay(base.t));
    }
    var m = marketFor(G, T);
    if (m && m.low != null && m.prevLow > 0 && m.low >= m.prevLow * (1 + jump / 100)) why.push("market low up " + Math.round((m.low / m.prevLow - 1) * 100) + "%");
    if (m && m.hot) why.push("marketplace shows low inventory");
    return why;
  }

  function rowHTML(G) {
    var g = G.id, n = daysAway(G.date), t = tier(n), d = parse(G.date), name = G.opp, T = team();
    var q = T.name + " " + name, p = prices()[g] || {}, sig = signal(g), hot = accent(t);
    var cls = "game" + (hot ? " t" + t : "");
    var pills = "";
    if (hot) pills += '<span class="pill ' + TIERNAME[t][1] + '">' + TIERNAME[t][0] + '</span><span class="pill ' + TIERNAME[t][1] + '">' + whenLabel(n) + '</span>';
    if (isDivRival(T, G)) pills += '<span class="pill div">Division rival</span>';
    if (G.was) pills += '<span class="pill warm">Moved from ' + fmtDay(parse(G.was).getTime()) + '</span>';
    var sales = salesOf(T, g), left = seatsLeft(T, g), sale = sales.length > 0;
    sales.forEach(function (x, i) { pills += '<button type="button" class="pill good sbtn" data-sale="' + esc(g) + ':' + i + '" aria-label="Edit sale">' + esc(saleText(x)) + '</button>'; });
    if (sale && left > 0) pills += '<span class="pill cool">' + left + ' of ' + seatsOwned(T) + ' seat' + (seatsOwned(T) > 1 ? "s" : "") + ' left</span>';
    var dm = demand(T, G); pills += '<span class="pill ' + (dm >= 75 ? "hot" : dm >= 55 ? "warm" : "cool") + '" title="Demand score from day of week, rivalry, opponent, records and special dates">Demand ' + dm + '</span>';
    pills += '<span class="pill warm" id="wx-' + g + '" hidden></span><span class="pill hot" id="spk-' + g + '" hidden></span>';
    pills += '<span class="pill hot" id="fast-' + g + '" hidden></span>';
    pills += '<span class="pill ' + sig[1] + '" id="sig-' + g + '">' + sig[0] + '</span>';
    pills += '<span class="mk" id="mk-' + g + '"></span><span class="mk" id="sd-' + g + '"></span><span class="mk" id="nt-' + g + '"></span>';
    var tag = G.tag ? '<span>' + esc(G.tag) + '</span>' : '';
    var idl = G.builtin ? '<span class="mono">G' + g + '</span>' : '<button type="button" class="x" data-del="' + esc(g) + '" aria-label="Remove game vs ' + esc(name) + '">Remove</button>';
    return '<div class="' + cls + '" id="g' + g + '">' +
      '<div class="date"><span class="dow">' + DOW[d.getDay()] + '</span><span class="dnum">' + d.getDate() + '</span></div>' +
      '<div class="who"><div class="opp">vs ' + esc(name) + '</div><div class="rec" id="rec-' + g + '">' + esc(recText(T, G)) + '</div><div class="advice" id="adv-' + g + '"></div><div class="meta">' + pills + tag + idl + '</div><div class="spark" id="sp-' + g + '"></div>' + (sale ? afterRows(g, sales) : '') + '</div>' +
      '<div class="act"><div class="prices">' +
        '<input type="number" inputmode="numeric" min="0" step="1" id="se-' + g + '" data-g="' + esc(g) + '" data-k="seats" placeholder="Seats" aria-label="Seats listed in my section for ' + esc(name) + '" value="' + (p.seats || "") + '">' +
        '<input type="number" inputmode="decimal" min="0" id="lo-' + g + '" data-g="' + esc(g) + '" data-k="lo" placeholder="Low $" aria-label="Lowest price in my rows for ' + esc(name) + '" value="' + (p.lo || "") + '">' +
        '<input type="number" inputmode="decimal" min="0" id="hi-' + g + '" data-g="' + esc(g) + '" data-k="hi" placeholder="High $" aria-label="Highest price in my rows for ' + esc(name) + '" value="' + (p.hi || "") + '">' +
      '</div><a class="sell" href="https://myaccount.ticketmaster.com/" target="_blank" rel="noopener">Sell</a></div>' +
      '<div class="links">' +
        '<a href="https://www.ticketmaster.com/search?q=' + enc(q) + '" target="_blank" rel="noopener">Ticketmaster</a>' +
        '<a href="https://www.stubhub.com/find/s/?q=' + enc(q) + '" target="_blank" rel="noopener">StubHub</a>' +
        '<a href="https://seatgeek.com/search?search=' + enc(q) + '" target="_blank" rel="noopener">SeatGeek</a>' +
        '<a href="https://www.vividseats.com/search?searchTerm=' + enc(q) + '" target="_blank" rel="noopener">Vivid Seats</a>' +
        '<button type="button" class="lb" data-list="' + esc(g) + '">List helper</button>' +
        (left > 0 ? '<button type="button" class="lb" data-sold="' + esc(g) + '">' + (sale ? 'Sell remaining' : 'Mark sold') + '</button>' : '') +
        '<button type="button" class="lb" data-cal="' + esc(g) + '">Calendar</button>' +
      '</div></div>';
  }

  function saleText(x) { return "Sold " + x.n + " × " + money(x.price) + " · net " + money(Math.round(x.n * net(x.price, x.mk) * 100) / 100) + " after " + mkName(x.mk); }
  function paintNet(G) {
    var el = $("nt-" + G.id); if (!el) return;
    var p = prices()[G.id] || {}, lo = parseFloat(p.lo), parts = [], mk = state.prefs.usual;
    if (!isNaN(lo) && lo > 0) parts.push("your low nets ≈ " + money(Math.round(net(lo, mk))) + " on " + mkName(mk) + " (" + fee(mk) + "% fee)");
    el.textContent = parts.join(" · ");
  }
  function paintFast(G) {
    var g = G.id, el = $("fast-" + g), sd = $("sd-" + g); if (!el || !sd) return;
    var why = fastInfo(G);
    if (why.length) { el.hidden = false; el.textContent = "Selling fast · " + why[0]; } else { el.hidden = true; el.textContent = ""; }
    var h = (prices()[g] || {}).hist || [];
    if (h.length) {
      var last = h[h.length - 1], t = "Mine: " + last.n + " seats";
      if (h.length > 1) { var d = last.n - h[h.length - 2].n; t += " (" + (d > 0 ? "+" : d < 0 ? "−" : "±") + Math.abs(d) + " since " + fmtDay(h[h.length - 2].t) + ")"; }
      sd.textContent = t;
    } else { sd.textContent = ""; }
  }

  function paintMarkets() {
    games().forEach(function (G) {
      paintFast(G); paintNet(G); paintAdvice(G); paintSpark(G); paintSpike(G);
      var el = $("mk-" + G.id); if (!el) return;
      var m = marketFor(G);
      if (m && m.low != null) {
        var dt = m.checkedAt ? new Date(m.checkedAt) : null;
        el.textContent = "Market low " + money(m.low) + (m.source ? " · " + m.source : "") + (m.listings ? " · " + m.listings + " listings" : "") + (dt && !isNaN(dt) ? " · " + fmtDay(dt.getTime()) : "") + " · nets ≈ " + money(Math.round(net(m.low, state.prefs.usual)));
      } else { el.textContent = ""; }
    });
  }

  function paintAlerts() {
    var box = $("alerts"), now = Date.now();
    if (team().id !== "wiz") { box.hidden = true; box.innerHTML = ""; return; }
    var list = ALERTS.filter(function (a) { var t = a.t ? new Date(a.t).getTime() : now; return now - t <= 72 * 3600000; })
      .sort(function (a, b) { return new Date(b.t || 0) - new Date(a.t || 0); }).slice(0, 3);
    if (!list.length) { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    box.innerHTML = list.map(function (a) { return '<div class="alert"><b>' + esc(a.title || "Alert") + '</b><span>' + esc(a.body || "") + '</span></div>'; }).join("");
  }

  function stats() {
    var up = games().filter(function (G) { return daysAway(G.date) >= 0; });
    var next = up[0], wk = up.filter(function (G) { return daysAway(G.date) <= 6; }).length;
    var fast = up.filter(function (G) { return fastInfo(G).length > 0; }).length;
    var best = null, P = prices();
    up.forEach(function (G) { var p = P[G.id]; if (p && p.lo !== "" && p.lo != null && (!best || +p.lo > +P[best.id].lo)) best = G; });
    var h = '<div class="stat"><b>' + (next ? whenLabel(daysAway(next.date)) : "No games") + '</b><span>' + (next ? "Next: " + esc(next.opp) : "Add home games") + '</span></div>';
    h += '<div class="stat"><b>' + wk + '</b><span>Games this week</span></div>';
    h += '<div class="stat"><b' + (fast ? ' style="color:var(--hot)"' : '') + '>' + fast + '</b><span>Selling fast</span></div>';
    h += '<div class="stat"><b>' + (best ? money(P[best.id].lo) : "—") + '</b><span>' + (best ? "Best low: " + esc(best.opp) : "Best logged low") + '</span></div>';
    $("stats").innerHTML = h;
  }

  function paintFresh() {
    var el = $("fresh");
    if (team().id !== "wiz") { el.textContent = "Prices for this team are the ones you log"; return; }
    if (UPDATED) el.textContent = "Prices updated " + fmtTime(new Date(UPDATED).getTime()) + (FETCH_NOTE ? " · " + FETCH_NOTE : "");
    else el.textContent = FETCH_NOTE || "No market prices yet";
  }

  function paintTeamSel() {
    var sel = $("teamSel");
    sel.innerHTML = state.teams.map(function (t) { return '<option value="' + esc(t.id) + '"' + (t.id === state.active ? " selected" : "") + '>' + esc(t.name) + '</option>'; }).join("") + '<option value="__add">＋ Add team / venue…</option>';
    sel.value = state.active;
  }

  function render() {
    var T = team(), w = weeks();
    var all = games().filter(function (G) { return tier(daysAway(G.date)) !== 0; });
    var rows = all.filter(function (G) { return state.all || accent(tier(daysAway(G.date))); });
    INS = null;
    var byDemand = state.prefs.sort === "demand";
    if (byDemand) rows.sort(function (a, b) { return demand(T, b) - demand(T, a); });
    var out = "", lastM = "";
    rows.forEach(function (G) {
      var d = parse(G.date), m = MON[d.getMonth()] + " " + d.getFullYear();
      if (!byDemand && m !== lastM) { out += '<div class="month">' + m + '</div>'; lastM = m; }
      out += rowHTML(G);
    });
    if (!games().length) {
      out = '<div class="start"><b>No home games yet for ' + esc(T.name) + '.</b><span class="hint">Add them one at a time, or paste the whole schedule in one go.</span><button type="button" class="btn" data-act="addgames">Add home games</button></div>';
    } else if (!out) {
      out = '<div class="empty">No home games in the next ' + w + ' week' + (w > 1 ? "s" : "") + '. Switch to all home games to see the rest of the season.</div>';
    }
    $("list").innerHTML = out;
    $("f-soon").textContent = "Next " + w + " week" + (w > 1 ? "s" : "");
    $("f-soon").setAttribute("aria-pressed", String(!state.all));
    $("f-all").setAttribute("aria-pressed", String(state.all));
    paintTeamSel();
    $("sub").textContent = (T.venue || "Venue not set") + (T.seats ? " · " + T.seats : "");
    $("foot").textContent = T.id === "wiz" ? "Schedule from the NBA release in August 2026. Two December dates are still unannounced; use Add games when they are set. What you type stays on this phone." : "What you type stays on this phone. Use Add games to put in more home dates.";
    paintMarkets(); paintAlerts(); paintFresh(); stats(); paintWeather(); ensureWeather(T);
  }

  function applyTheme() {
    var th = state.prefs.theme, r = document.documentElement;
    if (th === "light" || th === "dark") r.setAttribute("data-theme", th); else r.removeAttribute("data-theme");
  }

  function fetchJSON(url, ms) {
    var ctl = window.AbortController ? new AbortController() : null, to = ctl ? setTimeout(function () { ctl.abort(); }, ms || 6000) : null;
    return fetch(url, {cache: "no-store", signal: ctl ? ctl.signal : undefined}).then(function (r) {
      if (to) clearTimeout(to);
      if (!r.ok) { var e = new Error("HTTP " + r.status); e.status = r.status; throw e; } return r.json();
    }, function (e) { if (to) clearTimeout(to); throw e; });
  }

  function loadPrices() {
    return fetchJSON(DATA_URL + "?t=" + Date.now()).then(function (p) {
      applyPrices(p); FETCH_NOTE = "";
      try { localStorage.setItem(PKEY, JSON.stringify(p)); } catch (e) {}
      recordMarket(); render(); syncReminders(); pushWidget();
    }).catch(function (e) {
      FETCH_NOTE = e && e.status === 404 ? "price feed not reachable (repo may be private)" : "offline, showing saved prices";
      if (!UPDATED) {
        return fetchJSON("prices.seed.json", 3000).then(function (p) { applyPrices(p); render(); }).catch(function () { render(); });
      } render();
    });
  }

  /* ---------- venue autofill ---------- */
  function norm(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim(); }
  function candidates(q, lg) {
    var n = norm(q); if (!n) return [];
    var db = window.TEAM_DB || [];
    if (lg && lg !== "Other") db = db.filter(function (t) { return t.lg === lg; });
    var exact = db.filter(function (t) { return norm(t.name) === n; });
    if (exact.length) return exact;
    var nick = db.filter(function (t) { var tn = norm(t.name); return tn.split(" ").slice(1).join(" ") === n || tn.split(" ").pop() === n; });
    if (nick.length) return nick;
    return db.filter(function (t) { var tn = norm(t.name); return tn.indexOf(n) !== -1 || (n.length > 4 && n.indexOf(tn) !== -1); });
  }
  function fillDatalist() {
    var lg = $("tLeague").value, db = window.TEAM_DB || [];
    if (lg && lg !== "Other") db = db.filter(function (t) { return t.lg === lg; });
    $("teamList").innerHTML = db.map(function (t) { return '<option value="' + esc(t.name) + '">' + t.lg + '</option>'; }).join("");
  }
  var venueDirty = false, lookupSeq = 0;
  function setStatus(msg, cls) { var el = $("tStatus"); el.textContent = msg; el.className = "hint" + (cls ? " " + cls : ""); }
  function autofillVenue() {
    var name = $("tName").value.trim(), lg = $("tLeague").value, seq = ++lookupSeq;
    if (!name) { setStatus("Pick a team and the venue fills in. If it can't be found, type it yourself."); return; }
    var c = candidates(name, lg);
    if (c.length === 1) {
      if (!venueDirty) $("tVenue").value = c[0].venue;
      if (!lg) $("tLeague").value = c[0].lg;
      setStatus("Venue found: " + c[0].venue + " (" + c[0].lg + "). Change it if your seats are elsewhere.", "ok"); return;
    }
    if (c.length > 1) { setStatus("Several teams match (" + c.slice(0, 4).map(function (t) { return t.name; }).join(", ") + "). Choose the league or type the full team name.", "warn"); return; }
    if (venueDirty) return;
    setStatus("Not in my list. Looking online…");
    if (!navigator.onLine) { setStatus("No match, and you're offline. Type the venue yourself.", "warn"); return; }
    fetchJSON("https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=" + enc(name), 5000).then(function (r) {
      if (seq !== lookupSeq || venueDirty) return;
      var t = r && r.teams && r.teams[0];
      if (t && t.strStadium) { $("tVenue").value = t.strStadium; if (!lg && t.strLeague) $("tLeague").value = "Other"; setStatus("Venue found online: " + t.strStadium + ". Check it is right.", "ok"); }
      else setStatus("Couldn't find that venue. Type it in yourself.", "warn");
    }).catch(function () { if (seq === lookupSeq) setStatus("Couldn't find that venue. Type it in yourself.", "warn"); });
  }

  /* ---------- native notifications bridge ---------- */
  function paintNative() {
    if (!Native) return;
    Native.getStatus().then(function (s) {
      $("permBanner").hidden = !!s.enabled;
      $("notifStatus").textContent = s.enabled ? "Notifications are on. SeatSeller checks for new alerts about every 3 hours." : "Notifications are off. Turn them on to hear about games that are selling fast.";
      $("checkResult").textContent = s.lastCheck ? "Last check " + fmtTime(s.lastCheck) + (s.lastResult ? " · " + s.lastResult : "") : "No background check yet.";
      $("testBtn").disabled = !s.enabled;
    }).catch(function () {});
  }
  function wireNative() {
    if (!Native) { $("testBtn").disabled = true; $("checkBtn").disabled = true; return; }
    $("permBtn").addEventListener("click", function () { Native.requestPermission().then(paintNative).catch(paintNative); });
    $("testBtn").addEventListener("click", function () { Native.testNotification().then(paintNative).catch(function () {}); });
    $("checkBtn").addEventListener("click", function () {
      var b = $("checkBtn"); b.disabled = true; $("checkResult").textContent = "Checking…";
      Native.checkNow().then(function () { b.disabled = false; paintNative(); loadPrices(); }).catch(function () { b.disabled = false; paintNative(); });
    });
    paintNative();
    document.addEventListener("visibilitychange", function () { if (!document.hidden) { paintNative(); loadPrices(); } });
  }

  /* ---------- dialogs and events ---------- */
  function openDlg(d) { if (d.showModal) d.showModal(); else d.setAttribute("open", ""); }
  function closeDlg(d) { if (d.close) d.close(); else d.removeAttribute("open"); }

  function openSettings() {
    var T = team();
    $("setTeamName").textContent = "· " + T.name;
    $("setVenue").value = T.venue || ""; $("seatlabel").value = T.seats || ""; $("face").value = T.face || "";
    $("prefTheme").value = state.prefs.theme; $("prefWeeks").value = String(weeks()); $("prefView").value = state.prefs.view;
    $("prefDrop").value = state.prefs.drop; $("prefJump").value = state.prefs.jump;
    $("prefUsual").value = state.prefs.usual; $("prefListDays").value = state.prefs.listDays; $("prefLastCall").checked = !!state.prefs.lastCall;
    [].forEach.call(document.querySelectorAll("[data-fee]"), function (i) { i.value = state.prefs.fees[i.dataset.fee]; });
    paintBackup();
    $("removeTeam").disabled = state.teams.length < 2;
    $("prefTarget").value = state.prefs.target; $("prefDigest").checked = state.prefs.digestOn !== false; $("prefDigestHour").value = state.prefs.digestHour || 8;
    $("prefSort").value = state.prefs.sort; $("prefSpike").value = state.prefs.spike; $("prefWeather").checked = !!state.prefs.weather;
    $("tSeatCount").value = T.seatCount || 2; $("tPartner").value = (T.partner && T.partner.name) || ""; $("tPartnerPct").value = (T.partner && T.partner.pct) || 50;
    paintNative(); openDlg($("settingsDlg"));
  }
  function openTeamDlg() {
    $("teamForm").reset(); venueDirty = false; lookupSeq++; fillDatalist();
    setStatus("Pick a team and the venue fills in. If it can't be found, type it yourself.");
    openDlg($("teamDlg"));
  }
  function openGameDlg() { $("gameForm").reset(); $("gStatus").textContent = ""; openDlg($("gameDlg")); }

  function wire() {
    applyTheme();
    $("f-soon").addEventListener("click", function () { state.all = false; save(); render(); });
    $("f-all").addEventListener("click", function () { state.all = true; save(); render(); });
    $("gearBtn").addEventListener("click", openSettings);
    $("addGameBtn").addEventListener("click", openGameDlg);

    $("teamSel").addEventListener("change", function (e) {
      if (e.target.value === "__add") { e.target.value = state.active; openTeamDlg(); return; }
      state.active = e.target.value; state.all = state.prefs.view === "all"; save(); render();
    });

    // settings: this team
    $("setVenue").addEventListener("input", function (e) { team().venue = e.target.value; save(); $("sub").textContent = (team().venue || "Venue not set") + (team().seats ? " · " + team().seats : ""); });
    $("seatlabel").addEventListener("input", function (e) { team().seats = e.target.value; save(); $("sub").textContent = (team().venue || "Venue not set") + (team().seats ? " · " + team().seats : ""); });
    $("face").addEventListener("input", function (e) {
      team().face = e.target.value; save();
      games().forEach(function (G) { var el = $("sig-" + G.id); if (el) { var s = signal(G.id); el.textContent = s[0]; el.className = "pill " + s[1]; } });
    });
    $("resetPrices").addEventListener("click", function () { if (confirm("Clear every price and seat count you logged for " + team().name + "?")) { state.prices[state.active] = {}; save(); render(); } });
    $("removeTeam").addEventListener("click", function () {
      if (state.teams.length < 2) return;
      if (!confirm("Remove " + team().name + " and everything you logged for it?")) return;
      var id = state.active; state.teams = state.teams.filter(function (t) { return t.id !== id; }); delete state.prices[id];
      state.active = state.teams[0].id; save(); closeDlg($("settingsDlg")); render();
    });
    // settings: preferences
    $("prefTheme").addEventListener("change", function (e) { state.prefs.theme = e.target.value; save(); applyTheme(); });
    $("prefWeeks").addEventListener("change", function (e) { state.prefs.weeks = +e.target.value; save(); render(); });
    $("prefView").addEventListener("change", function (e) { state.prefs.view = e.target.value; state.all = e.target.value === "all"; save(); render(); });
    $("prefDrop").addEventListener("change", function (e) { var v = Math.min(90, Math.max(5, +e.target.value || 25)); e.target.value = v; state.prefs.drop = v; save(); paintMarkets(); stats(); });
    $("prefJump").addEventListener("change", function (e) { var v = Math.min(90, Math.max(5, +e.target.value || 15)); e.target.value = v; state.prefs.jump = v; save(); paintMarkets(); stats(); });

    // add team
    $("tLeague").addEventListener("change", function () { fillDatalist(); autofillVenue(); });
    $("tName").addEventListener("change", autofillVenue);
    $("tName").addEventListener("blur", autofillVenue);
    $("tName").addEventListener("input", function () { var n = norm($("tName").value); if (candidates(n, $("tLeague").value).length === 1 && n.length > 3) autofillVenue(); });
    $("tVenue").addEventListener("input", function () { venueDirty = !!$("tVenue").value; });
    $("teamForm").addEventListener("submit", function (e) {
      if (e.submitter && e.submitter.value !== "save") return;
      var name = $("tName").value.trim(), venue = $("tVenue").value.trim();
      if (!name) { e.preventDefault(); $("tName").focus(); return; }
      if (!venue) { e.preventDefault(); setStatus("Enter the venue, then add the team.", "warn"); $("tVenue").focus(); return; }
      var dup = state.teams.filter(function (t) { return norm(t.name) === norm(name) && norm(t.venue) === norm(venue); })[0];
      var id = dup ? dup.id : norm(name).replace(/ /g, "-") + "-" + Date.now().toString(36);
      var parsed = parseGameLines($("tGames").value);
      if (dup) { dup.seats = $("tSeats").value.trim() || dup.seats; state.active = dup.id; dup.games = (dup.games || []).concat(parsed.games); }
      else {
        state.teams.push({id: id, name: name, league: $("tLeague").value || "", venue: venue, seats: $("tSeats").value.trim(), face: $("tFace").value, builtin: false, games: parsed.games});
        state.active = id;
      }
      state.all = state.prefs.view === "all"; save(); render();
    });

    // add games
    $("gameForm").addEventListener("submit", function (e) {
      if (e.submitter && e.submitter.value !== "save") return;
      var T = team(), added = [], bad = 0;
      var d = $("gDate").value, opp = $("gOpp").value.trim();
      if (d && opp) added.push({id: "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), date: d, opp: opp.replace(/^(vs\.?|v\.?)\s+/i, ""), tag: $("gTag").value.trim()});
      var b = parseGameLines($("gBulk").value); added = added.concat(b.games); bad = b.bad;
      if (!added.length) { e.preventDefault(); $("gStatus").className = "hint warn"; $("gStatus").textContent = bad ? "I couldn't read those lines. Start each with a date like 2026-11-05 or 11/5/2026." : "Enter a date and opponent, or paste a list."; return; }
      T.games = (T.games || []).concat(added); save(); render();
    });

    $("list").addEventListener("click", function (e) {
      var el = e.target;
      if (el.dataset && el.dataset.act === "addgames") { openGameDlg(); return; }
      if (el.dataset && el.dataset.sale) { var sp = el.dataset.sale.split(":"); openSold(sp[0], parseInt(sp[1], 10)); return; }
      if (el.dataset && el.dataset.sold) { openSold(el.dataset.sold); return; }
      if (el.dataset && el.dataset.list) { listHelper(el.dataset.list); return; }
      if (el.dataset && el.dataset.cal) { calendarOne(el.dataset.cal); return; }
      if (el.dataset && el.dataset.del) {
        if (!confirm("Remove this game?")) return;
        var T = team(); T.games = (T.games || []).filter(function (g) { return g.id !== el.dataset.del; });
        delete prices()[el.dataset.del]; save(); render();
      }
    });
    $("list").addEventListener("input", function (e) {
      var el = e.target; if (!el.dataset || !el.dataset.g) return;
      var g = el.dataset.g, P = prices(); P[g] = P[g] || {}; P[g][el.dataset.k] = el.value; save();
      var sg = signal(g), pill = $("sig-" + g); if (pill) { pill.textContent = sg[0]; pill.className = "pill " + sg[1]; }
      var G0 = gameById(g); if (G0) { paintNet(G0); paintAdvice(G0); }
      stats();
    });
    $("list").addEventListener("change", function (e) {
      var el = e.target;
      if (el.dataset && el.dataset.after) { logAfter(el.dataset.after, parseFloat(el.value)); return; }
      if (el.dataset && el.dataset.k === "lo") {
        var lo = parseFloat(el.value), gg = el.dataset.g, pp = prices()[gg] = prices()[gg] || {};
        if (!isNaN(lo)) { pp.lh = pp.lh || []; var ll = pp.lh[pp.lh.length - 1], nw = Date.now(); if (ll && new Date(ll[0]).toDateString() === new Date(nw).toDateString()) ll[1] = lo; else pp.lh.push([nw, lo]); pp.lh = pp.lh.slice(-60); save(); var G1 = gameById(gg); if (G1) { paintSpark(G1); paintAdvice(G1); } }
        return;
      }
      if (!el.dataset || el.dataset.k !== "seats") return;
      var g = el.dataset.g, n = parseInt(el.value, 10); if (isNaN(n) || n < 0) return;
      var p = prices()[g] = prices()[g] || {}; p.hist = p.hist || [];
      var last = p.hist[p.hist.length - 1], now = Date.now();
      if (last && new Date(last.t).toDateString() === new Date(now).toDateString()) { last.n = n; last.t = now; } else { p.hist.push({n: n, t: now}); }
      p.hist = p.hist.slice(-14); p.seats = String(n); save();
      var G = gameById(g); if (G) { paintFast(G); paintAdvice(G); } stats();
    });
  }

  /* ---------- demand, history, advice, spikes, weather ---------- */
  var INS = null;
  var MARQUEE = ["Los Angeles Lakers", "Golden State Warriors", "Boston Celtics", "New York Knicks", "Chicago Bulls", "Miami Heat", "San Antonio Spurs", "LA Clippers", "Philadelphia 76ers"];
  function winPct(rec) {
    if (!rec) return null; var m = String(rec).split("-").map(Number), gp = (m[0] || 0) + (m[1] || 0) + (m[2] || 0);
    return gp >= 5 ? m[0] / gp : null;
  }
  function demand(T, G) {
    var d = parse(G.date), dow = d.getDay(), sc = 40, mo = d.getMonth() + 1, day = d.getDate();
    if (dow === 6) sc += 15; else if (dow === 5 || dow === 0) sc += 12;
    if (isDivRival(T, G)) sc += 10;
    if (/visit|vs\.|wembanyama|lebron|curry|doncic|opener|finale|nbc|christmas|rivalry|star|old team/i.test(G.tag || "")) sc += 12;
    if ((mo === 12 && day >= 24 && day <= 26) || (mo === 1 && day === 1) || (mo === 11 && day >= 26 && day <= 30)) sc += 8;
    if (T.league === "NBA" && MARQUEE.indexOf(G.opp) !== -1) sc += 8;
    var o = winPct(RECORDS[G.opp]), me = winPct(RECORDS[T.name]);
    if (o != null) sc += Math.round((o - 0.5) * 40);
    if (me != null) sc += Math.round((me - 0.5) * 20);
    return Math.max(0, Math.min(100, sc));
  }

  function recordMarket() {
    var h = state.mhist.wiz || (state.mhist.wiz = {}), today = new Date().toDateString();
    GAMES.forEach(function (G) {
      var m = MARKET["g" + G[0]]; if (!m || m.low == null) return;
      var a = h[G[0]] || (h[G[0]] = []), last = a[a.length - 1];
      if (last && new Date(last[0]).toDateString() === today) last[1] = m.low; else a.push([Date.now(), m.low]);
      if (a.length > 120) a.splice(0, a.length - 120);
    });
    INS = null; save();
  }
  function mktSeries(T, G) {
    var pts = {};
    if (T.id === "wiz" && G.builtin) {
      (HIST["g" + G.id] || []).forEach(function (r) { var t = parse(String(r[0]).slice(0, 10)).getTime(); if (!isNaN(t) && r[1] != null) pts[new Date(t).toDateString()] = [t, +r[1]]; });
      ((state.mhist.wiz || {})[G.id] || []).forEach(function (r) { var k = new Date(r[0]).toDateString(); if (!pts[k]) pts[k] = [r[0], r[1]]; });
    }
    return Object.keys(pts).map(function (k) { return pts[k]; }).sort(function (a, b) { return a[0] - b[0]; });
  }
  function mineSeries(T, G) { return (((state.prices[T.id] || {})[G.id] || {}).lh || []).slice(); }
  function sparkHTML(T, G) {
    var m = mktSeries(T, G), me = mineSeries(T, G); if (m.length < 2 && me.length < 2) return "";
    var all = m.concat(me), face = parseFloat(T.face), tmin = Infinity, tmax = -Infinity, vmin = Infinity, vmax = -Infinity;
    all.forEach(function (r) { tmin = Math.min(tmin, r[0]); tmax = Math.max(tmax, r[0]); vmin = Math.min(vmin, r[1]); vmax = Math.max(vmax, r[1]); });
    var hasFace = !isNaN(face) && face > 0; if (hasFace) { vmin = Math.min(vmin, face); vmax = Math.max(vmax, face); }
    if (tmax === tmin) tmax = tmin + 86400000; if (vmax === vmin) vmax = vmin + 1;
    var W = 300, H = 60, P = 5;
    function X(t) { return (P + (t - tmin) / (tmax - tmin) * (W - 2 * P)).toFixed(1); }
    function Y(v) { return (H - P - (v - vmin) / (vmax - vmin) * (H - 2 * P)).toFixed(1); }
    function path(a) { return a.map(function (r, i) { return (i ? "L" : "M") + X(r[0]) + " " + Y(r[1]); }).join(" "); }
    var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Price history">';
    if (hasFace) svg += '<line class="sf" x1="' + P + '" x2="' + (W - P) + '" y1="' + Y(face) + '" y2="' + Y(face) + '"/>';
    if (m.length > 1) svg += '<path class="sm" d="' + path(m) + '"/>';
    if (me.length > 1) svg += '<path class="sy" d="' + path(me) + '"/>';
    svg += '</svg>';
    var cap = [];
    if (m.length > 1) cap.push("Market low " + money(m[0][1]) + " → " + money(m[m.length - 1][1]));
    if (me.length > 1) cap.push("Your low " + money(me[0][1]) + " → " + money(me[me.length - 1][1]));
    return svg + '<div class="spc">' + cap.join(" · ") + (hasFace ? " · dotted line is face value" : "") + '</div>';
  }
  function paintSpark(G) { var el = $("sp-" + G.id); if (el) el.innerHTML = sparkHTML(team(), G); }

  function insights() {
    var by = {all: [], wk: [], div: []};
    state.teams.forEach(function (T) {
      games(T).forEach(function (G) {
        if (daysAway(G.date) >= 0) return;
        var s2 = mktSeries(T, G); if (s2.length < 5) return;
        var best = s2[0]; s2.forEach(function (r) { if (r[1] > best[1]) best = r; });
        var off = Math.round((parse(G.date).getTime() - best[0]) / 86400000); if (off < 0) return;
        var dw = parse(G.date).getDay(); by.all.push(off);
        if (dw === 5 || dw === 6 || dw === 0) by.wk.push(off);
        if (isDivRival(T, G)) by.div.push(off);
      });
    });
    function med(a) { a = a.slice().sort(function (x, y) { return x - y; }); return a[Math.floor(a.length / 2)]; }
    return {n: by.all.length, all: by.all.length >= 3 ? med(by.all) : null, wk: by.wk.length >= 2 ? med(by.wk) : null, div: by.div.length >= 2 ? med(by.div) : null};
  }
  function ins() { return INS || (INS = insights()); }

  function advice(T, G) {
    var g = G.id, n = daysAway(G.date), leftN = seatsLeft(T, g), part = soldN(T, g) > 0;
    if (fullySold(T, g)) return {cls: "good", head: "Sold", why: ""};
    var p = (state.prices[T.id] || {})[g] || {}, mine = parseFloat(p.lo), m = marketFor(G, T), mk = m && m.low != null ? +m.low : NaN;
    var price = !isNaN(mine) ? mine : mk, src = !isNaN(mine) ? "your logged low" : "the market low";
    var face = parseFloat(T.face), fast = fastInfo(G, T), dem = demand(T, G);
    if (isNaN(price)) return {cls: "", head: "No advice yet", why: "Log a price for your section or wait for the market low."};
    if (isNaN(face) || face <= 0) {
      if (fast.length) return {cls: "hot", head: "Consider selling", why: "Selling fast: " + fast[0] + ". Add your face value in settings for a firmer call."};
      return {cls: "cool", head: "Hold", why: "Add your face value in settings so I can judge the margin."};
    }
    var tgt = Math.max(0, +state.prefs.target || 0) / 100, hiT = Math.max(0.25, tgt * 2);
    var net0 = price * (1 - fee(state.prefs.usual) / 100), margin = (net0 - face) / face, pct = Math.round(margin * 100);
    var peak = ins().all, up = m && m.prevLow > 0 && m.low > m.prevLow, down = m && m.prevLow > 0 && m.low < m.prevLow;
    var why = [], head, cls, sgn = (pct >= 0 ? "+" : "−") + Math.abs(pct) + "%";
    if (n <= 1 && margin >= -0.15) { head = "Last call"; cls = "hot"; why.push("nets " + sgn + " vs face on " + src); }
    else if (margin >= hiT) { head = "Sell now"; cls = "hot"; why.push("nets " + sgn + " vs face after fees"); }
    else if (margin >= tgt) {
      if (n <= 7 || fast.length || down || (peak != null && n <= peak)) { head = "Sell now"; cls = "hot"; }
      else if (dem >= 70) { head = "Hold a little"; cls = "warm"; }
      else { head = "Consider selling"; cls = "warm"; }
      why.push("nets " + sgn + " vs face after fees");
    }
    else if (margin >= -0.05) {
      if (n <= 3) { head = "Sell or use"; cls = "warm"; why.push("near break-even"); }
      else { head = "Hold"; cls = "cool"; why.push(dem >= 70 || up ? "near face, demand or price rising" : "near face value"); }
    }
    else { if (n <= 2) { head = "Use or take the loss"; cls = "warm"; } else { head = "Hold"; cls = "cool"; } why.push(Math.abs(pct) + "% under face after fees"); }
    if (fast.length) why.push(fast[0]);
    if (dem >= 75) why.push("high demand " + dem);
    if (peak != null && n > peak + 1 && head !== "Last call") why.push("past games peaked about " + peak + " days out");
    if (part) why.push(leftN + " seat" + (leftN > 1 ? "s" : "") + " left");
    return {cls: cls, head: head, why: why.join(" · ")};
  }
  function paintAdvice(G) {
    var el = $("adv-" + G.id); if (!el) return; var a = advice(team(), G);
    el.innerHTML = '<b class="v ' + a.cls + '">' + esc(a.head) + '</b>' + (a.why ? ' <span>' + esc(a.why) + '</span>' : '');
  }

  function spikeText(T, G) {
    var m = marketFor(G, T); if (!m || m.low == null) return "";
    var face = parseFloat(T.face), sp = Math.max(5, +state.prefs.spike || 25), s2 = mktSeries(T, G), prior = s2.slice(-8, -1);
    if (prior.length >= 3) { var avg = prior.reduce(function (a, r) { return a + r[1]; }, 0) / prior.length; if (avg > 0 && m.low >= avg * (1 + sp / 100)) return "Price spike: " + Math.round((m.low / avg - 1) * 100) + "% above recent average"; }
    if (face > 0 && m.low >= face * (1 + sp / 100)) return "Price spike: cheapest seat in the arena is over face";
    return "";
  }
  function paintSpike(G) { var el = $("spk-" + G.id); if (!el) return; var t = fullySold(team(), G.id) ? "" : spikeText(team(), G); el.hidden = !t; el.textContent = t; }

  function wxFlag(d) {
    if (!d) return "";
    if (d.snow >= 1) return "Snow forecast"; if (d.precip >= 15) return "Heavy rain forecast"; if (d.wind >= 60) return "High wind forecast"; if (d.tmin != null && d.tmin <= -12) return "Bitter cold";
    return "";
  }
  function paintWeather() {
    var T = team(); games().forEach(function (G) { var el = $("wx-" + G.id); if (!el) return; var f = state.prefs.weather ? wxFlag(((WX[T.id] || {}).days || {})[G.date]) : ""; el.hidden = !f; el.textContent = f; });
  }
  function ensureWeather(T) {
    if (!state.prefs.weather || !navigator.onLine) return;
    var c = WX[T.id]; if (c && Date.now() - c.at < 3 * 3600000) return;
    function go(g) {
      fetchJSON("https://api.open-meteo.com/v1/forecast?latitude=" + g.lat + "&longitude=" + g.lon + "&daily=precipitation_sum,snowfall_sum,temperature_2m_min,windspeed_10m_max&timezone=auto&forecast_days=16", 6000).then(function (r) {
        var d = r.daily || {}, days = {};
        (d.time || []).forEach(function (t, i) { days[t] = {precip: d.precipitation_sum[i] || 0, snow: d.snowfall_sum[i] || 0, tmin: d.temperature_2m_min[i], wind: d.windspeed_10m_max[i] || 0}; });
        WX[T.id] = {at: Date.now(), days: days}; try { localStorage.setItem("ss-wx", JSON.stringify(WX)); } catch (e) {}
        paintWeather(); syncReminders();
      }).catch(function () {});
    }
    var geo = T.id === "wiz" ? {lat: 38.8982, lon: -77.0209} : T.geo;
    if (geo) return go(geo);
    var nk = nick(T.name), city = T.name.slice(-nk.length) === nk ? T.name.slice(0, -nk.length).trim() : T.name;
    fetchJSON("https://geocoding-api.open-meteo.com/v1/search?count=1&name=" + enc(city || T.name), 6000).then(function (r) {
      var x = r.results && r.results[0]; if (x) { T.geo = {lat: x.latitude, lon: x.longitude}; save(); go(T.geo); }
    }).catch(function () {});
  }

  /* ---------- listing helper, sold-at tracking ---------- */
  var SELL_URL = {TM: "https://myaccount.ticketmaster.com/", SH: "https://www.stubhub.com/", SG: "https://seatgeek.com/", VS: "https://www.vividseats.com/", TP: "https://www.tickpick.com/", OT: "https://myaccount.ticketmaster.com/"};
  function toast(msg) { var t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { t.hidden = true; }, 2600); }
  function copyText(txt) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(txt).catch(function () { return legacyCopy(txt); });
    return legacyCopy(txt);
  }
  function legacyCopy(txt) {
    return new Promise(function (res) { var ta = document.createElement("textarea"); ta.value = txt; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (e) {} ta.remove(); res(); });
  }
  function suggest(T, G) {
    var p = (state.prices[T.id] || {})[G.id] || {}, mine = parseFloat(p.lo), m = marketFor(G, T), mk = m && m.low != null ? +m.low : NaN, face = parseFloat(T.face), f = fee(state.prefs.usual);
    return {price: !isNaN(mine) ? Math.max(1, Math.round(mine) - 1) : (!isNaN(mk) ? Math.ceil(mk * 1.2) : null), floor: !isNaN(face) && face > 0 ? Math.ceil(face / (1 - f / 100)) : null};
  }
  function listHelper(g) {
    var G = gameById(g), T = team(); if (!G) return;
    var sg = suggest(T, G), n = T.seatCount || 2, f = fee(state.prefs.usual);
    var txt = T.name + " vs " + G.opp + " · " + fmtDay(parse(G.date).getTime()) + "\n" + (T.venue ? T.venue + "\n" : "") + (T.seats || "") + " · " + n + " seats" +
      (sg.price ? "\nSuggested price: $" + sg.price + " each" : "") + (sg.floor ? "\nBreak-even after the " + f + "% fee: $" + sg.floor + " each" : "");
    copyText(txt).then(function () { toast("Listing details copied. Paste them when you list."); });
    var a = document.createElement("a"); a.href = SELL_URL[state.prefs.usual] || SELL_URL.TM; a.target = "_blank"; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove();
  }
  function afterRows(g, sales) {
    return sales.map(function (x, i) {
      var v = x.after ? x.after.price : "";
      return '<div class="after"><label>' + (sales.length > 1 ? 'Sale ' + (i + 1) + ': same' : 'Same') + ' seats listed now $<input type="number" inputmode="decimal" min="0" data-after="' + esc(g) + ':' + i + '" value="' + v + '"></label><span class="hint" id="aft-' + esc(g) + '-' + i + '">' + esc(afterText(x)) + '</span></div>';
    }).join("");
  }
  function afterText(x) {
    if (!x || !x.after) return "Log the price the same seats are listed at a day after you sold, to see if you sold too early.";
    var d = Math.round((x.after.price - x.price) * 100) / 100;
    return d > 0 ? "Left about " + money(d) + " a seat on the table (about " + money(Math.round(d * x.n * 100) / 100) + " in all)." : d < 0 ? "Good sell: the same seats are now " + money(-d) + " a seat lower." : "Same price a day later.";
  }
  function logAfter(key, v) {
    var sp = String(key).split(":"), x = salesOf(team(), sp[0])[parseInt(sp[1], 10)]; if (!x || isNaN(v)) return;
    x.after = {price: v, at: Date.now()}; save(); var el = $("aft-" + sp[0] + "-" + sp[1]); if (el) el.textContent = afterText(x);
  }

  /* ---------- profit extras: learning, partner, tax, renewal ---------- */
  function r2(v) { return Math.round(v * 100) / 100; }
  function saleRows(filterYear) {
    var rows = [];
    state.teams.forEach(function (T) {
      var f = parseFloat(T.face), id;
      Object.keys(state.sales[T.id] || {}).forEach(function (id) {
        var G = games(T).filter(function (q) { return String(q.id) === id; })[0];
        salesOf(T, id).forEach(function (x, idx) {
          var yr = new Date(x.at || Date.now()).getFullYear(); if (filterYear && yr !== filterYear) return;
          var fp = x.fee != null ? x.fee : fee(x.mk), gross = x.n * x.price, nt = gross * (1 - fp / 100), face = isNaN(f) ? null : f * x.n;
          rows.push({T: T, G: G, x: x, idx: idx, gid: id, yr: yr, gross: gross, fees: gross - nt, net: nt, face: face, profit: face == null ? null : nt - face, left: x.after ? (x.after.price - x.price) * x.n : null});
        });
      });
    });
    return rows;
  }
  function extrasHTML() {
    var h = "", I = ins(), rows = saleRows();
    h += '<h3>What the data says</h3>';
    if (I.all == null) h += '<p class="hint">Still collecting. After about three finished games with a few weeks of daily prices each, this will show how many days before a game prices usually peak. So far ' + I.n + ' of 3 games qualify.</p>';
    else h += '<p class="hint">Across ' + I.n + ' finished games, the market low peaked a median of ' + I.all + ' day' + (I.all === 1 ? "" : "s") + ' before tip-off' + (I.wk != null ? '; weekend games ' + I.wk + ' days' : '') + (I.div != null ? '; division games ' + I.div + ' days' : '') + '. The advice on each card uses this once it exists.</p>';
    var left = rows.filter(function (r) { return r.left != null; });
    if (left.length) { var tot = r2(left.reduce(function (a, r) { return a + r.left; }, 0)); h += '<h3>Sold too early or late</h3><p class="hint">Across ' + left.length + ' sale' + (left.length > 1 ? "s" : "") + ' you logged a day-after price for: ' + (tot > 0 ? "about " + money(tot) + " left on the table." : tot < 0 ? "you sold " + money(-tot) + " above where the seats went." : "even.") + '</p>'; }
    var partners = state.teams.filter(function (T) { return T.partner && T.partner.name; });
    if (partners.length) {
      h += '<h3>Partner split</h3>';
      partners.forEach(function (T) {
        var rs = rows.filter(function (r) { return r.T.id === T.id; }), prof = rs.reduce(function (a, r) { return a + (r.profit != null ? r.profit : r.net); }, 0), pct = +T.partner.pct || 50;
        h += '<p class="hint">' + esc(T.name) + ': ' + esc(T.partner.name) + ' gets ' + pct + '% = ' + money(r2(prof * pct / 100)) + ' of ' + money(r2(prof)) + ' profit.</p>';
      });
    }
    h += '<div class="btn-row"><button type="button" class="btn ghost" data-act="shareSummary">Share summary</button></div>';
    // renewal planner
    h += '<h3>Renewal planner</h3>';
    state.teams.forEach(function (T) {
      var f = parseFloat(T.face), all = games(T), seats = T.seatCount || 2, rs = rows.filter(function (r) { return r.T.id === T.id; });
      if (isNaN(f) || f <= 0 || !all.length) { h += '<p class="hint">' + esc(T.name) + ': add a face value in settings to see this.</p>'; return; }
      var cost = f * seats * all.length, netSales = rs.reduce(function (a, r) { return a + r.net; }, 0), soldSeats = rs.reduce(function (a, r) { return a + r.x.n; }, 0), soldGames = Object.keys(rs.reduce(function (o, r) { o[r.gid] = 1; return o; }, {})).length, kept = Math.max(0, all.length * seats - soldSeats) / seats;
      var netCost = cost - netSales, belowFace = rs.filter(function (r) { return r.profit != null && r.profit < 0; });
      h += '<p class="hint"><b>' + esc(T.name) + '</b>: ' + all.length + ' home games × ' + seats + ' seats × ' + money(f) + ' = ' + money(r2(cost)) + ' face. Sold ' + soldGames + ' game' + (soldGames === 1 ? "" : "s") + ' for ' + money(r2(netSales)) + ' net. ' +
        (netCost <= 0 ? 'The season has paid for itself with ' + money(r2(-netCost)) + ' to spare.' : 'You are out ' + money(r2(netCost)) + ' net' + (kept ? ', about ' + money(r2(netCost / kept)) + ' for each of the ' + (Math.round(kept * 10) / 10) + ' games\' worth of seats you kept' : '') + '.') +
        (belowFace.length ? ' ' + belowFace.length + ' sale' + (belowFace.length > 1 ? "s were" : " was") + ' below face.' : '') + '</p>';
    });
    // tax
    var years = {}; rows.forEach(function (r) { years[r.yr] = 1; }); var ys = Object.keys(years).sort();
    h += '<h3>Tax summary</h3>';
    if (!ys.length) h += '<p class="hint">Once you log a sale, you can export a year of sales as a CSV here. It is a record for you and your accountant, not tax advice.</p>';
    else h += '<div class="btn-row"><select id="taxYear">' + ys.map(function (y) { return '<option>' + y + '</option>'; }).join("") + '</select><button type="button" class="btn" data-act="taxCsv">Export CSV</button></div><p class="hint">A record of sales, fees and profit for the year. Not tax advice. Check how resale income is treated with your accountant.</p>';
    return h;
  }
  function csvCell(v) { v = String(v == null ? "" : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function taxCSV(year) {
    var rows = saleRows(year), L = [["Date sold", "Team", "Game date", "Opponent", "Seats", "Price per seat", "Marketplace", "Fee %", "Gross", "Fees", "Net", "Face value paid", "Profit"].join(",")];
    var t = {g: 0, f: 0, n: 0, face: 0, p: 0, hasP: true};
    rows.sort(function (a, b) { return (a.x.at || 0) - (b.x.at || 0); }).forEach(function (r) {
      var x = r.x; L.push([new Date(x.at).toISOString().slice(0, 10), r.T.name, r.G ? r.G.date : "", r.G ? r.G.opp : "", x.n, x.price, mkName(x.mk), x.fee, r2(r.gross), r2(r.fees), r2(r.net), r.face == null ? "" : r2(r.face), r.profit == null ? "" : r2(r.profit)].map(csvCell).join(","));
      t.g += r.gross; t.f += r.fees; t.n += r.net; if (r.face == null) t.hasP = false; else { t.face += r.face; t.p += r.profit; }
    });
    L.push(["Total", "", "", "", "", "", "", "", r2(t.g), r2(t.f), r2(t.n), t.hasP ? r2(t.face) : "", t.hasP ? r2(t.p) : ""].join(","));
    return L.join("\n");
  }
  function summaryText() {
    var rows = saleRows(), lines = ["SeatSeller summary · " + fmtDay(Date.now())], tot = 0;
    state.teams.forEach(function (T) {
      var rs = rows.filter(function (r) { return r.T.id === T.id; }); if (!rs.length) return;
      var net2 = rs.reduce(function (a, r) { return a + r.net; }, 0), prof = rs.reduce(function (a, r) { return a + (r.profit != null ? r.profit : r.net); }, 0), n = rs.reduce(function (a, r) { return a + r.x.n; }, 0);
      lines.push(T.name + ": " + n + " seats sold, net " + money(r2(net2)) + ", profit " + money(r2(prof)));
      if (T.partner && T.partner.name) lines.push("  " + T.partner.name + " (" + (T.partner.pct || 50) + "%): " + money(r2(prof * (T.partner.pct || 50) / 100)));
      tot += prof;
    });
    if (lines.length === 1) lines.push("Nothing sold yet."); else lines.push("Total profit: " + money(r2(tot)));
    return lines.join("\n");
  }
  function saveOut(name, mime, text) {
    if (Native && Native.saveFile) return Native.saveFile({name: name, mime: mime, text: text}).then(function () { toast("Saved " + name); }).catch(function () {});
    downloadText(name, mime, text); toast("Downloaded " + name);
  }
  function shareOut(text) {
    if (Native && Native.shareText) return Native.shareText({text: text, subject: "SeatSeller summary"}).catch(function () {});
    if (navigator.share) return navigator.share({text: text}).catch(function () {});
    copyText(text).then(function () { toast("Summary copied"); });
  }


  /* ---------- sell queue, weekly check, setup, self-test, digest ---------- */
  function expectedProfit(T, G) {
    var face = parseFloat(T.face); if (isNaN(face) || face <= 0 || fullySold(T, G.id)) return null;
    var p = (state.prices[T.id] || {})[G.id] || {}, mine = parseFloat(p.lo), m = marketFor(G, T), mk = m && m.low != null ? +m.low : NaN, price = !isNaN(mine) ? mine : mk;
    if (isNaN(price)) return null;
    var each = price * (1 - fee(state.prefs.usual) / 100) - face;
    return {each: each, total: each * seatsLeft(T, G.id), price: price};
  }
  function sellQueue() {
    var q = [];
    state.teams.forEach(function (T) { games(T).forEach(function (G) {
      if (daysAway(G.date) < 0) return; var e = expectedProfit(T, G); if (!e) return;
      q.push({T: T, G: G, e: e, a: advice(T, G)});
    }); });
    q.sort(function (x, y) { return y.e.total - x.e.total; });
    return q;
  }
  function queueHTML() {
    var q = sellQueue(), tgt = +state.prefs.target || 0;
    if (!q.length) return '<p class="hint">Nothing to rank yet. Set a face value in settings and wait for market prices or log your own low.</p>';
    return '<p class="hint">Games ranked by what you would pocket after fees on the seats you still own. Your profit target is ' + tgt + '% over face.</p><table class="ptable"><tr><th>Game</th><th>Call</th><th>Per seat</th><th>Total</th></tr>' +
      q.slice(0, 12).map(function (r) { var neg = r.e.total < 0; return '<tr><td>' + esc(nick(r.T.name) + " vs " + r.G.opp) + '<br><span class="hint">' + esc(fmtDay(parse(r.G.date).getTime())) + '</span></td><td>' + esc(r.a.head) + '</td><td>' + (r.e.each < 0 ? "−" : "") + money(Math.abs(r2(r.e.each))) + '</td><td><b>' + (neg ? "−" : "") + money(Math.abs(r2(r.e.total))) + '</b></td></tr>'; }).join("") + '</table>';
  }
  function digestText() {
    var q = sellQueue().filter(function (r) { return /^(Sell now|Last call|Consider selling)$/.test(r.a.head) && r.e.total > 0; }).slice(0, 3);
    var up = upcomingAll().filter(function (u) { return !u.sold; })[0], out = [];
    if (q.length) out.push("Sell candidates: " + q.map(function (r) { return nick(r.T.name) + " vs " + r.G.opp + " (" + r.a.head + ", about " + money(Math.round(r.e.total)) + ")"; }).join("; ") + ".");
    else out.push("Nothing worth selling right now. Hold.");
    if (up) out.push("Next game: " + nick(up.T.name) + " vs " + up.G.opp + ", " + whenLabel(daysAway(up.G.date)) + ".");
    return out.join("\n");
  }
  function pushDigest() {
    if (!Native || !Native.setDigest) return;
    try { Native.setDigest({on: state.prefs.digestOn !== false, hour: +state.prefs.digestHour || 8, extra: digestText()}); } catch (e) {}
  }
  function staleCheck() {
    var el = $("staleBanner"); if (!el) return;
    var t = UPDATED ? new Date(UPDATED).getTime() : 0, hrs = t ? (Date.now() - t) / 3600000 : null;
    el.hidden = !(hrs != null && hrs > 36);
    if (!el.hidden) el.textContent = "Market prices are " + Math.round(hrs / 24 * 10) / 10 + " days old, so the advice may be out of date. The daily update may have stopped.";
  }

  var wkList = [], wkI = 0;
  function openWeekly() {
    var wk = Math.max(1, +state.prefs.weeks || 3), T = team();
    wkList = games(T).filter(function (G) { var n = daysAway(G.date); return n >= 0 && n <= wk * 7 && !fullySold(T, G.id); });
    wkI = 0; if (!wkList.length) { toast("No unsold games in the next " + wk + " weeks"); return; }
    paintWeekly(); openDlg($("weeklyDlg"));
  }
  function paintWeekly() {
    var T = team(), G = wkList[wkI], p = (state.prices[T.id] || {})[G.id] || {}, m = marketFor(G, T), q = T.name + " " + G.opp;
    $("wkStep").textContent = "Game " + (wkI + 1) + " of " + wkList.length;
    $("wkGame").textContent = nick(T.name) + " vs " + G.opp + " · " + fmtDay(parse(G.date).getTime()) + " · " + whenLabel(daysAway(G.date));
    $("wkMkt").textContent = m && m.low != null ? "Market low " + money(m.low) + ". Your section will be higher." : "No market low yet.";
    $("wkLo").value = p.lo || ""; $("wkSeats").value = p.seats || "";
    $("wkTm").href = "https://www.ticketmaster.com/search?q=" + encodeURIComponent(q);
    $("wkAdv").textContent = advice(T, G).head;
    $("wkNext").textContent = wkI === wkList.length - 1 ? "Finish" : "Save and next";
  }
  function saveWeekly() {
    var T = team(), G = wkList[wkI], P = state.prices[T.id] = state.prices[T.id] || {}, p = P[G.id] = P[G.id] || {}, lo = parseFloat($("wkLo").value), n = parseInt($("wkSeats").value, 10), now = Date.now();
    if (!isNaN(lo)) { p.lo = String(lo); p.lh = p.lh || []; var ll = p.lh[p.lh.length - 1]; if (ll && new Date(ll[0]).toDateString() === new Date(now).toDateString()) ll[1] = lo; else p.lh.push([now, lo]); p.lh = p.lh.slice(-60); }
    if (!isNaN(n) && n >= 0) { p.hist = p.hist || []; var last = p.hist[p.hist.length - 1]; if (last && new Date(last.t).toDateString() === new Date(now).toDateString()) { last.n = n; last.t = now; } else p.hist.push({n: n, t: now}); p.hist = p.hist.slice(-14); p.seats = String(n); }
    save();
  }

  function selfTest() {
    var out = [], add = function (ok, t) { out.push('<li class="' + (ok ? "ok" : "bad") + '">' + (ok ? "✓ " : "✗ ") + esc(t) + '</li>'); };
    var T = team(), G = games(T), fv = parseFloat(T.face);
    add(G.length > 0, G.length + " home games loaded for " + T.name);
    add(!!UPDATED, UPDATED ? "Price feed loaded (updated " + fmtTime(new Date(UPDATED).getTime()) + ")" : "Price feed has not loaded yet");
    if (UPDATED) { var hrs = (Date.now() - new Date(UPDATED).getTime()) / 3600000; add(hrs <= 36, hrs <= 36 ? "Feed is fresh (" + Math.round(hrs) + " hours old)" : "Feed is " + Math.round(hrs / 24 * 10) / 10 + " days old"); }
    add(Object.keys(MARKET).length > 0, Object.keys(MARKET).length + " games have a market low");
    add(fv > 0, fv > 0 ? "Face value set (" + money(fv) + ")" : "Face value not set, so profit and advice are limited");
    add(true, "Seats: " + T.seats + " (" + seatsOwned(T) + " seats)");
    var run = function (extra) { $("testOut").innerHTML = out.join("") + (extra || ""); };
    if (!Native) { add(false, "Not running inside the Android app, so notifications, reminders and backup can't be tested"); run(); return; }
    Native.getStatus().then(function (s) {
      add(!!s.enabled, s.enabled ? "Notifications are allowed" : "Notifications are blocked or off");
      add(!!s.lastCheck, s.lastCheck ? "Background check last ran " + fmtTime(s.lastCheck) : "Background check has not run yet");
      if (s.lastResult) add(!/^Failed/.test(s.lastResult), "Last check result: " + s.lastResult);
      return Native.getBackupStatus().catch(function () { return {}; });
    }).then(function (b) {
      add(!!(b && (b.uri || b.configured)), b && (b.uri || b.configured) ? "Backup file is chosen" : "No backup file chosen (optional)");
      add(true, "Daily digest is " + (state.prefs.digestOn !== false ? "on, after " + (state.prefs.digestHour || 8) + ":00" : "off"));
      run();
    }).catch(function () { run('<li class="bad">✗ Could not read app status</li>'); });
  }

  function openSetup() {
    var T = team(); $("suSeats").textContent = T.seats; $("suFace").value = T.face || ""; $("suCount").value = seatsOwned(T);
    $("suTarget").value = state.prefs.target; $("suDigest").checked = state.prefs.digestOn !== false; openDlg($("setupDlg"));
  }
  function finishSetup() {
    var T = team(), f = parseFloat($("suFace").value), c = parseInt($("suCount").value, 10), tg = parseFloat($("suTarget").value);
    if (!isNaN(f)) T.face = String(f); if (c > 0) T.seatCount = c; if (!isNaN(tg)) state.prefs.target = tg;
    state.prefs.digestOn = $("suDigest").checked; state.prefs.usual = "TM"; state.prefs.setupDone = true;
    save(); render(); pushDigest();
    if (Native && state.prefs.digestOn) { try { Native.requestPermission().then(paintNative).catch(function () {}); } catch (e) {} }
  }

  /* ---------- home-screen widget ---------- */
  function pushWidget() {
    if (!Native || !Native.setWidgetData) return;
    var up = upcomingAll().filter(function (u) { return !u.sold; })[0];
    if (!up) { Native.setWidgetData({title: "No upcoming games", sub: "Add games in SeatSeller", key: "", low: ""}).catch(function () {}); return; }
    var a = advice(up.T, up.G), n = daysAway(up.G.date);
    Native.setWidgetData({title: nick(up.T.name) + " vs " + up.G.opp + " · " + fmtDay(parse(up.G.date).getTime()), sub: whenLabel(n) + " · " + a.head + (fastInfo(up.G, up.T).length ? " · selling fast" : ""), key: up.T.id === "wiz" && up.G.builtin ? "g" + up.G.id : "", low: ""}).catch(function () {});
  }

  /* ---------- sales, profit ---------- */
  var soldGame = null;
  function gameById(g) { return games().filter(function (x) { return String(x.id) === String(g); })[0]; }
  function sNetText() {
    var n = parseFloat($("sN").value), p = parseFloat($("sPrice").value), f = parseFloat($("sFee").value);
    if (isNaN(n) || isNaN(p)) { $("sNet").textContent = ""; return; }
    var po = parseFloat($("sPayout").value); if (!isNaN(po) && n > 0 && p > 0) f = Math.round((1 - po / (p * n)) * 1000) / 10;
    f = isNaN(f) ? 0 : f; var each = p * (1 - f / 100), face = parseFloat(team().face);
    var t = "You receive about " + money(Math.round(each * 100) / 100) + " per seat, " + money(Math.round(each * n * 100) / 100) + " total.";
    if (!isNaN(face) && face > 0) { var pr = (each - face) * n; t += " Profit vs face: " + (pr < 0 ? "−" : "") + money(Math.abs(Math.round(pr * 100) / 100)) + "."; }
    $("sNet").textContent = t;
  }
  var soldIdx = -1;
  function openSold(g, idx) {
    var G = gameById(g); if (!G) return; soldGame = String(g); var T = team();
    soldIdx = idx == null || isNaN(idx) ? -1 : idx;
    var x = soldIdx >= 0 ? salesOf(T, g)[soldIdx] : null, p = prices()[g] || {}, left = seatsLeft(T, g);
    $("soldTitle").textContent = x ? "Edit sale" : "Mark sold";
    $("soldGame").textContent = T.name + " vs " + G.opp + " · " + fmtDay(parse(G.date).getTime()) + " · " + (x ? "" : left + " of " + seatsOwned(T) + " seats left to sell");
    $("sN").value = x ? x.n : left; $("sN").max = x ? left + x.n : left; $("sPrice").value = x ? x.price : (p.lo || "");
    $("sMk").value = x ? x.mk : state.prefs.usual; $("sFee").value = x ? x.fee : fee($("sMk").value);
    $("sPayout").value = x && x.payout != null ? x.payout : "";
    $("sRemove").hidden = !x; sNetText(); openDlg($("soldDlg"));
  }
  /* Learn the real fee from what Ticketmaster actually paid out */
  function learnFee(mk) {
    var tot = 0, gr = 0, c = 0;
    state.teams.forEach(function (T) { Object.keys(state.sales[T.id] || {}).forEach(function (id) { salesOf(T, id).forEach(function (x) { if (x.mk === mk && x.payout != null) { tot += x.payout; gr += x.n * x.price; c++; } }); }); });
    if (c && gr > 0) { var f = Math.round((1 - tot / gr) * 1000) / 10; if (f >= 0 && f < 60) { state.prefs.fees[mk] = f; return f; } }
    return null;
  }
  function profitHTML() {
    var rows = saleRows(), tot = {n: 0, gross: 0, net: 0, face: 0, hasFace: true};
    rows.forEach(function (r) { tot.n += r.x.n; tot.gross += r.gross; tot.net += r.net; if (r.face == null) tot.hasFace = false; else tot.face += r.face; });
    if (!rows.length) return '<p class="hint">Nothing sold yet. Use Mark sold on a game card and your totals show up here.</p>' + extrasHTML();
    rows.sort(function (a, b) { return (a.G ? a.G.date : "") < (b.G ? b.G.date : "") ? -1 : 1; });
    var profit = tot.net - tot.face;
    var h = '<div class="big ' + (profit >= 0 ? "pos" : "neg") + '">' + (tot.hasFace ? (profit < 0 ? "−" : "") + money(Math.abs(r2(profit))) : money(r2(tot.net))) + '</div>';
    h += '<p class="hint">' + (tot.hasFace ? "Profit after fees and face value" : "Net after fees. Set a face value in settings to see profit") + ' · ' + tot.n + ' seats sold · gross ' + money(r2(tot.gross)) + ' · fees ' + money(r2(tot.gross - tot.net)) + '</p>';
    h += '<table class="ptable"><tr><th>Game</th><th>Seats</th><th>Net</th><th>Profit</th></tr>';
    rows.forEach(function (r) { h += '<tr><td>' + esc(nick(r.T.name) + " vs " + (r.G ? r.G.opp : "game")) + '</td><td>' + r.x.n + '</td><td>' + money(r2(r.net)) + '</td><td>' + (r.profit == null ? "—" : (r.profit < 0 ? "−" : "") + money(Math.abs(r2(r.profit)))) + '</td></tr>'; });
    return h + '</table>' + extrasHTML();
  }

  /* ---------- reminders, calendar ---------- */
  function upcomingAll() {
    var out = [];
    state.teams.forEach(function (T) {
      games(T).forEach(function (G) { if (daysAway(G.date) >= 0) out.push({T: T, G: G, sold: fullySold(T, G.id)}); });
    });
    return out.sort(function (a, b) { return a.G.date < b.G.date ? -1 : 1; });
  }
  function syncReminders() {
    if (!Native || !Native.syncReminders) return;
    var items = [], now = Date.now(), ld = Math.max(0, +state.prefs.listDays || 0);
    upcomingAll().forEach(function (u) {
      if (u.sold) return;
      var d = parse(u.G.date), label = nick(u.T.name) + " vs " + u.G.opp;
      if (ld > 0) { var a = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ld, 9, 0).getTime(); if (a > now) items.push({id: "l-" + u.T.id + "-" + u.G.id, at: a, title: "List by now: " + label, body: "Game is in " + ld + " day" + (ld > 1 ? "s" : "") + ". Check prices and list your seats if you plan to sell."}); }
      if (state.prefs.lastCall) { var b = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 9, 0).getTime(); if (b > now) items.push({id: "z-" + u.T.id + "-" + u.G.id, at: b, title: "Last call: " + label + " is today", body: "Last chance to list or transfer your seats." + (wxFlag(((WX[u.T.id] || {}).days || {})[u.G.date]) ? " Heads up: " + wxFlag(((WX[u.T.id] || {}).days || {})[u.G.date]).toLowerCase() + "." : "")}); }
    });
    state.teams.forEach(function (T) {
      Object.keys(state.sales[T.id] || {}).forEach(function (id) { salesOf(T, id).forEach(function (x, i) { if (x.after || !x.at) return; var at = x.at + 24 * 3600000; if (at > now && at < now + 3 * 86400000) items.push({id: "a-" + T.id + "-" + id + "-" + i, at: at, title: "Check the price on your sold seats", body: "Open SeatSeller and log what the same seats are listed at now."}); }); });
    });
    items.sort(function (a, b) { return a.at - b.at; });
    try { Native.syncReminders({items: items.slice(0, 60)}); } catch (e) {}
  }
  function ymdUTC(iso, plus) { var p = iso.split("-"), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + (plus || 0))); return d.getUTCFullYear() + ("0" + (d.getUTCMonth() + 1)).slice(-2) + ("0" + d.getUTCDate()).slice(-2); }
  function icsEscape(t) { return String(t).replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n"); }
  function icsFor(list) {
    var ld = Math.max(0, +state.prefs.listDays || 0);
    var L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SeatSeller//EN"];
    list.forEach(function (e) {
      L.push("BEGIN:VEVENT", "UID:" + e.key + "@seatseller", "DTSTAMP:" + new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z",
        "DTSTART;VALUE=DATE:" + ymdUTC(e.date), "DTEND;VALUE=DATE:" + ymdUTC(e.date, 1), "SUMMARY:" + icsEscape(e.title), "LOCATION:" + icsEscape(e.location || ""), "DESCRIPTION:" + icsEscape(e.desc || ""));
      if (ld > 0) L.push("BEGIN:VALARM", "TRIGGER:-PT" + (ld * 1440 - 540) + "M", "ACTION:DISPLAY", "DESCRIPTION:List your seats", "END:VALARM");
      L.push("END:VEVENT");
    });
    L.push("END:VCALENDAR"); return L.join("\r\n");
  }
  function downloadText(name, mime, text) {
    var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], {type: mime})); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function calEvent(T, G) {
    var ld = Math.max(0, +state.prefs.listDays || 0);
    return {key: T.id + "-" + G.id, title: nick(T.name) + " vs " + G.opp, date: G.date, location: T.venue || "", remind: ld > 0 ? ld * 1440 - 540 : 0,
      desc: (T.seats ? "My seats: " + T.seats + ". " : "") + (ld > 0 ? "List by " + ld + " day" + (ld > 1 ? "s" : "") + " before. " : "") + (G.tag || "")};
  }
  function calendarOne(g) {
    var G = gameById(g); if (!G) return; var e = calEvent(team(), G);
    if (Native && Native.addToCalendarIntent) Native.addToCalendarIntent(e).catch(function () {});
    else downloadText("SeatSeller-" + e.key + ".ics", "text/calendar", icsFor([e]));
  }
  function calendarAll() {
    var list = upcomingAll().map(function (u) { return calEvent(u.T, u.G); });
    if (!list.length) { $("calStatus").textContent = "No upcoming games to add yet."; return; }
    if (Native && Native.syncCalendar) {
      $("calStatus").textContent = "Adding " + list.length + " games…";
      Native.syncCalendar({events: list}).then(function (r) {
        $("calStatus").textContent = r.error ? r.error : "Calendar updated: " + r.added + " added, " + r.updated + " updated, " + r.removed + " removed.";
      }).catch(function (e) { $("calStatus").textContent = "Couldn't reach the calendar. Allow calendar access when Android asks and try again."; });
    } else { downloadText("SeatSeller-games.ics", "text/calendar", icsFor(list)); $("calStatus").textContent = "Downloaded a calendar file with " + list.length + " games."; }
  }

  /* ---------- backup ---------- */
  function paintBackup() {
    var st = $("bkStatus");
    if (!Native || !Native.getBackupStatus) { st.textContent = "Backups save your teams, prices, sales and settings as a file. Download one now, or install the Android app for automatic daily backups to Google Drive."; $("bkChoose").hidden = true; $("bkNow").textContent = "Download backup"; return; }
    Native.getBackupStatus().then(function (b) {
      $("bkStop").hidden = !b.configured; $("bkNow").disabled = !b.configured;
      $("bkChoose").textContent = b.configured ? "Change backup location" : "Choose where to save (Google Drive)";
      st.textContent = b.configured ? "Auto-backup is on" + (b.lastBackup ? ". Last saved " + fmtTime(b.lastBackup) : "") + (b.lastResult ? " · " + b.lastResult : "") + "." : "Auto-backup is off. Choose a file in Google Drive and SeatSeller will refresh it about once a day.";
    }).catch(function () {});
  }
  function restoreFrom(text) {
    var o; try { o = JSON.parse(text); } catch (e) { return alert("That file isn't a SeatSeller backup."); }
    var s = o && o.state; if (!o || o.app !== "SeatSeller" || !s || !s.teams || !s.teams.length) return alert("That file isn't a SeatSeller backup.");
    if (!confirm("Replace what's on this phone with the backup from " + (o.exportedAt ? fmtTime(new Date(o.exportedAt).getTime()) : "that file") + "?")) return;
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
    location.reload();
  }

  function wire2() {
    // settings extras
    $("prefUsual").innerHTML = MKTS.map(function (m) { return '<option value="' + m[0] + '">' + m[1] + '</option>'; }).join("");
    $("feeGrid").innerHTML = MKTS.map(function (m) { return '<label>' + m[1] + ' fee %<input type="number" inputmode="decimal" min="0" max="60" step="0.5" data-fee="' + m[0] + '"></label>'; }).join("");
    $("sMk").innerHTML = $("prefUsual").innerHTML;
    $("prefUsual").addEventListener("change", function (e) { state.prefs.usual = e.target.value; save(); paintMarkets(); });
    $("feeGrid").addEventListener("change", function (e) { var k = e.target.dataset.fee; if (!k) return; var v = Math.min(60, Math.max(0, parseFloat(e.target.value) || 0)); e.target.value = v; state.prefs.fees[k] = v; save(); paintMarkets(); });
    $("prefListDays").addEventListener("change", function (e) { state.prefs.listDays = Math.min(30, Math.max(0, parseInt(e.target.value, 10) || 0)); e.target.value = state.prefs.listDays; save(); });
    $("prefLastCall").addEventListener("change", function (e) { state.prefs.lastCall = e.target.checked; save(); });
    $("calAll").addEventListener("click", calendarAll);
    $("prefSort").addEventListener("change", function (e) { state.prefs.sort = e.target.value; save(); render(); });
    $("prefSpike").addEventListener("change", function (e) { var v = Math.min(200, Math.max(5, parseInt(e.target.value, 10) || 25)); e.target.value = v; state.prefs.spike = v; save(); paintMarkets(); });
    $("prefWeather").addEventListener("change", function (e) { state.prefs.weather = e.target.checked; save(); if (e.target.checked) ensureWeather(team()); paintWeather(); });
    $("tSeatCount").addEventListener("change", function (e) { team().seatCount = Math.min(20, Math.max(1, parseInt(e.target.value, 10) || 2)); e.target.value = team().seatCount; save(); });
    function partner() { var T = team(); T.partner = {name: $("tPartner").value.trim(), pct: Math.min(100, Math.max(0, parseFloat($("tPartnerPct").value) || 50))}; save(); }
    $("tPartner").addEventListener("change", partner); $("tPartnerPct").addEventListener("change", partner);
    $("profitBody").addEventListener("click", function (e) {
      var a = e.target.dataset && e.target.dataset.act; if (!a) return;
      if (a === "shareSummary") shareOut(summaryText());
      if (a === "taxCsv") { var y = parseInt($("taxYear").value, 10); saveOut("SeatSeller-sales-" + y + ".csv", "text/csv", taxCSV(y)); }
    });
    // profit
    $("profitBtn").addEventListener("click", function () { $("profitBody").innerHTML = profitHTML(); openDlg($("profitDlg")); });
    // new features
    $("queueBtn").addEventListener("click", function () { $("queueBody").innerHTML = queueHTML(); openDlg($("queueDlg")); });
    $("weeklyBtn").addEventListener("click", openWeekly);
    $("wkNext").addEventListener("click", function (e) { e.preventDefault(); saveWeekly(); if (wkI < wkList.length - 1) { wkI++; paintWeekly(); } else { closeDlg($("weeklyDlg")); render(); toast("Weekly check done"); } });
    $("wkSkip").addEventListener("click", function (e) { e.preventDefault(); if (wkI < wkList.length - 1) { wkI++; paintWeekly(); } else { closeDlg($("weeklyDlg")); render(); } });
    $("wkBack").addEventListener("click", function (e) { e.preventDefault(); if (wkI > 0) { wkI--; paintWeekly(); } });
    $("wkDone").addEventListener("click", function (e) { e.preventDefault(); closeDlg($("weeklyDlg")); render(); });
    $("selfTestBtn").addEventListener("click", selfTest);
    $("prefTarget").addEventListener("change", function (e) { var v = Math.min(500, Math.max(0, parseFloat(e.target.value) || 0)); e.target.value = v; state.prefs.target = v; save(); render(); });
    $("prefDigest").addEventListener("change", function (e) { state.prefs.digestOn = e.target.checked; save(); pushDigest(); });
    $("prefDigestHour").addEventListener("change", function (e) { var v = Math.min(23, Math.max(0, parseInt(e.target.value, 10) || 8)); e.target.value = v; state.prefs.digestHour = v; save(); pushDigest(); });
    $("digestNowBtn").addEventListener("click", function () { if (!Native) { toast(digestText().replace(/\n/g, " ")); return; } pushDigest(); Native.digestNow().then(function () { toast("Digest sent if there is anything to report"); }).catch(function () {}); });
    $("suSave").addEventListener("click", function (e) { e.preventDefault(); finishSetup(); closeDlg($("setupDlg")); });
    // sold
    $("sMk").addEventListener("change", function () { $("sFee").value = fee($("sMk").value); sNetText(); });
    ["sN", "sPrice", "sFee", "sPayout"].forEach(function (id) { $(id).addEventListener("input", sNetText); });
    $("soldForm").addEventListener("submit", function (e) {
      if (e.submitter && e.submitter.value !== "save") return;
      var n = parseInt($("sN").value, 10), p = parseFloat($("sPrice").value);
      if (!(n > 0) || isNaN(p)) { e.preventDefault(); return; }
      var T = team(), arr = salesOf(T, soldGame).slice(), old = soldIdx >= 0 ? arr[soldIdx] : null, other = soldN(T, soldGame) - (old ? old.n : 0);
      if (other + n > seatsOwned(T)) { e.preventDefault(); toast("Only " + (seatsOwned(T) - other) + " seat(s) left on this game"); return; }
      var po = parseFloat($("sPayout").value), fp = parseFloat($("sFee").value) || 0, hasPo = !isNaN(po) && po >= 0;
      if (hasPo) fp = Math.round((1 - po / (p * n)) * 1000) / 10;
      var rec = {n: n, price: p, mk: $("sMk").value, fee: fp, at: old ? old.at : Date.now()};
      if (hasPo) rec.payout = po; if (old && old.after) rec.after = old.after;
      if (old) arr[soldIdx] = rec; else arr.push(rec);
      setSales(T, soldGame, arr);
      var lf = hasPo ? learnFee(rec.mk) : null; if (lf != null) toast("Learned: " + mkName(rec.mk) + " fee is about " + lf + "%");
      save(); render();
    });
    $("sRemove").addEventListener("click", function () { var T = team(), arr = salesOf(T, soldGame).slice(); if (soldIdx >= 0) arr.splice(soldIdx, 1); setSales(T, soldGame, arr); save(); closeDlg($("soldDlg")); render(); });
    // backup
    $("bkChoose").addEventListener("click", function () { Native.chooseBackupFile({json: backupJSON()}).then(paintBackup).catch(function () { $("bkStatus").textContent = "That location didn't work. Pick a folder you can write to, like My Drive."; }); });
    $("bkNow").addEventListener("click", function () {
      if (Native && Native.backupNow) { Native.setBackupData({json: backupJSON()}).then(function () { return Native.backupNow(); }).then(paintBackup).catch(paintBackup); }
      else downloadText("SeatSeller-backup.json", "application/json", backupJSON());
    });
    $("bkStop").addEventListener("click", function () { Native.stopBackup().then(paintBackup); });
    $("bkRestore").addEventListener("click", function () {
      if (Native && Native.restoreFromFile) Native.restoreFromFile().then(function (r) { if (r && r.json) restoreFrom(r.json); }).catch(function () {});
      else $("bkFile").click();
    });
    $("bkFile").addEventListener("change", function (e) { var f = e.target.files[0]; if (!f) return; var r = new FileReader(); r.onload = function () { restoreFrom(String(r.result)); }; r.readAsText(f); });
  }

  /* ---------- splash: hide when loaded AND at least 1 second, whichever is slower ---------- */
  function splashGate(loaded) {
    var splash = $("splash"), done = false;
    function hide() { if (done) return; done = true; splash.classList.add("hide"); setTimeout(function () { splash.hidden = true; }, 450); }
    var minTimer = new Promise(function (res) { setTimeout(res, Math.max(0, MIN_SPLASH - (Date.now() - T0))); });
    var fonts = document.fonts && document.fonts.ready ? document.fonts.ready.catch(function () {}) : Promise.resolve();
    Promise.all([loaded.catch(function () {}), fonts, minTimer]).then(hide);
    setTimeout(hide, MAX_SPLASH); // safety so a stalled network can never trap you on the splash
  }

  load(); wire(); wire2(); render(); wireNative(); staleCheck(); if (!state.prefs.setupDone) setTimeout(openSetup, 1400); if (Native) { try { Native.setBackupData({json: backupJSON()}); } catch (e) {} syncReminders(); pushWidget(); pushDigest(); }
  splashGate(loadPrices());
})();
