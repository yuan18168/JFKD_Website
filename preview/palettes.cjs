const assert=require('assert/strict'),fs=require('fs'),path=require('path');
const {chromium}=require('C:/Users/yuan1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const sharp=require('C:/Users/yuan1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const palettes=require('./theme-palettes.json'),root=path.resolve(__dirname,'..'),out=path.join(root,'_qa');
const rgb=s=>s.match(/[\d.]+/g).slice(0,3).map(Number);
const light=s=>rgb(s).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4}).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
const contrast=(a,b)=>{const x=light(a),y=light(b);return(Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
(async()=>{
  const browser=await chromium.launch(),page=await browser.newPage({viewport:{width:390,height:920},reducedMotion:'reduce'}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8765/app.html',{waitUntil:'networkidle'});
  const ids=await page.evaluate(()=>Object.keys(STUDENT_THEMES));
  assert.deepEqual(palettes.map(p=>p.id).sort(),ids.sort());
  const results=[],samples=['zoro','babymonster','gold','luffy','ruka','chopper'];
  for(const p of palettes){
    await page.evaluate(id=>{document.body.className='kid-app theme-'+id;document.querySelector('.world-hero').outerHTML=JDesign.hero({themeId:id});},p.id);
    await page.locator('.world-hero .world-art').evaluate(el=>el.decode()).catch(e=>{throw Error(p.id+': '+e.message)});
    const colors=await page.evaluate(()=>{
      const style=s=>getComputedStyle(document.querySelector(s));
      return {bg:style('body').backgroundColor,card:style('.today-card').backgroundColor,text:style('.kid-task-name').color,task:style('.kid-task').backgroundColor,nav:style('.kid-tabbar').backgroundColor,navText:style('.kid-tab:not(.active)').color,activeText:style('.kid-tab.active').color,activeBg:document.querySelector('.kid-tabbar').dataset.props==='true'?style('.kid-tabbar').backgroundColor:style('.kid-tab.active').backgroundColor,overflow:document.documentElement.scrollWidth>innerWidth};
    });
    assert(contrast(colors.text,colors.task)>=4.5,`${p.id} task contrast`);
    assert(contrast(colors.navText,colors.nav)>=4.5,`${p.id} navigation contrast`);
    assert(contrast(colors.activeText,colors.activeBg)>=4.5,`${p.id} active tab contrast`);
    assert(!colors.overflow,p.id+' overflow');
    results.push({id:p.id,name:p.name,...colors});
    if(samples.includes(p.id))await page.screenshot({path:path.join(out,`palette-${p.id}.png`)});
  }
  assert.equal(new Set(results.map(r=>r.bg+r.card+r.nav)).size,30);
  assert.deepEqual(errors,[]);
  const tiles=[];
  for(let i=0;i<samples.length;i++)tiles.push({input:await sharp(path.join(out,`palette-${samples[i]}.png`)).resize(300).png().toBuffer(),left:i%3*300,top:Math.floor(i/3)*708});
  await sharp({create:{width:900,height:1416,channels:3,background:'#ffffff'}}).composite(tiles).png().toFile(path.join(out,'palette-comparison.png'));
  fs.writeFileSync(path.join(out,'palettes.json'),JSON.stringify({results,errors},null,2));
  console.log('30 distinct live palettes passed task/nav contrast and mobile overflow checks.');
  await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
