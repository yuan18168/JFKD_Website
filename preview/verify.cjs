const fs=require('fs'),path=require('path');
const {chromium}=require('C:/Users/yuan1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),out=path.join(root,'_qa');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 const page=await context.newPage(), errors=[],requests=[];
 page.on('pageerror',e=>errors.push({page:page.url(),error:e.message}));
 page.on('request',r=>{if(/firestore.googleapis|identitytoolkit|firebaseinstallations/.test(r.url()))requests.push(r.url());});
 const results=[];
 for(const file of fs.readdirSync(root).filter(f=>f.endsWith('.html'))){
  const url='http://127.0.0.1:8765/'+file+(file==='student.html'?'?id=demo-k':'');
  await page.goto(url,{waitUntil:'networkidle'});await page.waitForTimeout(100);
  results.push({file,title:await page.title(),overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),body:await page.locator('body').innerText().then(s=>s.slice(-150))});
  if(['index.html','themes.html','app.html'].includes(file))await page.screenshot({path:path.join(out,file+'.png'),fullPage:true});
 }
 await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:8765/app.html',{waitUntil:'networkidle'});
 await page.screenshot({path:path.join(out,'iphone-home.png'),fullPage:true});
 for(const tab of ['rules','score','wish','dex']){await page.locator('.kid-tab[data-tab="'+tab+'"]').click();await page.waitForTimeout(150);results.push({tab,overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});if(tab==='dex')await page.screenshot({path:path.join(out,'iphone-dex.png'),fullPage:true});}
 await page.locator('.kid-tab[data-tab="home"]').click();await page.locator('#kidThemeEntryBtn').click();await page.waitForTimeout(100);await page.screenshot({path:path.join(out,'iphone-themes.png'),fullPage:true});
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({results,errors,liveRequests:requests},null,2));console.log(JSON.stringify({results,errors,liveRequests:requests}));await browser.close();
})().catch(e=>{console.error(e);process.exit(1);});
