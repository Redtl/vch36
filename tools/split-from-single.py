#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Разбор монолита vch36.*.sunrise.html на репозиторий из отдельных файлов.

Вход : /home/user/vch36.single.aleksandrovsk.sunrise.light-fog.html
       (сборка с облегчённым туманом и убранным пересветом)
Выход: /home/user/vch36/  — index.html, css/, vendor/, data/, js/
"""
import io, os, re, sys, shutil

SRC = "/home/user/vch36.single.aleksandrovsk.sunrise.light-fog.html"
OUT = "/home/user/vch36"

text = io.open(SRC, encoding="utf-8", errors="surrogateescape").read()

# ─────────────────────────── 1. куски документа ────────────────────────────
TAG = '<script type="module" crossorigin>'
mstart = text.index(TAG) + len(TAG)
mend = text.index("</script>", mstart)
module = text[mstart:mend]

head = text[:text.index(TAG)]                       # <!DOCTYPE ... <title> ... комментарий
tail = text[mend + len("</script>"):]

# css: блок <style>
si = tail.index("<style>") + len("<style>")
ei = tail.index("</style>")
css = tail[si:ei]

# html: от <body> до первого <script> в хвосте
bi = tail.index("<body>")
he = tail.index("</head>") + len("</head>")
body = tail[he:tail.index("<script>", bi)]

lines = module.split("\n")
print("строк в модуле:", len(lines))

# ───────────────────── 2. границы разделов (по авторским маркерам) ─────────
# (маркер, имя файла, подпись для data-префикса)
MARKERS = [
    ("vch36 · js/01-core.js",        "js/01-core.js",        None),
    ("vch36 · js/02-tank.js",        "js/02-tank.js",        None),
    ("vch36 · js/03-dynamics.js",    "js/03-dynamics.js",    None),
    ("vch36 · js/04-visual.js",      "js/04-visual.js",      None),
    ("vch36 · js/05-cases.js",       "js/05-cases.js",       None),
    ("vch36 · js/06-world.js",       "js/06-world.js",       None),
    ("06a · ДАННЫЕ КАРТЫ",           "js/06a-aleksandrovsk-data.js", "ALEKS"),
    ("06c · НЕБО КАРТЫ 01",          "js/06c-map01-sky-data.js", "MAP01"),
    ("06b · ЛОКАЦИЯ «КАРТА 01»",     "js/06b-map01.js",      "MAP01"),
    ("06e · ЛОКАЦИЯ «АЛЕКСАНДРОВСК»","js/06e-aleksandrovsk.js", "ALEKS"),
    ("06d · ВИД КАРТЫ 01",           "js/06d-map01-look.js", None),
    ("vch36 · js/07-audio.js",       "js/07-audio.js",       None),
    ("vch36 · js/08-scorpion.js",    "js/08-scorpion.js",    "SCORPION"),
    ("vch36 · js/09-fleet.js",       "js/09-fleet.js",       None),
    ("vch36 · js/10-ai.js",          "js/10-ai.js",          None),
    ("vch36 · js/11-rockets.js",     "js/11-rockets.js",     None),
    ("vch36 · js/12-drive.js",       "js/12-drive.js",       None),
    ("vch36 · js/13-range.js",       "js/13-range.js",       None),
    ("vch36 · js/14-track.js",       "js/14-track.js",       None),
    ("vch36 · js/15-battle.js",      "js/15-battle.js",      None),
    ("vch36 · js/16-ui.js",          "js/16-ui.js",          None),
    ("vch36 · js/17-cam.js",         "js/17-cam.js",         None),
    ("vch36 · js/18-boot.js",        "js/18-boot.js",        None),
    ("vch36 · js/19-look.js",        "js/19-look.js",        None),
    ("/* ===== 90 · РАССВЕТ",         "js/90-sunrise.js",     "NIGHT"),
]

def find_block_start(idx):
    """От маркера — назад к началу комментария раздела."""
    if lines[idx].lstrip().startswith("/*"):
        return idx
    j = idx
    while j > 0 and not lines[j-1].lstrip().startswith("/*"):
        j -= 1
    return max(0, j-1)

bounds = []
for marker, name, pref in MARKERS:
    hits = [i for i, l in enumerate(lines) if marker in l]
    if len(hits) != 1:
        sys.exit("маркер %r найден %d раз" % (marker, len(hits)))
    bounds.append((find_block_start(hits[0]), name, pref))

# ─────────────────────────── 3. нарезка ────────────────────────────────────
sections = []           # (имя файла, текст, data-префикс)
sections.append(("vendor/three-cannon.js",
                 "\n".join(lines[0:bounds[0][0]]), None))
for n, (start, name, pref) in enumerate(bounds):
    end = bounds[n+1][0] - 1 if n + 1 < len(bounds) else len(lines) - 1
    sections.append((name, "\n".join(lines[start:end+1]), pref))

# ──────────────── 4. вынос огромных base64-литералов в data/ ───────────────
LIT = re.compile(r'"([A-Za-z0-9+/=]{150000,})"')
DATA_INFO = {
    "MAP01":    {"glbGz": "map01-glb.js",             "hf": "map01-heightfield.js",
                 "data":  "map01-sky-hdri.js"},
    "ALEKS":    {"glbGz": "aleksandrovsk-glb.js",     "hf": "aleksandrovsk-heightfield.js"},
    "SCORPION": {"const": "scorpion-glb.js"},
    "NIGHT":    {"data":  "sunrise-sky-hdri.js"},
}
DATA_TITLE = {
    "map01-glb.js":               ("Модель карты 01 (map_01.glb), gzip + base64",
                                   "Автогенерация tools/inline_map.py — руками не править."),
    "map01-heightfield.js":       ("Карта высот карты 01 (int16, 0.15 м/ячейка), base64",
                                   "Автогенерация tools/inline_map.py — руками не править."),
    "map01-sky-hdri.js":          ("Небо карты 01: Poly Haven «industrial_sunset_02_puresky» (CC0), RGBE",
                                   "Автогенерация tools/make_sky.py — руками не править."),
    "aleksandrovsk-glb.js":       ("Модель «Александровск» (aleksandrovsk_mm.glb), gzip + base64",
                                   "Sketchfab · DageLV · CC-BY-4.0. Автогенерация — руками не править."),
    "aleksandrovsk-heightfield.js": ("Карта высот «Александровска», base64",
                                     "Автогенерация — руками не править."),
    "scorpion-glb.js":            ("Модель Scorpion (Scorpion4.glb), gzip + base64",
                                   "Автогенерация — руками не править."),
    "sunrise-sky-hdri.js":        ("Панорама рассвета: Poly Haven «qwantani_sunrise_puresky» (CC0), 4K → RGBE",
                                   "сжата gzip. Автогенерация — руками не править."),
}
data_files = {}    # имя файла -> (константа, литерал, заголовок)

def extract(name, code, prefix):
    """Режет литералы из code, возвращает (новый code, [(const, file)])."""
    if not prefix:
        return code, []
    table = DATA_INFO[prefix]
    out, used = code, []
    for m in reversed(list(LIT.finditer(code))):
        pre = code[max(0, m.start()-30):m.start()]
        key = None
        if re.search(r'glbGz:\s*$', pre):      key = "glbGz"
        elif re.search(r'hf:\s*$', pre):       key = "hf"
        elif re.search(r'data:\s*$', pre):     key = "data"
        elif re.search(r'const\s+(\w+)\s*=\s*$', pre): key = "const"
        if key is None or key not in table:
            sys.exit("не понял, куда девать литерал в %s: ...%s" % (name, pre[-30:]))
        fname = table[key]
        if key == "const":
            const = re.search(r'const\s+(\w+)\s*=\s*$', pre).group(1) + "_DATA"
        elif key == "glbGz":
            const = ("VCH_MAP01_GLB_GZ" if prefix == "MAP01" else "VCH_ALEKS_GLB_GZ")
        elif key == "hf":
            const = ("VCH_MAP01_HF_B64" if prefix == "MAP01" else "VCH_ALEKS_HF_B64")
        else:
            const = ("VCH_MAP01_SKY_DATA_B64" if prefix == "MAP01" else "VCH_NIGHT_SKY_DATA_B64")
        title, note = DATA_TITLE[fname]
        data_files[fname] = (const, m.group(1), (title, note))
        out = out[:m.start()] + const + out[m.end():]
        used.append(const)
    return out, used

# ──────────────── 5. PCM-сэмплы — в отдельный файл 07a ─────────────────────
pcm_lines, keep = [], []
for line in lines:
    keep.append(line)
PCM_RE = re.compile(r'^const VCH_\w+_PCM\s*=')
sections2 = []
for name, code, pref in sections:
    if name == "js/06d-map01-look.js":
        kept, moved = [], []
        for ln in code.split("\n"):
            (moved if PCM_RE.match(ln.strip()) else kept).append(ln)
        pcm_lines = moved
        code = "\n".join(kept)
    sections2.append((name, code, pref))
sections = sections2

# ─────────────────────────── 6. запись файлов ──────────────────────────────
if os.path.exists(OUT):
    shutil.rmtree(OUT)
for d in ("css", "vendor", "data", "js"):
    os.makedirs(os.path.join(OUT, d), exist_ok=True)

def w(rel, content):
    path = os.path.join(OUT, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    io.open(path, "w", encoding="utf-8", errors="surrogateescape").write(content)
    return len(content)

def ensure_strict(code):
    """«use strict» директивой пролога: сразу после шапки-комментария
       (или первой строкой, если файл начинается с кода), если его ещё нет."""
    ls = code.split("\n")
    if any(l.strip() == '"use strict";' for l in ls[:12]):
        return code
    if ls and ls[0].lstrip().startswith("/*"):
        end = 0
        for i, l in enumerate(ls[:15]):
            if l.strip().startswith("*/"):
                end = i
                break
        ls.insert(end + 1, '"use strict";')
    else:
        ls.insert(0, '"use strict";')
    return "\n".join(ls)

total = 0
for name, code, pref in sections:
    code, _ = extract(name, code, pref)
    code = ensure_strict(code)
    code = code.rstrip() + "\n"
    n = w(name, code)
    total += n
    print("  %-38s %8.1f КБ" % (name, n / 1024))

# data/*.js
for fname, (const, literal, (title, note)) in sorted(data_files.items()):
    content = ("/* ==========================================================================\n"
               "   vch36 · data/%s\n"
               "   %s\n"
               "   %s\n"
               "   ========================================================================== */\n"
               '"use strict";\n'
               "const %s =\n\"%s\";\n" % (fname, title, note, const, literal))
    n = w("data/" + fname, content)
    total += n
    print("  %-38s %8.1f КБ" % ("data/" + fname, n / 1024))

# PCM
if pcm_lines:
    content = ("/* ==========================================================================\n"
               "   vch36 · js/07a-audio-pcm.js\n"
               "   Пять PCM-сэмплов (base64): выстрел, отдача, двигатель, грунт, взрыв.\n"
               "   Вынесены из 06d, чтобы файлы с кодом оставались читаемыми.\n"
               "   ========================================================================== */\n"
               '"use strict";\n' + "\n".join(pcm_lines) + "\n")
    n = w("js/07a-audio-pcm.js", content)
    total += n
    print("  %-38s %8.1f КБ" % ("js/07a-audio-pcm.js", n / 1024))

# css
w("css/app.css", css.strip() + "\n")

# ─────────────────────────── 7. index.html ─────────────────────────────────
def script_tags():
    t = []
    t.append('    <!-- вендорный бандл: three.js (MIT) + cannon-es (MIT) -->')
    t.append('    <script defer src="vendor/three-cannon.js"></script>')
    t.append('')
    t.append('    <!-- данные (генерируются, руками не править): подключаются ДО кода -->')
    for fname in sorted(data_files):
        t.append('    <script defer src="data/%s"></script>' % fname)
    t.append('')
    t.append('    <!-- код: порядок загрузки обязателен (общая область видимости\n'
             '         classic-скриптов: 06a -> 06c -> 06b -> 06e -> 06d) -->')
    for name, _, _ in sections:
        if name.startswith("js/"):
            t.append('    <script defer src="%s"></script>' % name)
            if name == "js/06d-map01-look.js":
                t.append('    <script defer src="js/07a-audio-pcm.js"></script>')
    return "\n".join(t)

html = head.rstrip() + "\n"
html = html.replace('<script type="module" crossorigin>', '')  # на всякий случай
html += '  <link rel="stylesheet" href="css/app.css" />\n'
html += script_tags() + "\n"
html += "  </head>\n"
html += body.rstrip() + "\n"
html += "</html>\n"
w("index.html", html)

print("\nвсего записано %.1f МБ в %s" % (total / 1048576, OUT))
