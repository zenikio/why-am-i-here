const $ = (id) => document.getElementById(id);

function item(main, meta, outcome) {
  const d = document.createElement("div"); d.className = "item";
  const a = document.createElement("div"); a.textContent = main;
  const b = document.createElement("div"); b.className = "meta"; b.textContent = meta;
  if (outcome) { const o = document.createElement("span"); o.className = outcome; o.textContent = " · " + outcome; b.append(o); }
  d.append(a, b);
  return d;
}

(async () => {
  const { log = [], sessions = {}, time = {} } = await chrome.storage.local.get(["log", "sessions", "time"]);
  const t = new Date(), pad = (n) => String(n).padStart(2, "0");
  const timeToday = time[`${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`] || {};
  const midnight = new Date().setHours(0, 0, 0, 0);
  const today = log.filter((l) => l.start >= midnight);
  const rec = today.filter((l) => l.outcome !== "unrecorded");
  const mins = (l) => Math.round((l.end - l.start) / 60000);
  const yes = rec.filter((l) => l.outcome === "yes").length;

  [["Visits today", today.length],
   ["Did it", rec.length ? Math.round((100 * yes) / rec.length) + "%" : "–"],
   ["Active min", Math.round(Object.values(timeToday).reduce((a, b) => a + b, 0) / 60)]].forEach(([k, v]) => {
    const d = document.createElement("div"); d.className = "stat";
    d.innerHTML = "<b></b><span></span>";
    d.querySelector("b").textContent = v; d.querySelector("span").textContent = k;
    $("stats").append(d);
  });

  const live = Object.entries(sessions).filter(([, s]) => Date.now() - s.last < 30 * 60000);
  if (!live.length) $("active").innerHTML = '<div class="empty">No active sessions.</div>';
  live.forEach(([site, s]) =>
    $("active").append(item(s.reason, `${site} · ${Math.round((Date.now() - s.start) / 60000)} of ${s.estMin} min`)));

  const recent = [...log].reverse().slice(0, 3);
  if (!recent.length) $("recent").innerHTML = '<div class="empty">Nothing yet.</div>';
  recent.forEach((l) => $("recent").append(item(l.reason, `${l.site} · ${mins(l)}m`, l.outcome)));

  $("full").onclick = () => { chrome.runtime.openOptionsPage(); window.close(); };
})();
