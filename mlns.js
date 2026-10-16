/* Tab "Tra cứu MLNS": nạp dữ liệu khi bấm tab lần đầu, không ảnh hưởng các tab cũ */
(function(){
"use strict";
const ROOT=document.getElementById('mlns'), TAB=document.getElementById('tabMlns');
if(!ROOT||!TAB)return;
const tabs=[...document.querySelectorAll('.tabs .tab')];
const hideIds=[document.querySelector('.top-bar'),document.querySelector('.table-wrapper')].filter(Boolean);
const KEYS=['backgroundColor','color','borderTopWidth','borderTopStyle','borderTopColor','borderRadius','paddingTop','paddingRight','paddingBottom','paddingLeft','fontSize','fontWeight','fontFamily','lineHeight','boxShadow'];
const snap=el=>{if(!el)return null;const cs=getComputedStyle(el),o={};KEYS.forEach(k=>o[k]=cs[k]);return o};
const sOn=snap(document.querySelector('.tabs .tab.active')||tabs[0]);
const sOff=snap(tabs.find(t=>!t.classList.contains('active')));
function paint(on){const s=on?sOn:sOff;TAB.style.cursor='pointer';if(!s)return;KEYS.forEach(k=>TAB.style[k]=s[k]);
  TAB.style.borderTop=s.borderTopWidth+' '+s.borderTopStyle+' '+s.borderTopColor;TAB.style.border=TAB.style.borderTop}
paint(false);
let started=false;
function boot(RAW){

/* ================= TIỆN ÍCH ================= */
const ICONS={
  search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  x:'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  copy:'<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  chev:'<path d="m9 18 6-6-6-6"/>',
  tree:'<path d="M21 12h-8"/><path d="M21 6H8"/><path d="M21 18h-8"/><path d="M3 6v4c0 1.1.9 2 2 2h3"/><path d="M3 10v6c0 1.1.9 2 2 2h3"/>',
  landmark:'<line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/>',
  layers:'<path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  target:'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  fold:'<path d="m7 20 5-5 5 5"/><path d="m7 4 5 5 5-5"/>',
  unfold:'<path d="m7 15 5 5 5-5"/><path d="m7 9 5-5 5 5"/>',
  moon:'<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  locate:'<circle cx="12" cy="12" r="3"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="M2 12h4"/><path d="M18 12h4"/>',
  clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'
};
const ic=n=>'<svg class="i" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(ICONS[n]||'')+'</svg>';
ROOT.querySelectorAll('[data-i]').forEach(e=>{e.outerHTML=ic(e.dataset.i)});
const $=id=>document.getElementById('mlns-'+id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>Number(n).toLocaleString('vi-VN');
const store={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};

/* chuẩn hoá tiếng Việt: giữ nguyên độ dài chuỗi để tô đậm đúng vị trí */
const MARKS=/[\u0300-\u036f]/g, CH=new Map();
function nch(c){let r=CH.get(c);if(r!==undefined)return r;
  if(c==='đ'||c==='Đ')r='d';else{r=c.normalize('NFD').replace(MARKS,'').toLowerCase();r=r.length===1?r:(r[0]||' ')}
  CH.set(c,r);return r}
function norm(s){s=String(s||'');let o='';for(let i=0;i<s.length;i++)o+=nch(s[i]);return o}
const isAN=c=>(c>='a'&&c<='z')||(c>='0'&&c<='9');
function words(nn){const out=[];let st=-1;for(let i=0;i<=nn.length;i++){const a=i<nn.length&&isAN(nn[i]);if(a&&st<0)st=i;else if(!a&&st>=0){out.push([st,i]);st=-1}}return out}
function wordStart(h,t){if(!t)return false;let i=h.indexOf(t);while(i>=0){if(i===0||!isAN(h[i-1]))return true;i=h.indexOf(t,i+1)}return false}
function lev(a,b,max){
  if(Math.abs(a.length-b.length)>max)return max+1;
  const m=a.length,n=b.length,d=[];
  for(let i=0;i<=m;i++){d[i]=new Array(n+1).fill(0);d[i][0]=i}
  for(let j=0;j<=n;j++)d[0][j]=j;
  for(let i=1;i<=m;i++){let best=Infinity;
    for(let j=1;j<=n;j++){const c=a[i-1]===b[j-1]?0:1;
      let v=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+c);
      if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])v=Math.min(v,d[i-2][j-2]+1);
      d[i][j]=v;if(v<best)best=v}
    if(best>max)return max+1}
  return d[m][n];
}

/* chữ viết tắt hay dùng trong nghiệp vụ */
const ABBR={tncn:'thu nhap ca nhan',tndn:'thu nhap doanh nghiep',gtgt:'gia tri gia tang',vat:'gia tri gia tang',ttdb:'tieu thu dac biet',bvmt:'bao ve moi truong',
  sdd:'su dung dat',sddpnn:'su dung dat phi nong nghiep',sddnn:'su dung dat nong nghiep',pnn:'phi nong nghiep',ctmt:'chuong trinh muc tieu',ctmtqg:'chuong trinh muc tieu quoc gia',
  nsnn:'ngan sach nha nuoc',kbnn:'kho bac nha nuoc',dtpt:'dau tu phat trien',dtc:'dau tu cong',cntt:'cong nghe thong tin',cds:'chuyen doi so',khcn:'khoa hoc cong nghe',
  dmst:'doi moi sang tao',ubnd:'uy ban nhan dan',hdnd:'hoi dong nhan dan',bhxh:'bao hiem xa hoi',bhyt:'bao hiem y te',bhtn:'bao hiem that nghiep',kpcd:'kinh phi cong doan',
  xdcb:'xay dung co ban',ntm:'nong thon moi',dtts:'dan toc thieu so',tdtt:'the duc the thao',xnk:'xuat khau nhap khau',tnmt:'tai nguyen moi truong',vphc:'vi pham hanh chinh',
  tsnn:'tai san nha nuoc',dnnn:'doanh nghiep nha nuoc',tpcp:'trai phieu chinh phu',tpcqdp:'trai phieu chinh quyen dia phuong',tw:'trung uong',hcsn:'hanh chinh su nghiep',
  dvsn:'don vi su nghiep',sxkd:'san xuat kinh doanh',lptb:'le phi truoc ba',tnn:'tai nguyen nuoc',tsd:'tien su dung dat',ttd:'tien thue dat',xskt:'xo so kien thiet',
  nhnn:'ngan hang nha nuoc',qdtc:'quy du tru tai chinh',oda:'oda',cbccvc:'can bo cong chuc vien chuc',ccvc:'cong chuc vien chuc',gd:'giao duc',dt:'dao tao',pccc:'phong chay chua chay',
  attt:'an toan thong tin',csdl:'co so du lieu',tmdt:'thuong mai dien tu',nld:'nguoi lao dong'};

/* ================= DỮ LIỆU ================= */

const KIND={P:'Phần',N:'Nhóm',T:'Tiểu nhóm',M:'Mục',S:'Tiểu mục',G:'Khối chương',C:'Chương',L:'Loại',K:'Khoản','1':'Chương trình, mục tiêu','2':'Tiểu chương trình, dự án','3':'Nhiệm vụ, dự án đầu tư công'};
const PARTS={thu:['Thu','c-thu'],chi:['Chi','c-chi'],vay:['Vay, trả nợ gốc','c-vay'],cn:['Chuyển nguồn','c-cn'],tam:['Tạm thu, tạm chi','c-tam']};
const SETS=[
  {id:'mt',title:'Mục – Tiểu mục',sub:'Phụ lục III',icon:'tree',col:'c-mt',unit:'mục, tiểu mục',expand:{T:1,M:1},foldK:{M:1},
   filters:[['all','Tất cả','c-ink'],['thu','Thu','c-thu'],['thu.thue','Thu thuế','c-thu'],['thu.phi','Phí, lệ phí','c-thu'],['chi','Chi','c-chi'],['vay','Vay, trả nợ gốc','c-vay'],['cn','Chuyển nguồn','c-cn'],['tam','Tạm thu, tạm chi','c-tam']]},
  {id:'ch',title:'Chương',sub:'Phụ lục I',icon:'landmark',col:'c-ch',unit:'chương',expand:{G:1},foldK:{G:1}},
  {id:'lk',title:'Loại – Khoản',sub:'Phụ lục II',icon:'layers',col:'c-lk',unit:'loại, khoản',expand:{L:1},foldK:{L:1}},
  {id:'ct',title:'Chương trình mục tiêu',sub:'Phụ lục IV',icon:'target',col:'c-ct',unit:'mã chương trình, dự án',expand:{'1':1,'2':1},foldK:{'1':1}}
];
const SET={};
const VOC=new Map();    // từ chuẩn hoá -> {n: số lần, d: Map(dạng có dấu -> số lần)}
function addVoc(key,disp){let v=VOC.get(key);if(!v){v={n:0,d:new Map()};VOC.set(key,v)}v.n++;const lo=disp.toLowerCase();v.d.set(lo,(v.d.get(lo)||0)+1)}
function bestDisp(v){return [...v.d.entries()].sort((a,b)=>b[1]-a[1]).slice(0,2).map(x=>x[0]).join(' / ')}
SETS.forEach(s=>{
  const N=RAW[s.id]||[];
  N.forEach((n,i)=>{
    n.i=i;n.set=s.id;n.ch=[];n.c=n.c||'';n.n=n.n||'';n.cl=n.c.toLowerCase();n.nn=norm(n.n);n.ng=n.g?norm(n.g):'';
    n.cn=/^\d+$/.test(n.c)?parseInt(n.c,10):NaN;
    const w=words(n.nn);n.ini=w.map(([a])=>n.nn[a]).join('');
    n.wl=[];n.bl=[];
    w.forEach(([a,b],k)=>{const key=n.nn.slice(a,b);if(/^\d+$/.test(key)||key.length<2)return;const disp=n.n.slice(a,b);n.wl.push([key,disp]);addVoc(key,disp);
      const nx=w[k+1];if(nx&&n.nn.slice(b,nx[0])===' '){const k2=n.nn.slice(nx[0],nx[1]);if(!/^\d+$/.test(k2))n.bl.push([key+' '+k2,disp+' '+n.n.slice(nx[0],nx[1])])}});
    n.col=s.id==='mt'?(PARTS[(n.f||'').split('.')[0]]||PARTS.tam)[1]:s.col;
  });
  N.forEach(n=>{if(n.p>=0&&N[n.p])N[n.p].ch.push(n.i)});
  for(let i=N.length-1;i>=0;i--){const n=N[i];n.end=n.ch.length?N[n.ch[n.ch.length-1]].end:i}
  N.forEach(n=>{let a='',ac=[],p=n.p;while(p>=0){const k=N[p].k;if(k!=='P'&&k!=='N'&&k!=='G')a+=' '+N[p].nn;if(N[p].cl)ac.push(N[p].cl);p=N[p].p}n.an=a;n.ac=ac});
  s.nodes=N;
  s.isSt=n=>s.id==='mt'?(n.k==='P'||n.k==='N'||n.k==='T'):(s.id==='ch'&&n.k==='G');
  s.total=N.filter(n=>!s.isSt(n)).length;
  s.newCount=N.filter(n=>n.h).length;
  SET[s.id]=s;
});

/* ================= TRUY VẤN ================= */
/* Cú pháp: 6001 (mã hoặc đầu mã), 6000-6099 (khoảng mã), "cụm từ" (đúng cụm), -từ (loại trừ), tncn (viết tắt) */
function parseQuery(raw){
  const Q={raw:raw||'',terms:[],neg:[],words:[],last:'',lastPartial:false};
  let s=String(raw||'').replace(/[“”„″]/g,'"').slice(0,200);
  Q.lastPartial=!/\s$/.test(s)&&!/"$/.test(s);
  s=s.replace(/"([^"]*)"?/g,(m,p)=>{const v=norm(p).split(/[^a-z0-9]+/).filter(Boolean).join(' ');if(v)Q.terms.push({t:'p',v});return ' '});
  s=s.replace(/(\d{1,4})\s*(?:-|–|—|\.\.|~)\s*(\d{1,4})/g,(m,a,b)=>{let x=+a,y=+b;if(x>y){const z=x;x=y;y=z}Q.terms.push({t:'r',a:x,b:y,len:Math.max(a.length,b.length)});return ' '});
  s.split(/\s+/).forEach(piece=>{
    if(!piece)return;
    if(piece[0]==='-'&&piece.length>1){norm(piece.slice(1)).split(/[^a-z0-9]+/).filter(x=>x.length>=2).forEach(v=>Q.neg.push(v));return}
    norm(piece).split(/[^a-z0-9]+/).filter(Boolean).forEach(v=>{
      if(/^\d+$/.test(v))Q.terms.push({t:'c',v});
      else if(ABBR[v]&&ABBR[v]!==v)Q.terms.push({t:'a',v,e:ABBR[v]});
      else{Q.terms.push({t:'w',v});Q.words.push(v)}
    });
  });
  const lt=Q.terms[Q.terms.length-1];
  Q.last=Q.lastPartial&&lt&&(lt.t==='w'||lt.t==='a')?lt.v:'';
  Q.empty=!Q.terms.length;
  Q.allCode=!Q.empty&&Q.terms.every(t=>t.t==='c'||t.t==='r');
  Q.joined=Q.terms.length>1&&Q.terms.every(t=>t.t==='w')?Q.terms.map(t=>t.v).join(' '):'';
  return Q;
}
function scoreTerm(n,t){
  switch(t.t){
    case 'c':
      if(n.cl===t.v)return 120;
      if(n.cl&&n.cl.startsWith(t.v))return 70-Math.min(20,n.cl.length-t.v.length);
      if(n.ac.some(c=>c.startsWith(t.v)))return -1;
      if(t.v.length>=3&&wordStart(n.nn,t.v))return 10;
      if(t.v.length>=3&&n.ng.indexOf(t.v)>=0)return 4;
      return 0;
    case 'r':
      if(!isNaN(n.cn)&&n.c.length===t.len&&n.cn>=t.a&&n.cn<=t.b)return 60;
      return 0;
    case 'p':
      if(wordStart(n.nn,t.v))return 46;
      if(wordStart(n.ng,t.v))return 9;
      if(wordStart(n.an,t.v))return -1;
      return 0;
    case 'a':
      if(wordStart(n.nn,t.e))return 36;
      if(wordStart(n.nn,t.v))return 26;
      if(wordStart(n.ng,t.e))return 8;
      if(wordStart(n.an,t.e))return -1;
      return 0;
    default:{
      const v=t.v;
      if(wordStart(n.nn,v))return 30;
      if(v.length>=3&&n.nn.indexOf(v)>=0)return 15;
      if(v.length>=4&&n.ini.indexOf(v)>=0)return 12;
      if(v.length>=2&&wordStart(n.ng,v))return 7;
      if(v.length>=4&&n.ng.indexOf(v)>=0)return 4;
      if(wordStart(n.an,v))return -1;
      return 0;
    }
  }
}
function score(n,Q){
  for(const x of Q.neg)if(wordStart(n.nn,x))return 0;
  let s=0,own=false,strong=false,anc=false;
  for(const t of Q.terms){const v=scoreTerm(n,t);if(v===0)return 0;if(v>0){own=true;s+=v;if(v>=10)strong=true}else{anc=true;s+=2}}
  if(!own||(anc&&!strong))return 0;
  if(Q.joined){if(n.nn===Q.joined)s+=60;else if(wordStart(n.nn,Q.joined))s+=40}
  else if(Q.terms.length===1&&Q.terms[0].t==='w'&&n.nn===Q.terms[0].v)s+=40;
  if(Q.allCode)return s;
  return s+8*(1-Math.min(n.n.length,140)/140);
}

