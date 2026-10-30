const data = window.VIDEO_DATA;
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const fmtCompact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
const fmtDate = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" });

const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
const hasGsap = !!(window.gsap && window.ScrollTrigger);
const animate = hasGsap && !reduceMotion;
if (!animate) document.documentElement.classList.remove("js-anim");

// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------
const channel = (key) => data?.channels?.[key];
const videosOf = (key) => (channel(key)?.videos ?? []).map((v) => ({ ...v, channel: key }));
const allVideos = () => [...videosOf("music"), ...videosOf("kids")];
const byViews = (a, b) => (b.views ?? 0) - (a.views ?? 0);
const hd = (v) => v.thumbnailHd || v.thumbnail;

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
// Remove trailing hashtags and emoji so titles read cleanly in headings
const cleanTitle = (t) => t.replace(/(\s*#[\p{L}\p{N}_]+)+\s*$/u, "").trim() || t;
const stripEmoji = (t) => t.replace(/[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}️‍]/gu, "").replace(/\s{2,}/g, " ").trim();

// "Teri Aahat — Aarav & Meera | Official Music Video | Virendra Bhakuni" → name + short description
function splitTitle(v) {
  const parts = stripEmoji(cleanTitle(v.title)).split(/\s+[|—–]\s+/).map((s) => s.trim()).filter(Boolean);
  const name = parts.shift() || stripEmoji(v.title);
  const desc = parts.filter((p) => !/virendra bhakuni|ca-?toon tv/i.test(p)).join(" · ");
  return { name, desc };
}

const playAttrs = (v) =>
  `data-play data-id="${v.id}" data-short="${v.isShort}" data-title="${esc(v.title)}" data-url="${esc(v.url)}"`;

function setPlay(el, v) {
  Object.assign(el.dataset, { play: "", id: v.id, short: String(v.isShort), title: v.title, url: v.url });
  el.setAttribute("aria-label", `Play: ${stripEmoji(cleanTitle(v.title))}`);
}

function setImg(img, v, big = true) {
  img.dataset.vid = v.id;
  img.src = big ? hd(v) : v.thumbnail;
}

// If a thumbnail fails (blocked host, missing size), fall back through other YouTube URLs
const thumbFallbacks = (id) => [
  `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
  `https://i.ytimg.com/vi/${id}/sddefault.jpg`,
  `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
  `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
];
document.addEventListener("error", (e) => {
  const img = e.target;
  if (!(img instanceof HTMLImageElement) || !img.dataset.vid) return;
  const urls = thumbFallbacks(img.dataset.vid);
  const next = Number(img.dataset.try ?? urls.indexOf(img.src)) + 1; // -1 (unknown URL) starts at the top
  img.dataset.try = next;
  if (next < urls.length) img.src = urls[next];
  else img.parentElement?.classList.add("no-thumb");
}, true);

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
const used = new Set();

function renderHero() {
  // Most-watched landscape music video, preferring one with a full-HD thumbnail
  const long = videosOf("music").filter((v) => !v.isShort)
    .sort((a, b) => (/maxres/.test(hd(b)) - /maxres/.test(hd(a))) || byViews(a, b));
  const hero = long[0] ?? allVideos()[0];
  if (hero) {
    setImg($("#hero-img"), hero);
    setPlay($("#hero-visual"), hero);
    used.add(hero.id);
  }
  const kidsShort = videosOf("kids").filter((v) => v.isShort).sort(byViews)[0];
  const musicShort = videosOf("music").filter((v) => v.isShort).sort(byViews)[0];
  const kidsLong = videosOf("kids").filter((v) => !v.isShort).sort(byViews)[0];
  [[$("#float-1"), kidsShort ?? musicShort], [$("#float-2"), kidsLong]].forEach(([el, v]) => {
    if (!v) return el.remove();
    setImg($("img", el), v, false);
    setPlay(el, v);
  });
}

function renderFeatures() {
  $$("[data-feature]").forEach((el) => {
    const key = el.dataset.channel;
    const re = new RegExp(el.dataset.match, "i");
    const wantShort = el.dataset.prefer === "short";
    const matches = videosOf(key).filter((v) => re.test(v.title));
    const pick = matches.filter((v) => v.isShort === wantShort).sort(byViews)[0]
      ?? matches.sort(byViews)[0]
      ?? videosOf(key).filter((v) => !used.has(v.id)).sort(byViews)[0];
    if (!pick) return;
    used.add(pick.id);
    setImg($("img", el), pick);
    setPlay(el, pick);
  });
}

function renderAbout() {
  const v = videosOf("music").find((x) => /sukoon/i.test(x.title) && !x.isShort)
    ?? videosOf("music").filter((x) => !x.isShort && !used.has(x.id)).sort(byViews)[0];
  if (v) setImg($("#about-img"), v);
}

function renderReel() {
  const track = $("#reel");
  const list = allVideos().sort((a, b) => new Date(b.published) - new Date(a.published));
  if (!list.length) return $(".reel").remove();
  let items = [...list];
  if (animate) items = items.concat(items); // doubled for a seamless -50% loop
  track.innerHTML = items.map((v, i) => {
    const dupe = animate && i >= list.length;
    return `<button class="reel-item ${v.isShort ? "tall" : "wide"}" ${playAttrs(v)}
      ${dupe ? 'tabindex="-1" aria-hidden="true"' : `aria-label="Play: ${esc(stripEmoji(cleanTitle(v.title)))}"`}>
      <img src="${v.thumbnail}" data-vid="${v.id}" alt="" loading="lazy" width="480" height="360"></button>`;
  }).join("");
  if (!animate) $(".reel").style.overflowX = "auto";
}

// Lay out n landscape videos in full rows: "wide" rows hold 2, normal rows hold 3 (12-column grid)
function rowSizes(n) {
  if (n === 1) return ["full"];
  let threes = Math.floor(n / 3);
  while ((n - threes * 3) % 2) threes--;
  const rows = [];
  let twos = (n - threes * 3) / 2;
  while (twos || threes) {
    if (twos) { rows.push("wide", "wide"); twos--; }
    if (threes) { rows.push("", "", ""); threes--; }
  }
  return rows;
}

function tile(v, cls, key) {
  const { name, desc } = splitTitle(v);
  const type = v.isShort ? "Short" : key === "kids" ? "Cartoon" : "Music video";
  const views = v.views != null ? `${fmtCompact.format(v.views)} views` : "";
  return `
    <button class="tile ${cls}" data-kind="${v.isShort ? "short" : "video"}" data-tilt ${playAttrs(v)}>
      <span class="tile-img">
        <img src="${v.isShort ? v.thumbnail : hd(v)}" data-vid="${v.id}" alt="" loading="lazy" width="480" height="360">
        <span class="play" aria-hidden="true"><svg class="ico"><use href="#i-play"/></svg></span>
      </span>
      <span class="tile-info">
        <span class="tile-meta"><span>${type} · ${fmtDate.format(new Date(v.published))}</span><span>${views}</span></span>
        <span class="h3">${esc(name)}</span>
        ${desc ? `<span class="p">${esc(desc)}</span>` : ""}
      </span>
    </button>`;
}

function renderArchive(key) {
  const el = $(`[data-archive="${key}"]`);
  const ch = channel(key);
  if (!ch?.videos.length) {
    el.innerHTML = `<p class="empty">No videos loaded yet. Run <code>python fetch_videos.py</code> in the portfolio folder.</p>`;
    return;
  }
  $(`[data-subscribe="${key}"]`).href = ch.subscribeUrl;
  if (ch.title) $(`[data-channel-title="${key}"]`).textContent = `${ch.title}${ch.handle ? ` · ${ch.handle}` : ""}`;
  const vids = videosOf(key);
  const long = vids.filter((v) => !v.isShort);
  const shorts = vids.filter((v) => v.isShort);
  const sizes = rowSizes(long.length);
  el.innerHTML = long.map((v, i) => tile(v, sizes[i], key)).join("") + shorts.map((v) => tile(v, "short", key)).join("");
}

function renderStats() {
  const sum = (list) => list.reduce((s, v) => s + (v.views ?? 0), 0);
  const all = allVideos();
  if (!all.length) return $("#stats").remove();
  const rows = [
    ["Recent videos", all.length],
    ["Total views", sum(all), "gold"],
    ["Music & Travel views", sum(videosOf("music"))],
    ["Kids cartoon views", sum(videosOf("kids"))],
  ];
  $("#stats-grid").innerHTML = rows.map(([label, n, cls = ""]) =>
    `<div class="stat ${cls}"><dt>${label}</dt><dd data-count="${n}">${n >= 1000 ? fmtCompact.format(n) : n}</dd></div>`).join("");
}

// ---------------------------------------------------------------------------
// Filters (animated with Flip when motion is on)
// ---------------------------------------------------------------------------
function initFilters() {
  $$(".filters").forEach((group) => {
    const section = group.closest("section");
    const tiles = () => $$(".tile", section);
    group.addEventListener("click", (e) => {
      const btn = e.target.closest(".filter");
      if (!btn || btn.classList.contains("active")) return;
      $$(".filter", group).forEach((b) => {
        b.classList.toggle("active", b === btn);
        b.setAttribute("aria-pressed", String(b === btn));
      });
      const f = btn.dataset.filter;
      const apply = () => tiles().forEach((t) => t.classList.toggle("hidden", f !== "all" && t.dataset.kind !== f));
      if (!animate || !window.Flip) return apply();
      const state = Flip.getState(tiles());
      apply();
      const kids = section.classList.contains("kids");
      Flip.from(state, {
        duration: kids ? .8 : .9, ease: kids ? "back.out(1.4)" : "power3.inOut", absolute: true, scale: true, nested: true,
        onEnter: (els) => gsap.fromTo(els, { autoAlpha: 0, scale: .8 }, { autoAlpha: 1, scale: 1, duration: .6, ease: kids ? "back.out(2)" : "power2.out" }),
        onLeave: (els) => gsap.to(els, { autoAlpha: 0, scale: .8, duration: .4 }),
        onComplete: () => ScrollTrigger.refresh(),
      });
    });
  });
}

// ---------------------------------------------------------------------------
// Mobile menu
// ---------------------------------------------------------------------------
const menu = $("#menu");
const nav = $("#nav");
const setMenu = (open) => { nav.classList.toggle("open", open); menu.setAttribute("aria-expanded", String(open)); };
menu.addEventListener("click", () => setMenu(!nav.classList.contains("open")));
nav.querySelectorAll("a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });

// ---------------------------------------------------------------------------
// Popup player
// ---------------------------------------------------------------------------
const dialog = $("#player");
const frame = $("#player-frame");
let lastFocus = null;

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
  document.documentElement.classList.remove("has-cursor"); // the iframe swallows mouse moves
}
dialog.addEventListener("close", () => {
  frame.innerHTML = "";
  document.body.classList.remove("no-scroll");
  if (cursorOn) document.documentElement.classList.add("has-cursor");
  lastFocus?.focus({ preventScroll: true });
});
dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
$("#player-close").addEventListener("click", () => dialog.close());
document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-play]");
  if (el) openPlayer(el);
});

