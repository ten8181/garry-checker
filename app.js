const KEY = "garry-check:sheet-status:v1";
const WD = ["日","月","火","水","木","金","土"];
let data = {categories: [], items: []};
let state = load();
let filter = "all";
let dataLoadFailed=false;

function load(){
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.version === 1) return s; } catch(e) {}
  return {version: 1, items: {}};
}
function save(){ try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { toast("端末に保存できません。バックアップを書き出してください"); } }
function rec(id){ return state.items[id] ||= {status: 0, memo: ""}; }

// JSTの年月日・時分を取り出す
function jst(iso){
  const d = new Date(new Date(iso).getTime() + 9*3600e3);
  return {y: d.getUTCFullYear(), m: d.getUTCMonth()+1, d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), wd: d.getUTCDay()};
}
// TVだけ日本時間の朝5時で放送日を切り替える。
function dayKey(t) { return `${t.y}-${String(t.m).padStart(2,'0')}-${String(t.d).padStart(2,'0')}`; }
function todayKey(category, now=new Date()) {
  return dayKey(jst(new Date(now.getTime() - (category==='tv' ? 5*3600e3 : 0))));
}
function broadcast(item){
  if (item.allDay) {
    const [y,m,d]=item.start.split('-').map(Number);
    return {key:item.start,y,m,d,wd:new Date(Date.UTC(y,m-1,d)).getUTCDay(),label:null};
  }
  const t=jst(item.start), late=item.category==='tv' && t.h<5;
  const b=late ? jst(new Date(new Date(item.start).getTime()-86400e3)) : t;
  return {key:dayKey(b),y:b.y,m:b.m,d:b.d,wd:b.wd,label:`${t.h+(late?24:0)}:${String(t.mi).padStart(2,'0')}`};
}
const visibleLimits={past:5,future:5,archive:5};
let archiveOpen=false;
function itemBucket(it, now=new Date()) {
  const key=broadcast(it).key, today=todayKey(it.category,now);
  if(key===today)return 'today';
  if(key>today)return 'future';
  return isDone(it)?'archive':'past';
}
function categoryIcon(id) {
  if (id === 'tv') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 3 4 4 4-4M6 21h12"/><rect x="3" y="7" width="18" height="12" rx="3"/></svg>';
  if (id === 'magazine') return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v15M3 4c3-1 6-1 9 1 3-2 6-2 9-1v15c-3-1-6-1-9 1-3-2-6-2-9-1Z"/></svg>';
  return '';
}
const cat = id => data.categories.find(c => c.id === id) || {name: id, statuses: ["まだだお", "完了"]};
const isDone = it => rec(it.id).status === cat(it.category).statuses.length - 1;
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

