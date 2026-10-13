/* Presentation only. No database calls, new points or unlock rules. */
const JDesign = (() => {
  const worlds = {
    '': {label:'小小冒險，大大成長',en:'A LITTLE BETTER, EVERY DAY',color:'#7261bd',description:'把每天的小努力，收進你的成長收藏。'},
    ...Object.fromEntries(Object.values(typeof STUDENT_THEMES==='undefined'?{}:STUDENT_THEMES).map(t=>[t.id,{label:t.name,en:t.en,color:t.color,description:t.tagline,image:t.image,artPending:t.artPending,character:t.character,series:t.series}]))
  };
  const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const paths={home:'M3 10 12 3l9 7M5 9v11h5v-6h4v6h5V9',rules:'M5 3h14v18H5zM8 7h8M8 11h8M8 15h5',score:'M4 20V4m0 16h17M8 16v-5m5 5V7m5 9V3',wish:'M3 8h18v5H3zM5 13v8h14v-8M12 8v13M12 8C3 8 5 0 9 4l3 4Zm0 0c9 0 7-8 3-4l-3 4Z',dex:'M4 4h7v7H4zM14 4h7v7h-7zM4 14h7v7H4zM14 14h7v7h-7z',theme:'M12 3a9 9 0 1 0 0 18c2 0 2-2 1-3s0-3 2-3h3c5 0 3-12-6-12Z',parent:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-3a8 8 0 0 1 16 0v3',logout:'M9 4H4v16h5m5-12 4 4-4 4m-5-4h12',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2',check:'m5 12 4 4L19 6',star:'m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z',arrow:'M5 12h14m-5-5 5 5-5 5',spark:'m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z'};
  function icon(name){return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.spark}"/></svg>`;}
  function badge(id, secret=false){
    if(secret)return `<span class="collectible mystery" aria-hidden="true">?</span>`;
    const semantic={s_first:24,s_3:0,s_7:1,s_14:43,s_30:11,s_100:8,s_180:7,s_365:6,s_early:10,s_night:56,s_shield:3,s_shield2:3,s_t200:19,s_t365:52,c_jump10:9,c_perfect:2,c_all95:7,c_money5k:22,c_wish:23,c_steady:25,c_jump20:53,t_first:24,t_read30:4,t_xp20k:52,m_7:16,x_night_perfect:56};
    const index=typeof id==='number'?id:semantic[id]??(typeof BADGES!=='undefined'?Math.max(0,BADGES.findIndex(b=>b.id===id)):0);
    return `<span class="collectible" aria-hidden="true" style="--badge-x:${index%8/7*100}%;--badge-y:${Math.floor(index/8)/7*100}%"></span>`;
  }
  function dateStyle(){const d=new Date();const week=Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/604800000);return {week,season:Math.floor(d.getMonth()/3),day:d.toLocaleDateString('zh-TW',{month:'long',day:'numeric',weekday:'short'})};}
  function hero(student){
    const id=student.themeId||'',w=worlds[id]||worlds[''],d=dateStyle();
    const artwork=w.image;
    const title=student.bannerTitle||w.label;
    const pose=['zoro','babymonster'].includes(id)?`<span class="weekly-pose" aria-hidden="true" style="background-position:${d.week%3*50}% ${id==='zoro'?0:100}%"></span>`:'';
    return `<section class="world-hero world-${esc(id||'default')} season-${d.season} variation-${d.week%3}" aria-label="專屬主題">
      ${artwork?`<img class="world-art" src="images/redesign/${artwork}?v=20261013b" alt="" fetchpriority="high">`:w.artPending?`<div class="pending-character"><span>${esc(w.character)}</span><small>角色圖片待補</small></div>`:'<div class="world-scenery" aria-hidden="true"><span></span><span></span><span></span></div>'}
      <div class="world-copy"><div class="eyebrow">${w.en}</div><h2>${esc(title)}</h2><p>${esc(student.bannerTagline||w.description)}</p><span class="world-date">${pose||icon('spark')}${d.day}</span></div>
    </section>`;
  }
  function themeArt(id){const w=worlds[id]||worlds[''];return `<div class="theme-art world-${id||'default'}">${w.image?`<img src="images/redesign/${w.image}?v=20261013b" alt="" loading="lazy">`:w.artPending?`<div class="pending-character"><span>${esc(w.character)}</span><small>角色圖片待補</small></div>`:'<div class="world-scenery" aria-hidden="true"><span></span><span></span><span></span></div>'}<span class="theme-edition">${w.en}</span></div>`;}
  function polish(){
    document.querySelectorAll('.kid-tab').forEach(el=>{const i=el.querySelector('.kid-tab-icon');if(i&&!i.dataset.drawn){const dot=i.querySelector('.kid-tab-dot');i.innerHTML=icon(el.dataset.tab);if(dot)i.append(dot);i.dataset.drawn='1';}el.setAttribute('aria-current',el.classList.contains('active')?'page':'false');});
    [['kidThemeEntryBtn','theme','主題造型'],['parentLink','parent','家長模式'],['kidLogoutBtn','logout','登出']].forEach(([id,type,label])=>{const el=document.getElementById(id);if(el&&!el.dataset.drawn){el.innerHTML=icon(type);el.setAttribute('aria-label',label);el.dataset.drawn='1';}});
    const menu={'app.html':'home','index.html':'home','students.html':'parent','rules-config.html':'rules','daily-tasks.html':'check','wishlist.html':'wish','config.html':'settings','violations.html':'rules','rules.html':'rules','themes.html':'theme','subjects.html':'rules','chart-settings.html':'score','effects.html':'spark','simulate.html':'score'};
    document.querySelectorAll('.sidebar > .nav-link').forEach(el=>{if(el.dataset.drawn)return;const label=el.textContent.trim().replace(/^[^\p{L}\p{N}]+/u,'');el.innerHTML=icon(menu[el.getAttribute('href')])+`<span>${esc(label)}</span>`;el.dataset.drawn='1';});
    document.querySelectorAll('[data-badge],.theme-card[data-theme],.kid-task[data-task]').forEach(el=>{if(el.dataset.a11y)return;el.tabIndex=0;el.setAttribute('role','button');el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click();}});el.dataset.a11y='1';});
    document.querySelectorAll('button[title]:not([aria-label])').forEach(b=>b.setAttribute('aria-label',b.title));
  }
  document.addEventListener('DOMContentLoaded',()=>{polish();let scheduled=false;new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;polish();});}).observe(document.body,{childList:true,subtree:true});});
  return {worlds,icon,badge,hero,themeArt};
})();
