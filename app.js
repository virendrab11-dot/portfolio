/* =========================================================================
   Virendra Bhakuni — portfolio
   1. Data helpers   2. Render   3. Player + filters   4. Motion (desktop 3D / mobile flat)
   ========================================================================= */
const data = window.VIDEO_DATA;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const fmtCompact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const fmtDate = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" });

// ---------------------------------------------------------------------------
// 1. Data helpers
// ---------------------------------------------------------------------------
const videosOf = (key) => (data?.channels?.[key]?.videos ?? []).map((v) => ({ ...v, channel: key }));
const allVideos = () => [...videosOf("music"), ...videosOf("kids")];
const byViews = (a, b) => (b.views ?? 0) - (a.views ?? 0);
const hd = (v) => v.thumbnailHd || v.thumbnail;

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
const cleanTitle = (t) => t.replace(/(\s*#[\p{L}\p{N}_]+)+\s*$/u, "").trim() || t;
const stripEmoji = (t) => t.replace(/[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}️‍]/gu, "").replace(/\s{2,}/g, " ").trim();
// "Teri Aahat — Aarav & Meera | Official Music Video | Virendra Bhakuni" → "Teri Aahat"
const shortName = (v) => stripEmoji(cleanTitle(v.title)).split(/\s+[|—–]\s+/)[0].trim() || stripEmoji(v.title);
const songKey = (v) => shortName(v).replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
const metaLine = (v) => [v.views != null ? `${fmtCompact.format(v.views)} views` : "", fmtDate.format(new Date(v.published))].filter(Boolean).join(" · ");

const playAttrs = (v) =>
  `data-play data-id="${v.id}" data-short="${v.isShort}" data-title="${esc(v.title)}" data-url="${esc(v.url)}" aria-label="Play: ${esc(stripEmoji(cleanTitle(v.title)))}"`;
const img = (v, { big = false, lazy = true } = {}) =>
  `<img src="${big ? hd(v) : v.thumbnail}" data-vid="${v.id}" alt="" width="480" height="360" decoding="async" ${lazy ? 'loading="lazy"' : ""}>`;

// Thumbnail fallbacks (blocked host or missing size) → finally a blank tile, never a broken icon
const thumbFallbacks = (id) => [
  `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
  `https://i.ytimg.com/vi/${id}/sddefault.jpg`,
  `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
  `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
];
document.addEventListener("error", (e) => {
  const el = e.target;
  if (!(el instanceof HTMLImageElement) || !el.dataset.vid) return;
  const urls = thumbFallbacks(el.dataset.vid);
  const next = Number(el.dataset.try ?? urls.indexOf(el.src)) + 1;
  el.dataset.try = next;
  if (next < urls.length) el.src = urls[next];
  else el.parentElement?.classList.add("no-thumb");
}, true);

// Labels in the layout's own vocabulary
const LABELS = {
  music: { video: ["[ ORIGINAL ]", "MUSIC VIDEO", "AI MUSIC VIDEO"], short: ["[ VISUAL LAB ]", "AI VIDEO", "AI VIDEO"] },
  kids: { video: ["[ MUSICAL TALE ]", "3D ANIMATION", "KIDS SONG"], short: ["[ CHARACTER WORLD ]", "KIDS ANIMATION", "KIDS SONG"] },
};

// The named projects from the layout, matched to real uploads (skipped if no upload matches)
const CURATED = [
  { re: /teri aahat/i, ch: "music", short: false, title: "Teri Aahat", small: "AI MUSIC VIDEO", tag: "[ ORIGINAL ]", kind: "MUSIC VIDEO" },
  { re: /pyaari billi/i, ch: "kids", short: true, title: "Pyaari Billi", small: "KIDS SONG", tag: "[ CHARACTER WORLD ]", kind: "KIDS ANIMATION" },
  { re: /kaa?lu madari/i, ch: "kids", short: false, title: "Kalu Madari", small: "KIDS SONG", tag: "[ MUSICAL TALE ]", kind: "3D ANIMATION" },
  { re: /machli jal ki rani/i, ch: "kids", short: null, title: "Machli Jal Ki Rani", small: "KIDS SONG", tag: "[ UNDERWATER ]", kind: "KIDS SONG" },
  { re: /visual experiment/i, ch: "music", short: null, title: "Visual Experiments", small: "AI VIDEO", tag: "[ VISUAL LAB ]", kind: "AI VIDEO" },
];

function asProject(v, cur) {
  const [tag, kind, small] = LABELS[v.channel][v.isShort ? "short" : "video"];
  return { v, title: cur?.title ?? shortName(v), small: cur?.small ?? small, tag: cur?.tag ?? tag, kind: cur?.kind ?? kind };
}

// Featured work list for a filter: named projects first, then most-watched, one per song
function featured(filter, max = 12) {
  const pass = (v) => filter === "all" || (filter === "music" && v.channel === "music") || (filter === "kids" && v.channel === "kids")
    || (filter === "video" && !v.isShort) || (filter === "experiments" && v.isShort);
  const out = [];
  const seen = new Set();
  const add = (v, cur) => {
    if (!v || !pass(v) || seen.has(songKey(v)) || out.length >= max) return;
    seen.add(songKey(v));
    out.push(asProject(v, cur));
  };
  CURATED.forEach((c) => {
    const matches = videosOf(c.ch).filter((v) => c.re.test(v.title));
    add((c.short === null ? matches : matches.filter((v) => v.isShort === c.short)).sort(byViews)[0] ?? matches.sort(byViews)[0], c);
  });
  // Alternate channels so "All" mixes both
  const m = videosOf("music").sort(byViews);
  const k = videosOf("kids").sort(byViews);
  for (let i = 0; i < Math.max(m.length, k.length); i++) { add(m[i]); add(k[i]); }
  return out;
}

// ---------------------------------------------------------------------------
// 2. Render
// ---------------------------------------------------------------------------
function renderHero() {
  const long = (key) => videosOf(key).filter((v) => !v.isShort).sort(byViews);
  // Up to 5 per channel, never the same video, song or thumbnail twice; full-length videos first
  const seen = new Set();
  const pickFrom = (key, n) => [...long(key), ...videosOf(key).filter((v) => v.isShort).sort(byViews)].filter((v) => {
    const keys = [v.id, songKey(v), hd(v)];
    if (keys.some((k) => seen.has(k))) return false;
    keys.forEach((k) => seen.add(k));
    return true;
  }).slice(0, n);
  const m = pickFrom("music", 5);
  const k = pickFrom("kids", 5);
  const cards = [];
  for (let i = 0; i < 5; i++) { if (m[i]) cards.push(m[i]); if (k[i]) cards.push(k[i]); } // alternate the channels
  $("#hero-cards").innerHTML = cards.map((v, i) =>
    `<button class="hero-card hc${i}" ${playAttrs(v)} data-name="${esc(shortName(v))}" tabindex="-1">${img(v, { big: true, lazy: false })}</button>`).join("");
  const reel = long("music")[0] ?? allVideos()[0];
  if (reel) Object.assign($("#showreel").dataset, { play: "", id: reel.id, short: String(reel.isShort), title: reel.title, url: reel.url });
}

function projectCard(p, i) {
  return `
    <button class="project ring-card" ${playAttrs(p.v)} data-i="${i}" data-title-short="${esc(p.title)}" data-small="${esc(p.small)}" data-tag="${esc(p.tag)}" data-kind="${esc(p.kind)}">
      <span class="thumb">
        ${img(p.v, { big: true })}
        <span class="play" aria-hidden="true"><svg class="ico"><use href="#i-play"/></svg></span>
        <span class="image-tag"><span>${esc(p.tag)}</span>${esc(p.kind)}</span>
      </span>
      <span class="project-meta"><span><span class="h3">${esc(p.title)}</span><small>${esc(p.small)}</small></span><span class="idx">${String(i + 1).padStart(2, "0")}</span></span>
    </button>`;
}

function renderRing(filter = "all") {
  const list = featured(filter);
  $("#ring").innerHTML = list.length ? list.map(projectCard).join("") : `<p class="empty">No videos in this category yet.</p>`;
  return list;
}

function mcard(v) {
  return `<button class="mcard ${v.isShort ? "short" : ""}" ${playAttrs(v)} data-tilt>
      ${img(v, { big: !v.isShort })}
      <span class="mcard-info"><span class="h3">${esc(shortName(v))}</span><small>${metaLine(v)}</small></span>
    </button>`;
}

// Cartoon series, detected from titles (a compilation can belong to several). Add new characters here.
const KIDS_SERIES = [
  { id: "billi", name: "Pyaari Billi", re: /pyaa?ri billi/i, color: "var(--k-coral)" },
  { id: "haathi", name: "Nanhe Haathi", re: /nanhe haathi/i, color: "var(--k-sky)" },
  { id: "mota", name: "Ek Mota Hathi", re: /mota hathi/i, color: "var(--k-mint)" },
  { id: "madari", name: "Kalu Madari", re: /kaa?lu madari/i, color: "var(--k-grape)" },
  { id: "festival", name: "Festival Songs", re: /dussehra|diwali|holi|navratri|festival/i, color: "var(--k-sun)" },
];
const seriesOf = (v) => KIDS_SERIES.filter((s) => s.re.test(v.title)).map((s) => s.id);
// "NEW" = the 3 most recent kids uploads, if they're less than a week old (the channel posts often)
const NEW_IDS = new Set(videosOf("kids")
  .filter((v) => data?.updated && (new Date(data.updated) - new Date(v.published)) < 7 * 864e5)
  .sort((a, b) => new Date(b.published) - new Date(a.published)).slice(0, 3).map((v) => v.id));
const isNew = (v) => NEW_IDS.has(v.id);

function kcard(v) {
  const part = v.title.match(/\bpart\s*(\d+)/i);
  return `<button class="kcard ${v.isShort ? "short" : ""}" ${playAttrs(v)} data-series="${seriesOf(v).join(" ")}" data-tilt>
      <span class="kthumb">${img(v, { big: !v.isShort })}
        ${part ? `<span class="kbadge">Part ${part[1]}</span>` : ""}
        ${isNew(v) ? '<span class="knew">NEW</span>' : ""}
        <span class="kplay" aria-hidden="true"><svg class="ico"><use href="#i-play"/></svg></span></span>
      <span class="kinfo"><span class="h3">${esc(shortName(v))}</span><small>${metaLine(v)}</small></span>
    </button>`;
}

function renderKids() {
  const kids = videosOf("kids");
  if (!kids.length) {
    $(".kids-stage").innerHTML = `<p class="empty">No videos loaded yet. Run <code>python fetch_videos.py</code> in the portfolio folder.</p>`;
    return;
  }
  // TV + 4 picks: the most-watched cartoons (full-length first), one per song/thumbnail
  const seen = new Set();
  const top = [...kids.filter((v) => !v.isShort).sort(byViews), ...kids.filter((v) => v.isShort).sort(byViews)].filter((v) => {
    const keys = [songKey(v), hd(v)];
    if (keys.some((k) => seen.has(k))) return false;
    keys.forEach((k) => seen.add(k));
    return true;
  }).slice(0, 5);
  kidsTvId = top[0].id;
  setTv(top[0], false);
  $("#kids-picks").innerHTML = top.slice(1).map(pickCard).join("");

  // Row: every other cartoon, newest first
  const inStage = new Set(top.map((v) => v.id));
  const rest = kids.filter((v) => !inStage.has(v.id));
  $("#kids-row").innerHTML = rest.map(kcard).join("");
  if (!rest.length) $(".kids-more").remove();

  // Character tabs with counts for the row, busiest first
  const tabs = KIDS_SERIES.map((s) => ({ ...s, n: rest.filter((v) => s.re.test(v.title)).length }))
    .filter((s) => s.n).sort((a, b) => b.n - a.n);
  $("#kids-tabs").innerHTML = [{ id: "all", name: "All cartoons", n: rest.length, color: "var(--k-sun)" }, ...tabs].map((s) =>
    `<button class="ktab" data-series="${s.id}" aria-pressed="${s.id === "all"}" style="--dot:${s.color}"><span class="dot" aria-hidden="true"></span>${esc(s.name)}<span class="n">${s.n}</span></button>`).join("");
}

let kidsTvId = null;
const kidsById = (id) => videosOf("kids").find((v) => v.id === id);

function pickCard(v) {
  return `<button class="kpick" data-id="${v.id}" aria-label="Show ${esc(shortName(v))} on the TV">
      <span class="kpthumb">${img(v, { big: true })}<span class="kptv" aria-hidden="true">Put on TV</span></span>
      <span class="kptitle">${esc(shortName(v))}</span>
    </button>`;
}

// Put a cartoon on the TV (the screen and "Watch now" then play it)
function setTv(v, isSwap) {
  const screen = $("#tv-screen");
  const data = { play: "", id: v.id, short: String(v.isShort), title: v.title, url: v.url };
  Object.assign(screen.dataset, data);
  Object.assign($("#spot-play").dataset, data);
  screen.setAttribute("aria-label", `Play: ${stripEmoji(cleanTitle(v.title))}`);
  const pic = $("img", screen);
  delete pic.dataset.try;
  pic.dataset.vid = v.id;
  pic.src = hd(v);
  $("#spot-title").textContent = shortName(v);
  $("#spot-meta").textContent = metaLine(v);
  const most = [...videosOf("kids")].sort(byViews)[0];
  $("#spot-badge").textContent = isSwap && v.id !== most?.id ? "Now on TV" : "Most watched";
}

// Clicking a pick swaps it with whatever is on the TV
let kidsSwapFx = null; // set by kidsMotion
$("#kids-picks").addEventListener("click", (e) => {
  const pick = e.target.closest(".kpick");
  if (!pick) return;
  const incoming = kidsById(pick.dataset.id);
  const outgoing = kidsById(kidsTvId);
  if (!incoming || !outgoing) return;
  // Update the pick in place (keeps its hover effects) so it now shows what was on the TV
  const swap = () => {
    setTv(incoming, true);
    kidsTvId = incoming.id;
    pick.dataset.id = outgoing.id;
    pick.setAttribute("aria-label", `Show ${shortName(outgoing)} on the TV`);
    const pic = $("img", pick);
    delete pic.dataset.try;
    pic.dataset.vid = outgoing.id;
    pic.src = hd(outgoing);
    $(".kptitle", pick).textContent = shortName(outgoing);
  };
  if (kidsSwapFx) kidsSwapFx(swap, pick); else swap();
});

// Row arrows scroll by most of a screen
$$(".row-btn").forEach((btn) => btn.addEventListener("click", () => {
  const row = $("#kids-row");
  row.scrollBy({ left: Number(btn.dataset.dir) * row.clientWidth * .8, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}));

let kidsFilterFx = null; // set by kidsMotion for a bouncy re-entry
$("#kids-tabs").addEventListener("click", (e) => {
  const tab = e.target.closest(".ktab");
  if (!tab || tab.getAttribute("aria-pressed") === "true") return;
  $$(".ktab").forEach((t) => t.setAttribute("aria-pressed", String(t === tab)));
  const id = tab.dataset.series;
  const shown = [];
  $$("#kids-row .kcard").forEach((c) => {
    const on = id === "all" || c.dataset.series.split(" ").includes(id);
    c.classList.toggle("is-hidden", !on);
    if (on) shown.push(c);
  });
  $("#kids-row").scrollTo({ left: 0 });
  kidsFilterFx?.(shown);
});

function renderChannels() {
  const empty = `<p class="empty">No videos loaded yet. Run <code>python fetch_videos.py</code> in the portfolio folder.</p>`;
  const music = videosOf("music");
  $("#music-videos").innerHTML = music.filter((v) => !v.isShort).map(mcard).join("") || empty;
  $("#music-shorts").innerHTML = music.filter((v) => v.isShort).map(mcard).join("");
  renderKids();
  ["music", "kids"].forEach((key) => {
    const ch = data?.channels?.[key];
    if (ch?.subscribeUrl) $(`[data-subscribe="${key}"]`).href = ch.subscribeUrl;
  });
}

function renderStats() {
  const sum = (list) => list.reduce((s, v) => s + (v.views ?? 0), 0);
  const all = allVideos();
  if (!all.length) { $("#about-stats").remove(); return $("#stats").remove(); }
  const rows = [
    ["Recent videos", all.length],
    ["Total views", sum(all), "gold"],
    ["Music & Travel views", sum(videosOf("music"))],
    ["Kids Cartoons views", sum(videosOf("kids"))],
  ];
  // (each with a rounded icon tile: a play icon for videos, a gold eye for views)
  $("#about-stats").innerHTML = [["Total videos", all.length, "playbox"], ["Total views", sum(all), "eye"]].map(([label, n, icon]) =>
    `<div><dt><span class="ab-ico" aria-hidden="true"><svg class="ico"><use href="#i-${icon}"/></svg></span>${label}</dt><dd data-count="${n}">${n >= 1000 ? fmtCompact.format(n) : n}</dd></div>`).join("");
  $("#stats-grid").innerHTML = rows.map(([label, n, cls = ""]) =>
    `<div class="stat ${cls}"><dt>${label}</dt><dd data-count="${n}">${n >= 1000 ? fmtCompact.format(n) : n}</dd></div>`).join("");
  if (data?.updated) $("#updated").textContent = `Videos updated ${fmtDate.format(new Date(data.updated))}`;
}

// ---------------------------------------------------------------------------
// 3. Player + filters
// ---------------------------------------------------------------------------
const dialog = $("#player");
const frame = $("#player-frame");
let lastFocus = null;
let lenis = null;
let suppressClick = false; // set while dragging the ring

// Opera Mini (data-saving "Extreme" mode) renders pages on Opera's servers and sends a static snapshot:
// scripts stop after load, so scroll animations and the popup player can't work there.
const proxyBrowser = !!window.operamini || /Opera Mini/i.test(navigator.userAgent);

function openPlayer(el) {
  lastFocus = el;
  const { id, short, title, url } = el.dataset;
  // No popup support (Opera Mini, very old browsers): open the video on YouTube instead
  if (proxyBrowser || typeof dialog.showModal !== "function") {
    location.href = url || `https://www.youtube.com/watch?v=${id}`;
    return;
  }
  dialog.classList.toggle("vertical", short === "true");
  frame.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1"
      title="${esc(title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
  $("#player-title").textContent = title;
  $("#player-yt").href = url;
  dialog.showModal();
  document.body.classList.add("no-scroll");
  lenis?.stop();
}
dialog.addEventListener("close", () => {
  frame.innerHTML = "";
  document.body.classList.remove("no-scroll");
  lenis?.start();
  lastFocus?.focus({ preventScroll: true });
});
dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
$("#player-close").addEventListener("click", () => dialog.close());
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-play]");
  if (!el || suppressClick) return;
  openPlayer(el);
});

// ---------------------------------------------------------------------------
// Contact form (dialog). Every [data-contact] button opens it; without JavaScript
// those buttons are plain links to #contact (the footer with the email link).
// ---------------------------------------------------------------------------
const CONTACT_ENDPOINT = "https://script.google.com/macros/s/AKfycbw-HAUG6cnEW3PoPnvGL1aCq1086OWHeL7w2OOHuNxP4lYN2nIYt_WrTtrT4jnQxxcSVQ/exec";
const contactDialog = $("#contact-modal");
const contactForm = $("#contact-form");
const cfStatus = $("#cf-status");
const cfSubmit = $(".cf-submit", contactForm);
let contactOpener = null;
let triedSubmit = false;

function openContact(opener) {
  // No dialog support (very old browsers, Opera Mini): fall back to the footer
  if (proxyBrowser || typeof contactDialog.showModal !== "function") {
    location.hash = "#contact";
    return;
  }
  contactOpener = opener;
  if (!$("#cf-success").hidden) resetContact();
  contactDialog.showModal();
  document.body.classList.add("no-scroll");
  lenis?.stop();
  setTimeout(() => $("#cf-name").focus(), 50);
}

function closeContact() {
  if (contactDialog.open) contactDialog.close();
}

contactDialog.addEventListener("close", () => {
  document.body.classList.remove("no-scroll");
  lenis?.start();
  contactOpener?.focus({ preventScroll: true });
});
contactDialog.addEventListener("click", (e) => { if (e.target === contactDialog) closeContact(); }); // backdrop
$(".cf-close").addEventListener("click", closeContact);
$("#cf-done").addEventListener("click", closeContact);
document.addEventListener("click", (e) => {
  const opener = e.target.closest("[data-contact]");
  if (!opener) return;
  e.preventDefault();
  openContact(opener);
});