// Explicit offsets only: avoid interpreting a sheet timestamp in each visitor's timezone.
const NEW_WINDOW_MS = 24 * 60 * 60 * 1000;
function addedTimestamp(value) {
  const text=String(value ?? '').trim();
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(text))return NaN;
  return Date.parse(text);
}
function isNewItem(it, now=Date.now()) {
  const added=addedTimestamp(it.addedAt), age=now-added;
  return Number.isFinite(added)&&age>=0&&age<NEW_WINDOW_MS;
}
function updateNewBadges() {
  const byId=new Map(data.items.map(it=>[it.id,it]));
  document.querySelectorAll('[data-new-for]').forEach(el=>{
    const it=byId.get(el.dataset.newFor);
    el.hidden=!it||!isNewItem(it);
  });
}
function cardHTML(it, b){
  const c=cat(it.category), r=rec(it.id);
  return `<article class="card sticker ${isDone(it)?'done':''}" data-item="${esc(it.id)}">
    <div class="cardHead"><div class="ttl">${esc(it.title)} <span class="newBadge" data-new-for="${esc(it.id)}" ${isNewItem(it)?'':'hidden'} aria-label="追加から24時間以内">NEW</span></div><div class="badges"><span class="tag ${it.category==='tv'?'tagTv':it.category==='magazine'?'tagMagazine':''}">${categoryIcon(it.category)}${esc(c.name)}</span></div></div>
    ${b.label||it.detail?`<div class="cardInfo">${b.label?`<div class="airTime">${esc(b.label)}</div>`:''}${it.detail?`<p class="det">${esc(it.detail)}</p>`:''}</div>`:''}
    <div class="tasks">${c.statuses.map((t,slot)=>`<button class="chip" data-id="${esc(it.id)}" data-status="${slot}" aria-pressed="${r.status===slot}">${esc(t)}</button>`).join('')}</div>
    <div class="acts"><button class="memo" data-memo="${esc(it.id)}"><svg class="memoIcon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 4H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6M8 16h4M8 12h2"/><path d="m12 11 7-7a1.4 1.4 0 0 1 2 2l-7 7-3 1 1-3Zm5-5 2 2"/></svg>${r.memo?'メモを編集':'メモを書く'}</button>${r.memo.trim()?`<button class="memo shareMemoLink" data-share-memo="${esc(it.id)}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 16V3m-4 4 4-4 4 4M6 11H4v10h16V11h-2"/></svg>メモを共有</button>`:''}${it.url?`<a class="link" href="${esc(it.url)}" target="_blank" rel="noopener">公式のお知らせ</a>`:''}</div>
    ${r.memo?`<div class="memoPrev">${esc(r.memo)}</div>`:''}
  </article>`;
}
function rowsHTML(rows){
  let html='',day='';
  for(const {it,b} of rows){
    if(b.key!==day){day=b.key;html+=`<div class="day"><span class="dateLabel">${b.m}/${b.d}（${WD[b.wd]}）</span></div>`;}
    html+=cardHTML(it,b);
  }
  return html;
}
function render(){
  const now=new Date();
  const tabs=[{id:'all',name:'すべて'},...data.categories.slice().sort((a,b)=>a.order-b.order)];
  document.getElementById('tabs').innerHTML=tabs.map(t=>`<button class="tab" data-tab="${esc(t.id)}" aria-pressed="${filter===t.id}">${categoryIcon(t.id)}${esc(t.name)}</button>`).join('');
  const selected=data.items.filter(it=>filter==='all'||it.category===filter);
  const done=selected.filter(isDone).length;
  document.getElementById('progressText').textContent=`完了 ${done} / ${selected.length}件`;
  document.getElementById('progressBar').style.width=selected.length?`${done/selected.length*100}%`:'0%';
  const groups={today:[],past:[],future:[],archive:[]};
  const onlyTodo=document.getElementById('onlyTodo').checked;
  selected.forEach(it=>{
    const bucket=itemBucket(it,now);
    if(onlyTodo&&isDone(it))return;
    groups[bucket].push({it,b:broadcast(it)});
  });
  const compare=(a,b)=>a.b.key.localeCompare(b.b.key)||a.it.start.localeCompare(b.it.start)||a.it.id.localeCompare(b.it.id);
  for(const key of ['today','past','future'])groups[key].sort(compare);
  groups.archive.sort((a,b)=>-compare(a,b));
  const section=(key,title,empty)=>{
    const rows=groups[key], limit=key==='today'?rows.length:visibleLimits[key];
    return `<section class="scheduleSection ${key==='today'?'todaySection':''}" data-section="${key}" aria-labelledby="heading-${key}">
      <h2 class="sectionTitle" id="heading-${key}">${title}<span class="sectionCount">${rows.length}件</span></h2>
      ${key==='today'?'<p class="dayRule">TVは朝5時、雑誌は午前0時に切り替わります。</p>':''}
      ${rows.length?rowsHTML(rows.slice(0,limit)):`<p class="sectionEmpty ${key==='today' && empty==='今日はおやすみだおー'?'dayoff':''}">${empty}</p>`}
      ${rows.length>limit?`<button class="moreLink quietLink" data-more="${key}">もっと見る（残り${rows.length-limit}件）</button>`:''}
    </section>`;
  };
  const unavailable=dataLoadFailed&&!data.items.length;
  let html=section('today','今日のGarry',unavailable?'情報を読み込めませんでした。':onlyTodo?'今日の未完了の情報はありません。':'今日はおやすみだおー');
  html+=section('past','過去のGarry',unavailable?'情報を読み込めませんでした。':'過去の未確認情報はありません。');
  html+=section('future','未来のGarry',unavailable?'情報を読み込めませんでした。':'今後の予定は登録されていません。');
  if(groups.archive.length)html+=`<details class="archiveSection" ${archiveOpen?'open':''}><summary>完了した過去の記録（${groups.archive.length}件）</summary>${rowsHTML(groups.archive.slice(0,visibleLimits.archive))}${groups.archive.length>visibleLimits.archive?`<button class="quietLink" data-more="archive">もっと見る（残り${groups.archive.length-visibleLimits.archive}件）</button>`:''}</details>`;
  document.getElementById('list').innerHTML=html;
  const archive=document.querySelector('.archiveSection');if(archive)archive.addEventListener('toggle',()=>{archiveOpen=archive.open;});
  document.getElementById('updatedAt').textContent=data.updatedAt?new Date(data.updatedAt).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';
  document.querySelector('.updatedMeta').hidden=!data.updatedAt;
}

