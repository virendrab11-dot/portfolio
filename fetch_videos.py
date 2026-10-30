"""
Fetch the latest videos from your YouTube channels and save them for the portfolio site.

Uses only YouTube's free public RSS feed (no API key needed) and Python's standard library.
Run it again whenever you upload new videos:

    python fetch_videos.py

It writes data/videos.js, which index.html loads. Then just refresh the page.

Note: YouTube's RSS feed only lists each channel's 15 most recent uploads.
"""

import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

# ---- Your channels. Edit the URLs here if they ever change. ----------------------
CHANNELS = [
    {"key": "music", "name": "Music & Travel", "url": "https://www.youtube.com/@virendrabhakuni9150"},
    {"key": "kids", "name": "Kids Cartoon", "url": "https://www.youtube.com/@Ca-ToonTV"},
]
# -----------------------------------------------------------------------------------

OUT_FILE = Path(__file__).resolve().parent / "data" / "videos.js"
UA = {"User-Agent": "Mozilla/5.0 (portfolio-fetch)", "Accept-Language": "en"}
NS = {
    "atom": "http://www.w3.org/2005/Atom",
    "yt": "http://www.youtube.com/xml/schemas/2015",
    "media": "http://search.yahoo.com/mrss/",
}


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=20) as resp:
        return resp.read().decode("utf-8", errors="replace")


def resolve_channel_id(url):
    """Find the UC... channel ID from any channel link (@handle, /channel/, /c/, /user/)."""
    m = re.search(r"/channel/(UC[\w-]{22})", url)
    if m:
        return m.group(1)
    html = get(url)
    for pattern in (r'"externalId":"(UC[\w-]{22})"', r'<meta itemprop="identifier" content="(UC[\w-]{22})"',
                    r'"channelId":"(UC[\w-]{22})"'):
        m = re.search(pattern, html)
        if m:
            return m.group(1)
    raise RuntimeError(f"Could not find a channel ID on {url}")


def fetch_feed(channel_id):
    xml = get(f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}")
    root = ET.fromstring(xml)
    title = root.findtext("atom:title", default="", namespaces=NS)
    videos = []
    for entry in root.findall("atom:entry", NS):
        vid = entry.findtext("yt:videoId", namespaces=NS)
        link = entry.find("atom:link", NS).get("href", "")
        group = entry.find("media:group", NS)
        stats = group.find("media:community/media:statistics", NS) if group is not None else None
        views = stats.get("views") if stats is not None else None
        videos.append({
            "id": vid,
            "title": entry.findtext("atom:title", default="", namespaces=NS),
            "published": entry.findtext("atom:published", namespaces=NS),
            "thumbnail": f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg",
            "views": int(views) if views and views.isdigit() else None,
            "isShort": "/shorts/" in link,
            "url": link,
        })
    add_hd_thumbnails(videos)
    return title, videos


def best_thumbnail(vid):
    """Largest thumbnail YouTube has for this video (maxres and sd don't always exist; they 404)."""
    for size in ("maxresdefault", "sddefault"):
        url = f"https://i.ytimg.com/vi/{vid}/{size}.jpg"
        try:
            with urllib.request.urlopen(urllib.request.Request(url, method="HEAD", headers=UA), timeout=10):
                return url
        except Exception:
            continue
    return f"https://i.ytimg.com/vi/{vid}/hqdefault.jpg"


def add_hd_thumbnails(videos):
    # Checked in parallel so this adds about a second, not one request at a time
    with ThreadPoolExecutor(max_workers=8) as pool:
        for v, url in zip(videos, pool.map(best_thumbnail, [v["id"] for v in videos])):
            v["thumbnailHd"] = url


def load_previous():
    try:
        text = OUT_FILE.read_text(encoding="utf-8")
        return json.loads(text[text.index("{"):text.rindex("}") + 1]).get("channels", {})
    except (OSError, ValueError):
        return {}


def main():
    data = {"updated": datetime.now(timezone.utc).isoformat(timespec="seconds"), "channels": {}}
    failed = False
    for ch in CHANNELS:
        try:
            print(f"- {ch['name']}: resolving {ch['url']}")
            cid = resolve_channel_id(ch["url"])
            title, videos = fetch_feed(cid)
            handle = re.search(r"/(@[\w.-]+)", ch["url"])
            data["channels"][ch["key"]] = {
                "name": ch["name"],
                "title": title,
                "id": cid,
                "url": ch["url"],
                "subscribeUrl": f"https://www.youtube.com/channel/{cid}?sub_confirmation=1",
                "handle": handle.group(1) if handle else "",
                "videos": videos,
            }
            print(f"  {cid}: {len(videos)} videos")
        except Exception as e:  # keep going so one bad channel doesn't break the other
            failed = True
            print(f"  ERROR: {e}", file=sys.stderr)
            old = load_previous().get(ch["key"])
            if old:
                data["channels"][ch["key"]] = old
                print("  Kept the previously saved videos for this channel.")

    if not data["channels"]:
        sys.exit("Nothing fetched; data/videos.js was not changed.")

    OUT_FILE.parent.mkdir(exist_ok=True)
    OUT_FILE.write_text("window.VIDEO_DATA = " + json.dumps(data, ensure_ascii=False, indent=2) + ";\n",
                        encoding="utf-8")
    print(f"Saved {OUT_FILE}")
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
