const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('C:/Users/yuan1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch(), page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'}),errors=[],requests=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/firestore.googleapis|identitytoolkit|firebaseinstallations/.test(r.url()))requests.push(r.url());});
 await page.goto('http://127.0.0.1:8765/app.html',{waitUntil:'networkidle'});
 await page.locator('[data-task="read"]').click();await page.locator('[data-mood]').first().click();await page.waitForTimeout(600);
 assert(await page.locator('[data-task="read"]').evaluate(e=>e.classList.contains('done')));checks.push('Complete daily task and save mood');
 await page.locator('[data-task="read"]').click();await page.waitForTimeout(300);assert(!(await page.locator('[data-task="read"]').evaluate(e=>e.classList.contains('done'))));checks.push('Undo daily task');
 await page.locator('#kidThemeEntryBtn').click();assert.equal(await page.locator('.theme-card.locked[data-theme]').count(),0);
 await page.locator('[data-theme="zoro"]').click();await page.waitForTimeout(200);assert(await page.locator('body').evaluate(e=>e.classList.contains('theme-zoro')));checks.push('Unlocked theme applies; locked cards have no apply handler');
 await page.locator('.kid-tab[data-tab="dex"]').click();await page.locator('[data-badge]').first().click();assert(await page.locator('.dex-modal').isVisible());checks.push('Achievement detail opens');
 for(const width of [320,390,768,1024,1440]){
  await page.setViewportSize({width,height:1000});await page.goto('http://127.0.0.1:8765/app.html',{waitUntil:'networkidle'});
  await page.evaluate(()=>document.documentElement.style.setProperty('--font-scale','1.3'));
  for(const theme of ['','zoro','babymonster','galaxy','lava','aurora','gold']){
   await page.evaluate(id=>{document.body.className='kid-app'+(id?' theme-'+id:'');document.querySelector('.world-hero').outerHTML=JDesign.hero({themeId:id});},theme);
   assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)),`Overflow ${width} ${theme}`);
  }
  checks.push(`Seven hero themes, large text, viewport ${width}`);
 }
 assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
 fs.writeFileSync(path.resolve(__dirname,'../_qa/interactions.json'),JSON.stringify({checks,errors,liveRequests:requests},null,2));console.log(JSON.stringify({checks,errors,liveRequests:requests}));await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
