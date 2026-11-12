"""
Gerador de personagens pixel art (16x24 por quadro) e retratos (24x24).

Quadros por linha da spritesheet (FRAMES_PER_CHAR = 27):
  0-1   idle (respiração)
  2-5   walk_front (andar para baixo/cima)
  6-9   walk_side (andar para a direita; espelhar para a esquerda)
  10-11 work (digitando, sentado)
  12-13 talk (colaborando / gesticulando)
  14-15 think (revisando / planejando)
  16    cheer (concluído)
  17-20 walk_back (andar para cima, de costas)
  21-22 sit_back (sentado de costas digitando — estação de trabalho)
  23-24 coffee (segurando caneca)
  25-26 read (lendo documento)
"""
from __future__ import annotations

from pxlib import Canvas, shade, C

FW, FH = 16, 24
FRAMES_PER_CHAR = 27
OUTLINE = "#140b22"
EYE = "#1a1024"


# ---------------------------------------------------------------------------
# Elenco — aparência de cada agente (ids estáveis usados pelo frontend)
# ---------------------------------------------------------------------------
CAST: list[dict] = [
    dict(id="vinicius", skin="#f2c39b", hair="#5a3420", style="messy", shirt="#5b3fa8", pants="#2a2f4f", shoes="#151520", acc=["headphones", "hoodie"], neon="#39d6ff"),
    dict(id="analista", skin="#e9b48a", hair="#3b2416", style="short", shirt="#2f7dd1", pants="#2b2b3d", shoes="#1b1b24", acc=["glasses"], neon="#00f5a0"),
    dict(id="pesquisadora", skin="#f5d0b0", hair="#3a7bd5", style="long", shirt="#2b4c8c", pants="#24304a", shoes="#1b1b24", acc=["glasses", "labcoat"], neon="#39d6ff"),
    dict(id="redatora", skin="#f3c6a5", hair="#ff6fae", style="ponytail", shirt="#c2457a", pants="#3a2448", shoes="#22131f", acc=[], neon="#ff537a"),
    dict(id="engenheiro", skin="#d9a27a", hair="#2a1a12", style="short", shirt="#6b3fc9", pants="#2d2050", shoes="#1b1424", acc=["wizard"], neon="#9d62ff"),
    dict(id="rag", skin="#f7d9c4", hair="#e9ecf5", style="long", shirt="#8a93b8", pants="#3a3f5c", shoes="#1d1f2b", acc=[], neon="#ffffff"),
    dict(id="ops", kind="robot", skin="#dfe6f2", hair="#9aa6bf", style="bald", shirt="#c9d3e6", pants="#7f8aa6", shoes="#4a5370", acc=[], neon="#39d6ff"),
    dict(id="bi", skin="#c98d63", hair="#1e1410", style="short", shirt="#1f8f6a", pants="#263040", shoes="#151a20", acc=["glasses"], neon="#00f5a0"),
    dict(id="revisor", skin="#eab792", hair="#9b9fae", style="short", shirt="#8a5a2b", pants="#2e2a36", shoes="#1a1716", acc=["beard", "glasses"], neon="#ffb800"),
    dict(id="orquestradora", skin="#8d5a3b", hair="#140d0a", style="bun", shirt="#d99a1e", pants="#2c2438", shoes="#17121c", acc=[], neon="#ffb800"),
    dict(id="planejador", skin="#f0c09a", hair="#6b3d1f", style="curly", shirt="#2fa3a3", pants="#24324a", shoes="#14202a", acc=["cap"], neon="#39d6ff"),
    dict(id="assistente", skin="#f6cfaa", hair="#f2c94c", style="short", shirt="#e0607e", pants="#303050", shoes="#1b1b28", acc=[], neon="#ff537a"),
    dict(id="robo2", kind="robot", skin="#f4f6fb", hair="#c9d3e6", style="bald", shirt="#e6ecff", pants="#9aa6bf", shoes="#5d6785", acc=[], neon="#ff537a"),
    dict(id="devops", skin="#b97a55", hair="#2b1d18", style="spiky", shirt="#3a4a6b", pants="#1f2433", shoes="#101218", acc=["headphones"], neon="#00f5a0"),
]