// ---------------------------------------------------------------------------
// Text splitting (keeps <br> and <span> styling intact)
// ---------------------------------------------------------------------------
function split(el, mode) {
  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.ELEMENT_NODE) return walk(child);
      if (child.nodeType !== Node.TEXT_NODE) return;
      const frag = document.createDocumentFragment();
      child.textContent.split(/(\s+)/).forEach((part) => {
        if (!part) return;
        if (/^\s+$/.test(part)) return frag.append(" ");
        const word = document.createElement("span");
        word.className = "word";
        if (mode === "chars") {
          [...part].forEach((ch) => {
            const c = document.createElement("span");
            c.className = "char";
            c.textContent = ch;
            word.append(c);
          });
        } else {
          const inner = document.createElement("span");
          inner.className = "word-in";
          inner.textContent = part;
          word.append(inner);
        }
        frag.append(word);
      });
      child.replaceWith(frag);
    });
  };
  walk(el);
}

// ---------------------------------------------------------------------------
// Intro: loader (first visit per session) then hero reveal
// ---------------------------------------------------------------------------
function heroIntro() {
  const title = $("#hero-title");
  split(title, "chars");
  gsap.set(title, { autoAlpha: 1 });
  const tl = gsap.timeline({ defaults: { ease: "power4.out" } });
  tl.from("#hero-title .char", { yPercent: 115, rotate: 7, duration: 1.1, stagger: .032 })
    .fromTo(".hero-in", { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: .9, stagger: .1 }, "-=.75")
    .fromTo(".hero-visual", { clipPath: "inset(100% 0% 0% 0%)" }, { clipPath: "inset(0% 0% 0% 0%)", duration: 1.4, ease: "expo.inOut" }, 0)
    .from("#hero-img", { scale: 1.35, duration: 1.8, ease: "expo.out" }, .2)
    .from(".hero-float", { autoAlpha: 0, scale: .6, y: 40, duration: 1, ease: "back.out(1.7)", stagger: .12 }, .9);
}

