"""
Mobiliário e objetos de cenário em pixel art (desenhados diretamente
sobre um Canvas). Coordenadas sempre no canto superior esquerdo.
"""
from __future__ import annotations

from pxlib import Canvas, shade, mix, C, draw_text, text_width, rng

OUT = "#140b22"
WOOD = "#9a5a34"
WOOD_L = "#c07a45"
WOOD_D = "#5e3020"
METAL = "#4a5370"
NEON_G, NEON_C, NEON_P, NEON_Y, NEON_R = "#00f5a0", "#39d6ff", "#9d62ff", "#ffb800", "#ff537a"
BOOK_COLORS = ["#c2457a", "#2f7dd1", "#00b37a", "#ffb800", "#9d62ff", "#e2e8f0", "#ff7a45", "#39d6ff", "#7a4bd1", "#d64545"]


# ---------------------------------------------------------------------------
# Janela com paisagem urbana noturna
# ---------------------------------------------------------------------------
def window(cv: Canvas, x: int, y: int, w: int, h: int, seed: int = 1, moon: bool = True, panes: int = 2) -> None:
    r = rng(seed)
    cv.rect(x - 2, y - 2, w + 4, h + 4, "#2a1c48")
    cv.frame(x - 2, y - 2, w + 4, h + 4, OUT)
    cv.vgrad(x, y, w, h, "#120a35", "#b0477e", steps=7)
    cv.vgrad(x, y, w, h // 2, "#0a0828", "#2b1660", steps=4)
    for _ in range(w * h // 40):
        sx, sy = x + r.randrange(w), y + r.randrange(max(1, h // 2))
        cv.px(sx, sy, "#ffffff" if r.random() < 0.4 else "#b8a8ff")
    if moon:
        mx, my = x + int(w * 0.75), y + 6
        cv.circle(mx, my, 4, "#fff2c4")
        cv.circle(mx + 2, my - 1, 3, mix("#0a0828", "#2b1660", 0.5))
    # skyline em 3 camadas
    for layer, (col, minh, maxh, lit) in enumerate((("#3a1f63", 10, 22, 0.15), ("#26164a", 14, 30, 0.25), ("#170e30", 8, 18, 0.35))):
        bx = x
        while bx < x + w:
            bw = r.randint(5, 11)
            bh = r.randint(minh, maxh) * h // 60
            by = y + h - bh
            cv.rect(bx, by, min(bw, x + w - bx), bh, col)
            if r.random() < 0.25 and layer == 1:
                cv.vline(bx + bw // 2, by - 4, 4, col); cv.px(bx + bw // 2, by - 5, NEON_R)
            for wy in range(by + 2, y + h - 1, 3):
                for wx in range(bx + 1, min(bx + bw - 1, x + w - 1), 2):
                    if r.random() < lit:
                        cv.px(wx, wy, r.choice(["#ffd36b", "#ffd36b", "#7fe6ff", "#ff8ad1"]))
            bx += bw + (0 if layer else 1)
    # caixilhos
    for i in range(1, panes):
        cv.rect(x + w * i // panes - 1, y, 2, h, "#2a1c48")
    cv.rect(x, y + h // 2 - 1, w, 2, "#2a1c48")
    cv.hline(x, y, w, (255, 255, 255, 40))
    cv.rect(x - 3, y + h + 2, w + 6, 2, "#3d2a63")  # peitoril
    cv.hline(x - 3, y + h + 2, w + 6, "#5a4290")


# ---------------------------------------------------------------------------
def bookshelf(cv: Canvas, x: int, y: int, w: int, h: int, seed: int = 2, deco: bool = True) -> None:
    r = rng(seed)
    cv.rect(x, y, w, h, WOOD_D)
    cv.frame(x, y, w, h, OUT)
    cv.hline(x + 1, y + 1, w - 2, WOOD)
    shelf_h = 11
    sy = y + 2
    while sy + shelf_h <= y + h - 2:
        cv.rect(x + 2, sy, w - 4, shelf_h - 2, "#2b1620")
        bx = x + 2
        while bx < x + w - 3:
            if deco and r.random() < 0.12 and bx + 6 < x + w - 2:
                plant_small(cv, bx, sy + shelf_h - 9, r.randrange(3))
                bx += 6
                continue
            bw = r.choice([1, 2, 2, 2, 3])
            bh = r.randint(5, shelf_h - 3)
            col = r.choice(BOOK_COLORS)
            cv.rect(bx, sy + shelf_h - 2 - bh, bw, bh, col)
            cv.vline(bx, sy + shelf_h - 2 - bh, bh, shade(col, 1.25))
            if bh > 5:
                cv.px(bx + bw - 1, sy + shelf_h - bh, shade(col, 0.6))
            bx += bw
            if r.random() < 0.1:
                bx += 1
        cv.rect(x + 1, sy + shelf_h - 2, w - 2, 2, WOOD)
        cv.hline(x + 1, sy + shelf_h - 2, w - 2, WOOD_L)
        sy += shelf_h
    cv.vline(x + 1, y + 1, h - 2, WOOD); cv.vline(x + w - 2, y + 1, h - 2, shade(WOOD, 0.8))


def plant_small(cv: Canvas, x: int, y: int, kind: int = 0) -> None:
    pot = ["#c96b3c", "#e2e8f0", "#7a4bd1"][kind % 3]
    cv.rect(x + 1, y + 5, 4, 4, pot); cv.hline(x, y + 5, 6, shade(pot, 1.2))
    g, gd = "#3fbf6a", "#1f7a45"
    cv.rect(x + 2, y + 1, 2, 4, gd)
    cv.px(x + 1, y + 2, g); cv.px(x + 4, y + 1, g); cv.px(x, y + 3, g); cv.px(x + 5, y + 3, g); cv.px(x + 3, y, g)


def plant_big(cv: Canvas, x: int, y: int, h: int = 30, seed: int = 3, pot: str = "#c96b3c") -> None:
    """Planta grande em vaso (x,y = topo da folhagem)."""
    r = rng(seed)
    w = 18
    pot_y = y + h - 9
    leaves = ["#1f7a45", "#2fa35a", "#4cc36a", "#7ee08a"]
    cx = x + w // 2
    for i in range(22):
        ang = r.uniform(-1.3, 1.3)
        ln = r.randint(h // 3, h - 9)
        lx = cx + int(ang * ln * 0.55)
        ly = pot_y - int(ln * (1 - abs(ang) * 0.35))
        col = r.choice(leaves)
        cv.ellipse(lx, ly, 2, 1, col)
        cv.px(lx, ly - 1, shade(col, 1.25))
        # caule
        for t in range(0, 6):
            px_ = cx + (lx - cx) * t // 6
            py_ = pot_y + (ly - pot_y) * t // 6
            cv.px(px_, py_, "#1a5e36")
    cv.rect(x + 4, pot_y, w - 8, 9, pot)
    cv.rect(x + 3, pot_y, w - 6, 2, shade(pot, 1.2))
    cv.vline(x + w - 5, pot_y + 2, 7, shade(pot, 0.75))
    cv.hline(x + 5, pot_y + 8, w - 10, shade(pot, 0.6))
    cv.frame(x + 3, pot_y, w - 6, 9, OUT)


def hanging_vine(cv: Canvas, x: int, y: int, length: int, seed: int = 4) -> None:
    r = rng(seed)
    for i in range(length):
        dx = int(1.5 * ((i // 3) % 2))
        cv.px(x + dx, y + i, "#1a5e36")
        if r.random() < 0.6:
            side = r.choice([-1, 1])
            cv.px(x + dx + side, y + i, r.choice(["#2fa35a", "#4cc36a", "#7ee08a"]))
            if r.random() < 0.4:
                cv.px(x + dx + 2 * side, y + i, "#2fa35a")


def ceiling_lamp(cv: Canvas, x: int, y: int, cord: int = 6, color: str = "#ffd36b") -> None:
    cv.vline(x + 3, y, cord, "#2a2238")
    cv.rect(x, y + cord, 7, 3, "#3d2f5e"); cv.hline(x + 1, y + cord, 5, "#5a4890")
    cv.rect(x + 1, y + cord + 3, 5, 1, color)
    for i in range(1, 10):
        a = max(0, 34 - i * 4)
        cv.hline(x + 3 - i // 2 - 1, y + cord + 3 + i, i + 3, (255, 214, 120, a))


def neon_sign(cv: Canvas, x: int, y: int, text: str, color: str = NEON_P, scale: int = 2, pad: int = 4, frame_color: str | None = None) -> tuple[int, int]:
    tw = text_width(text, gap=scale, scale=scale)
    w, h = tw + pad * 2, 5 * scale + pad * 2
    cv.glow(x, y, w, h, frame_color or color, alpha=70, spread=4)
    cv.rect(x, y, w, h, "#0d0820")
    cv.frame(x, y, w, h, frame_color or color)
    cv.frame(x + 1, y + 1, w - 2, h - 2, shade(frame_color or color, 0.5))
    draw_text(cv, x + pad + 1, y + pad + 1, text, shade(color, 0.35), scale=scale, gap=scale)
    draw_text(cv, x + pad, y + pad, text, color, scale=scale, gap=scale)
    return w, h


def whiteboard(cv: Canvas, x: int, y: int, w: int, h: int, title: str, items: list[tuple[str, bool]]) -> None:
    cv.rect(x - 2, y - 2, w + 4, h + 4, "#6b4a2a"); cv.frame(x - 2, y - 2, w + 4, h + 4, OUT)
    cv.rect(x, y, w, h, "#1d3b2e")  # quadro verde-escuro estilo lousa
    cv.dither(x, y, w, h, "#21443a")
    draw_text(cv, x + 3, y + 3, title, "#f4f1e6")
    cv.hline(x + 3, y + 9, text_width(title), "#f4f1e6")
    for i, (txt, done) in enumerate(items):
        iy = y + 13 + i * 7
        if iy + 5 > y + h:
            break
        cv.frame(x + 3, iy, 5, 5, "#f4f1e6")
        if done:
            cv.px(x + 4, iy + 2, NEON_G); cv.px(x + 5, iy + 3, NEON_G); cv.px(x + 6, iy + 1, NEON_G); cv.px(x + 7, iy, NEON_G)
        draw_text(cv, x + 10, iy, txt, "#d8f5e6" if not done else "#9fbfae")
    cv.rect(x + w - 10, y + h, 8, 2, "#c9c9c9")


def server_rack(cv: Canvas, x: int, y: int, h: int, seed: int = 5) -> list[tuple[int, int, str]]:
    """Retorna as posições dos LEDs (animados no Phaser)."""
    r = rng(seed)
    w = 16
    cv.rect(x, y, w, h, "#1b1f33"); cv.frame(x, y, w, h, OUT)
    cv.vline(x + 1, y + 1, h - 2, "#2c3352")
    leds = []
    for uy in range(y + 3, y + h - 4, 5):
        cv.rect(x + 2, uy, w - 4, 4, "#262c47"); cv.hline(x + 2, uy, w - 4, "#353d61")
        for lx in (x + 3, x + 5):
            col = r.choice([NEON_G, NEON_C, NEON_G, NEON_R, NEON_Y])
            cv.px(lx, uy + 2, col)
            leds.append((lx, uy + 2, col))
        cv.hline(x + 8, uy + 2, 5, "#11141f")
    return leds


def brain_tank(cv: Canvas, x: int, y: int, h: int = 60) -> None:
    w = 26
    cv.glow(x + 2, y + 8, w - 4, h - 20, NEON_C, alpha=60, spread=5)
    cv.rect(x, y, w, 7, "#3a4566"); cv.hline(x, y, w, "#6c7aa6"); cv.frame(x, y, w, 7, OUT)
    gy, gh = y + 7, h - 19
    cv.rect(x + 2, gy, w - 4, gh, (57, 214, 255, 110))
    cv.dither(x + 2, gy, w - 4, gh, (120, 240, 255, 60))
    for i in range(0, gh, 7):  # bolhas
        cv.px(x + 5 + (i * 3) % (w - 10), gy + gh - i - 2, "#d9fbff")
    cx, cy = x + w // 2, gy + gh // 2 - 2
    cv.ellipse(cx, cy, 8, 6, "#ff7ac1")
    cv.ellipse(cx, cy, 7, 5, "#ff9ad2")
    for (dx, dy) in ((-4, -2), (0, -3), (3, -1), (-2, 2), (4, 2), (-5, 1), (1, 1)):
        cv.px(cx + dx, cy + dy, "#c94a8f"); cv.px(cx + dx + 1, cy + dy, "#c94a8f")
    cv.vline(cx, cy - 5, 11, "#c94a8f")
    cv.vline(cx, cy + 6, gy + gh - cy - 6, "#7fe6ff")
    cv.vline(x + 3, gy, gh, (255, 255, 255, 90)); cv.vline(x + w - 4, gy, gh, (0, 60, 90, 120))
    cv.rect(x - 1, gy + gh, w + 2, 12, "#2c3352"); cv.frame(x - 1, gy + gh, w + 2, 12, OUT)
    cv.hline(x, gy + gh + 1, w, "#4a5580")
    for i in range(4):
        cv.px(x + 4 + i * 5, gy + gh + 6, [NEON_C, NEON_G, NEON_P, NEON_C][i])
    cv.frame(x + 1, gy - 1, w - 2, gh + 2, OUT)


def dna_tube(cv: Canvas, x: int, y: int, h: int = 44) -> None:
    w = 14
    cv.rect(x, y, w, 4, "#3a4566"); cv.frame(x, y, w, 4, OUT)
    cv.rect(x + 1, y + 4, w - 2, h - 10, (57, 214, 255, 70))
    import math
    for i in range(h - 12):
        t = i / 3.0
        a = int((w - 6) / 2 * math.sin(t)) + x + w // 2
        b = int(-(w - 6) / 2 * math.sin(t)) + x + w // 2
        cv.px(a, y + 5 + i, NEON_G); cv.px(b, y + 5 + i, NEON_P)
        if i % 3 == 0:
            for xx in range(min(a, b), max(a, b)):
                cv.px(xx, y + 5 + i, (230, 255, 255, 120))
    cv.rect(x - 1, y + h - 6, w + 2, 6, "#2c3352"); cv.frame(x - 1, y + h - 6, w + 2, 6, OUT)
    cv.frame(x + 1, y + 3, w - 2, h - 8, OUT)


def monitor_screen(cv: Canvas, x: int, y: int, w: int, h: int, kind: str, seed: int = 0) -> None:
    r = rng(seed)
    cv.rect(x, y, w, h, "#071223")
    if kind == "code":
        for i in range(1, h - 1, 2):
            lx = x + 1 + r.randrange(3)
            cv.hline(lx, y + i, r.randint(2, max(3, w - 4)), r.choice([NEON_G, NEON_C, NEON_P, "#e2e8f0"]))
    elif kind == "chart":
        bx = x + 1
        while bx < x + w - 1:
            bh = r.randint(1, h - 2)
            cv.vline(bx, y + h - 1 - bh, bh, r.choice([NEON_C, NEON_G, NEON_P]))
            bx += 2
    elif kind == "graph":
        py_ = y + h - 2
        for gx in range(x + 1, x + w - 1):
            py_ = max(y + 1, min(y + h - 2, py_ + r.choice([-1, 0, 1, -1])))
            cv.px(gx, py_, NEON_G)
            cv.vline(gx, py_ + 1, y + h - 1 - py_ - 1, (0, 245, 160, 60))
    elif kind == "map":
        cv.circle(x + w // 2, y + h // 2, min(w, h) // 2 - 1, NEON_C, fill=False)
        cv.hline(x + 1, y + h // 2, w - 2, (57, 214, 255, 120))
    elif kind == "nodes":
        pts = [(x + 2, y + h // 2), (x + w // 2, y + 2), (x + w // 2, y + h - 3), (x + w - 3, y + h // 2)]
        for (ax, ay) in pts:
            cv.rect(ax - 1, ay - 1, 2, 2, NEON_P)
        cv.hline(x + 3, y + h // 2, w - 6, (157, 98, 255, 140))


def monitor(cv: Canvas, x: int, y: int, w: int = 14, h: int = 10, kind: str = "code", seed: int = 0) -> None:
    cv.rect(x, y, w, h, "#1a1d2e"); cv.frame(x, y, w, h, OUT)
    monitor_screen(cv, x + 1, y + 1, w - 2, h - 2, kind, seed)
    cv.rect(x + w // 2 - 1, y + h, 2, 2, "#2c3352")
    cv.rect(x + w // 2 - 3, y + h + 2, 6, 1, "#3a4566")


def desk_prop(variant: int = 0, seed: int = 0, w: int = 44, palette: str = "wood") -> Canvas:
    """
    Mesa de trabalho isolada (para ordenação por profundidade no Phaser).
    Altura 26px: itens (0-11), tampo (12-14), painel frontal (15-25).
    Personagem sentado: pés em y=20 relativos à mesa, centro x = w//2.
    """
    r = rng(seed * 31 + variant)
    cv = Canvas(w, 26)
    top, front, edge = {
        "wood": (WOOD_L, WOOD, WOOD_D),
        "lab": ("#dfe7f2", "#9aa6bf", "#5d6785"),
        "tech": ("#3b3f66", "#262a48", "#171a30"),
    }[palette]
    # tampo
    cv.rect(0, 12, w, 3, top); cv.hline(0, 12, w, shade(top, 1.2))
    # painel frontal
    cv.rect(1, 15, w - 2, 9, front)
    cv.hline(1, 15, w - 2, edge)
    cv.rect(3, 17, 12, 5, shade(front, 0.88)); cv.frame(3, 17, 12, 5, edge); cv.px(9, 19, NEON_Y if palette == "wood" else NEON_C)
    cv.rect(w - 15, 17, 12, 5, shade(front, 0.88)); cv.frame(w - 15, 17, 12, 5, edge); cv.px(w - 9, 19, NEON_Y if palette == "wood" else NEON_C)
    if palette == "tech":
        cv.hline(16, 20, w - 32, NEON_P)
    cv.rect(1, 24, 2, 2, edge); cv.rect(w - 3, 24, 2, 2, edge)
    # itens sobre a mesa
    kinds = ["code", "chart", "graph", "code", "nodes"]
    side = variant % 2
    mx = w - 17 if side == 0 else 3
    monitor(cv, mx, 0, 14, 9, kinds[(seed + variant) % len(kinds)], seed + variant)
    # teclado e mouse sobre o tampo (deixam o tronco do agente visível)
    kx = w // 2 - 6
    cv.rect(kx, 12, 12, 1, "#2a2f4a"); cv.hline(kx + 1, 12, 10, "#3d4466")
    cv.px(kx + 14, 12, "#c9d3e6")
    # extras
    ex = 3 if side == 0 else w - 9
    choice = r.randrange(4)
    if choice == 0:  # caneca
        cv.rect(ex + 1, 8, 3, 4, "#e2e8f0"); cv.px(ex + 4, 9, "#e2e8f0"); cv.px(ex + 2, 8, "#6b3a1e")
    elif choice == 1:  # livros
        cv.rect(ex, 10, 6, 2, "#c2457a"); cv.rect(ex + 1, 8, 5, 2, "#2f7dd1")
    elif choice == 2:  # luminária
        cv.vline(ex + 1, 5, 7, "#3a4566"); cv.rect(ex, 4, 5, 2, NEON_Y); cv.px(ex + 3, 6, (255, 214, 120, 120))
    else:  # planta
        plant_small(cv, ex, 3, r.randrange(3))
    cv.frame(0, 12, w, 14, OUT)
    return cv


def rug(cv: Canvas, x: int, y: int, w: int, h: int, c1: str = "#5b2a7a", c2: str = "#7c3aa0", border: str = "#ff6fae") -> None:
    cv.rect(x, y, w, h, c1)
    cv.frame(x + 2, y + 1, w - 4, h - 2, border)
    for yy in range(y + 4, y + h - 4, 4):
        for xx in range(x + 6 + (yy // 4 % 2) * 4, x + w - 6, 8):
            cv.px(xx, yy, c2); cv.px(xx + 1, yy, c2); cv.px(xx, yy + 1, c2)
    cv.frame(x, y, w, h, shade(c1, 0.6))


def floor_planks(cv: Canvas, y: int, h: int, base: str = "#2c1f45", seed: int = 7) -> None:
    r = rng(seed)
    cv.rect(0, y, cv.w, h, base)
    for row, yy in enumerate(range(y, y + h, 8)):
        cv.hline(0, yy, cv.w, shade(base, 0.86))
        cv.hline(0, yy + 1, cv.w, shade(base, 1.06))
        off = (row * 29) % 64
        for xx in range(off, cv.w, 64):
            cv.vline(xx, yy, 8, shade(base, 0.86))
        for _ in range(cv.w // 10):
            gx = r.randrange(cv.w)
            cv.hline(gx, yy + r.randint(3, 6), r.randint(2, 6), shade(base, 0.94))


def floor_tiles(cv: Canvas, y: int, h: int, c1: str = "#1c2f4a", c2: str = "#22385a", line: str = "#152238", size: int = 12) -> None:
    for yy in range(y, y + h, size):
        for xx in range(0, cv.w, size):
            cv.rect(xx, yy, size, size, c1 if ((xx // size + yy // size) % 2 == 0) else c2)
            cv.hline(xx, yy, size, line); cv.vline(xx, yy, size, line)


def wall(cv: Canvas, h: int, base: str = "#22163d", panel: str = "#2b1c4c", trim: str = NEON_P) -> None:
    cv.rect(0, 0, cv.w, h, base)
    for xx in range(0, cv.w, 24):
        cv.rect(xx + 2, 8, 20, h - 16, panel)
        cv.hline(xx + 2, 8, 20, shade(panel, 1.15))
    cv.rect(0, 0, cv.w, 4, "#120b24"); cv.hline(0, 4, cv.w, trim); cv.hline(0, 5, cv.w, shade(trim, 0.4))
    cv.rect(0, h - 5, cv.w, 5, "#3a2660"); cv.hline(0, h - 5, cv.w, "#5a3d8f"); cv.hline(0, h - 1, cv.w, OUT)


def couch(cv: Canvas, x: int, y: int, w: int = 40, c: str = "#7a4bd1") -> None:
    cv.rect(x, y, w, 8, shade(c, 0.85)); cv.rect(x, y + 8, w, 8, c)
    cv.rect(x - 3, y + 4, 4, 12, shade(c, 0.7)); cv.rect(x + w - 1, y + 4, 4, 12, shade(c, 0.7))
    cv.hline(x, y + 8, w, shade(c, 1.2)); cv.vline(x + w // 2, y + 8, 7, shade(c, 0.75))
    cv.frame(x - 3, y, w + 6, 16, OUT)


def cat(cv: Canvas, x: int, y: int, frame: int = 0) -> None:
    """Gato laranja dormindo em almofada (16x10)."""
    cv.ellipse(x + 8, y + 8, 8, 2, "#7a4bd1"); cv.ellipse(x + 8, y + 8, 7, 1, "#9d62ff")
    body = "#f29a3a"
    cv.ellipse(x + 8, y + 5 - (1 if frame else 0) // 2, 6, 3 + frame % 2 * 0, body)
    cv.rect(x + 3, y + 4, 4, 3, body)
    cv.px(x + 3, y + 2, body); cv.px(x + 6, y + 2, body)
    cv.hline(x + 5, y + 4, 5, "#c96b1f"); cv.hline(x + 9, y + 6, 3, "#c96b1f")
    cv.px(x + 4, y + 5, OUT); cv.px(x + 6, y + 5, OUT)
    cv.rect(x + 12, y + 6, 3, 1, body)


def robot_bot(cv: Canvas, x: int, y: int) -> None:
    """Robozinho assistente decorativo (20x22)."""
    cv.ellipse(x + 10, y + 7, 9, 7, "#eef2fb")
    cv.rect(x + 3, y + 4, 14, 7, "#0d1630")
    cv.rect(x + 5, y + 6, 3, 3, NEON_C); cv.rect(x + 12, y + 6, 3, 3, NEON_C)
    cv.ellipse(x + 10, y + 17, 6, 4, "#d7deee")
    cv.rect(x + 8, y + 16, 4, 2, NEON_C)
    cv.rect(x + 3, y + 15, 2, 4, "#b9c3da"); cv.rect(x + 15, y + 15, 2, 4, "#b9c3da")
    cv.outline(OUT) if False else None


def hologram_globe(cv: Canvas, x: int, y: int, r_: int = 14, phase: int = 0, color: str = NEON_C) -> None:
    import math
    cx, cy = x + r_, y + r_
    base = C(color)
    cv.circle(cx, cy, r_, (base[0], base[1], base[2], 40))
    cv.circle(cx, cy, r_, color, fill=False)
    for i in range(-2, 3):
        yy = cy + i * r_ // 3
        half = int(math.sqrt(max(0, r_ * r_ - (yy - cy) ** 2)))
        cv.hline(cx - half, yy, half * 2, (base[0], base[1], base[2], 150))
    for k in range(3):
        ang = (phase / 8.0 + k / 3.0) * math.pi
        rx = abs(int(r_ * math.cos(ang)))
        for t in range(0, 64):
            a = t / 64 * 2 * math.pi
            cv.px(cx + int(rx * math.sin(a)), cy + int(r_ * math.cos(a)), (base[0], base[1], base[2], 200))
    cv.px(cx - r_ // 2, cy - r_ // 2, "#ffffff")


def holo_base(cv: Canvas, x: int, y: int, w: int = 36) -> None:
    cv.ellipse(x + w // 2, y + 4, w // 2, 4, "#2c3352")
    cv.ellipse(x + w // 2, y + 3, w // 2 - 2, 3, "#3d4a7a")
    cv.ellipse(x + w // 2, y + 3, w // 2 - 6, 2, NEON_C)
    cv.ellipse(x + w // 2, y + 3, w // 2 - 8, 1, "#d9fbff")
    cv.rect(x + 4, y + 6, w - 8, 6, "#232a45"); cv.hline(x + 4, y + 6, w - 8, "#3d4a7a")
    for i in range(3):
        cv.px(x + 10 + i * 8, y + 9, [NEON_G, NEON_P, NEON_C][i])


def wall_screen(cv: Canvas, x: int, y: int, w: int, h: int, kind: str, color: str = NEON_C, seed: int = 0) -> None:
    cv.glow(x, y, w, h, color, alpha=55, spread=3)
    cv.rect(x - 1, y - 1, w + 2, h + 2, "#1a1d2e"); cv.frame(x - 1, y - 1, w + 2, h + 2, OUT)
    monitor_screen(cv, x, y, w, h, kind, seed)
    cv.frame(x, y, w, h, shade(color, 0.6))


def lab_bench(cv: Canvas, x: int, y: int, w: int = 60, seed: int = 0) -> None:
    r = rng(seed)
    cv.rect(x, y + 10, w, 3, "#dfe7f2"); cv.hline(x, y + 10, w, "#ffffff")
    cv.rect(x + 1, y + 13, w - 2, 12, "#7f8aa6"); cv.frame(x, y + 10, w, 15, OUT)
    for i in range(0, w - 8, 9):
        col = r.choice([NEON_G, NEON_C, NEON_R, NEON_P, NEON_Y])
        fx = x + 3 + i
        cv.rect(fx + 1, y + 2, 2, 3, (200, 230, 255, 160))
        cv.rect(fx, y + 5, 4, 5, (200, 230, 255, 120)); cv.rect(fx, y + 7, 4, 3, col)
        cv.frame(fx, y + 5, 4, 5, OUT) if False else None


def chest(cv: Canvas, x: int, y: int) -> None:
    cv.rect(x, y + 5, 22, 12, "#8a4b2a"); cv.rect(x, y, 22, 6, "#b5683a")
    cv.hline(x, y, 22, "#d98a52"); cv.rect(x, y + 5, 22, 2, NEON_Y)
    cv.vline(x + 3, y, 17, NEON_Y); cv.vline(x + 18, y, 17, NEON_Y)
    cv.rect(x + 9, y + 6, 4, 4, "#fff3a8"); cv.px(x + 10, y + 8, OUT)
    cv.frame(x, y, 22, 17, OUT)


def telescope(cv: Canvas, x: int, y: int) -> None:
    for i in range(14):
        cv.rect(x + i, y + 7 - i // 2, 3, 3, "#8a5a2b" if i < 10 else "#c07a45")
    cv.rect(x + 13, y - 1, 4, 4, "#ffd36b")
    cv.vline(x + 6, y + 8, 12, "#5e3020"); cv.px(x + 2, y + 18, "#5e3020"); cv.px(x + 10, y + 18, "#5e3020")
    for i in range(6):
        cv.px(x + 6 - i, y + 13 + i, "#5e3020"); cv.px(x + 6 + i, y + 13 + i, "#5e3020")


def banner_flag(cv: Canvas, x: int, y: int, w: int = 14, h: int = 24, c: str = "#7a2b8f") -> None:
    cv.hline(x - 1, y, w + 2, NEON_Y)
    cv.rect(x, y + 1, w, h - 4, c)
    for i in range(w // 2):
        cv.vline(x + i, y + h - 3, 3 - i * 3 // w, c); cv.vline(x + w - 1 - i, y + h - 3, 3 - i * 3 // w, c)
    cv.frame(x + 2, y + 3, w - 4, h - 9, NEON_Y)
    cv.rect(x + w // 2 - 2, y + 7, 4, 6, NEON_Y)


def robot_arm(cv: Canvas, x: int, y: int) -> None:
    cv.rect(x, y + 30, 18, 6, "#3a4566"); cv.frame(x, y + 30, 18, 6, OUT)
    cv.rect(x + 6, y + 14, 6, 16, "#ffb800"); cv.frame(x + 6, y + 14, 6, 16, OUT)
    cv.circle(x + 9, y + 14, 4, "#3a4566")
    for i in range(14):
        cv.rect(x + 9 + i, y + 13 - i // 2, 4, 4, "#ffb800")
    cv.circle(x + 24, y + 6, 3, "#3a4566")
    cv.rect(x + 25, y + 6, 6, 3, "#9aa6bf"); cv.px(x + 31, y + 5, NEON_R); cv.px(x + 31, y + 9, NEON_R)


def cube_holo(cv: Canvas, x: int, y: int, s: int = 20, color: str = NEON_C) -> None:
    b = C(color)
    o = s // 3
    cv.rect(x, y + o, s, s, (b[0], b[1], b[2], 50))
    cv.frame(x, y + o, s, s, color); cv.frame(x + o, y, s, s, (b[0], b[1], b[2], 160))
    for i in range(o):
        cv.px(x + i, y + o - i, color); cv.px(x + s - 1 + i, y + o - i, color)
        cv.px(x + i, y + o + s - 1 - i, (b[0], b[1], b[2], 160)); cv.px(x + s - 1 + i, y + o + s - 1 - i, color)


def chair_back(cv: Canvas, cx: int, top: int, color: str = "#3a2a66") -> None:
    """Encosto da cadeira (desenhado no fundo, atrás do personagem sentado)."""
    cv.rect(cx - 10, top + 2, 20, 12, color)
    cv.rect(cx - 9, top, 18, 2, color)
    cv.hline(cx - 9, top, 18, shade(color, 1.35))
    cv.vline(cx - 9, top + 2, 11, shade(color, 1.2))
    cv.vline(cx + 9, top + 2, 11, shade(color, 0.7))
    cv.frame(cx - 10, top + 1, 20, 13, OUT)
