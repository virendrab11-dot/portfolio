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
  $("#about-stats").innerHTML = [["Total videos", all.length], ["Total views", sum(all)]].map(([label, n]) =>
    `<div><dt>${label}</dt><dd data-count="${n}">${n >= 1000 ? fmtCompact.format(n) : n}</dd></div>`).join("");
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
    const R = small ? Math.min(innerWidth * .34, 150) : Math.min(innerWidth * .17, innerHeight * .34, 300);
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
  const scaleTo = cards.map((c) => gsap.quickTo(c, "scale", { duration: .45, ease: "power3" }));
  let front = -1;

  function render() {
    const z = A.z + D.z;
    gsap.set(camera, { z, rotationX: A.tilt, scale: A.scale });
    gsap.set(world, { rotation: A.orbit });
    holders.forEach((h) => gsap.set(h, { rotation: -A.orbit, rotationX: -A.tilt }));
    // The name block follows the camera's depth so it sits on the ring centre at every distance
    gsap.set(center, { scale: Math.max(.15, A.scale * P / (P - Math.min(z, P - 60))) });

    // Fade cards behind the name block; enlarge the front-most clear card and show its title
    // (on phones the tagline and buttons sit below the ring, so only the name counts)
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
      holders.forEach((h, i) => { h.classList.toggle("is-front", i === best); scaleTo[i](i === best ? 1.14 : 1); });
      front = best;
    }
  }

  const reveal = [".hero-tag", ".hero-btns > *", ".scroll-ind > *"];
  const onResize = () => { layout(); render(); };
  addEventListener("resize", onResize);
  // Re-measure once fonts and images have settled (the overlap check depends on real sizes)
  document.fonts?.ready.then(render);
  addEventListener("load", render, { once: true });
  let orbit = null;

  if (mode === "static") {
    render();
    return () => { removeEventListener("resize", onResize); unwrapHero(holders, shadows, all); };
  }

  // Drone shot: from high above (looking almost straight down) swoop low while orbiting a full 360°
  gsap.set(reveal, { opacity: 0, y: 14 });
  const intro = gsap.timeline({ onUpdate: render, onComplete: startOrbit })
    .to(A, { tilt: 58, z: 0, scale: 1, duration: 2.6, ease: "power3.inOut" }, .2)
    .to(A, { orbit: 280, duration: 4.6, ease: "sine.inOut" }, .2);
  gsap.from(".hero-bg img", { opacity: 0, duration: 1.6, ease: "power2.out" });
  // Very slow Ken Burns zoom on the background (scale only; the fade above owns opacity)
  const kenBurns = gsap.fromTo(".hero-bg img", { scale: 1 }, { scale: 1.08, duration: 20, ease: "sine.inOut", repeat: -1, yoyo: true });
  // Phones: gentle parallax as the hero scrolls away (desktop parallax is part of the dolly below)
  if (mode === "mobile") gsap.to(".hero-bg", { yPercent: 12, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "bottom top", scrub: true } });
  gsap.from(".hero-name span", { opacity: 0, y: 30, duration: 1.2, ease: "power3.out", stagger: .15, delay: .4 });
  if (mode === "desk") {
    gsap.from(".hero-copy .eyebrow, .hero-copy p, .playrow, .hero-count, .hero-note", { opacity: 0, y: 20, duration: 1, ease: "power3.out", stagger: .08, delay: .5 });
    wordReveal($(".hero-copy h1"), { delay: .3, stagger: .12 });
  } else {
    wordReveal($(".hero-copy h1"), { rotationX: 0, delay: .15 });
    gsap.from(".hero-copy .eyebrow, .hero-copy p, .playrow", { opacity: 0, y: 16, duration: .8, stagger: .08, delay: .3 });
  }

  // After the drone shot: tagline, buttons and scroll cue fade in, and the ring keeps slowly circling
  function startOrbit() {
    gsap.to(reveal, { opacity: 1, y: 0, duration: .9, ease: "power3.out", stagger: .12 });
    orbit = gsap.to(A, { orbit: "+=360", duration: 70, ease: "none", repeat: -1, onUpdate: render });
  }
  // Hovering a card or the name pauses the orbit
  const pause = () => orbit && gsap.to(orbit, { timeScale: 0, duration: .6, overwrite: true });
  const resume = () => orbit && gsap.to(orbit, { timeScale: 1, duration: .8, overwrite: true });
  [...cards, center].forEach((el) => { el.addEventListener("mouseenter", pause); el.addEventListener("mouseleave", resume); });

  // Desktop: scrolling dollies the camera forward into the page
  if (mode === "desk") {
    gsap.timeline({
      defaults: { ease: "none" },
      scrollTrigger: { trigger: ".hero", start: "top top", end: "+=140%", pin: ".hero-pin", scrub: 1, anticipatePin: 1 },
      onUpdate: render,
    })
      .to(".hero-copy", { opacity: 0, x: -80, duration: .3 }, 0)
      .to(".hero-side, .scroll-ind", { opacity: 0, duration: .2 }, 0)
      .to(D, { z: 900, duration: 1, ease: "power2.in" }, 0)
      .to(center, { opacity: 0, duration: .35 }, .45)
      .to(".hero-bg", { yPercent: 10, duration: .5 }, 0)                                // slight parallax
      .to(".hero-bg", { scale: 1.4, opacity: 0, duration: .6, ease: "power2.in" }, .4)
      .to(".hero-fade", { opacity: 1, duration: .2 }, .8);
  }

  return () => {
    intro.kill();
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

  function build() {
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
  }

  // Bring card i to the front (used by keyboard focus and arrow keys)
  function goTo(i) {
    const target = -i * step;
    let delta = ((target - angle()) % 360 + 540) % 360 - 180;
    gsap.to(st, { drag: st.drag + delta, duration: .8, ease: "power3.out", onUpdate: render, overwrite: true });
  }

  // Scroll drives the ring
  gsap.to(st, {
    p: 1, ease: "none", onUpdate: render,
    // Pin the whole section so the filters stay usable while the ring turns
    scrollTrigger: { trigger: ".work-section", start: "top top", end: "+=220%", pin: true, scrub: 1, anticipatePin: 1 },
  });

  // Drag to rotate (desktop pointer), with a little inertia and snap to the nearest card
  let startX = 0, startDrag = 0, lastX = 0, lastT = 0, vel = 0, moved = false;
  const onDown = (e) => {
    if (e.pointerType !== "mouse" && e.pointerType !== "pen") return;
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
    build();
    gsap.fromTo(stage, { opacity: 0, scale: .9 }, { opacity: 1, scale: 1, duration: .7, ease: "back.out(1.4)", overwrite: true });
  };

  build();
  gsap.from(stage, {
    opacity: 0, y: 90, duration: 1.2, ease: "power3.out",
    scrollTrigger: { trigger: ".work-section", start: "top 75%" },
  });
  gsap.from(".work-head > *", {
    opacity: 0, y: 16, duration: .8, ease: "power3.out", stagger: .1,
    scrollTrigger: { trigger: ".work-head", start: "top 88%" },
  });

  return () => {
    stage.removeEventListener("pointerdown", onDown);
    stage.removeEventListener("pointermove", onMove);
    stage.removeEventListener("pointerup", onUp);
    stage.removeEventListener("pointercancel", onUp);
    stage.removeEventListener("keydown", onKey);
    onRingRebuilt = () => {};
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

  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: { trigger: ".music-section", start: "top top", end: "+=230%", pin: ".fly-pin", scrub: 1.8, anticipatePin: 1 },
  });
  // The camera glides forward across the landscape (set back from the lens), drifting a little like a drone.
  // Travel ends with the last row (Shorts) framed in the middle of the screen.
  tl.fromTo(plane,
    { xPercent: -50, x: -30, z: () => flyDepth(), y: () => innerHeight * .3, rotationX: 60, rotationZ: -5 },
    { xPercent: -50, x: 30, z: () => flyDepth(), y: () => -(plane.offsetHeight - innerHeight * .5), rotationX: 50, rotationZ: 4, duration: 1 }, 0)
    // Cards surface slowly out of the dark as the camera reaches them
    .to(cards, { opacity: 1, duration: .24, ease: "power1.out", stagger: .6 / Math.max(cards.length, 1) }, 0);

  // Heading: slow cinematic fade (separate trigger; the scrubbed timeline never touches it)
  gsap.from(".music-head .section-head .num, .music-head .section-title, .music-sub, .music-head .pill", {
    opacity: 0, y: 24, duration: 1.8, ease: "power2.out", stagger: .2,
    scrollTrigger: { trigger: ".music-section", start: "top 65%" },
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
      scrollTrigger: { trigger: el, start: "top 88%" },
    });
  });
}