// ---- Validation ----
const CONTACT_RULES = {
  name: (v) => (v.trim().length >= 2 ? "" : "Please enter your name."),
  email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? "" : "Please enter a valid email address."),
  subject: (v) => (v ? "" : "Please choose a subject."),
  message: (v) => (v.trim().length >= 10 ? "" : "Please write a message (at least 10 characters)."),
};

function checkField(name) {
  const field = contactForm.elements[name];
  const msg = CONTACT_RULES[name](field.value);
  field.setAttribute("aria-invalid", String(!!msg));
  $(`#${field.id}-err`).textContent = msg;
  return !msg;
}

// After the first submit attempt, re-check fields as the visitor fixes them
Object.keys(CONTACT_RULES).forEach((name) => {
  const field = contactForm.elements[name];
  const recheck = () => triedSubmit && checkField(name);
  field.addEventListener("input", recheck);
  field.addEventListener("change", recheck);
  field.addEventListener("blur", recheck);
});

function setLoading(on) {
  cfSubmit.disabled = on;
  cfSubmit.classList.toggle("is-loading", on);
  $(".cf-label", cfSubmit).textContent = on ? "Sending…" : "Send message";
  contactForm.setAttribute("aria-busy", String(on));
}

function showContactError() {
  cfStatus.className = "cf-status is-error";
  cfStatus.innerHTML = `Sorry, your message couldn't be sent. Please try again, or <a href="${$(".cf-direct a").href}">email me directly</a>.`;
}

function showContactSuccess() {
  $("#cf-panel").hidden = true;
  const done = $("#cf-success");
  done.hidden = false;
  done.focus();
  if (window.gsap && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    gsap.timeline()
      .from(".cf-check", { scale: 0, rotation: -40, duration: .8, ease: "elastic.out(1, .5)" })
      .from(".cf-check svg", { scale: .3, opacity: 0, duration: .4, ease: "back.out(2)" }, "-=.55")
      .from(".cf-success > :not(.cf-check)", { opacity: 0, y: 16, duration: .5, ease: "power3.out", stagger: .08 }, "-=.3");
  }
}

function resetContact() {
  contactForm.reset();
  triedSubmit = false;
  cfStatus.textContent = "";
  cfStatus.className = "cf-status";
  Object.keys(CONTACT_RULES).forEach((name) => {
    contactForm.elements[name].removeAttribute("aria-invalid");
    $(`#${contactForm.elements[name].id}-err`).textContent = "";
  });
  $("#cf-panel").hidden = false;
  $("#cf-success").hidden = true;
}

contactForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (cfSubmit.disabled) return; // already sending
  triedSubmit = true;
  cfStatus.textContent = "";
  cfStatus.className = "cf-status";
  const results = Object.keys(CONTACT_RULES).map(checkField);
  if (results.includes(false)) {
    contactForm.querySelector('[aria-invalid="true"]')?.focus();
    return;
  }

  const f = contactForm.elements;
  const body = new URLSearchParams({
    name: f.name.value.trim(),
    email: f.email.value.trim(),
    subject: f.subject.value,
    message: f.message.value.trim(),
    website: f.website.value, // honeypot: real visitors leave it empty
  });

  setLoading(true);
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), 15000);
  try {
    // "no-cors": Google Apps Script doesn't send CORS headers, so the reply can't be read.
    // A completed request counts as sent; a network failure or timeout shows the error.
    await fetch(CONTACT_ENDPOINT, { method: "POST", mode: "no-cors", body, signal: timeout.signal });
    showContactSuccess();
  } catch {
    showContactError();
  } finally {
    clearTimeout(timer);
    setLoading(false);
  }
});

let onRingRebuilt = () => {}; // replaced by the 3D ring in motion mode
$$(".filter").forEach((btn) => btn.addEventListener("click", () => {
  if (btn.classList.contains("active")) return;
  $$(".filter").forEach((b) => { b.classList.toggle("active", b === btn); b.setAttribute("aria-pressed", String(b === btn)); });
  renderRing(btn.dataset.filter);
  onRingRebuilt();
}));

// ---------------------------------------------------------------------------
// Init (render first, so the page works even if the animation libraries fail)
// ---------------------------------------------------------------------------
renderHero();
renderRing();
renderChannels();
renderStats();

// ===========================================================================
// 4. Motion
//    Desktop (≥1000px wide, motion allowed): full 3D scenes, pinned and scrubbed.
//    Mobile: flat layout with simple fades. Reduced motion: no animation at all.
//    Everything animated is transform or opacity.
// ===========================================================================
const root = document.documentElement;
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;

// Split headings into words once (each word gets its own 3D-rotating inner span)
function splitWords(el) {
  const walk = (node) => [...node.childNodes].forEach((child) => {
    if (child.nodeType === Node.ELEMENT_NODE) return walk(child);
    if (child.nodeType !== Node.TEXT_NODE) return;
    const frag = document.createDocumentFragment();
    child.textContent.split(/(\s+)/).forEach((part) => {
      if (!part) return;
      if (/^\s+$/.test(part)) return frag.append(" ");
      const w = document.createElement("span");
      w.className = "w";
      w.innerHTML = `<span class="w-in">${esc(part)}</span>`;
      frag.append(w);
    });
    child.replaceWith(frag);
  });
  walk(el);
}

function wordReveal(el, opts = {}) {
  return gsap.from($$(".w-in", el), {
    rotationX: -85, yPercent: 60, opacity: 0, duration: 1.1, ease: "power4.out", stagger: .08, ...opts,
  });
}

// ---- Smooth scrolling (desktop) ----
function initLenis() {
  if (!window.Lenis) return null;
  const l = new Lenis({ lerp: 0.09 });
  l.on("scroll", ScrollTrigger.update);
  const tick = (t) => l.raf(t * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  const onAnchor = (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.hasAttribute("data-contact")) return; // contact buttons open the form instead
    const target = $(a.getAttribute("href"));
    if (!target) return;
    e.preventDefault();
    l.scrollTo(target, { duration: 1.6 });
  };
  document.addEventListener("click", onAnchor);
  return { lenis: l, destroy: () => { gsap.ticker.remove(tick); document.removeEventListener("click", onAnchor); l.destroy(); } };
}