# ---------------------------------------------------------------------------
# Quadro frontal
# ---------------------------------------------------------------------------
def _front(spec: dict, pose: str, f: int) -> Canvas:
    cv = Canvas(FW, FH)
    robot = spec.get("kind") == "robot"
    skin, hair = spec["skin"], spec["hair"]
    shirt, pants, shoes = spec["shirt"], spec["pants"], spec["shoes"]
    acc = spec.get("acc", [])
    coat = "labcoat" in acc
    torso_c = "#e8eef7" if coat else shirt
    arm_c = torso_c

    # deslocamento vertical do tronco/cabeça
    dy = 0
    if pose == "idle" and f == 1:
        dy = 1
    if pose == "walk" and f in (1, 3):
        dy = -1
    if pose == "cheer" and f == 1:
        dy = -1

    # ---------------- pernas ----------------
    lift_l = pose == "walk" and f == 2
    lift_r = pose == "walk" and f == 0
    cv.rect(4, 17, 8, 1, shade(pants, 0.85))
    for (lx, lift) in ((5, lift_l), (8, lift_r)):
        top, bot = 18, 21 - (1 if lift else 0)
        cv.rect(lx, top, 3, bot - top + 1, pants)
        cv.vline(lx + 2, top, bot - top + 1, shade(pants, 0.75))
        sy = bot + 1
        sx = lx - 1 if lx == 5 else lx
        cv.rect(sx, sy, 4, 2, shoes)
        cv.hline(sx, sy, 4, shade(shoes, 1.4))
    if coat:  # abas do jaleco
        cv.rect(4, 17, 2, 3, torso_c)
        cv.rect(10, 17, 2, 3, shade(torso_c, 0.85))

    # ---------------- tronco ----------------
    ty = 11 + dy
    cv.rect(4, ty, 8, 17 - ty, torso_c)
    cv.vline(11, ty, 17 - ty, shade(torso_c, 0.78))
    cv.vline(4, ty + 1, 16 - ty, shade(torso_c, 1.15))
    if coat:
        cv.rect(7, ty, 2, 17 - ty, shirt)
        cv.px(6, ty, shade(torso_c, 0.8)); cv.px(9, ty, shade(torso_c, 0.8))
    elif robot:
        cv.rect(6, ty + 2, 4, 2, "#39d6ff")
        cv.px(7, ty + 2, "#e9fbff")
    else:
        cv.px(7, ty, skin); cv.px(8, ty, shade(skin, 0.85))  # gola
    if "hoodie" in acc:
        cv.hline(4, ty, 8, shade(shirt, 0.7))
        cv.px(6, ty + 1, "#e9e9f2"); cv.px(6, ty + 2, "#e9e9f2")
        cv.px(9, ty + 1, "#e9e9f2"); cv.px(9, ty + 2, "#e9e9f2")
        cv.hline(5, 15, 6, shade(shirt, 0.8))  # bolso canguru

    # ---------------- braços ----------------
    hand = "#c9d3e6" if robot else skin

    def arm_down(x: int, hand_y: int):
        cv.vline(x, ty + 1, hand_y - ty - 1, arm_c)
        cv.px(x, hand_y, hand)

    if pose in ("idle", "walk"):
        lh = 16 - (1 if pose == "walk" and f == 2 else 0)
        rh = 16 - (1 if pose == "walk" and f == 0 else 0)
        arm_down(3, lh + dy if pose == "idle" else lh)
        arm_down(12, rh + dy if pose == "idle" else rh)
    elif pose == "work":
        cv.vline(3, ty + 1, 4, arm_c); cv.vline(12, ty + 1, 4, arm_c)
        cv.rect(3, ty + 5, 3, 1, shade(arm_c, 0.85)); cv.rect(10, ty + 5, 3, 1, shade(arm_c, 0.85))
        a, b = (17, 18) if f == 0 else (18, 17)
        cv.rect(5, a, 2, 1, hand); cv.rect(9, b, 2, 1, hand)
        cv.px(5, a - 1, shade(arm_c, 0.85)); cv.px(10, b - 1, shade(arm_c, 0.85))
    elif pose == "talk":
        arm_down(3, 16)
        cv.vline(12, ty - 3, 4, arm_c)
        cv.px(13, ty - 2, arm_c)
        hx = 13 if f == 0 else 14
        cv.rect(hx - 1, ty - 5, 2, 2, hand)
    elif pose == "think":
        arm_down(3, 16)
        cv.vline(12, ty + 1, 2, arm_c)
        cv.rect(10, ty + 2, 2, 1, arm_c)
        cv.rect(9, 9 + dy + (0 if f == 0 else 0), 2, 1, hand)
    elif pose == "coffee":
        arm_down(3, 16)
        cv.vline(12, ty + 1, 3, arm_c)
        my = 13 if f == 0 else 9
        cv.rect(10, my, 2, 1, arm_c) if f == 0 else cv.vline(11, ty + 1, 3, arm_c)
        cv.rect(9, my, 3, 3, "#e9edf5"); cv.px(12, my + 1, "#e9edf5"); cv.px(10, my, "#6b3a1e")
        cv.px(10, my - 2, (230, 230, 255, 150)); cv.px(11, my - 3, (230, 230, 255, 110))
    elif pose == "read":
        cv.vline(3, ty + 1, 3, arm_c); cv.vline(12, ty + 1, 3, arm_c)
        book = "#9d62ff" if f == 0 else "#39d6ff"
        cv.rect(4, 13, 8, 4, book); cv.rect(5, 13, 6, 3, "#f1ecff"); cv.vline(8, 13, 4, shade(book, 0.6))
        cv.px(4, 15, hand); cv.px(11, 15, hand)
    elif pose == "coffee":
        arm_down(3, 16)
        cv.vline(12, ty + 1, 3, arm_c)
        my = 13 if f == 0 else 9
        cv.rect(10, my, 2, 1, arm_c) if f == 0 else cv.vline(11, ty + 1, 3, arm_c)
        cv.rect(9, my, 3, 3, "#e9edf5"); cv.px(12, my + 1, "#e9edf5"); cv.px(10, my, "#6b3a1e")
        cv.px(10, my - 2, (230, 230, 255, 150)); cv.px(11, my - 3, (230, 230, 255, 110))
    elif pose == "read":
        cv.vline(3, ty + 1, 3, arm_c); cv.vline(12, ty + 1, 3, arm_c)
        book = "#9d62ff" if f == 0 else "#39d6ff"
        cv.rect(4, 13, 8, 4, book); cv.rect(5, 13, 6, 3, "#f1ecff"); cv.vline(8, 13, 4, shade(book, 0.6))
        cv.px(4, 15, hand); cv.px(11, 15, hand)
    elif pose == "cheer":
        for x in (2, 13):
            cv.vline(x, ty - 5, 5, arm_c)
            cv.rect(x - (1 if x == 2 else 0), ty - 7 + (0 if f == 0 else -1), 2, 2, hand)
        cv.px(3, ty, arm_c); cv.px(12, ty, arm_c)

    # ---------------- cabeça ----------------
    hy = 2 + dy
    if robot:
        cv.rect(4, hy, 8, 8, skin)
        cv.rect(3, hy + 1, 10, 6, skin)
        cv.hline(4, hy + 7, 8, shade(skin, 0.8))
        cv.rect(4, hy + 3, 8, 3, "#0d1630")
        eye = "#39d6ff" if not (pose == "think" and f == 1) else "#00f5a0"
        cv.rect(5, hy + 4, 2, 1, eye); cv.rect(9, hy + 4, 2, 1, eye)
        cv.vline(8, max(0, hy - 2), 2, "#7f8aa6"); cv.px(8, max(0, hy - 2), spec["neon"])
        cv.px(2, hy + 3, "#7f8aa6"); cv.px(13, hy + 3, "#7f8aa6")
        cv.rect(7, hy + 8, 2, 1, "#7f8aa6")
    else:
        cv.rect(5, hy + 2, 6, 8, skin)
        cv.rect(4, hy + 3, 8, 5, skin)
        cv.vline(11, hy + 3, 5, shade(skin, 0.86))
        cv.rect(6, hy + 8, 4, 1, skin)
        cv.rect(6, hy + 8, 4, 1, shade(skin, 0.92))
        cv.rect(6, 10 + dy, 4, 1, shade(skin, 0.8))  # pescoço
        # olhos
        blink = pose == "idle" and f == 1
        if blink:
            cv.rect(6, hy + 5, 1, 1, shade(skin, 0.7)); cv.rect(9, hy + 5, 1, 1, shade(skin, 0.7))
        else:
            cv.vline(6, hy + 4, 2, EYE); cv.vline(9, hy + 4, 2, EYE)
        # boca
        if pose == "talk" and f == 1:
            cv.rect(7, hy + 7, 2, 1, "#8c2b3a")
        elif pose == "cheer":
            cv.rect(7, hy + 7, 2, 1, "#8c2b3a")
        else:
            cv.px(7, hy + 7, shade(skin, 0.72)); cv.px(8, hy + 7, shade(skin, 0.72))
        cv.px(5, hy + 6, shade("#ff8a8a", 1.0)) if spec["id"] in ("redatora", "assistente") else None
        _hair_front(cv, spec, hy)
        if "beard" in acc:
            cv.rect(4, hy + 6, 8, 3, hair)
            cv.rect(6, hy + 7, 4, 1, shade(skin, 0.75))
            cv.px(4, hy + 6, skin); cv.px(11, hy + 6, shade(skin, 0.86))
        if "glasses" in acc:
            fr = "#20203a"
            cv.hline(5, hy + 3, 6, fr)
            for x in (5, 7, 8, 10):
                cv.px(x, hy + 4, fr)
            cv.px(6, hy + 5, "#9fe7ff") if False else None
        if "headphones" in acc:
            band = "#1e1e2e"
            cv.hline(5, hy - 1 if hy > 0 else 0, 6, band)
            cv.px(4, hy, band); cv.px(11, hy, band)
            for x in (3, 12):
                cv.rect(x, hy + 3, 1, 3, band)
                cv.px(x, hy + 4, spec["neon"])
    cv.outline(OUTLINE)
    return cv


