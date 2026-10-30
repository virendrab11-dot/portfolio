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
  const pickFrom = (key, n) => [...long(key), ...videosOf(key).filter((v) => v.isShort).sort(byViews)].slice(0, n);
  const cards = [];
  const m = pickFrom("music", 4);
  const k = pickFrom("kids", 4);
  for (let i = 0; i < 4; i++) { if (m[i]) cards.push(m[i]); if (k[i]) cards.push(k[i]); }
  $("#hero-cards").innerHTML = cards.map((v, i) =>
    `<button class="hero-card hc${i}" ${playAttrs(v)} tabindex="-1">${img(v, { big: true, lazy: false })}</button>`).join("");
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

function kcard(v) {
  return `<button class="kcard ${v.isShort ? "short" : ""}" ${playAttrs(v)} data-tilt>
      <span class="kthumb">${img(v, { big: !v.isShort })}<span class="kplay" aria-hidden="true"><svg class="ico"><use href="#i-play"/></svg></span></span>
      <span class="kinfo"><span class="h3">${esc(shortName(v))}</span><small>${metaLine(v)}</small></span>
    </button>`;
}

function renderChannels() {
  const empty = `<p class="empty">No videos loaded yet. Run <code>python fetch_videos.py</code> in the portfolio folder.</p>`;
  const music = videosOf("music");
  const kids = videosOf("kids");
  $("#music-videos").innerHTML = music.filter((v) => !v.isShort).map(mcard).join("") || empty;
  $("#music-shorts").innerHTML = music.filter((v) => v.isShort).map(mcard).join("");
  $("#kids-videos").innerHTML = kids.filter((v) => !v.isShort).map(kcard).join("") || empty;
  $("#kids-shorts").innerHTML = kids.filter((v) => v.isShort).map(kcard).join("");
  ["music", "kids"].forEach((key) => {
    const ch = data?.channels?.[key];
    if (ch?.subscribeUrl) $(`[data-subscribe="${key}"]`).href = ch.subscribeUrl;
  });
}

function renderStats() {
  const sum = (list) => list.reduce((s, v) => s + (v.views ?? 0), 0);
  const all = allVideos();
  if (!all.length) return $("#stats").remove();
  const rows = [
    ["Recent videos", all.length],
    ["Total views", sum(all), "gold"],
    ["Music & Travel views", sum(videosOf("music"))],
    ["Kids Cartoons views", sum(videosOf("kids"))],
  ];
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

function openPlayer(el) {
  lastFocus = el;
  const { id, short, title, url } = el.dataset;
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
    if (!a) return;
    const target = $(a.getAttribute("href"));
    if (!target) return;
    e.preventDefault();
    l.scrollTo(target, { duration: 1.6 });
  };
  document.addEventListener("click", onAnchor);
  return { lenis: l, destroy: () => { gsap.ticker.remove(tick); document.removeEventListener("click", onAnchor); l.destroy(); } };
}