/* ================= TRẠNG THÁI ================= */
const st={view:'all',raw:'',Q:parseQuery(''),eff:null,fixNote:null,exact:false,filter:'all',onlyNew:false,
  collapsed:{mt:new Set(),ch:new Set(),lk:new Set(),ct:new Set()},sel:null,focused:false};
let recent=store.get('mlns2.recent',[]);if(!Array.isArray(recent))recent=[];recent=recent.filter(x=>typeof x==='string').slice(0,8);
const th=store.get('mlns3.theme',null);if(th==='dark'||th==='light')ROOT.dataset.theme=th;

function passFilter(set,n,f){
  if(set.id!=='mt'||f==='all')return true;
  return n.f===f||(typeof n.f==='string'&&n.f.startsWith(f+'.'));
}
/* show: 1 khớp, 2 cha (ngữ cảnh), 3 con của mục khớp */
function compute(set,Q,f){
  const N=set.nodes,L=N.length,show=new Uint8Array(L),sc=new Float32Array(L);
  const hasQ=!Q.empty;let hits=0,best=0;
  for(let i=0;i<L;i++){
    const n=N[i];if(!passFilter(set,n,f))continue;
    let v;
    if(hasQ){v=score(n,Q);if(v&&st.onlyNew&&!n.h)v=0}else v=st.onlyNew?(n.h?1:0):1;
    if(v>0){sc[i]=v;show[i]=1;if(!set.isSt(n)){hits++;if(v>best)best=v}}
  }
  if(hasQ||st.onlyNew){
    for(let i=0;i<L;i++){
      if(show[i]!==1)continue;
      let p=N[i].p;while(p>=0&&!show[p]){show[p]=2;p=N[p].p}
      if(hasQ&&set.expand[N[i].k]&&N[i].ch.length){
        for(let j=i+1;j<=N[i].end;j++)if(!show[j]&&passFilter(set,N[j],f)&&(!st.onlyNew||N[j].h))show[j]=3;
      }
    }
  }
  return {show,sc,hits,best};
}
function totalHits(Q){let t=0;SETS.forEach(s=>{t+=compute(s,Q,s.id==='mt'?st.filter:'all').hits});return t}

