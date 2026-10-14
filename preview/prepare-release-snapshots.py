"""Reconstruct the exact production SHA with the same isolated demo adapter."""
from pathlib import Path
import subprocess, zipfile, shutil, re, json, datetime
root=Path(__file__).resolve().parents[1]
release=root/'_release'/'20261014'
release.mkdir(parents=True,exist_ok=True)
sha=subprocess.check_output(['git','rev-parse','7fd16864f5386de6b46dba0276fd27d551c684d0'],cwd=root,text=True).strip()
archive=release/'before-source.zip'
subprocess.run(['git','archive','--format=zip','--output',str(archive),sha],cwd=root,check=True)
old=release/'before'
if old.exists(): raise RuntimeError('Preserve existing baseline snapshot; do not overwrite')
old.mkdir()
with zipfile.ZipFile(archive) as z:z.extractall(old)
(old/'js').mkdir(exist_ok=True)
shutil.copy2(root/'preview/mock.js',old/'js/preview-mock.js')
for f in old.glob('*.html'):
    h=f.read_text(encoding='utf-8-sig')
    h=re.sub(r'<script[^>]+src="(?:https://www.gstatic.com/firebasejs/[^"\s]+|js/(?:firebase-config|auth|pin)\.js[^"\s]*)"[^>]*></script>','',h)
    h=re.sub(r'<link[^>]+rel="manifest"[^>]*>','',h)
    h=h.replace('</head>','<script src="js/preview-mock.js"></script>\n</head>')
    if f.name=='login.html':
        h=re.sub(r'<script>([\s\S]*?)</script>','',h)
        h=h.replace('</body>','<script>document.querySelector("button").onclick=()=>location.href="app.html";</script></body>')
    if re.search(r'<script[^>]+(?:firebase-config|firebasejs)',h):raise RuntimeError('Live backend reference')
    f.write_text(h,encoding='utf-8')
# Remove unused production adapter from isolated reconstruction.
for name in ['firebase-config.js','auth.js','pin.js']:
    (old/'js'/name).unlink(missing_ok=True)
(release/'manifest.json').write_text(json.dumps({'baselineSha':sha,'capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'data':'same synthetic preview data, not real family data','before':'production SHA reconstructed with mock adapter','newSource':'current approved working tree','viewports':{'mobile':[390,844],'desktop':[1440,1000]}},ensure_ascii=False,indent=2),encoding='utf-8')
print(str(old))
