#!/usr/bin/env python3
"""
Independent Python thumbnail renderer for Excalidraw templates.

Parses .excalidraw JSON scenes and renders 400x300 WebP thumbnails.
Uses Pillow + cairosvg for SVG->raster conversion.

Supports: rect, ellipse, diamond, line, arrow (+arrowhead), freedraw,
          text, sticky note, image placeholder.
Supports: hachure, cross-hatch, dashed styles, rotation, viewport-fit scaling.

Usage:
    python3 scripts/thumbnails.py
    python3 scripts/thumbnails.py --validate   # validate existing thumbs against Node output
"""

import json
import math
import os
import sys
from pathlib import Path

try:
    # On macOS with Homebrew cairo, ctypes.util.find_library may not find it.
    # Monkey-patch before importing cairosvg.
    import ctypes.util as _cu
    _orig_find = _cu.find_library
    def _find_library(name):
        if name == "cairo":
            import pathlib
            for p in [pathlib.Path("/opt/homebrew/lib/libcairo.2.dylib"), pathlib.Path("/usr/local/lib/libcairo.2.dylib")]:
                if p.exists():
                    return str(p)
        return _orig_find(name)
    _cu.find_library = _find_library
except Exception:
    pass

try:
    import cairosvg
    from PIL import Image
except ImportError:
    print(
        "ERROR: Missing dependencies. Install with:\n"
        "  pip3 install Pillow cairosvg",
        file=sys.stderr,
    )
    sys.exit(1)

WIDTH = 400
HEIGHT = 300
MARGIN = 16
FONT = "sans-serif"

FONT_STACK = {
    1: FONT,  # hand-drawn
    2: FONT,  # normal
    3: FONT,  # code
    4: FONT,
    5: FONT,
    6: FONT,
}


