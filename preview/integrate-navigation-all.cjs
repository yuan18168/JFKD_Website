const fs=require('fs'),pals=require('./theme-palettes.json');
let nav=fs.readFileSync('js/theme-navigation.js','utf8').replace("['zoro','babymonster','gold'].includes(id)","Boolean(id&&w)").replace("images/redesign/navigation/","images/redesign/navigation-v2/");fs.writeFileSync('js/theme-navigation.js',nav);
let design=fs.readFileSync('js/design.js','utf8');
design=design.replace("const pose=['zoro','babymonster'].includes(id)?",`const pose=w.series==='stage'?'<span class="mv-date-portrait" aria-hidden="true" style="background-image:url(images/redesign/'+w.image+')"></span>':['zoro'].includes(id)?`);fs.writeFileSync('js/design.js',design);
let css='/* Thirty character-specific display plinths. Generated from approved palettes. */\n';
for(const [i,p] of pals.entries()){
const surfaces=p.series==='onepiece'?`repeating-linear-gradient(${i%2?2:88}deg,transparent 0 6px,${p.glowA}08 7px 8px),linear-gradient(110deg,${p.nav},${p.ink} 50%,${p.nav})`:p.series==='stage'?`radial-gradient(ellipse at 50% 0,${p.glowB}30,transparent 65%),linear-gradient(110deg,${p.nav},${p.ink},${p.nav})`:`radial-gradient(ellipse at 50% 0,${p.glowA}28,transparent 65%),linear-gradient(110deg,${p.nav},${p.ink},${p.nav})`;
const radius=p.series==='onepiece'?["10px 22px 10px 22px","22px 22px 8px 8px","20px","8px 18px","10px"][Math.floor(i/3)%5]:p.series==='stage'?["18px 5px 18px 5px","8px 24px 8px 24px","24px 12px","10px 20px","26px 8px"][Math.floor(i/3)%5]:["28px","28px 16px","22px 28px","18px","22px 8px"][Math.floor(i/3)%5];
css+=`body.kid-app.theme-${p.id} .kid-tabbar[data-world][data-props="true"]{--prop-base:${p.nav};--prop-rim:${p.glowA};--prop-highlight:${p.glowB}85;--prop-glow:${p.glowA}66;--prop-label:${p.card};--prop-surface:${surfaces};border-radius:${radius}}\n`;
}
css+='.mv-date-portrait{display:inline-block;flex:none;width:28px;height:40px;border-radius:8px;background-size:auto 100%;background-position:79% center;background-repeat:no-repeat;vertical-align:middle}.world-date:has(.mv-date-portrait){padding:4px 12px 4px 6px;gap:8px}\n';
fs.writeFileSync('css/navigation-worlds.css',css);
for(const file of fs.readdirSync('.').filter(f=>f.endsWith('.html'))){let h=fs.readFileSync(file,'utf8');h=h.replace(/(js\/(?:data|design)\.js|css\/character-palettes\.css)\?v=[^"\s]+/g,'$1?v=20261014mv30');if(file==='app.html'){h=h.replace(/((?:css|js)\/theme-navigation\.(?:css|js))\?v=[^"\s]+/g,'$1?v=20261014mv30');if(!h.includes('css/mv-worlds.css'))h=h.replace('</head>','<link rel="stylesheet" href="css/mv-worlds.css?v=20261014mv30">\n<link rel="stylesheet" href="css/navigation-worlds.css?v=20261014mv30">\n</head>');}fs.writeFileSync(file,h);}
console.log('Enabled all 30 display plinths, updated MV date portraits and cache versions');
