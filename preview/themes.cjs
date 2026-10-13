const assert=require('assert/strict'),fs=require('fs'),path=require('path');
const {chromium}=require('C:/Users/yuan1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/app.html',{waitUntil:'networkidle'});
 const catalog=await page.evaluate(()=>Object.values(STUDENT_THEMES).map(t=>({id:t.id,xp:THEME_XP[t.id],series:t.series,artPending:t.artPending,below:themeUnlocked(t.id,t.xp-1),at:themeUnlocked(t.id,t.xp)})));
 assert.equal(catalog.length,30);assert.deepEqual(catalog.map(t=>t.xp),Array.from({length:30},(_,i)=>(i+1)*1000));
 assert(catalog.every(t=>!t.below&&t.at));for(const series of ['onepiece','stage','pokemon'])assert.equal(catalog.filter(t=>t.series===series).length,10);
 const existingBalances=[];
 for(const id of ['demo-k','demo-h']){
  await page.locator('.kid-tab[data-tab="home"]').click();await page.locator(`[data-student="${id}"]`).click();await page.waitForTimeout(100);
  await page.locator('#kidThemeEntryBtn').click();
  const xp=Number((await page.locator('#themeXp').innerText()).replace(/[^\d.]/g,''));
  const unlocked=await page.locator('.theme-card[data-theme]').evaluateAll(els=>els.map(el=>el.dataset.theme).sort());
  assert.deepEqual(unlocked,['',...catalog.filter(t=>t.xp<=xp).map(t=>t.id)].sort());
  existingBalances.push({id,xp,unlocked:unlocked.length-1});
 }
 assert.equal(await page.evaluate(()=>Object.keys(STUDENT_THEMES).filter(id=>themeUnlocked(id,7450)).length),7);
 await page.locator('.kid-tab[data-tab="home"]').click();
 await page.locator('#kidThemeEntryBtn').click();assert.equal(await page.locator('.theme-card:visible').count(),31);
 for(const series of ['onepiece','stage','pokemon']){await page.locator(`[data-series-filter="${series}"]`).click();assert.equal(await page.locator('.theme-card:visible').count(),10);}
 await page.locator('[data-series-filter="onepiece"]').click();await page.screenshot({path:path.resolve(__dirname,'../_qa/iphone-onepiece.png'),fullPage:true});
 for(const series of ['pokemon','stage']){await page.locator(`[data-series-filter="${series}"]`).click();await page.screenshot({path:path.resolve(__dirname,`../_qa/iphone-${series}.png`),fullPage:true});}
 for(const width of [320,390,768,1024,1440]){
  await page.setViewportSize({width,height:1000});await page.locator('.kid-tab[data-tab="home"]').click();
  await page.evaluate(()=>document.documentElement.style.setProperty('--font-scale','1.3'));
  for(const t of catalog){
   await page.evaluate(id=>{document.body.className='kid-app theme-'+id;document.querySelector('.world-hero').outerHTML=JDesign.hero({themeId:id});},t.id);
   assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)),`overflow: ${width}/${t.id}`);
   if(!t.artPending){const img=page.locator('.world-hero .world-art');await img.evaluate(el=>el.decode());assert(await img.evaluate(el=>el.naturalWidth>0));}
  }
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(path.resolve(__dirname,'../_qa/themes.json'),JSON.stringify({catalog,errors,existingBalances,viewports:[320,390,768,1024,1440],filters:true},null,2));console.log(JSON.stringify({existingBalances,result:'30 thresholds, 3 filters, 150 hero layouts and 30 artwork files passed'}));await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