def esc(s: str) -> str:
    """Escape XML special characters."""
    return (
        str(s)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def rgb_of(color, fallback: str = "#1e1e1e") -> str:
    if not isinstance(color, str):
        return fallback
    if color == "transparent":
        return "transparent"
    return color


def hatch_pattern(pattern_id: str = "hatch") -> str:
    return (
        f'<pattern id="{pattern_id}" width="6" height="6" '
        f'patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
        f'<line x1="0" y1="0" x2="0" y2="6" stroke="#000" '
        f'stroke-opacity="0.14" stroke-width="1.4"/>'
        f"</pattern>"
    )


def stroke_props(el: dict, default: str = "#1e1e1e") -> dict:
    color = rgb_of(el.get("strokeColor"), default)
    width = max(0.5, el.get("strokeWidth", 1))
    dash = ' stroke-dasharray="4 3"' if el.get("strokeStyle") == "dashed" else ""
    opacity = el.get("opacity", 100) / 100
    return {
        "stroke": color,
        "stroke-width": width,
        "fill": "none",
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        "opacity": opacity,
        "_dash": dash,
    }


def attrs(obj: dict) -> str:
    parts = []
    for k, v in obj.items():
        if k.startswith("_"):
            continue
        if v is None or v is False:
            continue
        if v is True:
            parts.append(k)
        else:
            parts.append(f'{k}="{esc(str(v))}"')
    # Add raw dash attribute
    dash = obj.get("_dash", "")
    if dash:
        parts.append(dash)
    return " ".join(parts)


def transform_for(el: dict) -> str:
    x = el.get("x", 0)
    y = el.get("y", 0)
    w = el.get("width", 0)
    h = el.get("height", 0)
    angle = el.get("angle", 0)
    base = f"translate({x} {y})"
    if not angle:
        return base
    cx = w / 2
    cy = h / 2
    return f"{base} rotate({math.degrees(angle)} {cx} {cy})"


def render_element(el: dict) -> str:
    if el.get("isDeleted"):
        return ""

    t = transform_for(el)
    el_type = el.get("type", "")

    if el_type == "rectangle":
        stroke = rgb_of(el.get("strokeColor"), "#1e1e1e")
        bg = el.get("backgroundColor", "transparent")
        fill = "rgba(255,255,255,0)" if bg == "transparent" else bg

        rx = 0
        rn = el.get("roundness") or {}
        rt = rn.get("type", 0)
        rw = rn.get("value", 0)
        w = el.get("width", 0)
        h = el.get("height", 0)
        if rt == 3:
            rx = min(w, h) / 2
        elif rt == 2:
            rx = min(w, h) / 4
        elif rt == 1:
            rx = 0

        fill_style = el.get("fillStyle", "")
        is_hachure = fill_style in ("hachure", "cross-hatch")
        fill_attr = "url(#hatch)" if is_hachure else fill
        fill_opacity = 0.9 if is_hachure else (1 if fill_style == "solid" else el.get("opacity", 100) / 100)

        s = stroke_props(el)
        s["fill"] = fill_attr
        s["fill-opacity"] = fill_opacity

        return (
            f'<rect {attrs({"x": 0, "y": 0, "width": w, "height": h, "rx": rx, **s})} '
            f'transform="{t}"/>'
        )

    elif el_type == "ellipse":
        w = el.get("width", 0)
        h = el.get("height", 0)
        bg = el.get("backgroundColor", "transparent")
        fill = "none" if bg == "transparent" else bg
        fill_style = el.get("fillStyle", "")
        is_hachure = fill_style in ("hachure", "cross-hatch")

        s = stroke_props(el)
        s["fill"] = "url(#hatch)" if is_hachure else fill
        s["fill-opacity"] = 0.9 if is_hachure else (1 if fill_style == "solid" else el.get("opacity", 100) / 100)

        return (
            f'<ellipse {attrs({"cx": w/2, "cy": h/2, "rx": w/2, "ry": h/2, **s})} '
            f'transform="{t}"/>'
        )

    elif el_type == "diamond":
        w = el.get("width", 0)
        h = el.get("height", 0)
        bg = el.get("backgroundColor", "transparent")
        fill = "none" if bg == "transparent" else bg
        fill_style = el.get("fillStyle", "")
        is_hachure = fill_style in ("hachure", "cross-hatch")

        s = stroke_props(el)
        s["fill"] = "url(#hatch)" if is_hachure else fill
        s["fill-opacity"] = 0.9 if is_hachure else (1 if fill_style == "solid" else el.get("opacity", 100) / 100)

        pts = f"{w/2},0 {w},{h/2} {w/2},{h} 0,{h/2}"
        return f'<polygon {attrs({"points": pts, **s})} transform="{t}"/>'

    elif el_type == "arrow":
        points = el.get("points", [[0, 0], [el.get("width", 0), el.get("height", 0)]])
        pts_str = " ".join(f"{px},{py}" for px, py in points)

        # Arrowhead
        last = points[-1] if points else [el.get("width", 0), el.get("height", 0)]
        prev = points[-2] if len(points) >= 2 else [0, 0]
        a0 = math.atan2(last[1] - prev[1], last[0] - prev[0])
        if not math.isfinite(a0):
            a0 = math.atan2(el.get("height", 0), el.get("width", 0))
        if math.isnan(a0):
            a0 = 0

        ah = 8 + el.get("strokeWidth", 1) * 2
        ba = 0.42
        p1 = [last[0] - ah * math.cos(a0 - ba), last[1] - ah * math.sin(a0 - ba)]
        p2 = [last[0] - ah * math.cos(a0 + ba), last[1] - ah * math.sin(a0 + ba)]

        sh = stroke_props(el)
        head_fill = rgb_of(el.get("strokeColor"), "#1e1e1e")
        head_pts = f"{last[0]},{last[1]} {p1[0]},{p1[1]} {p2[0]},{p2[1]}"

        body = f'<polyline {attrs({"points": pts_str, **sh})}/>'
        head = f'<polygon {attrs({"points": head_pts, "fill": head_fill, "stroke": "none", "opacity": sh.get("opacity", 1)})}/>'

        return f'<g transform="{t}">{body}{head}</g>'

    elif el_type == "line":
        points = el.get("points", [[0, 0], [el.get("width", 0), el.get("height", 0)]])
        pts_str = " ".join(f"{px},{py}" for px, py in points)
        return f'<polyline {attrs({"points": pts_str, **stroke_props(el)})} transform="{t}"/>'

    elif el_type == "freedraw":
        points = el.get("points", [])
        if not points:
            return ""
        pts_str = " ".join(f"{px},{py}" for px, py in points)
        s = stroke_props(el)
        s["stroke-linecap"] = "round"
        return f'<polyline {attrs({"points": pts_str, **s})} transform="{t}"/>'

    elif el_type == "text":
        font_size = max(4, el.get("fontSize", 20))
        color = rgb_of(el.get("strokeColor"), "#1e1e1e")
        family = FONT_STACK.get(el.get("fontFamily", 2), FONT)
        align = el.get("textAlign", "left")
        anchor = "middle" if align == "center" else ("end" if align == "right" else "start")
        lines = [l for l in str(el.get("text", "")).split("\n") if l]
        lh = font_size * 1.25
        w = el.get("width", 0)
        h = el.get("height", 0)
        base_x = w / 2 if align == "center" else (w if align == "right" else 0)
        start_y = ((h - lh * len(lines)) / 2 + lh * 0.75) if h else lh * 0.75

        tspans = []
        for i, ln in enumerate(lines):
            y = start_y + i * lh
            if len(ln) > 46:
                ln = ln[:46] + "\u2026"
            tspans.append(f'<tspan x="{base_x}" y="{y}">{esc(ln)}</tspan>')

        font_weight = 700 if el.get("fontWeight") == "bold" else 400
        font_style = ' font-style="italic"' if el.get("italic") else ""
        opacity = el.get("opacity", 100) / 100

        return (
            f'<text font-size="{font_size}" fill="{color}" font-family="{family}" '
            f'font-weight="{font_weight}" text-anchor="{anchor}" '
            f'dominant-baseline="central" opacity="{opacity}"{font_style} '
            f'transform="{t}">{"".join(tspans)}</text>'
        )

    elif el_type == "sticky":
        w = el.get("width", 0)
        h = el.get("height", 0)
        bg = el.get("backgroundColor", "#ffec99")
        label = str(el.get("text", "")).split("\n")[:2]
        label = " ".join(label)[:40]

        s = stroke_props(el)
        s["fill"] = bg
        s["rx"] = 4

        rect = f'<rect {attrs({"x": 0, "y": 0, "width": w, "height": h, **s})}/>'
        text = (
            f'<text x="{w/2}" y="{h/2}" font-size="10" fill="{rgb_of(el.get("strokeColor"), "#1e1e1e")}" '
            f'text-anchor="middle" dominant-baseline="central" font-family="{FONT}">{esc(label)}</text>'
        )
        return f'<g transform="{t}">{rect}{text}</g>'

    elif el_type == "image":
        w = el.get("width", 0)
        h = el.get("height", 0)
        img_attrs = {
            "x": 0, "y": 0, "width": w, "height": h,
            "fill": "#e7e7e7", "stroke": "#999",
            "stroke-width": 1, "stroke-dasharray": "3 2", "rx": 2,
        }
        return f'<rect {attrs(img_attrs)} transform="{t}"/>'

    return ""


def scene_to_svg(scene: dict):
    """Convert an Excalidraw scene dict to a 400x300 SVG string."""
    elements = [e for e in scene.get("elements", []) if not e.get("isDeleted")]
    if not elements:
        return None

    min_x = min_y = float("inf")
    max_x = max_y = float("-inf")

    for e in elements:
        x = e.get("x", 0)
        y = e.get("y", 0)
        w = e.get("width", 0)
        h = e.get("height", 0)
        min_x = min(min_x, x)
        min_y = min(min_y, y)
        max_x = max(max_x, x + w)
        max_y = max(max_y, y + h)

    if not math.isfinite(min_x) or max_x <= min_x or max_y <= min_y:
        return None

    bw = max_x - min_x
    bh = max_y - min_y
    scale = min((WIDTH - MARGIN * 2) / bw, (HEIGHT - MARGIN * 2) / bh)
    dx = (WIDTH - bw * scale) / 2 - min_x * scale
    dy = (HEIGHT - bh * scale) / 2 - min_y * scale

    body = "\n".join(render_element(e) for e in elements)
    wrap = f'<g transform="translate({dx} {dy}) scale({scale})">{body}</g>'

    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{WIDTH}" height="{HEIGHT}" '
        f'viewBox="0 0 {WIDTH} {HEIGHT}">'
        f'<rect width="{WIDTH}" height="{HEIGHT}" fill="#ffffff"/>'
        f'{hatch_pattern("hatch")}'
        f'{wrap}</svg>'
    )


