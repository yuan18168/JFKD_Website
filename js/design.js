/* Presentation only. No database calls, new points or unlock rules. */
const JDesign = (() => {
  const worlds = {
    '': {label:'小小冒險，大大成長',en:'A LITTLE BETTER, EVERY DAY',color:'#7261bd',description:'把每天的小努力，收進你的成長收藏。'},
    ...Object.fromEntries(Object.values(typeof STUDENT_THEMES==='undefined'?{}:STUDENT_THEMES).map(t=>[t.id,{...t,label:t.name,description:t.tagline}]))
  };
  const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const paths={home:'M3 10 12 3l9 7M5 9v11h5v-6h4v6h5V9',rules:'M5 3h14v18H5zM8 7h8M8 11h8M8 15h5',score:'M4 20V4m0 16h17M8 16v-5m5 5V7m5 9V3',wish:'M3 8h18v5H3zM5 13v8h14v-8M12 8v13M12 8C3 8 5 0 9 4l3 4Zm0 0c9 0 7-8 3-4l-3 4Z',dex:'M4 4h7v7H4zM14 4h7v7h-7zM4 14h7v7H4zM14 14h7v7h-7z',theme:'M12 3a9 9 0 1 0 0 18c2 0 2-2 1-3s0-3 2-3h3c5 0 3-12-6-12Z',parent:'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-3a8 8 0 0 1 16 0v3',logout:'M9 4H4v16h5m5-12 4 4-4 4m-5-4h12',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2',check:'m5 12 4 4L19 6',star:'m12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1Z',arrow:'M5 12h14m-5-5 5 5-5 5',spark:'m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z'};
  function icon(name){return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.spark}"/></svg>`;}
  // Explicit atlas slots: never derive artwork from BADGES array order.
  // Artwork meanings and generation prompt: images/redesign/achievement-tasks-v2.md.
  const badgeSlots = Object.freeze({
    s_first:0,s_3:1,s_7:2,s_14:3,s_30:4,s_50:5,s_100:6,s_180:7,
    s_365:8,s_early:9,s_night:10,s_weekend:11,s_shield:12,s_shield2:13,s_t50:14,s_t100:15,
    s_t200:16,s_t365:17,c_prog5:18,c_def5:19,c_nopunish3:20,c_perfect:21,c_newhigh:22,c_jump10:23,
    c_all90:24,c_defx2:25,c_comeback80:26,c_5x90:27,c_rec10:28,c_allup:29,c_combo3:30,c_halfyear:31,
    c_money5k:32,c_master3:33,c_revenge:34,c_steady:35,c_wish:36,c_allinone:37,c_jump20:38,c_all95:39,
    t_first:40,t_10:41,t_50:42,t_100:43,t_500:44,t_perfect1:45,t_perfect7:46,t_perfect30:47,
    t_read30:48,t_chore30:49,t_xp1k:50,t_xp5k:51,t_xp20k:52,t_lv20:53,m_7:54,m_30:55,
    x_birthday:56,x_night_perfect:57,x_3x90:58,x_semester3:59,x_wish3:60,x_double:61
  });
  function badge(id, secret=false){
    if(secret)return `<span class="collectible mystery" aria-hidden="true">?</span>`;
    const index=badgeSlots[id];
    if(index===undefined)return `<span class="collectible mystery" aria-hidden="true">?</span>`;
    return `<span class="collectible" aria-hidden="true" style="--badge-x:${index%8/7*100}%;--badge-y:${Math.floor(index/8)/7*100}%"></span>`;
  }
  function dateStyle(){const d=new Date();const week=Math.floor(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/604800000);return {week,season:Math.floor(d.getMonth()/3),day:d.toLocaleDateString('zh-TW',{month:'long',day:'numeric',weekday:'short'})};}
  // Source-image head/hat positions, as fractions of image height. Keep the
  // character's full pose; do not enlarge a wide scene to fill a shallow banner.
  const heroHeadTop = Object.freeze({
    'mv-study/chiquita-sunset-mv-v1.webp':0.02,
    'mv-study/ruka-graffiti-mv-v1.webp':0.03,
    'mv-study/asa-silver-mv-v1.webp':0.035,
    'mv-study/pharita-mv-v1.webp':0.025,
    'mv-study/chiquita-mv-v1.webp':0.028,
    'mv-study/rora-mv-v1.webp':0.038,
    'mv-study/rami-mv-v1.webp':0.025,
    'mv-study/ahyeon-mv-v1.webp':0.015,
    'mv-study/ruka-drip-v1.webp':0.016,
    'mv-study/asa-sheesh-v1.webp':0.018,
    'theme-ahyeon.webp':.025,'theme-asa-silver.webp':.03,'theme-asa.webp':.027,
    'theme-chiquita-sunset.webp':.045,'theme-chiquita.webp':.032,
    'theme-chopper.webp':.17,'theme-franky.webp':.025,'theme-jinbe.webp':.08,
    'theme-luffy.webp':.028,'theme-nami.webp':.045,'theme-pharita.webp':.062,
    'theme-rami.webp':.058,'theme-robin-v2.webp':.033,'theme-rora.webp':.036,
    'theme-ruka-graffiti.webp':.04,'theme-ruka.webp':.036,
    'theme-sanji.webp':.102,'theme-shanks.webp':.071,'theme-usopp.webp':.058,
    'theme-zoro.webp':.108
  });
  function artworkHtml(w,hero=false){
    if(w.imageMode==='character'){
      const x=w.sceneColumns>1?w.sceneIndex%w.sceneColumns/(w.sceneColumns-1)*100:0,y=w.sceneRows>1?Math.floor(w.sceneIndex/w.sceneColumns)/(w.sceneRows-1)*100:0;
      const scene=w.sceneImage?`background-image:url('images/redesign/${w.sceneImage}');background-size:cover;background-position:center`:`background-image:url('images/redesign/${w.sceneAtlas}');background-size:${w.sceneColumns*100}% ${w.sceneRows*100}%;background-position:${x}% ${y}%`;
      return `<div class="pokemon-stage ${w.series==='onepiece'?'crew-stage ':''}${w.edition==='ex'?'edition-ex':''}" aria-hidden="true"><div class="pokemon-backdrop" style="${scene}"></div><div class="pokemon-aura"></div><img class="world-art pokemon-character" src="images/redesign/${w.image}" alt="" ${hero?'fetchpriority="high"':'loading="lazy"'}><span class="pokemon-glint"></span>${w.edition==='ex'?'<span class="ex-emblem">ex</span><span class="ex-foil-edge"></span>':''}</div>`;
    }
    return w.image?`<img class="world-art" src="images/redesign/${w.image}?v=20261014a" alt="" ${hero?'fetchpriority="high"':'loading="lazy"'}>`:w.artPending?`<div class="pending-character"><span>${esc(w.character)}</span><small>角色圖片待補</small></div>`:'<div class="world-scenery" aria-hidden="true"><span></span><span></span><span></span></div>';
  }

  const signatureWorlds = {
    zoro:{label:'劍士修練所',start:'每一次練習，都讓實力更扎實。',finish:'今日修練完成，向夢想再近一步。',mark:'M6 26 25 7l2-4-4 2L4 24m1-5 8 8M4 28l-2 2M16 28 28 16m-5 0 5 5'},
    babymonster:{label:'Asa 的練習舞台',start:'把今天的練習，變成明天的高光。',finish:'今天的練習完成，為自己鼓掌！',mark:'M5 13v6m5-11v16m6-20v24m6-20v16m5-11v6'},
    gold:{label:'皮卡丘充電站',start:'收集每一份努力，讓今天充滿電！',finish:'今日能量充滿，一起迎接新冒險！',mark:'M18 2 6 18h9l-1 12 12-18h-9z'}
  };
  Object.entries(typeof STUDENT_THEMES==='undefined'?{}:STUDENT_THEMES).filter(([,w])=>w.series==='stage').forEach(([id,w])=>{signatureWorlds[id]={label:w.character+' 的練習舞台',start:'每一次練習，都讓自己的光更明亮。',finish:'今天的努力值得掌聲，為自己喝采！',mark:'M5 13v6m5-11v16m6-20v24m6-20v16m5-11v6'};});
  function worldMark(id){const w=signatureWorlds[id];return w?'<svg class="signature-mark" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="'+w.mark+'"/></svg>':'';}
  function taskWorld(student,done,total){
    const id=student.themeId,theme=worlds[id],w=signatureWorlds[id]||(theme?.character?{label:theme.character+' 的成長練習',start:'把今天的小努力，變成明天的新本領。',finish:'今天的努力完成了，為自己開心一下！'}:null);if(!w)return '';
    const complete=total>0&&done===total;
    const character=companion(student,'task');
    return '<div class="task-world task-world-'+id+(complete?' is-complete':'')+'"><div class="task-world-copy"><span class="task-world-label">'+worldMark(id)+w.label+'</span><p>'+ (complete?w.finish:w.start)+'</p><span class="world-energy" aria-hidden="true">'+[0,1,2,3,4].map(i=>'<i class="'+(total&&done/total*5>i?'lit':'')+'"></i>').join('')+'</span></div><div class="world-companion">'+character+'</div></div>';
  }

  function companion(student,slot){
    const id=student.themeId;
    if(!worlds[id]?.character||!['task','streak','growth'].includes(slot))return '';
    return `<span class="character-stage character-stage-${slot}" aria-hidden="true"><img class="character-pose" src="images/redesign/poses-v1/${esc(id)}-${slot}.webp" width="320" height="360" alt="" loading="lazy" decoding="async"></span>`;
  }

  // Keep the quote stable during task rerenders; remember only its index locally.
  const quoteVisits = new Map();
  const quoteHistory = new Map();
  function encouragement(student, id, lines) {
    const who=String(student.id||student.name||'guest');
    const active=quoteVisits.get(who);
    if(active?.id===id) return active.text;
    const key='jfkd-encouragement-v1:'+who+':'+id;
    let previous=quoteHistory.get(key);
    try { const stored=localStorage.getItem(key); if(stored!==null) previous=Number(stored); } catch (_) {}
    const choices=lines.map((_,i)=>i).filter(i=>i!==previous);
    const index=choices[Math.floor(Math.random()*choices.length)]??0;
    const text=lines[index];
    quoteHistory.set(key,index);
    try { localStorage.setItem(key,String(index)); } catch (_) {}
    quoteVisits.set(who,{id,text});
    return text;
  }
  function hero(student){
    const id=student.themeId||'',w=worlds[id]||worlds[''],d=dateStyle();
    const title=w.label;
    const copy=typeof THEME_COPY!=='undefined'?THEME_COPY[id]:null;
    const quote=copy?encouragement(student,id,copy.quotes):w.description;
    const headTop=heroHeadTop[w.image];
    const framed=headTop!==undefined;
    // Crop only ~0.6% of source height beyond the hairline; keep the feet.
    const crop=framed?headTop+.006:0,scale=1/(1-crop);
    const framing=framed?` style="--hero-art-height:${scale*100}%;--hero-art-top:${-crop*scale*100}%;--hero-scene:url('${esc(new URL('images/redesign/'+w.image,document.baseURI).href)}?v=20261014a')"`:'';
    const pose=w.series==='stage'?'<span class="mv-date-portrait" aria-hidden="true" style="background-image:url(images/redesign/'+w.image+')"></span>':['zoro'].includes(id)?`<span class="weekly-pose" aria-hidden="true" style="background-position:${d.week%3*50}% ${id==='zoro'?0:100}%"></span>`:'';
    return `<section class="world-hero ${framed?'world-framed ':''}world-${esc(id||'default')} world-series-${esc(w.series||'default')} season-${d.season} variation-${d.week%3}"${framing} aria-label="專屬主題">
      ${artworkHtml(w,true)}${signatureWorlds[id]?'<span class="hero-signature" aria-hidden="true">'+worldMark(id)+'</span>':''}
      <div class="world-copy"><div class="eyebrow">${w.en}</div><h2>${esc(title)}</h2><p class="world-intro">${esc(copy?.intro||w.description)}</p>${copy?`<div class="world-encouragement"><span class="world-encouragement-label">給今天的你</span><p>${esc(quote)}</p></div>`:''}<span class="world-date">${pose||icon('spark')}${d.day}</span></div>
    </section>`;
  }
  function themeArt(id){const w=worlds[id]||worlds[''];return `<div class="theme-art world-${id||'default'}">${artworkHtml(w)}<span class="theme-edition">${w.en}</span></div>`;}
  function polish(){
    document.querySelectorAll('.kid-tab').forEach(el=>{const i=el.querySelector('.kid-tab-icon');if(i&&!i.dataset.drawn){const dot=i.querySelector('.kid-tab-dot');i.innerHTML=icon(el.dataset.tab);if(dot)i.append(dot);i.dataset.drawn='1';}el.setAttribute('aria-current',el.classList.contains('active')?'page':'false');});
    [['kidThemeEntryBtn','theme','主題造型'],['parentLink','parent','家長模式'],['kidLogoutBtn','logout','登出']].forEach(([id,type,label])=>{const el=document.getElementById(id);if(el&&!el.dataset.drawn){el.innerHTML=icon(type);el.setAttribute('aria-label',label);el.dataset.drawn='1';}});
    const menu={'app.html':'home','index.html':'home','students.html':'parent','rules-config.html':'rules','daily-tasks.html':'check','wishlist.html':'wish','config.html':'settings','violations.html':'rules','rules.html':'rules','themes.html':'theme','subjects.html':'rules','chart-settings.html':'score','effects.html':'spark','simulate.html':'score'};
    document.querySelectorAll('.sidebar > .nav-link').forEach(el=>{if(el.dataset.drawn)return;const label=el.textContent.trim().replace(/^[^\p{L}\p{N}]+/u,'');el.innerHTML=icon(menu[el.getAttribute('href')])+`<span>${esc(label)}</span>`;el.dataset.drawn='1';});
    document.querySelectorAll('[data-badge],.theme-card[data-theme],.kid-task[data-task]').forEach(el=>{if(el.dataset.a11y)return;el.tabIndex=0;el.setAttribute('role','button');el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();el.click();}});el.dataset.a11y='1';});
    document.querySelectorAll('button[title]:not([aria-label])').forEach(b=>b.setAttribute('aria-label',b.title));
  }
  document.addEventListener('DOMContentLoaded',()=>{polish();let scheduled=false;new MutationObserver(()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;polish();});}).observe(document.body,{childList:true,subtree:true});});
  return {worlds,icon,badge,hero,themeArt,taskWorld,companion};
})();
