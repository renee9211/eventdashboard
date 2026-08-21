const RSVP_STATS_KEY = "event-report-workspace-v1";

function readRsvpStatsProject() {
  try {
    const ws = JSON.parse(localStorage.getItem(RSVP_STATS_KEY) || "null");
    return (ws?.projects || []).find(p => p.id === ws.activeId) || null;
  } catch {
    return null;
  }
}

function escStats(v) {
  return String(v ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function updateRsvpStats() {
  const manager = document.querySelector("#rsvpManagerV3");
  if (!manager) return;
  const project = readRsvpStatsProject();
  if (!project) return;
  const rows = Array.isArray(project.attendees) ? project.attendees : [];
  const attended = rows.filter(x => !!x.attended).length;
  const walkins = rows.filter(x => !!x.walkin).length;
  const noShow = Math.max(0, rows.length - attended);
  const rate = rows.length ? Math.round((attended / rows.length) * 1000) / 10 : 0;

  const grid = manager.querySelector(".rsvp-kpis");
  if (grid) {
    const values = [
      ["Total RSVP", rows.length],
      ["Attended", attended],
      ["No Show", noShow],
      ["Walk-in", walkins],
      ["Attendance Rate", `${rate}%`]
    ];
    grid.innerHTML = values.map(([label, value]) => `<div class="kpi"><span>${label}</span><strong>${value}</strong></div>`).join("");
    grid.classList.add("rsvp-kpis-five");
  }

  let typeCard = manager.querySelector("#rsvpTypeBreakdown");
  if (!typeCard) {
    typeCard = document.createElement("div");
    typeCard.id = "rsvpTypeBreakdown";
    typeCard.className = "rsvp-type-breakdown";
    const tools = manager.querySelector(".rsvp-tools-card");
    const filter = tools?.querySelector(".rsvp-filter-row");
    if (tools && filter) tools.insertBefore(typeCard, filter);
  }
  if (typeCard) {
    const counts = rows.reduce((acc, x) => {
      const key = String(x.type || "Unassigned").trim() || "Unassigned";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const items = Object.entries(counts).sort((a,b) => b[1] - a[1]);
    typeCard.innerHTML = `<span class="rsvp-breakdown-label">Type Breakdown</span>${items.length ? items.map(([k,v]) => `<span class="tag neutral">${escStats(k)} <b>${v}</b></span>`).join("") : '<span class="hint">尚無 RSVP 資料</span>'}`;
  }
}

const statsObserver = new MutationObserver(() => updateRsvpStats());
const statsRoot = document.querySelector("#viewRoot");
if (statsRoot) statsObserver.observe(statsRoot, { childList: true, subtree: true });

document.addEventListener("change", e => {
  if (e.target.closest?.("#rsvpManagerV3")) setTimeout(updateRsvpStats, 20);
}, true);

document.addEventListener("click", e => {
  if (e.target.closest?.("#rsvpManagerV3")) setTimeout(updateRsvpStats, 40);
}, true);

window.addEventListener("storage", e => {
  if (e.key === RSVP_STATS_KEY) updateRsvpStats();
});

setTimeout(updateRsvpStats, 100);
