const DEFAULT_SITES = ["youtube.com","reddit.com","x.com","twitter.com","instagram.com","facebook.com","tiktok.com","netflix.com","twitch.tv","news.ycombinator.com"];
const $ = (id) => document.getElementById(id);

const key = (d) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const color = (site) => {
  let h = 0;
  for (const c of site) h = (h * 31 + c.charCodeAt(0)) % 360;
  return `hsl(${h} 55% 52%)`;
};
const fmt = (secs) => {
  const m = Math.round(secs / 60);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
};
const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);

function renderTime(time) {
  const dayInput = $("day");
  if (!dayInput.value) dayInput.value = key(new Date());
  dayInput.max = key(new Date());

  const draw = () => {
    const data = time[dayInput.value] || {};
    $("daytotal").textContent = sum(data) ? "Total: " + fmt(sum(data)) : "No tracked time";
    $("daybars").innerHTML = "";
    const max = Math.max(1, ...Object.values(data));
    Object.entries(data).sort((a, b) => b[1] - a[1]).forEach(([site, secs]) => {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:10px;margin:5px 0;font-size:14px";
      const name = document.createElement("span"); name.style.cssText = "width:150px"; name.textContent = site;
      const bar = document.createElement("div");
      bar.style.cssText = `height:16px;border-radius:4px;background:${color(site)};width:${(secs / max) * 60}%;min-width:3px`;
      const val = document.createElement("span"); val.textContent = fmt(secs);
      row.append(name, bar, val);
      $("daybars").append(row);
    });
  };
  dayInput.onchange = draw;
  draw();

  // last 7 days, stacked by site
  const days = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); days.push(d); }
  const maxTotal = Math.max(1, ...days.map((d) => sum(time[key(d)])));
  const seen = new Set();
  $("week").innerHTML = "";
  days.forEach((d) => {
    const data = time[key(d)] || {};
    const col = document.createElement("div");
    col.style.cssText = "flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;font-size:12px";
    const total = document.createElement("div"); total.textContent = sum(data) ? fmt(sum(data)) : "";
    const stack = document.createElement("div");
    stack.style.cssText = `width:100%;max-width:60px;display:flex;flex-direction:column-reverse;height:${(sum(data) / maxTotal) * 120}px`;
    Object.entries(data).sort((a, b) => b[1] - a[1]).forEach(([site, secs]) => {
      seen.add(site);
      const seg = document.createElement("div");
      seg.style.cssText = `background:${color(site)};flex:${secs}`;
      seg.title = `${site}: ${fmt(secs)}`;
      stack.append(seg);
    });
    const label = document.createElement("div");
    label.style.cssText = "color:#777;margin-top:4px";
    label.textContent = d.toLocaleDateString(undefined, { weekday: "short" });
    col.append(total, stack, label);
    $("week").append(col);
  });
  $("legend").innerHTML = "";
  seen.forEach((site) => {
    const l = document.createElement("span");
    const sw = document.createElement("span");
    sw.style.cssText = `display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;background:${color(site)}`;
    l.append(sw, site);
    $("legend").append(l);
  });
}

async function load() {
  const { log = [], sites = DEFAULT_SITES, time = {} } = await chrome.storage.local.get(["log", "sites", "time"]);
  renderTime(time);
  $("sites").value = sites.join("\n");

  const rec = log.filter((l) => l.outcome !== "unrecorded");
  const n = (o) => rec.filter((l) => l.outcome === o).length;
  const mins = (l) => Math.round((l.end - l.start) / 60000);
  const avg = (a) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : 0);
  const pct = (x) => (rec.length ? Math.round((100 * x) / rec.length) + "%" : "–");
  const over = rec.filter((l) => mins(l) > l.estMin).length;

  $("stats").innerHTML = "";
  [
    ["Visits", log.length],
    ["Did what I came for", pct(n("yes"))],
    ["Partly", pct(n("partly"))],
    ["Wasted", pct(n("no"))],
    ["Avg planned / actual", `${avg(rec.map((l) => l.estMin))} / ${avg(rec.map(mins))} min`],
    ["Went over time", pct(over)],
  ].forEach(([k, v]) => {
    const d = document.createElement("div"); d.className = "stat";
    d.innerHTML = "<b></b><span></span>";
    d.querySelector("b").textContent = v; d.querySelector("span").textContent = k;
    $("stats").append(d);
  });

  $("rows").innerHTML = "";
  [...log].reverse().forEach((l) => {
    const tr = document.createElement("tr");
    [new Date(l.start).toLocaleString(), l.site, l.reason, l.estMin + "m", mins(l) + "m", l.outcome].forEach((v, i) => {
      const td = document.createElement("td"); td.textContent = v;
      if (i === 5) td.className = l.outcome;
      tr.append(td);
    });
    $("rows").append(tr);
  });
}

$("save").onclick = async () => {
  const sites = $("sites").value.split("\n").map((s) => s.trim().toLowerCase().replace(/^www\./, "")).filter(Boolean);
  await chrome.storage.local.set({ sites });
  alert("Saved. Reload open tabs to apply.");
};
$("export").onclick = async () => {
  const { log = [] } = await chrome.storage.local.get("log");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(log, null, 2)], { type: "application/json" }));
  a.download = "why-am-i-here-log.json"; a.click();
};
$("clear").onclick = async () => {
  if (confirm("Delete the whole log?")) { await chrome.storage.local.set({ log: [] }); load(); }
};
load();
