"""Ícones pixel art 16x16 (UI) e 8x8 (balões de estado dos agentes)."""
from __future__ import annotations

from pxlib import Canvas, shade
import props as P

OUT = "#140b22"


def _ic() -> Canvas:
    return Canvas(16, 16)


def coin() -> Canvas:
    c = _ic(); c.circle(8, 8, 6, "#ffb800"); c.circle(8, 8, 4, "#ffd36b")
    c.rect(7, 5, 2, 6, "#c98a00"); c.px(6, 4, "#fff3a8"); c.outline(OUT); return c


def gem() -> Canvas:
    c = _ic()
    rows = [(5, 6), (3, 10), (2, 12), (3, 10), (4, 8), (5, 6), (6, 4), (7, 2)]
    for i, (x, w) in enumerate(rows):
        c.hline(x, 3 + i, w, "#39d6ff")
    c.hline(5, 3, 3, "#d9fbff"); c.hline(3, 4, 2, "#d9fbff"); c.vline(8, 4, 6, "#1f8fb8")
    c.outline(OUT); return c


def star() -> Canvas:
    c = _ic()
    pts = ["0000000110000000", "0000001111000000", "0000001111000000", "1111111111111111", "0111111111111110",
           "0011111111111100", "0001111111111000", "0001111111111000", "0011111001111100", "0011100000011100", "0110000000000110"]
    for y, row in enumerate(pts):
        for x, b in enumerate(row):
            if b == "1":
                c.px(x, y + 2, "#ffb800")
    c.px(7, 4, "#fff3a8"); c.px(6, 6, "#fff3a8"); c.outline(OUT); return c


def trophy() -> Canvas:
    c = _ic(); c.rect(4, 2, 8, 6, "#ffb800"); c.rect(5, 8, 6, 1, "#ffb800"); c.rect(7, 9, 2, 3, "#c98a00")
    c.rect(5, 12, 6, 2, "#8a5a2b"); c.px(2, 3, "#ffb800"); c.px(2, 4, "#ffb800"); c.px(3, 5, "#ffb800")
    c.px(13, 3, "#ffb800"); c.px(13, 4, "#ffb800"); c.px(12, 5, "#ffb800"); c.vline(5, 3, 4, "#fff3a8"); c.outline(OUT); return c


def scroll() -> Canvas:
    c = _ic(); c.rect(3, 3, 10, 10, "#f1dfb0"); c.rect(2, 2, 12, 2, "#d9b878"); c.rect(2, 12, 12, 2, "#d9b878")
    for y in (6, 8, 10):
        c.hline(5, y, 6, "#8a6a3a")
    c.outline(OUT); return c


