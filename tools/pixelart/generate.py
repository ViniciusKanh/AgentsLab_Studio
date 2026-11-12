"""
Gera todos os assets pixel art do AgentsLab_Studio.

Uso (a partir de apps/web):  npm run assets
ou diretamente:               python tools/pixelart/generate.py

Requisitos: Python 3.10+ e Pillow (pip install pillow).
Saída: apps/web/public/assets/** e apps/web/src/game/data/rooms.json
"""
from __future__ import annotations

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from PIL import Image  # noqa: E402

from pxlib import Canvas  # noqa: E402
import characters as CH  # noqa: E402
import props as P  # noqa: E402
import rooms as R  # noqa: E402
import icons as I  # noqa: E402
import world_maps as WM  # noqa: E402
import world_props as WPR  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
WEB = os.path.join(ROOT, "apps", "web")
ASSETS = os.path.join(WEB, "public", "assets")
DATA = os.path.join(WEB, "src", "game", "data")


def out(*parts: str) -> str:
    p = os.path.join(ASSETS, *parts)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    return p


def build_branding() -> None:
    """Recorta e adapta o logotipo original (tools/branding/source)."""
    src = os.path.join(ROOT, "tools", "branding", "source", "agentslab-logo-original.png")
    if not os.path.exists(src):
        print("! logotipo original não encontrado, pulando branding")
        return
    im = Image.open(src).convert("RGBA")
    full = im.crop(im.getbbox())
    emblem = im.crop((93, 15, 725, 697))
    emblem = emblem.crop(emblem.getbbox())
    word = im.crop((746, 15, 2117, 697))
    word = word.crop(word.getbbox())

    def fit(img: Image.Image, h: int) -> Image.Image:
        w = round(img.width * h / img.height)
        return img.resize((w, h), Image.LANCZOS)

    fit(full, 240).save(out("branding", "logo-horizontal.png"))
    fit(full, 96).save(out("branding", "logo-horizontal-sm.png"))
    fit(word, 120).save(out("branding", "logo-wordmark.png"))
    for s in (512, 192, 128, 64):
        sq = Image.new("RGBA", (s, s), (0, 0, 0, 0))
        e = emblem.copy(); e.thumbnail((s, s), Image.LANCZOS)
        sq.alpha_composite(e, ((s - e.width) // 2, (s - e.height) // 2))
        name = {512: "icon-512.png", 192: "icon-192.png", 128: "logo-emblem.png", 64: "logo-emblem-64.png"}[s]
        sq.save(out("branding", name))
    fav = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    e = emblem.copy(); e.thumbnail((64, 64), Image.LANCZOS)
    fav.alpha_composite(e, ((64 - e.width) // 2, (64 - e.height) // 2))
    fav.resize((32, 32), Image.LANCZOS).save(os.path.join(WEB, "public", "favicon-32.png"))
    fav.save(os.path.join(WEB, "public", "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])
    big = Image.new("RGBA", (180, 180), (8, 14, 26, 255))
    e = emblem.copy(); e.thumbnail((160, 160), Image.LANCZOS)
    big.alpha_composite(e, ((180 - e.width) // 2, (180 - e.height) // 2))
    big.save(os.path.join(WEB, "public", "apple-touch-icon.png"))


def compose_preview(bg: Canvas, meta: dict, sheet: Canvas) -> Image.Image:
    """Miniatura estática: fundo + mesas + personagens trabalhando (y-sort)."""
    img = bg.img.copy()
    items = []
    for i, (st, desk) in enumerate(zip(meta["stations"], meta["desks"])):
        row = (i + 1) % len(CH.CAST)
        fr = sheet.img.crop((10 * CH.FW, row * CH.FH, 11 * CH.FW, (row + 1) * CH.FH))
        items.append((st["seat"]["y"], fr, st["seat"]["x"] - CH.FW // 2, st["seat"]["y"] - CH.FH))
        d = P.desk_prop(desk["variant"], 7, 44, desk["palette"]).img
        items.append((desk["y"] + 26, d, desk["x"], desk["y"]))
    for _, im, x, y in sorted(items, key=lambda t: t[0]):
        img.alpha_composite(im, (x, y))
    return img


def main() -> None:
    build_branding()

    # personagens
    sheet = CH.spritesheet()
    sheet.save(out("sprites", "characters.png"))
    for spec in CH.CAST:
        CH.portrait(spec).save(out("avatars", f"{spec['id']}.png"), scale=4)


    # globo holográfico (8 quadros)
    globe = Canvas(32 * 8, 32)
    for f in range(8):
        P.hologram_globe(globe, f * 32 + 2, 2, 13, phase=f)
    globe.save(out("sprites", "globe.png"))

    # gato (2 quadros) para respiração
    catc = Canvas(32, 12)
    P.cat(catc, 0, 0, 0); P.cat(catc, 16, 1, 1)
    catc.save(out("sprites", "cat.png"))

    # ícones de estado
    st = Canvas(8 * len(I.STATE_ICONS), 8)
    for i, (k, ic) in enumerate(I.STATE_ICONS.items()):
        st.blit(ic, i * 8, 0)
    st.save(out("sprites", "state_icons.png"))

    for k, fn in I.UI_ICONS.items():
        fn().save(out("ui", f"icon-{k}.png"), scale=2)
    for k, fn in I.PROVIDERS.items():
        fn().save(out("ui", f"provider-{k}.png"), scale=2)
    I.chest_icon().save(out("ui", "chest.png"), scale=3)

    # salas
    rooms_meta = []
    for fn in (R.office, R.research_lab, R.orchestration):
        cv, meta = fn()
        if meta["id"] == "orchestration":
            compose_preview(cv, meta, sheet).save(out("environments", f"{meta['id']}_preview.png"))
    for name, fn in (("library", R.library), ("arena", R.arena), ("automation", R.automation), ("projects", R.projects)):
        cv = fn()
        cv.save(out("environments", f"{name}_preview.png"))

    # (v1) salas 384x192 mantidas apenas como miniaturas de ambientes planejados

    # ---------------- mundo (redesign imersivo) ----------------
    world_assets = os.path.join(ASSETS, "world")
    world_data = os.path.join(WEB, "src", "world", "data")
    for builder in (WM.build_office, WM.build_lab):
        wm = builder()
        wm.export(world_assets, world_data)
        prev = wm.ground.img.copy()
        for pr in sorted(wm.props, key=lambda q: q["depth"]):
            prev.alpha_composite(pr["img"].img, (max(0, pr["x"]), max(0, pr["y"])))
        prev.save(os.path.join(world_assets, f"{wm.id}_preview.png"))
    holo = Canvas(72 * 2, 56)
    for f in range(2):
        holo.blit(WPR.brain_holo(f), f * 72, 0)
    holo.save(os.path.join(world_assets, "brain_holo.png"))
    for name, col in (("cyan", "#39d6ff"), ("pink", "#ff537a"), ("gold", "#ffb800"), ("purple", "#9d62ff"), ("green", "#00f5a0"), ("magenta", "#ff7ac1"), ("warm", "#ffd36b")):
        WPR.light_blob(32, col).save(os.path.join(world_assets, f"light_{name}.png"))
    # emotes 8x8 (balões ambientais)
    emotes = Canvas(8 * len(I.EMOTES), 8)
    for i, ic in enumerate(I.EMOTES.values()):
        emotes.blit(ic, i * 8, 0)
    emotes.save(out("sprites", "emotes.png"))
    with open(os.path.join(world_data, "meta.json"), "w", encoding="utf-8") as fh:
        json.dump({"frameW": CH.FW, "frameH": CH.FH, "framesPerChar": CH.FRAMES_PER_CHAR, "cast": [c["id"] for c in CH.CAST],
                   "stateIcons": list(I.STATE_ICONS.keys()), "emotes": list(I.EMOTES.keys())}, fh, ensure_ascii=False, indent=1)

    # banner do cabeçalho e decoração da sidebar
    R.header_banner(CH.character_strip(CH.CAST[0])).save(out("ui", "header-banner.png"))
    R.sidebar_deco().save(out("ui", "sidebar-deco.png"))
    print("assets gerados em", ASSETS)


if __name__ == "__main__":
    main()