/* sửa lỗi gõ: tìm từ gần nhất trong kho từ của văn bản */
function fixWord(v){
  if(v.length<4||VOC.has(v))return null;
  for(const k of VOC.keys())if(k.startsWith(v))return null;
  const max=v.length<=5?1:2;let best=null,bd=max+1,bn=0;
  VOC.forEach((info,k)=>{if(Math.abs(k.length-v.length)>max)return;const d=lev(v,k,max);if(d<bd||(d===bd&&info.n>bn)){bd=d;best=k;bn=info.n}});
  return bd<=max?best:null;
}
function tryCorrect(Q){
  if(Q.empty||!Q.words.length)return null;
  let changed=false;const map={};
  Q.words.forEach(w=>{const f=fixWord(w);if(f){map[w]=f;changed=true}});
  if(!changed)return null;
  const terms=Q.terms.map(t=>t.t==='w'&&map[t.v]?{t:'w',v:map[t.v]}:t);
  const Q2=Object.assign({},Q,{terms,words:terms.filter(t=>t.t==='w').map(t=>t.v)});
  Q2.joined=terms.length>1&&terms.every(t=>t.t==='w')?terms.map(t=>t.v).join(' '):'';
  const disp=Object.keys(map).map(k=>[k,bestDisp(VOC.get(map[k]))]);
  return totalHits(Q2)?{Q:Q2,disp}:null;
}
/* bỏ bớt một từ khi tổ hợp không có kết quả */
function dropSuggestions(Q){
  if(Q.terms.length<2)return [];
  const out=[];
  Q.terms.forEach((t,k)=>{
    const rest=Q.terms.filter((_,j)=>j!==k);
    const Q2=Object.assign({},Q,{terms:rest,words:rest.filter(x=>x.t==='w').map(x=>x.v),empty:false,allCode:rest.every(x=>x.t==='c'||x.t==='r')});
    Q2.joined=rest.length>1&&rest.every(x=>x.t==='w')?rest.map(x=>x.v).join(' '):'';
    const h=totalHits(Q2);if(h)out.push({drop:termText(t),hits:h,k});
  });
  return out.sort((a,b)=>b.hits-a.hits).slice(0,3);
}
function termText(t){return t.t==='p'?'"'+t.v+'"':t.t==='r'?t.a+'-'+t.b:t.v}
/* gợi ý hoàn thành từ đang gõ, ưu tiên cụm hai từ có trong văn bản */
function completions(Q){
  const p=Q.last;if(!p||p.length<2||!Q.lastPartial)return [];
  const prevTerms=Q.terms.slice(0,-1);
  const prev=Object.assign({},Q,{terms:prevTerms,empty:!prevTerms.length,joined:'',allCode:false});
  const pw=prevTerms.length&&prevTerms[prevTerms.length-1].t==='w'?prevTerms[prevTerms.length-1].v:'';
  const cand=new Map();
  const add=(key,disp,w)=>{if(key===p)return;const c=cand.get(key);if(c){c.n+=w}else cand.set(key,{d:disp.toLowerCase(),n:w})};
  SETS.forEach(s=>s.nodes.forEach(n=>{
    if(!prev.empty&&score(n,prev)<=0)return;
    const w=words(n.nn);
    for(let k=0;k<w.length;k++){
      const [a,b]=w[k],key=n.nn.slice(a,b);
      if(!key.startsWith(p)||/^\d/.test(key))continue;
      const nx=w[k+1],two=nx&&n.nn.slice(b,nx[0])===' '&&!/^\d/.test(n.nn.slice(nx[0],nx[1]));
      const after=k>0&&pw&&n.nn.slice(w[k-1][0],w[k-1][1])===pw;
      const wt=after?4:1;
      if(two)add(key+' '+n.nn.slice(nx[0],nx[1]),n.n.slice(a,nx[1]),wt*1.4);
      if(key.length>p.length)add(key,n.n.slice(a,b),wt);
    }
  }));
  return [...cand.values()].sort((x,y)=>y.n-x.n).map(v=>v.d).filter((d,i,arr)=>arr.indexOf(d)===i).slice(0,6);
}

