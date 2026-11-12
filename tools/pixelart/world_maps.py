"""
Mapas do mundo (Escritório e Laboratório) — grade 40x23 tiles de 16px.

Saídas por sala:
  public/assets/world/<id>_ground.png   camada de chão/paredes (tiles pintados)
  public/assets/world/<id>_props.png    atlas de props (y-sort e interação no Phaser)
  public/assets/world/<id>_props.json   frames do atlas (formato JSON-hash do Phaser)
  src/world/data/<id>.json              tilemap de navegação, pontos de interação, zonas, luzes
"""
from __future__ import annotations

import json
import os

from pxlib import Canvas, shade, draw_text, rng
import props as P
import world_props as WP

T = 16
W, H = 40, 23
WALK = set(".ms")


class WorldMap:
    def __init__(self, rid: str, name: str):
        self.id, self.name = rid, name
        self.grid = [["." for _ in range(W)] for _ in range(H)]
        self.ground = Canvas(W * T, H * T, "#080e1a")
        self.props: list[dict] = []
        self.points: list[dict] = []
        self.zones: list[dict] = []
        self.lights: list[dict] = []
        self.anims: list[dict] = []
        self.leds: list[dict] = []
        self._pid = 0

    # ---- grade --------------------------------------------------------
    def fill(self, x0, y0, x1, y1, ch):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.grid[y][x] = ch

    def add_prop(self, name, img: Canvas, tx, ty, fw=1, fh=1, label="", desc="", kind="decor",
                 block=True, offx=0, offy=0, depth=None, interactive=False, align="center"):
        self._pid += 1
        pid = f"{self.id}-p{self._pid}"
        if align == "center":
            x = tx * T + (fw * T - img.w) // 2 + offx
        else:
            x = tx * T + offx
        y = (ty + fh) * T - img.h + offy
        if block:
            for yy in range(ty, ty + fh):
                for xx in range(tx, tx + fw):
                    if 0 <= yy < H and 0 <= xx < W:
                        self.grid[yy][xx] = "x"
        self.props.append(dict(id=pid, frame=f"{name}_{self._pid}", img=img, x=x, y=y, w=img.w, h=img.h,
                               depth=depth if depth is not None else (ty + fh) * T, label=label, desc=desc,
                               kind=kind, interactive=interactive, tile=dict(x=tx, y=ty, w=fw, h=fh)))
        return pid

    def point(self, pid, ptype, tx, ty, facing="up", sit=False, prop=None, zone=None, dx=0, dy=0, chair=None):
        self.points.append(dict(id=f"{self.id}-{pid}", type=ptype, x=tx, y=ty, facing=facing, sit=sit,
                                prop=prop, zone=zone, dx=dx, dy=dy))
        if chair:
            img = WP.chair(chair[0], chair[1])
            depth = (ty + 1) * T + (2 if chair[0] == "up" else -6)
            self.add_prop("chair", img, tx, ty, 1, 1, block=False, offy=4 if chair[0] == "up" else -2, depth=depth, kind="chair")

    def zone(self, zid, name, x0, y0, x1, y1):
        self.zones.append(dict(id=zid, name=name, x0=x0, y0=y0, x1=x1, y1=y1))

    def light(self, x, y, r, color, flicker=False):
        self.lights.append(dict(x=x, y=y, r=r, color=color, flicker=flicker))

    # ---- exportação ---------------------------------------------------
    def nav_rows(self):
        return ["".join(ch if ch in WALK else "#" for ch in row) for row in self.grid]

    def export(self, assets_dir: str, data_dir: str):
        os.makedirs(assets_dir, exist_ok=True)
        os.makedirs(data_dir, exist_ok=True)
        self.ground.save(os.path.join(assets_dir, f"{self.id}_ground.png"))
        # atlas por "shelf packing"
        aw = 1024
        x = y = rowh = 0
        frames = {}
        placements = []
        for p in sorted(self.props, key=lambda q: -q["h"]):
            if x + p["w"] + 1 > aw:
                x, y, rowh = 0, y + rowh + 1, 0
            placements.append((p, x, y))
            frames[p["frame"]] = {"frame": {"x": x, "y": y, "w": p["w"], "h": p["h"]}, "rotated": False, "trimmed": False,
                                  "spriteSourceSize": {"x": 0, "y": 0, "w": p["w"], "h": p["h"]}, "sourceSize": {"w": p["w"], "h": p["h"]}}
            x += p["w"] + 1
            rowh = max(rowh, p["h"])
        atlas = Canvas(aw, y + rowh + 1)
        for p, ax, ay in placements:
            atlas.blit(p["img"], ax, ay)
        atlas.save(os.path.join(assets_dir, f"{self.id}_props.png"))
        with open(os.path.join(assets_dir, f"{self.id}_props.json"), "w", encoding="utf-8") as fh:
            json.dump({"frames": frames, "meta": {"image": f"{self.id}_props.png", "size": {"w": aw, "h": y + rowh + 1}, "scale": "1"}}, fh)
        data = dict(
            id=self.id, name=self.name, tile=T, width=W, height=H,
            ground=f"{self.id}_ground", atlas=f"{self.id}_props",
            nav=self.nav_rows(),
            props=[{k: v for k, v in p.items() if k != "img"} for p in self.props],
            points=self.points, zones=self.zones, lights=self.lights, anims=self.anims, leds=self.leds,
        )
        with open(os.path.join(data_dir, f"{self.id}.json"), "w", encoding="utf-8") as fh:
            json.dump(data, fh, ensure_ascii=False, separators=(",", ":"))
        return data


