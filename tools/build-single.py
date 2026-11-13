#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Сборка обратно в один HTML-файл (для раздачи/офлайна).

    python3 tools/build-single.py            -> dist/vch36.single.html
    python3 tools/build-single.py out.html

Порядок скриптов берётся из index.html — ровно тот, в котором они
подключены в репозитории, так что сборка гарантированно совпадает
с развёрнутой версией.
"""
import io, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "dist", "vch36.single.html")

html = io.open(os.path.join(ROOT, "index.html"), encoding="utf-8", errors="surrogateescape").read()

# 1. порядок скриптов.
#    Раньше в разметке лежали теги <script defer src=...>. Теперь скрипты
#    подключает загрузчик (и берёт только данные выбранной карты), поэтому
#    порядок для сборки лежит в комментарии-маркере vch-files-start: в один
#    файл кладём все локации сразу.
srcs = re.findall(r'<script defer src="([^"]+)"></script>', html)
if not srcs:
    m = re.search(r"<!-- vch-files-start(.*?)-->", html, re.S)
    if not m:
        sys.exit("в index.html не найден ни тег <script defer src=...>, ни блок vch-files-start")
    srcs = [l.strip() for l in m.group(1).splitlines()
            if l.strip().startswith(("vendor/", "data/", "js/"))]
if not srcs:
    sys.exit("пустой список файлов для сборки")

parts = []
for rel in srcs:
    path = os.path.join(ROOT, rel)
    if not os.path.exists(path):
        sys.exit("нет файла: " + rel)
    parts.append(io.open(path, encoding="utf-8", errors="surrogateescape").read().rstrip() + "\n")

bundle = "\n".join(parts)
if "<script defer src=" not in html:
    # загрузчик остался в <head> исходника и в сборку не попал — говорим коду,
    # что цепочка скриптов выполнена (в монолите весь код уже внутри).
    bundle = "window.__vchScriptsDone=true;window.__vchAllDone=true;\n" + bundle

# 2. css
css = io.open(os.path.join(ROOT, "css", "app.css"), encoding="utf-8", errors="surrogateescape").read()

# 3. разметка: <body> ... </html>
body = html[html.index("<body>"):html.rindex("</html>")]

head = html[:html.index("<body>")]
title = re.search(r"<title>(.*?)</title>", head, re.S)
title = title.group(1).strip() if title else "vch36"

out = []
out.append("<!DOCTYPE html>")
out.append('<html lang="ru">')
out.append("<head>")
out.append('  <meta charset="UTF-8" />')
out.append('  <meta name="viewport" content="width=device-width, initial-scale=1.0" />')
out.append("  <title>%s</title>" % title)
out.append("  <!-- СБОРКА ИЗ РЕПОЗИТОРИЯ (tools/build-single.py): не править руками.")
out.append("       Исходники — index.html + css/ + js/ + data/ + vendor/.")
out.append("       Порядок файлов внутри: %d скриптов, как в index.html. -->" % len(srcs))
out.append('<script type="module" crossorigin>')
out.append(bundle)
out.append("</script>")
out.append("  <style>")
out.append(css.strip())
out.append("  </style>")
out.append("</head>")
out.append(body.rstrip())
out.append("</html>")

os.makedirs(os.path.dirname(OUT), exist_ok=True)
io.open(OUT, "w", encoding="utf-8", errors="surrogateescape").write("\n".join(out))
print("собрано: %s (%.1f МБ, %d файлов)" % (OUT, os.path.getsize(OUT) / 1048576, len(srcs)))
