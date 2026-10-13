const assert=require('assert/strict'),fs=require('fs'),path=require('path');
const {chromium}=require('C:/Users/yuan1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:8765/app.html',{waitUntil:'networkidle'});
 const catalog=await page.evaluate(()=>Object.values(STUDENT_THEMES).map(t=>({id:t.id,xp:THEME_XP[t.id],series:t.series,artPending:t.artPending,below:themeUnlocked(t.id,t.xp-1),at:themeUnlocked(t.id,t.xp)})));
 assert.equal(catalog.length,18);assert.deepEqual(catalog.map(t=>t.xp),Array.from({length:18},(_,i)=>(i+1)*2000));
 assert(catalog.every(t=>!t.below&&t.at));for(const series of ['onepiece','stage','pokemon'])assert.equal(catalog.filter(t=>t.series===series).length,6);
 await page.locator('#kidThemeEntryBtn').click();assert.equal(await page.locator('.theme-card:visible').count(),19);
 for(const series of ['onepiece','stage','pokemon']){await page.locator(`[data-series-filter="${series}"]`).click();assert.equal(await page.locator('.theme-card:visible').count(),6);}
 await page.locator('[data-series-filter="onepiece"]').click();await page.screenshot({path:path.resolve(__dirname,'../_qa/iphone-onepiece.png'),fullPage:true});
 for(const width of [320,390,768,1024,1440]){
  await page.setViewportSize({width,height:1000});await page.locator('.kid-tab[data-tab="home"]').click();
  await page.evaluate(()=>document.documentElement.style.setProperty('--font-scale','1.3'));
  for(const t of catalog){
   await page.evaluate(id=>{document.body.className='kid-app theme-'+id;document.querySelector('.world-hero').outerHTML=JDesign.hero({themeId:id});},t.id);
   assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)),`overflow: ${width}/${t.id}`);
   if(!t.artPending){const img=page.locator('.world-art');await img.evaluate(el=>el.decode());assert(await img.evaluate(el=>el.naturalWidth>0));}
  }
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(path.resolve(__dirname,'../_qa/themes.json'),JSON.stringify({catalog,errors,viewports:[320,390,768,1024,1440],filters:true},null,2));console.log('18 thresholds, 3 filters, 90 hero layouts and 12 artwork files passed');await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
