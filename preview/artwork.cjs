const assert=require('assert/strict'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {chromium}=require('C:/Users/yuan1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const sharp=require('C:/Users/yuan1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..'),out=path.join(root,'_qa');
fs.mkdirSync(out,{recursive:true});
(async()=>{
  const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const errors=[],liveRequests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(/firestore.googleapis|identitytoolkit|firebaseinstallations/.test(r.url()))liveRequests.push(r.url());});
  await page.goto('http://127.0.0.1:8765/app.html',{waitUntil:'networkidle'});
  const badges=await page.evaluate(()=>BADGES.map(b=>({id:b.id,name:b.n,desc:b.d,html:JDesign.badge(b.id),secret:JDesign.badge(b.id,true)})));
  assert.equal(badges.length,62);
  assert.equal(new Set(badges.map(b=>b.html)).size,62,'Every badge must have unique artwork');
  assert(badges.every(b=>!b.html.includes('mystery') && b.secret.includes('mystery')&&!b.secret.includes('--badge-x')));
  const hashes=[];
  for(let i=0;i<62;i++) {
    const pixels=await sharp(path.join(root,'images/redesign/achievement-tasks-v2.webp')).extract({left:i%8*256,top:Math.floor(i/8)*256,width:256,height:256}).raw().toBuffer();
    hashes.push(crypto.createHash('sha256').update(pixels).digest('hex'));
  }
  assert.equal(new Set(hashes).size,62,'Every assigned cell must contain different pixels');
  const stages=await page.evaluate(()=>Object.values(STUDENT_THEMES).filter(t=>t.imageMode!=='character').map(t=>t.id));
  for(const width of [320,390,768,1024,1440]) {
    await page.setViewportSize({width,height:1000});
    for(const id of stages) {
      await page.evaluate(id=>{document.body.className='kid-app theme-'+id;document.querySelector('.world-hero').outerHTML=JDesign.hero({themeId:id});},id);
      await page.locator('.world-hero>.world-art').evaluate(el=>el.decode());
      const frame=await page.locator('.world-hero>.world-art').evaluate(el=>{
        const image=el.getBoundingClientRect(),hero=el.parentElement.getBoundingClientRect();
        return {bottomGap:hero.bottom-image.bottom,top:image.top-hero.top,fit:getComputedStyle(el).objectFit,animation:getComputedStyle(el).animationName};
      });
      assert(Math.abs(frame.bottomGap)<2,`Keep feet in frame ${id}/${width}`);
      assert(frame.top<0 && frame.fit==='contain',`Full-pose framing ${id}/${width}`);
      assert.equal(frame.animation,'none','Respect reduced motion');
      assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)),`Overflow ${id}/${width}`);
      if(width===1440||width===390) await page.locator('.world-hero').screenshot({path:path.join(out,`hero-${id}-${width}.png`)});
    }
  }
  await page.emulateMedia({reducedMotion:'no-preference'});
  for(const id of ['zoro','babymonster']) {
    await page.evaluate(id=>document.querySelector('.world-hero').outerHTML=JDesign.hero({themeId:id}),id);
    assert.equal(await page.locator('.world-hero>.world-art').evaluate(el=>getComputedStyle(el).animationName),'cover-arrive','Keep entrance zoom');
  }
  await page.evaluate(()=>{document.body.className='kid-app';document.body.innerHTML='<main id="badge-review" style="padding:24px;display:grid;grid-template-columns:repeat(8,1fr);gap:12px;background:#f7f5f0">'+BADGES.map(b=>'<article style="padding:12px;background:#fffdf9;border-radius:16px;text-align:center"><div style="width:110px;height:110px;margin:auto">'+JDesign.badge(b.id)+'</div><strong style="font-size:13px">'+b.n+'</strong><p style="font-size:11px;line-height:1.5">'+b.d+'</p></article>').join('')+'</main>';});
  await page.screenshot({path:path.join(out,'all-badge-artwork.png'),fullPage:true});
  assert.deepEqual(errors,[]);assert.deepEqual(liveRequests,[]);
  fs.writeFileSync(path.join(out,'artwork.json'),JSON.stringify({badges:badges.map(({html,secret,...b})=>b),distinctCells:hashes.length,stageLayouts:stages.length*5,errors,liveRequests},null,2));
  console.log('62 unique mapped illustrations; secret masking; 100 full-pose hero layouts; entrance animation and reduced motion passed.');
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