// ---- The girl: pose images stacked on one 0×0 anchor at her feet ----
// [width, height, feet x (0–1)] of each WebP. All share one scale, so she is the same size in every pose;
// --gh on the page = her idle height (400px in the files).
const GIRL = {
  idle: [191, 400, .49], point: [315, 401, .36], pull: [376, 375, .62], surprised: [345, 395, .46], reach: [288, 394, .37],
  cheer: [291, 397, .53], run: [291, 379, .52], slide: [310, 325, .6], fall: [384, 370, .5], wave: [228, 399, .52],
  // Music world (pink headphones)
  "music-land": [282, 369, .31], "music-dance": [272, 389, .64], "music-walk": [274, 389, .59],
  // Jungle explorer (backpack and binoculars)
  "safari-land": [322, 380, .47], "safari-look": [309, 383, .45], "safari-walk": [290, 381, .51], "safari-wave": [261, 387, .66],
};
const GIRL_H = 400;
const girlSrc = (n) => `assets/girl/${n}.webp`;
// Each world's poses (outfit changes happen out of sight, inside the reveals)
const WORLD = {
  intro: ["idle", "point", "pull", "surprised", "reach", "cheer", "run", "slide", "fall"],
  home: ["idle", "point", "fall", "run", "cheer"],
  work: ["idle", "run", "cheer", "fall"],
  stats: ["idle", "run", "surprised", "pull", "cheer", "wave"],
  music: ["music-land", "music-dance", "music-walk"],
  kids: ["fall", "safari-land", "safari-look", "safari-walk", "safari-wave"],
  contact: ["idle", "wave"],
};
// Decode a world's poses before she appears there, so swaps never flash
const girlDecoded = {};
const girlCache = [];
const preloadGirl = (names = WORLD.intro) => Promise.all(names.map((n) => (girlDecoded[n] ??= (() => {
  const im = new Image();
  im.src = girlSrc(n);
  girlCache.push(im);
  return im.decode().catch(() => {});
})())));
// Layout values read while drawing scroll frames are kept until the layout changes (a refresh, a resize, a rebuilt
// ring), so drawing never forces the browser to lay the page out again mid-frame
let layoutEpoch = 0;
const cached = (fn) => { let v, at = -1; return () => (at === layoutEpoch ? v : ((at = layoutEpoch), (v = fn()))); };
// Where an element sits in its scene with nothing scrolled or moved (layout offsets up to the scene's own layer)
function restPos(el) {
  let x = 0, y = 0;
  for (let n = el; n && !n.classList?.contains("scene-fx"); n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
  return { x, y };
}
// The walk from the process scene into the stats scene (both girls read it): where she starts and where she arrives,
// in screen coordinates with neither scene moved
const handoff = { start: null, entry: null };
// Scroll-scrubbed pose changes: [[progress, pose], …]; the last one at or before p wins (exact in both directions)
const poseAt = (track, p) => track.reduce((cur, [at, n]) => (p >= at ? n : cur), track[0][1]);
// A moment drawn from scroll: draw(p) gets the progress (0–1) of a scroll range whenever it changes and after refreshes
const scrubbed = (range, draw) => ScrollTrigger.create({ ...range, onUpdate: (self) => draw(self.progress), onRefresh: (self) => draw(self.progress) });
// Endless tweens in a scene only run while that scene is on screen (scene stack); get(): the tweens, which may come later
function whileShown(id, get) {
  if (!stack) return null;
  const set = (on) => get().forEach((t) => t?.paused(!on));
  const st = ScrollTrigger.create({ ...stack.span(id), onToggle: (self) => set(self.isActive) });
  set(st.isActive);
  return st;
}

// Layers: .girl moves her around, .girl-act squashes/tilts/hops, .girl-breath breathes
function makeGirl(host, cls, poses = Object.keys(GIRL)) {
  const el = document.createElement("div");
  el.className = `girl ${cls}`;
  el.setAttribute("aria-hidden", "true");
  el.innerHTML = `<span class="girl-shadow"></span><div class="girl-act"><div class="girl-breath">${poses.map((n) => [n, GIRL[n]]).map(([n, [w, h, fx]]) =>
    `<img class="gp" data-pose="${n}" src="${girlSrc(n)}" alt="" width="${w}" height="${h}" decoding="async" draggable="false" style="height:calc(var(--gh) * ${(h / GIRL_H).toFixed(4)});translate:${(-fx * 100).toFixed(1)}% 0">`).join("")}</div></div>`;
  host.append(el);
  const imgs = Object.fromEntries($$(".gp", el).map((im) => [im.dataset.pose, im]));
  const act = $(".girl-act", el);
  const breathEl = $(".girl-breath", el);
  const breath = gsap.to(breathEl, { scaleY: 1.022, scaleX: .99, duration: 1.5, ease: "sine.inOut", repeat: -1, yoyo: true });
  const shadow = $(".girl-shadow", el);
  let cur = null;
  return {
    el, act, breathEl, breath, shadow,
    get pose() { return cur; },
    height: cached(() => shadow.offsetWidth / .44),   // = --gh (the shadow is .44 of it), even while her images wait to load
    // Swap pose: the new one fades in on top (fade 0 = instant, for swaps hidden in a squash)
    set(name, fade = .1) {
      if (name === cur || !imgs[name]) return;
      const prev = imgs[cur];
      const next = imgs[name];
      cur = name;
      Object.values(imgs).forEach((im) => { if (im !== prev && im !== next) { gsap.killTweensOf(im); gsap.set(im, { opacity: 0, zIndex: 0 }); } });
      gsap.set(next, { zIndex: 1 });
      gsap.to(next, { opacity: 1, duration: fade, overwrite: true });
      if (prev) gsap.set(prev, { zIndex: 0 }), gsap.to(prev, { opacity: 0, duration: fade / 2, delay: fade / 2, overwrite: true });
    },
    destroy() {
      breath.kill();
      gsap.killTweensOf([el, act, breathEl, ...Object.values(imgs)]);
      el.remove();
    },
  };
}

// The hero's entrance waits until the intro hands over (released straight away when there is no pinned intro)
const heroGate = {
  open: true, fns: new Set(),
  hold() { this.open = false; },
  release() { this.open = true; this.fns.forEach((fn) => fn()); this.fns.clear(); },
  wait(fn) { if (this.open) fn(); else this.fns.add(fn); return () => this.fns.delete(fn); },
};

// ---- Scene stack: every section is a full-screen layer under the one before it ----
// Scrolling plays a scene's own animation, then peels it away over half a screen to reveal the next one.
// One real scrollbar: .scene-track holds a spacer per scene (its own scroll + the reveal). Layers:
// .scene (fixed; visibility + the outgoing reveal: clip/mask/transform) > .scene-fx (the incoming
// reveal: scale/rotation/shake) > the original section, which moves up when its content is taller than the screen.
let stack = null;
const SCENES = [
  ["intro", ".intro"], ["home", ".hero"], ["work", ".work-section"], ["music", ".music-section"], ["kids", ".kids-section"],
  ["about", ".about-section"], ["process", ".process-section"], ["stats", ".stats-section"], ["contact", "footer"],
];
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeCache = {};
// Progress of p between a and b (0–1), optionally eased
const ramp = (p, a, b, ease) => {
  const t = clamp01((p - a) / (b - a));
  return ease ? (easeCache[ease] ??= gsap.parseEase(ease))(t) : t;
};

// ScrollTrigger positions for an element: as written on a normal page; in the stack, mapped onto its scene's scroll
function trig(el, start = "top 85%", end) {
  if (!stack) return end ? { trigger: el, start, end } : { trigger: el, start };
  const pos = (s) => { const [edge, pct] = s.split(" "); return () => stack.at(el, parseFloat(pct) / 100, edge); };
  return end ? { trigger: el, start: pos(start), end: pos(end) } : { trigger: el, start: pos(start) };
}

function scrollToY(y, immediate) {
  // Instant jumps go native first (the CSS smooth scrolling would animate them), then Lenis catches up
  if (immediate) window.scrollTo({ top: y, behavior: "instant" });
  if (lenis) lenis.scrollTo(y, immediate ? { immediate: true, force: true } : { duration: 1.6, force: true });
  else if (!immediate) window.scrollTo({ top: y, behavior: "smooth" });
}

function sceneStack(desk) {
  const H = () => innerHeight;
  const W = () => innerWidth;
  // Each scene's own scroll in screens (lead = scroll before tall content starts moving; the kids lead is the girl's fall).
  // Content taller than the screen adds its overflow on top.
  // rev = the reveal into the next scene (default half a screen; the intro's fall through the sky gets a whole one)
  const OWN = { intro: { len: 1.5, rev: 1 }, home: { len: desk ? 1.4 : .4 }, work: { len: desk ? 2.7 : .3 }, music: { len: desk ? 2.3 : .3 }, kids: { lead: 1, len: .5 }, process: { lead: .1, len: 1.9 }, stats: { lead: 1.25, len: .35 } };
  const fit = desk ? ["intro", "home", "work", "music"] : ["intro"];
  const header = $(".site-header");
  const track = document.createElement("div");
  track.className = "scene-track";
  track.setAttribute("aria-hidden", "true");
  const S = SCENES.map(([id, sel], i) => {
    const sec = $(sel);
    const el = document.createElement("div");
    el.className = `scene scene--${id}${fit.includes(id) ? " scene--fit" : ""}`;
    el.style.zIndex = 20 - i;
    const fx = document.createElement("div");
    fx.className = "scene-fx";
    sec.replaceWith(el);
    el.append(fx);
    fx.append(sec);
    const seg = document.createElement("div");
    track.append(seg);
    // bg: a background that stays put while the scene's content scrolls over it (the jungle)
    return { id, i, sec, el, fx, seg, bg: $(".kids-bg", sec), top: 0, own: 0, lead: 0, ov: 0, y: 0, on: true };
  });
  document.body.append(track);
  root.classList.add("is-stack");

  let R = 0;
  function layout() {
    R = Math.round(H() * .5);
    let y = track.offsetTop;
    S.forEach((s, i) => {
      const o = OWN[s.id] ?? { lead: .1, len: .35 };
      s.ov = s.el.classList.contains("scene--fit") ? 0 : Math.max(0, s.sec.offsetHeight - H());
      s.lead = (o.lead ?? 0) * H();
      s.own = Math.round(s.lead + s.ov + o.len * H());
      s.rev = Math.round((o.rev ?? .5) * H());
      s.top = y;
      y += s.own + s.rev;
      s.seg.style.height = `${i < S.length - 1 ? s.own + s.rev : s.own + H()}px`;
    });
  }
  layout();
  ScrollTrigger.addEventListener("refreshInit", layout);

  // Show only the current scene (and the next one while it is being revealed); scroll tall content
  let cur = -1;
  function update() {
    const y = scrollY;
    let c = 0;
    while (c < S.length - 1 && y >= S[c + 1].top) c++;
    const opening = c < S.length - 1 && y > S[c].top + S[c].own;
    S.forEach((s, i) => {
      const on = i === c || (opening && i === c + 1);
      // Its leaves drift up a little as the scene is scrolled
      if (on && s.leaves) gsap.set(s.leaves.wrap, { y: -18 * clamp01((y - s.top) / Math.max(1, s.own)) });
      if (on !== s.on) { s.on = on; s.el.classList.toggle("is-off", !on); }
      const near = i === c + 1;
      if (near !== s.near) { s.near = near; s.el.classList.toggle("is-near", near); }
      // Native lazy loading can't tell when a fixed layer is about to show: load its images once it's next up
      if ((near || on) && !s.loaded) { s.loaded = true; $$('img[loading="lazy"]', s.el).forEach((im) => (im.loading = "eager")); }
      if (!s.ov) return;
      const iy = -Math.round(Math.min(s.ov, Math.max(0, y - s.top - s.lead)));
      if (iy !== s.y) { s.y = iy; gsap.set(s.sec, { y: iy }); if (s.bg) gsap.set(s.bg, { y: -iy }); }
    });
    if (c !== cur) { cur = c; root.dataset.scene = S[c].id; }
  }
  ScrollTrigger.create({ start: 0, end: "max", onUpdate: update, onRefresh: update });

  const ix = (id) => S.findIndex((s) => s.id === id);
  const num = (v) => (typeof v === "function" ? v() : v);
  const elOf = (el) => (typeof el === "string" ? $(el) : el);
  const sceneOf = (el) => { el = elOf(el); const sc = el?.closest(".scene") ?? (el && $(".scene", el)); return S.find((s) => s.el === sc); };
  // How far into its section an element sits (current section offset cancels out)
  const offIn = (el, s, edge = "top") => {
    const r = el.getBoundingClientRect();
    return (edge === "bottom" ? r.bottom : edge === "center" ? (r.top + r.bottom) / 2 : r.top) - s.sec.getBoundingClientRect().top;
  };
  // Scroll position that shows an element (a whole scene: its start)
  const posOf = (el) => {
    const s = sceneOf(el);
    if (!s) return null;
    if (!s.ov || el === s.sec || el.contains(s.el)) return s.top;
    return s.top + s.lead + Math.min(s.ov, Math.max(0, offIn(el, s) - H() * .25));
  };

  stack = {
    R: () => R,
    top: (id) => S[ix(id)].top,
    own: (id) => S[ix(id)].own,
    // A range inside a scene's own scroll (px, numbers or functions); default = all of it
    st(id, from = 0, len) {
      const s = S[ix(id)];
      return { start: () => s.top + num(from), end: () => s.top + num(from) + (len == null ? s.own - num(from) : num(len)) };
    },
    // The reveal that leaves this scene (half a screen)
    rev(id) { const s = S[ix(id)]; return { start: () => s.top + s.own, end: () => s.top + s.own + s.rev }; },
    // While its tall content scrolls up
    inner(id) { const s = S[ix(id)]; return { start: () => s.top + s.lead, end: () => s.top + s.lead + Math.max(1, s.ov) }; },
    contentTravel: (id) => S[ix(id)].ov,
    // While the scene is on screen at all, reveals included
    span(id) { const s = S[ix(id)]; return { start: () => Math.max(0, s.top - (s.i ? S[s.i - 1].rev : 0)), end: () => s.top + s.own + s.rev }; },
    // When an element's edge reaches frac of the screen; content already on screen fires as its scene is revealed
    at(el, frac = .85, edge = "top") {
      el = elOf(el);
      const s = sceneOf(el);
      if (!s) return 0;
      const arrive = s.i ? s.top - S[s.i - 1].rev * .45 : 0;
      const t = s.ov ? offIn(el, s, edge) - frac * H() : 0;
      return t <= 0 ? arrive : s.top + s.lead + Math.min(t, s.ov);
    },
  };

  // In-page links and the skip link jump to their scene (the skip link instantly)
  const onClick = (e) => {
    const a = e.target.closest?.('a[href^="#"]');
    const href = a?.getAttribute("href");
    if (!a || href.length < 2 || a.hasAttribute("data-contact")) return;
    const target = document.getElementById(href.slice(1));
    const y = target && posOf(target);
    if (y == null) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    const skip = a.classList.contains("skip-link");
    scrollToY(y, skip);
    if (skip) { target.tabIndex = -1; target.focus({ preventScroll: true }); }
  };
  document.addEventListener("click", onClick, true);
  // Keyboard focus landing in a hidden scene (or off screen in a tall one) brings it into view
  const onFocus = (e) => {
    const s = S.find((x) => x.el === e.target.closest?.(".scene"));
    if (!s) return;
    s.el.scrollTop = s.fx.scrollTop = 0;
    const r = e.target.getBoundingClientRect();
    if (s.i === cur && scrollY <= s.top + s.own + 1 && r.top >= 0 && r.bottom <= H()) return;
    scrollToY(posOf(e.target), true);
  };
  addEventListener("focusin", onFocus);
  // Arriving with #section in the address: jump there, and stay there while late refreshes re-measure the page,
  // until the visitor scrolls themselves
  let hashEl = location.hash.length > 1 && document.getElementById(location.hash.slice(1));
  if (hashEl && !sceneOf(hashEl)) hashEl = null;
  const toHash = () => { if (hashEl && Math.abs(scrollY - posOf(hashEl)) > 2) scrollToY(posOf(hashEl), true); };
  const stopHash = () => {
    hashEl = null;
    ScrollTrigger.removeEventListener("refresh", toHash);
    ["wheel", "touchstart", "keydown"].forEach((t) => removeEventListener(t, stopHash));
  };
  if (hashEl) {
    ScrollTrigger.addEventListener("refresh", toHash);
    ["wheel", "touchstart", "keydown"].forEach((t) => addEventListener(t, stopHash, { passive: true }));
    setTimeout(stopHash, 4000);
  }

  // ---- Reveals: each is drawn from its scroll progress, so scrubbing and reversing are exact ----
  const made = [];
  function layer(s, cls, behind, parent = s.el) {
    const d = document.createElement("div");
    d.className = `sx ${cls}`;
    d.setAttribute("aria-hidden", "true");
    behind ? parent.prepend(d) : parent.append(d);
    made.push(d);
    return d;
  }
  const mask = (el, m) => { el.style.webkitMaskImage = el.style.maskImage = m; };

  // ---- Leaf framing: vine-and-leaf clusters in some corners of each scene (the Kids jungle has its own frame) ----
  // Each scene lists its corners in order of preference and the content they must keep clear of. On every refresh the
  // corners (and, if needed, smaller sizes) are tested against that content's layout over the scene's whole content
  // scroll, so the leaves never cover text, buttons or cards; up to two per scene, one (smaller) on phones. Size, flip
  // and tilt vary per scene. They sway gently (CSS), drift a little with the scene's scroll, and sweep out of the
  // outgoing scene and into the incoming one during each reveal, so the edge between scenes is always leafy.
  const LEAF_FILE = { tl: "top-left", tr: "top-right", bl: "bottom-left", br: "bottom-right" };
  const MIRROR = { tl: "tr", tr: "tl", bl: "br", br: "bl" };
  const LEAVES = {
    intro: { corners: ["tr", "bl", "tl", "br"], avoid: ".intro-letters, .intro-skip, .intro-hint, .girl--intro" },
    home: { corners: ["br", "tl", "tr", "bl"], avoid: ".hero-copy > *, .hero-center, .hero-ground, .hero-count, .hero-note, .scroll-ind > *, .girl--home" },
    work: { corners: ["tr", "bl", "br", "tl"], avoid: ".work-head a, .work-head button, .work-head .section-title, .ring-caption, .ring-hint, .ring-floor i" },
    music: { corners: ["bl", "br"], avoid: ".music-head > *, .fly-stage" },
    about: { corners: ["tl", "br", "bl", "tr"], avoid: ".about-section h2, .about-section p, .about-section .pill, .about-stats, .ab-art, .about-section .section-title" },
    process: { corners: ["tr", "bl", "br", "tl"], avoid: ".process-section .section-title, .process-title, .timeline" },
    stats: { corners: ["tl", "tr", "br", "bl"], avoid: ".stats-section .section-head, .stats, .stats-note, .st-walkway" },
    contact: { corners: ["tl", "br", "tr", "bl"], avoid: ".foot > *, .foot-links > *, .girl--contact" },
  };
  const DIR = { tl: [-1, -1], tr: [1, -1], bl: [-1, 1], br: [1, 1] };
  S.forEach((s) => {
    const cfg = LEAVES[s.id];
    if (!cfg) return;
    const wrap = document.createElement("div");
    wrap.className = "sl";
    wrap.setAttribute("aria-hidden", "true");
    s.el.append(wrap);
    made.push(wrap);
    wrap.innerHTML = cfg.corners.map((c, k) => {
      const flip = (s.i + k) % 2 === 1;   // every other one uses the opposite corner's picture, mirrored
      return `<i class="sl-leaf sl-${c}" data-c="${c}" style="--tilt:${((s.i * 7 + k * 11) % 13) - 6}deg"><img src="assets/leaves/leaves-${LEAF_FILE[flip ? MIRROR[c] : c]}.webp" alt=""${flip ? ' class="is-flip"' : ""} loading="lazy" decoding="async"></i>`;
    }).join("");
    s.leaves = { wrap, all: $$(".sl-leaf", wrap), cfg, on: [] };
    s.loaded = false;   // its new pictures load with the scene's others (see update)
  });
  // The leafy part of a cluster (a box toward its corner) for a given width, in screen pixels
  const leafBox = (c, lw) => {
    const w = lw * .66, h = lw * .78 * .66;   // the dense part, near the corner (the diagonal side is open)
    const x = c[1] === "l" ? 0 : W() - w, y = c[0] === "t" ? 0 : H() - h;
    return { left: x, top: y, right: x + w, bottom: y + h };
  };
  function placeLeaves() {
    const small = W() < 600, max = small ? 1 : 2;
    S.forEach((s) => {
      const L = s.leaves;
      if (!L) return;
      // Where the content sits at rest, stretched over its whole scroll (it moves up by the scene's overflow)
      const boxes = $$(L.cfg.avoid, s.el).map((e) => e.getBoundingClientRect()).filter((r) => r.width && r.height)
        .map((r) => ({ left: r.left, right: r.right, top: r.top - s.y - s.ov, bottom: r.bottom - s.y }));
      const hits = (b) => boxes.some((r) => r.left < b.right && r.right > b.left && r.top < b.bottom && r.bottom > b.top);
      const size = (1 + ((s.i * 37) % 30) / 100) * (small ? 40 : 22) * W() / 100;   // 22–28vw (40–52vw on phones)
      L.on = [];
      L.all.forEach((el) => {
        const c = el.dataset.c;
        const lw = L.on.length < max ? [1, .78, .6].map((f) => Math.min(size * f, small ? 260 : 400)).find((v) => !hits(leafBox(c, v))) : null;
        el.style.display = lw ? "" : "none";
        if (lw) { el.style.setProperty("--lw", `${lw}px`); L.on.push(el); }
      });
    });
  }
  ScrollTrigger.addEventListener("refresh", placeLeaves);
  // Sweep a scene's leaves out toward their corners (k = 0: in place, 1: gone)
  const sweep = (s, k) => s.leaves?.on.forEach((el) => {
    const [dx, dy] = DIR[el.dataset.c];
    gsap.set(el, { xPercent: dx * 70 * k, yPercent: dy * 70 * k, opacity: 1 - k * .6 });
  });

  // A reveal's overlays exist only while it is in progress: hidden (visibility) before it starts and after it ends
  function reveal(i, draw, overlays = []) {
    const a = S[i], b = S[i + 1];
    const go = (self) => {
      const p = self.progress;
      overlays.forEach((o) => (o.style.visibility = p > 0 && p < 1 ? "visible" : "hidden"));
      draw(p, a, b);
      sweep(a, ramp(p, 0, .7, "power2.in"));
      sweep(b, 1 - ramp(p, .3, 1, "power2.out"));
    };
    ScrollTrigger.create({ start: () => a.top + a.own, end: () => b.top, onUpdate: go, onRefresh: go });
  }

  // intro → home (a whole screen). HELLO fades away softly (it never moves); a dusk sky fills the screen, with
  // clouds rising past (so it feels like falling) and a few slow golden sparkles; she tumbles down through the
  // clouds (introStory), some passing behind her and some in front; then the clouds at the bottom part, the home
  // scene rises through the gap to fill the screen, and she drops out of view into it. Fewer clouds on phones.
  const few = W() < 600 || !desk;
  const pin = $(".intro-pin");
  const sky = layer(S[0], "sky", true, pin);           // behind her
  const skyFront = layer(S[0], "sky-front", false, pin); // in front of her
  // [left (vw), start (screens below the top), width (vw), speed]
  const BACK = [[6, .9, 30, 1.15], [62, 1.35, 36, 1], [30, 1.95, 26, 1.3], [76, 2.5, 28, 1.1], [-4, 3, 32, 1]];
  const FRONT = [[54, 1.5, 44, 1.5], [-12, 2.3, 48, 1.6], [68, 3.1, 40, 1.45]];
  const cloud = ([x, , w], cls = "") => `<i class="cl ${cls}" style="left:${x}vw;--w:${few ? Math.min(w * 1.9, 90) : w}vw"></i>`;
  const backC = BACK.slice(0, few ? 3 : 5), frontC = FRONT.slice(0, few ? 2 : 3);
  const sparks = Array.from({ length: few ? 8 : 18 }, (_, i) => [(i * 37 + 11) % 97, (i * 53 % 100) / 100 * 1.6, .5 + (i * 29 % 50) / 100]);
  sky.innerHTML = backC.map((c) => cloud(c)).join("") + sparks.map(([x], i) =>
    `<i class="spk" style="left:${x}vw;--d:${(i * .37 % 2.4).toFixed(2)}s"></i>`).join("");
  skyFront.innerHTML = frontC.map((c) => cloud(c, "cl--front")).join("") + `<i class="cl cl-bank cl-bank--l"></i><i class="cl cl-bank cl-bank--r"></i>`;
  const backEls = $$(".cl", sky), sparkEls = $$(".spk", sky);
  const frontEls = $$(".cl--front", skyFront), banks = $$(".cl-bank", skyFront);
  reveal(0, (p, a, b) => {
    const h = ramp(p, 0, .3);
    // (a soft blur on larger screens; phones fade and shrink, which costs no repaint)
    gsap.set(".intro-letters", few ? { opacity: 1 - h, scale: 1 - .08 * h } : { opacity: 1 - h, filter: h ? `blur(${(h * 8).toFixed(1)}px)` : "none" });
    gsap.set(".intro-skip", { autoAlpha: 1 - h });
    sky.style.opacity = ramp(p, .06, .32);
    skyFront.style.opacity = ramp(p, .1, .35);
    // Clouds and sparkles rise past (front clouds faster, for depth)
    const fall = ramp(p, 0, .85);
    backEls.forEach((el, i) => gsap.set(el, { y: (backC[i][1] - fall * 3.6 * backC[i][3]) * H() }));
    frontEls.forEach((el, i) => gsap.set(el, { y: (frontC[i][1] - fall * 3.6 * frontC[i][3]) * H() }));
    sparkEls.forEach((el, i) => gsap.set(el, { y: (sparks[i][1] - fall * 1.2 * sparks[i][2]) * H() }));
    // The bottom clouds roll in, then part; the home scene rises through the gap (the HELLO scene is wiped from the bottom)
    const rise = ramp(p, .42, .62, "power2.out"), part = ramp(p, .62, .88, "power2.inOut");
    gsap.set(banks, { y: (1 - rise) * H() * .6, x: (j) => (j ? 1 : -1) * part * W() * .62 });
    const o = ramp(p, .66, 1, "power2.inOut"), soft = H() * .22, edge = o * (H() + soft);
    mask(a.el, o ? `linear-gradient(to top, transparent ${(edge - soft).toFixed(1)}px, #000 ${edge.toFixed(1)}px)` : "");
    const g = ramp(p, .62, 1, "power2.out");
    gsap.set(b.fx, { y: (1 - g) * H() * .3, scale: .94 + .06 * g, opacity: p < .62 ? 0 : 1 });
    gsap.set(header, { opacity: ramp(p, .85, 1) });
  }, [sky, skyFront]);

  // Cloud transition (home → work, about → process): soft off-white clouds drift in from the bottom and sides and grow
  // until the screen is covered (a --paper wash fades the outgoing scene away behind them); while covered the outgoing
  // scene switches off, then the clouds drift apart and up onto the incoming scene, which settles from 1.04. Three
  // depth layers; all of them pass in front of her.
  // [cover centre x, y (% of the screen), width (vw), comes from: b(ottom) / l(eft) / r(ight), depth speed]
  const CLOUDS = [
    [50, 92, 70, "b", .8], [18, 70, 56, "l", .8], [84, 66, 56, "r", .8], [50, 40, 64, "b", .8],           // back
    [8, 30, 44, "l", 1.05], [92, 28, 44, "r", 1.05], [34, 82, 40, "b", 1.05], [70, 50, 42, "b", 1.05],   // middle
    [26, 52, 22, "l", 1.35], [76, 84, 20, "r", 1.35], [56, 18, 22, "r", 1.35], [14, 92, 18, "l", 1.35],  // small, in front
  ].filter((c, i) => desk && W() >= 600 || i % 2 === 0 || i < 2);
  function cloudReveal(i) {
    const clouds = layer(S[i + 1], "sx-clouds");
    clouds.innerHTML = `<i class="cw-wash"></i>${CLOUDS.map(([x, y, w]) =>
      `<i class="cw" style="left:${x}%;top:${y}%;--w:${W() < 600 ? Math.min(w * 1.8, 120) : w}vw"></i>`).join("")}`;
    const wash = $(".cw-wash", clouds), cws = $$(".cw", clouds);
    reveal(i, (p, a, b) => {
      const enter = ramp(p, 0, .48, "power2.out"), part = ramp(p, .52, 1, "power2.in");
      cws.forEach((el, k) => {
        const [x, , , from, d] = CLOUDS[k];
        const ix = from === "l" ? -W() * .7 : from === "r" ? W() * .7 : 0, iy = from === "b" ? H() * .9 : H() * .2;
        gsap.set(el, {
          x: ix * (1 - enter) * d + Math.sign(x - 50) * W() * .55 * part * d,
          y: iy * (1 - enter) * d - H() * part * d,
          scale: .5 + 1.1 * enter + .5 * part,
          opacity: 1 - ramp(p, .8, 1),
        });
      });
      wash.style.opacity = p < .5 ? ramp(p, .2, .46) : 1 - ramp(p, .54, .8);
      a.fx.style.opacity = p >= .5 ? 0 : "";
      gsap.set(b.fx, { scale: 1.04 - .04 * ramp(p, .5, 1, "power2.out") });
    }, [clouds]);
  }
  cloudReveal(1);

  // work → music: the scene sinks into darkness, then a spotlight opens onto the music world
  const dark = layer(S[2], "sx-dark");
  const glow = layer(S[3], "sx-glow");
  reveal(2, (p, a, b) => {
    dark.style.opacity = .94 * ramp(p, 0, .4);
    const r = ramp(p, .35, 1, "power2.in");
    const soft = Math.min(W(), H()) * .18, max = Math.hypot(W(), H()) * .55 + soft;
    const rad = -soft + r * (max + soft);
    mask(a.el, r ? `radial-gradient(circle at 50% 46%, transparent ${rad.toFixed(1)}px, #000 ${(rad + soft).toFixed(1)}px)` : "");
    gsap.set(b.fx, { scale: 1.12 - .12 * r });
    glow.style.opacity = Math.sin(r * Math.PI) * .9;
  }, [dark, glow]);

  // music → kids: the jungle's leaf-frame clusters burst in from the four corners, grow over a deep-green backing
  // until they cover the screen, then part back out and settle into the frame (a short camera shake and two drum
  // beats as the jungle lands). The jungle layer sits above the music here; its scene stays hidden until covered.
  S[4].el.style.zIndex = Number(S[3].el.style.zIndex) + 1;
  const vines = layer(S[4], "sx-vines");
  vines.innerHTML = `<i class="sx-cover"></i>${$$(".kids-frame img").map((im) => im.outerHTML).join("")}`;
  const cover = $(".sx-cover", vines);
  const corners = $$(".lf-corner", vines);
  reveal(3, (p, a, b) => {
    const enter = ramp(p, 0, .3, "power2.out"), grow = ramp(p, .16, .5, "power2.in"), part = ramp(p, .5, 1, "power2.inOut");
    const s = 1 + 2.4 * (p < .5 ? grow : 1 - part);
    corners.forEach((im, i) => gsap.set(im, {
      xPercent: (1 - enter) * (i % 2 ? 100 : -100), yPercent: (1 - enter) * (i < 2 ? -100 : 100),
      rotation: (1 - enter) * (i % 3 ? 20 : -20), scale: s,
    }));
    cover.style.opacity = p < .5 ? ramp(p, .22, .5) : 1 - ramp(p, .5, .82);
    b.fx.style.opacity = p < .5 ? 0 : "";
    const k = ramp(p, .5, .9);
    const amp = desk && k > 0 ? (1 - k) * Math.min(W(), H()) * .018 : 0;
    const beat = (at) => Math.max(0, 1 - Math.abs(p - at) / .05);
    gsap.set(b.fx, { x: amp * Math.sin(p * 190), y: amp * Math.cos(p * 150), scale: 1.05 - .05 * ramp(p, .5, 1, "power2.out") + .035 * (beat(.62) + beat(.76)) });
  }, [vines]);

  // kids → about: an opening grows out of the deep jungle green
  reveal(4, (p, a, b) => {
    const r = ramp(p, 0, 1, "power2.in");
    mask(a.el, r ? `radial-gradient(${Math.max(1, r * W() * 1.8).toFixed(0)}px ${Math.max(1, r * H() * 2.1).toFixed(0)}px at 50% 88%, transparent 55%, #000 100%)` : "");
    gsap.set(b.fx, { scale: 1.06 - .06 * r });
  });

  // about → process: the same soft clouds
  cloudReveal(5);

  // Calmer scenes: soft layered peels (slide aside, lift up)
  const peel = (i, kind) => {
    const dim = layer(S[i + 1], "sx-dim");
    reveal(i, (p, a, b) => {
      const g = ramp(p, 0, 1, "power2.inOut");
      const side = kind === "side";
      gsap.set(a.el, g ? {
        clipPath: side ? `inset(0 ${100 * g}% 0 0 round 0 ${40 * g}px ${40 * g}px 0)` : `inset(0 0 ${100 * g}% 0 round 0 0 ${48 * g}px ${48 * g}px)`,
        x: side ? -W() * .05 * g : 0, y: side ? 0 : -H() * .06 * g,
      } : { clipPath: "none", x: 0, y: 0 });
      gsap.set(b.fx, { scale: 1.04 - .04 * g });
      dim.style.opacity = .3 * (1 - g);
    }, [dim]);
  };
  // process → stats: one long strip. The camera pans sideways: the process scene slides out to the left while the stats
  // scene slides in from the right, edge to edge on the same paper; she keeps walking across the seam (processGirl,
  // statsGirl). Nothing is clipped or faded, and no other scene shows.
  reveal(6, (p, a, b) => {
    const k = ramp(p, 0, 1, "sine.inOut");
    gsap.set(a.el, { x: -W() * k });
    gsap.set(b.el, { x: W() * (1 - k) });
  });
  peel(7, "lift");

  return () => {
    document.removeEventListener("click", onClick, true);
    removeEventListener("focusin", onFocus);
    stopHash();
    ScrollTrigger.removeEventListener("refreshInit", layout);
    ScrollTrigger.removeEventListener("refresh", placeLeaves);
    made.forEach((d) => d.remove());
    S.forEach((s) => { gsap.set([s.sec, s.bg].filter(Boolean), { clearProps: "transform" }); s.el.replaceWith(s.sec); });
    track.remove();
    gsap.set(header, { clearProps: "opacity" });
    gsap.set([".intro-letters", ".intro-skip"], { clearProps: "opacity,filter,visibility,transform" });
    root.classList.remove("is-stack");
    delete root.dataset.scene;
    stack = null;
  };
}

// ---- 00 Intro: the girl pulls the stray "L" back into HELLO ----
// Pinned for 1.5 screens. Scroll progress moves the letter; scroll direction and speed pick her reaction:
// forward = pull (slower = deeper lean), back = surprised (faster = bigger jolt) then reach, still = idle, then point.
// Fixed → the L bounces in, she cheers, runs and slides away, and a short time warp jumps to the hero.
// mode: "motion" (pinned) or "static" (reduced motion: word fixed, girl standing beside it)
function introStory(mode) {
  const section = $(".intro");
  const pin = $(".intro-pin");
  const stage = $(".intro-stage");
  const word = $(".intro-word");
  const lettersEl = $(".intro-letters", word);
  let split = null;
  let letters = [];
  let stray = null;
  let tail = [];
  const hint = $(".intro-hint");
  const skip = $(".intro-skip");
  const header = $(".site-header");
  const girl = makeGirl(word, "girl--intro", WORLD.intro);
  const G = girl.el;
  const FIX = .8; // the L is home at 80% of the pin; the rest is room for her exit
  let M = {};
  let dead = false;

  // The header stays on the hero, as before the intro existed
  // (in the scene stack the header is fixed instead)
  const placeHeader = () => { if (!stack) header.style.top = `${$(".hero").getBoundingClientRect().top + scrollY}px`; };
  ScrollTrigger.addEventListener("refresh", placeHeader);
  placeHeader();

  // Wait for the display font (at most 1.5s), then split HELLO into letters and measure
  const fontsReady = Promise.race([document.fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, 1500))]);
  gsap.set(lettersEl, { opacity: 0 });
  gsap.set(G, { autoAlpha: 0 });
  function splitWord() {
    split = SplitText.create(lettersEl, { type: "chars", charsClass: "il", tag: "span", aria: "none" });
    lettersEl.insertAdjacentHTML("beforeend", '<i class="intro-base"></i>'); // marks the baseline
    letters = split.chars;
    stray = letters[3];
    tail = letters.slice(3); // the O rides along behind the stray L
    gsap.set(letters, { opacity: mode === "static" ? 1 : 0, transformOrigin: "50% 100%" });
    gsap.set(lettersEl, { opacity: 1 });
  }

  // Sizes come from the word: C = cap height; the font is as big as fits with the gap open (widths scale with it)
  function size(fs, extra) {
    word.style.fontSize = `${fs}px`;
    return Math.min(210, (innerWidth - 32) / ((word.offsetWidth + extra(fs)) / fs), innerHeight * .36);
  }

  if (mode === "static") {
    const idleW = (fs) => fs * .7 * 1.3 * GIRL.idle[0] / GIRL_H;
    const layout = () => {
      word.style.fontSize = "";
      const fs0 = parseFloat(getComputedStyle(word).fontSize);
      const fs = size(fs0, (f) => idleW(f) + f * .3);
      word.style.fontSize = `${fs}px`;
      const C = fs * .7;
      G.style.setProperty("--gh", `${C * 1.3}px`);
      gsap.set(G, { left: word.offsetWidth + C * .25 + idleW(fs) * GIRL.idle[2], top: $(".intro-base", word).offsetTop, autoAlpha: 1 });
      gsap.set(word, { x: -(idleW(fs) + C * .25) / 2 });
      placeHeader();
    };
    section.classList.add("intro--static");
    girl.set("idle", 0);
    girl.breath.pause();
    fontsReady.then(() => {
      if (dead) return;
      splitWord();
      layout();
      addEventListener("resize", layout);
    });
    return () => {
      dead = true;
      removeEventListener("resize", layout);
      ScrollTrigger.removeEventListener("refresh", placeHeader);
      girl.destroy();
      split?.revert();
      $(".intro-base", word)?.remove();
      gsap.set([word, lettersEl], { clearProps: "all" });
      section.classList.remove("intro--static");
      header.style.top = "";
    };
  }

  heroGate.hold();
  hint.hidden = skip.hidden = false;
  preloadGirl(WORLD.intro);

  // The rope: an SVG path from where the rope leaves pull.webp (right edge, 40% down) to the stray L
  word.insertAdjacentHTML("beforeend", `<svg class="intro-rope" aria-hidden="true">
    <path class="r-base" fill="none" stroke="#c98d58"/><path class="r-twist" fill="none" stroke="#9a5d2c"/><path class="r-hi" fill="none" stroke="#f0cd9c" stroke-linecap="round"/></svg>`);
  const ropeSvg = $(".intro-rope", word);
  const ropePaths = $$("path", ropeSvg);
  const tension = { t: 0 };
  const tTo = gsap.quickTo(tension, "t", { duration: .25, ease: "power2.out" });
  let ropeOn = false;

  function measure() {
    word.style.fontSize = "";
    gsap.set([word, ...tail], { x: 0 });
    const narrow = innerWidth < 600;
    const dims = (fs) => {
      const C = fs * .7;
      const gh = C * (narrow ? 2 : 1.3);
      const Wp = gh * GIRL.pull[0] / GIRL_H;
      const over = C * (narrow ? .45 : .1); // how far she stands in front of the first L
      return { C, gh, Wp, over, D: Wp - over + C * (narrow ? .45 : .8) }; // D = how far the L is out
    };
    // Phones: the O may start partly off-screen (only the stray L has to be in view), so the word can be bigger
    const fs0 = parseFloat(getComputedStyle(word).fontSize);
    const hang = narrow ? tail[1].offsetWidth / fs0 * .6 : 0;
    const fs = size(fs0, (f) => dims(f).D - hang * f);
    word.style.fontSize = `${fs}px`;
    M = { ...dims(fs), hang: hang * fs, home: stray.offsetLeft, base: $(".intro-base", word).offsetTop };
    M.feet = M.home - M.over + M.Wp * GIRL.pull[2];
    M.hand = M.home - M.over + M.Wp;
    G.style.setProperty("--gh", `${M.gh}px`);
    gsap.set(G, { left: M.feet, top: M.base });
  }

  let q = 0;
  let done = false;
  let st = null;
  let loaded = false;
  // q: 0 = letter out, 1 = home. v: scroll velocity; scrolling back, the letter springs away with momentum
  function place(v = 0) {
    if (!M.D) return;
    const off = M.D * (1 - q);
    gsap.set(word, { x: -(off - M.hang * (1 - q)) / 2 }); // keep the picture centred
    if (done) return;
    if (v < 0) {
      const velocity = -v * M.D / (FIX * (st.end - st.start)) * 1.6;
      gsap.to(tail, { inertia: { x: { velocity, end: off }, duration: { min: .25, max: .7 } }, overwrite: "auto" });
    } else gsap.set(tail, { x: off, overwrite: "auto" });
    // She steps back as the letter comes close, keeping a little rope between them
    gsap.set(G, { x: Math.min(0, M.home + off - M.C * .2 - M.hand) });
  }

  function drawRope() {
    const g = (el, p) => gsap.getProperty(el, p);
    const Hp = M.gh * GIRL.pull[1] / GIRL_H;
    const sx = g(girl.act, "scaleX") * g(girl.breathEl, "scaleX");
    const sy = g(girl.act, "scaleY") * g(girl.breathEl, "scaleY");
    const r = g(girl.act, "rotation") * Math.PI / 180;
    const cos = Math.cos(r), sin = Math.sin(r);
    // Hand point relative to her feet, through the act layer's scale → rotation → move
    const px = ((1 - GIRL.pull[2]) * M.Wp - 1) * sx;
    const py = -Hp * (1 - .404) * sy;
    const hx = M.feet + g(G, "x") + g(girl.act, "x") + px * cos - py * sin;
    const hy = M.base + g(G, "y") + g(girl.act, "y") + px * sin + py * cos;
    // Tie on where the rope's direction in the image (rising ~9°, plus her lean) meets the letter, so a
    // tight rope is one straight line; slack makes it sag
    const dx = cos + .16 * sin, dy = sin - .16 * cos;
    const ex = M.home + g(stray, "x") + M.C * .1;
    const ey = gsap.utils.clamp(M.base - M.C * .85, M.base - M.C * .3, hy + (ex - hx) * dy / dx);
    const len = Math.hypot(ex - hx, ey - hy);
    const cx = (hx + ex) / 2;
    const cy = (hy + ey) / 2 + len * (.01 + .22 * (1 - tension.t));
    const d = `M${hx.toFixed(1)} ${hy.toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
    const w = Hp * .04;
    ropePaths.forEach((p) => p.setAttribute("d", d));
    ropePaths[0].setAttribute("stroke-width", w);
    ropePaths[1].setAttribute("stroke-width", w * .55);
    ropePaths[1].setAttribute("stroke-dasharray", `${(w * .45).toFixed(1)} ${(w * .75).toFixed(1)}`);
    ropePaths[2].setAttribute("stroke-width", w * .16);
    ropePaths[2].setAttribute("transform", `translate(0 ${(-w * .2).toFixed(1)})`);
  }
  function showRope(on) {
    if (on === ropeOn) return;
    ropeOn = on;
    gsap.ticker[on ? "add" : "remove"](drawRope);
    if (on) drawRope();
    gsap.to(ropeSvg, { opacity: on ? 1 : 0, duration: .08, overwrite: true });
  }
  const pose = (name, fade) => { girl.set(name, fade); showRope(name === "pull"); };
  const rot = gsap.quickTo(girl.act, "rotation", { duration: .35, ease: "power3.out" });

  // Idle: rope goes slack, she stands and breathes; after 2s she points at the letter
  let idleCall = null;
  let reachCall = null;
  function toIdle() {
    pose("idle", .15);
    rot(0);
    idleCall = gsap.delayedCall(2, () => {
      pose("point", .12);
      rot(2);
      gsap.fromTo(girl.act, { scaleX: 1.05, scaleY: .94 }, { scaleX: 1, scaleY: 1, duration: .6, ease: "elastic.out(1, .5)" });
    });
  }
  function settle() {
    idleCall?.kill();
    idleCall = gsap.delayedCall(.22, () => { tTo(0); idleCall = gsap.delayedCall(.3, toIdle); });
  }

  function pull(speed) {
    reachCall?.kill();
    if (girl.pose !== "pull") {
      pose("pull", .08);
      gsap.fromTo(girl.act, { scaleX: 1.06, scaleY: .93 }, { scaleX: 1, scaleY: 1, duration: .35, ease: "back.out(3)" }); // dig in
    }
    tTo(1);
    rot(-(5 + 9 * (1 - speed)));
  }

  function back(speed) {
    if (girl.pose === "reach") return rot(8 + 6 * speed);
    if (girl.pose === "surprised") return;
    // Startled: jolt back and tilt, bigger the faster the letter got away; then she reaches after it
    const s = .3 + .7 * speed;
    pose("surprised", 0);
    gsap.fromTo(girl.act, { scaleX: 1 + .14 * s, scaleY: 1 - .14 * s }, { scaleX: 1, scaleY: 1, duration: .45, ease: "elastic.out(1, .4)" });
    gsap.fromTo(girl.act, { x: 0 }, { x: -M.C * .2 * s, duration: .5, ease: "girlStartle" });
    gsap.fromTo(girl.act, { y: 0 }, { keyframes: { y: [-M.C * .3 * s, 0] }, duration: .4, ease: "power2.out" });
    rot(-(6 + 14 * s));
    reachCall = gsap.delayedCall(.35, () => { pose("reach", .12); rot(9); });
  }

  // Word fixed: L bounces in, she cheers, runs right, slides off the bottom; then the jump to the hero
  let exit = null;
  let jumped = false;
  function finish() {
    done = true;
    q = 1;
    place();
    idleCall?.kill();
    reachCall?.kill();
    showRope(false);
    gsap.to(hint, { autoAlpha: 0, duration: .3 });
    gsap.set(tail, { x: 0 });
    gsap.fromTo(stray, { scaleX: .82, scaleY: 1.14 }, { scaleX: 1, scaleY: 1, duration: .7, ease: "elastic.out(1, .35)" });
    gsap.fromTo(letters, { y: 0 }, { keyframes: { y: [-M.C * .14, 0] }, duration: .45, ease: "power2.out", stagger: .05 });
    if (!loaded) return stack ? null : jump();
    const run = word.offsetWidth - M.feet - gsap.getProperty(G, "x") + M.C * .5;
    // Scene stack: the rest of the scroll moves her (drawExit), then she falls through the sky
    if (stack) { exitX0 = gsap.getProperty(G, "x"); return drawExit(); }
    // In the scene stack the fall through the sky follows on scroll; otherwise the time warp jumps to the hero
    exit = gsap.timeline({ onComplete: stack ? null : jump })
      .add(() => pose("cheer", 0))
      .fromTo(girl.act, { scaleX: 1.15, scaleY: .85, rotation: 0 }, { scaleX: 1, scaleY: 1, duration: .12 })
      .to(girl.act, { y: -M.gh * .22, duration: .22, ease: "power2.out" })
      .to(girl.act, { y: 0, duration: .2, ease: "power2.in" })
      .to(girl.act, { scaleX: 1.12, scaleY: .88, duration: .07 })
      .add(() => pose("run", 0))
      .to(girl.act, { scaleX: 1, scaleY: 1, rotation: 6, duration: .15 })
      .to(G, { x: `+=${run}`, duration: .55, ease: "windUp" }, "<")
      .add(() => pose("slide", .06))
      .to(G, { motionPath: { path: [{ x: M.C * .5, y: M.gh * .12 }, { x: M.C * .45, y: pin.offsetHeight * .45 }, { x: M.C * .25, y: pin.offsetHeight * .6 }], relative: true, curviness: 1.4 }, duration: .6, ease: "power2.in" })
      .to(girl.act, { rotation: 16, duration: .6, ease: "power1.in" }, "<");
  }

  // Scene stack, after the word is fixed (all from scroll): she cheers with a hop, then jumps and starts to fall.
  // As HELLO fades and the dusk sky appears (the reveal, sceneStack), she tumbles down through the clouds, drifting
  // to the middle and swaying side to side while they rise past; then she drops out of view into the gap where the
  // home scene rises. Scrolling back brings her back up.
  let exitX0 = 0, vp = 0, aim = null;   // aim: where she tumbles (measured once per fall; cleared on re-layout)
  function drawExit() {
    if (!done || !loaded || !stack) return;
    const e = ramp(st.progress, FIX, 1);
    const hop = ramp(e, 0, .4), jump = ramp(e, .45, 1);
    // The jump: up and off the ground, turning over into the fall at its top
    let x = exitX0 + M.C * .3 * jump, y = -M.gh * .75 * Math.sin(Math.PI / 2 * jump), rot = 20 * ramp(jump, .5, 1);
    if (vp > 0) {
      // Where she tumbles: a little above the middle of the screen, relative to her feet
      if (!aim) {
        const w = word.getBoundingClientRect(), box = $(".intro-pin").getBoundingClientRect();
        aim = { cx: box.left + box.width / 2 - w.left - M.feet, cy: box.top + box.height * .42 - w.top - M.base + M.gh * .5, h: box.height };
      }
      const { cx, cy } = aim;
      const to = ramp(vp, 0, .35, "sine.inOut"), drop = ramp(vp, .62, .95, "power2.in");
      x += (cx - x) * to + Math.sin(vp * Math.PI * 2.4) * M.gh * .5 * to;
      y += (cy - y) * to + drop * aim.h * 1.1;
      rot += 25 * Math.sin(vp * Math.PI * 3) + 160 * vp;
    }
    gsap.set(G, { x, y, autoAlpha: 1 });
    if (e < .45 && !vp) {
      pose("cheer", 0);
      // squash as she takes off and lands, a stretch at the top of the hop
      const q = Math.cos(Math.PI * 2 * hop) * (e < .4);
      return gsap.set(girl.act, { x: 0, y: -M.gh * .22 * Math.sin(Math.PI * hop), rotation: 0, scaleX: 1 + .1 * q, scaleY: 1 - .1 * q });
    }
    pose(jump < .5 && !vp ? "cheer" : "fall", 0);
    gsap.set(girl.act, { x: 0, y: 0, rotation: rot, scaleX: 1, scaleY: 1 });
  }
  const skyIn = stack && scrubbed(stack.rev("intro"), (p) => { vp = p; drawExit(); });

  // Scrolled back out of a fixed word: she drops back in and reaches for the letter again
  // (in the scene stack she simply reverses the way she went)
  function undo() {
    done = false;
    exit?.kill();
    gsap.killTweensOf(tail);
    if (!loaded) return;
    gsap.set(G, { y: 0, autoAlpha: 1 });
    gsap.set(girl.act, { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 9 });
    if (stack) girl.set("reach", 0);
    pose("reach", 0);
    if (!stack) gsap.fromTo(girl.act, { y: -M.gh * .7 }, { y: 0, duration: .5, ease: "bounce.out" });
  }

  // Time warp (~.65s): streaks rush out, a paper flash hides the jump, a clock hand sweeps a full turn
  const warp = $(".warp");
  let warpTl = null;
  const heroTop = () => (stack ? stack.top("home") : $(".hero").getBoundingClientRect().top + scrollY);
  function jump(force) {
    if (dead || (!force && (jumped || scrollY >= heroTop() - 2))) return heroGate.release();
    jumped = true;
    lenis?.stop();
    warpTl?.kill();
    warpTl = gsap.timeline({ onComplete: () => { gsap.set(warp, { autoAlpha: 0 }); } })
      .set(warp, { autoAlpha: 1 })
      .fromTo(".warp-streaks", { scale: .2, opacity: 0, rotation: 0 }, { scale: 1.3, opacity: 1, rotation: 25, duration: .3, ease: "power2.in" }, 0)
      .fromTo(".warp-flash", { opacity: 0, scale: .5 }, { opacity: 1, scale: 1, duration: .3, ease: "power2.in" }, 0)
      .fromTo(".warp-clock", { opacity: 0, scale: .6 }, { opacity: 1, scale: 1, duration: .2, ease: "back.out(2)" }, 0)
      .fromTo(".warp-clock i", { rotation: 0 }, { rotation: 360, duration: .6, ease: "power2.inOut" }, 0)
      .fromTo(stage, { scale: 1 }, { scale: 1.35, duration: .3, ease: "power2.in" }, 0)
      .add(() => {
        const y = heroTop();
        // Native instant jump (the CSS smooth scrolling would animate it), then Lenis catches up
        window.scrollTo({ top: y, behavior: "instant" });
        lenis?.start();
        lenis?.scrollTo(y, { immediate: true, force: true });
        ScrollTrigger.update();
        gsap.set(stage, { scale: 1 });
        heroGate.release();
      }, .3)
      .to(".warp-flash", { opacity: 0, scale: 1.6, duration: .35, ease: "power2.out" }, .3)
      .to(".warp-streaks", { scale: 2.4, opacity: 0, duration: .35, ease: "power2.out" }, .3)
      .to(".warp-clock", { opacity: 0, scale: 1.3, duration: .25 }, .4);
  }

  const onSkip = () => {
    if (!done) {
      done = true;
      q = 1;
      place();
      [idleCall, reachCall].forEach((c) => c?.kill());
      showRope(false);
      gsap.set(tail, { x: 0 });
      gsap.set(G, { autoAlpha: 0 });
    }
    jump(true);
    const hero = $(".hero");
    hero.tabIndex = -1;
    hero.focus({ preventScroll: true });
  };
  skip.addEventListener("click", onSkip);

  let hintOn = true;
  st = ScrollTrigger.create({
    ...(stack ? stack.st("intro") : { trigger: section, start: "top top", end: "+=150%", pin }),
    onUpdate: (self) => {
      if (!M.D) return; // not measured yet
      q = Math.min(1, self.progress / FIX);
      if (hintOn !== self.progress < .03 && !done) { hintOn = !hintOn; gsap.to(hint, { autoAlpha: hintOn ? 1 : 0, duration: .3 }); }
      if (done) { if (q < .9) undo(); else { place(); return drawExit(); } }
      place(self.getVelocity());
      if (q >= .97) return finish(); // close enough: it snaps the rest of the way
      const v = self.getVelocity();
      if (!loaded || Math.abs(v) < 20) return;
      settle();
      const speed = Math.min(1, Math.abs(v) / 2500);
      v > 0 ? pull(speed) : back(speed);
    },
    onToggle: (self) => girl.breath[self.isActive ? "play" : "pause"](),
  });
  // Arriving at the hero any other way (a link, scrolling past) also starts its entrance
  const heroIn = ScrollTrigger.create({
    ...(stack ? { start: () => stack.rev("intro").start() + (stack.top("home") - stack.rev("intro").start()) * .72 } : { trigger: ".hero", start: "top 55%" }),
    onEnter: () => heroGate.release(),
  });

  const onResize = () => { aim = null; measure(); place(); };
  // "HELLO" drops in letter by letter while the page loads; she lands once her poses are decoded
  let enterTl = null;
  fontsReady.then(() => {
    if (dead) return;
    splitWord();
    measure();
    q = Math.min(1, st.progress / FIX); // the visitor may already have scrolled
    place();
    gsap.fromTo(letters, { y: -M.C * 1.6 }, { y: 0, duration: .9, ease: "letterDrop", stagger: .12 });
    gsap.fromTo(letters, { scaleX: 1, scaleY: 1 }, { scaleX: 1.2, scaleY: .8, duration: .9, ease: "letterDrop-squash", stagger: .12 });
    gsap.to(letters, { opacity: 1, duration: .15, stagger: .12 });
    addEventListener("resize", onResize);
    return Promise.all([preloadGirl(WORLD.intro), new Promise((r) => setTimeout(r, 650))]);
  }).then(() => {
    if (dead) return;
    loaded = true;
    if (done) return;
    gsap.set(G, { autoAlpha: 1 });
    pose("fall", 0);
    enterTl = gsap.timeline()
      .fromTo(girl.act, { y: -innerHeight * .7, rotation: -10 }, { y: 0, rotation: 0, duration: .55, ease: "power2.in" })
      .to(girl.act, { scaleX: 1.2, scaleY: .78, duration: .08, ease: "power2.out" })
      .add(() => { pose("idle", 0); idleCall?.kill(); toIdle(); })
      .to(girl.act, { scaleX: 1, scaleY: 1, duration: .6, ease: "elastic.out(1, .4)" });
  });

  return () => {
    dead = true;
    st.kill();
    heroIn.kill();
    skyIn?.kill();
    [idleCall, reachCall, exit, warpTl, enterTl].forEach((t) => t?.kill());
    gsap.ticker.remove(drawRope);
    lenis?.start();
    removeEventListener("resize", onResize);
    ScrollTrigger.removeEventListener("refresh", placeHeader);
    skip.removeEventListener("click", onSkip);
    girl.destroy();
    ropeSvg.remove();
    split?.revert();
    $(".intro-base", word)?.remove();
    gsap.set([word, lettersEl, stage, hint, warp, ".warp *"], { clearProps: "all" });
    hint.hidden = skip.hidden = true;
    header.style.top = "";
    heroGate.release();
  };
}

// ---- 01 Hero: drone ring ----
// Camera = .hero-camera (height/tilt/dolly), world = .hero-world (orbit around the ring's centre).
// Cards stand evenly on a circle and always face the lens. The name block is a flat layer above the 3D
// scene (so it is always in front); any card that passes behind it fades to 30%.
// mode: "desk" (intro drone shot + auto orbit + scroll dolly), "mobile" (6 cards, auto orbit), "static" (reduced motion)
function heroRing(mode) {
  const camera = $(".hero-camera");
  const world = $(".hero-world");
  const ground = $(".hero-ground");
  const center = $("#hero-center");
  const all = $$(".hero-card");
  const small = mode === "mobile" || innerWidth < 900;
  const cards = all.slice(0, small ? 6 : 10);
  all.slice(cards.length).forEach((c) => (c.hidden = true));
  const P = small ? 900 : 1100; // matches the CSS perspective

  // Wrap each card in a holder (position + billboard), add its title tag and a ground shadow
  const shadows = [];
  const holders = cards.map((card) => {
    const pos = document.createElement("div");
    pos.className = "hc-pos";
    card.replaceWith(pos);
    pos.append(card);
    const tag = document.createElement("span");
    tag.className = "hc-title";
    tag.textContent = card.dataset.name;
    card.append(tag); // inside the card, so the 3D ground can never hide it
    const sh = document.createElement("div");
    sh.className = "hc-shadow";
    world.prepend(sh);
    shadows.push(sh);
    return pos;
  });
  world.prepend(ground);

  // Even spacing on a perfect circle; same size and height for every card
  function layout() {
    const n = holders.length;
    // Ring radius from the space available (width and height), card size from the radius, so
    // neighbours never touch: the gap between card centres is 2R·sin(π/n), at least 1.45 card widths.
    const R = small ? Math.min(innerWidth * .34, innerHeight * .155, 150) :Math.min(innerWidth * .17, innerHeight * .34, 300);
    const cardW = Math.min(R * (small ? .6 : .42), (2 * R * Math.sin(Math.PI / n)) / 1.45);
    root.style.setProperty("--hc-w", `${cardW}px`);
    center.style.setProperty("--hn", `${Math.max(16, R * (small ? .15 : .12))}px`); // small one-line name label
    center.style.setProperty("--below", `${R * .55 + cardW * .3}px`);           // phones: CTA sits below the ring
    gsap.set(center, { xPercent: -50, yPercent: small ? -50 : -58 });
    const g = (R + cardW * .75) * 2;
    gsap.set(ground, { width: g, height: g, x: -g / 2, y: -g / 2 });
    holders.forEach((h, i) => {
      const a = (i / n) * Math.PI * 2;
      const x = Math.cos(a) * R;
      const y = Math.sin(a) * R;
      gsap.set(h, { x, y, z: cardW * .15, xPercent: -50, yPercent: -100, transformOrigin: "50% 100%" });
      gsap.set(shadows[i], { x, y });
    });
  }
  layout();

  const A = mode === "static" ? { tilt: 58, orbit: 18, z: 0, scale: 1 } : { tilt: 6, orbit: -80, z: -520, scale: .62 };
  const D = { z: 0 }; // scroll dolly (desktop)
  let front = -1;
  let frame = 0;

  function render(force) {
    const z = A.z + D.z;
    gsap.set(camera, { z, rotationX: A.tilt, scale: A.scale });
    gsap.set(world, { rotation: A.orbit });
    holders.forEach((h) => gsap.set(h, { rotation: -A.orbit, rotationX: -A.tilt }));
    // The name block follows the camera's depth so it sits on the ring centre at every distance
    gsap.set(center, { scale: Math.max(.15, A.scale * P / (P - Math.min(z, P - 60))) });

    // Fade cards behind the name block; enlarge the front-most clear card and show its title
    // (on phones the tagline and buttons sit below the ring, so only the name counts). Measuring every card forces
    // a layout, so while animating this runs every third frame; its class changes ease in over .45s anyway.
    if (force !== true && ++frame % 3) return;
    const c = (small ? $(".hero-name") : center).getBoundingClientRect();
    const pad = 6;
    let best = -1, bestBottom = -Infinity;
    holders.forEach((h, i) => {
      const r = cards[i].getBoundingClientRect();
      const hit = r.right > c.left + pad && r.left < c.right - pad && r.bottom > c.top + pad && r.top < c.bottom - pad;
      cards[i].classList.toggle("is-dim", hit);
      if (!hit && r.bottom > bestBottom) { bestBottom = r.bottom; best = i; }
    });
    if (best !== front) {
      holders.forEach((h, i) => {
        h.classList.toggle("is-front", i === best);
        gsap.to(cards[i], { scale: i === best ? 1.14 : 1, duration: .45, ease: "power3", overwrite: "auto" });
      });
      front = best;
    }
  }

  const reveal = [".hero-tag", ".hero-btns > *", ".scroll-ind > *"];
  const renderNow = () => render(true);
  const onResize = () => { layout(); renderNow(); };
  addEventListener("resize", onResize);
  // Re-measure once fonts and images have settled (the overlap check depends on real sizes)
  document.fonts?.ready.then(renderNow);
  addEventListener("load", renderNow, { once: true });
  let orbit = null;

  if (mode === "static") {
    renderNow();
    return () => { removeEventListener("resize", onResize); unwrapHero(holders, shadows, all); };
  }

  // Drone shot: from high above (looking almost straight down) swoop low while orbiting a full 360°.
  // The whole entrance waits for the intro to hand over (heroGate).
  gsap.set(reveal, { opacity: 0, y: 14 });
  const entrance = gsap.timeline({ paused: true });
  const intro = gsap.timeline({ onUpdate: render, onComplete: startOrbit })
    .to(A, { tilt: 58, z: 0, scale: 1, duration: 2.6, ease: "power3.inOut" }, .2)
    .to(A, { orbit: 280, duration: 4.6, ease: "sine.inOut" }, .2);
  entrance.add(intro, 0).add(gsap.from(".hero-bg img", { opacity: 0, duration: 1.6, ease: "power2.out" }), 0);
  // Very slow Ken Burns zoom on the background (scale only; the fade above owns opacity)
  const kenBurns = gsap.fromTo(".hero-bg img", { scale: 1 }, { scale: 1.08, duration: 20, ease: "sine.inOut", repeat: -1, yoyo: true });
  // The orbit (which measures every card each frame) and the zoom rest while the home scene is off screen
  // (and so does the drone-shot entrance once it has started: jumping past home must not leave it rendering)
  let entered = false;
  const shown = whileShown("home", () => [orbit, kenBurns, entered ? entrance : null]);
  // Phones: gentle parallax as the hero scrolls away (desktop parallax is part of the dolly below)
  if (mode === "mobile") gsap.to(".hero-bg", { yPercent: 12, ease: "none", scrollTrigger: { ...(stack ? stack.st("home") : { trigger: ".hero", start: "top top", end: "bottom top" }), scrub: true } });
  entrance.add(gsap.from(".hero-name span", { opacity: 0, y: 30, duration: 1.2, ease: "power3.out", stagger: .15, delay: .4 }), 0);
  if (mode === "desk") {
    entrance.add(gsap.from(".hero-copy .eyebrow, .hero-copy p, .playrow, .hero-count, .hero-note", { opacity: 0, y: 20, duration: 1, ease: "power3.out", stagger: .08, delay: .5 }), 0)
      .add(wordReveal($(".hero-copy h1"), { delay: .3, stagger: .12 }), 0);
  } else {
    entrance.add(wordReveal($(".hero-copy h1"), { rotationX: 0, delay: .15 }), 0)
      .add(gsap.from(".hero-copy .eyebrow, .hero-copy p, .playrow", { opacity: 0, y: 16, duration: .8, stagger: .08, delay: .3 }), 0);
  }
  const unwait = heroGate.wait(() => { entered = true; entrance.paused(!!shown && !shown.isActive); });

  // After the drone shot: tagline, buttons and scroll cue fade in, and the ring keeps slowly circling
  function startOrbit() {
    gsap.to(reveal, { opacity: 1, y: 0, duration: .9, ease: "power3.out", stagger: .12 });
    orbit = gsap.to(A, { orbit: "+=360", duration: 70, ease: "none", repeat: -1, onUpdate: render, paused: !!shown && !shown.isActive });
  }
  // Hovering a card or the name pauses the orbit
  const pause = () => orbit && gsap.to(orbit, { timeScale: 0, duration: .6, overwrite: true });
  const resume = () => orbit && gsap.to(orbit, { timeScale: 1, duration: .8, overwrite: true });
  [...cards, center].forEach((el) => { el.addEventListener("mouseenter", pause); el.addEventListener("mouseleave", resume); });

  // Desktop: scrolling dollies the camera forward into the page
  if (mode === "desk") {
    gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: { ...(stack ? stack.st("home") : { trigger: ".hero", start: "top top", end: "+=140%", pin: ".hero-pin", anticipatePin: 1 }), scrub: 1 },
      onUpdate: render,
    })
      .to(".hero-copy", { opacity: 0, x: -80, duration: .3 }, 0)
      .to(".hero-side, .scroll-ind", { opacity: 0, duration: .2 }, 0)
      .to(D, { z: stack ? 520 : 900, duration: 1, ease: "power2.in" }, 0)   // (stack: stop short so the clouds have a scene to cover)
      .to(center, { opacity: 0, duration: .35 }, .45)
      .to(".hero-bg", { yPercent: 10, duration: .5 }, 0)                                // slight parallax
      // (in the scene stack the scene stays full for the cloud reveal; otherwise it fades to paper)
      .to(".hero-bg", { scale: stack ? 1.2 : 1.4, opacity: stack ? 1 : 0, duration: .6, ease: "power2.in" }, .4)
      .to(".hero-fade", { opacity: stack ? 0 : 1, duration: .2 }, .8);
  }

  return () => {
    unwait();
    entrance.kill();
    orbit?.kill();
    kenBurns.kill();
    removeEventListener("resize", onResize);
    [...cards, center].forEach((el) => { el.removeEventListener("mouseenter", pause); el.removeEventListener("mouseleave", resume); });
    unwrapHero(holders, shadows, all);
  };
}

// Undo the hero's DOM changes when the layout mode changes (e.g. resizing between phone and desktop)
function unwrapHero(holders, shadows, all) {
  holders.forEach((h) => { h.querySelector(".hc-title")?.remove(); h.replaceWith(...h.childNodes); });
  shadows.forEach((s) => s.remove());
  all.forEach((c) => { c.hidden = false; c.classList.remove("is-dim"); });
}

// ---- 02 Featured work: 3D ring (pinned; scroll and drag both rotate it) ----
function ring3D() {
  const stage = $("#ring-stage");
  const ring = $("#ring");
  const floor = $(".ring-floor i");
  const cap = { tag: $("#cap-tag"), kind: $("#cap-kind"), title: $("#cap-title"), small: $("#cap-small"), idx: $("#cap-idx") };
  const st = { p: 0, drag: 0 };         // p: scroll progress 0..1, drag: extra degrees from dragging/keys
  let cards = [];
  let step = 30;
  let radius = 400;
  let front = -1;
  let rider = null;          // the girl riding the ring (scene stack)
  const RIDE = 2.2;          // screens of scroll the ring turns over; the rest of the work scene is her fall

  function build() {
    layoutEpoch++;   // new cards: cached sizes are stale
    const buttons = $$(".ring-card", ring);
    const n = Math.max(buttons.length, 1);
    step = 360 / n;
    const w = buttons[0]?.getBoundingClientRect().width || 220;
    radius = Math.max(300, (w / 2) / Math.tan(Math.PI / n) * 1.2);
    cards = buttons.map((btn, i) => {
      const holder = document.createElement("div");
      holder.className = "rc";
      btn.replaceWith(holder);
      holder.append(btn);
      // Fixed slot on the ring (rotate first, then push out); only the ring itself animates
      holder.style.transform = `translate(-50%, -50%) rotateY(${i * step}deg) translateZ(${radius}px)`;
      btn.addEventListener("focus", () => goTo(i));
      return btn;
    });
    const h = cards[0]?.getBoundingClientRect().height || 290;
    floor.style.transform = `translateY(${h * .62}px) rotateX(90deg)`;
    floor.style.width = floor.style.height = `${radius * 2.4}px`;
    floor.style.left = floor.style.top = `${-radius * 1.2}px`;
    front = -1;
    render();
  }

  const angle = () => -st.p * (cards.length - 1) * step + st.drag;

  function render() {
    const a = angle();
    // Push the ring back so the front card isn't right up against the lens
    gsap.set(ring, { z: -radius * .6, rotationY: a, rotationX: -6 });
    cards.forEach((card, i) => {
      // How far this card is from facing the viewer (0 = dead front)
      let d = ((i * step + a) % 360 + 540) % 360 - 180;
      const facing = Math.cos(d * Math.PI / 180);
      gsap.set(card, { scale: 1 + .2 * Math.pow(Math.max(facing, 0), 8), opacity: .25 + .75 * Math.pow(Math.max(facing, 0), 1.5) });
    });
    const f = ((Math.round(-a / step) % cards.length) + cards.length) % cards.length;
    if (f !== front && cards[f]) {
      front = f;
      const c = cards[f].dataset;
      gsap.fromTo("#ring-caption", { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .45, ease: "power3.out", overwrite: true });
      cap.tag.textContent = c.tag;
      cap.kind.textContent = c.kind;
      cap.title.textContent = c.titleShort;
      cap.small.textContent = c.small;
      cap.idx.textContent = String(f + 1).padStart(2, "0");
    }
    rider?.draw();
  }

  // Bring card i to the front (used by keyboard focus and arrow keys)
  function goTo(i) {
    const target = -i * step;
    let delta = ((target - angle()) % 360 + 540) % 360 - 180;
    gsap.to(st, { drag: st.drag + delta, duration: .8, ease: "power3.out", onUpdate: render, overwrite: true });
  }

  // ---- The girl riding the ring (scene stack). She stands on the floor ring just outside the cards, in the ring's own
  // 3D space: she follows the cards' circle and perspective, and the browser sorts her in front of them at the front
  // and behind them at the back. Her place comes from the ring's angle, so scrolling and dragging both move her;
  // her arrival and her fall at the end are drawn from scroll. She stays at floor level, under the caption layer.
  if (stack) rider = (() => {
    const holder = document.createElement("div");
    holder.className = "rc-girl";
    ring.append(holder);
    const girl = makeGirl(holder, "girl--ring", WORLD.work);
    const { el, act } = girl;
    const capEl = $("#ring-caption");
    // Boxes that only change with the layout: the caption, and the stage the ring is seen through
    let capBox = null, view = null;
    const forgetCap = () => { capBox = null; view = null; };
    ScrollTrigger.addEventListener("refresh", forgetCap);
    addEventListener("resize", forgetCap);
    // Where a point on the ring lands on screen, by the same maths the browser uses (so no layout reads per frame):
    // the ring's tilt and turn, its push back, then the stage's perspective
    const D2R = Math.PI / 180;
    const cardH = cached(() => cards[0]?.offsetHeight || 290);
    function project(theta, rad, y, a) {
      if (!view) {
        const r = stage.getBoundingClientRect(), cs = getComputedStyle(stage), [vx, vy] = cs.perspectiveOrigin.split(" ").map(parseFloat);
        view = { left: r.left, top: r.top, ox: ring.offsetLeft, oy: ring.offsetTop, vx, vy, P: parseFloat(cs.perspective) || 1500 };
      }
      let px = rad * Math.sin(theta * D2R), py = y, pz = rad * Math.cos(theta * D2R);
      const X = -6 * D2R, A = a * D2R;
      [py, pz] = [py * Math.cos(X) - pz * Math.sin(X), py * Math.sin(X) + pz * Math.cos(X)];
      [px, pz] = [px * Math.cos(A) + pz * Math.sin(A), -px * Math.sin(A) + pz * Math.cos(A)];
      pz -= radius * .6;
      const k = view.P / (view.P - pz);
      return { x: view.left + view.vx + (view.ox + px - view.vx) * k, y: view.top + view.vy + (view.oy + py - view.vy) * k, k };
    }
    preloadAfter("home", WORLD.work);
    const norm = (d) => ((d % 360) + 540) % 360 - 180;
    let pa = 0, pf = 0, lastX = null, face = 1, moving = false, stop = null;
    function draw() {
      const a = angle();
      const h = cardH();
      const small = innerWidth < 600;
      const gh = h * (small ? .5 : .58);
      el.style.setProperty("--gh", `${gh}px`);
      let theta = 0, rad = radius * 1.18, lift = 0, spin = 0, sq = 0;
      if (pa < 1) {
        // Dropping lightly onto the front of the ring as the scene opens
        lift = -innerHeight * .9 * (1 - ramp(pa, .55, .9, "power2.in"));
        sq = Math.sin(Math.PI * ramp(pa, .88, 1));
      } else if (pf > 0) {
        // Runs to the front edge, jumps, and falls out of the bottom of the screen, gently spinning
        const run = ramp(pf, 0, .4, "sine.inOut"), jump = ramp(pf, .4, .55), fall = ramp(pf, .55, 1, "power1.in");
        theta = norm(-a) * run;
        rad *= 1 + .14 * run;
        lift = -h * .45 * Math.sin(Math.PI * jump) + fall * innerHeight * 1.2;
        spin = 140 * fall;
      }
      const w = theta + a;
      const floorY = h * (small ? .5 : .62) + lift;
      const place = (up) => (holder.style.transform = `rotateY(${theta}deg) translateZ(${rad}px) translateY(${floorY - up}px) rotateY(${-w}deg)`);
      // She faces the way she's moving across the screen, and runs while the ring turns (idle once it stops)
      const x = rad * Math.sin(w * Math.PI / 180);
      if (lastX !== null && Math.abs(x - lastX) > .4) {
        face = x > lastX ? 1 : -1;
        if (pa >= 1 && !pf) {
          moving = true;
          stop?.kill();
          stop = gsap.delayedCall(.18, () => { moving = false; draw(); });
        }
      }
      lastX = x;
      const pose = pa < 1 ? (pa < .88 ? "fall" : "idle") : pf > 0 ? (pf < .4 ? "run" : pf < .55 ? "cheer" : "fall") : moving ? "run" : "idle";
      // Never over the caption. Where her spot on the floor falls inside the caption's area (phones, where the front
      // card already meets it), she stands just above its top edge instead; while falling she fades out over it.
      let clear = 1;
      const cr = (capBox ??= capEl.getBoundingClientRect());
      let up = 0, feet = project(theta, rad, floorY, a);
      if (cr.width) {
        const k = feet.k;   // her on-screen scale
        const bw = gh * .55 * k, bh = gh * k;
        const standing = pa >= .88 && pf < .55;
        if (standing && feet.x + bw / 2 > cr.left && feet.x - bw / 2 < cr.right && feet.y > cr.top - 6) {
          up = (feet.y - (cr.top - 6)) / k;
          feet = project(theta, rad, floorY - up, a);
        }
        const ox = Math.max(0, Math.min(cr.right, feet.x + bw / 2) - Math.max(cr.left, feet.x - bw / 2));
        const oy = Math.max(0, Math.min(cr.bottom, feet.y) - Math.max(cr.top, feet.y - bh));
        clear = 1 - clamp01(ox * oy / (bw * bh) * 3);
      }
      place(up);
      // Round the back she dims a little (perspective already makes her smaller)
      gsap.set(el, { scaleX: face, autoAlpha: pa > .55 ? (.55 + .45 * Math.max(0, Math.cos(w * Math.PI / 180))) * clear : 0 });
      gsap.set(act, { rotation: spin, scaleX: 1 + .2 * sq, scaleY: 1 - .2 * sq });
      girl.set(pose, 0);
      girl.breath.paused(pose !== "idle");
    }
    scrubbed(stack.rev("home"), (p) => { pa = p; draw(); });
    scrubbed(stack.st("work", () => innerHeight * RIDE), (p) => { pf = p; draw(); });
    return { holder, draw, destroy: () => { ScrollTrigger.removeEventListener("refresh", forgetCap); stop?.kill(); girl.destroy(); holder.remove(); } };
  })();

  // Scroll drives the ring
  gsap.to(st, {
    p: 1, ease: "none", onUpdate: render,
    // Pin the whole section so the filters stay usable while the ring turns
    scrollTrigger: { ...(stack ? stack.st("work", 0, () => innerHeight * RIDE) : { trigger: ".work-section", start: "top top", end: "+=220%", pin: true, anticipatePin: 1 }), scrub: 1 },
  });

  // Drag (mouse) or swipe sideways (touch; vertical swipes still scroll, see touch-action) to rotate,
  // with a little inertia and snap to the nearest card
  let startX = 0, startDrag = 0, lastX = 0, lastT = 0, vel = 0, moved = false;
  const onDown = (e) => {
    gsap.killTweensOf(st, "drag");
    startX = lastX = e.clientX; startDrag = st.drag; lastT = performance.now(); vel = 0; moved = false;
    stage.classList.add("dragging");
  };
  const onMove = (e) => {
    if (!stage.classList.contains("dragging")) return;
    const dx = e.clientX - startX;
    // Capture only once it's really a drag, so a plain click still reaches the card
    if (!moved && Math.abs(dx) > 4) { moved = true; stage.setPointerCapture(e.pointerId); }
    const now = performance.now();
    vel = (e.clientX - lastX) / Math.max(now - lastT, 1);
    lastX = e.clientX; lastT = now;
    st.drag = startDrag + dx * .3;
    render();
  };
  const onUp = () => {
    if (!stage.classList.contains("dragging")) return;
    stage.classList.remove("dragging");
    if (moved) {
      suppressClick = true;
      setTimeout(() => (suppressClick = false), 0);
    }
    // Throw with inertia, landing exactly on a card
    const thrown = st.drag + vel * 220;
    const base = -st.p * (cards.length - 1) * step;
    const snapped = Math.round((base + thrown) / step) * step - base;
    gsap.to(st, { drag: snapped, duration: 1, ease: "power3.out", onUpdate: render });
  };
  const onKey = (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next = (front + (e.key === "ArrowRight" ? 1 : -1) + cards.length) % cards.length;
    cards[next].focus({ preventScroll: true });
  };
  stage.addEventListener("pointerdown", onDown);
  stage.addEventListener("pointermove", onMove);
  stage.addEventListener("pointerup", onUp);
  stage.addEventListener("pointercancel", onUp);
  stage.addEventListener("keydown", onKey);

  // Filters rebuild the ring with a quick spin-in
  // (Entry and filter effects animate the stage, never the cards, because render() owns card scale/opacity.)
  onRingRebuilt = () => {
    st.drag = 0;
    if (rider) ring.append(rider.holder);   // the filter re-render replaced the ring's contents
    build();
    gsap.fromTo(stage, { opacity: 0, scale: .9 }, { opacity: 1, scale: 1, duration: .7, ease: "back.out(1.4)", overwrite: true });
  };

  build();
  gsap.from(stage, {
    opacity: 0, y: 90, duration: 1.2, ease: "power3.out",
    scrollTrigger: trig(".work-section", "top 75%"),
  });
  gsap.from(".work-head > *", {
    opacity: 0, y: 16, duration: .8, ease: "power3.out", stagger: .1,
    scrollTrigger: trig(".work-head", "top 88%"),
  });

  return () => {
    stage.removeEventListener("pointerdown", onDown);
    stage.removeEventListener("pointermove", onMove);
    stage.removeEventListener("pointerup", onUp);
    stage.removeEventListener("pointercancel", onUp);
    stage.removeEventListener("keydown", onKey);
    onRingRebuilt = () => {};
    rider?.destroy();
    // Back to the flat row: unwrap the holders
    $$(".rc", ring).forEach((h) => h.replaceWith(...h.childNodes));
  };
}

// ---- 03 Music & Travel: drone fly-over (pinned; slow, moody) ----
function flyOver() {
  const plane = $("#fly-plane");
  const cards = $$(".fly-plane .mcard");
  // Lift cards to slightly different heights, like terrain
  gsap.set(cards, { z: (i) => 14 + ((i * 37) % 64), opacity: .12 });
  gsap.set(".fly-label", { z: 30 });

  // Smaller windows sit the camera further back so the cards don't fill the screen
  const flyDepth = () => -220 - Math.max(0, 900 - innerHeight) * .9 - Math.max(0, 1440 - innerWidth) * .6;
  // Where the flight stops: last row mid-screen. The further back the camera sits (smaller windows),
  // the higher the plane appears, so the flight stops earlier; phones' tall screens need the most.
  const flyEnd = () => {
    const k = innerWidth < 900 ? 1 : .6 + Math.min(.3, (-flyDepth() - 220) / 900);
    return -(plane.offsetHeight - innerHeight * k);
  };

  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: { ...(stack ? stack.st("music") : { trigger: ".music-section", start: "top top", end: "+=230%", pin: ".fly-pin", anticipatePin: 1 }), scrub: 1.8 },
  });
  // The camera glides forward across the landscape (set back from the lens), drifting a little like a drone.
  // Travel ends with the last row (Shorts) framed in the middle of the screen.
  tl.fromTo(plane,
    { xPercent: -50, x: -30, z: () => flyDepth(), y: () => innerHeight * .3, rotationX: 60, rotationZ: -5 },
    { xPercent: -50, x: 30, z: () => flyDepth(), y: () => flyEnd(), rotationX: 50, rotationZ: 4, duration: 1 }, 0)
    // Cards surface slowly out of the dark as the camera reaches them
    .to(cards, { opacity: 1, duration: .24, ease: "power1.out", stagger: .6 / Math.max(cards.length, 1) }, 0);

  // Heading: slow cinematic fade (separate trigger; the scrubbed timeline never touches it)
  gsap.from(".music-head .section-head .num, .music-head .section-title, .music-sub, .music-head .pill", {
    opacity: 0, y: 24, duration: 1.8, ease: "power2.out", stagger: .2,
    scrollTrigger: trig(".music-section", "top 65%"),
  });
}

// ---- Text: editorial headings reveal word by word with a slight 3D rotation ----
function headingReveals(desk) {
  $$("[data-words]").forEach((el) => {
    if (el.closest(".hero")) return; // the hero headline is part of the hero intro
    const kids = !!el.closest(".kids-section");
    const music = !!el.closest(".music-section");
    wordReveal(el, {
      rotationX: desk ? (kids ? -95 : -80) : 0,
      yPercent: kids ? 90 : 60,
      duration: music ? 1.8 : kids ? 1 : 1.1,
      stagger: music ? .18 : .08,
      ease: kids ? "back.out(2.6)" : music ? "power2.out" : "power4.out",
      scrollTrigger: trig(el, "top 88%"),
    });
  });
}

// ---- 04 Kids: jumping title, bouncing TV, popping picks, bouncy row, living decorations ----
// Each element has one owner per property: entry tweens use y/scale/opacity, hover wobbles use rotation,
// pointer tilt uses rotationX/Y, and the static sticker angles are the CSS `rotate` property.
function kidsMotion(desk) {
  const off = [];
  const on = (el, type, fn) => { el.addEventListener(type, fn); off.push(() => el.removeEventListener(type, fn)); };

  // Title letters jump up into place one by one; on desktop each letter wobbles when hovered
  const letters = $$("[data-letters] .kl");
  gsap.from(letters, { yPercent: 120, rotation: (i) => (i % 2 ? 14 : -14), opacity: 0, duration: .9, ease: "back.out(3)", stagger: .05, scrollTrigger: trig(".kids-head") });
  if (desk && finePointer) letters.forEach((l) => on(l, "mouseenter", () =>
    gsap.fromTo(l, { rotation: 0 }, { keyframes: { rotation: [-14, 10, -6, 0] }, duration: .6, ease: "power1.inOut", overwrite: "auto" })));
  gsap.from(".kids-kicker, .kids-sub", { opacity: 0, y: 20, duration: .8, ease: "back.out(2)", stagger: .1, scrollTrigger: trig(".kids-head") });
  gsap.from(".kids-headrow .pill--kids", { scale: 0, duration: 1, ease: "elastic.out(1, .45)", scrollTrigger: trig(".kids-head") });

  // TV drops in with a bounce; its antenna wiggles when you hover it; knobs turn as you scroll
  gsap.from("#kids-tv", { y: -160, opacity: 0, duration: 1.3, ease: "bounce.out", scrollTrigger: trig(".kids-stage", "top 100%") });
  gsap.from(".tv-caption > *", { opacity: 0, y: 20, duration: .7, ease: "back.out(2)", stagger: .08, delay: .5, scrollTrigger: trig(".kids-stage", "top 100%") });
  const tvPulse = gsap.to(".tv-play", { scale: 1.1, duration: .9, ease: "sine.inOut", repeat: -1, yoyo: true });
  const wiggle = () => gsap.fromTo(".tv-antenna i", { rotation: 0 }, { keyframes: { rotation: [12, -10, 7, -4, 0] }, duration: .9, ease: "power1.inOut", stagger: .08, overwrite: "auto" });
  on($("#kids-tv"), "mouseenter", wiggle);
  if (desk) gsap.to(".knob", { rotation: 300, ease: "none", scrollTrigger: { ...(stack ? stack.span("kids") : { trigger: ".kids-stage", start: "top bottom", end: "bottom top" }), scrub: true } });

  // Picks pop in one by one
  gsap.from("#kids-picks .kpick", { scale: 0, opacity: 0, duration: .8, ease: "back.out(2.2)", stagger: .14, delay: .35, scrollTrigger: trig(".kids-stage", "top 100%") });
  // Swapping a pick onto the TV: screen blinks off and on, the new pick pops in
  kidsSwapFx = (swap, pick) => {
    gsap.timeline()
      .to("#tv-screen img", { opacity: 0, duration: .18 })
      .add(() => { swap(); wiggle(); })
      .to("#tv-screen img", { opacity: 1, duration: .3 })
      .fromTo($(".kpthumb", pick), { scale: .4, opacity: 0 }, { scale: 1, opacity: 1, duration: .7, ease: "back.out(2.4)" }, "<");
  };

  // Tabs pop in like bubbles
  gsap.from(".ktab, .row-btn", { scale: 0, opacity: 0, duration: .7, ease: "back.out(2.2)", stagger: .05, scrollTrigger: trig(".kids-more", "top 92%") });

  // Row cards bounce in as the row arrives
  const cards = $$("#kids-row .kcard");
  gsap.set(cards, { opacity: 0, y: 70, scale: .5, rotation: () => gsap.utils.random(-10, 10) });
  ScrollTrigger.batch(cards, {
    start: stack ? (self) => stack.at(self.trigger, .95) : "top 95%",
    onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, scale: 1, rotation: 0, duration: 1.2, ease: "elastic.out(1, .5)", stagger: .06, overwrite: true }),
  });
  kidsFilterFx = (shown) => gsap.fromTo(shown, { opacity: 0, y: 30, scale: .6 }, { opacity: 1, y: 0, scale: 1, rotation: 0, duration: .9, ease: "elastic.out(1, .55)", stagger: .04, overwrite: true });

  // The music note on the tree bobs about
  const noteBob = gsap.to(".dd-note", { y: -16, rotation: 12, duration: 2.2, ease: "sine.inOut", repeat: -1, yoyo: true });
  whileShown("kids", () => [tvPulse, noteBob]);

  return () => { kidsFilterFx = null; kidsSwapFx = null; off.forEach((fn) => fn()); };
}

// ---- 04 Kids: jungle background. Butterflies wander on random curves over the visible part ----
// The water shimmer and wing flaps are CSS; both pause while the section is off screen.
function kidsJungle(desk) {
  const scene = $(".kids-jungle");
  const pic = $(".jg-pic");
  if (!scene || !pic) return null;
  const rnd = gsap.utils.random;
  const tweens = [];
  const flies = $$(".jg-bf", pic);
  const cur = [];
  // A random point over the part of the picture that is on screen (its top and sides crop), above the lawn
  const point = () => {
    const x0 = Math.max(0, -pic.offsetLeft);
    const x1 = Math.min(pic.offsetWidth, scene.offsetWidth - pic.offsetLeft);
    return { x: rnd(x0 + 30, x1 - 30), y: Math.max(0, -pic.offsetTop) + rnd(.14, .6) * scene.offsetHeight };
  };
  function wander(el, i) {
    const a = point(), b = point();
    gsap.to(el, { rotation: Math.sign(b.x - gsap.getProperty(el, "x")) * rnd(8, 18), duration: 1.2, ease: "sine.inOut", overwrite: "auto" });
    cur[i] = gsap.to(el, { motionPath: { path: [a, b], curviness: 1.6 }, duration: rnd(7, 11), ease: "sine.inOut", onComplete: () => wander(el, i) });
  }
  flies.forEach((el, i) => { gsap.set(el, { left: 0, top: 0, ...point() }); wander(el, i); });

  const run = (on) => { scene.classList.toggle("is-paused", !on); cur.forEach((t) => t?.[on ? "resume" : "pause"]()); };
  const st = ScrollTrigger.create({ ...(stack ? stack.span("kids") : { trigger: scene, start: "top bottom", end: "bottom top" }), onToggle: (self) => run(self.isActive) });
  run(st.isActive);
  return () => {
    st.kill();
    tweens.forEach((t) => t.kill());
    cur.forEach((t) => t?.kill());
    gsap.set(pic, { clearProps: "transform" });
    gsap.set(flies, { clearProps: "transform,left,top" });
    scene.classList.remove("is-paused");
  };
}

// ---- The girl's journey after the intro ----
// Every move is drawn from scroll progress: slow scrolling moves her slowly, stopping stops her mid-move,
// scrolling back reverses her. Only breathing (and a wave's wiggle) is her own. Each world has its own girl
// inside its scene, so outfit changes happen out of sight in the reveals.
// mode: "motion" (scene stack) or "static" (reduced motion: standing in each world in the right outfit)

// Decode a world's poses once the scene before it is showing, well before its reveal
const preloadAfter = (id, poses) => ScrollTrigger.create({ start: () => stack.top(id), end: "max", onToggle: (self) => self.isActive && preloadGirl(poses) });
function staticGirl(host, cls, poses, pose) {
  const girl = makeGirl(host, `${cls} girl--static`, poses);
  girl.set(pose, 0);
  girl.breath.pause();
  return () => girl.destroy();
}

// ---- 01 Home: she drops in from the sky, stands by the ring, then leaps into the clouds ----
function homeGirl(mode) {
  const host = $(".hero-pin");
  if (mode === "static" || !stack) return staticGirl(host, "girl--home", ["idle"], "idle");
  const girl = makeGirl(host, "girl--home", WORLD.home);
  const { el, act } = girl;
  preloadGirl(WORLD.home);
  const H = () => girl.height();
  // The screen centre relative to her feet
  const centre = cached(() => ({ x: host.offsetWidth / 2 - el.offsetLeft, y: host.offsetHeight * .5 - el.offsetTop }));
  const top = cached(() => el.offsetTop);
  let v = 0, d = 0, b = 0; // fall through the sky, camera dolly, clouds to the work scene
  function draw() {
    const c = centre();
    girl.breath.paused(v < 1 || b > 0);
    if (b > 0) {
      // Runs to the middle, leaps up and drops into the clouds as they close over her
      const run = ramp(b, 0, .2, "power1.in"), leap = ramp(b, .2, .35), drop = ramp(b, .35, .6, "power2.in");
      gsap.set(el, { autoAlpha: 1, x: c.x * (run * .75 + leap * .25), y: -H() * .55 * Math.sin(Math.PI * leap) + drop * H() * .8 });
      gsap.set(act, { rotation: b < .2 ? 8 : b < .35 ? 20 * leap - 10 : 30 * drop, scaleX: 1 - .5 * drop, scaleY: 1 - .5 * drop });
      girl.set(b < .2 ? "run" : b < .35 ? "cheer" : "fall", 0);
      return;
    }
    if (v < 1) {
      // Dropping in from the sky as the home scene rises into place, landing on her spot with a squash
      const t = ramp(v, .78, .95, "power2.in"), l = ramp(v, .93, 1), sq = Math.sin(Math.PI * l);
      gsap.set(el, { autoAlpha: v > .78 ? 1 : 0, x: Math.sin(Math.PI * t) * H() * .3, y: -(top() + H() * 1.2) * (1 - t) });
      gsap.set(act, { rotation: 30 * (1 - t), scaleX: 1 + .2 * sq, scaleY: 1 - .2 * sq });
      girl.set(v < .93 ? "fall" : "idle", 0);
      return;
    }
    // Standing by the ring while the camera dollies in; she points at it on the way
    gsap.set(el, { autoAlpha: 1, x: 0, y: 0 });
    gsap.set(act, { rotation: 0, scaleX: 1, scaleY: 1 });
    girl.set(d > .25 && d < .7 ? "point" : "idle", .12);
  }
  scrubbed(stack.rev("intro"), (p) => { v = p; draw(); });
  scrubbed(stack.st("home"), (p) => { d = p; draw(); });
  scrubbed(stack.rev("home"), (p) => { b = p; draw(); });
  return () => girl.destroy();
}

// ---- 03 Music: she floats down in the spotlight with headphones, then walks and dances through the fly-over ----
function musicGirl(mode) {
  const host = $(".fly-pin");
  if (mode === "static" || !stack) return staticGirl(host, "girl--music", ["music-dance"], "music-dance");
  const girl = makeGirl(host, "girl--music", WORLD.music);
  const { el, act, breathEl } = girl;
  preloadAfter("work", WORLD.music);
  const H = () => girl.height();
  const top = cached(() => el.offsetTop);
  const WALK = [[0, "music-land"], [.05, "music-walk"], [.3, "music-dance"], [.42, "music-walk"], [.62, "music-dance"], [.74, "music-walk"]];
  let s = 0, w = 0, face = 1; // spotlight, fly-over, which way she faces
  function draw() {
    if (s < 1) {
      // Drifting slowly down inside the opening spotlight, swaying, then a soft squash on landing
      const k = ramp(s, .3, .9, "sine.out"), sq = Math.sin(Math.PI * ramp(s, .88, 1));
      gsap.set(el, { x: Math.sin(k * Math.PI * 2) * H() * .15 * (1 - k), y: -(top() + H() * 1.2) * (1 - k) });
      gsap.set(act, { y: 0, rotation: Math.sin(k * Math.PI * 3) * 8 * (1 - k), scaleX: 1 + .18 * sq, scaleY: 1 - .18 * sq });
      gsap.set(breathEl, { rotation: 0 });
      girl.set("music-land", 0);
      return;
    }
    // Walking right across the bottom (her steps follow the scroll), stopping twice to dance
    const walked = ramp(w, .05, .3) * .45 + ramp(w, .42, .62) * .3 + ramp(w, .74, 1) * .25;
    const pose = poseAt(WALK, w);
    const x = walked * innerWidth * .32;
    const step = Math.abs(Math.sin(x / (H() * .22) * Math.PI));
    const dance = pose === "music-dance";
    gsap.set(el, { x, y: 0, scaleX: face });
    gsap.set(act, { y: dance ? -Math.abs(Math.sin(w * Math.PI * 40)) * H() * .06 : pose === "music-walk" ? -step * H() * .035 : 0, rotation: 0, scaleX: 1, scaleY: 1 });
    gsap.set(breathEl, { rotation: dance ? Math.sin(w * Math.PI * 30) * 7 : pose === "music-walk" ? 2 + step * 2 : 0 });
    girl.set(pose, .08);
  }
  scrubbed(stack.rev("work"), (p) => { s = p; draw(); });
  ScrollTrigger.create({
    ...stack.st("music"),
    // She faces the way she's going: forwards when scrolling down, turned round when scrolling back
    onUpdate: (self) => { w = self.progress; face = self.direction < 0 ? -1 : 1; draw(); },
    onRefresh: (self) => { w = self.progress; draw(); },
  });
  return () => girl.destroy();
}

// ---- 04 Kids: a slow fall through the parted vines onto the lawn, then binoculars, a walk and a wave ----
// She lives on top of the TV (which stands on the lawn), so she rides along as the content scrolls.
function kidsGirl(mode) {
  const tv = $("#kids-tv");
  if (!tv) return null;
  if (mode === "static" || !stack) return staticGirl(tv, "girl--kids", ["safari-wave"], "safari-wave");
  const girl = makeGirl(tv, "girl--kids", WORLD.kids);
  const { el, act, breathEl, shadow } = girl;
  preloadAfter("music", WORLD.kids);
  const H = () => girl.height();
  // Leaves and grass that burst from her feet as she lands (they hide the change into explorer gear)
  el.insertAdjacentHTML("afterbegin", `<span class="girl-puff">${"<i></i>".repeat(10)}</span>`);
  const bits = $$(".girl-puff i", el);
  gsap.set(bits, { scale: 0 });
  const float = gsap.parseEase("girlFloat") ?? gsap.parseEase("sine.out");
  const tvW = cached(() => tv.offsetWidth);
  const FALL = [[0, "fall"], [.86, "safari-land"]];
  const AFTER = [[0, "safari-land"], [.12, "safari-look"], [.45, "safari-walk"], [.75, "safari-wave"]];
  let f = 0, g = 0, path = null;

  // The curved path: from above the screen, drifting side to side, down to her spot on the lawn
  function build() {
    path?.kill();
    const sec = $(".kids-section");
    const feet = tv.getBoundingClientRect().top - sec.getBoundingClientRect().top + el.offsetTop; // from the scene's top
    const top = -(feet + H() * 1.3), w = Math.min(innerWidth, 900);
    gsap.set(el, { x: -w * .14, y: top });
    path = gsap.to(el, {
      motionPath: { path: [{ x: w * .1, y: top * .64 }, { x: -w * .06, y: top * .3 }, { x: w * .02, y: -H() * .3 }, { x: 0, y: 0 }], curviness: 1.3 },
      ease: "none", paused: true,
    });
  }
  const pose = () => girl.set(f < 1 ? poseAt(FALL, f) : poseAt(AFTER, g), 0);

  function drawFall(p) {
    f = p;
    if (!path) build();
    const k = ramp(p, 0, .86);             // in the air
    const l = ramp(p, .86, 1);             // landing
    path.progress(float(k));
    // Gentle spin on the way down (−18° → +6° → upright), then squash on touching down and a little rebound
    const sq = Math.sin(Math.PI * Math.min(1, l / .5)), up = l > .5 ? Math.sin(Math.PI * (l - .5) / .5) * .35 : 0;
    gsap.set(act, { rotation: -18 * (1 - k) * Math.cos(Math.PI * 1.5 * k), scaleX: 1 + .24 * sq - .05 * up, scaleY: 1 - .26 * sq + .07 * up });
    gsap.set(shadow, { opacity: ramp(p, .55, .86) });
    // The puff: bits fly out and up from her feet, then fade
    bits.forEach((b, i) => {
      const a = Math.PI * (1.08 + i / (bits.length - 1) * .84), r = H() * (.22 + .1 * (i % 3)) * ramp(l, 0, .8, "power2.out");
      gsap.set(b, { x: Math.cos(a) * r * 1.4, y: Math.sin(a) * r, rotation: i * 70 + l * 180, scale: l > 0 && l < 1 ? Math.sin(Math.PI * Math.min(1, l * 1.3)) * 1.2 : 0 });
    });
    girl.breath.paused(p < 1);
    pose();
  }

  // After landing, while the content scrolls: binoculars (looking around), a short walk, a wave. On a two-column
  // stage she first hops down into the empty space to the right of the "Most watched" card (under the picks), once
  // it has scrolled into view; on one column (phones) she stays on the lawn on top of the TV.
  // (layout positions inside the section, so the TV's own bounce-in offset can't skew them)
  const sec = $(".kids-section");
  const box = (e) => { let x = 0, y = 0; for (let n = e; n && n !== sec; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; } return { x, y, w: e.offsetWidth, h: e.offsetHeight }; };
  const spot = cached(() => {
    const cap = $(".tv-caption"), picks = $("#kids-picks");
    if (!cap || !picks) return null;
    const t = box(tv), c = box(cap), k = box(picks);
    if (k.x < t.x + t.w - 10) return null;   // one column: no space beside the card
    return { x: k.x + k.w * .2 - t.x - el.offsetLeft, y: c.y + c.h - 6 - t.y - el.offsetTop, w: k.w, secY: c.y + c.h };
  });
  function drawAfter(p) {
    g = p;
    const sp = spot();
    const hop = sp ? ramp(p, 0, .18, "sine.inOut") : 0;
    const t0 = sp ? .18 : 0;
    const look = ramp(p, t0 + .02, .45), walk = ramp(p, .45, .75, "sine.inOut"), bye = ramp(p, .75, 1);
    const step = walk > 0 && walk < 1 ? Math.abs(Math.sin(walk * Math.PI * 7)) : 0;
    const dist = sp ? sp.w * .32 : tvW() * .38;
    gsap.set(act, {
      x: (sp ? sp.x * hop : 0) + dist * walk,
      y: (sp ? sp.y * hop - Math.sin(Math.PI * hop) * H() * .8 : 0) - step * H() * .035,
    });
    gsap.set(breathEl, { rotation: p < .45 ? Math.sin(look * Math.PI * 2) * 4 : p < .75 ? 2 + step * 2 : Math.sin(bye * Math.PI * 6) * 5 });
    pose();
  }

  scrubbed({ start: () => stack.top("kids"), end: () => stack.inner("kids").start() }, drawFall);
  // The after-landing moments start once her spot is on screen (at once on one column)
  const afterStart = () => {
    const sp = spot(), s0 = stack.inner("kids").start();
    return sp ? s0 + Math.max(0, Math.min(stack.contentTravel("kids"), sp.secY - innerHeight * .82)) : s0;
  };
  scrubbed({ start: afterStart, end: () => afterStart() + innerHeight * .7 }, drawAfter);
  const rebuild = () => { path = null; drawFall(f); };
  ScrollTrigger.addEventListener("refresh", rebuild);
  return () => { ScrollTrigger.removeEventListener("refresh", rebuild); path?.kill(); girl.destroy(); };
}

// ---- 06 Process: she walks the timeline and each step comes alive as she reaches it ----
// Over the scene's scroll she appears left of step 01, stops at each step (pointing at it), walks on to the next, and
// at 04 she cheers while a golden shimmer sweeps the heading. The line draws behind her as a glowing golden path with
// sparkles trailing her feet. Phones (vertical timeline): she walks down the line, in the gap above each icon, left of
// the text. mode "static" (reduced motion): every step lit, her standing at step 04, waving.
function processGirl(mode) {
  const tl = $(".timeline");
  const steps = $$(".timeline .step");
  if (!tl || steps.length < 4) return null;
  const line = $(".tl-line i", tl);
  const icons = steps.map((s) => $(".step-icon", s));
  const texts = steps.map((s) => $$(".stepno, h3, p", s));
  // Each step's extra pieces: a gold ring, plus 01 glow and sparkles, 02 three layers, 03 a film strip, 04 rays and a screen
  const added = [];
  const add = (el, html) => { const n = el.children.length; el.insertAdjacentHTML("beforeend", html); added.push(...[...el.children].slice(n)); };
  icons.forEach((ic) => add(ic, '<i class="st-ring"></i>'));
  add(icons[0], '<i class="st-glow"></i>' + '<i class="st-spk"></i>'.repeat(5));
  add(icons[1], `<span class="st-layers">${'<svg viewBox="0 0 24 24"><path d="m12 6.5 8 4.5-8 4.5-8-4.5z"/></svg>'.repeat(3)}</span>`);
  add(icons[2], '<i class="st-film"></i>');
  add(icons[3], '<i class="st-rays"></i><i class="st-screen"></i>');
  const heading = $(".process-title");
  add(heading, '<span class="pt-shine" aria-hidden="true"><i></i></span>');
  const part = (i, sel) => $$(sel, icons[i]);
  const svgOf = (i) => $(".ico", icons[i]);

  const girl = makeGirl(tl, `girl--process${mode === "static" ? " girl--static" : ""}`, mode === "static" ? ["wave"] : ["idle", "run", "point", "cheer"]);
  const { el, act } = girl;
  add(tl, '<li class="tl-trail" aria-hidden="true">' + "<i></i>".repeat(6) + "</li>");
  const trail = $$(".tl-trail i", tl);
  const vertical = () => matchMedia("(max-width: 900px)").matches;

  // Where she stops for each step (her feet, in the timeline's coordinates), from layout (not transforms)
  let G = null;
  function measure() {
    const v = vertical(), gh = girl.height();
    const c = icons.map((ic, i) => ({ x: steps[i].offsetLeft + ic.offsetLeft + ic.offsetWidth / 2, y: steps[i].offsetTop + ic.offsetTop + ic.offsetHeight / 2, r: ic.offsetWidth / 2 }));
    const stops = c.map((ci) => (v ? { x: ci.x, y: ci.y - ci.r - 6 } : { x: ci.x - ci.r - gh * .32, y: ci.y + ci.r }));
    const lt = line.parentElement;
    G = { v, gh, c, stops, line: v ? { from: lt.offsetTop, len: lt.offsetHeight } : { from: lt.offsetLeft, len: lt.offsetWidth } };
  }

  // The walk over the scene's scroll: [stop start, stop end] for each step; walking in between
  const STOP = [[.04, .16], [.34, .46], [.6, .72], [.86, 1]];
  function draw(P, pose) {
    if (!G) measure();
    const { v, gh, stops } = G;
    // Where she is: at a stop, or walking (eased) from one stop to the next
    let i = 0;
    while (i < 3 && P >= STOP[i][1]) i++;
    let pos = stops[i], w = 0;
    if (i > 0 && P < STOP[i][0]) {
      w = ramp(P, STOP[i - 1][1], STOP[i][0], "sine.inOut");
      const A = stops[i - 1], B = stops[i];
      pos = { x: A.x + (B.x - A.x) * w, y: A.y + (B.y - A.y) * w };
    }
    const moving = i > 0 && P < STOP[i][0] && w > 0 && w < 1;
    const travelled = v ? pos.y : pos.x;
    const bob = moving ? Math.abs(Math.sin(travelled / (gh * .28) * Math.PI)) * gh * .05 : 0;
    gsap.set(el, { x: pos.x, y: pos.y - bob, autoAlpha: mode === "static" ? 1 : ramp(P, 0, .04) });
    // Poses: walking between steps, pointing at each step, cheering at the last
    const stopQ = ramp(P, STOP[i][0], STOP[i][1]);
    girl.set(pose ?? (moving ? "run" : i === 3 && stopQ > .45 ? "cheer" : P < STOP[0][0] ? "idle" : "point"), .08);
    const cheer = i === 3 ? ramp(stopQ, .45, .8) : 0;
    gsap.set(act, { y: -Math.sin(Math.PI * cheer) * gh * .3, rotation: moving ? 4 : 0 });
    girl.breath.paused(moving || mode === "static");

    // The glowing golden path draws behind her; sparkles trail her feet while she walks
    // (it reaches the last step while she cheers)
    const k = mode === "static" ? 1 : Math.max(clamp01((travelled - G.line.from) / G.line.len), ramp(P, .88, .98));
    gsap.set(line, v ? { scaleY: k, scaleX: 1 } : { scaleX: k, scaleY: 1 });
    trail.forEach((t, j) => gsap.set(t, {
      x: pos.x - (v ? 0 : (j + 1) * gh * .14), y: pos.y - (v ? (j + 1) * gh * .14 : 0) - gh * .02,
      opacity: moving ? (1 - j / trail.length) * (.5 + .5 * Math.sin(P * 300 + j)) : 0, scale: 1 - j * .1,
    }));

    // Each step: lit once she arrives (ring, number and text rise in); its moment plays while she stands there
    steps.forEach((s, n) => {
      const r = mode === "static" ? 1 : ramp(P, STOP[n][0] - .02, STOP[n][0] + .04);
      const q = mode === "static" ? 1 : ramp(P, STOP[n][0], STOP[n][1]);
      const a = Math.sin(Math.PI * q);
      gsap.set(texts[n], { opacity: r, y: (1 - r) * 14 });
      gsap.set(icons[n], { scale: 1 + .12 * a });
      gsap.set(part(n, ".st-ring"), { opacity: .55 * r + .45 * a });
      if (n === 0) {
        gsap.set(part(0, ".st-glow"), { opacity: .55 * r + .45 * a });
        part(0, ".st-spk").forEach((sp, j) => {
          const ang = -Math.PI * (.15 + .7 * j / 4), d = 34 * ramp(q, .1, .7, "power2.out");
          gsap.set(sp, { x: Math.cos(ang) * d, y: Math.sin(ang) * d, opacity: Math.sin(Math.PI * ramp(q, .1, .8)) });
        });
      } else if (n === 1) {
        const lift = Math.sin(Math.PI * q) - (q > .6 ? .2 * Math.sin(Math.PI * (q - .6) / .4) : 0);   // up, then back with a bounce
        gsap.set(svgOf(1), { opacity: 1 - Math.min(1, a * 3) });
        gsap.set($(".st-layers", icons[1]), { opacity: Math.min(1, a * 3) });
        $$(".st-layers svg", icons[1]).forEach((l, j) => gsap.set(l, { y: (j - 1) * 13 * lift }));
      } else if (n === 2) {
        gsap.set(svgOf(2), { scaleX: 1 - .3 * Math.abs(Math.sin(Math.PI * 2 * ramp(q, 0, .5))) });   // two snips
        const fly = ramp(q, .4, 1, "power1.out");
        gsap.set(part(2, ".st-film"), { x: 46 * fly, y: -30 * fly, rotation: 28 * fly, opacity: Math.sin(Math.PI * fly) });
      } else {
        const on = ramp(q, .35, .6);
        gsap.set(svgOf(3), { scale: 1 + .2 * Math.sin(Math.PI * ramp(q, 0, .35)), opacity: 1 - on });
        gsap.set(part(3, ".st-screen"), { opacity: on, scale: .6 + .4 * on });
        gsap.set(part(3, ".st-rays"), { opacity: ramp(q, .45, .75), rotation: P * 120 });
      }
    });
    // At step 04 a short golden shimmer sweeps the heading
    gsap.set($(".pt-shine i", heading), { xPercent: -100 + 450 * ramp(P, .9, 1), opacity: P > .9 && P < 1 ? 1 : 0 });
  }

  const redraw = () => { if (dead) return; G = null; if (!pan) draw(last, pose0); };
  let last = 1, pose0 = null, pan = 0;
  if (mode === "static") {
    pose0 = "wave";
    draw(1, "wave");
    // Measure again once web fonts and images have settled the layout
    document.fonts?.ready.then(redraw);
    addEventListener("load", redraw, { once: true });
    addEventListener("resize", redraw);
  } else {
    scrubbed(stack.st("process"), (p) => { last = p; if (!pan) draw(p); });
    ScrollTrigger.addEventListener("refresh", redraw);
    // The pan into the stats scene: she keeps walking right across the seam (statsGirl draws the other half)
    const tlRest = cached(() => restPos(tl));
    handoff.start = () => {
      if (!G) measure();
      const t = tlRest(), st = G.stops[3];
      return { x: t.x + st.x, y: t.y + st.y - stack.contentTravel("process") };
    };
    scrubbed(stack.rev("process"), (q) => {
      pan = q;
      if (!q) return draw(last);
      const a = handoff.start(), e = handoff.entry?.() ?? { x: innerWidth + 200, y: a.y };
      const sx = a.x + (e.x - a.x) * q, sy = a.y + (e.y - a.y) * q, t = tlRest();
      const bob = Math.abs(Math.sin(q * Math.PI * 9)) * girl.height() * .05;
      gsap.set(el, { x: sx + innerWidth * q - t.x, y: sy - (t.y - stack.contentTravel("process")) - bob, autoAlpha: 1 });
      gsap.set(act, { y: 0, rotation: 4 });
      girl.set("run", 0);
      girl.breath.paused(true);
      trail.forEach((tr) => gsap.set(tr, { opacity: 0 }));
    });
  }
  let dead = false;
  return () => {
    dead = true;
    removeEventListener("resize", redraw);
    removeEventListener("load", redraw);
    ScrollTrigger.removeEventListener("refresh", redraw);
    girl.destroy();
    added.forEach((e) => e.remove());
    gsap.set([line, ...texts.flat(), ...icons, ...icons.map((ic) => $(".ico", ic))], { clearProps: "all" });
  };
}

// ---- 07 Stats: she completes the number ----
// The RECENT VIDEOS count is shown without its last digit (30 → "3 _"); the missing digit lies on the ground below
// the stats. She walks in from the pan, is surprised, pulls it up with a rope into the gap, where it snaps in with a
// bounce and a gold shimmer; she cheers and waves. Built from the page's real count (128 → "12" + 8; a one-digit
// count: she brings the whole number). The full number stays in the text for screen readers and search engines.
function statsGirl(mode) {
  const sec = $(".stats-section");
  const dd = $(".stats .stat:first-child dd");
  const n = Number(dd?.dataset.count);
  if (mode === "static" || !stack || !sec || !(n >= 0) || n >= 1000) return null;   // (larger counts use a short form)
  const str = String(n), shown = str.slice(0, -1), last = str.slice(-1);
  delete dd.dataset.count;   // no count-up for this one
  dd.innerHTML = `<span class="sr-only">${str}</span><span aria-hidden="true">${shown}<span class="st-gap">${last}</span></span><span class="pt-shine" aria-hidden="true"><i></i></span>`;
  sec.classList.add("has-walk");
  sec.insertAdjacentHTML("beforeend", `<div class="st-walkway" aria-hidden="true"></div>
    <span class="st-digit" aria-hidden="true">${last}<span class="sd-gold">${last}</span></span>
    <svg class="st-rope" aria-hidden="true"><path class="r-base" fill="none" stroke="#c98d58"/><path class="r-twist" fill="none" stroke="#9a5d2c"/><path class="r-hi" fill="none" stroke="#f0cd9c" stroke-linecap="round"/></svg>`);
  const gap = $(".st-gap", dd), walkway = $(".st-walkway", sec), digit = $(".st-digit", sec), gold = $(".sd-gold", digit);
  const rope = $(".st-rope", sec), ropePaths = $$("path", rope), shine = $(".pt-shine i", dd);
  const girl = makeGirl(sec, "girl--stats", WORLD.stats);
  const { el, act } = girl;
  preloadAfter("about", WORLD.stats);

  // Layout (section coordinates): the gap, the ground she walks on, where the digit lies, where she stops to pull
  const M = cached(() => {
    const gh = girl.height(), w = sec.clientWidth;
    let gx = 0, gy = 0;
    for (let e = gap; e && e !== sec; e = e.offsetParent) { gx += e.offsetLeft; gy += e.offsetTop; }
    const stats = $(".stats", sec), first = $(".stat", stats);
    const one = getComputedStyle(stats).gridTemplateColumns.split(" ").length === 1;   // phones: room under the first stat
    // (both offsets are already from the section, which is their positioned parent)
    const below = one ? first.offsetTop + first.offsetHeight : stats.offsetTop + stats.offsetHeight;
    // (one column: inside the first stat's extra bottom padding, above its 24px rule gap; otherwise under the row)
    const ground = one ? below - 30 : below + gh * 1.38;
    walkway.style.top = `${ground - gh * 1.3}px`;
    walkway.style.height = `${gh * 1.3}px`;
    const dw = digit.offsetWidth, dh = digit.offsetHeight;
    const dx = Math.min(w - dw - 8, gx + w * (one ? .5 : .24)), stop = dx - gh * (one ? .8 : 1.05);
    return { gh, w, gx, gy, ground, dx, dy: ground - dh * .78, dw, dh, stop, enter: Math.max(0, gx - gh * .6) };
  });
  // Where she arrives from the pan (screen coordinates, scene unmoved)
  const secRest = cached(() => restPos(sec));
  handoff.entry = () => { const m = M(), r = secRest(); return { x: r.x + m.enter, y: r.y + m.ground }; };

  // The rope, like the HELLO intro's: from her hand (pull pose) to the digit, slack until it goes taut
  function drawRope(hx, hy, ex, ey, tight, on) {
    rope.style.opacity = on ? 1 : 0;
    if (!on) return;
    const len = Math.hypot(ex - hx, ey - hy), cx = (hx + ex) / 2, cy = (hy + ey) / 2 + len * (.02 + .24 * (1 - tight));
    const d = `M${hx.toFixed(1)} ${hy.toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
    const w = M().gh * .04;
    ropePaths.forEach((p) => p.setAttribute("d", d));
    ropePaths[0].setAttribute("stroke-width", w);
    ropePaths[1].setAttribute("stroke-width", w * .55);
    ropePaths[1].setAttribute("stroke-dasharray", `${(w * .45).toFixed(1)} ${(w * .75).toFixed(1)}`);
    ropePaths[2].setAttribute("stroke-width", w * .16);
  }

  let q = 0, P = 0;
  function draw() {
    const m = M(), gh = m.gh;
    // The pan: walking in across the seam from the process scene (the stats scene is still off to the right)
    if (q < 1) {
      const a = handoff.start?.() ?? { x: -200, y: secRest().y + m.ground }, e = handoff.entry(), r = secRest();
      const sx = a.x + (e.x - a.x) * q, sy = a.y + (e.y - a.y) * q;
      const bob = Math.abs(Math.sin(q * Math.PI * 9)) * gh * .05;
      gsap.set(el, { x: sx - innerWidth * (1 - q) - r.x, y: sy - r.y - bob, scaleX: 1 });
      gsap.set(act, { rotation: 4, y: 0, scaleX: 1, scaleY: 1 });
      girl.set("run", 0);
      girl.breath.paused(true);
      placeDigit(0);
      return drawRope(0, 0, 0, 0, 0, false);
    }
    const walk = ramp(P, 0, .26, "sine.inOut"), see = ramp(P, .26, .38), grab = ramp(P, .38, .48), fly = ramp(P, .48, .7, "power2.inOut");
    const snap = ramp(P, .7, .8), cheer = ramp(P, .8, .9), bye = ramp(P, .9, 1);
    // Where she is: walking from where the pan left her to her spot left of the digit
    const x = m.enter + (m.stop - m.enter) * walk;
    const moving = walk > 0 && walk < 1;
    const bob = moving ? Math.abs(Math.sin(walk * Math.PI * 6)) * gh * .05 : 0;
    gsap.set(el, { x, y: m.ground - bob - Math.sin(Math.PI * cheer) * gh * .3, scaleX: 1 });
    const pose = P < .26 ? (moving ? "run" : "idle") : P < .38 ? "surprised" : P < .72 ? "pull" : P < .9 ? "cheer" : "wave";
    girl.set(pose, 0);
    girl.breath.paused(pose === "run" || pose === "pull");
    // Surprised: a little jolt back; pulling: she leans back harder as the digit comes free
    const jolt = Math.sin(Math.PI * see);
    const lean = pose === "pull" ? -(6 + 10 * Math.sin(Math.PI * Math.min(1, fly * 1.4))) : 0;
    gsap.set(act, { x: -jolt * gh * .12, y: -jolt * gh * .12, rotation: pose === "surprised" ? -10 * jolt : lean, scaleX: 1, scaleY: 1 });
    placeDigit(fly, snap, grab);
    // Rope from her hand (the right edge of pull.webp, 40% down) to the digit while she pulls it
    if (pose === "pull") {
      const [w, h, fx] = GIRL.pull, Wp = gh * w / GIRL_H, Hp = gh * h / GIRL_H;
      const r = lean * Math.PI / 180, px = (1 - fx) * Wp - 1, py = -Hp * .596;
      const hx = x + px * Math.cos(r) - py * Math.sin(r), hy = m.ground + px * Math.sin(r) + py * Math.cos(r);
      const d = digitAt;
      drawRope(hx, hy, d.x + m.dw * .35, d.y + m.dh * .55, Math.min(1, grab * 1.6 + fly), true);
    } else drawRope(0, 0, 0, 0, 0, false);
    gsap.set(shine, { xPercent: -100 + 450 * snap, opacity: snap > 0 && snap < 1 ? 1 : 0 });
    gsap.set(girl.breathEl, { rotation: pose === "wave" ? Math.sin(bye * Math.PI * 6) * 6 : 0 });
  }
  // The digit: lying on the ground, wiggling on the taut rope, flying up in an arc into the gap, snapping in
  let digitAt = { x: 0, y: 0 };
  function placeDigit(fly, snap = 0, grab = 0) {
    const m = M();
    const k = fly, arc = Math.sin(Math.PI * k) * m.gh * 1.1;
    const x = m.dx + (m.gx - m.dx) * k, y = m.dy + (m.gy - m.dy) * k - arc;
    digitAt = { x, y };
    const wig = grab > 0 && fly === 0 ? Math.sin(grab * Math.PI * 6) * 8 : 0;
    const bounce = snap > 0 && snap < 1 ? Math.sin(Math.PI * snap) * .22 : 0;
    gsap.set(digit, { x, y, rotation: (1 - k) * -72 + wig + 360 * k * (k < 1 ? 1 : 0), scaleX: 1 + bounce, scaleY: 1 - bounce * .8 });
    gold.style.opacity = Math.sin(Math.PI * snap);
  }

  scrubbed(stack.rev("process"), (p) => { q = p; draw(); });
  // (the story plays before any tall stats content starts scrolling, so the gap stays on screen)
  scrubbed(stack.st("stats", 0, () => innerHeight * 1.2), (p) => { P = p; if (q >= 1) draw(); });
  const redraw = () => draw();
  ScrollTrigger.addEventListener("refresh", redraw);
  return () => {
    ScrollTrigger.removeEventListener("refresh", redraw);
    handoff.entry = null;
    girl.destroy();
    [walkway, digit, rope].forEach((e) => e.remove());
    sec.classList.remove("has-walk");
    dd.dataset.count = str;
    dd.textContent = str;
  };
}