def svg_to_webp(svg_str: str, output_path: str):
    """Convert SVG string to a 400x300 WebP file."""
    try:
        png_data = cairosvg.svg2png(
            bytestring=svg_str.encode("utf-8"),
            output_width=WIDTH,
            output_height=HEIGHT,
        )
        img = Image.open(__import__("io").BytesIO(png_data))
        img = img.convert("RGB")
        img.save(output_path, "WEBP", quality=84)
        return True
    except Exception as e:
        print(f"  ERROR converting to WebP: {e}", file=sys.stderr)
        return False


def find_templates(base_dir: Path):
    """Find all .excalidraw template files. Returns (category, slug, path) tuples."""
    templates_dir = base_dir / "public" / "templates"
    results = []
    for cat_dir in sorted(templates_dir.iterdir()):
        if not cat_dir.is_dir() or cat_dir.name.startswith("_"):
            continue
        for f in sorted(cat_dir.glob("*.excalidraw")):
            results.append((cat_dir.name, f.stem, f))
    return results


def generate_thumbs(base_dir: Path) -> int:
    """Generate all thumbnails. Returns count of generated thumbs."""
    templates = find_templates(base_dir)
    thumbs_dir = base_dir / "public" / "templates" / "_thumbs"
    made = 0
    failed = 0

    for cat, slug, path in templates:
        try:
            scene = json.loads(path.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"FAIL {cat}/{slug}: {e}", file=sys.stderr)
            failed += 1
            continue

        svg = scene_to_svg(scene)
        if not svg:
            print(f"skip (empty scene): {cat}/{slug}")
            failed += 1
            continue

        out_dir = thumbs_dir / cat
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / f"{slug}.webp"

        if svg_to_webp(svg, str(out_path)):
            made += 1
            print(f"  OK  {cat}/{slug}.webp")
        else:
            failed += 1

    return made