/* ================= TÔ ĐẬM ================= */
function hlList(Q){
  const L=[];
  Q.terms.forEach(t=>{if(t.t==='p')L.push(t.v);else if(t.t==='a'){L.push(t.e);L.push(t.v)}});
  if(Q.joined)L.push('\u0001'+Q.joined);
  Q.terms.forEach(t=>{if(t.t==='w'&&t.v.length>=2)L.push(t.v);else if(t.t==='c'&&t.v.length>=3)L.push(t.v)});
  return L;
}
function hl(text,nn,L){
  text=String(text||'');if(!L||!L.length)return esc(text);
  const R=[];
  const add=t=>{const all=[],ws=[];let i=nn.indexOf(t);while(i>=0){all.push(i);if(i===0||!isAN(nn[i-1]))ws.push(i);i=nn.indexOf(t,i+1)}(ws.length?ws:all).forEach(i=>R.push([i,i+t.length]))};
  const joined=L.find(x=>x[0]==='\u0001');
  if(joined&&nn.indexOf(joined.slice(1))>=0){add(joined.slice(1));L.forEach(x=>{if(x[0]!=='\u0001'&&!joined.includes(x))add(x)})}
  else L.forEach(x=>{if(x[0]!=='\u0001')add(x)});
  if(!R.length)return esc(text);
  R.sort((a,b)=>a[0]-b[0]||b[1]-a[1]);const M=[R[0].slice()];
  for(let k=1;k<R.length;k++){const r=R[k],l=M[M.length-1];if(r[0]<=l[1])l[1]=Math.max(l[1],r[1]);else M.push(r.slice())}
  let o='',p=0;M.forEach(([a,b])=>{o+=esc(text.slice(p,a))+'<mark>'+esc(text.slice(a,b))+'</mark>';p=b});
  return o+esc(text.slice(p));
}
function hlCode(n,Q){
  const c=n.c||'';if(!Q||Q.empty)return esc(c);
  for(const t of Q.terms){
    if(t.t==='c'&&n.cl.startsWith(t.v))return '<mark>'+esc(c.slice(0,t.v.length))+'</mark>'+esc(c.slice(t.v.length));
    if(t.t==='r'&&!isNaN(n.cn)&&n.c.length===t.len&&n.cn>=t.a&&n.cn<=t.b)return '<mark>'+esc(c)+'</mark>';
  }
  return esc(c);
}
const ttb=n=>n.h?'<span class="tt" title="Mới hoặc sửa đổi theo Thông tư 123/2026/TT-BTC">TT 123</span>':'';
function codeCls(n){
  const k=n.k;
  if(k==='M'||k==='L'||k==='1')return 'code solid';
  if(k==='3')return 'code line';
  return 'code';
}
function partPill(n){if(n.set!=='mt')return '';const p=PARTS[(n.f||'').split('.')[0]];return p?'<span class="pt '+p[1]+'">'+p[0]+'</span>':''}

/* ================= HIỂN THỊ ================= */
let R={};
function effQ(){return st.eff||st.Q}
function render(){
  const Q=effQ();
  R={};SETS.forEach(s=>{R[s.id]=compute(s,Q,s.id==='mt'?st.filter:'all')});
  renderSets();renderAssist();renderSub();
  $('view').innerHTML=st.view==='all'?overview():treeView(SET[st.view]);
  if(!st.sel)renderDetail();
  const active=!Q.empty||st.onlyNew;
  const tot=SETS.reduce((a,s)=>a+R[s.id].hits,0);
  $('liveCount').textContent=active?fmt(tot)+' kết quả':'';
  saveHash();
}
function renderSets(){
  const active=!effQ().empty||st.onlyNew;
  let tot=0;SETS.forEach(s=>tot+=active?R[s.id].hits:s.total);
  let h='<button class="setp c-ink" data-view="all" aria-pressed="'+(st.view==='all')+'"><span class="dot"></span>Tất cả<span class="n'+(active&&!tot?' z':'')+'">'+fmt(tot)+'</span></button>';
  SETS.forEach(s=>{const c=active?R[s.id].hits:s.total;
    h+='<button class="setp '+s.col+'" data-view="'+s.id+'" aria-pressed="'+(st.view===s.id)+'"><span class="dot"></span>'+esc(s.title)+'<span class="n'+(active&&!c?' z':'')+'">'+fmt(c)+'</span></button>'});
  $('sets').innerHTML=h;
}
function renderAssist(){
  const Q=st.Q;let h='';
  if(st.fixNote){
    h+='<div class="note-bar">Không thấy kết quả cho <b>'+esc(st.raw)+'</b>. Đang hiện kết quả khi sửa '+st.fixNote.map(([a,b])=>'<b>'+esc(a)+'</b> thành <b>'+esc(b)+'</b>').join(', ')+'.<button class="link" data-act="exact">Chỉ tìm đúng từ đã gõ</button></div>';
  }else if(!Q.empty&&!SETS.some(s=>R[s.id].hits)){
    const ds=dropSuggestions(Q);
    if(ds.length)h+='<span class="lab">Bỏ bớt một từ:</span>'+ds.map(d=>'<button class="sug" data-drop="'+d.k+'">bỏ <b>'+esc(d.drop)+'</b><small>'+fmt(d.hits)+' kết quả</small></button>').join('');
  }
  const comp=completions(Q);
  if(comp.length&&st.focused)h+='<span class="lab">Gợi ý:</span>'+comp.map(c=>'<button class="sug" data-comp="'+esc(c)+'">'+esc(c)+'</button>').join('');
  if(Q.empty&&recent.length&&st.view!=='all')h+='<span class="lab">'+'Tìm gần đây:</span>'+recent.slice(0,6).map(r=>'<button class="sug" data-q="'+esc(r)+'">'+ic('clock')+esc(r)+'</button>').join('');
  $('assist').innerHTML=h;
}
function renderSub(){
  const f=$('fchips');
  if(st.view==='mt'){
    const Q=effQ(),active=!Q.empty||st.onlyNew;
    f.hidden=false;
    f.innerHTML=SET.mt.filters.map(([v,l,c])=>{const n=active?compute(SET.mt,Q,v).hits:SET.mt.nodes.filter(x=>!SET.mt.isSt(x)&&passFilter(SET.mt,x,v)).length;
      return '<button class="fc '+c+'" data-f="'+v+'" aria-pressed="'+(st.filter===v)+'"><span class="dot"></span>'+l+'<span class="n">'+fmt(n)+'</span></button>'}).join('');
  }else{f.hidden=true;f.innerHTML=''}
  $('onlyNew').setAttribute('aria-checked',String(st.onlyNew));
  const fb=$('foldBtn');
  if(st.view==='all'){fb.hidden=true}
  else{fb.hidden=false;const any=st.collapsed[st.view].size>0;fb.innerHTML=ic(any?'unfold':'fold')+(any?'Mở rộng tất cả':'Thu gọn')}
}

