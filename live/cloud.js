(async()=>{'use strict';
const $=s=>document.querySelector(s),X=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c])),ID='sprint-isr';
let conf=await fetch('../index.html').then(r=>r.text()),url=conf.match(/SUPABASE_URL:'([^']+)'/)?.[1],key=conf.match(/SUPABASE_ANON_KEY:'([^']+)'/)?.[1];
if(!url||!key)throw Error('Configure a chave publicável do Supabase para o LIVE');
const db=supabase.createClient(url,key),views={editor:'Editor',maestro:'Maestro',gil:'Roteiro Gil',diego:'Roteiro Diego',tecnica:'Direção técnica',publico:'Tela pública',aluno:'Votação'};
let view=new URLSearchParams(location.search).get('view')||'maestro',isStaff=false,auth=null,L=null,R=null,P=null,edit=null,sel=0,dirty=false;
if(!views[view])view='maestro';
const warn=s=>{const el=$('#status');el.textContent=s;el.style.display='block';setTimeout(()=>el.style.display='none',4000)};
async function load(){let s=await db.auth.getSession();auth=s.data.session;isStaff=!!auth&&(await db.rpc('live_studio_is_staff')).data===true;
let p=await db.from('live_studio_public').select('data').eq('id',ID).single();P=p.data?.data;
if(isStaff){let [a,b]=await Promise.all(['live_studio_lesson','live_studio_runtime'].map(t=>db.from(t).select('data').eq('id',ID).single()));L=a.data?.data;R=b.data?.data}else{L=R=edit=null}
$('#net').textContent=isStaff?'● Equipe autenticada':'● Projeção pública';$('#signout').hidden=!auth;render()}
const scenes=()=>L.cases.flatMap(c=>c.scenes.map(s=>({...s,caseTitle:c.title,patient:s.patient||c.patient})));
const scene=()=>scenes()[R.index];
function poll(){const pub=view==='publico'||view==='aluno',s=pub?P.scene:scene(),p=pub?s.poll:s.poll,ph=pub?P.pollPhase:R.pollPhase;if(!p)return '';
return '<div class="card"><h2>'+X(p.question)+'</h2>'+p.options.map((o,i)=>'<label class="option">'+(view==='aluno'&&ph==='open'?'<input type="radio" name="vote" value="'+i+'">':'<b>'+String.fromCharCode(65+i)+'.</b>')+'<span>'+X(o)+'</span>'+(ph==='revealed'&&p.correct===i?' ✓':'')+'</label>').join('')+(ph==='revealed'?'<p>'+X(p.explanation)+'</p>':'')+'<p class="hint">'+X(ph)+'</p></div>'}
const vals=s=>'<div class="row">'+Object.entries(s.vitals||{}).map(([k,v])=>'<div class="stat"><small>'+X(k)+'</small><b>'+X(v)+'</b></div>').join('')+'</div>';
const controls=()=>'<div class="card row">'+['back','advance','start_poll','close_poll','reveal_poll'].map((id,i)=>'<button data-act="'+id+'" class="'+(i===1?'primary':'')+'">'+['← Voltar','Avançar →','Abrir votação','Encerrar','Revelar'][i]+'</button>').join('')+'</div>';
function render(){if(dirty&&view==='editor')return;
let h='<div class="nav">'+Object.entries(views).map(([v,t])=>'<button data-view="'+v+'" class="'+(view===v?'active':'')+'">'+t+'</button>').join('')+'</div>';
if(!isStaff&&!['publico','aluno'].includes(view)){h+='<div class="card"><h1>Login da equipe</h1><p class="muted">Acesse com e-mail autorizado. O conteúdo privado não é público.</p><form id="login"><input type="email" name="email" required placeholder="E-mail autorizado"><button class="primary">Enviar link</button></form></div>'}
else if(['publico','aluno'].includes(view)){if(!P)h+='<p>Aguardando transmissão.</p>';else{const s=P.scene;h+='<h1>'+X(s.title)+'</h1><div class="card">'+vals(s)+'<p>'+X(s.patient)+'</p><p class="big">'+X(s.clinical)+'</p></div>'+(P.step>0?poll():'')}}
else if(view==='maestro'){const s=scene();h+='<h1>'+X(s.title)+'</h1><div class="wide"><div class="card">'+scenes().map((x,i)=>'<button class="scene" data-goto="'+i+'">'+(i+1)+'. '+X(x.title)+'</button>').join('')+'</div><div><div class="card">'+vals(s)+'<p>'+X(s.clinical)+'</p></div><div class="card"><h2>Gil</h2><p>'+X(s.gil)+'</p><h2>Diego</h2><p>'+X(s.diego)+'</p><h2>FAZER</h2><p>'+X(s.action)+'</p><h2>PRÓXIMO</h2><p>'+X(s.next)+'</p></div>'+controls()+poll()+'</div></div>'}
else if(view==='gil'||view==='diego'){let s=scene(),gil=view==='gil';h+='<h1>'+X(s.title)+'</h1><div class="card"><h2>SUA FALA</h2><p class="big">'+X(gil?s.gil:s.diego)+'</p><h2>OUTRO PROFESSOR</h2><p>'+X(gil?s.cueDiego:s.cueGil)+'</p><h2>PRÓXIMO</h2>'+X(s.next)+'</div>'+controls()}
else if(view==='tecnica'){let s=scene();h+='<h1>Direção técnica</h1><div class="card"><h2>'+X(s.title)+'</h2><p>'+X(s.technical)+'</p><p>'+X(s.next)+'</p></div><div class="card"><input id="notice" placeholder="Aviso para professores" value="'+X(R.notice)+'"><button id="sendNotice">Enviar aviso</button></div>'}
else if(view==='editor'){if(!edit)edit=structuredClone(L);let all=edit.cases.flatMap(c=>c.scenes);sel=Math.min(sel,all.length-1);let s=all[sel];const f=(name,k)=>'<label class="field">'+name+'<textarea data-edit="'+k+'">'+X(s[k])+'</textarea></label>';h+='<h1>Editor da LIVE</h1><div class="wide"><div class="card">'+all.map((x,i)=>'<button class="scene" data-select="'+i+'">'+X(x.title)+'</button>').join('')+'</div><div><div class="card">'+f('Título','title')+f('Contexto clínico','clinical')+f('Fala Gil','gil')+f('Fala Diego','diego')+f('Resumo Gil','cueGil')+f('Resumo Diego','cueDiego')+f('Próxima decisão','next')+f('Ação técnica','technical')+'</div><button class="primary" id="save">Salvar roteiro</button><button id="export">Exportar JSON</button></div></div>'}
$('#app').innerHTML=h}
async function act(type,payload={}){let r=await db.rpc('live_studio_control',{p_type:type,p_payload:payload});if(r.error)warn(r.error.message);else{if(type==='save_lesson'){dirty=false;edit=null}await load()}}
function capture(){if(!edit)return;let s=edit.cases.flatMap(c=>c.scenes)[sel];document.querySelectorAll('[data-edit]').forEach(el=>s[el.dataset.edit]=el.value)}
document.addEventListener('click',e=>{let b=e.target.closest('button');if(!b)return;
if(b.dataset.view){if(dirty&&!confirm('Descartar edição não salva?'))return;dirty=false;edit=null;view=b.dataset.view;history.replaceState({},'',location.pathname+'?view='+view);render()}
else if(b.dataset.act)act(b.dataset.act);else if(b.dataset.goto!==undefined)act('goto',{index:+b.dataset.goto});
else if(b.dataset.select!==undefined){capture();dirty=false;sel=+b.dataset.select;render()}
else if(b.id==='save'){capture();act('save_lesson',{lesson:edit})}
else if(b.id==='export'){capture();let blob=new Blob([JSON.stringify(edit,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='ctmed-live.json';a.click()}
else if(b.id==='sendNotice')act('notice',{notice:$('#notice').value});
else if(b.id==='signout')db.auth.signOut().then(()=>location.reload())});
document.addEventListener('submit',async e=>{if(e.target.id!=='login')return;e.preventDefault();let email=new FormData(e.target).get('email');let r=await db.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+location.pathname+'?view='+view}});warn(r.error?r.error.message:'Verifique o link enviado por e-mail.')});
document.addEventListener('change',async e=>{if(e.target.name!=='vote')return;let id=localStorage.getItem('live-voter')||crypto.randomUUID().replaceAll('-','');localStorage.setItem('live-voter',id);let r=await db.rpc('live_studio_cast_vote',{p_lesson_id:ID,p_voter_id:id,p_selected:+e.target.value});warn(r.error?r.error.message:'Voto registrado')});
document.addEventListener('input',e=>{if(e.target.matches('[data-edit]'))dirty=true});
document.addEventListener('keydown',e=>{if(!isStaff||!['maestro','gil','diego'].includes(view)||e.target.closest('input,textarea,select'))return;if(e.code==='Space'||e.code==='ArrowRight'){e.preventDefault();act('advance')}else if(e.code==='ArrowLeft'){e.preventDefault();act('back')}});
$('#signout').addEventListener('click',()=>db.auth.signOut().then(()=>location.reload()));
await load();db.channel('live-updates').on('postgres_changes',{event:'*',schema:'public',table:'live_studio_public',filter:'id=eq.'+ID},()=>{if(!dirty)load()}).subscribe();setInterval(()=>{if(!dirty)load()},10000);
})().catch(e=>{document.querySelector('#app').textContent='Falha ao iniciar LIVE: '+e.message;});