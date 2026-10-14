const assert=require('assert/strict'),fs=require('fs'),path=require('path');
const {chromium}=require('C:/Users/yuan1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const sharp=require('C:/Users/yuan1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
(async()=>{const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:390,height:920},reducedMotion:'reduce'}),errors=[],live=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/firestore.googleapis|identitytoolkit/.test(r.url()))live.push(r.url())});await page.goto('http://127.0.0.1:8765/app.html',{waitUntil:'networkidle'});
// Preview-only bypass to exercise every visual theme; XP gates are tested in themes.cjs.
await page.evaluate(()=>{themeUnlocked=()=>true;});
await page.addStyleTag({content:'.badge-unlock-toast{visibility:hidden!important}'});
const ids=await page.evaluate(()=>Object.keys(STUDENT_THEMES));const glyphs=[],tiles=[];
for(const [index,id] of ids.entries()){
 await page.locator('#kidThemeEntryBtn').click();await page.locator('.theme-card[data-theme="'+id+'"]').click();await page.locator('.kid-tab[data-tab="home"]').click();
 await page.waitForFunction(id=>document.querySelector('.kid-tabbar').dataset.world===id,id);
 glyphs.push(await page.locator('.kid-tab[data-tab="home"] .kid-tab-icon').evaluate(el=>el.innerHTML));assert.equal(await page.locator('#rulesTabDot').count(),1);
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:920});await page.evaluate(()=>document.documentElement.style.setProperty('--font-scale','1.3'));assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)),id+' overflow '+width);}
 await page.evaluate(()=>document.documentElement.style.setProperty('--font-scale','1'));await page.setViewportSize({width:390,height:920});
 const png=await page.locator('.kid-tabbar').screenshot();fs.writeFileSync('_qa/nav-'+id+'.png',png);tiles.push({input:png,left:(index%3)*390+14,top:Math.floor(index/3)*100+20});
 if(id==='robin'){await page.locator('.world-hero .world-art').evaluate(el=>el.decode());await page.locator('.world-hero').screenshot({path:'_qa/robin-v2-mobile.png'});await page.setViewportSize({width:1440,height:1000});await page.locator('.world-hero').screenshot({path:'_qa/robin-v2-desktop.png'});await page.setViewportSize({width:390,height:920});}
}
assert.equal(new Set(glyphs).size,30);await sharp({create:{width:1170,height:1000,channels:3,background:'#dedee6'}}).composite(tiles).png().toFile('_qa/navigation-30.png');
for(const tab of ['rules','score','wish','dex','home']){await page.locator('.kid-tab[data-tab="'+tab+'"]').click();assert(await page.locator('#view-'+tab).isVisible());}
assert.equal(await page.locator('.kid-cal-day').count(),28);assert(await page.locator('.kid-cal-day.has-mood').count()>0);
for(const mood of ['great','good','okay','bad','sad']){await page.locator('[data-mood-open]').click();await page.locator('[data-mood="'+mood+'"]').click();await page.waitForSelector('.mood-gate',{state:'detached'});const emoji=await page.evaluate(m=>MOOD_OPTIONS.find(x=>x.id===m).emoji,mood);assert.equal(await page.locator('.mood-self').textContent(),emoji);assert.equal(await page.locator('.kid-cal-day.today .kid-cal-mood').textContent(),emoji);}
await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('.mood-self').textContent(),'😢');
await page.locator('[data-mood-open]').click();await page.keyboard.press('Escape');assert.equal(await page.locator('#moodGate').count(),0);
await page.evaluate(()=>{window.realSaveMood=saveMoodToday;saveMoodToday=async()=>{throw Error('simulated offline')}});await page.locator('[data-mood-open]').click();await page.locator('[data-mood="great"]').click();assert(await page.locator('.mood-gate-sub[role="alert"]').isVisible());assert.equal(await page.locator('.mood-self').textContent(),'😢');await page.evaluate(()=>{saveMoodToday=window.realSaveMood});await page.locator('[data-mood="great"]').click();await page.waitForSelector('#moodGate',{state:'detached'});
await page.locator('.kid-tabbar').evaluate(el=>el.style.visibility='hidden');await page.locator('.calendar-card').screenshot({path:'_qa/mood-journal-mobile.png'});await page.setViewportSize({width:1440,height:1000});await page.locator('.calendar-card').screenshot({path:'_qa/mood-journal-desktop.png'});
assert.deepEqual(errors,[]);assert.deepEqual(live,[]);console.log('PASS: 30 unique navigation emblems / 120 large-text layouts / all destinations / notification node preserved / 5 moods save + reload + Escape + failure retry / no JS errors or live Firebase.');await browser.close();})().catch(e=>{console.error(e);process.exit(1)});
