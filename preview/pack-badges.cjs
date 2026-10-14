// Pack four AI source sheets into exact 256px sprite cells.
// No artwork is redrawn; this is the reproducible source-to-WebP asset packing step.
const path = require('path');
const sharp = require(process.env.SHARP_MODULE || 'C:/Users/yuan1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root = path.resolve(__dirname, '..');
// Cut through empty gutters, allowing for slight AI grid drift.
const cuts = [
  {x:[0,320,627,940,1254],y:[0,313,613,919,1254]},
  {x:[0,336,627,930,1254],y:[0,313,617,905,1254]},
  {x:[0,314,627,939,1254],y:[0,313,623,909,1254]},
  {x:[0,314,627,932,1254],y:[0,313,622,913,1254]}
];
(async () => {
  const cells = [];
  for(let sheet=0;sheet<4;sheet++) {
    const source = path.join(root,`images/redesign/achievement-tasks-v2-${sheet+1}.png`);
    const meta = await sharp(source).metadata();
    if(meta.width !== 1254 || meta.height !== 1254) throw new Error('Unexpected atlas source');
    const {x,y}=cuts[sheet];
    for(let row=0; row<4; row++) for(let col=0; col<4; col++) {
      const index=sheet*16+row*4+col;
      const input = await sharp(source).extract({left:x[col],top:y[row],width:x[col+1]-x[col],height:y[row+1]-y[row]})
        .resize(256,256,{fit:'contain',background:'#fffdf9'}).png().toBuffer();
      cells.push({input,left:index%8*256,top:Math.floor(index/8)*256});
    }
  }
  await sharp({create:{width:2048,height:2048,channels:4,background:'#fffdf9'}}).composite(cells)
    .webp({quality:90}).toFile(path.join(root,'images/redesign/achievement-tasks-v2.webp'));
  console.log('Packed 64 padded sprite cells; first 62 are assigned to achievements.');
})().catch(error=>{console.error(error);process.exit(1);});