// ---- 04 Kids: jumping title, bouncing TV, popping picks, bouncy row, living decorations ----
// Each element has one owner per property: entry tweens use y/scale/opacity, hover wobbles use rotation,
// pointer tilt uses rotationX/Y, and the static sticker angles are the CSS `rotate` property.
function kidsMotion(desk) {
  const trig = (el, start = "top 85%") => ({ trigger: el, start });
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
  gsap.from("#kids-tv", { y: -160, opacity: 0, duration: 1.3, ease: "bounce.out", scrollTrigger: trig(".kids-stage", "top 80%") });
  gsap.from(".tv-caption > *", { opacity: 0, y: 20, duration: .7, ease: "back.out(2)", stagger: .08, delay: .5, scrollTrigger: trig(".kids-stage", "top 80%") });
  gsap.to(".tv-play", { scale: 1.1, duration: .9, ease: "sine.inOut", repeat: -1, yoyo: true });
  const wiggle = () => gsap.fromTo(".tv-antenna i", { rotation: 0 }, { keyframes: { rotation: [12, -10, 7, -4, 0] }, duration: .9, ease: "power1.inOut", stagger: .08, overwrite: "auto" });
  on($("#kids-tv"), "mouseenter", wiggle);
  if (desk) gsap.to(".knob", { rotation: 300, ease: "none", scrollTrigger: { trigger: ".kids-stage", start: "top bottom", end: "bottom top", scrub: true } });

  // Picks pop in one by one
  gsap.from("#kids-picks .kpick", { scale: 0, opacity: 0, duration: .8, ease: "back.out(2.2)", stagger: .14, delay: .35, scrollTrigger: trig(".kids-stage", "top 80%") });
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
    start: "top 95%",
    onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, scale: 1, rotation: 0, duration: 1.2, ease: "elastic.out(1, .5)", stagger: .06, overwrite: true }),
  });
  kidsFilterFx = (shown) => gsap.fromTo(shown, { opacity: 0, y: 30, scale: .6 }, { opacity: 1, y: 0, scale: 1, rotation: 0, duration: .9, ease: "elastic.out(1, .55)", stagger: .04, overwrite: true });

  // Decorations: circles float with parallax, clouds drift across, stars twinkle and turn
  $$(".kids-confetti i").forEach((el, i) => {
    if (desk) gsap.to(el, { y: (i % 2 ? -1 : 1) * (50 + (i % 5) * 28), ease: "none", scrollTrigger: { trigger: ".kids-section", start: "top bottom", end: "bottom top", scrub: true } });
    gsap.to(el, { x: gsap.utils.random(-20, 20), scale: gsap.utils.random(.85, 1.15), duration: gsap.utils.random(2.4, 4), ease: "sine.inOut", repeat: -1, yoyo: true });
  });
  gsap.to(".dd-cloud", { x: () => innerWidth * .18, duration: 16, ease: "sine.inOut", repeat: -1, yoyo: true });
  gsap.to(".dd-cloud2", { x: () => -innerWidth * .14, duration: 20, ease: "sine.inOut", repeat: -1, yoyo: true });
  gsap.to(".dd-star, .dd-star2", { rotation: 360, duration: 9, ease: "none", repeat: -1 });
  gsap.to(".dd-star, .dd-star2", { scale: 1.35, opacity: .55, duration: .9, ease: "sine.inOut", repeat: -1, yoyo: true, stagger: .45 });
  gsap.to(".dd-note, .dd-heart", { y: -16, rotation: 12, duration: 2.2, ease: "sine.inOut", repeat: -1, yoyo: true, stagger: .6 });

  return () => { kidsFilterFx = null; kidsSwapFx = null; off.forEach((fn) => fn()); };
}