/* ---- cây ---- */
function rowHTML(set,n,flag,Q,L){
  const isSt=set.isSt(n),hasCh=n.ch.length>0;
  const ignore=!Q.empty||st.onlyNew;
  const open=hasCh&&!(st.collapsed[set.id].has(n.i)&&!ignore);
  let ind='';for(let d=0;d<n.d;d++)ind+='<i style="left:calc('+d+' * var(--step) + 13px)"></i>';
  const hlL=flag===1?L:null;
  const label=isSt?'<span class="kl">'+(n.k==='P'?'Phần '+esc(n.c):esc(KIND[n.k])+(n.c?' '+esc(n.c):''))+'</span>':'';
  const sel=st.sel&&st.sel.set===set.id&&st.sel.i===n.i;
  const note=n.g&&(!isSt||n.k==='G')?'<span class="nt">'+hl(n.g,n.ng,hlL)+'</span>':'';
  return '<li class="r '+n.col+' lv-'+n.k+(isSt?' st':'')+(open?' open':'')+(flag===3?' ctx':'')+(sel?' sel':'')+'" data-i="'+n.i+'" style="--d:'+n.d+'">'+
    '<span class="ind">'+ind+'</span>'+
    (hasCh?'<button class="tg" data-tg="'+n.i+'" aria-label="'+(open?'Thu gọn ':'Mở rộng ')+esc(KIND[n.k]+' '+(n.c||n.n))+'" aria-expanded="'+open+'">'+ic('chev')+'</button>':'<span></span>')+
    '<button class="mb" data-open="'+set.id+':'+n.i+'">'+(isSt?'':'<span class="'+codeCls(n)+'">'+hlCode(n,flag===1?Q:null)+'</span>')+
    '<span class="nm">'+label+hl(n.n,n.nn,hlL)+ttb(n)+note+'</span></button>'+
    '<span class="ra">'+(hasCh&&!isSt?'<span class="cnt">'+n.ch.length+'</span>':'')+
    (n.c&&!isSt?'<button class="cp" data-copy="'+set.id+':'+n.i+'" aria-label="Chép mã '+esc(n.c)+'" title="Chép mã">'+ic('copy')+'</button>':'')+'</span></li>';
}
function treeView(set){
  const Q=effQ(),r=R[set.id],N=set.nodes,coll=st.collapsed[set.id],L=hlList(Q);
  const ignore=!Q.empty||st.onlyNew;
  let h='',shown=0;
  for(let i=0;i<N.length;i++){
    const f=r.show[i];if(!f)continue;
    h+=rowHTML(set,N[i],f,Q,L);shown++;
    if(!ignore&&coll.has(i)&&N[i].ch.length)i=N[i].end;
  }
  const head='<div class="card-h '+set.col+'"><h2><span class="dot"></span>'+esc(set.title)+'<span class="c">'+esc(set.sub)+'</span></h2></div>';
  if(!shown)return '<div class="card '+set.col+'">'+head+emptyHTML(set)+'</div>';
  return '<div class="card">'+head+'<ul class="tree" id="mlns-tree" data-set="'+set.id+'">'+h+'</ul>'+
    '<div class="cfoot"><span><b>'+fmt(r.hits)+'</b> '+esc(set.unit)+(ignore?' khớp':'')+'</span>'+(set.newCount?'<span><b>'+fmt(set.newCount)+'</b> mới hoặc sửa đổi theo TT 123</span>':'')+'</div></div>';
}
function emptyHTML(set){
  const Q=effQ();
  return '<div class="empty"><div class="ic">'+ic('search')+'</div><p>'+(Q.empty?'Không có mã nào khớp bộ lọc':'Không có kết quả cho “'+esc(st.raw)+'”'+(set?' trong '+esc(set.title):''))+'</p>'+
    '<p class="s">Thử bớt từ, gõ vài số đầu của mã, gõ không dấu hoặc dùng chữ viết tắt như tncn, gtgt.</p><div class="act">'+
    (set&&set.id==='mt'&&st.filter!=='all'?'<button class="btn btn-g" data-act="clearFilter">Bỏ lọc phần</button>':'')+
    (st.onlyNew?'<button class="btn btn-g" data-act="clearNew">Hiện cả nội dung cũ</button>':'')+
    (set?'<button class="btn btn-c c-mt" data-view="all">Tìm ở tất cả danh mục</button>':'')+'</div></div>';
}

