const fs=require('fs');
const rows=[
['babymonster','Asa','SHEESH 星鍊階梯','asa-sheesh-v1',.018,'#e9dce8','#fff6fb','#351d36','#715368','#873855','#663456','#87572c','#e9a7c8','#cfb6dc','#321d30','18px 5px 18px 5px','linear-gradient(125deg,transparent 44%,#b84a7014 45%,transparent 46%)'],
['ruka','Ruka','DRIP 街舞音箱','ruka-drip-v1',.016,'#e7e8d8','#fcfbef','#333a23','#596044','#596824','#964f4a','#7b591d','#d3d783','#edb3a3','#30381f','8px 24px 8px 24px','repeating-linear-gradient(90deg,transparent 0 40px,#70804610 41px 42px)'],
['ahyeon','Ahyeon','DRIP 晴光唱片街','ahyeon-mv-v1',.015,'#f4edc8','#fffdf0','#233b52','#536478','#375c87','#886517','#836021','#e8d77d','#a3cadd','#223a50','24px 24px 10px 10px','radial-gradient(circle,#24497014 1px,transparent 2px)'],
['rami','Rami','SHEESH 銀鏡高音舞台','rami-mv-v1',.025,'#dfe5f0','#f7faff','#263448','#52627d','#385c86','#8a3f50','#7d5c30','#b9cce8','#d4b9c3','#273346','6px 20px 6px 20px','linear-gradient(125deg,transparent 40%,#6f88a717 41%,transparent 60%)'],
['rora','Rora','SHEESH 薔薇秘境','rora-mv-v1',.038,'#e9dfe9','#fff7fc','#40283e','#72556b','#78436f','#8c495f','#836133','#d9b4c9','#baa7d2','#3a253c','26px 8px 26px 8px','radial-gradient(circle at 50% 0,#aa72951a,transparent 60%)'],
['chiquita','Chiquita','SHEESH 金翼迴廊','chiquita-mv-v1',.028,'#e9e1d4','#fffbf2','#393247','#675b70','#675075','#876629','#7b5822','#e8d3a7','#b1bdd5','#342c40','20px 4px 20px 4px','repeating-linear-gradient(45deg,transparent 0 26px,#9b8a6910 27px 28px)'],
['pharita','Pharita','SHEESH 珠光月之殿','pharita-mv-v1',.025,'#e9e7f2','#fffaff','#39334d','#68617b','#675481','#7b526a','#7a613a','#ded2e9','#bdcde3','#373046','28px','radial-gradient(circle,#88799e17 1px,transparent 2px)'],
['asa-silver','Asa','FOREVER 冰藍時裝秀','asa-silver-mv-v1',.035,'#e1eaf0','#fbfdff','#293d50','#586d7d','#3d6485','#68608d','#80633b','#bfd8e8','#d6cce4','#273e51','24px 6px 24px 6px','linear-gradient(115deg,transparent 25%,#98b8cc18 26%,transparent 70%)'],
['ruka-graffiti','Ruka','BATTER UP 緋紅節拍','ruka-graffiti-mv-v1',.03,'#e9dce1','#fff6f7','#402832','#72545f','#85384f','#3f526c','#87613c','#deb0b8','#acbad2','#3c2532','5px 18px 5px 18px','repeating-linear-gradient(0deg,transparent 0 30px,#aa4d6c10 31px 32px)'],
['chiquita-sunset','Chiquita','DRIP 糖果黑膠屋','chiquita-sunset-mv-v1',.02,'#eee0e6','#fff7fb','#413047','#75596e','#8c456a','#3f647e','#876020','#edb8d4','#b7d1df','#3b2a41','20px','radial-gradient(circle at 80% 15%,#dc8bba22,transparent 60%)']
];
let data=fs.readFileSync('js/data.js','utf8'),design=fs.readFileSync('js/design.js','utf8');
const palettes=JSON.parse(fs.readFileSync('preview/theme-palettes.json','utf8'));
let css='/* MV wardrobe-specific surfaces and companion cards. */\n';
for(const [id,name,scene,file,head,bg,card,ink,dim,accent,second,warm,glowA,glowB,nav,radius,texture] of rows){
const re=new RegExp('("'+id+'"\\s*:\\s*\\{)([\\s\\S]*?)(\\n  \\})');
if(!re.test(data))throw Error('Missing theme '+id);
data=data.replace(re,(all,open,body,close)=>open+body.replace(/"name": "[^"]+"/,'"name": "'+name+' · '+scene+'"').replace(/"scene": "[^"]+"/,'"scene": "'+scene+'"').replace(/"color": "[^"]+"/,'"color": "'+accent+'"').replace(/"bg": "[^"]+"/,'"bg": "'+bg+'"').replace(/"image": "[^"]+"/,'"image": "mv-study/'+file+'.webp"')+close);
Object.assign(palettes.find(p=>p.id===id),{name:scene,bg,card,ink,dim,accent,second,warm,glowA,glowB,nav});
const key='mv-study/'+file+'.webp';if(!design.includes("'"+key+"':"))design=design.replace('const heroHeadTop = Object.freeze({',"const heroHeadTop = Object.freeze({\n    '"+key+"':"+head+',');
css+=`body.kid-app.theme-${id}{--mv-radius:${radius};--mv-texture:${texture};background-image:var(--mv-texture)!important;background-size:32px 32px}\n`;
css+=`body.kid-app.theme-${id} .kid-card{border-radius:var(--mv-radius);background:linear-gradient(135deg,var(--kid-card),var(--k-soft-bg))!important;border-color:var(--kid-border)!important;box-shadow:0 6px 20px var(--theme-shadow)}\n`;
css+=`body.kid-app.theme-${id} .world-hero{border-radius:var(--mv-radius);border:2px solid var(--kid-border);box-shadow:0 6px 18px var(--theme-shadow)}\n`;
css+=`body.kid-app.theme-${id} .kid-task{border-radius:${radius};background:var(--kid-card);border-left:3px solid var(--k-accent2)}body.kid-app.theme-${id} .kid-task.done{background:var(--k-soft-bg);box-shadow:inset 3px 0 var(--k-accent)}\n`;
css+=`body.kid-app.theme-${id} .kid-task-xp{background:var(--k-soft-bg2);border-color:var(--kid-border);border-radius:8px}body.kid-app.theme-${id} .today-card{border-top:4px solid var(--k-accent2)!important}\n`;
css+=`body.kid-app.theme-${id} :is(.xp-track,.streak-goal-track){background:var(--k-soft-bg2);border-radius:8px;height:10px}body.kid-app.theme-${id} :is(.xp-fill,.streak-goal-fill){background:var(--k-accent-grad);border-radius:8px}\n`;
}
// All stage worlds now use the current MV portrait, rather than the old Asa sprite.
if(!design.includes("Object.entries(typeof STUDENT_THEMES==='undefined'?{}:STUDENT_THEMES).filter"))design=design.replace('function worldMark(id){',`Object.entries(typeof STUDENT_THEMES==='undefined'?{}:STUDENT_THEMES).filter(([,w])=>w.series==='stage').forEach(([id,w])=>{signatureWorlds[id]={label:w.character+' 的練習舞台',start:'每一次練習，都讓自己的光更明亮。',finish:'今天的努力完成，為自己喝采！',mark:'M5 13v6m5-11v16m6-20v24m6-20v16m5-11v6'};});\n  function worldMark(id){`);
design=design.replace("const character=id==='gold'?",`const character=STUDENT_THEMES[id]?.series==='stage'?'<span class="mv-companion" aria-hidden="true" style="background-image:url(images/redesign/'+STUDENT_THEMES[id].image+')"></span>':id==='gold'?`);
css+='.mv-companion{display:block;width:88px;height:100px;border:1px solid var(--kid-border);border-radius:18px 5px;background-size:auto 100%;background-position:79% center;background-repeat:no-repeat;box-shadow:0 4px 10px var(--theme-shadow)}\n';
css+='body.kid-app.theme-babymonster .world-date:before{display:none}body.kid-app.theme-babymonster .world-date{padding-left:12px}body.kid-app.theme-babymonster .task-world{border-color:var(--kid-border)}body.kid-app.theme-babymonster .kid-task-box{box-shadow:none}body.kid-app.theme-babymonster .streak-hero{border-color:var(--kid-border)!important}\n';
fs.writeFileSync('js/data.js',data);fs.writeFileSync('js/design.js',design);fs.writeFileSync('css/mv-worlds.css',css);fs.writeFileSync('preview/theme-palettes.json',JSON.stringify(palettes,null,2)+'\n');
fs.writeFileSync('preview/mv-worlds.json',JSON.stringify(rows.map(([id,name,scene,file,head])=>({id,name,scene,file,head})),null,2));
console.log('Integrated ten MV worlds, surfaces and current costume companion portraits');