// ---- 03 (mobile) Music: slow cinematic fades instead of the fly-over ----
function musicFlat() {
  const cards = $$(".mcard");
  gsap.set(cards, { opacity: 0 });
  ScrollTrigger.batch(cards, {
    start: "top 92%",
    onEnter: (batch) => gsap.to(batch, { opacity: 1, duration: 1.6, ease: "power2.out", stagger: .18, overwrite: true }),
  });
  gsap.from(".music-head > *", { opacity: 0, duration: 1.6, stagger: .2, scrollTrigger: { trigger: ".music-section", start: "top 75%" } });
}

// ---- 02 (mobile) Featured: cards fade up as the row comes in ----
function ringFlat() {
  gsap.from(".ring .project", { opacity: 0, y: 24, duration: .8, ease: "power3.out", stagger: .06, scrollTrigger: { trigger: ".ring", start: "top 90%" } });
}

// ---- 05–08: about, process timeline, stats, contact ----
function lowerMotion(desk) {
  // About: photo rises in and drifts slowly (parallax inside its frame), copy follows
  gsap.from(".about-photo", { opacity: 0, y: 50, duration: 1.2, ease: "power3.out", scrollTrigger: { trigger: ".about-section", start: "top 80%" } });
  gsap.fromTo(".about-photo img", { yPercent: -14 }, { yPercent: 0, ease: "none", scrollTrigger: { trigger: ".about-photo", start: "top bottom", end: "bottom top", scrub: true } });
  gsap.from(".about-copy > .section-title, .about-copy > p, .about-stats > div, .about-copy > .pill", {
    opacity: 0, y: 24, duration: .9, ease: "power3.out", stagger: .1, scrollTrigger: { trigger: ".about-copy", start: "top 80%" },
  });

  // Process: the line draws as you scroll and each step pops in when the line reaches it
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

  gsap.from(".stat", { opacity: 0, y: 30, duration: .9, ease: "power3.out", stagger: .1, scrollTrigger: { trigger: ".stats", start: "top 88%" } });
  gsap.from(".foot > *", { opacity: 0, y: 24, duration: 1, ease: "power3.out", stagger: .12, scrollTrigger: { trigger: "footer", start: "top 90%" } });
}

