"""
Props do "mundo" (escala de grade 16px): mesas, cadeiras, sofás, café, reator etc.
Cada função retorna um Canvas; a âncora é sempre a base (chão) da imagem.
"""
from __future__ import annotations

from pxlib import Canvas, shade, C, draw_text, rng
import props as P

OUT = "#140b22"
T = 16


def desk_pc(w_tiles: int = 3, kind: str = "dual", seed: int = 0, palette: str = "dark") -> Canvas:
    """Mesa vista de cima/3-4 com monitor(es) virados para a câmera. Pegada: w x 1 tiles."""
    w = w_tiles * T
    cv = Canvas(w, 34)
    top, front, edge = {"dark": ("#3a2f5c", "#2a2246", "#1a1530"), "wood": (P.WOOD_L, P.WOOD, P.WOOD_D), "lab": ("#dfe7f2", "#9aa6bf", "#5d6785")}[palette]
    cv.rect(0, 16, w, 11, top); cv.hline(0, 16, w, shade(top, 1.25))
    cv.rect(0, 27, w, 7, front); cv.hline(0, 27, w, edge)
    cv.rect(1, 33, 2, 1, edge); cv.rect(w - 3, 33, 2, 1, edge)
    kinds = ["code", "chart", "graph", "nodes"]
    r = rng(seed)
    if kind == "dual":
        mw = 18
        for i, mx in enumerate((w // 2 - mw - 1, w // 2 + 1)):
            cv.rect(mx, 2, mw, 13, "#151827"); cv.frame(mx, 2, mw, 13, OUT)
            P.monitor_screen(cv, mx + 1, 3, mw - 2, 10, kinds[(seed + i) % 4], seed + i)
            cv.rect(mx + mw // 2 - 1, 15, 2, 3, "#2c3352")
    elif kind == "single":
        mx = w // 2 - 10
        cv.rect(mx, 1, 20, 14, "#151827"); cv.frame(mx, 1, 20, 14, OUT)
        P.monitor_screen(cv, mx + 1, 2, 18, 11, kinds[seed % 4], seed)
        cv.rect(mx + 9, 15, 2, 3, "#2c3352")
    elif kind == "laptop":
        mx = w // 2 - 8
        cv.rect(mx, 7, 16, 10, "#1c2036"); cv.frame(mx, 7, 16, 10, OUT)
        P.monitor_screen(cv, mx + 1, 8, 14, 8, kinds[seed % 4], seed)
        cv.rect(mx - 1, 17, 18, 3, "#9aa6bf"); cv.hline(mx, 18, 16, "#c9d3e6")
    # teclado / itens
    cv.rect(w // 2 - 7, 21, 14, 3, "#1b1f33"); cv.hline(w // 2 - 6, 22, 12, "#3d4466")
    if r.random() < 0.6:
        cv.rect(3, 18, 3, 4, "#e9edf5"); cv.px(4, 18, "#6b3a1e")
    if r.random() < 0.6:
        cv.rect(w - 9, 19, 6, 2, "#c2457a"); cv.rect(w - 8, 17, 5, 2, "#2f7dd1")
    cv.frame(0, 16, w, 18, OUT)
    return cv


def chair(facing: str = "up", color: str = "#3a2a66") -> Canvas:
    """Cadeira: 'up' = vista de costas (encosto à frente do personagem)."""
    cv = Canvas(16, 20)
    if facing == "up":
        cv.rect(2, 8, 12, 9, color); cv.hline(2, 8, 12, shade(color, 1.35)); cv.vline(13, 9, 8, shade(color, 0.7))
        cv.rect(7, 17, 2, 2, "#1b1f33"); cv.hline(4, 19, 8, "#1b1f33")
        cv.frame(2, 8, 12, 9, OUT)
    else:
        cv.rect(2, 0, 12, 10, color); cv.hline(2, 0, 12, shade(color, 1.35))
        cv.rect(1, 10, 14, 5, shade(color, 0.85)); cv.frame(2, 0, 12, 10, OUT)
        cv.hline(4, 19, 8, "#1b1f33"); cv.rect(7, 15, 2, 4, "#1b1f33")
    return cv


def big_table(w_tiles: int, h_tiles: int, seed: int = 1, top: str = "#4b3a7a") -> Canvas:
    w, h = w_tiles * T, h_tiles * T
    cv = Canvas(w, h + 8)
    cv.rect(0, 2, w, h - 2, top); cv.hline(0, 2, w, shade(top, 1.3))
    cv.rect(0, h, w, 8, shade(top, 0.6)); cv.hline(0, h, w, shade(top, 0.45))
    cv.frame(0, 2, w, h + 6, OUT)
    r = rng(seed)
    for i in range(max(1, w_tiles // 2)):
        x = 8 + i * (w - 24) // max(1, w_tiles // 2 - 1 if w_tiles > 3 else 1)
        if x > w - 20:
            break
        y = 6 + (i % 2) * (h - 22)
        # notebook aberto (tela visível)
        cv.rect(x, y, 14, 8, "#1c2036"); P.monitor_screen(cv, x + 1, y + 1, 12, 6, ["code", "chart", "graph"][i % 3], seed + i)
        cv.rect(x - 1, y + 8, 16, 3, "#9aa6bf")
    for _ in range(3):
        px, py = r.randint(4, w - 10), r.randint(6, h - 10)
        cv.rect(px, py, 6, 4, "#f1ecff"); cv.hline(px + 1, py + 1, 4, "#9d62ff")
    cv.rect(w - 14, 6, 4, 5, "#e9edf5"); cv.px(w - 13, 6, "#6b3a1e")
    return cv


def couch(w_tiles: int = 3, color: str = "#b5317a") -> Canvas:
    w = w_tiles * T
    cv = Canvas(w, 28)
    cv.rect(2, 0, w - 4, 12, shade(color, 0.85)); cv.hline(2, 0, w - 4, shade(color, 1.2))
    cv.rect(0, 10, w, 12, color); cv.hline(0, 10, w, shade(color, 1.3))
    cv.rect(0, 6, 5, 18, shade(color, 0.7)); cv.rect(w - 5, 6, 5, 18, shade(color, 0.7))
    for i in range(1, w_tiles):
        cv.vline(i * T, 11, 10, shade(color, 0.75))
    cv.rect(2, 22, w - 4, 4, shade(color, 0.55))
    cv.rect(8, 4, 8, 6, "#ffb800"); cv.rect(w - 16, 4, 8, 6, "#39d6ff")
    cv.frame(0, 0, w, 26, OUT)
    return cv


def beanbag(color: str = "#ffb800") -> Canvas:
    cv = Canvas(28, 22)
    cv.ellipse(14, 13, 13, 8, shade(color, 0.75)); cv.ellipse(14, 11, 12, 8, color)
    cv.ellipse(10, 8, 5, 3, shade(color, 1.3))
    cv.outline(OUT)
    return cv


def armchair(color: str = "#7a4bd1") -> Canvas:
    cv = Canvas(22, 24)
    cv.rect(3, 0, 16, 12, shade(color, 0.85)); cv.rect(1, 9, 20, 10, color)
    cv.rect(0, 6, 4, 14, shade(color, 0.7)); cv.rect(18, 6, 4, 14, shade(color, 0.7))
    cv.hline(1, 9, 20, shade(color, 1.3)); cv.rect(3, 19, 16, 3, shade(color, 0.5))
    cv.outline(OUT)
    return cv


def coffee_counter(w_tiles: int = 5) -> Canvas:
    w = w_tiles * T
    cv = Canvas(w, 44)
    # prateleira de parede com xícaras
    cv.rect(4, 0, w - 8, 3, P.WOOD); cv.hline(4, 0, w - 8, P.WOOD_L)
    for i in range(5):
        cv.rect(8 + i * 10, -0 + 3, 5, 4, ["#ff537a", "#39d6ff", "#ffb800", "#00f5a0", "#e9edf5"][i])
    # máquina de café
    cv.rect(6, 10, 18, 18, "#2c3352"); cv.rect(8, 12, 14, 6, "#11141f"); cv.px(10, 14, "#00f5a0"); cv.px(13, 14, "#ff537a")
    cv.rect(12, 20, 6, 6, "#11141f"); cv.rect(13, 24, 4, 3, "#e9edf5")
    cv.frame(6, 10, 18, 18, OUT)
    # balcão
    cv.rect(0, 26, w, 6, "#d9a066"); cv.hline(0, 26, w, "#f2c48a")
    cv.rect(1, 32, w - 2, 12, P.WOOD); cv.hline(1, 32, w - 2, P.WOOD_D)
    for x in range(8, w - 8, 14):
        cv.rect(x, 35, 10, 6, shade(P.WOOD, 0.85))
    # doces / copos
    cv.rect(30, 21, 10, 5, "#f1ecff"); cv.rect(31, 19, 3, 2, "#ff9ad2"); cv.rect(35, 19, 3, 2, "#ffd36b")
    cv.rect(w - 22, 20, 4, 6, "#e9edf5"); cv.rect(w - 16, 20, 4, 6, "#e9edf5")
    P.plant_small(cv, w - 10, 17, 0)
    cv.frame(0, 26, w, 18, OUT)
    return cv


def round_table() -> Canvas:
    cv = Canvas(28, 24)
    cv.ellipse(14, 8, 13, 6, "#e6ecff"); cv.ellipse(14, 7, 12, 5, "#f6f8ff")
    cv.rect(12, 13, 4, 8, "#3a4566"); cv.ellipse(14, 21, 7, 2, "#3a4566")
    cv.rect(8, 4, 3, 4, "#ff537a"); cv.rect(17, 5, 3, 4, "#39d6ff")
    cv.outline(OUT)
    return cv


def water_cooler() -> Canvas:
    cv = Canvas(14, 30)
    cv.rect(3, 0, 8, 10, (57, 214, 255, 160)); cv.frame(3, 0, 8, 10, "#1f8fb8")
    cv.rect(1, 10, 12, 20, "#e6ecff"); cv.rect(4, 14, 6, 3, "#2c3352"); cv.px(5, 15, "#ff537a"); cv.px(8, 15, "#39d6ff")
    cv.outline(OUT)
    return cv


def floor_lamp(color: str = "#ffd36b") -> Canvas:
    cv = Canvas(14, 40)
    cv.rect(2, 0, 10, 8, "#3d2f5e"); cv.hline(3, 0, 8, "#5a4890"); cv.rect(3, 7, 8, 2, color)
    cv.vline(7, 9, 28, "#2a2238"); cv.rect(3, 37, 9, 3, "#2a2238")
    return cv


def standing_board(w: int = 80, h: int = 56, title: str = "EXPERIMENTOS", items=None) -> Canvas:
    items = items or [("RAG MULTIMODAL", True), ("FINE-TUNING", False), ("AVALIACAO A/B", False)]
    cv = Canvas(w, h + 14)
    cv.glow(2, 2, w - 4, h - 4, P.NEON_C, alpha=60, spread=2)
    cv.rect(0, 0, w, h, "#0e1a33"); cv.frame(0, 0, w, h, P.NEON_C); cv.frame(1, 1, w - 2, h - 2, "#1f4f7a")
    draw_text(cv, 6, 6, title, "#e6ecff")
    cv.hline(6, 12, w - 12, (57, 214, 255, 120))
    for i, (t, done) in enumerate(items):
        y = 17 + i * 11
        cv.frame(6, y, 7, 7, P.NEON_C)
        if done:
            cv.rect(8, y + 2, 3, 3, P.NEON_G)
        draw_text(cv, 16, y + 1, t, "#bfefff" if not done else P.NEON_G)
    cv.rect(w // 2 - 2, h, 4, 10, "#3a4566"); cv.rect(w // 2 - 14, h + 10, 28, 4, "#2c3352")
    return cv


def wall_monitor_stand(w: int = 44, h: int = 30, kind: str = "chart", color: str = P.NEON_C, seed: int = 0) -> Canvas:
    cv = Canvas(w + 4, h + 18)
    P.wall_screen(cv, 2, 2, w, h, kind, color, seed)
    cv.rect(w // 2, h + 3, 4, 10, "#3a4566"); cv.rect(w // 2 - 8, h + 13, 20, 3, "#2c3352")
    return cv


def railing(w: int, glass: bool = False) -> Canvas:
    cv = Canvas(w, 14)
    if glass:
        cv.rect(0, 2, w, 9, (120, 220, 255, 55)); cv.hline(0, 2, w, P.NEON_C); cv.hline(0, 11, w, "#2c3352")
        for x in range(0, w, 24):
            cv.vline(x, 1, 12, "#9aa6bf")
    else:
        cv.hline(0, 1, w, "#c07a45"); cv.hline(0, 2, w, "#7a4a2a")
        for x in range(2, w, 8):
            cv.vline(x, 3, 9, "#5e3020")
        cv.hline(0, 12, w, "#3a2238")
    return cv


def stairs_rail(h: int) -> Canvas:
    cv = Canvas(4, h)
    cv.vline(1, 0, h, "#c07a45"); cv.vline(2, 0, h, "#7a4a2a")
    return cv


def globe_base() -> Canvas:
    cv = Canvas(36, 20)
    P.holo_base(cv, 0, 4, 36)
    return cv


def reactor(w: int = 140, h: int = 196) -> Canvas:
    """Reator central do laboratório (cérebro holográfico é animado no Phaser)."""
    cv = Canvas(w, h)
    cx = w // 2
    # topo / dutos
    cv.rect(cx - 50, 0, 100, 16, "#2c3352"); cv.hline(cx - 50, 0, 100, "#4a5580"); cv.frame(cx - 50, 0, 100, 16, OUT)
    for i in range(5):
        cv.px(cx - 40 + i * 20, 8, [P.NEON_C, P.NEON_P, P.NEON_G, P.NEON_C, P.NEON_P][i])
    cv.rect(cx - 58, 16, 116, 12, "#3a4566"); cv.frame(cx - 58, 16, 116, 12, OUT)
    # cilindro de vidro
    gy, gh = 28, h - 80
    cv.glow(cx - 46, gy, 92, gh, P.NEON_C, alpha=70, spread=6)
    cv.rect(cx - 46, gy, 92, gh, (40, 200, 255, 70))
    cv.dither(cx - 46, gy, 92, gh, (120, 240, 255, 40))
    for x in (cx - 46, cx - 24, cx + 22, cx + 44):
        cv.vline(x, gy, gh, (200, 250, 255, 120))
    cv.vline(cx - 40, gy, gh, (255, 255, 255, 110))
    cv.frame(cx - 47, gy - 1, 94, gh + 2, OUT)
    # base
    by = gy + gh
    cv.rect(cx - 60, by, 120, 14, "#2c3352"); cv.hline(cx - 60, by, 120, "#4a5580")
    cv.rect(cx - 68, by + 14, 136, 18, "#232a45"); cv.hline(cx - 68, by + 14, 136, "#3d4a7a")
    for i in range(8):
        cv.rect(cx - 60 + i * 15, by + 19, 8, 3, [P.NEON_C, P.NEON_G, P.NEON_P][i % 3])
    cv.rect(cx - 74, by + 32, 148, 16, "#1b2036"); cv.hline(cx - 74, by + 32, 148, P.NEON_C)
    cv.frame(cx - 74, by, 148, 48, OUT)
    # consoles laterais
    for sx in (cx - 74, cx + 50):
        cv.rect(sx, by - 16, 24, 16, "#262c47"); cv.frame(sx, by - 16, 24, 16, OUT)
        P.monitor_screen(cv, sx + 3, by - 13, 18, 9, "graph", sx)
    return cv


def brain_holo(frame: int = 0) -> Canvas:
    """Cérebro holográfico (2 quadros) desenhado sobre o reator (blend ADD no Phaser)."""
    cv = Canvas(72, 56)
    cx, cy = 36, 28
    glow = (255, 90, 190, 70) if frame == 0 else (255, 120, 210, 90)
    cv.ellipse(cx, cy, 31, 23, glow)
    for side in (-1, 1):
        hx = cx + side * 13
        cv.ellipse(hx, cy - 2, 14, 17, (255, 110, 200, 150))
        cv.ellipse(hx, cy - 2, 12, 15, (255, 150, 220, 120))
    # sulcos (giros)
    import math
    for k in range(5):
        for t in range(60):
            a = t / 60 * math.pi * 2
            r = 4 + k * 2.4
            x = int(cx - 13 + r * math.cos(a) * 1.0)
            y = int(cy - 2 + r * 1.2 * math.sin(a + frame * 0.6))
            if (t + k) % 3:
                cv.px(x, y, "#ffd1ea")
                cv.px(2 * cx - x, y, "#ffd1ea")
    cv.vline(cx, cy - 18, 34, "#9ff4ff")
    cv.circle(cx, cy - 2, 26, (57, 214, 255, 200), fill=False)
    for i in range(8):
        a = i / 8 * math.pi * 2 + frame * 0.4
        cv.rect(int(cx + 28 * math.cos(a)), int(cy - 2 + 20 * math.sin(a)), 2, 2, "#9ff4ff")
    return cv


def holo_table(w: int = 80) -> Canvas:
    cv = Canvas(w, 30)
    cv.ellipse(w // 2, 10, w // 2 - 2, 9, "#2c3352"); cv.ellipse(w // 2, 9, w // 2 - 4, 7, "#3d4a7a")
    cv.ellipse(w // 2, 9, w // 2 - 10, 4, P.NEON_C); cv.ellipse(w // 2, 9, w // 2 - 14, 3, "#123a52")
    cv.rect(w // 2 - 20, 16, 40, 12, "#232a45"); cv.hline(w // 2 - 20, 16, 40, "#3d4a7a")
    for i in range(4):
        cv.px(w // 2 - 14 + i * 9, 22, [P.NEON_G, P.NEON_P, P.NEON_C, P.NEON_Y][i])
    cv.outline(OUT)
    return cv


def jar_shelf(w: int = 64, h: int = 56, seed: int = 4) -> Canvas:
    r = rng(seed)
    cv = Canvas(w, h)
    cv.rect(0, 0, w, h, "#2a2f4a"); cv.frame(0, 0, w, h, OUT)
    for sy in range(4, h - 6, 13):
        cv.rect(2, sy + 9, w - 4, 2, "#5d6785")
        x = 4
        while x < w - 8:
            jw = r.choice([4, 5, 6]); jh = r.randint(5, 8)
            col = r.choice([P.NEON_G, P.NEON_C, P.NEON_R, P.NEON_P, P.NEON_Y])
            cv.rect(x, sy + 9 - jh, jw, jh, (200, 230, 255, 140)); cv.rect(x, sy + 9 - jh + 2, jw, jh - 2, col)
            cv.hline(x, sy + 9 - jh, jw, "#e6ecff")
            x += jw + r.randint(1, 3)
    return cv


def plant_tube() -> Canvas:
    cv = Canvas(24, 52)
    cv.rect(2, 0, 20, 5, "#3a4566"); cv.frame(2, 0, 20, 5, OUT)
    cv.glow(4, 6, 16, 32, P.NEON_G, alpha=50, spread=3)
    cv.rect(4, 5, 16, 34, (0, 245, 160, 60)); cv.vline(6, 5, 34, (255, 255, 255, 90))
    for i in range(6):
        cv.px(12 + (1 if i % 2 else -2), 30 - i * 4, "#2fa35a"); cv.px(12 + (2 if i % 2 else -3), 29 - i * 4, "#7ee08a")
    cv.vline(12, 12, 26, "#1a5e36")
    cv.rect(1, 39, 22, 13, "#2c3352"); cv.hline(1, 39, 22, P.NEON_G); cv.frame(1, 39, 22, 13, OUT)
    return cv


def server_rack_prop(h: int = 52) -> tuple[Canvas, list]:
    cv = Canvas(16, h)
    leds = P.server_rack(cv, 0, 0, h, seed=h)
    return cv, leds


def bookshelf_prop(w: int = 40, h: int = 52, seed: int = 2) -> Canvas:
    cv = Canvas(w, h)
    P.bookshelf(cv, 0, 0, w, h, seed=seed)
    return cv


def plant_prop(h: int = 34, seed: int = 3, pot: str = "#c96b3c") -> Canvas:
    cv = Canvas(20, h + 2)
    P.plant_big(cv, 1, 0, h, seed=seed, pot=pot)
    return cv


def small_plant_prop(kind: int = 0) -> Canvas:
    cv = Canvas(8, 10)
    P.plant_small(cv, 1, 0, kind)
    return cv


def telescope_prop() -> Canvas:
    cv = Canvas(22, 28)
    P.telescope(cv, 2, 6)
    return cv


def brain_tank_prop(h: int = 64) -> Canvas:
    cv = Canvas(30, h + 2)
    P.brain_tank(cv, 2, 0, h)
    return cv


def dna_tube_prop() -> Canvas:
    cv = Canvas(18, 48)
    P.dna_tube(cv, 2, 0, 46)
    return cv


def lab_bench_prop(w: int = 80, seed: int = 0) -> Canvas:
    cv = Canvas(w, 28)
    P.lab_bench(cv, 0, 2, w, seed=seed)
    return cv


def cat_bed() -> Canvas:
    cv = Canvas(26, 14)
    cv.ellipse(13, 9, 12, 4, "#7a4bd1"); cv.ellipse(13, 8, 10, 3, "#9d62ff"); cv.ellipse(13, 8, 7, 2, "#5a2f9a")
    cv.outline(OUT)
    return cv


def robot_dock() -> Canvas:
    cv = Canvas(24, 12)
    cv.ellipse(12, 7, 11, 4, "#2c3352"); cv.ellipse(12, 6, 8, 2, P.NEON_C)
    return cv


def wall_shelf_books(w: int = 60, seed: int = 9) -> Canvas:
    r = rng(seed)
    cv = Canvas(w, 16)
    cv.rect(0, 12, w, 3, P.WOOD); cv.hline(0, 12, w, P.WOOD_L)
    x = 2
    while x < w - 4:
        bw = r.choice([2, 3]); bh = r.randint(6, 11)
        col = r.choice(P.BOOK_COLORS)
        cv.rect(x, 12 - bh, bw, bh, col); cv.vline(x, 12 - bh, bh, shade(col, 1.3))
        x += bw + (1 if r.random() < 0.2 else 0)
    return cv


def light_blob(radius: int, color: str) -> Canvas:
    """Halo suave (usado com blend ADD) para iluminação neon discreta."""
    d = radius * 2
    cv = Canvas(d, d)
    base = C(color)
    for y in range(d):
        for x in range(d):
            dist = ((x - radius) ** 2 + (y - radius) ** 2) ** 0.5 / radius
            if dist < 1:
                a = int(255 * (1 - dist) ** 2 * 0.6)
                cv.p[x, y] = (base[0], base[1], base[2], a)
    return cv
