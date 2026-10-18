/* Responsive parent navigation, shared across every management page. */
document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar || document.body.classList.contains('kid-app')) return;
  sidebar.id = 'workspace-navigation';
  const header = document.createElement('header');
  header.className = 'workspace-header';
  header.innerHTML = '<button type="button" aria-controls="workspace-navigation" aria-expanded="false">☰ 選單</button><strong>家庭管理</strong><a class="btn" href="app.html">孩子模式</a>';
  document.body.insertBefore(header, document.querySelector('.app-shell'));
  const backdrop = document.createElement('div'); backdrop.className = 'workspace-backdrop'; document.body.append(backdrop);
  const close = document.createElement('button');close.className='workspace-close';close.textContent='關閉選單 ×';sidebar.prepend(close);
  const trigger=header.querySelector('button');
  function setOpen(open){document.body.classList.toggle('workspace-menu-open',open);trigger.setAttribute('aria-expanded',String(open));if(open)close.focus();else trigger.focus();}
  matchMedia('(min-width:901px)').addEventListener('change',e=>{if(e.matches&&document.body.classList.contains('workspace-menu-open'))setOpen(false);});
  trigger.onclick=()=>setOpen(true);close.onclick=()=>setOpen(false);backdrop.onclick=()=>setOpen(false);
  document.addEventListener('keydown',e=>{if(!document.body.classList.contains('workspace-menu-open'))return;if(e.key==='Escape')setOpen(false);if(e.key==='Tab'){const all=[...sidebar.querySelectorAll('a,button,input,select')].filter(x=>x.getClientRects().length);const first=all[0],last=all.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
  const quick=document.createElement('button');quick.className='btn btn-primary';quick.textContent='＋ 登記事項';quick.onclick=()=>{setOpen(false);openQuickViolationModal();};sidebar.insertBefore(quick,sidebar.querySelector('.sidebar-footer'));
  const observer=new MutationObserver(()=>{document.querySelectorAll('.table-wrap').forEach(el=>{el.tabIndex=0;el.setAttribute('role','region');el.setAttribute('aria-label','資料表，可左右捲動查看完整欄位');});});observer.observe(document.querySelector('main')||document.body,{childList:true,subtree:true});
});
