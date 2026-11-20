#!/usr/bin/env python3
"""Create a self-contained offline preview from the exact racing modules.

Run the parent engine's tools/build.py first when its vendor bundle changes.
No JavaScript package installation or external CDN is required.
"""
import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent
engine = (ROOT.parent / 'index.html').read_text(encoding='utf-8')
three = re.search(r'<script>(var THREE=.*?)</script>', engine, re.S)
if not three:
    raise SystemExit('Build the parent engine before the standalone preview.')

exports = {
    'race-core.js': ['TRACK', 'createRace', 'startRace', 'stepRace', 'resetCar', 'togglePause'],
    'world.js': ['createWorld'],
    'renderer.js': ['createRenderer'],
    'audio.js': ['createAudio'],
}
scripts = [three.group(1)]
for filename in [*exports, 'app.js']:
    path = ROOT / filename
    subprocess.run(['node', '--check', str(path)], check=True)
    source = path.read_text(encoding='utf-8')
    source = re.sub(r'^import .*?;\s*$', '', source, flags=re.M)
    source = re.sub(r'\bexport (?=(?:const|function)\b)', '', source)
    if filename in exports:
        names = ','.join(exports[filename])
        source = 'const {' + names + '}=(()=>{\n' + source + '\nreturn {' + names + '};\n})();'
    else:
        source = '(()=>{\n' + source + '\n})();'
    scripts.append(source)
html = (ROOT / 'index.html').read_text(encoding='utf-8')
html = html.replace('<link rel="stylesheet" href="arcade.css">', '<style>' + (ROOT / 'arcade.css').read_text(encoding='utf-8') + '</style>')
html = html.replace('<script type="module" src="app.js"></script>', '<script>' + '\n'.join(scripts).replace('</script', '<\\/script') + '</script>')
output = ROOT / 'play.html'
output.write_text(html, encoding='utf-8')
print(f'Built {output.name}: {output.stat().st_size / 1024:.0f} KiB, offline ready.')
