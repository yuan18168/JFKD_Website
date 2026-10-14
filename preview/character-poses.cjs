const assert=require('assert/strict'),fs=require('fs');
const {chromium}=require('C:/Users/yuan1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const manifest=require('./character-poses.json');
(async()=>{
 assert.equal(manifest.length,90);assert.equal(new Set(manifest.map(x=>x.file)).size,90);
 const b=await chromium.launch(),p=await b.newPage({reducedMotion:'reduce'}),errors=[];p.on('pageerror',e=>errors.push(e.message));
 try{
 await p.goto('http://127.0.0.1:8765/app.html',{waitUntil:'networkidle'});
 const before=await p.locator('.xp-total').innerText();
 // Seven-task fixture matches the long real-world layout, without touching family data.
 await p.evaluate(()=>{const list=document.querySelector('#taskList');while(list.children.length<7)list.append(list.firstElementChild.cloneNode(true));document.querySelector('.today-card .kid-card-title small').textContent='0 / 7 完成';});
 let layouts=0;
 for(const width of [320,390,768,1440]){
  await p.setViewportSize({width,height:1000});
  for(const id of [...new Set(manifest.map(x=>x.id))]){
   await p.evaluate(id=>{
    document.body.className='kid-app theme-'+id;document.documentElement.style.setProperty('--font-scale','1.3');
    document.querySelector('.task-world').outerHTML=JDesign.taskWorld({themeId:id},0,7);
    for(const slot of ['streak','growth'])document.querySelector('.character-stage-'+slot).outerHTML=JDesign.companion({themeId:id},slot);
   },id);
   await p.locator('.character-pose').evaluateAll(els=>Promise.all(els.map(e=>e.decode())));
   assert.equal(await p.locator('.character-pose').count(),3);
   assert.equal(await p.locator('.xp-total').innerText(),before);
   assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),id+' overflow '+width);
   assert(await p.locator('.character-pose').evaluateAll(els=>els.every(e=>{const r=e.getBoundingClientRect(),c=e.closest('.kid-card,.streak-hero').getBoundingClientRect();return r.width>70&&r.height>100&&r.left>=c.left&&r.right<=c.right+1&&r.top>=c.top&&r.bottom<=c.bottom+1})),id+' pose bounds '+width);
   layouts++;
   if([390,1440].includes(width)&&['zoro','babymonster','gold'].includes(id))await p.locator('.home-layout').screenshot({path:`_qa/poses-${id}-${width}.png`});
  }
 }
 assert.deepEqual(errors,[]);console.log(`PASS ${layouts} seven-task large-font layouts, 90 decoded poses, unchanged XP, no overflow or JS errors`);
 }finally{await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
