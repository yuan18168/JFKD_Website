/* Restore only Pokémon visual settings. No network calls or deployment. */
const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'../..'),file=path.join(root,'js/data.js'),re=/const STUDENT_THEMES\s*=\s*(\{[\s\S]*?\n\});/;
const args=process.argv.slice(2),id=args.find(x=>!x.startsWith('--')),all=args.includes('--all'),luxe=args.includes('--new');
const source=JSON.parse(fs.readFileSync(path.join(__dirname,luxe?'luxe-v1.json':'original.json'),'utf8'));
if(!all&&!Object.hasOwn(source,id))throw Error('Usage: node tools/pokemon-art/restore.cjs --all | <id> [--new] [--dry-run]');
const text=fs.readFileSync(file,'utf8'),match=text.match(re);if(!match)throw Error('STUDENT_THEMES not found');const current=JSON.parse(match[1]);
// Change only visual fields; preserve future progress, identity and business fields.
const fields=['name','scene','image','imageMode','artPending','sceneAtlas','sceneColumns','sceneRows','sceneIndex','sceneImage','edition','artVersion','luxeAccent','luxePlacement','poseImages'];
for(const key of all?Object.keys(source):[id]){if(current[key]?.series!=='pokemon')throw Error('Not a Pokemon theme: '+key);for(const field of fields){if(Object.hasOwn(source[key],field))current[key][field]=source[key][field];else delete current[key][field];}}
const result=text.replace(re,'const STUDENT_THEMES = '+JSON.stringify(current,null,2)+';');
if(args.includes('--dry-run')){console.log(JSON.stringify(current));}else{const backup=path.join(root,'_release/pokemon-restore');fs.mkdirSync(backup,{recursive:true});fs.writeFileSync(path.join(backup,'data-'+Date.now()+'.js'),text);fs.writeFileSync(file,result);console.log('Local artwork switched to '+(luxe?'luxe-v1':'original')+' / '+(all?'all 10':id)+'. Commit and deploy separately to update the live site.');}