function toast(msg){ const t = document.getElementById("toast"); t.textContent = msg; t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => t.hidden = true, 2200); }

document.addEventListener("click", e => {
  const share=e.target.closest('[data-share-memo]');
  if(share){openMemoExport(share.dataset.shareMemo);return;}
  const more=e.target.closest('[data-more]');
  if(more){visibleLimits[more.dataset.more]+=5;render();return;}
  const tab = e.target.closest("[data-tab]");
  if (tab) { filter = tab.dataset.tab; visibleLimits.past=5;visibleLimits.future=5;visibleLimits.archive=5;render(); return; }
  const chip = e.target.closest(".chip");
  if (chip) { const r = rec(chip.dataset.id); r.status = Number(chip.dataset.status); r.updatedAt = new Date().toISOString(); save(); render(); return; }
  const m = e.target.closest("[data-memo]");
  if (m) openMemo(m.dataset.memo);
});
document.getElementById("onlyTodo").addEventListener("change", render);

const dlg = document.getElementById("memoDlg"), ta = document.getElementById("memoText");
let memoId = null;
function openMemo(id){
  memoId = id;
  document.getElementById("memoTitle").textContent = data.items.find(i => i.id === id).title;
  ta.value = rec(id).memo || ""; dlg.returnValue = ""; updCount(); dlg.showModal();
}
function updCount(){ document.getElementById("memoCount").textContent = ta.value.length; }
ta.addEventListener("input", updCount);
dlg.addEventListener("close", () => {
  if (dlg.returnValue === "save" && memoId) { const r = rec(memoId); r.memo = ta.value.slice(0, 500); r.updatedAt = new Date().toISOString(); save(); render(); toast("メモを保存した"); }
});