# ---------------------------------------------------------------------------
# Pintura de tiles
# ---------------------------------------------------------------------------
def paint_floor_office(cv: Canvas, tx, ty, r):
    x, y = tx * T, ty * T
    base = "#2b2150" if (tx + ty) % 2 == 0 else "#2e2355"
    cv.rect(x, y, T, T, base)
    cv.hline(x, y, T, "#33285f"); cv.vline(x, y, T, "#33285f")
    if r.random() < 0.25:
        cv.hline(x + 3, y + 4, 4, "#3d3274")
    if tx >= 22:  # reflexos das janelas
        if (tx * 7 + ty) % 5 == 0:
            cv.vline(x + 8, y, T, (57, 214, 255, 26))
        if (tx * 3 + ty) % 7 == 0:
            cv.vline(x + 4, y, T, (255, 83, 122, 22))


def paint_planks(cv: Canvas, tx, ty, base="#6b3f2a"):
    x, y = tx * T, ty * T
    cv.rect(x, y, T, T, base)
    for k in range(0, T, 5):
        cv.hline(x, y + k, T, shade(base, 0.82))
    if (tx + ty) % 3 == 0:
        cv.vline(x + (tx * 5) % 13, y, 5, shade(base, 0.8))
    cv.px(x + 4, y + 2, shade(base, 1.15)); cv.px(x + 11, y + 7, shade(base, 1.15))


def paint_floor_lab(cv: Canvas, tx, ty, r):
    x, y = tx * T, ty * T
    cv.rect(x, y, T, T, "#151e38" if (tx + ty) % 2 else "#172240")
    cv.hline(x, y, T, "#1d2b4d"); cv.vline(x, y, T, "#1d2b4d")
    if r.random() < 0.18:
        cv.rect(x + 3, y + 3, 3, 1, (57, 214, 255, 50))
    if ty in (14,) and tx % 2 == 0:
        cv.hline(x, y + 8, T, (157, 98, 255, 140))


def paint_grating(cv: Canvas, tx, ty):
    x, y = tx * T, ty * T
    cv.rect(x, y, T, T, "#28304e")
    for k in range(0, T, 4):
        cv.hline(x, y + k, T, "#1d243c"); cv.vline(x + k, y, T, "#1d243c")
    cv.hline(x, y, T, "#3a456e")


def paint_stairs(cv: Canvas, tx, ty, base="#7a4a30"):
    x, y = tx * T, ty * T
    for k in range(0, T, 4):
        cv.rect(x, y + k, T, 4, shade(base, 0.85 + (k / T) * 0.25))
        cv.hline(x, y + k, T, shade(base, 1.3))


