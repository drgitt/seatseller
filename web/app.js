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


  var WIZ = {id: "wiz", name: "Washington Wizards", league: "NBA", venue: "Capital One Arena", seats: "Section 109, rows E1 and E2", face: "", builtin: true, games: []};
  var state = {v: 2, active: "wiz", all: false, teams: [WIZ], prices: {}, prefs: {theme: "system", weeks: 3, view: "soon", drop: 25, jump: 15}};
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
      state.teams = s.teams; state.active = s.active || s.teams[0].id; state.all = !!s.all; state.prices = s.prices || {};
      for (var k in state.prefs) if (s.prefs && s.prefs[k] != null) state.prefs[k] = s.prefs[k];
    } else {
      try {
        var o = JSON.parse(localStorage.getItem(OLDKEY) || "null");
        if (o) { WIZ.face = o.face || ""; WIZ.seats = o.label || WIZ.seats; state.prices.wiz = o.prices || {}; state.all = !!o.all; }
      } catch (e) {}
      state.all = state.all || false;
    }
    if (!state.teams.some(function (t) { return t.id === state.active; })) state.active = state.teams[0].id;
    try { var p = JSON.parse(localStorage.getItem(PKEY) || "null"); if (p) applyPrices(p); } catch (e) {}
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  function applyPrices(p) { MARKET = (p && p.games) || {}; ALERTS = (p && p.alerts) || []; UPDATED = (p && p.updatedAt) || null; }

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
  function team() { for (var i = 0; i < state.teams.length; i++) if (state.teams[i].id === state.active) return state.teams[i]; return state.teams[0]; }
  function prices() { return state.prices[state.active] || (state.prices[state.active] = {}); }
  function games(t) {
    t = t || team();
    var list = t.id === "wiz" ? GAMES.map(function (G) { return {id: G[0], date: G[1], opp: TEAMS[G[2]], short: G[2], tag: G[3], builtin: true}; }) : [];
    (t.games || []).forEach(function (g) { list.push({id: g.id, date: g.date, opp: g.opp, tag: g.tag || "", builtin: false}); });
    return list.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
  }
  function marketFor(G) { return team().id === "wiz" && G.builtin ? MARKET["g" + G.id] : null; }

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

  function fastInfo(G) {
    var p = prices()[G.id] || {}, h = p.hist || [], now = Date.now(), why = [];
    var drop = Math.max(1, +state.prefs.drop || 25), jump = Math.max(1, +state.prefs.jump || 15);
    if (h.length >= 2) {
      var last = h[h.length - 1], base = null;
      for (var i = 0; i < h.length - 1; i++) { if (now - h[i].t <= 7 * 86400000) { base = h[i]; break; } }
      if (base && base.n > 0 && base.n - last.n >= 2 && last.n <= base.n * (1 - drop / 100)) why.push("seats down " + Math.round((1 - last.n / base.n) * 100) + "% since " + fmtDay(base.t));
    }
    var m = marketFor(G);
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
    pills += '<span class="pill hot" id="fast-' + g + '" hidden></span>';
    pills += '<span class="pill ' + sig[1] + '" id="sig-' + g + '">' + sig[0] + '</span>';
    pills += '<span class="mk" id="mk-' + g + '"></span><span class="mk" id="sd-' + g + '"></span>';
    var tag = G.tag ? '<span>' + esc(G.tag) + '</span>' : '';
    var idl = G.builtin ? '<span class="mono">G' + g + '</span>' : '<button type="button" class="x" data-del="' + esc(g) + '" aria-label="Remove game vs ' + esc(name) + '">Remove</button>';
    return '<div class="' + cls + '" id="g' + g + '">' +
      '<div class="date"><span class="dow">' + DOW[d.getDay()] + '</span><span class="dnum">' + d.getDate() + '</span></div>' +
      '<div class="who"><div class="opp">vs ' + esc(name) + '</div><div class="meta">' + pills + tag + idl + '</div></div>' +
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
      '</div></div>';
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
      paintFast(G);
      var el = $("mk-" + G.id); if (!el) return;
      var m = marketFor(G);
      if (m && m.low != null) {
        var dt = m.checkedAt ? new Date(m.checkedAt) : null;
        el.textContent = "Market low " + money(m.low) + (m.source ? " · " + m.source : "") + (m.listings ? " · " + m.listings + " listings" : "") + (dt && !isNaN(dt) ? " · " + fmtDay(dt.getTime()) : "");
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
    var out = "", lastM = "";
    rows.forEach(function (G) {
      var d = parse(G.date), m = MON[d.getMonth()] + " " + d.getFullYear();
      if (m !== lastM) { out += '<div class="month">' + m + '</div>'; lastM = m; }
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
    paintMarkets(); paintAlerts(); paintFresh(); stats();
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
      render();
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
    $("removeTeam").disabled = state.teams.length < 2;
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
      stats();
    });
    $("list").addEventListener("change", function (e) {
      var el = e.target; if (!el.dataset || el.dataset.k !== "seats") return;
      var g = el.dataset.g, n = parseInt(el.value, 10); if (isNaN(n) || n < 0) return;
      var p = prices()[g] = prices()[g] || {}; p.hist = p.hist || [];
      var last = p.hist[p.hist.length - 1], now = Date.now();
      if (last && new Date(last.t).toDateString() === new Date(now).toDateString()) { last.n = n; last.t = now; } else { p.hist.push({n: n, t: now}); }
      p.hist = p.hist.slice(-14); p.seats = String(n); save();
      var G = games().filter(function (x) { return String(x.id) === g; })[0]; if (G) paintFast(G); stats();
    });
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

  load(); wire(); render(); wireNative();
  splashGate(loadPrices());
})();
