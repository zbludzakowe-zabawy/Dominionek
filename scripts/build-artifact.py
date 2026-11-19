#!/usr/bin/env python3
"""Składa zbudowaną grę (dist/) w jeden plik HTML do podglądu jako Artifact na claude.ai.

Użycie (po `npm run build`, z katalogu repozytorium):
    python3 scripts/build-artifact.py <katalog_wyjściowy>
Tworzy <katalog_wyjściowy>/crownforge.html: CSS, JS i ikona wbudowane w jeden plik,
bez <html>/<head> (host podglądu dokłada własny szkielet), bez service workera i banerów PWA.
"""
import base64
import glob
import sys

out = sys.argv[1]
js = open(glob.glob('dist/assets/*.js')[0]).read()
css = open(glob.glob('dist/assets/*.css')[0]).read()
icon = 'data:image/png;base64,' + base64.b64encode(open('dist/icons/icon-192.png', 'rb').read()).decode()
assert '</script' not in js.lower()
js = js.replace('./icons/icon-192.png', icon)
open(out + '/crownforge.html', 'w').write(
    f'<title>Crownforge</title>\n<style>\nhtml, body {{ height: 100%; background: #1b2027; }}\n{css}\n</style>\n'
    f'<div id="root"></div>\n<script type="module">\n{js}\n</script>\n'
)
