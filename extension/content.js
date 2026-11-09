(() => {
  const IDLE_MS = 30 * 60 * 1000; // session lapses after 30 min of no activity
  const TICK_MS = 15 * 1000;
  const DEFAULT_SITES = [
    "youtube.com", "reddit.com", "x.com", "twitter.com", "instagram.com",
    "facebook.com", "tiktok.com", "netflix.com", "twitch.tv", "news.ycombinator.com"
  ];

  const host = location.hostname.replace(/^www\./, "");
  let site = null;     // matched entry from the watched list
  let host_ui = null;  // shadow host element
  let shadow = null;
  let mode = null;     // "gate" | "banner" | "overtime" | "outcome"
  let pauser = null;

  const store = chrome.storage.local;

  async function init() {
    const { sites = DEFAULT_SITES } = await store.get("sites");
    site = sites.find((s) => host === s || host.endsWith("." + s));
    if (!site) return;
    chrome.storage.onChanged.addListener((c, area) => {
      if (area === "local" && c.sessions) render();
    });
    setInterval(tick, TICK_MS);
    document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });
    render();
  }

  // ---------- state ----------
  async function getSession() {
    const { sessions = {} } = await store.get("sessions");
    let s = sessions[site];
    if (s && Date.now() - s.last > IDLE_MS) {
      await finish(s, "unrecorded", s.last);
      s = null;
    }
    return s || null;
  }

  async function setSession(s) {
    const { sessions = {} } = await store.get("sessions");
    if (s) sessions[site] = s; else delete sessions[site];
    await store.set({ sessions });
  }

  async function finish(s, outcome, endTs = Date.now()) {
    const { log = [], sessions = {} } = await store.get(["log", "sessions"]);
    log.push({ site, reason: s.reason, estMin: s.estMin, start: s.start, end: endTs, outcome });
    delete sessions[site];
    await store.set({ log, sessions });
  }

  async function tick() {
    if (document.hidden) return;
    const s = await getSession();
    if (!s) return render();
    s.last = Date.now();
    await setSession(s); // triggers render via storage listener
  }

  // ---------- rendering ----------
  function ensureUI() {
    if (host_ui && host_ui.isConnected) return;
    host_ui = document.createElement("div");
    host_ui.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
    shadow = host_ui.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = CSS;
    shadow.append(style);
    (document.documentElement || document).append(host_ui);
    // keep site hotkeys (YouTube etc.) from firing while typing in our UI
    ["keydown", "keyup", "keypress"].forEach((e) =>
      host_ui.addEventListener(e, (ev) => ev.stopPropagation()));
  }

  function clearUI() {
    if (shadow) [...shadow.children].forEach((c) => c.tagName !== "STYLE" && c.remove());
  }

  function el(tag, props = {}, ...kids) {
    const n = document.createElement(tag);
    Object.assign(n, props);
    kids.forEach((k) => n.append(k));
    return n;
  }

  async function render() {
    if (!site) return;
    if (mode === "outcome") return; // don't clobber the check-in question
    const s = await getSession();
    ensureUI();
    if (!s) return showGate();
    const elapsedMin = (Date.now() - s.start) / 60000;
    if (elapsedMin > s.estMin) return showOvertime(s, elapsedMin);
    showBanner(s, elapsedMin);
  }

  function modal(...kids) {
    clearUI();
    const wrap = el("div", { className: "wrap" }, el("div", { className: "card" }, ...kids));
    shadow.append(wrap);
    return wrap;
  }

  function showGate() {
    if (mode === "gate") return;
    mode = "gate";
    const input = el("input", { type: "text", placeholder: "e.g. watch the React hooks talk", maxLength: 140 });
    const mins = el("select");
    [5, 10, 15, 30, 45, 60].forEach((m) => mins.append(el("option", { value: m, textContent: `${m} min` })));
    mins.value = "15";
    const err = el("div", { className: "err" });
    const go = el("button", { className: "primary", textContent: "Go" });
    const leave = el("button", { className: "ghost", textContent: "Never mind, leave" });

    const submit = async () => {
      const reason = input.value.trim();
      if (reason.length < 3) { err.textContent = "Give yourself an actual reason."; return; }
      const now = Date.now();
      mode = null;
      stopPausing();
      await setSession({ reason, estMin: Number(mins.value), start: now, last: now });
    };
    go.onclick = submit;
    input.onkeydown = (e) => { if (e.key === "Enter") submit(); };
    leave.onclick = () => chrome.runtime.sendMessage({ type: "leave" });

    modal(
      el("h1", { textContent: `What are you here to do on ${site}?` }),
      input,
      el("div", { className: "row" }, el("span", { textContent: "Time I'll give it:" }), mins),
      err,
      el("div", { className: "row end" }, leave, go)
    );
    startPausing();
    setTimeout(() => input.focus(), 50);
  }

  function showBanner(s, elapsedMin) {
    mode = "banner";
    stopPausing();
    clearUI();
    const left = Math.max(0, Math.ceil(s.estMin - elapsedMin));
    const done = el("button", { className: "mini", textContent: "Done" });
    done.onclick = () => askOutcome(s);
    const bar = el("div", { className: "banner" },
      el("span", { className: "lbl", textContent: "Here for:" }),
      el("span", { className: "why", textContent: s.reason, title: s.reason }),
      el("span", { className: "left", textContent: `${left}m left` }),
      done
    );
    shadow.append(bar);
  }

  function showOvertime(s, elapsedMin) {
    mode = "overtime";
    const actual = Math.round(elapsedMin);
    const more = el("button", { className: "ghost", textContent: "10 more minutes" });
    const done = el("button", { className: "primary", textContent: "I'm done" });
    more.onclick = async () => { mode = null; s.estMin = Math.ceil(elapsedMin) + 10; await setSession(s); };
    done.onclick = () => askOutcome(s);
    modal(
      el("h1", { textContent: "Time check" }),
      el("p", { textContent: `You came here to: "${s.reason}"` }),
      el("p", { className: "dim", textContent: `You planned ${s.estMin} min. It's been ${actual}.` }),
      el("div", { className: "row end" }, more, done)
    );
    startPausing();
  }

  function askOutcome(s) {
    mode = "outcome";
    const pick = async (outcome) => {
      await finish(s, outcome);
      mode = null;
      stopPausing();
      chrome.runtime.sendMessage({ type: "leave" });
    };
    const btn = (label, v) => el("button", { className: "ghost", textContent: label, onclick: () => pick(v) });
    modal(
      el("h1", { textContent: "Did you do what you came for?" }),
      el("p", { className: "dim", textContent: `"${s.reason}"` }),
      el("div", { className: "row end" }, btn("No", "no"), btn("Partly", "partly"), btn("Yes", "yes"))
    );
    startPausing();
  }

  // pause any media behind the modal
  function startPausing() {
    if (pauser) return;
    const p = () => document.querySelectorAll("video,audio").forEach((m) => { try { m.pause(); } catch (_) {} });
    p(); pauser = setInterval(p, 500);
  }
  function stopPausing() { clearInterval(pauser); pauser = null; }

  const CSS = `
    *{box-sizing:border-box;font-family:system-ui,sans-serif}
    .wrap{position:fixed;inset:0;background:rgba(10,10,14,.92);display:flex;align-items:center;justify-content:center;pointer-events:auto}
    .card{background:#1b1b22;color:#eee;border-radius:14px;padding:28px;width:min(460px,90vw);box-shadow:0 10px 40px #0008}
    h1{font-size:20px;margin:0 0 16px;font-weight:600}
    p{margin:0 0 10px;font-size:15px} .dim{color:#9a9aa8}
    input,select{width:100%;padding:10px 12px;border-radius:8px;border:1px solid #3a3a48;background:#121218;color:#eee;font-size:15px}
    select{width:auto}
    .row{display:flex;gap:10px;align-items:center;margin-top:14px;font-size:14px;color:#bbb}
    .row.end{justify-content:flex-end}
    button{cursor:pointer;border-radius:8px;padding:9px 16px;font-size:14px;border:1px solid #3a3a48}
    .primary{background:#5b7cfa;border-color:#5b7cfa;color:#fff}
    .ghost{background:transparent;color:#ddd}
    .err{color:#ff7b7b;font-size:13px;margin-top:8px;min-height:1em}
    .banner{position:fixed;top:10px;right:10px;max-width:min(420px,80vw);display:flex;gap:8px;align-items:center;
      background:#1b1b22ee;color:#eee;padding:7px 10px;border-radius:999px;font-size:13px;pointer-events:auto;
      box-shadow:0 2px 12px #0006;border:1px solid #33333f}
    .lbl{color:#9a9aa8} .why{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .left{color:#9a9aa8;white-space:nowrap}
    .mini{padding:3px 10px;font-size:12px;background:#2a2a35;color:#eee;border-radius:999px}
  `;

  init();
})();