def _hair_front(cv: Canvas, spec: dict, hy: int) -> None:
    hair, style, acc = spec["hair"], spec["style"], spec.get("acc", [])
    hl = shade(hair, 1.35)
    dk = shade(hair, 0.75)
    if style != "bald":
        cv.rect(5, hy, 6, 1, hair)
        cv.rect(4, hy + 1, 8, 2, hair)
        cv.hline(5, hy, 3, hl)
        # franja
        for x in range(4, 12):
            if x in (4, 5, 6, 10, 11) or (style == "messy" and x == 8):
                cv.px(x, hy + 3, hair)
        cv.px(4, hy + 4, hair); cv.px(11, hy + 4, dk)
    if style == "messy":
        for x in (5, 8, 10):
            cv.px(x, hy - 1, hair)
        cv.px(12, hy + 2, hair)
    if style == "spiky":
        for x in (4, 6, 8, 10):
            cv.px(x, hy - 1, hair); cv.px(x + 1, hy - 2 if hy >= 2 else 0, hair)
    if style == "long":
        cv.rect(3, hy + 2, 2, 10, hair); cv.rect(11, hy + 2, 2, 10, dk)
        cv.vline(3, hy + 3, 8, hl)
    if style == "ponytail":
        cv.rect(12, hy + 1, 2, 2, hair)
        cv.rect(13, hy + 3, 2, 6, dk)
        cv.px(12, hy + 1, "#ffb800")
    if style == "bun":
        cv.rect(6, max(0, hy - 2), 4, 2, hair)
        cv.hline(6, hy, 4, "#ffb800")
    if style == "curly":
        for x in range(3, 13, 2):
            cv.px(x, hy - 1 if hy > 0 else 0, hair)
        cv.rect(3, hy, 10, 3, hair)
        cv.rect(3, hy + 3, 1, 4, hair); cv.rect(12, hy + 3, 1, 4, dk)
        for x in range(4, 12, 3):
            cv.px(x, hy + 1, hl)
    if "wizard" in acc:
        hat, band = "#5a2fb0", "#ffb800"
        cv.rect(2, hy + 2, 12, 1, shade(hat, 0.8))
        cv.rect(4, hy, 8, 2, hat)
        cv.rect(5, max(0, hy - 1), 6, 1, hat)
        cv.rect(6, max(0, hy - 2), 4, 1, hat)
        cv.px(9, 0, hat); cv.px(10, 0, shade(hat, 1.3))
        cv.hline(4, hy + 1, 8, band)
        cv.px(6, hy - 1 if hy > 0 else 0, "#fff3a8")
    if "cap" in acc:
        cap = spec["neon"]
        cv.rect(4, hy - 1 if hy > 0 else 0, 8, 3, shade(cap, 0.8))
        cv.hline(4, hy + 2, 10, shade(cap, 0.6))
        cv.px(7, hy, "#ffffff")