/* ---- tổng quan ---- */
function pathText(n){
  const N=SET[n.set].nodes,parts=[];let p=n.p;
  while(p>=0){const a=N[p];parts.unshift(a.k==='P'?a.n:a.k==='G'?a.n.replace(/^Chương thuộc /,''):(a.c?KIND[a.k]+' '+a.c:a.n));p=a.p}
  return parts.slice(-3).join(' › ');
}
function flatRow(n,Q,L){
  const pt=pathText(n);
  const cur=st.sel&&st.sel.set===n.set&&st.sel.i===n.i;
  return '<li><button class="fr '+n.col+(cur?' cur':'')+'" data-open="'+n.set+':'+n.i+'"><span class="'+codeCls(n)+'">'+hlCode(n,Q)+'</span><span><span class="nm">'+hl(n.n,n.nn,L)+ttb(n)+'</span><span class="path">'+esc(KIND[n.k]+(pt?', thuộc '+pt:''))+'</span></span>'+partPill(n)+'</button></li>';
}
function overview(){
  const Q=effQ();
  if(Q.empty&&!st.onlyNew){
    let h='<div class="stack"><div class="tiles">'+SETS.map(s=>'<button class="tile '+s.col+'" data-view="'+s.id+'"><span class="ic">'+ic(s.icon)+'</span><span><span class="num">'+fmt(s.total)+'</span><span class="t" style="display:block">'+esc(s.title)+'</span><span class="s" style="display:block">'+esc(s.sub)+(s.newCount?', '+fmt(s.newCount)+' mã TT 123':'')+'</span></span></button>').join('')+'</div>';
    const ex=[['6001','c-chi'],['tiền lương','c-chi','từ khóa'],['tncn','c-thu','viết tắt'],['"lệ phí trước bạ"','c-thu','đúng cụm từ'],['6000-6099','c-chi','khoảng mã'],['thuế -khác','c-thu','loại trừ từ'],['tien thue dat','c-thu','không cần dấu'],['chuyển đổi số','c-lk','từ khóa'],['0170','c-ct'],['557','c-ch'],['tien luogn','c-mt','gõ sai vẫn tìm được']];
    const desc=(q,d)=>{if(d)return d;const P=parseQuery(q),t=P.terms[0];if(t&&t.t==='c'){for(const s of SETS){const n=s.nodes.find(x=>x.c===t.v&&!s.isSt(x));if(n)return n.n.length>26?n.n.slice(0,25).trim()+'…':n.n}}return 'mã'};
    h+='<div class="card"><div class="card-h"><h2>Thử tìm nhanh</h2></div><div class="ex">'+ex.map(([q,c,d])=>'<button class="exq '+c+'" data-q="'+esc(q)+'"><b>'+esc(q)+'</b>'+esc(desc(q,d))+'</button>').join('')+'</div></div>';
    if(recent.length)h+='<div class="card"><div class="card-h"><h2>Tìm gần đây</h2><button class="link c-mt" data-act="clearRecent">Xóa lịch sử</button></div><div class="ex">'+recent.map(r=>'<button class="sug" data-q="'+esc(r)+'">'+ic('clock')+esc(r)+'</button>').join('')+'</div></div>';
    h+='<div class="card"><div class="card-h"><div><h2>Mới và sửa đổi theo Thông tư 123/2026/TT-BTC</h2><div class="sub">Nội dung bãi bỏ đã được loại khỏi danh mục</div></div><button class="btn btn-g" data-act="onlyNew">Chỉ xem nội dung này</button></div>';
    SETS.forEach(s=>{const list=s.nodes.filter(n=>n.h);if(!list.length)return;
      const top=(s.id==='ct'?list.filter(n=>n.k==='1').concat(list.filter(n=>n.k!=='1')):list).slice(0,5);
      h+='<div class="card-h '+s.col+'" style="padding-top:10px"><h2 style="font-size:14px"><span class="dot"></span>'+esc(s.title)+'<span class="c">'+fmt(list.length)+'</span></h2>'+(list.length>top.length?'<button class="link" data-view="'+s.id+'" data-new="1">Xem cả '+fmt(list.length)+'</button>':'')+'</div><ul class="flat">'+top.map(n=>flatRow(n,null,null)).join('')+'</ul>'});
    return h+'</div></div>';
  }
  const L=hlList(Q);
  const lists=SETS.map(s=>{const r=R[s.id],list=[];s.nodes.forEach((n,i)=>{if(r.show[i]===1&&n.k!=='P')list.push(n)});
    if(!Q.empty)list.sort((a,b)=>r.sc[b.i]-r.sc[a.i]||a.i-b.i);return {s,r,list}});
  if(!Q.empty)lists.sort((a,b)=>b.r.best-a.r.best);
  let h='<div class="stack">',any=false;
  lists.forEach(({s,r,list})=>{
    if(!list.length)return;any=true;const lim=7;
    h+='<div class="card"><div class="card-h '+s.col+'"><h2><span class="dot"></span>'+esc(s.title)+'<span class="c">'+fmt(r.hits)+' kết quả</span></h2><button class="link" data-view="'+s.id+'">Xem dạng cây</button></div><ul class="flat">'+list.slice(0,lim).map(n=>flatRow(n,Q,L)).join('')+'</ul>'+
      (list.length>lim?'<div class="more '+s.col+'"><button class="link" data-view="'+s.id+'">Xem tất cả '+fmt(r.hits)+' kết quả trong '+esc(s.title)+'</button></div>':'')+'</div>';
  });
  if(!any)return '<div class="card">'+emptyHTML(null)+'</div>';
  return h+'</div>';
}

/* ---- chi tiết ---- */
function helpHTML(){
  return '<div class="dv help-card"><h2>Mẹo tìm kiếm</h2><p>Bấm một dòng bất kỳ để xem chi tiết, cấp cha và cấp con ở đây.</p><ul class="ops">'+
    [['6001','mã đầy đủ hoặc vài số đầu'],['6000-6099','khoảng mã'],['"tiền thuê đất"','đúng cụm từ'],['thuế -khác','loại trừ từ'],['tncn, gtgt, cds','chữ viết tắt'],['tien luogn','gõ sai nhẹ vẫn tìm được']]
    .map(([a,b])=>'<li><button data-q="'+esc(a.split(',')[0])+'"><code>'+esc(a)+'</code></button><span>'+esc(b)+'</span></li>').join('')+
    '</ul><p style="margin-top:14px">Phím tắt: <b>/</b> hoặc <b>Ctrl K</b> để vào ô tìm, <b>↑ ↓</b> để đi giữa các dòng, <b>Enter</b> để mở, <b>Esc</b> để xóa hoặc đóng.</p></div>';
}
function renderDetail(){
  const box=$('detail');
  if(!st.sel){box.innerHTML=helpHTML();return}
  const s=SET[st.sel.set],N=s.nodes,n=N[st.sel.i];
  if(!n){st.sel=null;box.innerHTML=helpHTML();return}
  const isSt=s.isSt(n);
  let h='<div class="dv '+n.col+'"><div class="dv-head"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><span class="k">'+esc(KIND[n.k])+', '+esc(s.sub)+'</span>'+
    '<button class="ibtn dv-close" data-act="closeDetail" aria-label="Đóng chi tiết">'+ic('x')+'</button></div>'+
    (n.c?'<div class="dv-code"><span class="big">'+(n.k==='P'?'Phần '+esc(n.c):esc(n.c))+'</span></div>':'')+
    '<h2 class="dv-name" id="dvName">'+esc(n.n)+'</h2><div class="dv-badges">'+partPill(n)+(n.h?'<span class="tt">Mới hoặc sửa đổi theo TT 123/2026</span>':'')+'</div>'+
    '<div class="dv-acts">'+(n.c&&!isSt?'<button class="btn btn-c" data-copy="'+s.id+':'+n.i+'">'+ic('copy')+'Chép mã '+esc(n.c)+'</button><button class="btn btn-s" data-copyall="'+s.id+':'+n.i+'">Chép mã và tên</button>':'')+
    '<button class="btn btn-s" data-reveal="'+s.id+':'+n.i+'">'+ic('locate')+'Xem trong cây</button></div></div>';
  if(n.g)h+='<div class="sec"><h3>Ghi chú</h3><p>'+esc(n.g)+'</p></div>';
  if(Array.isArray(n.x)&&n.x.length)h+='<div class="guide"><h3>Phạm vi hạch toán theo khoản 3 Điều 3, sửa đổi tại Điều 1 TT 123/2026</h3>'+n.x.map(p=>'<p>'+esc(p)+'</p>').join('')+'</div>';
  const anc=[];let p=n.p;while(p>=0){anc.unshift(N[p]);p=N[p].p}
  if(anc.length)h+='<div class="sec"><h3>Thuộc</h3><ul class="steps">'+anc.map(a=>'<li class="'+a.col+'"><button class="stp" data-open="'+s.id+':'+a.i+'"><small>'+esc(a.k==='P'?'Phần '+a.c:KIND[a.k])+'</small>'+(a.c&&a.k!=='P'?'<b>'+esc(a.c)+'</b>':'')+esc(a.n)+'</button></li>').join('')+
    '<li class="cur '+n.col+'"><span class="stp"><small>'+esc(KIND[n.k])+'</small>'+(n.c&&n.k!=='P'?'<b>'+esc(n.c)+'</b>':'')+esc(n.n)+'</span></li></ul></div>';
  const list=(arr,cur)=>'<ul class="mini">'+arr.map(c=>'<li><button class="fr '+c.col+(c===cur?' cur':'')+'" data-open="'+s.id+':'+c.i+'"'+(c===cur?' aria-current="true"':'')+'>'+(c.c?'<span class="'+codeCls(c)+'">'+esc(c.c)+'</span>':'<span></span>')+'<span class="nm">'+esc(c.n)+ttb(c)+'</span></button></li>').join('')+'</ul>';
  if(n.ch.length){const ch=n.ch.map(j=>N[j]);h+='<div class="sec"><h3>Gồm '+fmt(ch.length)+' '+esc(KIND[ch[0].k].toLowerCase())+'</h3>'+list(ch)+'</div>'}
  else if(n.p>=0){const sib=N[n.p].ch.map(j=>N[j]);if(sib.length>1)h+='<div class="sec"><h3>Cùng '+esc(KIND[N[n.p].k].toLowerCase())+' '+esc(N[n.p].c||N[n.p].n)+'</h3>'+list(sib,n)+'</div>'}
  box.innerHTML=h+'</div>';box.scrollTop=0;
}
let lastFocus=null;
const narrow=()=>true;
function openDetail(setId,i){
  if(!SET[setId]||!SET[setId].nodes[i])return;
  st.sel={set:setId,i:+i};
  if(!st.Q.empty)remember(st.raw);
  renderDetail();
  document.querySelectorAll('.r.sel').forEach(e=>e.classList.remove('sel'));
  document.querySelectorAll('#mlns-view .fr.cur').forEach(e=>e.classList.remove('cur'));
  const fr=document.querySelector('#mlns-view .fr[data-open="'+setId+':'+i+'"]');if(fr)fr.classList.add('cur');
  const row=document.querySelector('#mlns-tree[data-set="'+setId+'"] .r[data-i="'+i+'"]');if(row)row.classList.add('sel');
  if(narrow()){
    if(!$('detail').classList.contains('on'))lastFocus=document.activeElement;
    $('detail').classList.add('on');$('scrim').classList.add('on');
    setTimeout(()=>{const b=$('detail').querySelector('.dv-close');if(b)b.focus()},60);
  }
  saveHash();
}
function closeDetail(){
  $('detail').classList.remove('on');$('scrim').classList.remove('on');
  if(lastFocus&&document.contains(lastFocus))lastFocus.focus();lastFocus=null;
}