document.getElementById("exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify({app: "garry-check", exportedAt: new Date().toISOString(), ...state}, null, 2)], {type: "application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `garry-check-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click(); URL.revokeObjectURL(a.href);
  document.getElementById("backupDlg").close(); toast("バックアップを書き出した");
});
document.getElementById("importFile").addEventListener("change", async e => {
  const f = e.target.files[0]; if (!f) return;
  try {
    const j = JSON.parse(await f.text());
    if (j.app !== "garry-check" || j.version !== 1 || !j.items || Array.isArray(j.items) || typeof j.items !== "object") throw 0;
    const clean = {};
    for (const [id, r] of Object.entries(j.items)) {
      if (!id.startsWith("sheet:") || !r || !Number.isInteger(r.status) || r.status < 0 || r.status > 3 || typeof r.memo !== "string") throw 0;
      clean[id] = {status: r.status, memo: r.memo.slice(0,500)};
    }
    if (!confirm("今のチェックとメモを、バックアップの内容で上書きする？")) return;
    state = {version: 1, items: clean}; save(); render(); document.getElementById("backupDlg").close(); toast("読み込んだ");
  } catch { toast("このファイルは読み込めない"); }
  e.target.value = "";
});


const SETTINGS = 'garry-check:sheet-settings:v1';
const SNAPSHOT = 'garry-check:sheet-status-snapshot:v1';
let config = {}, settings = {}, refreshing = false;
function sheetId(url) {
  const u = new URL(url);
  const m = u.pathname.match(/^\/spreadsheets\/d\/([A-Za-z0-9_-]+)(?:\/|$)/);
  if (u.protocol !== 'https:' || u.hostname !== 'docs.google.com' || !m) throw new Error('Googleスプレッドシートの共有URLを入力してください');
  return m[1];
}
function sourceKey(s) { return sheetId(s.sheetUrl) + ':' + (s.sheetName || ''); }
function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '');
  const rows = []; let row = [], value = '', quoted = false;
  for (let i=0; i<text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i+1] === '"') { value += '"'; i++; }
      else if (quoted || value === '') quoted = !quoted;
      else value += c;
    } else if (c === ',' && !quoted) { row.push(value); value = ''; }
    else if ((c === '\n' || c === '\r') && !quoted) {
      if (c === '\r' && text[i+1] === '\n') i++;
      row.push(value); if (row.some(v => v.trim())) rows.push(row); row = []; value = '';
    } else value += c;
  }
  if (quoted) throw new Error('CSVの引用符が閉じていません');
  row.push(value); if (row.some(v => v.trim())) rows.push(row);
  return rows;
}
function categoryId(raw) {
  const s = raw.trim().toLowerCase();
  if (['tv','テレビ'].includes(s)) return 'tv';
  if (['雑誌','magazine'].includes(s)) return 'magazine';
  if (['live','ライブ','stage','舞台'].includes(s)) return 'live';
  return 'other-' + raw.trim();
}
function convertRows(rows, s) {
  if (!rows.length) throw new Error('シートが空です');
  const head = rows[0].map(v => v.trim());
  const names = ['ID','日付','種別','タイトル','メモ'];
  const ix = names.map(n => head.indexOf(n));
  const timeIndex=head.indexOf('開始時刻');
  const addedIndex=head.indexOf('追加日時');
  if (ix.some(i => i < 0)) throw new Error('1行目に必要な列がありません：' + names.filter((n,i) => ix[i]<0).join('、'));
  const categories = (config.categories || []).map(c => ({...c, statuses:[...c.statuses]}));
  const items = [], ids = new Set();
  rows.slice(1).forEach((r, i) => {
    if (!r.some(v => v.trim())) return;
    const [id,date,type,title,detail] = ix.map(j => String(r[j] ?? '').trim());
    if (!id || !title || !type) throw new Error(`${i+2}行目：ID・種別・タイトルは必須です`);
    if (ids.has(id)) throw new Error(`${i+2}行目：ID「${id}」が重複しています`);
    ids.add(id);
    const m = date.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
    if (!m) throw new Error(`${i+2}行目：日付はYYYY/MM/DDで入力してください`);
    const d = new Date(Date.UTC(+m[1], +m[2]-1, +m[3]));
    if (d.getUTCFullYear()!==+m[1] || d.getUTCMonth()!==+m[2]-1 || d.getUTCDate()!==+m[3]) throw new Error(`${i+2}行目：存在しない日付です`);
    const category = categoryId(type);
    if (!categories.some(c => c.id===category)) categories.push({id:category,name:type,order:categories.length+10,statuses:['まだだお','完了']});
    const dateKey=`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
    const rawTime=timeIndex<0?'':String(r[timeIndex]??'').trim();
    let start=dateKey, allDay=true;
    if(rawTime){
      const tm=rawTime.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
      if(!tm||+tm[1]>23||+tm[2]>59)throw new Error(`${i+2}行目：開始時刻は実時刻の00:00〜23:59で入力してください`);
      start=dateKey+'T'+tm[1].padStart(2,'0')+':'+tm[2]+':00+09:00';allDay=false;
    }
    const addedAt=addedIndex<0?'':String(r[addedIndex]??'').trim();
    items.push({id:'sheet:'+sourceKey(s)+':'+id,category,title,start,allDay,detail,addedAt});
  });
  return {categories:categories.filter(c => items.some(it=>it.category===c.id)),items,updatedAt:new Date().toISOString()};
}
async function getRows(s) {
  const base = `https://docs.google.com/spreadsheets/d/${sheetId(s.sheetUrl)}/gviz/tq`;
  const params = new URLSearchParams({tqx:'out:csv',headers:'1',nocache:String(Date.now())});
  if (s.sheetName) params.set('sheet',s.sheetName);
  try {
    if (location.protocol === 'file:') throw new TypeError('Use public JSONP for local preview');
    const res = await fetch(base+'?'+params,{cache:'no-store',signal:AbortSignal.timeout(15000)});
    if (!res.ok) throw new Error('HTTP '+res.status+'：シートの共有設定を確認してください');
    const text = await res.text();
    if (/^\s*</.test(text)) throw new Error('公開シートを取得できません。共有設定を確認してください');
    return parseCSV(text);
  } catch (e) {
    if (!(e instanceof TypeError) && !['TimeoutError','AbortError'].includes(e.name)) throw e;
    // CORSで取得できない場合も、GoogleのJSONPから同じ公開データを読み取る。
    return new Promise((resolve,reject) => {
      const cb = '__garrySheet'+Math.random().toString(36).slice(2);
      const script = document.createElement('script');
      const cleanup = () => {clearTimeout(timer); script.remove(); delete window[cb];};
      const timer = setTimeout(()=>{cleanup();reject(new Error('読み込みがタイムアウトしました。通信と共有設定を確認してください'));},15000);
      window[cb] = payload => {
        cleanup();
        if (payload.status!=='ok' || !payload.table) { reject(new Error('シートを読み込めません。URL・シート名・共有設定を確認してください')); return; }
        const t = payload.table;
        resolve([t.cols.map(c=>c.label || ''), ...t.rows.map(r => t.cols.map((c,i) => {
          const cell = r.c[i]; if (!cell) return '';
          if ((c.label||'').trim()==='開始時刻') {
            if(Array.isArray(cell.v))return `${String(cell.v[0]).padStart(2,'0')}:${String(cell.v[1]).padStart(2,'0')}`;
            const dt=String(cell.v).match(/^Date\(\d+,\d+,\d+,(\d+),(\d+)/);
            if(dt)return `${dt[1].padStart(2,'0')}:${dt[2].padStart(2,'0')}`;
            if(typeof cell.v==='number' && cell.v>=0 && cell.v<1){const mins=Math.round(cell.v*1440)%1440;return `${String(Math.floor(mins/60)).padStart(2,'0')}:${String(mins%60).padStart(2,'0')}`;}
          }
          if (c.type==='date') {
            const m=String(cell.v).match(/^Date\((\d+),(\d+),(\d+)/);
            if(m) return `${m[1]}/${String(+m[2]+1).padStart(2,'0')}/${m[3].padStart(2,'0')}`;
          }
          return String(cell.v ?? cell.f ?? '');
        }))]);
      };
      script.onerror=()=>{cleanup();reject(new Error('シートに接続できません。通信と共有設定を確認してください'));};
      params.set('tqx','out:json;responseHandler:'+cb);
      script.src=base+'?'+params; document.head.append(script);
    });
  }
}
function status(text) {
  const failed=text.startsWith('更新できません')||text.startsWith('初期設定を読み込めません');
  dataLoadFailed=failed;
  document.getElementById('sourceStatus').textContent=failed?(text.includes('前回取得')?'更新できませんでした。前回の情報を表示中。':'情報を読み込めませんでした。'):(text?'読み込み中…':'');
  const details=document.getElementById('fetchDetails');details.hidden=!failed;details.open=false;
  document.getElementById('fetchDetailText').textContent=failed?text:'';
}
async function refresh() {
  if (refreshing) return;
  refreshing=true; const button=document.getElementById('refreshBtn'); button.disabled=true;
  status('スプレッドシートから読み込み中…');
  try {
    const fresh=convertRows(await getRows(settings),settings);
    data=fresh;
    try {localStorage.setItem(SNAPSHOT,JSON.stringify({source:sourceKey(settings),data}));} catch {}
    if (!data.categories.some(c=>c.id===filter)) filter='all';
    status('');
  } catch(e) {
    let cached=null;
    try {cached=JSON.parse(localStorage.getItem(SNAPSHOT));} catch {}
    if(cached?.source===sourceKey(settings)) {
      data=cached.data;
      // Use current status labels even when the previous snapshot came from an older version.
      data.categories=data.categories.map(c => config.categories.find(x=>x.id===c.id) || c);
    }
    status(`更新できません：${e.message}。${data.items.length?'前回取得した情報を表示中です。':'出演情報は表示していません。'}`);
  } finally {render();button.disabled=false;refreshing=false;}
}
document.getElementById('refreshBtn').addEventListener('click',refresh);
const backupDlg=document.getElementById('backupDlg');
document.getElementById('backupBtn').addEventListener('click',()=>backupDlg.showModal());
document.getElementById('closeBackup').addEventListener('click',()=>backupDlg.close());
const settingsDlg=document.getElementById('settingsDlg');
document.getElementById('settingsBtn')?.addEventListener('click',()=>{
  document.getElementById('sheetUrl').value=settings.sheetUrl;
  document.getElementById('sheetName').value=settings.sheetName || '';
  document.getElementById('settingsError').textContent='';settingsDlg.showModal();
});
document.getElementById('closeSettings').addEventListener('click',()=>settingsDlg.close());
document.getElementById('settingsForm').addEventListener('submit',async e=>{
  e.preventDefault();
  const button=document.getElementById('saveSettings'); button.disabled=true;
  const error=document.getElementById('settingsError'); error.textContent='接続を確認中…';
  try {
    const s={sheetUrl:document.getElementById('sheetUrl').value.trim(),sheetName:document.getElementById('sheetName').value.trim()};
    const fresh=convertRows(await getRows(s),s);
    localStorage.setItem(SETTINGS,JSON.stringify(s));
    settings=s;data=fresh;filter='all';
    try {localStorage.setItem(SNAPSHOT,JSON.stringify({source:sourceKey(s),data}));} catch {}
    status('');render();settingsDlg.close();toast('接続して保存しました');
  }catch(e){error.textContent=e.message;}finally{button.disabled=false;}
});
async function init(){
  try {
    config=JSON.parse(document.getElementById('appConfig').textContent);
    settings={sheetUrl:config.sheetUrl,sheetName:config.sheetName || ''};
    try {const saved=JSON.parse(localStorage.getItem(SETTINGS));if(saved){sheetId(saved.sheetUrl);settings=saved;}}catch{}
    sheetId(settings.sheetUrl); await refresh();
  }catch(e){status('初期設定を読み込めません：'+e.message+'。初期設定を確認してください。');render();}
  if('serviceWorker' in navigator && location.protocol!=='file:') navigator.serviceWorker.register('sw.js').catch(()=>{});
}
init();
let lastDaySignature=todayKey('tv')+'|'+todayKey('magazine');
setInterval(()=>{const signature=todayKey('tv')+'|'+todayKey('magazine');if(signature!==lastDaySignature){lastDaySignature=signature;render();}else{updateNewBadges();}},1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)render();});

