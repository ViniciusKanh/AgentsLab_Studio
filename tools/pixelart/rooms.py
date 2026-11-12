"""
Composição das salas (fundo estático + mesas como props independentes).

Cada sala gera:
  - <id>_bg.png  : parede, janelas, piso, decoração de fundo (384x192)
  - entrada em rooms.json com props (mesas), estações, corredores e efeitos
"""
from __future__ import annotations

from pxlib import Canvas, draw_text
import props as P

W, H = 384, 192
DESK_W = 44


def _station(sid: str, label: str, dx: int, dy: int, side: str = "left") -> dict:
    """Estação = mesa + assento. O personagem sentado fica com os pés em dy+20."""
    seat = {"x": dx + DESK_W // 2, "y": dy + 18}
    exit_x = dx - 6 if side == "left" else dx + DESK_W + 6
    return {"id": sid, "label": label, "desk": {"x": dx, "y": dy}, "seat": seat, "exit": {"x": exit_x, "y": dy + 18}}


def _chairs(cv: Canvas, stations: list[dict], color: str) -> None:
    for s in stations:
        P.chair_back(cv, s["seat"]["x"], s["desk"]["y"] - 4, color)


# ---------------------------------------------------------------------------
def office() -> tuple[Canvas, dict]:
    cv = Canvas(W, H, "#080e1a")
    P.wall(cv, 78, base="#22163d", panel="#2b1c4c", trim=P.NEON_P)
    P.window(cv, 8, 12, 78, 46, seed=11)
    P.bookshelf(cv, 92, 12, 30, 64, seed=3)
    P.whiteboard(cv, 128, 14, 46, 42, "SPRINT", [("RAG", True), ("GEMINI", True), ("CUSTO", False), ("HUB", False)])
    P.neon_sign(cv, 180, 14, "AGENTS LAB", P.NEON_P, scale=2, frame_color=P.NEON_C)
    # prateleira com troféu e livros abaixo do letreiro
    cv.rect(184, 46, 80, 3, P.WOOD); cv.hline(184, 46, 80, P.WOOD_L)
    cv.rect(196, 38, 6, 6, P.NEON_Y); cv.rect(198, 44, 2, 2, P.NEON_Y); cv.rect(195, 38, 8, 1, "#fff3a8")
    for i, col in enumerate(["#c2457a", "#2f7dd1", "#00b37a", "#ffb800"]):
        cv.rect(214 + i * 3, 38 + (i % 2), 3, 8 - (i % 2), col)
    P.plant_small(cv, 240, 37, 1); P.plant_small(cv, 252, 37, 2)
    P.bookshelf(cv, 270, 12, 30, 64, seed=8)
    P.window(cv, 306, 12, 46, 46, seed=12, moon=True)
    P.brain_tank(cv, 356, 22, 64)
    for x in (6, 89, 177, 267, 303, 380):
        P.hanging_vine(cv, x, 4, 14 + (x % 9), seed=x)
    P.floor_planks(cv, 78, H - 78, base="#2c1f45")
    P.rug(cv, 112, 140, 160, 48)
    for x in (52, 150, 232, 330):
        P.ceiling_lamp(cv, x, 0, 4)
    P.plant_big(cv, 0, 58, 32, seed=21)
    P.plant_big(cv, 364, 150, 34, seed=22, pot="#7a4bd1")
    P.plant_big(cv, 0, 150, 30, seed=23, pot="#e2e8f0")
    P.cat(cv, 22, 178)
    stations = [
        _station("o1", "Pesquisa", 14, 80, "left"),
        _station("o2", "Dados", 86, 80, "right"),
        _station("o3", "Conteúdo", 170, 80, "left"),
        _station("o4", "Código", 254, 80, "left"),
        _station("o5", "Revisão", 326, 80, "right"),
        _station("o6", "RAG", 28, 124, "left"),
        _station("o7", "Ops", 104, 124, "right"),
        _station("o8", "BI & Insights", 236, 124, "left"),
        _station("o9", "Planejamento", 312, 124, "right"),
        _station("o10", "Orquestração", 170, 158, "left"),
    ]
    _chairs(cv, stations, "#3a2a66")
    desks = [{"x": s["desk"]["x"], "y": s["desk"]["y"], "variant": i % 4, "palette": "wood"} for i, s in enumerate(stations)]
    meta = {
        "id": "office", "name": "Escritório Operacional", "bg": "office_bg",
        "stations": stations, "desks": desks,
        "lanes": [112, 152, 186],
        "meeting": [{"x": 160, "y": 146}, {"x": 182, "y": 148}, {"x": 204, "y": 148}, {"x": 226, "y": 146}],
        "spawn": {"x": 370, "y": 186},
        "effects": [
            {"type": "sign", "x": 180, "y": 14, "w": 86, "h": 18, "color": "#39d6ff"},
            {"type": "tank", "x": 358, "y": 30, "w": 22, "h": 44, "color": "#39d6ff"},
            {"type": "cat", "x": 22, "y": 178},
        ],
        "leds": [],
    }
    return cv, meta


# ---------------------------------------------------------------------------
def research_lab() -> tuple[Canvas, dict]:
    cv = Canvas(W, H, "#080e1a")
    P.wall(cv, 78, base="#0f2236", panel="#143049", trim=P.NEON_C)
    P.wall_screen(cv, 12, 14, 52, 30, "graph", P.NEON_G, seed=3)
    P.wall_screen(cv, 72, 14, 40, 30, "chart", P.NEON_C, seed=4)
    draw_text(cv, 14, 48, "EXPERIMENTOS", P.NEON_G)
    P.bookshelf(cv, 120, 14, 28, 62, seed=31)
    P.dna_tube(cv, 152, 30, 46)
    P.brain_tank(cv, 178, 8, 76)
    P.dna_tube(cv, 210, 30, 46)
    P.wall_screen(cv, 232, 14, 52, 30, "nodes", P.NEON_P, seed=5)
    draw_text(cv, 234, 48, "RAG  LLM", P.NEON_P)
    P.window(cv, 296, 12, 80, 44, seed=14)
    for x in (40, 140, 250, 340):
        P.ceiling_lamp(cv, x, 0, 3, color="#bff6ff")
    P.floor_tiles(cv, 78, H - 78, c1="#13263f", c2="#18304d", line="#0d1a2c")
    P.lab_bench(cv, 0, 60, 40, seed=2)
    P.lab_bench(cv, 340, 160, 44, seed=6)
    P.plant_big(cv, 0, 152, 34, seed=41, pot="#e2e8f0")
    P.server_rack(cv, 290, 116, 0) if False else None
    stations = [
        _station("l1", "Pesquisa Científica", 44, 82, "left"),
        _station("l2", "Análise", 116, 82, "right"),
        _station("l3", "Benchmarks", 236, 82, "left"),
        _station("l4", "RAG", 312, 82, "right"),
        _station("l5", "Fine-tuning", 70, 128, "left"),
        _station("l6", "Avaliação", 270, 128, "right"),
    ]
    _chairs(cv, stations, "#2b4c6e")
    desks = [{"x": s["desk"]["x"], "y": s["desk"]["y"], "variant": i % 4, "palette": "lab"} for i, s in enumerate(stations)]
    meta = {
        "id": "research", "name": "Laboratório de Pesquisa", "bg": "research_bg",
        "stations": stations, "desks": desks,
        "lanes": [114, 160, 186],
        "meeting": [{"x": 170, "y": 150}, {"x": 192, "y": 156}, {"x": 214, "y": 150}],
        "spawn": {"x": 10, "y": 186},
        "effects": [
            {"type": "tank", "x": 180, "y": 16, "w": 22, "h": 54, "color": "#39d6ff"},
            {"type": "screen", "x": 12, "y": 14, "w": 52, "h": 30, "color": "#00f5a0"},
            {"type": "screen", "x": 232, "y": 14, "w": 52, "h": 30, "color": "#9d62ff"},
        ],
        "leds": [],
    }
    return cv, meta


# ---------------------------------------------------------------------------
def orchestration() -> tuple[Canvas, dict]:
    cv = Canvas(W, H, "#080e1a")
    P.wall(cv, 78, base="#1a1233", panel="#221842", trim=P.NEON_G)
    P.wall_screen(cv, 30, 12, 60, 34, "nodes", P.NEON_P, seed=7)
    P.wall_screen(cv, 104, 12, 50, 34, "graph", P.NEON_G, seed=8)
    P.wall_screen(cv, 230, 12, 50, 34, "chart", P.NEON_C, seed=9)
    P.wall_screen(cv, 294, 12, 60, 34, "map", P.NEON_C, seed=10)
    P.neon_sign(cv, 160, 10, "CENTRAL", P.NEON_G, scale=1, pad=3)
    draw_text(cv, 34, 50, "WORKFLOWS", P.NEON_P)
    draw_text(cv, 298, 50, "PROVEDORES", P.NEON_C)
    P.floor_tiles(cv, 78, H - 78, c1="#1a1530", c2="#1f1a3a", line="#120e22", size=16)
    leds = []
    leds += P.server_rack(cv, 2, 48, 66, seed=1)
    leds += P.server_rack(cv, 366, 48, 66, seed=2)
    # anel luminoso no piso em volta do globo
    cv.ellipse(192, 150, 54, 14, (57, 214, 255, 40))
    cv.ellipse(192, 150, 50, 12, (8, 14, 26, 255))
    cv.ellipse(192, 150, 48, 11, (57, 214, 255, 30))
    P.holo_base(cv, 174, 140, 36)
    P.plant_big(cv, 0, 152, 34, seed=51, pot="#7a4bd1")
    P.plant_big(cv, 366, 152, 34, seed=52, pot="#7a4bd1")
    stations = [
        _station("c1", "Roteamento", 62, 84, "left"),
        _station("c2", "Filas", 278, 84, "right"),
        _station("c3", "Monitor", 22, 122, "left"),
        _station("c4", "Custos", 318, 122, "right"),
        _station("c5", "Agentes", 96, 152, "left"),
        _station("c6", "Integrações", 244, 152, "right"),
    ]
    _chairs(cv, stations, "#2a2350")
    desks = [{"x": s["desk"]["x"], "y": s["desk"]["y"], "variant": i % 4, "palette": "tech"} for i, s in enumerate(stations)]
    meta = {
        "id": "orchestration", "name": "Central de Orquestração", "bg": "orchestration_bg",
        "stations": stations, "desks": desks,
        "lanes": [116, 150, 186],
        "meeting": [{"x": 160, "y": 170}, {"x": 192, "y": 176}, {"x": 224, "y": 170}],
        "spawn": {"x": 192, "y": 188},
        "effects": [
            {"type": "globe", "x": 178, "y": 106},
            {"type": "screen", "x": 30, "y": 12, "w": 60, "h": 34, "color": "#9d62ff"},
            {"type": "screen", "x": 294, "y": 12, "w": 60, "h": 34, "color": "#39d6ff"},
        ],
        "leds": [{"x": x, "y": y, "color": c} for (x, y, c) in leds],
    }
    return cv, meta


# ---------------------------------------------------------------------------
# Salas planejadas: somente cenário (miniaturas da galeria)
# ---------------------------------------------------------------------------
def library() -> Canvas:
    cv = Canvas(W, H, "#080e1a")
    P.wall(cv, 90, base="#2a1a1a", panel="#331f1f", trim=P.NEON_Y)
    for i, x in enumerate(range(6, 370, 46)):
        P.bookshelf(cv, x, 10, 40, 80, seed=60 + i)
    P.floor_planks(cv, 90, H - 90, base="#3a2418")
    P.rug(cv, 100, 120, 184, 56, c1="#5a2a1a", c2="#7a3a22", border=P.NEON_Y)
    cv.blit(P.desk_prop(1, 3, 52, "wood"), 166, 130)
    P.plant_big(cv, 4, 150, 34, seed=61)
    return cv


def arena() -> Canvas:
    cv = Canvas(W, H, "#080e1a")
    P.wall(cv, 70, base="#0e1830", panel="#132242", trim=P.NEON_C)
    for x in (20, 300):
        P.wall_screen(cv, x, 14, 64, 34, "chart", P.NEON_C, seed=x)
    P.floor_tiles(cv, 70, H - 70, c1="#0f1d36", c2="#132544", line="#0a1426", size=16)
    cv.ellipse(192, 140, 80, 26, (57, 214, 255, 50))
    cv.ellipse(192, 140, 74, 22, "#0d1a30")
    P.cube_holo(cv, 176, 90, 28)
    P.holo_base(cv, 174, 132, 36)
    return cv


def automation() -> Canvas:
    cv = Canvas(W, H, "#080e1a")
    P.wall(cv, 80, base="#1d1a2e", panel="#252140", trim=P.NEON_Y)
    P.window(cv, 260, 12, 100, 46, seed=71)
    P.wall_screen(cv, 20, 14, 70, 34, "graph", P.NEON_Y, seed=72)
    P.floor_tiles(cv, 80, H - 80, c1="#25223a", c2="#2b2843", line="#1a182b", size=16)
    cv.rect(0, 150, W, 10, "#3a4566")
    for x in range(0, W, 8):
        cv.vline(x, 150, 10, "#2c3352")
    cv.hline(0, 150, W, P.NEON_Y)
    for x in (60, 170, 280):
        P.robot_arm(cv, x, 104)
        cv.rect(x + 20, 142, 10, 8, "#c96b3c")
    return cv


def projects() -> Canvas:
    cv = Canvas(W, H, "#080e1a")
    P.wall(cv, 80, base="#1c1a36", panel="#24214a", trim=P.NEON_R)
    P.whiteboard(cv, 20, 12, 90, 56, "ROADMAP", [("FASE 1", True), ("FASE 2", False), ("FASE 3", False)])
    P.whiteboard(cv, 130, 12, 90, 56, "KANBAN", [("UI", True), ("API", False), ("LLM", False)])
    P.window(cv, 240, 12, 120, 48, seed=81)
    P.floor_planks(cv, 80, H - 80, base="#2a2040")
    cv.rect(110, 120, 164, 30, P.WOOD_L); cv.rect(110, 150, 164, 6, P.WOOD_D)
    cv.frame(110, 120, 164, 36, P.OUT)
    for x in (130, 190, 250):
        cv.rect(x, 126, 16, 10, "#e2e8f0")
    return cv


# ---------------------------------------------------------------------------
# Banner do cabeçalho do dashboard (720x56) — cena panorâmica
# ---------------------------------------------------------------------------
def header_banner(char_strip) -> Canvas:
    BW, BH = 720, 56
    cv = Canvas(BW, BH, "#080e1a")
    cv.rect(0, 0, BW, BH, "#1d1336")
    for xx in range(0, BW, 20):
        cv.rect(xx + 1, 4, 18, 40, "#24183f")
    cv.hline(0, 46, BW, "#3a2660"); cv.rect(0, 47, BW, 9, "#2a1c48"); cv.hline(0, 47, BW, "#5a3d8f")
    # esquerda: estante, plantas, programador
    P.bookshelf(cv, 4, 2, 40, 45, seed=91)
    P.hanging_vine(cv, 50, 0, 20, seed=92)
    P.window(cv, 60, 4, 50, 30, seed=93, moon=False)
    P.bookshelf(cv, 116, 2, 28, 45, seed=94)
    P.wall_screen(cv, 152, 8, 22, 14, "nodes", P.NEON_C, seed=95)
    # mesa + personagem trabalhando
    from PIL import Image
    worker = char_strip.img.crop((10 * 16, 0, 11 * 16, 24))
    cv.blit(worker, 186, 22)
    cv.rect(170, 40, 50, 3, P.WOOD_L); cv.rect(171, 43, 48, 8, P.WOOD); cv.frame(170, 40, 50, 11, P.OUT)
    cv.rect(188, 35, 12, 5, "#2a2f4a"); cv.px(194, 37, P.NEON_C)
    cv.vline(214, 30, 10, "#3a4566"); cv.rect(211, 28, 6, 3, P.NEON_Y)
    for i in range(1, 8):
        cv.hline(214 - i, 31 + i, i * 2, (255, 214, 120, max(0, 40 - i * 5)))
    cv.rect(224, 34, 4, 6, "#e2e8f0")
    for i, col in enumerate(["#c2457a", "#2f7dd1", "#ffb800"]):
        cv.rect(232, 30 + i * 3, 12, 3, col)
    P.plant_small(cv, 252, 30, 0)
    # direita: gato, globo, robô, flâmula, telescópio, janela
    P.cat(cv, 470, 36)
    P.plant_big(cv, 492, 18, 30, seed=96)
    cv.rect(514, 40, 16, 7, "#3a4566"); P.hologram_globe(cv, 514, 22, 8, phase=2, color=P.NEON_P)
    P.robot_bot(cv, 538, 24)
    P.banner_flag(cv, 566, 4, 14, 26)
    P.telescope(cv, 588, 22)
    P.window(cv, 618, 4, 70, 38, seed=97, moon=True)
    P.hanging_vine(cv, 700, 0, 24, seed=98)
    P.plant_small(cv, 706, 38, 2)
    for x in (300, 420):
        P.ceiling_lamp(cv, x, 0, 2)
    return cv


def sidebar_deco() -> Canvas:
    cv = Canvas(64, 92)
    # skyline ao fundo
    cv.vgrad(0, 30, 64, 40, "#0a0828", "#4b1f6b", steps=5)
    import random
    r = random.Random(5)
    x = 0
    while x < 64:
        bw = r.randint(5, 9); bh = r.randint(10, 26)
        cv.rect(x, 70 - bh, bw, bh, "#1a0f33")
        for wy in range(72 - bh, 68, 3):
            if r.random() < 0.4:
                cv.px(x + 2, wy, "#ffd36b")
        x += bw + 1
    P.brain_tank(cv, 4, 22, 58)
    P.chest(cv, 36, 64)
    P.plant_small(cv, 54, 74, 0)
    cv.rect(0, 80, 64, 12, "#1a1233"); cv.hline(0, 80, 64, "#3a2660")
    P.chest(cv, 36, 64)
    return cv
