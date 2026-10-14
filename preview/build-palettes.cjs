// Build explicit character palettes without adding runtime dependencies.
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..'),palettes=require('./theme-palettes.json');
const rgb=h=>h.slice(1).match(/../g).map(x=>parseInt(x,16));
const hex=a=>'#'+a.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
const mix=(a,b,t)=>hex(rgb(a).map((v,i)=>v*(1-t)+rgb(b)[i]*t));
const luminance=h=>rgb(h).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
function readable(c,background){while(contrast(c,background)<4.7)c=mix(c,'#000000',.04);return c;}
let css='/* Character art-directed palettes. Source: preview/theme-palettes.json. */\n';
for(const p of palettes){
  const soft=mix(p.card,p.glowA,.22),border=mix(p.bg,p.accent,.26);
  const accent=readable(p.accent,soft),second=readable(p.second,'#ffffff');
  const vars={
    'kid-bg':p.bg,'kid-card':p.card,'kid-text':p.ink,'kid-dim':readable(p.dim,p.bg),'kid-faint':readable(p.dim,p.bg),'kid-border':border,
    'k-accent':accent,'k-accent2':second,'k-warm':readable(p.warm,p.card),'k-good':'#226446',
    'k-soft-bg':soft,'k-soft-bg2':mix(p.card,p.glowA,.4),
    'k-accent-grad':`linear-gradient(115deg,${accent},${second})`,
    'k-warm-grad':`linear-gradient(115deg,${readable(p.warm,'#ffffff')},${accent})`,
    'theme-glow-a':p.glowA+'99','theme-glow-b':p.glowB+'99','theme-nav':p.nav,'theme-nav-text':p.card,
    'theme-nav-muted':mix(p.card,p.glowA,.28),'theme-hero':p.card,'theme-hero-veil':p.card+'d9',
    'theme-hero-mobile':p.card+'eb','theme-hero-mobile-veil':p.card+'a6',
    'theme-shadow':p.nav+'12','theme-line':p.accent+'10',
    'theme-pattern':p.series==='pokemon'?`radial-gradient(${accent}12 1px,transparent 1.5px)`:p.series==='stage'?`repeating-linear-gradient(115deg,transparent 0 100px,${accent}08 101px 102px,transparent 103px 160px)`:`repeating-linear-gradient(0deg,transparent 0 35px,${accent}06 36px 37px)`,
    'theme-pattern-size':p.series==='pokemon'?'28px 28px':'auto'
  };
  css+=`/* ${p.name} */\nbody.kid-app.theme-${p.id}{`+Object.entries(vars).map(([k,v])=>`--${k}:${v}`).join(';')+'}\n';
  if(contrast(p.ink,p.card)<7||contrast(vars['kid-dim'],p.card)<4.5||contrast(p.card,p.nav)<7||contrast('#ffffff',accent)<4.5)throw new Error('Palette contrast: '+p.id);
}
fs.writeFileSync(path.join(root,'css/character-palettes.css'),css);
console.log(`Built ${palettes.length} palettes; checked body, secondary, accent and navigation contrast.`);
