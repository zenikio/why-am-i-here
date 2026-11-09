const DEFAULT_SITES = ["youtube.com","reddit.com","x.com","twitter.com","instagram.com","facebook.com","tiktok.com","netflix.com","twitch.tv","news.ycombinator.com"];
const $ = (id) => document.getElementById(id);

async function load() {
  const { log = [], sites = DEFAULT_SITES } = await chrome.storage.local.get(["log", "sites"]);
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