// ---- 08 Contact: she peeks in from the side as the page arrives and waves goodbye ----
function contactGirl(mode) {
  const host = $("footer");
  if (mode === "static" || !stack) return staticGirl(host, "girl--contact", ["wave"], "wave");
  const girl = makeGirl(host, "girl--contact", WORLD.contact);
  const { el, breathEl } = girl;
  preloadAfter("stats", WORLD.contact);
  scrubbed(stack.rev("stats"), (p) => {
    gsap.set(el, { x: (1 - ramp(p, .2, 1, "power2.out")) * innerWidth * .3 });
    girl.set(p < .8 ? "idle" : "wave", .1);
  });
  scrubbed(stack.st("contact"), (p) => gsap.set(breathEl, { rotation: Math.sin(p * Math.PI * 8) * 6 }));
  return () => girl.destroy();
}

// ---- Time: a small clock in the corner; the minute hand ticks one lap per section ----
function timeDial() {
  const dial = document.createElement("div");
  dial.className = "time-dial";
  dial.setAttribute("aria-hidden", "true");
  dial.innerHTML = '<i class="td-h"></i><i class="td-m"></i>';
  document.body.append(dial);
  const laps = $$("[data-section]").length;
  const mTo = gsap.quickTo($(".td-m", dial), "rotation", { duration: .35, ease: "back.out(3)" });
  const hTo = gsap.quickTo($(".td-h", dial), "rotation", { duration: .8, ease: "power2.out" });
  const st = ScrollTrigger.create({
    ...(stack ? { start: () => stack.top("home") - stack.R() * .5, end: "max" } : { trigger: "#main", start: "top 40%", end: "bottom bottom" }),
    onUpdate: (self) => { mTo(Math.round(self.progress * laps * 12) * 30); hTo(self.progress * 360); },
    onToggle: (self) => gsap.to(dial, { opacity: self.isActive ? .9 : 0, duration: .4 }),
  });
  return () => { st.kill(); dial.remove(); };
}