// ---- 01 Hero: drone camera ----
// Camera = .hero-camera (height, tilt, dolly); world = .hero-world (orbit around the plane's normal).
// Name and cards counter-rotate so they always face the lens while the ground turns beneath them.
function heroDrone() {
  const camera = $(".hero-camera");
  const world = $(".hero-world");
  const name = $(".hero-name");
  const cards = $$(".hero-card");
  const vmin = Math.min(innerWidth, innerHeight) / 100;

  // Wrap each card in a positioned holder and drop a shadow on the ground under it
  const holders = cards.map((card, i) => {
    const pos = document.createElement("div");
    pos.className = "hc-pos";
    card.replaceWith(pos);
    pos.append(card);
    const a = (i / cards.length) * Math.PI * 2 + Math.PI / 8;
    const r = (i % 2 ? 44 : 36) * vmin;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    const z = (8 + (i % 3) * 7) * vmin;
    const shadow = document.createElement("div");
    shadow.className = "hc-shadow";
    gsap.set(shadow, { x, y });
    world.append(shadow);
    // Stand each card on its bottom edge so lifting it never pushes it through the ground
    gsap.set(pos, { x, y, z, xPercent: -50, yPercent: -100, transformOrigin: "50% 100%" });
    // Gentle hover-in-place bob on the card itself
    gsap.to(card, { y: -1.4 * vmin, duration: 2.4 + (i % 3) * .5, ease: "sine.inOut", repeat: -1, yoyo: true, delay: i * .2 });
    return pos;
  });
  gsap.set(name, { xPercent: -50, yPercent: -100, z: 1, transformOrigin: "50% 100%" });

  // Scroll state (scrubbed) + intro offset (played once on load); render() combines both
  // x starts right of centre so the scene sits beside the headline, then glides to centre
  const S = { tilt: 30, orbit: -24, z: -140, scale: .8, x: 15 };
  const I = { tilt: -22, orbit: -50, z: -500, scale: -.25 };
  const render = () => {
    const tilt = S.tilt + I.tilt;
    const orbit = S.orbit + I.orbit;
    gsap.set(camera, { x: S.x * innerWidth / 100, z: S.z + I.z, rotationX: tilt, scale: S.scale + I.scale });
    gsap.set(world, { rotation: orbit });
    // Billboard: undo the orbit, then undo most of the tilt (cards lean back a little)
    holders.forEach((h) => gsap.set(h, { rotation: -orbit, rotationX: -tilt * .92 }));
    gsap.set(name, { rotation: -orbit, rotationX: -tilt * .97 });
  };
  render();

  // Scroll: swoop down → orbit 360° → dolly in through the page
  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: { trigger: ".hero", start: "top top", end: "+=280%", pin: ".hero-pin", scrub: 1.2, anticipatePin: 1 },
    onUpdate: render, // redraw only while the camera is actually moving
  });
  tl.to(".hero-copy", { opacity: 0, x: -80, duration: .12 }, 0)
    .to(".hero-side", { opacity: 0, x: 60, duration: .1 }, 0)
    .to(S, { tilt: 66, scale: 1, z: 0, orbit: 20, x: 0, duration: .22, ease: "power2.inOut" }, 0)   // swoop
    .to(".hero-bg", { scale: 1.2, yPercent: 6, opacity: .28, duration: .22 }, 0)
    .to(S, { orbit: 336, duration: .54, ease: "sine.inOut" }, .22)                           // full 360 orbit
    .to(".hero-bg", { xPercent: -4, duration: .27, yoyo: true, repeat: 1, ease: "sine.inOut" }, .22)
    .to(S, { z: 900, tilt: 74, duration: .24, ease: "power2.in" }, .76)                       // dolly in
    .to(".hero-bg", { scale: 1.6, opacity: 0, duration: .24, ease: "power2.in" }, .76)
    .to(".hero-fade", { opacity: 1, duration: .1 }, .9);

  // Intro: descend from much higher while the headline words rise.
  // Rule: the intro never touches an element the scroll timeline animates (copy/side/bg have inner targets),
  // otherwise a ScrollTrigger refresh mid-intro would record a half-faded value as the start.
  gsap.to(I, { tilt: 0, orbit: 0, z: 0, scale: 0, duration: 2.6, ease: "expo.out", delay: .1, onUpdate: render });
  gsap.from(".hero-bg img", { scale: 1.15, opacity: 0, duration: 2, ease: "power2.out" }); // inner img, so the scroll timeline can own .hero-bg
  gsap.from(".hero-copy .eyebrow, .hero-copy p, .playrow, .scroll, .hero-count, .hero-note", { opacity: 0, y: 20, duration: 1, ease: "power3.out", stagger: .08, delay: .5 });
  wordReveal($(".hero-copy h1"), { delay: .3, stagger: .12 });

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

  const tl = gsap.timeline({
    defaults: { ease: "none" },
    scrollTrigger: { trigger: ".music-section", start: "top top", end: "+=230%", pin: ".fly-pin", scrub: 1.8, anticipatePin: 1 },
  });
  // The camera glides forward across the landscape (set back from the lens), drifting a little like a drone.
  // Travel ends with the last row (Shorts) framed in the middle of the screen.
  tl.fromTo(plane,
    { xPercent: -50, x: -30, z: -220, y: () => innerHeight * .3, rotationX: 60, rotationZ: -5 },
    { xPercent: -50, x: 30, z: -220, y: () => -(plane.offsetHeight - innerHeight * .5), rotationX: 50, rotationZ: 4, duration: 1 }, 0)
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

