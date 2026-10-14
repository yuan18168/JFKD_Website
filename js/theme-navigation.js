/* Theme-specific navigation artwork; labels, destinations and notification nodes stay intact. */
const ThemeNavigation=(()=>{
 const marks={
 zoro:['三刀流','M4 27 25 6m-9 21L28 15M5 17l10 10M19 15l9 9M3 22l8 8M13 20 27 3'],
 luffy:['草帽','M3 22h26M7 21v-7c0-13 18-13 18 0v7M7 17h18'],
 nami:['橘子','M16 11c-15-6-17 18 0 18s15-24 0-18Zm0 0V4m0 3c6-8 13-3 9 1-3 2-6 1-9-1'],
 usopp:['彈弓','M7 3c0 10 4 12 9 15 5-3 9-5 9-15M16 18v12M7 5l9 5 9-5'],
 sanji:['料理','M5 3v10m4-10v10m4-10v10M5 10c0 8 8 8 8 0M9 16v14M25 3c-8 5-7 15 0 15V3m0 15v12'],
 chopper:['醫療帽','M4 13h24v12H4zM7 13V5h18v8M12 17l8 5m0-5-8 5'],
 robin:['花花果實','M16 12C5-5 2 14 12 16-6 26 14 33 16 20c9 18 20-2 4-4 17-10-4-22-4-4Zm-2 2h4v4h-4z'],
 franky:['機械星','M16 2l4 9 10 1-8 7 2 11-8-6-8 6 2-11-8-7 10-1z'],
 shanks:['靈魂樂章','M12 24V7l15-4v18M12 8l15-3M12 23c-8-4-12 5-5 6 4 0 5-3 5-6Zm15-3c-8-4-12 5-5 6 4 0 5-3 5-6Z'],
 jinbe:['海流','M3 10c6-9 10 9 16 0s10 0 10 0M3 19c6-9 10 9 16 0s10 0 10 0M3 27c6-9 10 9 16 0s10 0 10 0'],
 babymonster:['饒舌麥克風','M19 3c8 0 8 11 0 11s-8-11 0-11ZM16 13 4 27l3 3 14-16M14 5l9 6'],
 ruka:['街舞節拍','M3 24 11 4l4 13 8-13 6 20M5 28h22'],
 ahyeon:['搖滾火花','M17 2 4 18h10l-1 12L28 12H17zM3 4l3 3m21 19 3 3'],
 rami:['月光琴鍵','M3 10h26v19H3zM9 10v19m7-19v19m7-19v19M22 2c-7 1-7 7 0 7-3-3-3-4 0-7'],
 rora:['玫瑰唱片','M16 3a13 13 0 1 0 0 26 13 13 0 1 0 0-26Zm0 7a6 6 0 1 0 0 12 6 6 0 1 0 0-12Zm-3 4 6 2-6 2z'],
 chiquita:['熱帶音浪','M16 28V10M16 13C-2 12 5 0 16 10c6-15 21-6 0 3M3 23l3-6 4 6m13 0 3-6 4 6'],
 pharita:['天鵝','M4 21c0 12 22 11 22 0-11 5-17-5-13-12 4-8 10-5 7-1l-5 3m-2 4c-6-4-10 0-9 6'],
 'asa-silver':['銀翼','M16 28V12M16 18 2 4l3 13 11 7M16 18 30 4l-3 13-11 7'],
 'ruka-graffiti':['塗鴉','M9 10h14v20H9zM12 10V5h8v5M16 5V2m7 4 7-2m-7 5h7M12 20l4-5 4 5-4 5z'],
 'chiquita-sunset':['夕陽舞台','M3 20h26M7 20a9 9 0 0 1 18 0M3 25h26M16 2v5M4 8l4 4m20-4-4 4'],
 gold:['閃電','M18 2 5 18h10l-1 12 13-18H17z'],
 aurora:['森林耳朵','M15 26C-2 23 2 5 3 3c9 4 12 13 12 23Zm2 0c17-3 13-21 12-23-9 4-12 13-12 23Z'],
 bulbasaur:['盛放花朵','M16 13C3-4 1 14 11 17c-14 5-1 18 5 5 6 13 19 0 5-5 10-3 8-21-5-4Zm-6 16h12M16 22v7'],
 squirtle:['水流護盾','M16 2 4 7v9c0 8 12 14 12 14s12-6 12-14V7zM16 8c-13 15 13 15 0 0Z'],
 dragonite:['龍翼','M15 28 3 8l11 4 2-9 2 9 11-4-12 20M9 19h14'],
 gengar:['月夜鬼影','M5 24 3 11l8 2 5-10 5 10 8-2-2 13-11 6zM9 19l4 2m10-2-4 2M12 25h8'],
 lucario:['波導','M16 3 4 16l12 13 12-13zM16 9l7 7-7 7-7-7zM1 7l4 4m26-4-4 4'],
 jigglypuff:['水手裏劍','M16 2l4 10 10 4-10 4-4 10-4-10-10-4 10-4zM16 12l4 4-4 4-4-4z'],
 galaxy:['精神星環','M16 3a13 13 0 1 0 0 26 13 13 0 1 0 0-26ZM3 24 29 8M14 10l6 6-6 6'],
 lava:['烈焰龍','M16 2c1 9 9 9 6 16 9-6 10 13-6 13S0 14 10 13c-2 7 5 8 6-11Z']
 };
 const sets={
 onepiece:{rules:'M6 4h19v25H6zM3 4h6m-6 25h6M10 10h10m-10 6h10m-10 6h7',score:'M10 3h12v10c0 10-12 10-12 0V3ZM10 7H4v5c0 4 4 5 7 5M22 7h6v5c0 4-4 5-7 5M16 21v7m-7 1h14',wish:'M3 15h26v13H3zM3 15c0-16 26-16 26 0M3 20h26M14 17h4v6h-4z',dex:'M4 5h10l2 3 2-3h10v23H18l-2 2-2-2H4zM16 8v20'},
 stage:{rules:'M5 3h22v9c-5 0-5 8 0 8v9H5v-9c5 0 5-8 0-8zM12 9h8m-8 7h8m-8 7h8',score:'M5 29V18h5v11m3 0V10h5v19m3 0V3h5v26',wish:'M16 3l4 8 9 1-6 7 1 10-8-5-8 5 1-10-6-7 9-1z',dex:'M3 6h21v23H3zM8 2h21v23M7 12h13m-13 5h13m-13 5h8'},
 pokemon:{rules:'M5 3h22v26H5zM9 8h14M9 13h3m5 0h6M9 19l3 3 8-7',score:'M4 25h5V15H4zm10 0h5V9h-5zm10 0h5V3h-5zM3 29h27',wish:'M4 12h24v17H4zM2 7h28v6H2zM16 7v22M16 7C1 7 7-6 16 7Zm0 0c15 0 9-13 0 0Z',dex:'M5 2h22v28H5zM5 11h22M9 6h3m4 0h7M11 20a5 5 0 1 0 10 0 5 5 0 1 0-10 0Zm0 0h10'}
 };
 const svg=p=>'<svg class="ui-icon theme-nav-glyph" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="'+p+'"/></svg>';
 function refresh(){const nav=document.querySelector('.kid-tabbar');if(!nav)return;const id=Object.keys(marks).find(id=>document.body.classList.contains('theme-'+id)),w=id&&STUDENT_THEMES[id];nav.dataset.world=id||'';nav.dataset.series=w?.series||'';nav.dataset.props=Boolean(id&&w)?'true':'false';
 nav.querySelectorAll('.kid-tab').forEach(tab=>{const el=tab.querySelector('.kid-tab-icon'),key=id||'default';if(el.dataset.navTheme===key)return;const dot=el.querySelector('.kid-tab-dot');el.innerHTML=nav.dataset.props==='true'?'<img class="nav-prop" src="images/redesign/navigation-v2/'+id+'-'+tab.dataset.tab+'.webp" alt="" aria-hidden="true" width="48" height="48">':w?svg(tab.dataset.tab==='home'?marks[id][1]:sets[w.series][tab.dataset.tab]):JDesign.icon(tab.dataset.tab);if(dot)el.append(dot);el.dataset.navTheme=key;el.dataset.drawn='1';});
 }
 document.addEventListener('DOMContentLoaded',()=>{refresh();new MutationObserver(refresh).observe(document.body,{attributes:true,attributeFilter:['class']});});
 return {marks,refresh};
})();