// Readable memo export is separate from the unchanged JSON backup format.
const memoExportDlg=document.getElementById('memoExportDlg');
const memoExportPreview=document.getElementById('memoExportPreview');
let memoExportPayload=null;
function memoEntryText(it) {
  const b=broadcast(it), r=rec(it.id), c=cat(it.category);
  const date=`${b.y}/${String(b.m).padStart(2,'0')}/${String(b.d).padStart(2,'0')}`;
  return `${it.title}\n${date}${b.label?' '+b.label:''}\n種別：${c.name}\n状態：${c.statuses[r.status]??c.statuses[0]}\n\nメモ：\n${r.memo.trim()}`;
}
function makeMemoExport(id=null) {
  const items=data.items.filter(it=>(id===null||it.id===id)&&rec(it.id).memo.trim());
  items.sort((a,b)=>broadcast(a).key.localeCompare(broadcast(b).key)||a.start.localeCompare(b.start)||a.id.localeCompare(b.id));
  return {count:items.length,text:items.map(memoEntryText).join('\n\n────────────\n\n')+(items.length?'\n\n— Garry’s Checker':''),title:id&&items[0]?items[0].title+' — Garry’s Checker':'Garry’s Checker メモ'};
}
function openMemoExport(id=null) {
  const payload=makeMemoExport(id);
  if(!payload.count){toast('保存済みのメモがありません');return;}
  memoExportPayload=payload;
  memoExportPreview.value=payload.text;
  document.getElementById('memoExportTitle').textContent=id?'メモを共有':'メモを共有・コピー';
  document.getElementById('memoExportHint').textContent=id?'この項目の保存済みメモを書き出します。':`読み込み済みの情報から、メモのある${payload.count}件を日付順に書き出します。画面の絞り込みは適用しません。`;
  document.getElementById('memoExportStatus').textContent='';
  document.getElementById('shareMemoBtn').hidden=typeof navigator.share!=='function';
  if(typeof navigator.share!=='function')document.getElementById('memoExportStatus').textContent='このブラウザでは共有メニューを使えません。「文章をコピー」で、保存先のアプリに貼り付けてください。';
  memoExportDlg.showModal();
}
document.getElementById('memoExportBtn').addEventListener('click',()=>openMemoExport());
document.getElementById('closeMemoExport').addEventListener('click',()=>memoExportDlg.close());
document.getElementById('shareMemoBtn').addEventListener('click',async()=>{
  if(!memoExportPayload)return;
  // Called directly from a user click so iOS retains transient activation.
  try{
    await navigator.share({title:memoExportPayload.title,text:memoExportPayload.text});
    document.getElementById('memoExportStatus').textContent='共有先へ渡しました。保存・送信の完了は共有先で確認してください。';
  }catch(e){
    if(e.name==='AbortError'){document.getElementById('memoExportStatus').textContent='共有をキャンセルしました。';return;}
    document.getElementById('memoExportStatus').textContent='共有できませんでした。「文章をコピー」で、保存先のアプリに貼り付けてください。';
  }
});
document.getElementById('copyMemoBtn').addEventListener('click',async()=>{
  if(!memoExportPayload)return;
  try{
    if(!navigator.clipboard?.writeText)throw new Error('Clipboard unavailable');
    await navigator.clipboard.writeText(memoExportPayload.text);
    document.getElementById('memoExportStatus').textContent='コピーしました。保存先に貼り付けてください。';
  }catch{
    memoExportPreview.focus();memoExportPreview.select();memoExportPreview.setSelectionRange(0,memoExportPreview.value.length);
    document.getElementById('memoExportStatus').textContent='コピーを許可できませんでした。選択した文章を長押しなどでコピーしてください。';
  }
});

