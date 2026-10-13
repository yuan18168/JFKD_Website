/* Isolated demo adapter. No Firebase SDK, credentials, network reads or writes. */
const DEMO_KEY = 'jfkd-preview-v20261013';
const clone = value => JSON.parse(JSON.stringify(value));
let demoStore;
function demoDate(offset = 0) { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
function seedDemo() {
  const today = demoDate();
  const students = {};
  for (const [index, id, name, theme, grade] of [[0,'demo-k','ㄎㄎ','babymonster','五'],[1,'demo-h','哈哈','zoro','二']]) {
    const completions = {}, moodLog = {};
    for(let n=1;n<24;n++){ completions[demoDate(-n)]=['read','bag','move'];moodLog[demoDate(-n)]='happy'; }
    students[id] = {name,order:index,grade,schoolName:'示範國小',className:index?'201':'501',seatNumber:'',color:index?'#13856d':'#855dd6',themeId:theme,
      xpFromTasks: index?1450:2700,ruleBonusTotal:120,
      streak:{count:index?12:23,best:index?16:23,totalDays:index?35:68,lastCheckInDate:demoDate(-1),shields:1},
      dailyTasks:[{id:'read',name:'閱讀 15 分鐘',icon:'📚',xpReward:15,days:[]},{id:'bag',name:'整理明天的書包',icon:'🎒',xpReward:10,days:[]},{id:'move',name:'運動與伸展',icon:'🏃',xpReward:15,days:[]}],
      dailyTaskCompletions:completions,moodLog,moodStreakBest:23,badges:{s_first:demoDate(-30),s_3:demoDate(-27),s_7:demoDate(-20)},
      rules:[{id:'arrival',name:'準時出門',type:'punctuality',enabled:true,config:{deadlineTime:'07:30',multiplier:10}}],arrivalLog:{},ruleViolations:[],lastRuleSettlementMs:Date.now(),
      ruleSettlements:[{id:'demo-week',periodStart:demoDate(-10)+' 18:00',periodEnd:demoDate(-3)+' 18:00',periodStartMs:Date.now()-864000000,periodEndMs:Date.now()-259200000,computedAt:demoDate(-3),netJumpingJacks:-120,punishmentCount:0,bonusAmount:12,bonusStatus:'pending',settledViolationIds:[]}],
      wishlist:[{id:'wish-1',name:index?'寶可夢卡牌收藏冊':'喜歡的專輯收藏',amount:1500,status:'inProgress',condition:'把每天的小努力，累積成喜歡的禮物。'}]};
  }
  const examRecords={};
  for(const id of Object.keys(students)) for(let i=0;i<4;i++) examRecords[`${id}-${i}`]={studentId:id,date:demoDate(-7-i*20),semester:`${students[id].grade}上`,examType:i?'小考':'期中',ruleProfileId:'demo-default',subjects:['國語','數學','英文'].map((name,j)=>({name,score:Math.min(100,94-i*2+j),prevScore:89-i+j})),bonusStatus:i?'done':'pending',punishmentStatus:'done',note:'示範資料',createdAt:Date.now()};
  return {students,examRecords,ruleProfiles:{'demo-default':{...defaultRules(),name:'家庭預設',createdAt:1}},config:{settings:{defaultProfileId:'demo-default',dashboardTitle:'我們家的成長日記',fontScale:'md',parentPin:'1234'},chartSettings:{yMin:60,yMax:100,xCount:5,showPointLabels:true},subjectPresets:{二:['國語','數學','英文'],五:['國語','數學','英文','自然','社會']}}};
}
function storeDemo(){if(!demoStore){try {demoStore=JSON.parse(localStorage.getItem(DEMO_KEY));}catch{} if(!demoStore)demoStore=seedDemo();}return demoStore;}
function persistDemo(){localStorage.setItem(DEMO_KEY,JSON.stringify(demoStore));}
function snap(id,data){return {id,exists:!!data,data:()=>clone(data)};}
function assignDemo(target,fields){for(const [path,value] of Object.entries(fields)){const parts=path.split('.');let at=target;for(const p of parts.slice(0,-1))at=at[p]??={};const key=parts.at(-1);if(value?.__op==='delete')delete at[key];else if(value?.__op==='arrayUnion')at[key]=[...(at[key]||[]),...value.values];else at[key]=clone(value);}}
const db={collection(name){
  const doc=id=>({id,async get(){return snap(id,storeDemo()[name]?.[id]);},async set(data,options){const c=storeDemo()[name]??={};if(!options?.merge)c[id]={};c[id]??={};assignDemo(c[id],data);persistDemo();},async update(data){return this.set(data,{merge:true});},async delete(){delete(storeDemo()[name]||{})[id];persistDemo();}});
  const query=(filters=[],sort=[])=>({doc,where:(k,op,v)=>query([...filters,[k,op,v]],sort),orderBy:(k,dir)=>query(filters,[k,dir]),async get(){let rows=Object.entries(storeDemo()[name]||{}).filter(([,d])=>filters.every(([k,op,v])=>op==='=='&&d[k]===v));if(sort.length)rows.sort((a,b)=>((a[1][sort[0]]>b[1][sort[0]])?1:-1)*(sort[1]==='desc'?-1:1));return {docs:rows.map(([id,d])=>snap(id,d)),empty:!rows.length};},async add(data){const id=crypto.randomUUID();await doc(id).set(data);return {id};}});return query();
}};
const auth={currentUser:{email:'preview@example.invalid',displayName:'預覽家長'},signOut:async()=>{location.href='login.html';}};
const firebase={firestore:{FieldValue:{serverTimestamp:()=>Date.now(),delete:()=>({__op:'delete'}),arrayUnion:(...values)=>({__op:'arrayUnion',values})}}};
async function requireGuard(){return auth.currentUser;}
async function requireParentPin(){return true;}
document.addEventListener('DOMContentLoaded',()=>{
  const banner=document.createElement('div');banner.className='preview-notice';banner.innerHTML='<span><b>設計預覽</b> · 示範資料，操作不影響正式網站</span><button type="button">重設</button>';
  banner.querySelector('button').onclick=()=>{localStorage.removeItem(DEMO_KEY);location.reload();};document.body.prepend(banner);document.body.classList.add('is-preview');
  const email=document.getElementById('sidebarUserEmail');if(email)email.textContent='預覽家長';
  for(const id of ['logoutBtn','kidLogoutBtn']){const b=document.getElementById(id);if(b)b.onclick=()=>{location.href='login.html';};}
});