// ---- 03 (mobile) Music: slow cinematic fades instead of the fly-over ----
function musicFlat() {
  const cards = $$(".mcard");
  gsap.set(cards, { opacity: 0 });
  ScrollTrigger.batch(cards, {
    start: stack ? (self) => stack.at(self.trigger, .92) : "top 92%",
    onEnter: (batch) => gsap.to(batch, { opacity: 1, duration: 1.6, ease: "power2.out", stagger: .18, overwrite: true }),
  });
  gsap.from(".music-head > *", { opacity: 0, duration: 1.6, stagger: .2, scrollTrigger: trig(".music-section", "top 75%") });
}

// ---- 02 (mobile) Featured: cards fade up as the row comes in ----
function ringFlat() {
  gsap.from(".ring .project", { opacity: 0, y: 24, duration: .8, ease: "power3.out", stagger: .06, scrollTrigger: trig(".ring", "top 90%") });
}

// ---- 05–08: about, process timeline, stats, contact ----
function lowerMotion(desk) {
  // About: the brush strokes paint in, the portrait frame rises and settles, the signature writes itself; the label,
  // paragraph, rule, stats (which count up, see counters) and button follow (the heading's word reveal is
  // headingReveals'). Plays as the scene arrives, backwards if you scroll back out. Then a gentle parallax on the art.
  if ($(".ab-art")) {
    gsap.timeline({ scrollTrigger: { ...trig(".about-section", "top 75%"), toggleActions: "play none none reverse" } })
      .fromTo(".ab-paint", { "--paint": "0%" }, { "--paint": "135%", duration: 1.5, ease: "power2.inOut" }, 0)
      .from(".ab-frame", { y: 70, opacity: 0, duration: 1.1, ease: "back.out(1.5)" }, .25)
      .fromTo(".ab-sign", { clipPath: "inset(71.06% 97.3% 11.65% 2.7%)" }, { clipPath: "inset(71.06% 64.36% 11.65% 2.7%)", duration: 1.3, ease: "power1.inOut" }, 1.05)
      .from(".ab-label", { opacity: 0, x: -20, duration: .7, ease: "power3.out" }, .2)
      .from(".about-copy > p", { opacity: 0, y: 24, duration: .8, ease: "power3.out" }, .55)
      .from(".ab-rule", { scaleX: 0, transformOrigin: "0 50%", duration: .8, ease: "power3.out" }, .75)
      .from(".about-stats > div", { opacity: 0, y: 20, duration: .7, ease: "power3.out", stagger: .12 }, .85)
      .from(".ab-btn", { scale: 0, opacity: 0, duration: .9, ease: "elastic.out(1, .5)" }, 1.15);
    gsap.fromTo(".ab-art", { y: 22 }, { y: -22, ease: "none", scrollTrigger: { ...(stack ? stack.span("about") : { trigger: ".about-section", start: "top bottom", end: "bottom top" }), scrub: true } });
  }

  // Process: the line draws as you scroll and each step pops in when the line reaches it
  // (in the scene stack the girl walks the timeline instead: processGirl)
  if (!stack) {
    const vertical = matchMedia("(max-width: 900px)").matches;
    const steps = $$(".timeline .step");
    gsap.set(steps, { opacity: 0, y: 24, scale: .85 });
    const shown = steps.map(() => false);
    const pop = (i) => { shown[i] = true; gsap.to(steps[i], { opacity: 1, y: 0, scale: 1, duration: .7, ease: "back.out(2)", overwrite: true }); };
    gsap.fromTo(".tl-line i", vertical ? { scaleY: 0 } : { scaleX: 0 }, {
      ...(vertical ? { scaleY: 1 } : { scaleX: 1 }), ease: "none",
      scrollTrigger: {
        trigger: ".timeline", start: "top 78%", end: vertical ? "bottom 60%" : "bottom 50%", scrub: .6,
        // Step i sits at i/(n-1) along the line; show it once the drawn line gets there
        onUpdate: (self) => steps.forEach((s, i) => { if (!shown[i] && self.progress >= i / (steps.length - 1) - .02) pop(i); }),
        onLeave: () => steps.forEach((s, i) => !shown[i] && pop(i)),
      },
    });
  }

  gsap.from(".stat", { opacity: 0, y: 30, duration: .9, ease: "power3.out", stagger: .1, scrollTrigger: trig(".stats", "top 88%") });
  gsap.from(".foot > *", { opacity: 0, y: 24, duration: 1, ease: "power3.out", stagger: .12, scrollTrigger: trig("footer", "top 90%") });
}

