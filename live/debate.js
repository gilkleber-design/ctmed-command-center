
(async()=>{
'use strict';
const $=q=>document.querySelector(q);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cfg=await fetch('../index.html',{cache:'no-store'}).then(r=>r.text());
const url=cfg.match(/SUPABASE_URL:'([^']+)'/)?.[1],key=cfg.match(/SUPABASE_ANON_KEY:'([^']+)'/)?.[1];
if(!url||!key||!window.supabase)throw Error('Configuração do Supabase indisponível');
const db=window.supabase.createClient(url,key);
const S={role:null,units:[],sections:[],proposals:[],comments:[],view:'agenda',roster:{},busy:false,
 chatDraft:'',consensusDirty:false,proposalDirty:false,proposalDraft:'',proposalOwner:'',
 editVersion:null,typing:false,updated:false,replyTo:null,loading:false};
const authors=['gil','diego'];
const selected=()=>S.units.find(u=>u.id===S.view);
const current=()=>S.sections.find(x=>x.unit_id===S.view);
const myProposal=()=>S.proposals.find(p=>p.author_role===S.role);
const roleName=x=>x==='gil'?'Gil':x==='diego'?'Diego':x==='ia'?'IA':String(x||'').toUpperCase();
const fixed=x=>x&&x.fixed_version===x.version;
const approved=(s,a)=>s&&s[a+'_approved_version']===s.version;
const status=s=>fixed(s)?'Fixo':s?.fixed_version?'Revisão aberta':approved(s,'gil')||approved(s,'diego')?'Uma aprovação':s?.consensus_text?'Consenso em construção':'Em debate';
const badge=s=>fixed(s)?'fixed':approved(s,'gil')||approved(s,'diego')?'review':'open';
const initials=a=>a==='diego'?'D':a==='gil'?'G':'✦';
const date=t=>t?new Date(t).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';
const canEdit=()=>authors.includes(S.role);
function flash(txt,isError=false){
 const target=$('#toast');target.textContent=txt;target.className=isError?'toast error':'toast';
 target.hidden=false;clearTimeout(flash.timer);flash.timer=setTimeout(()=>{target.hidden=true},6400);
}
function sideUnit(u){
 const sec=S.sections.find(s=>s.unit_id===u.id),st=status(sec);
 return '<button class="nav-item '+(S.view===u.id?'selected':'')+'" data-open="'+esc(u.id)+'">'+
 '<span class="nav-name">'+esc(u.title)+'</span>'+
 '<span class="nav-state '+badge(sec)+'">'+(fixed(sec)?'✓ ': '')+esc(st)+'</span></button>';
}
function renderSidebar(){
 const fixedOnes=S.units.filter(u=>fixed(S.sections.find(s=>s.unit_id===u.id)));
 const created=S.units.filter(u=>u.section==='Construção · Novas seções');
 const active=S.units.filter(u=>!fixed(S.sections.find(s=>s.unit_id===u.id))&&(u.id==='agenda'||created.some(x=>x.id===u.id)));
 const old=S.units.filter(u=>!created.some(x=>x.id===u.id)&&u.id!=='agenda'&&!fixed(S.sections.find(s=>s.unit_id===u.id)));
 const ps=S.proposals.filter(x=>x.shared).length;
 $('#nav').innerHTML=
  '<div class="nav-section"><div class="nav-heading">PONTO DE PARTIDA</div>'+
  '<button data-open="pedagogy" class="nav-item '+(S.view==='pedagogy'?'selected':'')+'"><span class="nav-name">Proposta Pedagógica Prévia</span><span class="nav-state">'+ps+'/2 compartilhadas</span></button></div>'+
  '<div class="nav-section"><div class="nav-heading">CARDS FIXOS · '+fixedOnes.length+'</div>'+
   (fixedOnes.length?fixedOnes.map(sideUnit).join(''):'<p class="nav-empty">Os consensos aprovados pelos dois professores aparecerão aqui.</p>')+'</div>'+
  '<div class="nav-section"><div class="nav-heading">EM DEBATE</div>'+active.map(sideUnit).join('')+
  (canEdit()?'<button id="addSection" class="add-section">+ Abrir uma nova seção</button>':'')+'</div>'+
  '<details class="archived" id="legacyList" '+(old.some(x=>x.id===S.view)?'open':'')+'><summary>Materiais anteriores · '+old.length+' <span>▾</span></summary><p class="nav-empty">Conteúdo anterior preservado para consulta e eventual aproveitamento.</p>'+
  old.map(sideUnit).join('')+'</details>';
}
function proposalCard(role){
 const own=role===S.role,rec=S.proposals.find(x=>x.author_role===role);
 if(!rec&&!own)return '<div class="proposal-card"><div class="split"><h3>Proposta de '+roleName(role)+'</h3><span class="chip private">Privada</span></div><p class="muted">O autor ainda não habilitou a visualização.</p></div>';
 if(!rec)return '';
 const privateState=rec.shared?'Compartilhada':'Privada';
 return '<div class="proposal-card"><div class="split"><h3>Proposta de '+roleName(role)+'</h3><span class="chip '+(rec.shared?'fixed':'private')+'">'+privateState+'</span></div>'+
 '<p class="small">Versão '+rec.version+' · '+date(rec.updated_at)+(own?' · editável apenas por você':' · somente leitura')+'</p>'+
 (own?'<textarea id="myProposal" aria-label="Minha proposta pedagógica" rows="15" maxlength="16000">'+esc(S.proposalDirty?S.proposalDraft:rec.content)+'</textarea>'+
  '<div class="form-actions"><button id="saveProposal" class="primary" '+(S.busy?'disabled':'')+'>Salvar minha proposta</button>'+
  '<button id="toggleShare" class="secondary" '+(S.busy||S.proposalDirty?'disabled':'')+'>'+(rec.shared?'Tornar privada':'Compartilhar com '+roleName(role==='gil'?'diego':'gil'))+'</button></div>'+
  (S.proposalDirty?'<p class="notice">Salve antes de modificar a visibilidade.</p>':''):
  '<div class="proposal-text">'+esc(rec.content||'Ainda sem conteúdo')+'</div>')+
 '</div>';
}
function renderPedagogy(){
 $('#page').innerHTML='<div class="page-title"><div class="eyebrow">REFERÊNCIA INDIVIDUAL · ETAPA PRELIMINAR</div><h1>Proposta Pedagógica Prévia</h1>'+
 '<p>Dois documentos independentes. Cada autor controla quando o outro pode ler sua proposta. Nenhum deles é automaticamente o roteiro consensual.</p></div>'+
 '<div class="proposal-grid">'+authors.map(proposalCard).join('')+'</div>'+
 '<div class="info-note"><strong>Histórico preservado:</strong> recuperamos as propostas originais dos registros editoriais. A discussão já iniciada entre Gil e Diego está no card “Esqueleto central da LIVE”.</div>'+
 '<div class="form-actions"><button data-open="agenda" class="primary">Ir para o debate do esqueleto →</button><a class="text-link" href="./revisao-legado.html">Abrir editor anterior preservado ↗</a></div>';
}
function thread(){
 const all=S.comments.filter(c=>c.unit_id===S.view).sort((a,b)=>a.id-b.id);
 const byId=new Map(all.map(m=>[Number(m.id),m]));
 return all.length?all.map(m=>{
  const prior=m.reply_to?byId.get(Number(m.reply_to)):null;
  return '<article class="message '+(m.author_role==='ia'?'ai-message':'')+(m.reply_to?' is-reply':'')+'"><div class="message-head"><div class="avatar role-'+esc(m.author_role)+'">'+initials(m.author_role)+'</div>'+
  '<div><strong>'+roleName(m.author_role)+'</strong><div class="small">'+date(m.created_at)+' · registro v'+m.revision+'</div></div></div>'+
  (prior?'<div class="reply-context">↳ Em resposta a '+roleName(prior.author_role)+': '+esc(prior.body.slice(0,150))+'</div>':'')+
  (m.anchor&&m.anchor!=='@IA'?'<p class="message-anchor">'+esc(m.anchor)+'</p>':'')+
  '<p class="message-body">'+esc(m.body)+'</p>'+
  (canEdit()?'<div class="message-actions"><button data-reply="'+m.id+'">↩ Responder a '+roleName(m.author_role)+'</button></div>':'')+
  '</article>';
 }).join(''):'<div class="empty-chat"><strong>Este debate ainda não começou.</strong><p>Registrem argumentos, divergências e propostas para formular um texto de consenso.</p></div>';
}
function consensusCard(u,s){
 const isFixed=fixed(s),one=approved(s,'gil')||approved(s,'diego');
 const lockedText=s.fixed_text||'';
 const share=''+(isFixed?'Texto consensual aprovado':'Texto para consenso · versão '+s.version);
 const msg='<div class="vote-box"><div class="vote"><span>Gil</span><span class="chip '+(approved(s,'gil')?'fixed':'private')+'">'+(approved(s,'gil')?'✓ Aprovou':'Pendente')+'</span></div><div class="vote"><span>Diego</span><span class="chip '+(approved(s,'diego')?'fixed':'private')+'">'+(approved(s,'diego')?'✓ Aprovou':'Pendente')+'</span></div></div>';
 const editing=canEdit()&&!isFixed;
 const text=S.consensusDirty&&S.editVersion===s.version?S._consensusTemp:s.consensus_text;
 return '<section class="consensus card '+(isFixed?'fixed-card':'')+'"><div class="split"><h2>Texto de consenso</h2><span class="chip '+(isFixed?'fixed':one?'review':'private')+'">'+status(s)+'</span></div>'+
 '<p class="small">'+(isFixed?'Card fixo. Alterações exigem nova revisão e dupla aprovação.':'Escrevam aqui apenas o texto que querem consolidar. As propostas individuais e o chat permanecem intactos.')+'</p>'+
 (editing?'<textarea id="consensusInput" rows="13" placeholder="Após a discussão, formulem aqui o texto que ambos poderão aprovar.">'+esc(text||'')+'</textarea>':
  '<div class="consensus-read">'+esc(isFixed?lockedText:s.consensus_text||'Ainda não há uma formulação consensual.')+'</div>')+
 (s.fixed_version&&!isFixed?'<div class="previous"><strong>Último consenso fixo · v'+s.fixed_version+'</strong><p>'+esc(s.fixed_text)+'</p></div>':'')+
 msg+
 (canEdit()?'<div class="form-actions wrap">'+(isFixed?'<button data-consensus="reopen" class="secondary">Abrir revisão</button>':
  '<button data-consensus="save" class="secondary" '+(S.busy?'disabled':'')+'>Salvar texto</button>'+
  (S.consensusDirty?'<span class="small">Alterações não salvas</span>':
   (approved(s,S.role)?'<button data-consensus="withdraw" class="secondary">Retirar minha aprovação</button>':'<button data-consensus="approve" class="primary" '+(!s.consensus_text?.trim()?'disabled':'')+'>Aprovar este texto</button>')))+
 '</div>':'')+
 '<p class="small">A IA pode sugerir soluções, mas nunca aprova nem fixa uma decisão. Fixar um card não publica automaticamente a aula no Maestro.</p>'+
 '</section>';
}
function renderSection(){
 const u=selected(),s=current();
 if(!u||!s){$('#page').innerHTML='<div class="card">Seção não encontrada. Atualize a página.</div>';return}
 const label=u.id==='agenda'?'Esqueleto central da LIVE':u.title;
 const n=S.comments.filter(c=>c.unit_id===u.id).length;
 const prior=authors.filter(a=>S.proposals.some(p=>p.author_role===a&&p.shared));
 const comparison=u.id==='agenda'?
  '<div class="info-note"><strong>Propostas pedagógicas originais:</strong> '+(prior.length?prior.map(a=>roleName(a)).join(' e ')+' compartilhou sua proposta.':'Ambas continuam privadas até que cada autor as compartilhe.')+
  ' <button data-open="pedagogy" class="inline-button">Ver propostas →</button></div>':'';
 $('#page').innerHTML='<div class="page-title"><div class="eyebrow">SEÇÃO EM ANÁLISE · '+esc(u.kind.toUpperCase())+'</div>'+
 '<div class="split title-split"><h1>'+esc(label)+'</h1><span class="chip '+(fixed(s)?'fixed':'review')+'">'+status(s)+'</span></div>'+
 '<p>A discussão e o consenso abaixo pertencem exclusivamente a este card. Mensagens de outros casos não aparecem aqui.</p></div>'+
 comparison+
 '<div class="editor-grid"><section class="discussion card"><div class="split"><div><h2>Debate da seção</h2><p class="small">'+n+' intervenção(ões) · conversa preservada</p></div><span class="chat-symbol">◉</span></div>'+
 '<div class="thread" id="thread">'+thread()+'</div>'+
 (canEdit()?'<form id="chatForm"><div id="replyIndicator" class="reply-label" '+(!S.replyTo?'hidden':'')+'>'+renderReplyIndicator()+'</div>'+
 '<label for="chatText" class="small bold">Sua contribuição</label><textarea id="chatText" rows="3" maxlength="4000" placeholder="Discuta a proposta, responda ao colega ou apresente uma alternativa...">'+esc(S.chatDraft)+'</textarea>'+
 '<div class="form-actions"><button type="submit" class="primary" '+(S.busy?'disabled':'')+'>Enviar mensagem</button>'+
 '<button type="button" id="askAI" class="secondary" '+(S.busy?'disabled':'')+'>✦ Analisar discussão com IA</button></div>'+
 '<div id="aiInline" class="ai-inline" role="status" aria-live="polite"></div></form>':'')+
 '</section>'+consensusCard(u,s)+'</div>'+
 '<div class="info-note">Os materiais, casos e versões anteriores estão <a href="./revisao-legado.html">preservados no editor original</a>. Nenhuma proposta individual é sobrescrita quando o consenso muda.</div>';
}
function renderReplyIndicator(){
 if(!S.replyTo)return '';
 const m=S.comments.find(c=>Number(c.id)===Number(S.replyTo));
 return m?'Respondendo a '+roleName(m.author_role)+': '+esc(m.body.slice(0,95))+' <button type="button" id="cancelReply">Cancelar</button>':'';
}
function render(){
 $('#identity').textContent=S.role?'Conectado como '+roleName(S.role):'Conta não identificada';
 renderSidebar();if(S.view==='pedagogy')renderPedagogy();else renderSection();
}
async function load(){
 const [u,s,p,c,r]=await Promise.all([
  db.from('live_editorial_units').select('*').eq('lesson_id','sprint-isr').order('order_index'),
  db.from('live_debate_sections').select('*'),
  db.from('live_pedagogy_proposals').select('*'),
  db.from('live_editorial_comments').select('*').order('created_at'),
  db.rpc('live_editorial_roster')
 ]);
 for(const v of [u,s,p,c])if(v.error)throw Error(v.error.message);
 S.units=u.data||[];S.sections=s.data||[];S.proposals=p.data||[];S.comments=c.data||[];S.roster=r.data||{};
 if(!S.units.some(u=>u.id===S.view)&&S.view!=='pedagogy')S.view='agenda';
}
async function refresh(silent=false){
 if(S.busy||S.consensusDirty||S.proposalDirty||S.typing){S.updated=true;return}
 try{await load();render();if(!silent)$('#conn').textContent='● Sincronizado';}
 catch(e){$('#conn').textContent='● Falha de sincronização';if(!silent)flash(e.message,true)}
}
async function debate(action,text=''){
 const s=current();if(!s)return;
 if(action==='save'&&text.trim().length<5)return flash('Consenso precisa de pelo menos cinco caracteres.',true);
 S.busy=true;
 try{
 const r=await db.rpc('live_debate_action',{p_action:action,p_unit_id:S.view,p_expected_version:s.version,p_payload:action==='save'?{text}:{}});
 if(r.error)throw Error(r.error.message);
 S.consensusDirty=false;S._consensusTemp='';S.editVersion=null;
 S.busy=false;await refresh();
 flash(action==='approve'?(r.data?.fixed?'Consenso fixado com aprovação dos dois.':'Sua aprovação foi registrada. Falta a do outro professor.'):action==='save'?'Texto de consenso salvo. Aprovações anteriores reiniciadas.':action==='reopen'?'Revisão aberta. Versão fixa anterior preservada.':'Sua aprovação foi retirada.');
 }catch(e){S.busy=false;flash(e.message,true)}
}
async function sendChat(){
 const body=S.chatDraft.trim();if(!body||S.busy)return;
 const unit=S.view,reply=S.replyTo;S.busy=true;
 try{
  const payload={body,anchor:''};if(reply)payload.reply_to=reply;
  const r=await db.rpc('live_editorial_action',{p_action:'comment',p_unit_id:unit,p_expected_revision:null,p_payload:payload});
  if(r.error)throw Error(r.error.message);
  S.chatDraft='';S.replyTo=null;S.typing=false;S.busy=false;await refresh();
  $('#thread')?.lastElementChild?.scrollIntoView({block:'nearest'});
 }catch(e){S.busy=false;flash(e.message,true)}
}
async function pedagogy(action,value){
 const own=myProposal();if(!own)return flash('Sua proposta não foi encontrada.',true);
 S.busy=true;
 try{
  const r=await db.rpc('live_pedagogy_action',{p_action:action,p_content:action==='save'?value:null,p_shared:action==='share'?value:null,p_expected_version:own.version});
  if(r.error)throw Error(r.error.message);
  S.proposalDirty=false;S.proposalDraft='';S.busy=false;await refresh();
  flash(action==='save'?'Proposta individual salva.':value?'Proposta compartilhada com o outro professor.':'Proposta voltou a ser privada.');
 }catch(e){S.busy=false;flash(e.message,true)}
}
async function ai(){
 if(S.busy)return;S.busy=true;
 const out=$('#aiInline');if(out){out.className='ai-inline';out.textContent='Analisando apenas a conversa e o conteúdo desta seção...'}
 try{
  const {data:{session}}=await db.auth.getSession();if(!session)throw Error('Faça login novamente');
  const r=await fetch(url+'/functions/v1/live-editorial-ai',{method:'POST',headers:{authorization:'Bearer '+session.access_token,apikey:key,'content-type':'application/json'},body:JSON.stringify({action:'analyze',unit_id:S.view,message:''})});
  const data=await r.json();if(!r.ok)throw Error(data.error||'Falha na análise');
  S.busy=false;S.typing=false;await refresh();
  const el=$('#aiInline');if(el){el.textContent='Análise registrada na conversa acima.';el.className='ai-inline success';}
  flash('Análise da IA registrada neste tópico.');
 }catch(e){S.busy=false;const el=$('#aiInline');if(el){el.textContent='Não foi possível obter a análise: '+e.message;el.className='ai-inline fail';}flash('Falha na análise. Veja o aviso no chat.',true)}
}
document.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.open){
  if(S.consensusDirty||S.proposalDirty||S.chatDraft.trim())if(!confirm('Há texto não salvo. Descartar e mudar de seção?'))return;
  S.view=b.dataset.open;S.chatDraft='';S.replyTo=null;S.typing=false;S.consensusDirty=false;S.proposalDirty=false;
  render();return;
 }
 if(b.id==='addSection'){$('#sectionDialog').showModal();return}
 if(b.id==='cancelSection'){$('#sectionDialog').close();return}
 if(b.id==='cancelReply'){S.replyTo=null;$('#replyIndicator').innerHTML='';$('#replyIndicator').hidden=true;return}
 if(b.dataset.reply){
  S.replyTo=Number(b.dataset.reply);const ref=$('#replyIndicator');
  if(ref){ref.innerHTML=renderReplyIndicator();ref.hidden=false}
  $('#chatText')?.focus();return;
 }
 if(b.id==='saveProposal'){await pedagogy('save',$('#myProposal').value);return}
 if(b.id==='toggleShare'){const own=myProposal();if(!own)return;if(S.proposalDirty)return flash('Salve antes de compartilhar',true);await pedagogy('share',!own.shared);return}
 if(b.dataset.consensus){
  const action=b.dataset.consensus;
  if(action==='approve'&&S.consensusDirty)return flash('Salve o consenso antes de aprovar.',true);
  if(action==='save')return await debate('save',$('#consensusInput')?.value||'');
  if(action==='reopen'&&!confirm('Abrir uma nova revisão? O texto fixo anterior continuará preservado.'))return;
  await debate(action);return;
 }
 if(b.id==='askAI'){if(S.chatDraft.trim())return flash('Envie primeiro sua mensagem, para que a IA possa considerar o novo argumento.',true);await ai();return}
});
document.addEventListener('input',e=>{
 if(e.target.id==='chatText'){S.chatDraft=e.target.value;S.typing=!!S.chatDraft;return}
 if(e.target.id==='myProposal'){S.proposalDirty=true;S.proposalDraft=e.target.value;return}
 if(e.target.id==='consensusInput'){S.consensusDirty=true;S._consensusTemp=e.target.value;S.editVersion=current()?.version;return}
});
document.addEventListener('submit',async e=>{
 if(e.target.id==='chatForm'){e.preventDefault();await sendChat();return}
 if(e.target.id==='sectionForm'){
  e.preventDefault();const title=$('#sectionName').value.trim(),kind=$('#sectionKind').value;
  if(!title)return;S.busy=true;
  try{
   const r=await db.rpc('live_debate_action',{p_action:'create',p_unit_id:null,p_expected_version:null,p_payload:{title,kind}});
   if(r.error)throw Error(r.error.message);
   S.busy=false;S.view=r.data.unit_id;S.typing=false;S.chatDraft='';S.proposalDirty=false;S.consensusDirty=false;
   $('#sectionDialog').close();e.target.reset();await refresh();flash('Seção criada para debate. Nenhuma aprovação registrada.');
  }catch(err){S.busy=false;flash(err.message,true)}
 }
});
async function start(){
 const {data:{session}}=await db.auth.getSession();
 if(!session){$('#page').innerHTML='<div class="card"><h1>Acesso da equipe</h1><p>Entre no Command Center com sua conta individual.</p><a href="../">Abrir login →</a></div>';return}
 const {data:role,error}=await db.rpc('live_editorial_role');
 if(error||!role){$('#page').innerHTML='<div class="card">Sua conta não está habilitada para a construção da LIVE.</div>';return}
 S.role=role;await refresh();
 db.channel('debate-live').on('postgres_changes',{event:'*',schema:'public',table:'live_editorial_comments'},()=>refresh(true))
  .on('postgres_changes',{event:'*',schema:'public',table:'live_debate_sections'},()=>refresh(true))
  .on('postgres_changes',{event:'*',schema:'public',table:'live_pedagogy_proposals'},()=>refresh(true))
  .on('postgres_changes',{event:'*',schema:'public',table:'live_editorial_units'},()=>refresh(true)).subscribe();
 setInterval(()=>{if(!S.busy&&!S.typing&&!S.consensusDirty&&!S.proposalDirty)refresh(true)},20000);
}
start().catch(e=>{$('#page').innerHTML='<div class="card"><h2>Erro ao carregar debate</h2><p>'+esc(e.message)+'</p><a href="./revisao-legado.html">Abrir editor preservado</a></div>'});
})();