function runIntro() {
  let seen = false;
  try { seen = sessionStorage.getItem("intro-seen") === "1"; sessionStorage.setItem("intro-seen", "1"); } catch {}
  const loader = $("#loader");
  if (seen) {
    document.documentElement.classList.add("intro-seen");
    loader.remove();
    return heroIntro();
  }
  // Wait for the hero image and fonts, but never longer than ~0.7s past the count-up
  const heroImg = $("#hero-img");
  const ready = Promise.race([
    Promise.all([
      document.fonts?.ready ?? Promise.resolve(),
      heroImg.complete ? Promise.resolve() : new Promise((r) => { heroImg.addEventListener("load", r, { once: true }); heroImg.addEventListener("error", r, { once: true }); }),
    ]),
    new Promise((r) => setTimeout(r, 1600)),
  ]);
  const num = $("#loader-num");
  const prog = { v: 0 };
  gsap.timeline()
    .from(".loader-logo .ll", { yPercent: 110, duration: .7, ease: "power4.out", stagger: .08 })
    .to(prog, { v: 100, duration: .9, ease: "power2.inOut", onUpdate: () => (num.textContent = Math.round(prog.v)) }, 0)
    .to("#loader-fill", { scaleX: 1, duration: .9, ease: "power2.inOut" }, 0)
    .add(() => ready.then(() => {
      gsap.timeline({ onComplete: () => loader.remove() })
        .to(".loader > *", { yPercent: -60, autoAlpha: 0, duration: .45, ease: "power3.in", stagger: .05 })
        .to(loader, { yPercent: -100, duration: .8, ease: "expo.inOut" }, "-=.15")
        .add(heroIntro, "-=.45");
    }));
}