// ---- Counting-up stats ----
function counters() {
  $$("[data-count]").forEach((el) => {
    const end = Number(el.dataset.count);
    const obj = { n: 0 };
    el.textContent = "0";
    gsap.to(obj, {
      n: end, duration: 2.2, ease: "power2.out",
      scrollTrigger: trig(el, "top 92%"),
      onUpdate: () => { el.textContent = end >= 1000 ? fmtCompact.format(Math.round(obj.n)) : Math.round(obj.n); },
    });
  });
}

// ---- Pointer details (desktop mouse only): 3D tilt on every thumbnail + magnetic buttons ----
function pointerDetails() {
  const off = [];
  const on = (el, type, fn) => { el.addEventListener(type, fn); off.push(() => el.removeEventListener(type, fn)); };

  $$(".hero-card, .ring-card, .mcard, .kcard, .kpick, .tv-body").forEach((el) => {
    const kids = el.classList.contains("kcard") || el.classList.contains("kpick") || el.classList.contains("tv-body");
    const max = kids ? 14 : 8;
    const ease = kids ? "elastic.out(1, .45)" : "power3";
    const rx = gsap.quickTo(el, "rotationX", { duration: kids ? .9 : .5, ease });
    const ry = gsap.quickTo(el, "rotationY", { duration: kids ? .9 : .5, ease });
    gsap.set(el, { transformPerspective: 800 });
    on(el, "mousemove", (e) => {
      const r = el.getBoundingClientRect();
      ry(((e.clientX - r.left) / r.width - .5) * max * 2);
      rx((.5 - (e.clientY - r.top) / r.height) * max * 2);
    });
    on(el, "mouseleave", () => { rx(0); ry(0); });
  });

  $$("[data-magnetic], .filter").forEach((el) => {
    const xTo = gsap.quickTo(el, "x", { duration: .6, ease: "elastic.out(1, .4)" });
    const yTo = gsap.quickTo(el, "y", { duration: .6, ease: "elastic.out(1, .4)" });
    const clamp = gsap.utils.clamp(-12, 12);
    on(el, "mousemove", (e) => {
      const r = el.getBoundingClientRect();
      xTo(clamp((e.clientX - r.left - r.width / 2) * .3));
      yTo(clamp((e.clientY - r.top - r.height / 2) * .3));
    });
    on(el, "mouseleave", () => { xTo(0); yTo(0); });
  });
  return () => off.forEach((fn) => fn());
}

