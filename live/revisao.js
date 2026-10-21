
(async()=>{
'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ID='sprint-isr',statusNames={agenda:'PAUTA',intro:'ABERTURA',case:'DECISÃO DE CASO',scene:'CENA CLÍNICA',closing:'ENCERRAMENTO',topic:'TÓPICO'};
const cfg=await fetch('../index.html',{cache:'no-store'}).then(r=>r.text());
const api=cfg.match(/SUPABASE_URL:'([^']+)'/)?.[1],key=cfg.match(/SUPABASE_ANON_KEY:'([^']+)'/)?.[1];
if(!api||!key||!window.supabase)throw Error('Configuração Supabase indisponível');
const db=supabase.createClient(api,key);
let S={role:null,email:'',units:[],comments:[],events:[],release:null,selected:'agenda',filter:'todos',query:'',tab:'conteudo',draft:null,editTitle:'',baseRev:0,dirty:false,composing:false,working:false,pendingRefresh:false,roster:null,aiSuggestions:[],aiReady:false,aiReferenceOk:false,aiBusy:false,aiTokens:null,aiError:null};
function flash(msg){const t=$('#toast');t.textContent=msg;t.style.display='block';clearTimeout(flash._timer);flash._timer=setTimeout(()=>t.style.display='none',4800)}
const selected=()=>S.units.find(u=>u.id===S.selected)||S.units[0];
const locked=u=>u&&u.final_revision===u.revision;
const isAuthor=()=>['gil','diego'].includes(S.role);
const approvedBy=(u,role)=>u[role+'_approved_revision']===u.revision;
const exempt=u=>u.kind==='scene'&&S.units.some(parent=>parent.kind==='case'&&locked(parent)&&parent.final?.include===false&&parent.final?.case_id===u.draft?.case_id);
const required=()=>S.units.filter(u=>!exempt(u));
const awaitingMe=u=>!exempt(u)&&!locked(u)&&isAuthor()&&!approvedBy(u,S.role);
const openIssues=u=>S.comments.filter(c=>c.unit_id===u.id&&c.revision===u.revision&&!c.resolved).length;
const done=()=>required().filter(locked).length;
const label=u=>{if(exempt(u))return ['Dispensada pelo caso','pending'];if(locked(u))return ['Consolidado','approved'];if(u.final_revision)return ['Revisão aberta','revision'];if(approvedBy(u,'gil')||approvedBy(u,'diego'))return ['Uma aprovação','one'];return ['Em discussão','pending']};
const date=v=>v?new Date(v).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';
function get(obj,path){return path.split('.').reduce((v,k)=>v?.[k],obj)}
function set(obj,path,val){const keys=path.split('.');let at=obj;for(let i=0;i<keys.length-1;i++){if(at[keys[i]]==null)at[keys[i]]={};at=at[keys[i]]}at[keys.at(-1)]=val}
const field=(name,path,opt={})=>{
 const value=get(S.draft,path)??'';
 const disable=locked(selected())||!isAuthor()?' disabled':'';
 const input=opt.textarea?'<textarea data-field="'+esc(path)+'" rows="'+(opt.rows||4)+'"'+disable+'>'+esc(value)+'</textarea>':
 '<input data-field="'+esc(path)+'" value="'+esc(value)+'"'+disable+'/>';
 return '<label class="field '+(opt.full?'full':'')+'"><span class="label">'+esc(name)+'</span>'+input+'</label>';
};
const heading=text=>'<div class="section-heading full">'+esc(text)+'</div>';
function sectionEditor(u){
 const off=locked(u)||!isAuthor();
 let s='<label class="toggle full"><input type="checkbox" data-check="include" '+(S.draft.include!==false?'checked':'')+(off?' disabled':'')+'><strong>Incluir este conteúdo na aula</strong></label>';
 if(u.kind==='agenda'||u.kind==='topic'){
  s+=field('Proposta / decisões a tomar','text',{textarea:true,full:true,rows:8});
  if(u.kind==='agenda')s+=field('Duração estimada da live (min)','duration_min');
 }else if(u.kind==='case'){
  s+=field('Título do caso','title',{full:true})+field('Paciente / situação clínica','patient',{textarea:true,full:true,rows:2})+
  field('Motivo para incluir ou retirar este caso','approach',{textarea:true,full:true,rows:4})+
  field('Decisão editorial (manter, excluir ou mudar abordagem)','decision',{textarea:true,full:true,rows:2})+
  field('Notas e propostas para revisão','notes',{textarea:true,full:true,rows:3});
 }else{
  s+=field('Título da cena','scene.title',{full:true})+
  field('Duração (min)','scene.minutes')+
  field('Situação clínica / evolução','scene.clinical',{textarea:true,full:true,rows:4});
  if(u.kind==='scene'){
   s+=heading('Sinais vitais e monitor');
   const v=S.draft.scene?.vitals||{};
   const entries=Object.entries(v);
   if(entries.length)s+=entries.map(([k])=>field(k.toUpperCase(),'scene.vitals.'+k)).join('');
   else s+='<p class="sub full">Nenhum parâmetro registrado nesta cena.</p>';
  }
  s+=heading('Roteiro · falas dos professores')+
  field('Gil · fala completa','scene.gil',{textarea:true,full:true,rows:5})+
  field('Diego · fala completa','scene.diego',{textarea:true,full:true,rows:5})+
  field('Guia resumido Gil','scene.cueGil',{textarea:true,rows:3})+
  field('Guia resumido Diego','scene.cueDiego',{textarea:true,rows:3})+
  heading('Raciocínio e direção técnica')+
  field('Objetivo pedagógico','scene.objective',{textarea:true,full:true,rows:3})+
  field('O que fazer / ação','scene.action',{textarea:true,rows:3})+
  field('O que vem depois','scene.next',{textarea:true,rows:3})+
  field('Orientação ao operador OBS','scene.technical',{textarea:true,full:true,rows:3})+
  field('Notas e propostas da IA para revisão','notes',{textarea:true,full:true,rows:3});
  if(u.kind==='scene'){
   s+=heading('Pergunta e votação');
   if(S.draft.scene.poll){
    s+=field('Pergunta','scene.poll.question',{textarea:true,full:true,rows:3});
    S.draft.scene.poll.options.forEach((o,i)=>{s+=field('Alternativa '+String.fromCharCode(65+i),'scene.poll.options.'+i,{full:true})});
    s+='<label class="field"><div class="label">Gabarito</div><select data-answer="true" '+(off?'disabled':'')+'>'+
    S.draft.scene.poll.options.map((_,i)=>'<option value="'+i+'" '+(S.draft.scene.poll.correct===i?'selected':'')+'>'+String.fromCharCode(65+i)+'</option>').join('')+'</select></label>';
    s+=field('Justificativa e raciocínio','scene.poll.explanation',{textarea:true,full:true,rows:4});
    if(!off)s+='<div class="full"><button class="ghost" data-action="remove_poll">Retirar votação desta cena</button></div>';
   }else if(!off)s+='<div class="full"><button data-action="add_poll">+ Criar votação nesta cena</button></div>';
  }
 }
 return s;
}
function diff(u){
 const historyBase=S.events.filter(e=>e.unit_id===u.id&&e.kind==='edit'&&e.before?.draft).sort((a,b)=>b.id-a.id)[0]?.before?.draft;
 const prior=u.final||historyBase;
 if(!prior)return '<div class="help">Primeira proposta: nenhuma versão anterior para comparar.</div>';
 const flat=(o,prefix='',ret={})=>{for(const [key,v] of Object.entries(o||{})){let path=prefix?prefix+'.'+key:key;if(v&&typeof v==='object'&&!Array.isArray(v))flat(v,path,ret);else ret[path]=Array.isArray(v)?v.join(' | '):String(v??'')}return ret};
 const before=flat(prior),after=flat(u.draft);
 const changed=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(k=>before[k]!==after[k]);
 if(!changed.length)return '<div class="help">Proposta reaberta sem mudanças no texto. Ainda requer nova aprovação dos dois.</div>';
 return '<div class="compare"><div class="line"><div class="key">Campo</div><div class="key">Definitivo anterior</div><div class="key">Nova proposta</div></div>'+
 changed.map(k=>'<div class="line"><div class="key">'+esc(k)+'</div><div>'+esc(before[k]||'—')+'</div><div>'+esc(after[k]||'—')+'</div></div>').join('')+'</div>';
}
function history(u){
 const ev=S.events.filter(e=>e.unit_id===u.id).slice().sort((a,b)=>b.id-a.id);
 if(!ev.length)return '<p class="sub">Sem movimentações registradas.</p>';
 return '<div class="history">'+ev.map(e=>'<div class="event"><div><strong>'+esc(e.author_role?.toUpperCase())+
 '</strong> <span class="pill">'+esc({create:'Criou proposta',edit:'Editou texto',approve:'Aprovou',reopen:'Reabriu revisão',withdraw:'Retirou aprovação',comment:'Comentou',resolve_comment:'Resolveu comentário'}[e.kind]||e.kind)+'</span></div>'+
 '<div class="sub">Versão '+e.revision+' · '+date(e.created_at)+'</div>'+
 (e.kind==='edit'&&e.before?'<details><summary class="small">Ver alteração desta versão</summary><pre style="white-space:pre-wrap;font-size:11px;overflow-wrap:anywhere">'+esc(JSON.stringify(e.after,null,2))+'</pre></details>':'')+'</div>').join('')+'</div>';
}
function renderSidebar(){
 $('#who').textContent=S.role?'Logado como '+S.role.toUpperCase()+' · '+S.email:'Autenticação necessária';
 const n=required().length,complete=done();
 $('#progressTop').innerHTML='<div class="progress"><div style="width:'+(n?Math.round(100*complete/n):0)+'%"></div></div><div class="sub">'+complete+' de '+n+' unidades aprovadas por ambos</div>';
 const q=S.query.toLocaleLowerCase('pt-BR');
 let list=S.units.filter(u=>(!q||(u.title+' '+u.section).toLocaleLowerCase('pt-BR').includes(q))&&(
 S.filter==='todos'||S.filter==='aprovados'&&(locked(u)||exempt(u))||S.filter==='meus'&&awaitingMe(u)));
 let prev='',h='';
 for(const u of list){
  if(u.section!==prev){prev=u.section;h+='<div class="sec-label">'+esc(prev)+'</div>'}
  let [state,cls]=label(u);
  h+='<button class="unit '+(S.selected===u.id?'selected':'')+'" data-unit="'+esc(u.id)+'" title="'+esc(state)+'"><div><div class="name">'+esc(u.title)+'</div><div class="meta">v'+u.revision+' · '+state+'</div></div><span class="dot '+cls+'"></span></button>';
 }
 const candidate=(S.aiSuggestions||[]).filter(p=>p.state==='pending'&&(!q||(p.title+' '+p.reason).toLocaleLowerCase('pt-BR').includes(q)));
 const proposalHtml=candidate.length?'<div class="sec-label">✦ Propostas da IA ('+candidate.length+')</div>'+
   candidate.map(p=>'<button class="unit ai-unit" data-suggestion="'+p.id+'"><div><div class="name">✦ '+esc(p.title)+'</div><div class="meta">Proposta · '+(p.kind==='add_topic'?'incluir':'revisar')+' · aguarda decisão</div></div><span class="dot revision"></span></button>').join(''):'';
 $('#unitList').innerHTML=proposalHtml+(h||'<p class="sub" style="padding:8px">Nenhum tópico neste filtro.</p>');
 document.querySelectorAll('[data-filter]').forEach(b=>b.classList.toggle('active',b.dataset.filter===S.filter));
 $('#addUnit').disabled=!isAuthor();
}
function renderAI(){
 return '<div class="card ai-panel"><div class="row spread"><h2><span class="ai-icon">✦</span> IA · terceira participante</h2><span class="pill '+(S.aiReady?'approved':'pending')+'">'+(S.aiReady?'Disponível':S.aiReferenceOk?'Chave pendente':'Verificando memória')+'</span></div>'+
 '<p class="sub">Crítica objetiva, sem concordância automática. Só responde quando solicitada. Sugere alterações, mas não aprova.</p>'+ 
 '<p class="sub">Analisa somente este tópico, as últimas intervenções registradas nele e <a href="https://github.com/gilkleber-design/ctmed-command-center/blob/main/live/CONTEXTO-IA.md" target="_blank" rel="noopener noreferrer">o resumo MD ↗</a>.</p>'+
 (S.aiReady?'<form id="aiForm"><label class="field"><span class="label">Orientação adicional (opcional)</span><textarea id="aiPrompt" rows="2" maxlength="600" placeholder="Opcional. A IA já lê o conteúdo e a conversa deste tópico."></textarea></label><div class="row"><button class="primary" id="aiSend" type="submit" '+(S.aiBusy?'disabled':'')+'>'+(S.aiBusy?'Analisando...':'✦ Analisar tópico e discussão')+'</button></div></form>':'<div class="help">'+(S.aiReferenceOk?'A integração da memória funciona. Falta configurar a chave OPENAI_API_KEY no Supabase.':'A memória de referência não está acessível. Verifique o arquivo CONTEXTO-IA.md e recarregue.')+'</div>')+
 (S.aiTokens?'<p class="sub">Última análise: '+S.aiTokens.input+' tokens de entrada · '+S.aiTokens.output+' de saída.</p>':'')+
 '</div>';
}
function renderWork(){
 const u=selected();
 if(!u){$('#work').innerHTML='<div class="card">Não há tópicos disponíveis.</div>';return}
 const [txt,cl]=label(u),isFinal=locked(u),issues=openIssues(u),mine=isAuthor()?approvedBy(u,S.role):false;
 if(!S.draft||S.selected!==S._draftFor){S.draft=structuredClone(u.draft);S.editTitle=u.title;S.baseRev=u.revision;S._draftFor=S.selected;S.dirty=false}
 const tabBtn=(id,name)=>'<button data-tab="'+id+'" class="'+(S.tab===id?'on':'')+'">'+name+'</button>';
 const header='<div class="titlebar"><div><div class="eyebrow">'+esc(statusNames[u.kind]||u.kind)+' · VERSÃO '+u.revision+'</div><h1>'+esc(u.title)+'</h1><p class="sub">'+esc(u.section)+' · '+date(u.updated_at)+'</p></div><span class="pill '+cl+'">'+txt+'</span></div>';
 let main='';
 if(S.tab==='conteudo'){
  main='<div class="card"><div class="row spread"><h2>Proposta em análise</h2><span class="pill">'+(isFinal?'Travado':'Editável')+'</span></div>'+
  '<div class="field"><div class="label">Título do tópico</div><input data-title="true" value="'+esc(S.editTitle)+'" '+(isFinal||!isAuthor()?'disabled':'')+'></div>'+
  '<div class="editor">'+sectionEditor(u)+'</div></div>';
  if(u.final&&u.final_revision!==u.revision)main+='<div class="help"><strong>Versão definitiva preservada:</strong> v'+u.final_revision+'. Esta proposta só a substitui após a aprovação de Gil e Diego.</div>';
 } else if(S.tab==='comparar')main='<div class="card"><h2>Comparar proposta e definitivo</h2>'+diff(u)+'</div>';
 else main='<div class="card"><h2>Histórico auditável</h2>'+history(u)+'</div>';
 let buttons='';
 if(isAuthor()){
  if(exempt(u))buttons='<button class="primary" data-action="next">Próximo item pendente →</button>';
  else if(isFinal)buttons='<button data-action="next" class="primary">Próximo item pendente →</button><button data-action="reopen">Reabrir para revisão</button>';
  else buttons='<button data-action="save" '+(S.dirty?'class="primary"':'')+'>Salvar nova versão</button>'+
    '<button class="good" data-action="approve" '+(mine||issues?'disabled':'')+'>✓ '+(mine?'Você já aprovou':'Aprovar versão '+u.revision)+'</button>'+
    (mine?'<button class="ghost" data-action="withdraw">Retirar minha aprovação</button>':'');
 }
 const warn=issues?'<p class="sub alertbox">Há '+issues+' comentário(s) sem resolução nesta versão. Resolva-os antes de aprovar.</p>':'';
 const bottom='<div class="toolbar"><div class="actions">'+buttons+'</div><div class="sub">'+(isFinal?'Versão consolidada, alterações somente por revisão':S.dirty?'Alterações locais não salvas':'Gil e Diego devem aprovar a mesma versão')+'</div></div>';
 $('#work').innerHTML=header+'<div class="tabs">'+tabBtn('conteudo','Conteúdo')+tabBtn('comparar','Comparar versões')+tabBtn('historico','Histórico')+'</div>'+main+warn+bottom+renderAI();
}
function renderDiscussion(){
 const u=selected();if(!u){$('#discussion').innerHTML='';return}
 const c=S.comments.filter(x=>x.unit_id===u.id).sort((a,b)=>a.id-b.id);
 const roster=S.roster||{};
 const approval=(role)=>'<div class="approval"><div class="who"><b>'+role.toUpperCase()+'</b>'+
 '<span class="pill '+(approvedBy(u,role)?'approved':'pending')+'">'+(approvedBy(u,role)?'✓ Aprovado':'Aguardando')+'</span></div>'+
 '<div class="stamp">'+(approvedBy(u,role)?'Aprovou a versão '+u.revision+' · '+date(u[role+'_approved_at']):!roster[role]?'Conta ainda não habilitada':'Pendente nesta versão')+'</div></div>';
 const total=required().length,canPub=total>0&&done()===total;
 let content='<div class="card"><h2>Dupla aprovação</h2><p class="sub">Aprovações são independentes e pertencem à versão atual. Editar reinicia ambas.</p>'+
 approval('gil')+approval('diego')+
 '<div class="sub">Comentários abertos: '+openIssues(u)+'</div></div>';
 content+='<div class="card"><h2>Discussão do tópico</h2><div class="sub">'+c.length+' comentário(s) · comentários vinculados à versão</div>'+
 (c.length?c.map(m=>'<div class="comment '+(m.resolved?'resolved':'')+'"><div class="row spread"><span class="author">'+esc(m.author_role.toUpperCase())+'</span><span class="info">v'+m.revision+' · '+date(m.created_at)+'</span></div>'+
 (m.anchor?'<div class="quote">Trecho: '+esc(m.anchor)+'</div>':'')+'<p>'+esc(m.body)+'</p>'+
 '<div class="row"><span class="pill '+(m.resolved?'approved':'pending')+'">'+(m.resolved?'Resolvido':'Em aberto')+'</span>'+
 (!m.resolved&&isAuthor()?'<button data-resolve="'+m.id+'" class="ghost">Resolver</button>':'')+
 '<button class="ghost" data-reply="'+m.id+'">Responder</button></div></div>').join(''):'<p class="sub">Ainda não há comentários. Discussões e sugestões ficam registradas aqui.</p>')+
 '<form id="commentForm"><label class="field"><span class="label">Comentar ou solicitar revisão</span><textarea id="commentBody" rows="3" required minlength="2" maxlength="4000" placeholder="O que precisa mudar? Por quê?"></textarea></label>'+
 '<label class="field"><span class="label">Trecho ou parâmetro (opcional)</span><input id="commentAnchor" maxlength="120" placeholder="Ex.: SpO₂ inicial, fala de Gil ou uma frase selecionada"></label>'+
 '<div id="replyHint" class="sub"></div><button class="primary" type="submit">Enviar comentário</button></form></div>';
 if(S.role==='gil'&&!roster.diego)content+='<div class="card"><h2>Convidar Diego</h2><p class="sub">Cadastre o segundo professor, que terá sua própria conta e aprovação independente.</p><form id="inviteForm"><label class="field"><span class="label">E-mail profissional de Diego</span><input id="inviteEmail" type="email" required autocomplete="off" placeholder="E-mail de Diego"></label><button class="primary" type="submit">Criar acesso para Diego</button></form><p class="sub">A senha provisória será exibida uma única vez para você compartilhar em canal privado.</p></div>';
 const proposals=(S.aiSuggestions||[]).filter(p=>p.unit_id===u.id&&p.state==='pending');

 if(proposals.length)content+='<div class="card"><h2>Atualizações sugeridas para a pauta</h2>'+
 proposals.map(p=>'<div class="ai-proposal"><div class="eyebrow">✦ PROPOSTA · '+(p.kind==='add_topic'?'NOVO TÓPICO':'REVISAR TÓPICO')+'</div><strong>'+esc(p.title)+'</strong><p>'+esc(p.body)+'</p><p class="sub">'+esc(p.reason)+'</p><div class="row"><button data-ai-apply="'+p.id+'" class="primary" '+(!isAuthor()?'disabled':'')+'>Aplicar como proposta</button><button data-ai-dismiss="'+p.id+'" '+(!isAuthor()?'disabled':'')+'>Descartar</button></div></div>').join('')+'</div>';
 content+='<div class="card"><h2>Publicação para o Maestro</h2><div class="metrics"><div class="metric"><b>'+done()+'/'+total+'</b><span>Dupla aprovação</span></div><div class="metric"><b>'+esc(S.release?.version||0)+'</b><span>Versões publicadas</span></div></div>'+
 '<div class="progress"><div style="width:'+(total?100*done()/total:0)+'%"></div></div>'+
 (S.release?.published_at?'<p class="sub">Última publicação: '+date(S.release.published_at)+'</p>':'<p class="sub">Nenhuma versão editorial publicada ainda. O Maestro anterior é um rascunho legado.</p>')+
 '<button class="primary" id="publish" '+(!canPub||!isAuthor()?'disabled':'')+'>Publicar versão aprovada</button>'+
 (!canPub?'<p class="sub">Faltam '+(total-done())+' tópico(s) com duas aprovações.</p>':'')+'</div>';
 $('#discussion').innerHTML=content;
}
function render(){renderSidebar();renderWork();renderDiscussion()}
async function fetchAll(){
 const [ur,cr,er,rr,ar]=await Promise.all([
 db.from('live_editorial_units').select('*').eq('lesson_id',ID).order('order_index'),
 db.from('live_editorial_comments').select('*').order('created_at'),
 db.from('live_editorial_events').select('*').order('id',{ascending:false}).limit(750),
 db.from('live_editorial_release').select('*').eq('id',ID).maybeSingle(),
 db.from('live_editorial_ai_suggestions').select('*').order('id',{ascending:false}).limit(100)
 ]);
 for(const x of [ur,cr,er,rr,ar])if(x.error)throw Error(x.error.message);
 S.units=ur.data||[];S.comments=cr.data||[];S.events=er.data||[];S.release=rr.data;S.aiSuggestions=ar.data||[];
 if(!S.units.some(u=>u.id===S.selected))S.selected=S.units[0]?.id||null;
}
async function refresh(){
 if(S.working)return;
 if(S.dirty||S.composing){S.pendingRefresh=true;$('#conn').textContent='● Outra atualização disponível';return}
 await fetchAll();const now=selected();
 if(now&&(S._draftFor!==S.selected||S.baseRev!==now.revision)){S.draft=null;S._draftFor=null}
 render();$('#conn').textContent='● Sincronizado';
}
async function action(kind,payload={}){
 if(S.working)return;const u=selected();if(!u)return;
 S.working=true;
 try{
  const r=await db.rpc('live_editorial_action',{p_action:kind,p_unit_id:u.id,p_expected_revision:S.baseRev,p_payload:payload});
  if(r.error)throw Error(r.error.message);
  if(kind==='edit'||kind==='reopen'||kind==='create')S.draft=null;
  S.dirty=false;S.pendingRefresh=false;await refresh();flash(kind==='approve'?'Aprovação registrada nesta versão':kind==='edit'?'Nova versão salva. Aprovações reiniciadas.':kind==='reopen'?'Proposta de revisão aberta':kind==='comment'?'Comentário enviado':'Atualizado');
  return r.data;
 }catch(e){flash(e.message);return null}
 finally{S.working=false;await refresh()}
}
function syncInputs(){
 if(S.tab!=='conteudo'||!S.draft)return;
 const title=$('[data-title]');if(title)S.editTitle=title.value;
 document.querySelectorAll('[data-field]').forEach(e=>set(S.draft,e.dataset.field,e.value));
 document.querySelectorAll('[data-check]').forEach(e=>set(S.draft,e.dataset.check,e.checked));
 let correct=$('[data-answer]');if(correct&&S.draft.scene?.poll)S.draft.scene.poll.correct=Number(correct.value);
}
function newUnitDraft(k,title,parent){
 const blank={id:'new-'+crypto.randomUUID(),title,minutes:4,vitals:{fc:'',pa:'',spo2:'',fr:'',etco2:''},clinical:'',gil:'',diego:'',cueGil:'',cueDiego:'',objective:'',technical:'',action:'',next:'',poll:null};
 if(k==='case')return {include:true,case_id:'new-'+crypto.randomUUID(),title,patient:'',approach:'',decision:'proposta'};
 if(k==='scene')return {include:true,case_id:parent,scene:blank};
 if(k==='intro'||k==='closing')return {include:true,scene:blank};
 return {include:true,text:''};
}
document.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.filter){S.filter=b.dataset.filter;renderSidebar();return}
 if(b.dataset.suggestion){
  const p=S.aiSuggestions.find(x=>String(x.id)===b.dataset.suggestion);
  if(!p)return;
  if(S.dirty&&!confirm('Descartar alterações locais e abrir proposta da IA?'))return;
  S.selected=p.unit_id;S.dirty=false;S.draft=null;S.tab='conteudo';render();return;
 }
 if(b.dataset.aiApply||b.dataset.aiDismiss){
  if(S.dirty)return flash('Salve a edição local antes de aplicar uma sugestão');
  const suggestionId=Number(b.dataset.aiApply||b.dataset.aiDismiss);
  if(b.dataset.aiApply&&!confirm('Adicionar esta sugestão à pauta como proposta ainda sujeita à dupla aprovação?'))return;
  const task=b.dataset.aiApply?'apply':'dismiss';
  const {data,error}=await db.rpc('live_editorial_ai_decide',{p_suggestion:suggestionId,p_action:task});
  if(error)return flash(error.message);
  S.draft=null;S.dirty=false;await refresh();
  if(task==='apply'&&data?.unit){S.selected=data.unit;S.draft=null;render()}
  flash(task==='apply'?'Proposta adicionada para revisão de Gil e Diego.':'Sugestão descartada.');
  return;
 }
 
 if(b.dataset.unit){if(S.dirty&&!confirm('Há alterações locais não salvas. Descartar e mudar de tópico?'))return;S.selected=b.dataset.unit;S.draft=null;S.tab='conteudo';S.dirty=false;S.composing=false;render();return}
 if(b.dataset.tab){if(S.dirty)syncInputs();S.tab=b.dataset.tab;renderWork();return}
 if(b.dataset.reply){const m=S.comments.find(c=>String(c.id)===b.dataset.reply);if(!m)return;window._replyTo=m.id;$('#replyHint').textContent='Respondendo ao comentário #'+m.id+' de '+m.author_role.toUpperCase();$('#commentBody').focus();return}
 if(b.dataset.resolve){await action('resolve_comment',{comment_id:Number(b.dataset.resolve)});return}
 if(b.dataset.action){
  const type=b.dataset.action,u=selected();
  if(type==='next'){const open=S.units.find(x=>!locked(x)&&!exempt(x));if(!open)return flash('Todas as partes já foram aprovadas');S.selected=open.id;S.draft=null;S.tab='conteudo';S.dirty=false;render();return}
  if(type==='save'){syncInputs();if(!S.dirty){flash('Nenhuma alteração pendente');return}await action('edit',{title:S.editTitle,draft:S.draft});return}
  if(type==='approve'){if(S.dirty){flash('Salve as alterações antes de aprovar');return}await action('approve');return}
  if(type==='withdraw'){await action('withdraw');return}
  if(type==='reopen'){if(!confirm('Abrir uma nova revisão? O definitivo anterior será preservado e ambas as aprovações terão de ser renovadas.'))return;await action('reopen');return}
  if(type==='remove_poll'||type==='add_poll'){
   syncInputs();S.draft.scene.poll=type==='remove_poll'?null:{question:'',options:['','','',''],correct:0,explanation:''};
   S.dirty=true;renderWork();return
  }
 }
 if(b.id==='addUnit'){
  $('#newUnitParent').innerHTML=S.units.filter(u=>u.kind==='case').map(u=>'<option value="'+esc(u.draft.case_id)+'">'+esc(u.title)+'</option>').join('');
  $('#newUnitDialog').showModal();return;
 }
 if(b.id==='cancelNewUnit'){$('#newUnitDialog').close();return}
 if(b.id==='copyInvite'){try{await navigator.clipboard.writeText($('#inviteResultPassword').textContent);flash('Senha provisória copiada')}catch{flash('Selecione a senha exibida e copie manualmente')}return}
 if(b.id==='closeInvite'){$('#inviteResultPassword').textContent='';$('#inviteResultDialog').close();return}
 if(b.id==='publish'){
  if(!confirm('Publicar todos os tópicos aprovados no Maestro? A versão anterior permanece registrada no histórico do projeto.'))return;
  let r=await db.rpc('live_editorial_publish');
  if(r.error){flash(r.error.message);return}
  await refresh();flash('Versão aprovada publicada para o Maestro.');
 }
});
document.addEventListener('mouseup',e=>{
 if(!e.target.matches('[data-field]'))return;
 const input=e.target;const phrase=input.value.slice(input.selectionStart||0,input.selectionEnd||0).trim();
 if(phrase.length>1&&phrase.length<=120){const anchor=$('#commentAnchor');if(anchor)anchor.value=phrase}
});
document.addEventListener('input',e=>{
 if(e.target.id==='aiPrompt'){S.composing=true;return}
 if(e.target.id==='search'){S.query=e.target.value;renderSidebar();return}if(e.target.id==='commentBody'||e.target.id==='commentAnchor'){S.composing=true;return}
 if(e.target.matches('[data-field],[data-title],[data-check],[data-answer]')){S.dirty=true}
});
document.addEventListener('change',e=>{if(e.target.matches('[data-check],[data-answer]'))S.dirty=true});
document.addEventListener('submit',async e=>{
 if(e.target.id==='aiForm'){
   e.preventDefault();
   if(!S.aiReady||S.aiBusy)return;
   if(S.dirty)return flash('Salve as alterações locais antes da análise da IA');
   const unit=selected(),prompt=$('#aiPrompt')?.value.trim()||'';
   if(!unit)return;
   S.aiBusy=true;S.composing=true;
   const send=$('#aiSend');if(send){send.disabled=true;send.textContent='Analisando...'}
   try{
     const {data:{session}}=await db.auth.getSession();
     if(!session)throw Error('Sessão expirada. Entre novamente pelo Command Center');
     const response=await fetch(api+'/functions/v1/live-editorial-ai',{
       method:'POST',headers:{'authorization':'Bearer '+session.access_token,'apikey':key,'content-type':'application/json'},
       body:JSON.stringify({action:'analyze',unit_id:unit.id,message:prompt})
     });
     const data=await response.json();
     if(!response.ok)throw Error(data.error||'Erro na análise da IA');
     S.aiTokens=data.tokens||null;
     S.composing=false;
     await refresh();
     flash(data.proposals_saved?'IA respondeu e sugeriu '+data.proposals_saved+' atualização(ões) de pauta.':'IA respondeu na discussão.');
   }catch(err){flash(err.message);S.composing=true;const b=$('#aiSend');if(b){b.disabled=false;b.textContent='✦ Analisar tópico e discussão'}}
   finally{S.aiBusy=false}
   return;
 }
 if(e.target.id==='inviteForm'){
  e.preventDefault();
  const email=$('#inviteEmail').value.trim().toLowerCase();
  if(!confirm('Criar conta individual de Diego para '+email+'?'))return;
  try{
   const {data:{session}}=await db.auth.getSession();
   const response=await fetch(api+'/functions/v1/live-studio-invite',{
    method:'POST',headers:{'authorization':'Bearer '+session.access_token,'apikey':key,'content-type':'application/json'},
    body:JSON.stringify({email})});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||'Não foi possível cadastrar Diego');
   S.roster={...S.roster,diego:true};
   $('#inviteResultEmail').textContent=data.email;
   $('#inviteResultPassword').textContent=data.temporary_password;
   $('#inviteResultDialog').showModal();
   renderDiscussion();
  }catch(err){flash(err.message)}
  return;
 }
 if(e.target.id==='commentForm'){
  e.preventDefault();let body=$('#commentBody').value.trim();if(!body)return;
  const reply_to=window._replyTo||null;
  window._replyTo=null;if(S.dirty){flash('Salve ou descarte as edições locais antes de comentar');return}S.composing=false;const payload={body,anchor:$('#commentAnchor').value};if(reply_to)payload.reply_to=reply_to;await action('comment',payload);return;
 }
 if(e.target.id==='newUnitForm'){
  e.preventDefault();
  const f=new FormData(e.target),kind=f.get('kind'),title=String(f.get('title')).trim(),parent=f.get('parent');
  const parentU=S.units.find(u=>u.draft.case_id===parent),section=kind==='scene'?(parentU?.section||'Novas cenas'):'05 · Novas propostas';
  const r=await db.rpc('live_editorial_action',{p_action:'create',p_unit_id:null,p_expected_revision:null,p_payload:{title,kind,section,draft:newUnitDraft(kind,title,parent)}});
  if(r.error){flash(r.error.message);return}
  $('#newUnitDialog').close();await refresh();S.selected=r.data.unit_id;S.draft=null;render();flash('Novo tópico criado para aprovação de Gil e Diego.');
 }
});
async function start(){
 const s=await db.auth.getSession();
 if(!s.data.session){$('#conn').textContent='● Acesso necessário';$('#work').innerHTML='<div class="card login"><h1>Acesso da equipe</h1><p>Entre no Command Center uma única vez para acessar a construção colaborativa.</p><a href="../">← Voltar para autenticação do Command Center</a></div>';$('#discussion').innerHTML='';return}
 S.email=s.data.session.user.email||'';
 const r=await db.rpc('live_editorial_role');if(r.error)throw Error(r.error.message);
 S.role=r.data;
 if(!S.role){$('#work').innerHTML='<div class="card login"><h1>Sem permissão de equipe</h1><p>Esta conta não está cadastrada para trabalhar na LIVE.</p><a href="../">← Command Center</a></div>';$('#conn').textContent='● Sem permissão';$('#discussion').innerHTML='';return}
 const roster=await db.rpc('live_editorial_roster');
 S.roster=roster.data||{};
 try{
   const check=await fetch(api+'/functions/v1/live-editorial-ai',{method:'POST',
    headers:{'authorization':'Bearer '+s.data.session.access_token,'apikey':key,'content-type':'application/json'},
    body:JSON.stringify({action:'status'})});
   const availability=await check.json();S.aiReferenceOk=check.ok&&availability.reference_ok===true;S.aiReady=check.ok&&availability.configured===true&&S.aiReferenceOk;
 }catch{S.aiReady=false;S.aiReferenceOk=false}
 await refresh();
 db.channel('editorial-live').on('postgres_changes',{event:'*',schema:'public',table:'live_editorial_units'},()=>refresh())
  .on('postgres_changes',{event:'*',schema:'public',table:'live_editorial_comments'},()=>refresh())
  .on('postgres_changes',{event:'*',schema:'public',table:'live_editorial_ai_suggestions'},()=>refresh()).subscribe();
 setInterval(()=>{if(!S.dirty&&!S.composing)refresh()},16000);
}
await start();
})().catch(err=>{
 const w=document.querySelector('#work');if(w)w.innerHTML='<div class="card"><h2>Erro no LIVE Studio</h2><p>'+String(err.message).replace(/[<>]/g,'')+'</p><p><a href="../">Voltar ao Command Center</a></p></div>';
});
