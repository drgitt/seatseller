(function () {
  'use strict';

  var DATA_URL = 'https://raw.githubusercontent.com/drgitt/seatseller/main/data/prices.json';
  var KEY = 'ss-v1', PKEY = 'ss-prices';

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

  var state = {face: "", label: "", prices: {}, all: false};
  var MARKET = {}, ALERTS = [], UPDATED = null, FETCH_NOTE = "";
  var Native = null;

  try {
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
      Native = window.Capacitor.registerPlugin('SeatSeller');
    }
  } catch (e) { Native = null; }

  function load() {
    try { var s = JSON.parse(localStorage.getItem(KEY) || "null"); if (s) { state.face = s.face || ""; state.label = s.label || ""; state.prices = s.prices || {}; state.all = !!s.all; } } catch (e) {}
    try { var p = JSON.parse(localStorage.getItem(PKEY) || "null"); if (p) applyPrices(p); } catch (e) {}
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  function applyPrices(p) {
    MARKET = (p && p.games) || {}; ALERTS = (p && p.alerts) || []; UPDATED = (p && p.updatedAt) || null;
  }

  function $(id) { return document.getElementById(id); }
  function today() { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
  function parse(d) { var p = d.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function daysAway(d) { return Math.round((parse(d) - today()) / 86400000); }
  function tier(n) { return n < 0 ? 0 : n <= 6 ? 1 : n <= 13 ? 2 : n <= 20 ? 3 : 4; }
  function enc(s) { return encodeURIComponent(s); }
  function money(v) { return v === "" || v == null ? "" : "$" + Number(v).toLocaleString(); }
  function fmtDay(ts) { var d = new Date(ts); return MON[d.getMonth()].slice(0, 3) + " " + d.getDate(); }
  function fmtTime(ts) {
    var d = new Date(ts), h = d.getHours(), m = d.getMinutes(), ap = h >= 12 ? "PM" : "AM";
    h = h % 12 || 12; return fmtDay(ts) + ", " + h + ":" + (m < 10 ? "0" : "") + m + " " + ap;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]; }); }
  function whenLabel(n) { return n === 0 ? "Tonight" : n === 1 ? "Tomorrow" : "In " + n + " days"; }

  function signal(g) {
    var p = state.prices[g] || {}, face = parseFloat(state.face), lo = parseFloat(p.lo);
    if (isNaN(lo)) return ["No price logged", ""];
    if (isNaN(face) || face <= 0) return ["Low " + money(lo), "cool"];
    var diff = lo - face;
    if (diff >= 0) return ["Resale " + (diff === 0 ? "at" : "$" + Math.round(diff) + " over") + " face", "good"];
    return ["$" + Math.round(-diff) + " under face", "warm"];
  }

  function fastInfo(g) {
    var p = state.prices[g] || {}, h = p.hist || [], now = Date.now(), why = [];
    if (h.length >= 2) {
      var last = h[h.length - 1], base = null;
      for (var i = 0; i < h.length - 1; i++) { if (now - h[i].t <= 7 * 86400000) { base = h[i]; break; } }
      if (base && base.n > 0 && base.n - last.n >= 2 && last.n <= base.n * 0.75) why.push("seats down " + Math.round((1 - last.n / base.n) * 100) + "% since " + fmtDay(base.t));
    }
    var m = MARKET["g" + g];
    if (m && m.low != null && m.prevLow > 0 && m.low >= m.prevLow * 1.15) why.push("market low up " + Math.round((m.low / m.prevLow - 1) * 100) + "%");
    if (m && m.hot) why.push("marketplace shows low inventory");
    return why;
  }

  function rowHTML(G) {
    var g = G[0], n = daysAway(G[1]), t = tier(n), d = parse(G[1]), name = TEAMS[G[2]];
    var q = "Washington Wizards " + name, p = state.prices[g] || {}, sig = signal(g);
    var cls = "game" + (t >= 1 && t <= 3 ? " t" + t : "");
    var pills = "";
    if (t >= 1 && t <= 3) pills += '<span class="pill ' + TIERNAME[t][1] + '">' + TIERNAME[t][0] + '</span><span class="pill ' + TIERNAME[t][1] + '">' + whenLabel(n) + '</span>';
    pills += '<span class="pill hot" id="fast-' + g + '" hidden></span>';
    pills += '<span class="pill ' + sig[1] + '" id="sig-' + g + '">' + sig[0] + '</span>';
    pills += '<span class="mk" id="mk-' + g + '"></span><span class="mk" id="sd-' + g + '"></span>';
    var tag = G[3] ? '<span>' + esc(G[3]) + '</span>' : '';
    return '<div class="' + cls + '" id="g' + g + '">' +
      '<div class="date"><span class="dow">' + DOW[d.getDay()] + '</span><span class="dnum">' + d.getDate() + '</span></div>' +
      '<div class="who"><div class="opp">vs ' + name + '</div><div class="meta">' + pills + tag + '<span class="mono">G' + g + '</span></div></div>' +
      '<div class="act"><div class="prices">' +
        '<input type="number" inputmode="numeric" min="0" step="1" id="se-' + g + '" data-g="' + g + '" data-k="seats" placeholder="Seats" aria-label="Seats listed in my section for ' + name + '" value="' + (p.seats || "") + '">' +
        '<input type="number" inputmode="decimal" min="0" id="lo-' + g + '" data-g="' + g + '" data-k="lo" placeholder="Low $" aria-label="Lowest price in my rows for ' + name + '" value="' + (p.lo || "") + '">' +
        '<input type="number" inputmode="decimal" min="0" id="hi-' + g + '" data-g="' + g + '" data-k="hi" placeholder="High $" aria-label="Highest price in my rows for ' + name + '" value="' + (p.hi || "") + '">' +
      '</div><a class="sell" href="https://myaccount.ticketmaster.com/" target="_blank" rel="noopener">Sell</a></div>' +
      '<div class="links">' +
        '<a href="https://www.ticketmaster.com/search?q=' + enc(q) + '" target="_blank" rel="noopener">Ticketmaster</a>' +
        '<a href="https://www.stubhub.com/find/s/?q=' + enc(q) + '" target="_blank" rel="noopener">StubHub</a>' +
        '<a href="https://seatgeek.com/search?search=' + enc(q) + '" target="_blank" rel="noopener">SeatGeek</a>' +
        '<a href="https://www.vividseats.com/search?searchTerm=' + enc(q) + '" target="_blank" rel="noopener">Vivid Seats</a>' +
      '</div></div>';
  }

  function paintFast(g) {
    var el = $("fast-" + g), sd = $("sd-" + g); if (!el || !sd) return;
    var why = fastInfo(g);
    if (why.length) { el.hidden = false; el.textContent = "Selling fast · " + why[0]; } else { el.hidden = true; el.textContent = ""; }
    var h = (state.prices[g] || {}).hist || [];
    if (h.length) {
      var last = h[h.length - 1], t = "Mine: " + last.n + " seats";
      if (h.length > 1) { var d = last.n - h[h.length - 2].n; t += " (" + (d > 0 ? "+" : d < 0 ? "−" : "±") + Math.abs(d) + " since " + fmtDay(h[h.length - 2].t) + ")"; }
      sd.textContent = t;
    } else { sd.textContent = ""; }
  }

  function paintMarkets() {
    GAMES.forEach(function (G) {
      paintFast(G[0]);
      var el = $("mk-" + G[0]); if (!el) return;
      var m = MARKET["g" + G[0]];
      if (m && m.low != null) {
        var dt = m.checkedAt ? new Date(m.checkedAt) : null;
        el.textContent = "Market low " + money(m.low) + (m.source ? " · " + m.source : "") + (m.listings ? " · " + m.listings + " listings" : "") + (dt && !isNaN(dt) ? " · " + fmtDay(dt.getTime()) : "");
      } else { el.textContent = ""; }
    });
  }

  function paintAlerts() {
    var box = $("alerts"), now = Date.now();
    var list = ALERTS.filter(function (a) { var t = a.t ? new Date(a.t).getTime() : now; return now - t <= 72 * 3600000; })
      .sort(function (a, b) { return new Date(b.t || 0) - new Date(a.t || 0); }).slice(0, 3);
    if (!list.length) { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    box.innerHTML = list.map(function (a) { return '<div class="alert"><b>' + esc(a.title || "Alert") + '</b><span>' + esc(a.body || "") + '</span></div>'; }).join("");
  }

  function stats() {
    var up = GAMES.filter(function (G) { return daysAway(G[1]) >= 0; });
    var next = up[0], wk = up.filter(function (G) { return daysAway(G[1]) <= 6; }).length;
    var fast = up.filter(function (G) { return fastInfo(G[0]).length > 0; }).length;
    var best = null;
    up.forEach(function (G) { var p = state.prices[G[0]]; if (p && p.lo !== "" && p.lo != null && (!best || +p.lo > +state.prices[best[0]].lo)) best = G; });
    var h = '<div class="stat"><b>' + (next ? whenLabel(daysAway(next[1])) : "Season over") + '</b><span>' + (next ? "Next: " + TEAMS[next[2]] : "") + '</span></div>';
    h += '<div class="stat"><b>' + wk + '</b><span>Games this week</span></div>';
    h += '<div class="stat"><b' + (fast ? ' style="color:var(--hot)"' : '') + '>' + fast + '</b><span>Selling fast</span></div>';
    h += '<div class="stat"><b>' + (best ? money(state.prices[best[0]].lo) : "—") + '</b><span>' + (best ? "Best low: " + best[2] : "Best logged low") + '</span></div>';
    $("stats").innerHTML = h;
  }

  function paintFresh() {
    var el = $("fresh");
    if (UPDATED) el.textContent = "Prices updated " + fmtTime(new Date(UPDATED).getTime()) + (FETCH_NOTE ? " · " + FETCH_NOTE : "");
    else el.textContent = FETCH_NOTE || "No market prices yet";
  }

  function render() {
    var rows = GAMES.filter(function (G) { var t = tier(daysAway(G[1])); return state.all ? t !== 0 : (t >= 1 && t <= 3); });
    var out = "", lastM = "";
    rows.forEach(function (G) {
      var d = parse(G[1]), m = MON[d.getMonth()] + " " + d.getFullYear();
      if (m !== lastM) { out += '<div class="month">' + m + '</div>'; lastM = m; }
      out += rowHTML(G);
    });
    $("list").innerHTML = out || '<div class="empty">No home games in the next three weeks. Switch to all home games to see the rest of the season.</div>';
    $("f-soon").setAttribute("aria-pressed", String(!state.all));
    $("f-all").setAttribute("aria-pressed", String(state.all));
    $("sub").textContent = (state.label || "Wizards home games") + ", nearest first.";
    paintMarkets(); paintAlerts(); paintFresh(); stats();
  }

  function fetchJSON(url) {
    return fetch(url, {cache: "no-store"}).then(function (r) { if (!r.ok) { var e = new Error("HTTP " + r.status); e.status = r.status; throw e; } return r.json(); });
  }

  function loadPrices() {
    fetchJSON(DATA_URL + "?t=" + Date.now()).then(function (p) {
      applyPrices(p); FETCH_NOTE = "";
      try { localStorage.setItem(PKEY, JSON.stringify(p)); } catch (e) {}
      render();
    }).catch(function (e) {
      FETCH_NOTE = e && e.status === 404 ? "price feed not reachable (repo may be private)" : "offline, showing saved prices";
      if (!UPDATED) {
        fetchJSON("prices.seed.json").then(function (p) { applyPrices(p); render(); }).catch(function () { render(); });
      } else { render(); }
    });
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

  /* ---------- events ---------- */
  function wire() {
    $("face").value = state.face; $("seatlabel").value = state.label;
    $("face").addEventListener("input", function (e) {
      state.face = e.target.value; save();
      GAMES.forEach(function (G) { var el = $("sig-" + G[0]); if (el) { var s = signal(G[0]); el.textContent = s[0]; el.className = "pill " + s[1]; } });
    });
    $("seatlabel").addEventListener("input", function (e) { state.label = e.target.value; save(); $("sub").textContent = (state.label || "Wizards home games") + ", nearest first."; });
    $("f-soon").addEventListener("click", function () { state.all = false; save(); render(); });
    $("f-all").addEventListener("click", function () { state.all = true; save(); render(); });
    $("list").addEventListener("input", function (e) {
      var el = e.target; if (!el.dataset || !el.dataset.g) return;
      var g = el.dataset.g; state.prices[g] = state.prices[g] || {}; state.prices[g][el.dataset.k] = el.value; save();
      var sg = signal(g), pill = $("sig-" + g); if (pill) { pill.textContent = sg[0]; pill.className = "pill " + sg[1]; }
      stats();
    });
    $("list").addEventListener("change", function (e) {
      var el = e.target; if (!el.dataset || el.dataset.k !== "seats") return;
      var g = el.dataset.g, n = parseInt(el.value, 10); if (isNaN(n) || n < 0) return;
      var p = state.prices[g] = state.prices[g] || {}; p.hist = p.hist || [];
      var last = p.hist[p.hist.length - 1], now = Date.now();
      if (last && new Date(last.t).toDateString() === new Date(now).toDateString()) { last.n = n; last.t = now; } else { p.hist.push({n: n, t: now}); }
      p.hist = p.hist.slice(-14); p.seats = String(n); save(); paintFast(g); stats();
    });
  }

  load(); wire(); render(); wireNative(); loadPrices();
})();
