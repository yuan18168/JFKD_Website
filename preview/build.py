"""Build a fully isolated, shareable demo. Never copies Firebase credentials."""
from pathlib import Path
import re, shutil

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '_preview'
OUT.mkdir(exist_ok=True)
for folder in ('css', 'images'):
    shutil.copytree(ROOT / folder, OUT / folder, dirs_exist_ok=True)
(OUT / 'js').mkdir(exist_ok=True)
for file in (ROOT / 'js').glob('*.js'):
    if file.name not in ('firebase-config.js', 'auth.js', 'pin.js'):
        shutil.copy2(file, OUT / 'js' / file.name)
shutil.copy2(ROOT / 'preview/mock.js', OUT / 'js/preview-mock.js')
for name in ('favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'):
    shutil.copy2(ROOT / name, OUT / name)
for file in ROOT.glob('*.html'):
    html = file.read_text(encoding='utf-8-sig')
    html = re.sub(r'<script[^>]+src="(?:https://www.gstatic.com/firebasejs/[^"\s]+|js/(?:firebase-config|auth|pin)\.js[^"\s]*)"[^>]*></script>', '', html)
    html = re.sub(r'<link[^>]+rel="manifest"[^>]*>', '', html)
    html = html.replace('</head>', '<script src="js/preview-mock.js"></script>\n</head>')
    if file.name == 'login.html':
        html = re.sub(r'<script>([\s\S]*?)</script>', '', html)
        html = html.replace('</body>', '<script>document.querySelector("button").onclick=()=>location.href="app.html";</script></body>')
    if 'firebase-config.js' in html or re.search(r'<script[^>]+firebasejs/', html):
        raise RuntimeError('Live backend script leaked into preview')
    (OUT / file.name).write_text(html, encoding='utf-8')
print(f'Preview built: {OUT}')
