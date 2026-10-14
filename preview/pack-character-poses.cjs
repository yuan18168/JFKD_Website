const fs=require('fs'),path=require('path');
const sharp=require('C:/Users/yuan1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..'),meta=require('./pose-generation.json');
const groups=meta.groups;
const cuts=[[0,336,660,982,1290,1619],[0,330,665,1007,1306,1619],[0,325,654,984,1283,1619],[0,282,634,957,1298,1619],[0,320,638,917,1215,1619],[0,315,662,946,1280,1619]];
(async()=>{
 const out=path.join(root,'images/redesign/poses-v1');fs.mkdirSync(out,{recursive:true});
 const manifest=[];
 for(let g=0;g<6;g++){
  const source=path.join(root,'preview',`pose-source-${g}.png`);if(!fs.existsSync(source))fs.copyFileSync(meta.sources[g],source);
  const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(let c=0;c<3;c++){
   const left=Math.round(c*info.width/3),right=Math.round((c+1)*info.width/3);
   const boundaries=cuts[g].map((target,i)=>{
    if(i===0||i===5)return target;
    let best=target,score=Infinity;
    for(let y=target-16;y<=target+16;y++){
     let n=0;for(let x=left;x<right;x++)if(data[(y*info.width+x)*4+3]>80)n++;
     if(n<score){score=n;best=y;}
    }return best;
   });
   for(let r=0;r<5;r++){
    const slot=['task','streak','growth'][c],id=groups[g][r].id,file=`${id}-${slot}.webp`;
    await sharp(await sharp(source).extract({left,top:boundaries[r],width:right-left,height:boundaries[r+1]-boundaries[r]}).png().toBuffer()).trim({threshold:15}).resize(320,360,{fit:'contain',background:'#00000000'}).webp({quality:86,alphaQuality:100}).toFile(path.join(out,file));
    manifest.push({id,character:groups[g][r].character,slot,file,bytes:fs.statSync(path.join(out,file)).size});
   }
  }
 }
 const corrected=path.join(__dirname,'pose-jinbe-growth.png');
 if(fs.existsSync(corrected)){await sharp(corrected).trim({threshold:15}).resize(320,360,{fit:'contain',background:'#00000000'}).webp({quality:86,alphaQuality:100}).toFile(path.join(out,'jinbe-growth.webp'));manifest.find(x=>x.file==='jinbe-growth.webp').bytes=fs.statSync(path.join(out,'jinbe-growth.webp')).size;}
 fs.writeFileSync(path.join(__dirname,'character-poses.json'),JSON.stringify(manifest,null,2));
 console.log('Packed',manifest.length,'poses;',manifest.reduce((n,p)=>n+p.bytes,0),'bytes total');
})();

