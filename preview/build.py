"""Build a fully isolated, shareable demo. Never copies Firebase credentials."""
from pathlib import Path
import re, shutil

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '_preview'
if OUT.resolve().parent != ROOT.resolve() or OUT.name != '_preview':
    raise RuntimeError('Unexpected preview output path')
if OUT.exists():
    # Keep the root directory available to an already running preview server.
    for child in OUT.iterdir():
        if child.is_dir() and not child.is_symlink():
            shutil.rmtree(child)
        else:
            child.unlink()
OUT.mkdir(exist_ok=True)
for folder in ('css', 'images'):
    shutil.copytree(ROOT / folder, OUT / folder, dirs_exist_ok=True,
                    ignore=lambda directory,names: [name for name in names if Path(directory).name in ('redesign', 'mv-study') and name.endswith(('.png','.md'))])
(OUT / 'js').mkdir(exist_ok=True)
for file in (ROOT / 'js').glob('*.js'):
    if file.name not in ('firebase-config.js', 'auth.js', 'pin.js'):
        shutil.copy2(file, OUT / 'js' / file.name)
shutil.copy2(ROOT / 'preview/mock.js', OUT / 'js/preview-mock.js')
shutil.copy2(ROOT / 'preview/start.ps1', OUT / 'start-preview.ps1')
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
# Local-only character approval sheet; never a production application page.
if (ROOT / 'preview/poses-gallery.html').exists():
    shutil.copy2(ROOT / 'preview/poses-gallery.html', OUT / 'poses-gallery.html')
if (ROOT / 'preview/realistic-gallery.html').exists():
    shutil.copy2(ROOT / 'preview/realistic-gallery.html', OUT / 'realistic-gallery.html')
if (ROOT / 'preview/mv-study.html').exists():
    shutil.copy2(ROOT / 'preview/mv-study.html', OUT / 'mv-study.html')
if (ROOT / 'preview/completion-gallery.html').exists():
    shutil.copy2(ROOT / 'preview/completion-gallery.html', OUT / 'completion-gallery.html')
    (OUT / 'review-images').mkdir(exist_ok=True)
    for image in list((ROOT / '_qa').glob('mv-live-*.png')) + list((ROOT / '_qa').glob('navigation-all-30.png')):
        shutil.copy2(image, OUT / 'review-images' / image.name)
print(f'Preview built: {OUT}')