# ---------------------------------------------------------------------------
# ESCRITÓRIO (referência: imagem 1 do redesign)
# ---------------------------------------------------------------------------
def build_office() -> WorldMap:
    m = WorldMap("office", "Escritório")
    g = m.grid
    m.fill(0, 0, 39, 3, "#"); m.fill(22, 4, 39, 4, "#")
    m.fill(0, 4, 20, 8, "m")
    m.fill(0, 9, 20, 10, "L"); m.fill(2, 9, 4, 10, "s")
    m.fill(21, 4, 21, 10, "L")
    r = rng(5)
    cv = m.ground
    for ty in range(H):
        for tx in range(W):
            ch = g[ty][tx]
            if ch == ".":
                paint_floor_office(cv, tx, ty, r)
            elif ch == "m":
                paint_planks(cv, tx, ty)
            elif ch == "s":
                paint_stairs(cv, tx, ty)
    # parede esquerda (acima do mezanino)
    cv.rect(0, 0, 352, 64, "#24183f")
    for xx in range(0, 352, 22):
        cv.rect(xx + 2, 4, 18, 56, "#2b1c4c"); cv.hline(xx + 2, 4, 18, "#382664")
    cv.rect(0, 0, 352, 3, "#120b24"); cv.hline(0, 3, 352, P.NEON_P)
    P.bookshelf(cv, 6, 6, 86, 58, seed=31)
    # letreiro neon com cérebro
    cv.glow(118, 10, 70, 40, P.NEON_P, alpha=80, spread=5)
    cv.rect(118, 10, 70, 40, "#120a2a"); cv.frame(118, 10, 70, 40, P.NEON_C); cv.frame(119, 11, 68, 38, "#1d4f7a")
    cv.ellipse(153, 30, 22, 14, (255, 122, 193, 50))
    for yy in range(18, 44):
        for xx in range(131, 176):
            if ((xx - 153) / 22) ** 2 + ((yy - 30) / 13) ** 2 <= 1 and ((xx - 153) / 22) ** 2 + ((yy - 30) / 13) ** 2 >= 0.72:
                cv.px(xx, yy, "#ff7ac1")
    cv.vline(153, 18, 25, "#ff7ac1")
    for k in range(3):
        cv.hline(138 + k * 4, 24 + k * 6, 10, "#ff9ad2"); cv.hline(156, 24 + k * 6, 10 - k * 2, "#ff9ad2")
    P.bookshelf(cv, 206, 6, 110, 58, seed=32)
    for vx in (4, 100, 196, 322, 346):
        P.hanging_vine(cv, vx, 3, 18 + vx % 10, seed=vx)
    for lx in (60, 250):
        P.ceiling_lamp(cv, lx, 0, 3)
    # janelas panorâmicas à direita
    cv.rect(352, 0, 288, 80, "#1d1338")
    P.window(cv, 358, 4, 276, 66, seed=41, moon=True, panes=6)
    cv.rect(352, 76, 288, 4, "#3a2660"); cv.hline(352, 76, 288, "#5a3d8f")
    # face frontal do mezanino (sob o mezanino)
    cv.rect(0, 144, 336, 32, "#2a1838")
    cv.hline(0, 144, 336, "#5a3d8f"); cv.hline(0, 145, 336, P.NEON_P)
    for sx in (90, 200, 270):
        P.bookshelf(cv, sx, 150, 52, 26, seed=sx)
    cv.rect(6, 152, 22, 20, "#1a1030")
    paint_stairs_block = [(2, 9), (3, 9), (4, 9), (2, 10), (3, 10), (4, 10)]
    for (sx, sy) in paint_stairs_block:
        paint_stairs(cv, sx, sy)
    cv.hline(32, 174, 48, "#3a2238")
    # lateral do mezanino (coluna)
    cv.rect(336, 64, 16, 112, "#2a1838"); cv.vline(340, 64, 112, P.NEON_C); cv.vline(347, 64, 112, "#3a2660")
    # tapetes
    for yy in range(12 * T + 4, 17 * T + 12):
        for xx in range(13 * T, 23 * T):
            if (xx + yy) % 2 == 0:
                cv.px(xx, yy, (157, 98, 255, 70))
    cv.frame(13 * T, 12 * T + 4, 10 * T, 5 * T + 8, (255, 83, 122, 160))
    cv.ellipse(31 * T, 18 * T + 8, 56, 26, (255, 83, 122, 70)); cv.ellipse(31 * T, 18 * T + 8, 50, 22, (255, 122, 193, 50))

    m.zone("lounge", "Mezanino · Lounge", 0, 4, 20, 8)
    m.zone("pesquisa", "Canto de Pesquisa", 0, 11, 12, 15)
    m.zone("dev", "Desenvolvimento", 0, 16, 12, 22)
    m.zone("mesa", "Mesa Colaborativa", 13, 11, 23, 18)
    m.zone("dados", "Análise de Dados", 22, 5, 39, 10)
    m.zone("cafe", "Cafeteria", 24, 11, 39, 22)

    # --- mezanino ---
    cp = m.add_prop("couch", WP.couch(3), 6, 4, 3, 1, "Sofá do lounge", "Área de descanso dos agentes.", kind="rest", interactive=True)
    for i, sx in enumerate((6, 7, 8)):
        m.point(f"sofa{i}", "rest", sx, 5, "down", sit=True, prop=cp, zone="lounge", dy=-9)
    cb = m.add_prop("catbed", WP.cat_bed(), 10, 5, 2, 1, "Caminha do gato", "O mascote do laboratório.", block=True)
    m.anims.append(dict(type="cat", x=10 * T + 5, y=5 * T + 2))
    ac = m.add_prop("armchair", WP.armchair("#7a4bd1"), 14, 5, 1, 1, "Poltrona de leitura", "", kind="rest", interactive=True)
    m.point("poltrona", "read", 14, 6, "down", sit=True, prop=ac, zone="lounge", dy=-11)
    m.add_prop("lamp", WP.floor_lamp(), 13, 4, 1, 1, block=True)
    m.light(13 * T + 8, 4 * T + 4, 30, "#ffd36b")
    bs = m.add_prop("shelf", WP.bookshelf_prop(32, 46, 77), 17, 4, 2, 1, "Estante técnica", "Livros e documentação.", kind="read", interactive=True)
    m.point("estante1", "read", 17, 5, "up", prop=bs, zone="lounge")
    m.add_prop("plant", WP.plant_prop(30, 11), 19, 4, 1, 1)
    m.add_prop("plant", WP.plant_prop(26, 12, "#7a4bd1"), 0, 7, 1, 1)
    m.add_prop("dock", WP.robot_dock(), 3, 5, 2, 1, "Base de recarga", "Estação de recarga dos robôs.", block=False, depth=5 * T)
    m.point("recarga", "observe", 3, 5, "down", zone="lounge")
    m.point("vista_mez", "window", 11, 7, "down", zone="lounge")
    m.add_prop("rail", WP.railing(2 * T), 0, 8, 2, 1, block=False, align="left", depth=9 * T, offy=0)
    m.add_prop("rail", WP.railing(16 * T), 5, 8, 16, 1, block=False, align="left", depth=9 * T)
    m.add_prop("srail", WP.stairs_rail(46), 2, 9, 1, 2, block=False, align="left", offx=-2, depth=11 * T + 2)
    m.add_prop("srail", WP.stairs_rail(46), 4, 9, 1, 2, block=False, align="left", offx=14, depth=11 * T + 2)

    # --- canto de pesquisa ---
    gb = m.add_prop("globe", WP.globe_base(), 1, 13, 2, 1, "Globo holográfico", "Mapa de conhecimento em 3D.", kind="observe", interactive=True)
    m.anims.append(dict(type="globe", x=1 * T + 2, y=13 * T - 26))
    m.light(2 * T, 12 * T, 46, "#39d6ff", flicker=True)
    m.point("globo", "observe", 2, 14, "up", prop=gb, zone="pesquisa")
    bb = m.add_prop("beanbag", WP.beanbag("#9d62ff"), 5, 12, 2, 1, "Pufe de leitura", "", kind="rest", interactive=True)
    m.point("pufe", "read", 6, 13, "down", sit=True, prop=bb, zone="pesquisa", dy=-10)
    bs2 = m.add_prop("shelf", WP.bookshelf_prop(32, 40, 78), 9, 11, 2, 1, "Estante de artigos", "Artigos e papers.", kind="read", interactive=True)
    m.point("estante2", "read", 9, 12, "up", prop=bs2, zone="pesquisa")
    m.add_prop("plant", WP.plant_prop(30, 13), 0, 15, 1, 1)
    # --- desenvolvimento ---
    d1 = m.add_prop("desk", WP.desk_pc(3, "dual", 1), 2, 18, 3, 1, "Estação de desenvolvimento", "Dois monitores e IDE.", kind="work", interactive=True)
    m.point("w_dev1", "work", 3, 19, "up", sit=True, prop=d1, zone="dev", chair=("up", "#3a2a66"))
    d2 = m.add_prop("desk", WP.desk_pc(3, "single", 2), 7, 18, 3, 1, "Estação de código", "Monitor de código.", kind="work", interactive=True)
    m.point("w_dev2", "work", 8, 19, "up", sit=True, prop=d2, zone="dev", chair=("up", "#3a2a66"))
    m.add_prop("plant", WP.plant_prop(28, 14, "#e2e8f0"), 0, 21, 1, 1)
    m.add_prop("plant", WP.small_plant_prop(1), 11, 20, 1, 1)
    m.add_prop("cooler", WP.water_cooler(), 11, 16, 1, 1, "Bebedouro", "", kind="coffee", interactive=True)
    m.point("agua", "coffee", 11, 17, "up", zone="dev")
    # --- mesa colaborativa ---
    tb = m.add_prop("table", WP.big_table(8, 2, 3), 14, 14, 8, 2, "Mesa colaborativa", "Reuniões e pareamento.", kind="meet", interactive=True)
    for i, sx in enumerate((15, 17, 19, 21)):
        m.point(f"mesa_t{i}", "meet", sx, 13, "down", sit=True, prop=tb, zone="mesa", dy=2, chair=("down", "#3a2a66"))
    for i, sx in enumerate((15, 17, 19, 21)):
        m.point(f"w_mesa{i}", "work", sx, 16, "up", sit=True, prop=tb, zone="mesa", dy=-2, chair=("up", "#3a2a66"))
    # --- análise de dados (perto das janelas) ---
    d3 = m.add_prop("desk", WP.desk_pc(3, "dual", 3), 25, 6, 3, 1, "Estação de análise", "Dashboards e SQL.", kind="work", interactive=True)
    m.point("w_dados1", "work", 26, 7, "up", sit=True, prop=d3, zone="dados", chair=("up", "#2a3a66"))
    d4 = m.add_prop("desk", WP.desk_pc(3, "dual", 4), 30, 6, 3, 1, "Estação de BI", "Modelos e relatórios.", kind="work", interactive=True)
    m.point("w_dados2", "work", 31, 7, "up", sit=True, prop=d4, zone="dados", chair=("up", "#2a3a66"))
    tel = m.add_prop("telescope", WP.telescope_prop(), 36, 5, 1, 1, "Telescópio", "Observação da cidade.", kind="observe", interactive=True)
    m.point("telescopio", "observe", 36, 6, "up", prop=tel, zone="dados")
    for i, wx in enumerate((23, 34)):
        m.point(f"janela{i}", "window", wx, 5, "up", zone="dados")
    tk = m.add_prop("tank", WP.brain_tank_prop(62), 37, 9, 2, 1, "Tanque neural", "Monitor do núcleo de IA.", kind="observe", interactive=True)
    m.point("tanque", "observe", 37, 10, "up", prop=tk, zone="dados")
    m.anims.append(dict(type="bubbles", x=37 * T + 6, y=9 * T - 44, w=20, h=34))
    m.light(38 * T, 7 * T, 48, "#39d6ff", flicker=True)
    m.add_prop("plant", WP.plant_prop(28, 15), 22, 5, 1, 1)
    m.add_prop("plant", WP.plant_prop(24, 16, "#7a4bd1"), 34, 9, 1, 1)
    # --- cafeteria ---
    cc = m.add_prop("coffee", WP.coffee_counter(5), 33, 12, 5, 1, "Cafeteria", "Café, chá e conversas.", kind="coffee", interactive=True)
    m.point("cafe1", "coffee", 34, 13, "up", prop=cc, zone="cafe")
    m.point("cafe2", "coffee", 36, 13, "up", prop=cc, zone="cafe")
    m.light(35 * T, 12 * T, 40, "#ffb800")
    rt = m.add_prop("rtable", WP.round_table(), 30, 18, 2, 1, "Mesa de café", "", kind="meet", interactive=True)
    m.point("cafe_m1", "meet", 29, 18, "right", zone="cafe", prop=rt)
    m.point("cafe_m2", "meet", 32, 18, "left", zone="cafe", prop=rt)
    m.point("cafe_m3", "meet", 30, 19, "up", zone="cafe", prop=rt)
    bb2 = m.add_prop("beanbag", WP.beanbag("#ffb800"), 37, 18, 2, 1, "Pufe", "", kind="rest", interactive=True)
    m.point("pufe2", "rest", 37, 19, "down", sit=True, prop=bb2, zone="cafe", dy=-9)
    d5 = m.add_prop("desk", WP.desk_pc(3, "laptop", 5, "wood"), 25, 19, 3, 1, "Estação de automação", "Integrações e rotinas.", kind="work", interactive=True)
    m.point("w_auto", "work", 26, 20, "up", sit=True, prop=d5, zone="cafe", chair=("up", "#3a2a66"))
    m.add_prop("lamp", WP.floor_lamp("#ff9ad2"), 24, 13, 1, 1)
    m.light(24 * T + 8, 13 * T + 4, 28, "#ff537a")
    m.add_prop("plant", WP.plant_prop(30, 17, "#e2e8f0"), 39, 15, 1, 1)
    m.add_prop("plant", WP.plant_prop(26, 18), 39, 21, 1, 1)
    m.add_prop("plant", WP.plant_prop(26, 19, "#7a4bd1"), 22, 21, 1, 1)
    sp = m.add_prop("board", WP.standing_board(70, 48, "SPRINT", [("RAG", True), ("GEMINI", True), ("CUSTOS", False)]), 27, 12, 4, 1,
                    "Quadro do sprint", "Missões da equipe (demo).", kind="observe", interactive=True)
    m.point("sprint1", "observe", 27, 13, "up", prop=sp, zone="cafe")
    m.point("sprint2", "observe", 30, 13, "up", prop=sp, zone="cafe")
    m.add_prop("plant", WP.plant_prop(30, 31), 12, 12, 1, 1)
    m.add_prop("plant", WP.small_plant_prop(2), 23, 16, 1, 1)
    for lx in (16, 20):
        m.light(lx * T, 14 * T, 36, "#ffd36b")
    m.light(150, 30, 44, "#ff7ac1", flicker=True)
    m.light(500, 30, 80, "#9d62ff")
    return m


