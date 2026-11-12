"""
pxlib — utilitários mínimos para desenhar pixel art com Pillow.

Todo o conteúdo visual do AgentsLab_Studio (personagens, móveis, salas,
ícones) é desenhado proceduralmente por estes helpers, o que garante
assets originais, versionáveis e regeneráveis (`npm run assets`).
"""
from __future__ import annotations

import random
from PIL import Image

RGBA = tuple[int, int, int, int]


def hex2rgba(h: str, a: int = 255) -> RGBA:
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def shade(c: str | RGBA, f: float) -> RGBA:
    """Escurece (f<1) ou clareia (f>1) uma cor mantendo alfa."""
    if isinstance(c, str):
        c = hex2rgba(c)
    r, g, b, a = c
    if f >= 1:
        k = f - 1
        return (int(r + (255 - r) * k), int(g + (255 - g) * k), int(b + (255 - b) * k), a)
    return (int(r * f), int(g * f), int(b * f), a)


def mix(c1: str | RGBA, c2: str | RGBA, t: float) -> RGBA:
    if isinstance(c1, str):
        c1 = hex2rgba(c1)
    if isinstance(c2, str):
        c2 = hex2rgba(c2)
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(4))  # type: ignore


def C(c) -> RGBA:
    if c is None:
        return (0, 0, 0, 0)
    if isinstance(c, str):
        return hex2rgba(c)
    if len(c) == 3:
        return (c[0], c[1], c[2], 255)
    return c


class Canvas:
    """Superfície de desenho com primitivas de pixel art."""

    def __init__(self, w: int, h: int, bg=None):
        self.w, self.h = w, h
        self.img = Image.new("RGBA", (w, h), C(bg))
        self.p = self.img.load()

    # ---------- primitivas ----------
    def px(self, x: int, y: int, c) -> None:
        if 0 <= x < self.w and 0 <= y < self.h:
            col = C(c)
            if col[3] == 255 or col[3] == 0:
                if col[3] == 255:
                    self.p[x, y] = col
            else:  # composição alfa simples
                br, bg_, bb, ba = self.p[x, y]
                a = col[3] / 255
                self.p[x, y] = (
                    int(col[0] * a + br * (1 - a)),
                    int(col[1] * a + bg_ * (1 - a)),
                    int(col[2] * a + bb * (1 - a)),
                    max(ba, col[3]),
                )

    def get(self, x: int, y: int) -> RGBA:
        if 0 <= x < self.w and 0 <= y < self.h:
            return self.p[x, y]
        return (0, 0, 0, 0)

    def rect(self, x: int, y: int, w: int, h: int, c) -> None:
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.px(xx, yy, c)

    def clear_rect(self, x: int, y: int, w: int, h: int) -> None:
        for yy in range(max(0, y), min(self.h, y + h)):
            for xx in range(max(0, x), min(self.w, x + w)):
                self.p[xx, yy] = (0, 0, 0, 0)

    def frame(self, x: int, y: int, w: int, h: int, c) -> None:
        self.hline(x, y, w, c)
        self.hline(x, y + h - 1, w, c)
        self.vline(x, y, h, c)
        self.vline(x + w - 1, y, h, c)

    def hline(self, x: int, y: int, w: int, c) -> None:
        for xx in range(x, x + w):
            self.px(xx, y, c)

    def vline(self, x: int, y: int, h: int, c) -> None:
        for yy in range(y, y + h):
            self.px(x, yy, c)

    def vgrad(self, x: int, y: int, w: int, h: int, c1, c2, steps: int = 6) -> None:
        """Gradiente vertical em faixas (banding típico de 16 bits)."""
        for i in range(h):
            t = int((i / max(1, h - 1)) * steps) / steps
            self.hline(x, y + i, w, mix(C(c1), C(c2), t))

    def dither(self, x: int, y: int, w: int, h: int, c, phase: int = 0) -> None:
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                if (xx + yy + phase) % 2 == 0:
                    self.px(xx, yy, c)

    def circle(self, cx: int, cy: int, r: int, c, fill: bool = True) -> None:
        for yy in range(cy - r, cy + r + 1):
            for xx in range(cx - r, cx + r + 1):
                d = (xx - cx) ** 2 + (yy - cy) ** 2
                if fill and d <= r * r + r * 0.6:
                    self.px(xx, yy, c)
                elif not fill and r * r - r <= d <= r * r + r:
                    self.px(xx, yy, c)

    def ellipse(self, cx: int, cy: int, rx: int, ry: int, c) -> None:
        for yy in range(cy - ry, cy + ry + 1):
            for xx in range(cx - rx, cx + rx + 1):
                if ((xx - cx) / max(rx, 0.5)) ** 2 + ((yy - cy) / max(ry, 0.5)) ** 2 <= 1.05:
                    self.px(xx, yy, c)

    def blit(self, src: "Canvas | Image.Image", x: int, y: int, flip: bool = False) -> None:
        im = src.img if isinstance(src, Canvas) else src
        if flip:
            im = im.transpose(Image.FLIP_LEFT_RIGHT)
        self.img.alpha_composite(im, (max(0, x), max(0, y)), (max(0, -x), max(0, -y)))

    def outline(self, c="#120a1f", diagonal: bool = False) -> None:
        """Adiciona contorno de 1px em volta de todos os pixels opacos."""
        src = self.img.copy().load()
        nb = [(1, 0), (-1, 0), (0, 1), (0, -1)]
        if diagonal:
            nb += [(1, 1), (-1, -1), (1, -1), (-1, 1)]
        col = C(c)
        for y in range(self.h):
            for x in range(self.w):
                if src[x, y][3] == 0:
                    for dx, dy in nb:
                        xx, yy = x + dx, y + dy
                        if 0 <= xx < self.w and 0 <= yy < self.h and src[xx, yy][3] > 0:
                            self.p[x, y] = col
                            break

    def glow(self, x: int, y: int, w: int, h: int, c, alpha: int = 50, spread: int = 3) -> None:
        """Halo luminoso suave em torno de um retângulo (bordas neon)."""
        base = C(c)
        for s in range(spread, 0, -1):
            a = int(alpha * (1 - s / (spread + 1)))
            col = (base[0], base[1], base[2], a)
            self.frame(x - s, y - s, w + 2 * s, h + 2 * s, col)

    def save(self, path: str, scale: int = 1) -> None:
        im = self.img
        if scale != 1:
            im = im.resize((self.w * scale, self.h * scale), Image.NEAREST)
        im.save(path)