// ---- Counting-up stats ----
function counters() {
  $$("[data-count]").forEach((el) => {
    const end = Number(el.dataset.count);
    const obj = { n: 0 };
    el.textContent = "0";
    gsap.to(obj, {
      n: end, duration: 2.2, ease: "power2.out",
      scrollTrigger: { trigger: el, start: "top 92%" },
      onUpdate: () => { el.textContent = end >= 1000 ? fmtCompact.format(Math.round(obj.n)) : Math.round(obj.n); },
    });
  });
}

// ---- Pointer details (desktop mouse only): 3D tilt on every thumbnail + magnetic buttons ----
function pointerDetails() {
  const off = [];
  const on = (el, type, fn) => { el.addEventListener(type, fn); off.push(() => el.removeEventListener(type, fn)); };

  $$(".hero-card, .ring-card, .mcard, .kcard, .kpick, .tv-body, .about-photo").forEach((el) => {
    const kids = el.classList.contains("kcard") || el.classList.contains("kpick") || el.classList.contains("tv-body");
    const max = kids ? 14 : el.classList.contains("about-photo") ? 4 : 8;
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
  gsap.registerPlugin(ScrollTrigger);
  $$("[data-words]").forEach(splitWords);
  // Kids title splits into single letters for the bounce
  $$("[data-letters]").forEach((el) => {
    const text = el.textContent;
    const letters = [...text].map((ch) => (ch === " " ? " " : `<span class="kl">${esc(ch)}</span>`)).join("");
    el.innerHTML = `<span class="sr-only">${esc(text)}</span><span aria-hidden="true">${letters}</span>`;
  });

  const mm = gsap.matchMedia();
  mm.add({
    // 3D works down to small laptop windows (e.g. 1920x1080 at 150% scaling ≈ 1280x560 inside the browser)
    desk: "(min-width: 900px) and (min-height: 420px) and (prefers-reduced-motion: no-preference)",
    flat: "(max-width: 899px) and (prefers-reduced-motion: no-preference), (max-height: 419px) and (prefers-reduced-motion: no-preference)",
    reduce: "(prefers-reduced-motion: reduce)",
  }, (ctx) => {
    const cleanups = [];
    root.classList.add("hero-3d");
    if (ctx.conditions.reduce) {
      // Reduced motion: the hero ring is shown standing still; nothing else animates
      cleanups.push(heroRing("static"));
      return () => { cleanups.forEach((fn) => fn?.()); root.classList.remove("hero-3d"); };
    }
    if (ctx.conditions.desk) {
      root.classList.add("is-3d");
      const smooth = initLenis();
      if (smooth) { lenis = smooth.lenis; cleanups.push(() => { smooth.destroy(); lenis = null; }); }
      cleanups.push(heroRing("desk"));
      cleanups.push(ring3D());
      flyOver();
      if (finePointer) cleanups.push(pointerDetails());
    } else {
      // Phone version: smaller hero ring that circles on its own, no pinning, light fades elsewhere
      cleanups.push(heroRing("mobile"));
      ringFlat();
      musicFlat();
    }
    const desk = !!ctx.conditions.desk;
    headingReveals(desk);
    cleanups.push(kidsMotion(desk));
    lowerMotion(desk);
    counters();
    addEventListener("load", () => ScrollTrigger.refresh(), { once: true });
    return () => { cleanups.forEach((fn) => fn?.()); root.classList.remove("is-3d", "hero-3d"); };
  });
}