# ---------------------------------------------------------------------------
# LABORATÓRIO (referência: imagem 2 do redesign)
# ---------------------------------------------------------------------------
def build_lab() -> WorldMap:
    m = WorldMap("research", "Laboratório de Pesquisa")
    g = m.grid
    m.fill(0, 0, 39, 3, "#")
    m.fill(0, 4, 10, 7, "m"); m.fill(11, 4, 11, 9, "L"); m.fill(0, 8, 10, 9, "L"); m.fill(7, 8, 9, 9, "s")
    m.fill(29, 4, 39, 7, "m"); m.fill(28, 4, 28, 9, "L"); m.fill(29, 8, 39, 9, "L"); m.fill(30, 8, 32, 9, "s")
    r = rng(8)
    cv = m.ground
    for ty in range(H):
        for tx in range(W):
            ch = g[ty][tx]
            if ch == ".":
                paint_floor_lab(cv, tx, ty, r)
            elif ch == "m":
                paint_grating(cv, tx, ty)
            elif ch == "s":
                paint_stairs(cv, tx, ty, "#4a5580")
    # parede do fundo
    cv.rect(0, 0, 640, 64, "#171233")
    for xx in range(0, 640, 20):
        cv.rect(xx + 1, 4, 18, 58, "#1d173f")
    for py, col in ((8, "#b5317a"), (14, "#2f8fbf")):
        cv.rect(0, py, 640, 4, col); cv.hline(0, py, 640, shade(col, 1.4))
        for jx in range(30, 640, 90):
            cv.rect(jx, py - 1, 6, 6, shade(col, 0.7))
    P.window(cv, 6, 18, 168, 44, seed=51, moon=True, panes=4)
    P.wall_screen(cv, 438, 18, 90, 40, "nodes", P.NEON_P, seed=3)
    P.wall_screen(cv, 534, 18, 50, 40, "chart", P.NEON_C, seed=4)
    cv.blit(WP.jar_shelf(48, 44, 7), 590, 18)
    cv.rect(0, 60, 640, 4, "#2c3352"); cv.hline(0, 60, 640, P.NEON_C)
    # faces dos mezaninos
    for (x0, x1) in ((0, 11 * T), (29 * T, 640)):
        cv.rect(x0, 128, x1 - x0, 32, "#1b2036"); cv.hline(x0, 128, x1 - x0, "#4a5580"); cv.hline(x0, 130, x1 - x0, P.NEON_C)
        for k in range(x0 + 8, x1 - 8, 28):
            cv.rect(k, 138, 16, 14, "#262c47"); cv.px(k + 3, 142, P.NEON_G); cv.px(k + 7, 142, P.NEON_P)
    for (sx, sy) in [(7, 8), (8, 8), (9, 8), (7, 9), (8, 9), (9, 9), (30, 8), (31, 8), (32, 8), (30, 9), (31, 9), (32, 9)]:
        paint_stairs(cv, sx, sy, "#4a5580")
    for cx in (11 * T, 28 * T):
        cv.rect(cx, 64, 16, 96, "#1b2036"); cv.vline(cx + 3, 64, 96, P.NEON_C); cv.vline(cx + 12, 64, 96, "#2c3352")
    # anel no chão em volta da área central
    cv.ellipse(20 * T, 16 * T + 8, 70, 22, (57, 214, 255, 40)); cv.ellipse(20 * T, 16 * T + 8, 64, 18, (23, 34, 64, 200))
    for xx in range(0, 640, 3):
        cv.px(xx, 21 * T + 10, (255, 83, 122, 120))

    m.zone("mez_l", "Passarela Oeste", 0, 4, 10, 7)
    m.zone("mez_r", "Passarela Leste", 29, 4, 39, 7)
    m.zone("reator", "Núcleo Neural", 12, 4, 27, 12)
    m.zone("exp", "Área de Experimentos", 0, 10, 12, 22)
    m.zone("discussao", "Sala de Discussão", 13, 13, 26, 22)
    m.zone("bancada", "Bancadas", 27, 10, 39, 22)

    # reator central
    rx = m.add_prop("reactor", WP.reactor(140, 184), 15, 7, 10, 5, "Núcleo Neural", "Reator com cérebro holográfico — coração do laboratório.", kind="observe", interactive=True)
    m.anims.append(dict(type="brain", x=20 * T - 36, y=12 * T - 184 + 52))
    m.light(20 * T, 6 * T, 90, "#39d6ff", flicker=True)
    m.light(20 * T, 6 * T, 50, "#ff7ac1")
    for i, ox in enumerate((14, 25)):
        m.point(f"reator{i}", "observe", ox, 10, "up" if i == 0 else "up", prop=rx, zone="reator")
    m.point("reator_f", "observe", 20, 13, "up", prop=rx, zone="reator")
    # mezanino oeste
    m.add_prop("plant", WP.plant_prop(30, 21), 0, 4, 1, 1)
    rt = m.add_prop("rtable", WP.round_table(), 4, 4, 2, 1, "Mesa alta", "Conversas rápidas na passarela.", kind="meet", interactive=True)
    m.point("pas1", "meet", 3, 5, "right", prop=rt, zone="mez_l")
    m.point("pas2", "meet", 6, 5, "left", prop=rt, zone="mez_l")
    for i, wx in enumerate((1, 8)):
        m.point(f"janela{i}", "window", wx, 4, "up", zone="mez_l")
    m.add_prop("grail", WP.railing(7 * T, glass=True), 0, 7, 7, 1, block=False, align="left", depth=8 * T)
    m.add_prop("grail", WP.railing(1 * T, glass=True), 10, 7, 1, 1, block=False, align="left", depth=8 * T)
    # mezanino leste
    js = m.add_prop("jars", WP.jar_shelf(48, 40, 3), 34, 4, 3, 1, "Estoque de reagentes", "", kind="read", interactive=True)
    m.point("reagentes", "read", 35, 5, "up", prop=js, zone="mez_r")
    m.add_prop("dock", WP.robot_dock(), 37, 6, 2, 1, "Base de recarga", "", block=False, depth=6 * T)
    m.point("recarga", "observe", 38, 6, "down", zone="mez_r")
    m.add_prop("plant", WP.plant_prop(30, 22), 39, 4, 1, 1)
    m.add_prop("plant", WP.plant_prop(26, 23, "#7a4bd1"), 29, 4, 1, 1)
    m.add_prop("grail", WP.railing(1 * T, glass=True), 29, 7, 1, 1, block=False, align="left", depth=8 * T)
    m.add_prop("grail", WP.railing(7 * T, glass=True), 33, 7, 7, 1, block=False, align="left", depth=8 * T)
    # área de experimentos
    sb = m.add_prop("board", WP.standing_board(84, 54), 1, 11, 5, 1, "Quadro de experimentos", "Experimentos ativos (demo).", kind="observe", interactive=True)
    m.point("quadro1", "observe", 2, 12, "up", prop=sb, zone="exp")
    m.point("quadro2", "observe", 5, 12, "up", prop=sb, zone="exp")
    d1 = m.add_prop("desk", WP.desk_pc(4, "laptop", 11, "lab"), 1, 16, 4, 1, "Bancada do notebook", "Execução de notebooks.", kind="work", interactive=True)
    m.point("w_lab1", "work", 3, 17, "up", sit=True, prop=d1, zone="exp", chair=("up", "#2b4c6e"))
    d2 = m.add_prop("desk", WP.desk_pc(4, "dual", 12, "lab"), 7, 12, 4, 1, "Terminal científico", "Análises estatísticas.", kind="work", interactive=True)
    m.point("w_lab2", "work", 8, 13, "up", sit=True, prop=d2, zone="exp", chair=("up", "#2b4c6e"))
    for i, rxx in enumerate((0, 1)):
        rack, leds = WP.server_rack_prop(48)
        pid = m.add_prop("rack", rack, rxx, 20, 1, 1, "Servidor", "Cluster de treino.", kind="observe", interactive=True)
        base_x, base_y = rxx * T, 21 * T - 48
        m.leds += [dict(x=base_x + lx, y=base_y + ly, color=c) for (lx, ly, c) in leds]
    m.add_prop("dna", WP.dna_tube_prop(), 12, 15, 1, 1, "Tubo de DNA sintético", "", kind="observe", interactive=True)
    m.add_prop("plant", WP.plant_prop(28, 24), 0, 14, 1, 1)
    m.add_prop("plant", WP.plant_prop(26, 25, "#e2e8f0"), 11, 21, 1, 1)
    # sala de discussão (mesa holográfica)
    ht = m.add_prop("holo", WP.holo_table(80), 17, 16, 5, 1, "Mesa holográfica", "Discussões e revisão de resultados.", kind="meet", interactive=True)
    m.anims.append(dict(type="holo", x=19 * T + 8 - 14, y=16 * T - 30))
    m.light(19 * T + 8, 16 * T, 40, "#39d6ff")
    for pid_, (px, py, f) in enumerate([(16, 16, "right"), (22, 16, "left"), (18, 15, "down"), (20, 15, "down"), (18, 17, "up"), (20, 17, "up")]):
        m.point(f"holo{pid_}", "meet", px, py, f, prop=ht, zone="discussao")
    ac = m.add_prop("armchair", WP.armchair("#2b4c6e"), 24, 20, 1, 1, "Poltrona", "", kind="rest", interactive=True)
    m.point("poltrona", "rest", 24, 21, "down", sit=True, prop=ac, zone="discussao", dy=-11)
    cbx = m.add_prop("cooler", WP.water_cooler(), 14, 20, 1, 1, "Café & água", "", kind="coffee", interactive=True)
    m.point("agua", "coffee", 14, 21, "up", prop=cbx, zone="discussao")
    # bancadas
    d3 = m.add_prop("desk", WP.desk_pc(4, "dual", 13, "lab"), 29, 12, 4, 1, "Estação de avaliação", "Benchmarks e métricas.", kind="work", interactive=True)
    m.point("w_lab3", "work", 30, 13, "up", sit=True, prop=d3, zone="bancada", chair=("up", "#2b4c6e"))
    js2 = m.add_prop("jars", WP.jar_shelf(64, 52, 9), 36, 11, 4, 1, "Prateleira de amostras", "", kind="read", interactive=True)
    m.point("amostras", "read", 37, 12, "up", prop=js2, zone="bancada")
    pt = m.add_prop("ptube", WP.plant_tube(), 33, 10, 2, 1, "Cultivo em tubo", "Experimento de biologia sintética.", kind="observe", interactive=True)
    m.point("tubo", "observe", 33, 11, "up", prop=pt, zone="bancada")
    m.light(34 * T, 9 * T, 30, "#00f5a0")
    lb = m.add_prop("bench", WP.lab_bench_prop(80, 2), 33, 16, 5, 1, "Bancada de química", "Frascos e reagentes.", kind="work", interactive=True)
    m.point("w_banc1", "work", 34, 17, "up", prop=lb, zone="bancada")
    m.point("w_banc2", "work", 36, 17, "up", prop=lb, zone="bancada")
    m.add_prop("catbed", WP.cat_bed(), 28, 19, 2, 1, "Caminha do gato", "", block=True)
    m.anims.append(dict(type="cat", x=28 * T + 5, y=19 * T + 2))
    m.add_prop("plant", WP.plant_prop(30, 26), 39, 20, 1, 1)
    m.add_prop("plant", WP.plant_prop(24, 27, "#7a4bd1"), 26, 13, 1, 1)
    lb2 = m.add_prop("bench", WP.lab_bench_prop(80, 5), 31, 20, 5, 1, "Bancada de testes", "Validação de amostras.", kind="work", interactive=True)
    m.point("w_banc3", "work", 32, 21, "up", prop=lb2, zone="bancada")
    m.point("w_banc4", "work", 34, 21, "up", prop=lb2, zone="bancada")
    ws = m.add_prop("wmon", WP.wall_monitor_stand(40, 26, "graph", P.NEON_G, 9), 23, 12, 3, 1, "Painel de métricas", "Curvas de treino (demo).", kind="observe", interactive=True)
    m.point("metricas", "observe", 24, 13, "up", prop=ws, zone="discussao")
    cp = m.add_prop("couch", WP.couch(3, "#2b4c6e"), 5, 20, 3, 1, "Sofá de descanso", "", kind="rest", interactive=True)
    for i, sx in enumerate((5, 6, 7)):
        m.point(f"sofa{i}", "rest", sx, 21, "down", sit=True, prop=cp, zone="exp", dy=-9)
    m.add_prop("plant", WP.plant_prop(26, 33), 16, 21, 1, 1)
    m.add_prop("plant", WP.plant_prop(26, 34, "#e2e8f0"), 22, 21, 1, 1)
    m.light(140, 30, 70, "#9d62ff")
    return m
