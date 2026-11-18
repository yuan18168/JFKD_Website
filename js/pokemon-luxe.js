/* Independent presentation layer. Other collections and progress rules are untouched. */
(() => {
  const prior={hero:JDesign.hero,themeArt:JDesign.themeArt,companion:JDesign.companion,taskWorld:JDesign.taskWorld};
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const isLuxe=w=>w?.series==='pokemon'&&w.artVersion==='pokemon-luxe-v1';
  const labels={task:'今日任務',streak:'持續前進',growth:'成長時刻'};
  function art(w,hero=false){const p=w.luxePlacement;
    return `<div class="pk-luxe-art ${w.edition==='ex'?'pk-ex':''}" style="--pk-light:${w.luxeAccent}" aria-label="${esc(w.character+' · '+w.scene)}">
      <img class="pk-luxe-background" src="images/redesign/${esc(w.sceneImage)}" width="1672" height="941" alt="${esc(w.scene)}" ${hero?'fetchpriority="high"':'loading="lazy"'} decoding="async">
      <span class="pk-contact-shadow" aria-hidden="true"></span>
      <img class="pk-luxe-character" src="images/redesign/${esc(w.image)}" width="475" height="475" alt="${esc(w.character)}" style="--pk-width:${p.width}%;--pk-left:${p.left}%;--pk-top:${p.top}%" decoding="async">
      ${w.edition==='ex'?'<span class="pk-foil" aria-hidden="true"></span><span class="pk-card-frame" aria-hidden="true"></span><span class="pk-ex-label" aria-label="ex 特別版">ex</span>':''}
    </div>`;
  }
  const quotes=new Map();
  JDesign.hero=student=>{const w=JDesign.worlds[student.themeId];if(!isLuxe(w))return prior.hero(student);
    const copy=typeof THEME_COPY==='undefined'?null:THEME_COPY[w.id];const key=(student.id||student.name||'guest')+':'+w.id;
    if(!quotes.has(key))quotes.set(key,copy?.quotes?.[Math.floor(Math.random()*copy.quotes.length)]||w.tagline);
    const date=new Date().toLocaleDateString('zh-TW',{month:'long',day:'numeric',weekday:'short'});
    return `<section class="pk-luxe-hero ${w.edition==='ex'?'pk-luxe-hero-ex':''}" style="--pk-light:${w.luxeAccent}" aria-label="${esc(w.character)} 專屬主題">
      ${art(w,true)}<div class="pk-luxe-copy"><span class="pk-kicker">POKÉMON COLLECTION <b>／ ${String(Object.values(STUDENT_THEMES).filter(t=>t.series==='pokemon').sort((a,b)=>a.xp-b.xp).findIndex(t=>t.id===w.id)+1).padStart(2,'0')}</b></span><h2>${esc(w.character.replace(/\s+ex$/i,''))}${w.edition==='ex'?'<em>ex</em>':''}</h2><p class="pk-scene-name">${esc(w.scene)}</p><p class="pk-intro">${esc(w.tagline)}</p><div class="pk-encouragement"><span>給今天的你</span><p>${esc(quotes.get(key))}</p></div><span class="pk-date">${JDesign.icon('spark')}${date}</span></div>
    </section>`;
  };
  JDesign.themeArt=id=>{const w=JDesign.worlds[id];return isLuxe(w)?`<div class="theme-art pk-luxe-theme">${art(w)}<span class="pk-theme-caption">${esc(w.scene)}</span></div>`:prior.themeArt(id);};
  JDesign.companion=(student,slot)=>{const w=JDesign.worlds[student.themeId];if(!isLuxe(w)||!labels[slot])return prior.companion(student,slot);
    return `<span class="character-stage character-stage-${slot} pk-luxe-companion" style="--pk-light:${w.luxeAccent};--pk-scene:url('${esc(new URL('images/redesign/'+w.sceneImage,document.baseURI).href)}')"><span class="pk-pose-halo" aria-hidden="true"></span><img class="character-pose" src="images/redesign/${esc(w.poseImages[slot])}" alt="${esc(w.character+' · '+labels[slot])}" loading="lazy" decoding="async"><span class="pk-pose-caption">${labels[slot]}</span></span>`;
  };
  JDesign.taskWorld=(student,done,total)=>{const w=JDesign.worlds[student.themeId];if(!isLuxe(w))return prior.taskWorld(student,done,total);const complete=total>0&&done===total;
    return `<div class="task-world pk-luxe-task ${complete?'is-complete':''}" style="--pk-light:${w.luxeAccent}"><div class="task-world-copy"><span class="pk-task-kicker">DAILY QUEST</span><span class="task-world-label">${esc(w.character)}的冒險任務</span><p>${complete?'今日任務完成，把努力變成新的力量。':esc(w.tagline)}</p><span class="world-energy" aria-hidden="true">${[0,1,2,3,4].map(i=>`<i class="${total&&done/total*5>i?'lit':''}"></i>`).join('')}</span></div><div class="world-companion">${JDesign.companion(student,'task')}</div></div>`;
  };
})();