# ---------------------------------------------------------------------------
# Quadro lateral (andando para a direita)
# ---------------------------------------------------------------------------
def _side(spec: dict, f: int) -> Canvas:
    cv = Canvas(FW, FH)
    robot = spec.get("kind") == "robot"
    skin, hair = spec["skin"], spec["hair"]
    shirt, pants, shoes = spec["shirt"], spec["pants"], spec["shoes"]
    acc = spec.get("acc", [])
    torso_c = "#e8eef7" if "labcoat" in acc else shirt
    dy = -1 if f in (1, 3) else 0

    # pernas
    cv.rect(6, 17, 5, 1, shade(pants, 0.85))
    if f in (0, 2):
        front, back = (9, 6) if f == 0 else (8, 7)
        cv.rect(back, 18, 2, 4, shade(pants, 0.75)); cv.rect(back - 1, 22, 3, 2, shade(shoes, 0.8))
        cv.rect(front, 18, 2, 4, pants); cv.rect(front, 22, 4, 2, shoes)
        cv.hline(front, 22, 4, shade(shoes, 1.4))
    else:
        cv.rect(7, 18, 3, 4, pants); cv.rect(7, 22, 4, 2, shoes)
        cv.hline(7, 22, 4, shade(shoes, 1.4))
    # tronco
    ty = 11 + dy
    cv.rect(6, ty, 5, 17 - ty, torso_c)
    cv.vline(6, ty, 17 - ty, shade(torso_c, 0.8))
    if "labcoat" in acc:
        cv.vline(10, ty, 17 - ty, shirt)
        cv.rect(6, 17, 5, 2, torso_c)
    # braço
    hand = "#c9d3e6" if robot else skin
    if f == 0:
        cv.vline(9, ty + 1, 3, shade(torso_c, 0.85)); cv.px(10, ty + 4, shade(torso_c, 0.85)); cv.px(11, ty + 5, hand)
    elif f == 2:
        cv.vline(7, ty + 1, 3, shade(torso_c, 0.85)); cv.px(6, ty + 4, shade(torso_c, 0.85)); cv.px(5, ty + 5, hand)
    else:
        cv.vline(8, ty + 1, 4, shade(torso_c, 0.85)); cv.px(8, ty + 5, hand)
    # cabeça
    hy = 2 + dy
    if robot:
        cv.rect(5, hy, 7, 8, skin); cv.rect(4, hy + 1, 9, 6, skin)
        cv.rect(9, hy + 3, 4, 3, "#0d1630"); cv.rect(10, hy + 4, 2, 1, "#39d6ff")
        cv.vline(7, max(0, hy - 2), 2, "#7f8aa6"); cv.px(7, max(0, hy - 2), spec["neon"])
    else:
        cv.rect(6, hy + 2, 6, 8, skin)
        cv.rect(5, hy + 3, 7, 5, skin)
        cv.px(12, hy + 5, skin)  # nariz
        cv.vline(10, hy + 4, 2, EYE)
        cv.px(11, hy + 7, shade(skin, 0.72))
        cv.rect(7, 10 + dy, 3, 1, shade(skin, 0.8))
        st = spec["style"]
        dk = shade(hair, 0.75)
        if st != "bald":
            cv.rect(6, hy, 5, 1, hair)
            cv.rect(5, hy + 1, 7, 2, hair)
            cv.rect(5, hy + 3, 3, 3, hair)
            cv.px(11, hy + 3, hair)
            cv.px(7, hy + 6, dk)
        if st == "messy":
            cv.px(6, hy - 1, hair); cv.px(9, hy - 1, hair); cv.px(4, hy + 2, hair)
        if st == "spiky":
            for x in (5, 7, 9):
                cv.px(x, hy - 1, hair)
        if st == "long":
            cv.rect(4, hy + 2, 3, 10, hair)
        if st == "ponytail":
            cv.rect(3, hy + 2, 2, 6, dk)
        if st == "bun":
            cv.rect(4, max(0, hy - 1), 3, 3, hair)
        if st == "curly":
            cv.rect(4, hy, 7, 4, hair); cv.rect(4, hy + 4, 2, 3, hair)
        if "beard" in acc:
            cv.rect(8, hy + 6, 4, 3, hair)
        if "glasses" in acc:
            cv.hline(9, hy + 3, 3, "#20203a"); cv.px(11, hy + 4, "#20203a")
        if "headphones" in acc:
            cv.hline(6, max(0, hy - 1), 5, "#1e1e2e")
            cv.rect(7, hy + 3, 2, 3, "#1e1e2e"); cv.px(7, hy + 4, spec["neon"])
        if "wizard" in acc:
            hat = "#5a2fb0"
            cv.rect(3, hy + 2, 11, 1, shade(hat, 0.8))
            cv.rect(5, hy, 7, 2, hat); cv.rect(6, max(0, hy - 1), 5, 1, hat)
            cv.rect(5, 0, 3, 1, hat); cv.hline(5, hy + 1, 7, "#ffb800")
        if "cap" in acc:
            cv.rect(5, max(0, hy - 1), 7, 3, shade(spec["neon"], 0.8))
            cv.hline(10, hy + 2, 4, shade(spec["neon"], 0.6))
    cv.outline(OUTLINE)
    return cv