// ---------------------------------------------------------------------------
// Scroll motion
// ---------------------------------------------------------------------------
function initParallax() {
  const scrub = (el, vars, trigger = el) =>
    gsap.to(el, { ...vars, ease: "none", scrollTrigger: { trigger, start: "top bottom", end: "bottom top", scrub: true } });

  scrub(".hero-img-wrap", { yPercent: 10 }, ".hero");
  scrub(".hero-caption", { y: -50 }, ".hero");
  scrub(".hero-float.f1", { y: -120 }, ".hero");
  scrub(".hero-float.f2", { y: 70 }, ".hero");
  $$(".feature-img").forEach((el) => scrub(el, { yPercent: 8 }, el.parentElement));
  scrub("#about-img", { yPercent: -14 }, ".about-art");
  $$(".kids-blobs i").forEach((b) => {
    scrub(b, { y: Number(b.dataset.speed) * 4 }, ".kids");
    gsap.to(b, { x: gsap.utils.random(-30, 30), scale: gsap.utils.random(.85, 1.15), duration: gsap.utils.random(3, 5), ease: "sine.inOut", repeat: -1, yoyo: true });
  });
}

function initMarquees() {
  // Text ticker: clone the set until it fills twice the screen, then loop
  const ttrack = $(".ticker-track");
  const set = $(".ticker-set", ttrack);
  while (ttrack.scrollWidth < innerWidth * 2.2) ttrack.append(set.cloneNode(true));
  if ($$(".ticker-set", ttrack).length % 2) ttrack.append(set.cloneNode(true));
  const ticker = gsap.to(ttrack, { xPercent: -50, duration: ttrack.scrollWidth / 2 / 60, ease: "none", repeat: -1 });

  // Thumbnail reel runs the opposite way
  const rtrack = $("#reel");
  const reel = rtrack ? gsap.fromTo(rtrack, { xPercent: -50 }, { xPercent: 0, duration: rtrack.scrollWidth / 2 / 40, ease: "none", repeat: -1 }) : null;

  // Both speed up with scroll velocity, then settle
  ScrollTrigger.create({
    start: 0, end: "max",
    onUpdate: (self) => {
      const boost = 1 + Math.min(Math.abs(self.getVelocity()) / 300, 5);
      [ticker, reel].filter(Boolean).forEach((t) =>
        gsap.to(t, { timeScale: boost, duration: .2, overwrite: true, onComplete: () => gsap.to(t, { timeScale: 1, duration: 1.2 }) }));
    },
  });
  if (reel && finePointer) {
    const r = $(".reel");
    r.addEventListener("mouseenter", () => gsap.to(reel, { timeScale: .12, duration: .6, overwrite: true }));
    r.addEventListener("mouseleave", () => gsap.to(reel, { timeScale: 1, duration: .6, overwrite: true }));
  }
}