# ---------------------------------------------------------------------------
# Fonte pixel 3x5 (maiúsculas, dígitos e símbolos usados nos cenários)
# ---------------------------------------------------------------------------
FONT3x5 = {
    "A": ["010", "101", "111", "101", "101"], "B": ["110", "101", "110", "101", "110"],
    "C": ["011", "100", "100", "100", "011"], "D": ["110", "101", "101", "101", "110"],
    "E": ["111", "100", "110", "100", "111"], "F": ["111", "100", "110", "100", "100"],
    "G": ["011", "100", "101", "101", "011"], "H": ["101", "101", "111", "101", "101"],
    "I": ["111", "010", "010", "010", "111"], "J": ["001", "001", "001", "101", "010"],
    "K": ["101", "101", "110", "101", "101"], "L": ["100", "100", "100", "100", "111"],
    "M": ["101", "111", "111", "101", "101"], "N": ["110", "101", "101", "101", "101"],
    "O": ["010", "101", "101", "101", "010"], "P": ["110", "101", "110", "100", "100"],
    "Q": ["010", "101", "101", "110", "011"], "R": ["110", "101", "110", "101", "101"],
    "S": ["011", "100", "010", "001", "110"], "T": ["111", "010", "010", "010", "010"],
    "U": ["101", "101", "101", "101", "111"], "V": ["101", "101", "101", "101", "010"],
    "W": ["101", "101", "111", "111", "101"], "X": ["101", "101", "010", "101", "101"],
    "Y": ["101", "101", "010", "010", "010"], "Z": ["111", "001", "010", "100", "111"],
    "0": ["111", "101", "101", "101", "111"], "1": ["010", "110", "010", "010", "111"],
    "2": ["110", "001", "010", "100", "111"], "3": ["110", "001", "010", "001", "110"],
    "4": ["101", "101", "111", "001", "001"], "5": ["111", "100", "110", "001", "110"],
    "6": ["011", "100", "111", "101", "111"], "7": ["111", "001", "010", "010", "010"],
    "8": ["111", "101", "111", "101", "111"], "9": ["111", "101", "111", "001", "110"],
    " ": ["000", "000", "000", "000", "000"], "-": ["000", "000", "111", "000", "000"],
    "_": ["000", "000", "000", "000", "111"], ".": ["000", "000", "000", "000", "010"],
    ":": ["000", "010", "000", "010", "000"], "/": ["001", "001", "010", "100", "100"],
    "!": ["010", "010", "010", "000", "010"], "%": ["101", "001", "010", "100", "101"],
    ">": ["100", "010", "001", "010", "100"], "<": ["001", "010", "100", "010", "001"],
}


def text_width(s: str, gap: int = 1, scale: int = 1) -> int:
    return len(s) * (3 * scale + gap) - gap


def draw_text(cv: Canvas, x: int, y: int, s: str, c, scale: int = 1, gap: int = 1) -> None:
    for i, ch in enumerate(s.upper()):
        g = FONT3x5.get(ch, FONT3x5[" "])
        ox = x + i * (3 * scale + gap)
        for gy, row in enumerate(g):
            for gx, bit in enumerate(row):
                if bit == "1":
                    cv.rect(ox + gx * scale, y + gy * scale, scale, scale, c)


def rng(seed: int) -> random.Random:
    return random.Random(seed)