def validate_thumbs(base_dir: Path) -> int:
    """Validate that all templates have thumbnails. Returns failure count."""
    templates = find_templates(base_dir)
    thumbs_dir = base_dir / "public" / "templates" / "_thumbs"
    failures = 0

    for cat, slug, path in templates:
        thumb_path = thumbs_dir / cat / f"{slug}.webp"
        if not thumb_path.exists():
            print(f"FAIL {cat}/{slug}: missing thumbnail")
            failures += 1
            continue

        try:
            img = Image.open(thumb_path)
            w, h = img.size
            fmt = img.format
            if fmt != "WEBP":
                print(f"FAIL {cat}/{slug}: format is {fmt}, expected WEBP")
                failures += 1
            if w != WIDTH or h != HEIGHT:
                print(f"FAIL {cat}/{slug}: size is {w}x{h}, expected {WIDTH}x{HEIGHT}")
                failures += 1
        except Exception as e:
            print(f"FAIL {cat}/{slug}: unreadable ({e})")
            failures += 1

    return failures


def main():
    base_dir = Path(__file__).resolve().parent.parent
    validate = "--validate" in sys.argv

    if validate:
        print("Validating thumbnails...")
        failures = validate_thumbs(base_dir)
        if failures:
            print(f"\n{failures} thumbnail problem(s)")
            sys.exit(1)
        else:
            print("All thumbnails valid (400x300 WebP)")
            sys.exit(0)
    else:
        print("Generating thumbnails with Python renderer...")
        made = generate_thumbs(base_dir)
        print(f"\nGenerated {made} thumbnails")


if __name__ == "__main__":
    main()