function initReveals() {
  // Headings: words rise out of a mask (bouncier in the kids section)
  $$("[data-split]").forEach((el) => {
    split(el, "words");
    const kids = !!el.closest(".kids");
    gsap.from($$(".word-in", el), {
      yPercent: 115, rotate: kids ? 10 : 0, duration: kids ? 1 : 1.2, stagger: .07,
      ease: kids ? "back.out(2.2)" : "power4.out",
      scrollTrigger: { trigger: el, start: "top 88%" },
    });
  });

  $$(".section-label, .section-desc, .archive-head").forEach((el) => {
    gsap.from(el, { autoAlpha: 0, y: 24, duration: .9, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 90%" } });
  });

  gsap.from(".feature", {
    autoAlpha: 0, y: 90, duration: 1.2, ease: "power3.out", stagger: .14,
    scrollTrigger: { trigger: ".feature-grid", start: "top 85%" },
  });

  // Music & Travel: slow cinematic fade, blur and letterbox wipe
  const musicTiles = $$(".music .tile");
  gsap.set(musicTiles, { autoAlpha: 0, y: 40, filter: "blur(10px)" });
  gsap.set($$(".music .tile-img img"), { clipPath: "inset(14% 0% 14% 0%)", scale: 1.15 });
  ScrollTrigger.batch(musicTiles, {
    start: "top 90%",
    onEnter: (batch) => {
      gsap.to(batch, { autoAlpha: 1, y: 0, filter: "blur(0px)", duration: 1.6, ease: "power2.out", stagger: .16, overwrite: true, clearProps: "filter" });
      gsap.to(batch.map((t) => $(".tile-img img", t)), { clipPath: "inset(0% 0% 0% 0%)", scale: 1, duration: 2, ease: "power3.out", stagger: .16, clearProps: "clipPath,scale" });
    },
  });

  // Kids Cartoons: bouncy drop-in with a wobble
  const kidsTiles = $$(".kids .tile");
  gsap.set(kidsTiles, { autoAlpha: 0, y: 120, scale: .6, rotation: () => gsap.utils.random(-10, 10) });
  ScrollTrigger.batch(kidsTiles, {
    start: "top 92%",
    onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, scale: 1, rotation: 0, duration: 1.3, ease: "elastic.out(1, .55)", stagger: .08, overwrite: true }),
  });
  gsap.from(".kids .button--kids", { scale: 0, rotation: -12, duration: 1, ease: "elastic.out(1, .5)", scrollTrigger: { trigger: ".kids .archive-head", start: "top 90%" } });

  gsap.from(".studio-card", {
    autoAlpha: 0, scale: .9, y: 50, duration: 1.1, ease: "power3.out", stagger: .12,
    scrollTrigger: { trigger: ".studio", start: "top 85%" },
  });

  gsap.fromTo(".about-art", { clipPath: "inset(0% 0% 100% 0%)" }, {
    clipPath: "inset(0% 0% 0% 0%)", duration: 1.5, ease: "expo.inOut",
    scrollTrigger: { trigger: ".about-art", start: "top 80%" },
  });
  gsap.from(".about-copy p, .chips span", {
    autoAlpha: 0, y: 24, duration: .8, ease: "power3.out", stagger: .07,
    scrollTrigger: { trigger: ".about-copy", start: "top 80%" },
  });

  gsap.from(".stat", {
    autoAlpha: 0, y: 40, duration: .9, ease: "power3.out", stagger: .1,
    scrollTrigger: { trigger: ".stats", start: "top 88%" },
  });

  // Contact band grows into place as it arrives
  gsap.fromTo(".contact", { scale: .92, borderRadius: 40 }, {
    scale: 1, borderRadius: 0, ease: "none",
    scrollTrigger: { trigger: ".contact", start: "top bottom", end: "top 35%", scrub: true },
  });
}