// ---- Motion setup per breakpoint ----
// Skip motion in Opera Mini: its scroll triggers never fire, so cards waiting to pop in would stay hidden
if (window.gsap && window.ScrollTrigger && !proxyBrowser) {
  gsap.registerPlugin(...[ScrollTrigger, window.SplitText, window.MotionPathPlugin, window.CustomEase, window.CustomBounce, window.CustomWiggle, window.InertiaPlugin].filter(Boolean));
  // The girl's eases: bounces with a squash at each landing, wobbles for waves and startles, a wind-up before she runs
  if (window.CustomBounce) {
    CustomBounce.create("girlLand", { strength: .45, squash: 2.2, squashID: "girlLand-squash" });
    CustomBounce.create("letterDrop", { strength: .5, squash: 1.6, squashID: "letterDrop-squash" });
    CustomWiggle.create("girlWave", { wiggles: 5, type: "easeOut" });
    CustomWiggle.create("girlStartle", { wiggles: 4, type: "easeOut" });
    CustomEase.create("windUp", "M0,0 C0.18,-0.2 0.32,-0.18 0.48,0.16 0.64,0.54 0.8,1 1,1");
    // A float down: eases in, then slows right down near the ground
    CustomEase.create("girlFloat", "M0,0 C0.18,0.08 0.38,0.62 0.62,0.84 0.8,0.96 0.92,1 1,1");
  }
  ScrollTrigger.addEventListener("refreshInit", () => layoutEpoch++);
  addEventListener("resize", () => layoutEpoch++);
  $$("[data-words]").forEach(splitWords);
  // Kids title splits into single letters for the bounce
  $$("[data-letters]").forEach((el) => {
    const text = el.textContent;
    const letters = [...text].map((ch) => (ch === " " ? " " : `<span class="kl">${esc(ch)}</span>`)).join("");
    el.innerHTML = `<span class="sr-only">${esc(text)}</span><span aria-hidden="true">${letters}</span>`;
  });

  // Phones: the address bar showing/hiding resizes the viewport; don't re-layout pinned scenes for that
  ScrollTrigger.config({ ignoreMobileResize: true });
  const mm = gsap.matchMedia();
  mm.add({
    // 3D on every screen tall enough for it, phones included; only very short windows (phones in landscape) go flat
    desk: "(min-height: 420px) and (prefers-reduced-motion: no-preference)",
    flat: "(max-height: 419px) and (prefers-reduced-motion: no-preference)",
    reduce: "(prefers-reduced-motion: reduce)",
  }, (ctx) => {
    const cleanups = [];
    root.classList.add("hero-3d");
    if (ctx.conditions.reduce) {
      // Reduced motion: the hero ring is shown standing still; nothing else animates
      cleanups.push(introStory("static"));
      cleanups.push(heroRing("static"));
      cleanups.push(homeGirl("static"), musicGirl("static"), kidsGirl("static"), processGirl("static"), contactGirl("static"));
      return () => { cleanups.forEach((fn) => fn?.()); root.classList.remove("hero-3d"); };
    }
    // The intro pins first, so every later trigger is measured below it
    if (ctx.conditions.desk) {
      root.classList.add("is-3d");
      const smooth = initLenis();
      if (smooth) { lenis = smooth.lenis; cleanups.push(() => { smooth.destroy(); lenis = null; }); }
      cleanups.push(sceneStack(true));
      cleanups.push(introStory("motion"));
      cleanups.push(heroRing("desk"));
      cleanups.push(ring3D());
      flyOver();
      if (finePointer) cleanups.push(pointerDetails());
    } else {
      // Short landscape windows: the same scene stack, with a smaller hero ring that circles on its own and light fades
      cleanups.push(sceneStack(false));
      cleanups.push(introStory("motion"));
      cleanups.push(heroRing("mobile"));
      ringFlat();
      musicFlat();
    }
    const desk = !!ctx.conditions.desk;
    headingReveals(desk);
    cleanups.push(kidsMotion(desk));
    cleanups.push(kidsJungle(desk));
    cleanups.push(homeGirl("motion"), musicGirl("motion"), kidsGirl("motion"), processGirl("motion"), statsGirl("motion"), contactGirl("motion"));
    cleanups.push(timeDial());
    lowerMotion(desk);
    counters();
    addEventListener("load", () => ScrollTrigger.refresh(), { once: true });
    return () => { cleanups.forEach((fn) => fn?.()); root.classList.remove("is-3d", "hero-3d"); };
  });
}