/* ================= HÀNH ĐỘNG ================= */
let tt=0;function toast(m){const t=$('toast');t.textContent=m;t.hidden=false;clearTimeout(tt);tt=setTimeout(()=>{t.hidden=true},1800)}
function copy(text,msg){
  const fb=()=>{try{const ta=document.createElement('textarea');ta.value=text;ta.setAttribute('readonly','');ta.style.cssText='position:fixed;left:-9999px;opacity:0';document.body.appendChild(ta);ta.select();const ok=document.execCommand('copy');ta.remove();toast(ok?msg:'Không chép được, hãy bôi đen và chép thủ công')}catch(e){toast('Không chép được, hãy bôi đen và chép thủ công')}};
  try{if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(text).then(()=>toast(msg),fb);else fb()}catch(e){fb()}
}
function nodeOf(key){const [s,i]=String(key).split(':');return SET[s]&&SET[s].nodes[+i]||null}
function remember(q){q=String(q||'').trim();if(!q||q.length>80)return;recent=[q].concat(recent.filter(x=>norm(x)!==norm(q))).slice(0,8);store.set('mlns2.recent',recent)}
let remTimer=0;
function setQuery(v,fromInput){
  v=String(v||'').slice(0,200);
  st.raw=v;st.Q=parseQuery(v);st.eff=null;st.fixNote=null;
  if(!st.Q.empty&&!st.exact&&!totalHits(st.Q)){const c=tryCorrect(st.Q);if(c){st.eff=c.Q;st.fixNote=c.disp}}
  if(!fromInput)$('q').value=v;
  $('clr').hidden=!v;
  clearTimeout(remTimer);if(!st.Q.empty)remTimer=setTimeout(()=>{if(totalHits(effQ()))remember(st.raw)},2200);
  render();
}
function setView(v,onlyNew){
  if(v!=='all'&&!SET[v])return;
  st.view=v;if(onlyNew)st.onlyNew=true;
  render();ROOT.scrollIntoView({block:'start'});
}
function reveal(n){
  if(!n)return;
  if(narrow())closeDetail();
  st.view=n.set;st.raw='';st.Q=parseQuery('');st.eff=null;st.fixNote=null;st.onlyNew=false;$('q').value='';$('clr').hidden=true;
  if(n.set==='mt')st.filter='all';
  let p=n.p;const c=st.collapsed[n.set];while(p>=0){c.delete(p);p=SET[n.set].nodes[p].p}
  st.sel={set:n.set,i:n.i};
  render();renderDetail();
  const row=document.querySelector('#mlns-tree .r[data-i="'+n.i+'"]');
  if(row){row.scrollIntoView({block:'center'});row.classList.add('flash');const b=row.querySelector('.mb');if(b)b.focus({preventScroll:true})}
}
function saveHash(){
  try{const p=new URLSearchParams();if(st.view!=='all')p.set('v',st.view);if(st.raw)p.set('q',st.raw);if(st.filter!=='all')p.set('f',st.filter);if(st.onlyNew)p.set('n','1');if(st.sel)p.set('s',st.sel.set+':'+st.sel.i);
    const h=p.toString();history.replaceState(null,'',h?'#'+h:location.pathname+location.search)}catch(e){}
}
function loadHash(){
  try{const p=new URLSearchParams(location.hash.slice(1));const v=p.get('v');st.view=v&&SET[v]?v:'all';st.filter='all';st.onlyNew=false;st.sel=null;
    const f=p.get('f');if(f&&SET.mt.filters.some(x=>x[0]===f))st.filter=f;if(p.get('n')==='1')st.onlyNew=true;
    const s=p.get('s');if(s){const n=nodeOf(s);if(n)st.sel={set:n.set,i:n.i}}
    const q=p.get('q')||'';$('q').value=q.slice(0,200);return q.slice(0,200)}catch(e){}
  return '';
}