function initCounters() {
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

// ---------------------------------------------------------------------------
// Pointer effects (mouse only): cursor, magnetic buttons, 3D tilt
// ---------------------------------------------------------------------------
let cursorOn = false;

function initCursor() {
  cursorOn = true;
  const root = document.documentElement;
  root.classList.add("has-cursor");
  const cursor = $(".cursor");
  const dot = $(".cursor-dot");
  const ring = $(".cursor-ring");
  const dx = gsap.quickTo(dot, "x", { duration: .12, ease: "power3" });
  const dy = gsap.quickTo(dot, "y", { duration: .12, ease: "power3" });
  const rx = gsap.quickTo(ring, "x", { duration: .45, ease: "power3" });
  const ry = gsap.quickTo(ring, "y", { duration: .45, ease: "power3" });
  addEventListener("mousemove", (e) => { dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY); cursor.classList.remove("is-hidden"); }, { passive: true });
  document.addEventListener("mouseleave", () => cursor.classList.add("is-hidden"));
  document.addEventListener("mouseover", (e) => {
    const play = e.target.closest("[data-play]");
    cursor.classList.toggle("is-play", !!play);
    cursor.classList.toggle("is-link", !play && !!e.target.closest("a, button"));
  });
}

function initMagnetic() {
  $$("[data-magnetic], .filter, .nav a, .logo").forEach((el) => {
    const xTo = gsap.quickTo(el, "x", { duration: .6, ease: "elastic.out(1, .4)" });
    const yTo = gsap.quickTo(el, "y", { duration: .6, ease: "elastic.out(1, .4)" });
    const clamp = gsap.utils.clamp(-12, 12);
    el.addEventListener("mousemove", (e) => {
      const r = el.getBoundingClientRect();
      xTo(clamp((e.clientX - r.left - r.width / 2) * .3));
      yTo(clamp((e.clientY - r.top - r.height / 2) * .3));
    });
    el.addEventListener("mouseleave", () => { xTo(0); yTo(0); });
  });
}

function initTilt() {
  $$("[data-tilt]").forEach((el) => {
    const kids = !!el.closest(".kids");
    const max = kids ? 10 : 6;
    const glare = document.createElement("span");
    glare.className = "glare";
    el.append(glare);
    gsap.set(el, { transformPerspective: 900 });
    const rx = gsap.quickTo(el, "rotationX", { duration: .5, ease: "power3" });
    const ry = gsap.quickTo(el, "rotationY", { duration: .5, ease: "power3" });
    const sc = gsap.quickTo(el, "scale", { duration: kids ? .6 : .5, ease: kids ? "elastic.out(1, .45)" : "power3" });
    el.addEventListener("mousemove", (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      ry((px - .5) * max * 2);
      rx((.5 - py) * max * 2);
      el.style.setProperty("--gx", `${px * 100}%`);
      el.style.setProperty("--gy", `${py * 100}%`);
    });
    el.addEventListener("mouseenter", () => sc(kids ? 1.04 : 1.015));
    el.addEventListener("mouseleave", () => { rx(0); ry(0); sc(1); });
  });
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
renderHero();
renderFeatures();
renderAbout();
renderReel();
renderArchive("music");
renderArchive("kids");
renderStats();
initFilters();
$$(".year").forEach((el) => (el.textContent = new Date().getFullYear()));
if (data?.updated) $("#updated").textContent = `Videos updated ${fmtDate.format(new Date(data.updated))}`;

if (animate) {
  gsap.registerPlugin(ScrollTrigger, ...(window.Flip ? [Flip] : []));
  runIntro();
  initParallax();
  initMarquees();
  initReveals();
  initCounters();
  if (finePointer) {
    initCursor();
    initMagnetic();
    initTilt();
  }
  addEventListener("load", () => ScrollTrigger.refresh());
}