# ---------------------------------------------------------------------------
# Quadros de costas (andar para cima / sentado digitando)
# ---------------------------------------------------------------------------
def _back(spec: dict, pose: str, f: int) -> Canvas:
    cv = Canvas(FW, FH)
    robot = spec.get("kind") == "robot"
    skin, hair = spec["skin"], spec["hair"]
    shirt, pants, shoes = spec["shirt"], spec["pants"], spec["shoes"]
    acc = spec.get("acc", [])
    coat = "labcoat" in acc
    torso_c = "#e8eef7" if coat else shirt
    dy = -1 if pose == "walk" and f in (1, 3) else 0
    # pernas
    lift_l = pose == "walk" and f == 0
    lift_r = pose == "walk" and f == 2
    cv.rect(4, 17, 8, 1, shade(pants, 0.85))
    for (lx, lift) in ((5, lift_l), (8, lift_r)):
        bot = 21 - (1 if lift else 0)
        cv.rect(lx, 18, 3, bot - 17, pants)
        sx = lx - 1 if lx == 5 else lx
        cv.rect(sx, bot + 1, 4, 2, shade(shoes, 0.9))
    if coat:
        cv.rect(4, 17, 8, 3, torso_c); cv.vline(8, 17, 3, shade(torso_c, 0.8))
    ty = 11 + dy
    cv.rect(4, ty, 8, 17 - ty, torso_c)
    cv.vline(4, ty, 17 - ty, shade(torso_c, 0.8)); cv.vline(11, ty, 17 - ty, shade(torso_c, 0.8))
    if "hoodie" in acc:
        cv.rect(5, ty, 6, 2, shade(shirt, 0.65))
    hand = "#c9d3e6" if robot else skin
    if pose == "sit":
        up = 0 if f == 0 else 1
        cv.vline(3, ty + 1, 3, torso_c); cv.vline(12, ty + 1, 3, torso_c)
        cv.px(3, ty + 4 - up, hand); cv.px(12, ty + 3 + up, hand)
    else:
        lh = 16 - (1 if pose == "walk" and f == 0 else 0)
        rh = 16 - (1 if pose == "walk" and f == 2 else 0)
        cv.vline(3, ty + 1, lh - ty - 1, torso_c); cv.px(3, lh, hand)
        cv.vline(12, ty + 1, rh - ty - 1, torso_c); cv.px(12, rh, hand)
    hy = 2 + dy
    if robot:
        cv.rect(4, hy, 8, 8, skin); cv.rect(3, hy + 1, 10, 6, skin)
        cv.hline(4, hy + 7, 8, shade(skin, 0.8)); cv.rect(6, hy + 3, 4, 2, shade(skin, 0.85))
        cv.vline(8, max(0, hy - 2), 2, "#7f8aa6"); cv.px(8, max(0, hy - 2), spec["neon"])
        cv.rect(7, hy + 8, 2, 1, "#7f8aa6")
    else:
        cv.rect(5, hy + 2, 6, 8, skin); cv.rect(4, hy + 3, 8, 5, skin)
        cv.rect(6, 10 + dy, 4, 1, shade(skin, 0.8))
        st = spec["style"]
        dk = shade(hair, 0.75)
        if st != "bald":
            cv.rect(5, hy, 6, 1, hair); cv.rect(4, hy + 1, 8, 6, hair)
            cv.rect(5, hy + 7, 6, 1, dk)
            cv.hline(5, hy, 4, shade(hair, 1.3))
        if st == "messy":
            for x in (5, 8, 10):
                cv.px(x, hy - 1, hair)
        if st == "spiky":
            for x in (4, 6, 8, 10):
                cv.px(x, max(0, hy - 1), hair)
        if st == "long":
            cv.rect(3, hy + 2, 10, 10, hair); cv.vline(8, hy + 3, 8, dk)
        if st == "ponytail":
            cv.rect(7, hy + 6, 2, 6, dk); cv.px(7, hy + 6, "#ffb800")
        if st == "bun":
            cv.rect(6, max(0, hy - 2), 4, 3, hair)
        if st == "curly":
            cv.rect(3, hy, 10, 8, hair)
            for x in range(4, 12, 3):
                cv.px(x, hy + 2, shade(hair, 1.3))
        if "headphones" in acc:
            cv.hline(4, max(0, hy - 1), 8, "#1e1e2e")
            cv.rect(3, hy + 3, 1, 3, "#1e1e2e"); cv.rect(12, hy + 3, 1, 3, "#1e1e2e")
            cv.px(3, hy + 4, spec["neon"]); cv.px(12, hy + 4, spec["neon"])
        if "wizard" in acc:
            hat = "#5a2fb0"
            cv.rect(2, hy + 2, 12, 1, shade(hat, 0.8)); cv.rect(4, hy, 8, 2, hat)
            cv.rect(5, max(0, hy - 1), 6, 1, hat); cv.rect(6, max(0, hy - 2), 4, 1, hat)
            cv.hline(4, hy + 1, 8, "#ffb800")
        if "cap" in acc:
            cv.rect(4, max(0, hy - 1), 8, 3, shade(spec["neon"], 0.8))
    cv.outline(OUTLINE)
    return cv