def flask() -> Canvas:
    c = _ic(); c.rect(6, 1, 4, 5, "#c9d3e6"); c.hline(5, 1, 6, "#ffffff")
    for i in range(7):
        c.hline(6 - i // 2 - 1, 6 + i, 4 + (i // 2 + 1) * 2, "#c9d3e6")
    for i in range(3, 7):
        c.hline(6 - i // 2, 6 + i, 2 + (i // 2) * 2 + 2, "#00f5a0")
    c.px(7, 10, "#d9fff0"); c.px(9, 11, "#d9fff0"); c.outline(OUT); return c


def bot() -> Canvas:
    c = _ic(); c.rect(3, 4, 10, 8, "#c9d3e6"); c.rect(4, 6, 8, 3, "#0d1630")
    c.px(5, 7, "#39d6ff"); c.px(6, 7, "#39d6ff"); c.px(9, 7, "#39d6ff"); c.px(10, 7, "#39d6ff")
    c.vline(8, 1, 3, "#7f8aa6"); c.px(8, 1, "#00f5a0"); c.rect(1, 6, 2, 3, "#7f8aa6"); c.rect(13, 6, 2, 3, "#7f8aa6")
    c.rect(5, 12, 6, 2, "#7f8aa6"); c.outline(OUT); return c


def bolt() -> Canvas:
    c = _ic()
    pts = [(9, 1), (8, 2), (7, 3), (6, 4), (5, 5), (4, 6), (4, 7), (5, 7), (6, 7), (7, 7), (8, 7), (9, 7), (8, 8), (7, 9), (6, 10), (5, 11), (4, 12)]
    for (x, y) in pts:
        c.rect(x, y, 3, 2, "#39d6ff")
    c.outline(OUT); return c


def brain() -> Canvas:
    c = _ic(); c.ellipse(8, 8, 6, 5, "#ff7ac1"); c.vline(8, 3, 10, "#c94a8f")
    for (x, y) in ((5, 6), (11, 6), (5, 10), (11, 10), (6, 8), (10, 8)):
        c.px(x, y, "#c94a8f")
    c.outline(OUT); return c


def book() -> Canvas:
    c = _ic(); c.rect(2, 3, 12, 10, "#9d62ff"); c.rect(3, 4, 10, 8, "#e9e1ff"); c.vline(8, 3, 10, "#5a2fb0")
    for y in (6, 8, 10):
        c.hline(4, y, 3, "#9d62ff"); c.hline(9, y, 3, "#9d62ff")
    c.outline(OUT); return c


def wrench() -> Canvas:
    c = _ic()
    for i in range(8):
        c.rect(3 + i, 11 - i, 2, 2, "#9aa6bf")
    c.rect(10, 2, 4, 2, "#c9d3e6"); c.rect(12, 2, 2, 4, "#c9d3e6"); c.px(12, 3, "#00000000")
    c.outline(OUT); return c


def chart() -> Canvas:
    c = _ic(); c.rect(2, 9, 3, 5, "#00f5a0"); c.rect(6, 5, 3, 9, "#39d6ff"); c.rect(10, 2, 3, 12, "#9d62ff")
    c.hline(1, 14, 14, "#c9d3e6"); c.outline(OUT); return c


def target() -> Canvas:
    c = _ic(); c.circle(8, 8, 6, "#ff537a"); c.circle(8, 8, 4, "#ffffff"); c.circle(8, 8, 2, "#ff537a")
    c.outline(OUT); return c


def lock() -> Canvas:
    c = _ic(); c.rect(3, 7, 10, 7, "#ffb800"); c.frame(5, 2, 6, 6, "#9aa6bf"); c.rect(7, 9, 2, 3, "#5e3020")
    c.outline(OUT); return c


def chest_icon() -> Canvas:
    c = Canvas(24, 20); P.chest(c, 1, 1); return c


UI_ICONS = dict(coin=coin, gem=gem, star=star, trophy=trophy, scroll=scroll, flask=flask, bot=bot, bolt=bolt,
                brain=brain, book=book, wrench=wrench, chart=chart, target=target, lock=lock)


# ---------------------------------------------------------------------------
# Provedores (glifos pixel genéricos, sem reprodução de marcas registradas)
# ---------------------------------------------------------------------------
def prov_gemini() -> Canvas:
    c = _ic()
    for i in range(7):
        w = 1 + (6 - i) // 2 * 0 + (1 if i < 6 else 0)
        c.hline(8 - (6 - i) // 3, 1 + i, 1 + 2 * ((6 - i) // 3), "#4f8cff")
    for y in range(16):
        d = abs(8 - y)
        half = max(0, (7 - d) // 2)
        c.hline(8 - half, y, half * 2 + 1, "#5b8dff" if y < 8 else "#9d62ff")
    for x in range(16):
        d = abs(8 - x)
        half = max(0, (7 - d) // 2)
        c.vline(x, 8 - half, half * 2 + 1, "#5b8dff" if x < 8 else "#c27bff")
    c.px(8, 8, "#ffffff"); c.outline(OUT); return c


def prov_groq() -> Canvas:
    c = _ic(); c.rect(1, 1, 14, 14, "#f55036"); c.frame(1, 1, 14, 14, shade("#f55036", 0.7))
    c.frame(4, 4, 7, 6, "#ffffff"); c.vline(10, 4, 9, "#ffffff"); c.hline(5, 12, 6, "#ffffff")
    c.outline(OUT); return c


def prov_openai() -> Canvas:
    c = _ic(); c.circle(8, 8, 6, "#e9edf5", fill=False); c.circle(8, 8, 5, "#e9edf5", fill=False)
    c.circle(8, 8, 2, "#e9edf5", fill=False)
    for (x, y) in ((8, 2), (13, 5), (13, 11), (8, 14), (3, 11), (3, 5)):
        c.px(x, y, "#ffffff")
    c.outline(OUT); return c


def prov_hf() -> Canvas:
    c = _ic(); c.circle(8, 8, 6, "#ffcc33"); c.rect(5, 6, 2, 2, OUT); c.rect(10, 6, 2, 2, OUT)
    c.hline(5, 10, 6, OUT); c.hline(6, 11, 4, "#d9473b"); c.rect(1, 10, 3, 3, "#ffb000"); c.rect(12, 10, 3, 3, "#ffb000")
    c.outline(OUT); return c


def prov_ollama() -> Canvas:
    c = _ic(); c.rect(4, 4, 8, 10, "#f2f2f2"); c.rect(4, 1, 2, 4, "#f2f2f2"); c.rect(10, 1, 2, 4, "#f2f2f2")
    c.px(6, 7, OUT); c.px(9, 7, OUT); c.rect(6, 9, 4, 3, "#d9d9e3"); c.px(7, 10, OUT); c.px(8, 10, OUT)
    c.outline(OUT); return c


PROVIDERS = dict(gemini=prov_gemini, groq=prov_groq, openai=prov_openai, huggingface=prov_hf, ollama=prov_ollama)


# ---------------------------------------------------------------------------
# Ícones de estado 8x8 (balões sobre os personagens)
# ---------------------------------------------------------------------------
def _st(pattern: list[str], col: str) -> Canvas:
    c = Canvas(8, 8)
    for y, row in enumerate(pattern):
        for x, b in enumerate(row):
            if b == "1":
                c.px(x, y, col)
    return c


STATE_ICONS = {
    "working": _st(["00011000", "01011010", "00111100", "11100111", "11100111", "00111100", "01011010", "00011000"], "#00f5a0"),
    "planning": _st(["00000000", "00000000", "00000000", "11011011", "11011011", "00000000", "00000000", "00000000"], "#39d6ff"),
    "collaborating": _st(["01111110", "11111111", "11011011", "11111111", "01111110", "00110000", "01100000", "00000000"], "#9d62ff"),
    "reviewing": _st(["00111000", "01000100", "10000010", "10000010", "01000100", "00111110", "00000111", "00000011"], "#ffb800"),
    "completed": _st(["00000000", "00000011", "00000110", "10001100", "11011000", "01110000", "00100000", "00000000"], "#00f5a0"),
    "failed": _st(["11000011", "11100111", "01111110", "00111100", "00111100", "01111110", "11100111", "11000011"], "#ff537a"),
    "paused": _st(["00000000", "01100110", "01100110", "01100110", "01100110", "01100110", "01100110", "00000000"], "#9aa6bf"),
    "idle": _st(["11110000", "00100000", "01000000", "11110111", "00000001", "00000010", "00000111", "00000000"], "#c9d3e6"),
}


def clock() -> Canvas:
    c = _ic(); c.circle(8, 8, 6, "#ff537a"); c.circle(8, 8, 5, "#1a1024"); c.circle(8, 8, 4, "#ffe3ea")
    c.vline(8, 5, 4, "#1a1024"); c.hline(8, 8, 3, "#1a1024"); c.outline(OUT); return c


def layers() -> Canvas:
    c = _ic()
    for i, col in enumerate(("#9d62ff", "#b98aff", "#d8c2ff")):
        y = 9 - i * 3
        for k in range(6):
            c.hline(8 - k, y + (k if k < 3 else 5 - k) - 2, 1, col)
        c.ellipse(8, y, 6, 2, col)
        c.hline(3, y, 10, shade(col, 0.8))
    c.outline(OUT); return c


def scroll_gold() -> Canvas:
    return scroll()


UI_ICONS.update(clock=clock, layers=layers)


# Emotes ambientais 8x8 (sociais — não indicam execução real)
EMOTES = {
    "heart": _st(["01100110", "11111111", "11111111", "11111111", "01111110", "00111100", "00011000", "00000000"], "#ff537a"),
    "question": _st(["00111100", "01100110", "00000110", "00001100", "00011000", "00000000", "00011000", "00000000"], "#39d6ff"),
    "exclaim": _st(["00011000", "00011000", "00011000", "00011000", "00011000", "00000000", "00011000", "00000000"], "#ffb800"),
    "music": _st(["00011111", "00010001", "00010001", "00010001", "01110111", "11110111", "01100110", "00000000"], "#9d62ff"),
    "coffee": _st(["00100100", "01001000", "00000000", "11111100", "11111110", "11111010", "11111100", "01111000"], "#e9b48a"),
    "idea": _st(["00111100", "01111110", "01111110", "01111110", "00111100", "00011000", "00011000", "00000000"], "#ffd36b"),
    "zzz": STATE_ICONS["idle"],
    "check": STATE_ICONS["completed"],
    "wave": _st(["01010100", "01010101", "01010101", "01111101", "01111110", "01111100", "00111000", "00000000"], "#f2c39b"),
}