// Static, local help content: never reads or modifies personal progress/memos.
const helpDialog=document.getElementById('helpDlg');
const helpButton=document.getElementById('helpBtn');
helpButton.addEventListener('click',()=>{
  if(helpDialog.open)return;
  helpDialog.showModal();
  document.documentElement.classList.add('helpModalOpen');
  helpDialog.querySelector('.helpBody').scrollTop=0;
});
helpDialog.querySelectorAll('.helpClose').forEach(button=>{
  button.addEventListener('click',()=>helpDialog.close());
});
helpDialog.addEventListener('close',()=>{
  document.documentElement.classList.remove('helpModalOpen');
  helpButton.focus({preventScroll:true});
});

// Usage notice: static text only; never touches private progress or memos.
const termsDialog=document.getElementById('termsDlg');
const termsButton=document.getElementById('termsBtn');
termsButton.addEventListener('click',()=>{
  if(termsDialog.open)return;
  termsDialog.showModal();
  document.documentElement.classList.add('helpModalOpen');
  termsDialog.querySelector('.helpBody').scrollTop=0;
});
termsDialog.querySelectorAll('.termsClose').forEach(button=>button.addEventListener('click',()=>termsDialog.close()));
termsDialog.addEventListener('close',()=>{
  document.documentElement.classList.remove('helpModalOpen');
  termsButton.focus({preventScroll:true});
});
