const assert=require('assert/strict'),path=require('path');
const {chromium}=require('C:/Users/yuan1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:390,height:1000},reducedMotion:'reduce'}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:8765/app.html',{waitUntil:'networkidle'});
for(const id of ['zoro','babymonster','gold']){
 await page.locator('#kidThemeEntryBtn').click();await page.locator('.theme-card[data-theme="'+id+'"]').click();await page.locator('.kid-tab[data-tab="home"]').click();await page.waitForTimeout(150);
 assert.equal(await page.locator('.task-world-'+id).count(),1);
 for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:1000});await page.evaluate(()=>document.documentElement.style.setProperty('--font-scale','1.3'));assert(!(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)),id+' '+width);}
 await page.evaluate(()=>document.documentElement.style.setProperty('--font-scale','1'));await page.setViewportSize({width:390,height:1000});await page.screenshot({path:path.resolve('_qa/signature-'+id+'-mobile.png'),fullPage:true});
 await page.setViewportSize({width:1440,height:1050});await page.screenshot({path:path.resolve('_qa/signature-'+id+'-desktop.png'),fullPage:true});
 while(await page.locator('.kid-task:not(.done)').count()){await page.locator('.kid-task:not(.done)').first().click();await page.waitForTimeout(100);if(await page.locator('#moodGate').isVisible()){await page.locator('[data-mood]').first().click();await page.waitForTimeout(200);}}
 assert.equal(await page.locator('.task-world.is-complete').count(),1);assert(await page.locator('.kid-perfect').isVisible());await page.locator('.today-card').screenshot({path:path.resolve('_qa/signature-'+id+'-complete.png')});
 await page.locator('.kid-task').first().focus();await page.keyboard.press('Enter');await page.waitForTimeout(100);assert.equal(await page.locator('.task-world.is-complete').count(),0);
 await page.setViewportSize({width:390,height:1000});
}
assert.deepEqual(errors,[]);console.log('PASS: three actual theme switches, 12 large-text layouts, complete/undo keyboard state, screenshots, no JS errors.');await browser.close();})().catch(e=>{console.error(e);process.exit(1)});