/* ================= SỰ KIỆN ================= */
const qi=$('q');let deb=0;
qi.addEventListener('input',()=>{clearTimeout(deb);st.exact=false;deb=setTimeout(()=>setQuery(qi.value,true),60)});
qi.addEventListener('focus',()=>{st.focused=true;renderAssist()});
qi.addEventListener('blur',()=>{setTimeout(()=>{if(document.activeElement&&document.activeElement.closest&&document.activeElement.closest('#mlns-assist'))return;st.focused=false;renderAssist()},150)});
qi.addEventListener('keydown',e=>{
  if(e.key==='Escape'){e.preventDefault();if(qi.value)setQuery('');else qi.blur();return}
  const first=()=>document.querySelector('#mlns-view [data-open]');
  if(e.key==='ArrowDown'){const f=first();if(f){e.preventDefault();f.focus()}}
  if(e.key==='Enter'){clearTimeout(deb);setQuery(qi.value,true);const f=first();if(f){e.preventDefault();remember(st.raw);const n=nodeOf(f.dataset.open);if(n)openDetail(n.set,n.i)}}
  if(e.key==='Tab'&&!e.shiftKey){const c=document.querySelector('#mlns-assist [data-comp]');if(c&&st.Q.last&&qi.selectionStart===qi.value.length){e.preventDefault();applyComp(c.dataset.comp)}}
});
function applyComp(c){
  const v=qi.value.replace(/\S+$/,'');const nv=(v+c+' ').slice(0,200);
  qi.value=nv;setQuery(nv,true);qi.focus();try{qi.setSelectionRange(nv.length,nv.length)}catch(e){}
}
$('clr').addEventListener('click',()=>{setQuery('');qi.focus()});
$('onlyNew').addEventListener('click',()=>{st.onlyNew=!st.onlyNew;render()});
$('foldBtn').addEventListener('click',()=>{
  if(st.view==='all')return;const s=SET[st.view],c=st.collapsed[s.id];
  if(c.size)c.clear();else s.nodes.forEach(n=>{if(s.foldK[n.k]&&n.ch.length)c.add(n.i)});
  render();
});
$('scrim').addEventListener('click',closeDetail);
ROOT.addEventListener('mousedown',e=>{if(e.target.closest&&e.target.closest('#mlns-assist button'))e.preventDefault()});
ROOT.addEventListener('click',e=>{
  const t=e.target.closest&&e.target.closest('button');if(!t)return;
  const d=t.dataset;
  if(d.view){setView(d.view,!!d.new);return}
  if(d.f){st.filter=d.f;render();return}
  if(d.q!=null){st.exact=false;setQuery(d.q);qi.focus();return}
  if(d.comp!=null){applyComp(d.comp);return}
  if(d.drop!=null){const k=+d.drop,t2=st.Q.terms.filter((_,j)=>j!==k).map(termText);const neg=st.Q.neg.map(x=>'-'+x);setQuery(t2.concat(neg).join(' ')+' ');qi.focus();return}
  if(d.act){
    switch(d.act){
      case 'exact':st.exact=true;st.Q=parseQuery(st.raw);st.eff=null;st.fixNote=null;render();return;
      case 'clearFilter':st.filter='all';render();return;
      case 'clearNew':st.onlyNew=false;render();return;
      case 'onlyNew':st.onlyNew=true;render();return;
      case 'clearRecent':recent=[];store.set('mlns2.recent',[]);render();return;
      case 'closeDetail':closeDetail();return;
    }
  }
  if(d.tg!=null){const tree=t.closest('#mlns-tree');if(!tree)return;
    if(!st.Q.empty||st.onlyNew){toast('Đang lọc nên các nhánh được mở sẵn');return}
    const s=tree.dataset.set,i=+d.tg,c=st.collapsed[s];c.has(i)?c.delete(i):c.add(i);render();
    const b=document.querySelector('#mlns-tree [data-tg="'+i+'"]');if(b)b.focus();return}
  if(d.open){const n=nodeOf(d.open);if(n)openDetail(n.set,n.i);return}
  if(d.copy){const n=nodeOf(d.copy);if(n)copy(n.c,'Đã chép mã '+n.c);return}
  if(d.copyall){const n=nodeOf(d.copyall);if(n)copy(n.c+' - '+n.n,'Đã chép mã '+n.c+' và tên');return}
  if(d.reveal){reveal(nodeOf(d.reveal));return}
});
$('view').addEventListener('keydown',e=>{
  if(e.key!=='ArrowDown'&&e.key!=='ArrowUp')return;
  const all=[...document.querySelectorAll('#mlns-view [data-open]')],k=all.indexOf(document.activeElement);if(k<0)return;
  e.preventDefault();
  if(e.key==='ArrowUp'&&k===0){qi.focus();return}
  const nx=all[k+(e.key==='ArrowDown'?1:-1)];if(nx){nx.focus();nx.scrollIntoView({block:'nearest'})}
});
document.addEventListener('keydown',e=>{
  if(ROOT.hidden)return;
  if(e.key==='Escape'&&$('detail').classList.contains('on')){closeDetail();return}
  const tag=(document.activeElement&&document.activeElement.tagName)||'';
  const typing=tag==='INPUT'||tag==='TEXTAREA';
  if((e.key==='/'&&!typing)||((e.ctrlKey||e.metaKey)&&(e.key==='k'||e.key==='K'))){e.preventDefault();qi.focus();qi.select()}
});
window.addEventListener('resize',()=>{if(!narrow()&&$('detail').classList.contains('on')){$('detail').classList.remove('on');$('scrim').classList.remove('on')}});

/* giao diện sáng tối */
const isDark=()=>{return ROOT.dataset.theme==='dark'};
function themeIcon(){$('themeBtn').innerHTML=ic(isDark()?'sun':'moon')}
$('themeBtn').addEventListener('click',()=>{const t=isDark()?'light':'dark';ROOT.dataset.theme=t;store.set('mlns3.theme',t);themeIcon()});

themeIcon();

/* khởi động */
const q0=loadHash();
setQuery(q0,true);
renderDetail();
window.addEventListener('hashchange',()=>{if(ROOT.hidden)return;const q=loadHash();setQuery(q,true);renderDetail()});

}
function start(){
  if(started)return;started=true;
  fetch('mlns-data.json').then(r=>{if(!r.ok)throw 0;return r.json()}).then(boot).catch(()=>{
    started=false;const v=document.getElementById('mlns-view');
    if(v)v.innerHTML='<p class="p-6 text-center">Không tải được dữ liệu mục lục (mlns-data.json). Hãy tải lại trang.</p>'});
}
function open(){
  tabs.forEach(t=>t.classList.remove('active'));
  hideIds.forEach(e=>e.style.display='none');
  ROOT.hidden=false;paint(true);TAB.setAttribute('aria-selected','true');start();
}
function close(){ROOT.hidden=true;hideIds.forEach(e=>e.style.display='');paint(false);TAB.setAttribute('aria-selected','false')}
TAB.addEventListener('click',open);
tabs.forEach(t=>t.addEventListener('click',()=>{if(!ROOT.hidden)close()}));
if(/[#&](v|q|s|n)=/.test(location.hash))open();
})();