def character_strip(spec: dict) -> Canvas:
    strip = Canvas(FW * FRAMES_PER_CHAR, FH)
    frames: list[Canvas] = [
        _front(spec, "idle", 0), _front(spec, "idle", 1),
        *[_front(spec, "walk", i) for i in range(4)],
        *[_side(spec, i) for i in range(4)],
        _front(spec, "work", 0), _front(spec, "work", 1),
        _front(spec, "talk", 0), _front(spec, "talk", 1),
        _front(spec, "think", 0), _front(spec, "think", 1),
        _front(spec, "cheer", 0),
        *[_back(spec, "walk", i) for i in range(4)],
        _back(spec, "sit", 0), _back(spec, "sit", 1),
        _front(spec, "coffee", 0), _front(spec, "coffee", 1),
        _front(spec, "read", 0), _front(spec, "read", 1),
    ]
    for i, fr in enumerate(frames):
        strip.blit(fr, i * FW, 0)
    return strip


def spritesheet() -> Canvas:
    sheet = Canvas(FW * FRAMES_PER_CHAR, FH * len(CAST))
    for row, spec in enumerate(CAST):
        sheet.blit(character_strip(spec), 0, row * FH)
    return sheet


# ---------------------------------------------------------------------------
# Retrato 24x24 (avatares dos cards e do perfil)
# ---------------------------------------------------------------------------
def portrait(spec: dict) -> Canvas:
    cv = Canvas(24, 24)
    skin, hair, shirt = spec["skin"], spec["hair"], spec["shirt"]
    acc = spec.get("acc", [])
    robot = spec.get("kind") == "robot"
    hl, dk = shade(hair, 1.35), shade(hair, 0.72)
    # ombros
    body = "#e8eef7" if "labcoat" in acc else shirt
    cv.rect(3, 19, 18, 5, body)
    cv.rect(2, 20, 20, 4, body)
    cv.hline(3, 19, 18, shade(body, 1.15))
    cv.vline(20, 20, 4, shade(body, 0.78)); cv.vline(21, 20, 4, shade(body, 0.78))
    if "labcoat" in acc:
        cv.rect(10, 19, 4, 5, shirt)
    if "hoodie" in acc:
        cv.rect(4, 18, 16, 2, shade(shirt, 0.7))
        cv.vline(9, 20, 3, "#e9e9f2"); cv.vline(14, 20, 3, "#e9e9f2")
    if robot:
        cv.rect(5, 3, 14, 14, skin); cv.rect(4, 5, 16, 10, skin)
        cv.hline(5, 16, 14, shade(skin, 0.8))
        cv.rect(6, 8, 12, 5, "#0d1630")
        cv.rect(8, 9, 3, 2, "#39d6ff"); cv.rect(13, 9, 3, 2, "#39d6ff")
        cv.px(8, 9, "#e9fbff"); cv.px(13, 9, "#e9fbff")
        cv.vline(12, 0, 3, "#7f8aa6"); cv.rect(11, 0, 2, 1, spec["neon"])
        cv.rect(3, 8, 1, 4, "#7f8aa6"); cv.rect(20, 8, 1, 4, "#7f8aa6")
        cv.rect(10, 17, 4, 2, "#7f8aa6")
        cv.rect(9, 20, 6, 2, "#39d6ff")
        cv.outline(OUTLINE)
        return cv
    # pescoço e cabeça
    cv.rect(10, 16, 4, 3, shade(skin, 0.8))
    cv.rect(6, 4, 12, 13, skin)
    cv.rect(5, 6, 14, 9, skin)
    cv.vline(18, 6, 9, shade(skin, 0.86)); cv.vline(17, 13, 3, shade(skin, 0.9))
    cv.rect(4, 9, 1, 3, skin); cv.rect(19, 9, 1, 3, shade(skin, 0.86))  # orelhas
    cv.rect(7, 16, 10, 1, shade(skin, 0.9))
    # olhos
    for ex in (8, 14):
        cv.rect(ex, 10, 2, 2, EYE)
        cv.px(ex, 10, "#ffffff")
    cv.hline(8, 8, 2, dk); cv.hline(14, 8, 2, dk)
    cv.px(12, 12, shade(skin, 0.8))  # nariz
    cv.rect(11, 14, 3, 1, shade(skin, 0.65))
    cv.px(7, 13, mix_blush(skin)); cv.px(16, 13, mix_blush(skin))
    style = spec["style"]
    if style != "bald":
        cv.rect(6, 2, 12, 2, hair)
        cv.rect(5, 3, 14, 4, hair)
        cv.hline(7, 2, 6, hl); cv.hline(6, 3, 3, hl)
        for x in (5, 6, 7, 8, 10, 15, 16, 17, 18):
            cv.px(x, 7, hair)
        cv.px(5, 8, hair); cv.px(18, 8, dk); cv.px(5, 9, hair)
    if style == "messy":
        for x, y in ((6, 1), (9, 0), (10, 1), (14, 1), (17, 1), (19, 4), (4, 4)):
            cv.px(x, y, hair)
        cv.px(11, 7, hair); cv.px(12, 8, hair)
    if style == "spiky":
        for x in (5, 8, 11, 14, 17):
            cv.rect(x, 0, 2, 2, hair)
    if style == "long":
        cv.rect(3, 5, 3, 15, hair); cv.rect(18, 5, 3, 15, dk); cv.vline(4, 7, 10, hl)
    if style == "ponytail":
        cv.rect(19, 4, 3, 3, hair); cv.rect(20, 7, 3, 9, dk); cv.px(19, 4, "#ffb800")
    if style == "bun":
        cv.rect(9, 0, 6, 3, hair); cv.hline(9, 3, 6, "#ffb800")
    if style == "curly":
        for x in range(4, 20, 3):
            cv.rect(x, 1, 2, 2, hair)
        cv.rect(4, 3, 16, 4, hair); cv.rect(4, 7, 2, 6, hair); cv.rect(18, 7, 2, 6, dk)
        for x in range(5, 19, 4):
            cv.px(x, 4, hl)
    if "beard" in acc:
        cv.rect(5, 12, 14, 5, hair); cv.rect(7, 17, 10, 1, hair)
        cv.rect(10, 14, 4, 1, shade(skin, 0.7))
        cv.rect(5, 12, 1, 1, skin); cv.rect(18, 12, 1, 1, shade(skin, 0.86))
    if "glasses" in acc:
        fr = "#20203a"
        cv.frame(7, 9, 4, 4, fr); cv.frame(13, 9, 4, 4, fr); cv.hline(11, 10, 2, fr)
        cv.px(9, 12, (159, 231, 255, 140)); cv.px(15, 12, (159, 231, 255, 140))
    if "headphones" in acc:
        band = "#1e1e2e"
        cv.hline(6, 1, 12, band); cv.px(5, 2, band); cv.px(18, 2, band)
        cv.vline(4, 3, 4, band); cv.vline(19, 3, 4, band)
        cv.rect(2, 7, 3, 6, band); cv.rect(19, 7, 3, 6, band)
        cv.vline(3, 8, 4, spec["neon"]); cv.vline(20, 8, 4, spec["neon"])
    if "wizard" in acc:
        hat = "#5a2fb0"
        cv.clear_rect(0, 0, 24, 2)
        cv.rect(2, 5, 20, 2, shade(hat, 0.8))
        cv.rect(6, 2, 12, 3, hat); cv.rect(8, 0, 8, 2, hat)
        cv.rect(15, 0, 3, 1, shade(hat, 1.3))
        cv.hline(6, 4, 12, "#ffb800"); cv.px(10, 2, "#fff3a8"); cv.px(13, 1, "#fff3a8")
    if "cap" in acc:
        cap = spec["neon"]
        cv.rect(5, 1, 14, 5, shade(cap, 0.8)); cv.hline(5, 6, 17, shade(cap, 0.55))
        cv.rect(11, 2, 2, 2, "#ffffff")
    cv.outline(OUTLINE)
    return cv


def mix_blush(skin: str):
    s = C(skin)
    return (min(255, s[0] + 10), int(s[1] * 0.78), int(s[2] * 0.78), 255)