// ---- 04 Kids: bouncy pop-in and floating confetti ----
function kidsMotion(desk) {
  const cards = $$(".kcard");
  gsap.set(cards, { opacity: 0, y: 70, scale: .45, rotation: () => gsap.utils.random(-12, 12) });
  ScrollTrigger.batch(cards, {
    start: "top 92%",
    onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, scale: 1, rotation: 0, duration: 1.2, ease: "elastic.out(1, .5)", stagger: .07, overwrite: true }),
  });
  gsap.from(".kids-head .num, .kids-section .section-title, .kids-sub", {
    opacity: 0, y: 30, duration: .9, ease: "back.out(2)", stagger: .1,
    scrollTrigger: { trigger: ".kids-head", start: "top 85%" },
  });
  gsap.from(".kids-head .pill--kids", {
    scale: 0, rotation: -15, duration: 1.1, ease: "elastic.out(1, .45)",
    scrollTrigger: { trigger: ".kids-head", start: "top 85%" },
  });
  // Confetti drifts at different speeds (parallax) and bobs gently
  $$(".kids-confetti i").forEach((dot, i) => {
    if (desk) gsap.to(dot, { y: (i % 2 ? -1 : 1) * (60 + i * 25), ease: "none", scrollTrigger: { trigger: ".kids-section", start: "top bottom", end: "bottom top", scrub: true } });
    gsap.to(dot, { x: gsap.utils.random(-24, 24), scale: gsap.utils.random(.85, 1.15), duration: gsap.utils.random(2.5, 4), ease: "sine.inOut", repeat: -1, yoyo: true });
  });
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

// ---- 05–07: process, about, stats, contact ----
function lowerMotion(desk) {
  gsap.from(".process-intro, .step", {
    opacity: 0, y: 30, duration: .9, ease: "power3.out", stagger: .1,
    scrollTrigger: { trigger: ".process", start: "top 85%" },
  });
  gsap.from(".about-img", { opacity: 0, scale: .94, duration: 1.2, ease: "power3.out", scrollTrigger: { trigger: ".about", start: "top 85%" } });
  gsap.from(".about-copy > *:not(h2)", { opacity: 0, y: 20, duration: .9, ease: "power3.out", stagger: .1, scrollTrigger: { trigger: ".about", start: "top 85%" } });
  if (desk) {
    // Subtle parallax inside the about photo (the image is taller than its frame)
    gsap.set(".about-img img", { height: "125%" });
    gsap.fromTo(".about-img img", { yPercent: -12 }, { yPercent: 0, ease: "none", scrollTrigger: { trigger: ".about-img", start: "top bottom", end: "bottom top", scrub: true } });
  }
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

  $$(".hero-card, .ring-card, .mcard, .kcard").forEach((el) => {
    const kids = el.classList.contains("kcard");
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
if (window.gsap && window.ScrollTrigger) {
  gsap.registerPlugin(ScrollTrigger);
  $$("[data-words]").forEach(splitWords);

  const mm = gsap.matchMedia();
  mm.add({
    desk: "(min-width: 1000px) and (min-height: 560px) and (prefers-reduced-motion: no-preference)",
    flat: "(max-width: 999px) and (prefers-reduced-motion: no-preference), (max-height: 559px) and (prefers-reduced-motion: no-preference)",
  }, (ctx) => {
    const cleanups = [];
    if (ctx.conditions.desk) {
      root.classList.add("is-3d");
      const smooth = initLenis();
      if (smooth) { lenis = smooth.lenis; cleanups.push(() => { smooth.destroy(); lenis = null; }); }
      cleanups.push(heroDrone());
      cleanups.push(ring3D());
      flyOver();
      if (finePointer) cleanups.push(pointerDetails());
    } else {
      // Flat version: no pinning, no 3D scenes, just light fades
      wordReveal($(".hero-copy h1"), { rotationX: 0, delay: .15 });
      gsap.from(".hero-copy .eyebrow, .hero-copy p, .playrow, .scroll", { opacity: 0, y: 16, duration: .8, stagger: .08, delay: .3 });
      ringFlat();
      musicFlat();
    }
    const desk = !!ctx.conditions.desk;
    headingReveals(desk);
    kidsMotion(desk);
    lowerMotion(desk);
    counters();
    addEventListener("load", () => ScrollTrigger.refresh(), { once: true });
    return () => { cleanups.forEach((fn) => fn?.()); root.classList.remove("is-3d"); };
  });
}
