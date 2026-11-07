(async()=>{
'use strict';
const root=document.getElementById('app'),BUCKET='ctmed-live-slides';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const cfg=await fetch('../index.html',{cache:'no-store'}).then(r=>r.text());
const url=cfg.match(/SUPABASE_URL:'([^']+)'/)?.[1],key=cfg.match(/SUPABASE_ANON_KEY:'([^']+)'/)?.[1];
if(!url||!key||!window.supabase)throw Error('Não foi possível iniciar o Supabase');
const db=window.supabase.createClient(url,key);
let model=null,blockId='abertura',stepId='',draft=null,dirty=false,busy=false,reference='',lastReference='',readyFirst=false;
let uploadedPath='';
const slideCache=new Map();
const getBlock=()=>model?.blocks.find(x=>x.id===blockId);
const getStep=()=>getBlock()?.steps.find(x=>x.id===stepId);
const draftValues=()=>structuredClone(getStep()?.data||{});
const fullyApproved=b=>b.gil_approved&&b.diego_approved;
const completeStep=s=>{
 const d=s.data||{};
 return !!String(d.title||'').trim()&&!!String(d.slide_title||d.slide_asset_path||'').trim()&&
 !!(String(d.gil||'').trim()||String(d.diego||'').trim()||String(d.tech||'').trim());
};
const goodCount=b=>(b.steps||[]).filter(completeStep).length;
function flash(message,error=false){
 const el=$('#toast');el.textContent=message;el.className='toast'+(error?' error':'');
 el.hidden=false;clearTimeout(flash.t);flash.t=setTimeout(()=>el.hidden=true,5800);
}
function askDiscard(){return !dirty||confirm('Há alterações não salvas nesta etapa. Deseja descartá-las?')}
const speakerOptions=[['ambos','Ambos'],['gil','Gil'],['diego','Diego'],['tecnica','Direção técnica']];
function field(label,key,opts={}){
 const val=draft?.[key]||'',rows=opts.rows||0;
 return '<label class="field"><span>'+esc(label)+'</span>'+
 (rows?'<textarea '+(rows>4?'class="long"':'')+' data-field="'+key+'" rows="'+rows+'" placeholder="'+esc(opts.placeholder||'')+'">'+esc(val)+'</textarea>':
 '<input data-field="'+key+'" maxlength="'+(opts.max||240)+'" placeholder="'+esc(opts.placeholder||'')+'" value="'+esc(val)+'">')+
 '</label>';
}
function slideHtml(){
 const d=draft||{},path=d.slide_asset_path||'';
 return '<div id="slidebox" class="slidebox '+(!d.slide_title&&!path?'empty':'')+'">'+
 (path?'<div id="mediaHolder" data-path="'+esc(path)+'" style="position:absolute;inset:0;display:grid;place-items:center"><span class="caption">Carregando imagem privada…</span></div>':
 '<div class="ctmedmark">CT-MED ACADEMY · SPRINT ISR</div>'+
 '<h3 id="slideTitleView">'+esc(d.slide_title||'Título do slide')+'</h3>'+
 '<p id="slideBodyView">'+esc(d.slide_body||'Adicione o texto que o aluno verá na tela.')+'</p>')+
 '</div>';
}
async function loadSlide(path){
 if(!path)return;
 const holder=$('#mediaHolder');if(!holder||holder.dataset.path!==path)return;
 try{
  let signed=slideCache.get(path);
  if(!signed||signed.expire<Date.now()){
   const {data,error}=await db.storage.from(BUCKET).createSignedUrl(path,3600);
   if(error||!data?.signedUrl)throw Error(error?.message||'URL indisponível');
   signed={url:data.signedUrl,expire:Date.now()+3000000};slideCache.set(path,signed);
  }
  if($('#mediaHolder')?.dataset.path===path){
    const el=$('#mediaHolder');el.innerHTML='<img src="'+esc(signed.url)+'" alt="Slide privado enviado pela equipe" onerror="this.replaceWith(document.createTextNode(\'Não foi possível carregar a imagem\'))">';
  }
 }catch(e){if($('#mediaHolder')?.dataset.path===path)$('#mediaHolder').textContent='Falha ao carregar slide: '+e.message}
}
function status(b){
 if(fullyApproved(b))return '<span class="tag ok">✓ Consenso de Gil e Diego</span>';
 if(b.gil_approved||b.diego_approved)return '<span class="tag warn">Uma aprovação</span>';
 return '<span class="tag warn">Em construção</span>';
}
function render(){
 if(!model)return;
 const blocks=model.blocks||[],block=getBlock();
 if(!block){root.innerHTML='<div class="panel">Ainda não há blocos cadastrados.</div>';return}
 if(!block.steps.some(x=>x.id===stepId))stepId=block.steps[0]?.id||'';
 const step=getStep();if(!step){root.innerHTML='<div class="panel">Nenhuma etapa encontrada.</div>';return}
 if(!dirty)draft=draftValues();
 const done=blocks.filter(fullyApproved).length,percent=Math.round(100*done/Math.max(1,blocks.length));
 const progress='<span class="tag '+(done===blocks.length?'ok':'warn')+'">'+done+'/'+blocks.length+' blocos aprovados</span>';
 root.innerHTML=
  '<div class="intro"><div><span class="eyebrow">CT-MED LIVE · SEGUNDA CAMADA</span><h1>Roteiro de apresentação</h1>'+
  '<p>O esqueleto pedagógico continua preservado. Aqui cada etapa recebe fala de Gil, fala de Diego, slide para o público e comando técnico. Salvar modifica apenas o roteiro e reinicia as aprovações do bloco.</p>'+
  '<div class="actions">'+progress+'<span class="tag">Conectado como '+(model.role==='gil'?'Gil':'Diego')+'</span>'+
  '<span class="caption">v'+(model.published_version||0)+' publicada · '+percent+'% aprovado</span></div></div>'+
  '<div class="actions"><a href="./maestro.html?view=maestro&amp;preview=1" class="primary" style="display:inline-block;padding:11px 13px;border-radius:9px;color:#101923;font-weight:850">Pré-visualizar roteiro →</a><button data-act="publish" '+(busy||done!==blocks.length||dirty?'disabled':'')+'>Publicar roteiro aprovado</button></div></div>'+
  '<div class="layout"><aside class="panel sidebar"><h3>Blocos da apresentação</h3><div class="blocklist">'+
  blocks.map(b=>'<button class="block '+(b.id===blockId?'active':'')+'" data-block="'+esc(b.id)+'">'+
   '<span>'+esc(b.title)+'</span><span class="dots '+(fullyApproved(b)?'ok':'')+'">'+(fullyApproved(b)?'✓':b.gil_approved||b.diego_approved?'●':'○')+'</span></button>').join('')+
  '</div><div class="divider"></div><div class="caption">Gil e Diego aprovam a mesma revisão. Qualquer edição reabre o bloco.</div>'+
  '<div class="divider"></div><a href="./revisao.html">← Esqueleto pedagógico aprovado</a></aside>'+
  '<div><section class="panel"><div class="title-row"><div><span class="eyebrow">BLOCO '+String(blocks.indexOf(block)+1).padStart(2,'0')+' · REVISÃO '+block.revision+'</span>'+
  '<h2>'+esc(block.title)+'</h2></div>'+status(block)+'</div>'+
  '<div class="details">'+block.steps.length+' etapa(s) · '+goodCount(block)+' completas para aprovação. As etapas devem ter um slide e pelo menos uma fala ou instrução técnica.</div>'+
  '<details id="architectureReference" class="reference"><summary>Consultar referência pedagógica aprovada (somente leitura)</summary>'+
   '<div class="caption" style="margin:9px 0">Documento aprovado de referência. Editar o roteiro aqui não altera este consenso.</div>'+
   '<pre id="refText">'+esc(lastReference===blockId?reference:'Carregue a referência abrindo esta seção.')+'</pre></details>'+
  '<div class="stepnav">'+block.steps.map((s,i)=>'<button data-step="'+esc(s.id)+'" class="'+(s.id===stepId?'active':'')+'">'+
   String(i+1).padStart(2,'0')+' · '+esc(s.data?.title||'Sem título')+(completeStep(s)?' ✓':' · pendente')+'</button>').join('')+'</div>'+
  '<div class="buttons"><button data-act="add">+ Nova etapa</button><button data-act="up">↑ Mover etapa</button><button data-act="down">↓ Mover etapa</button>'+
  '<button data-act="delete" class="danger">Excluir etapa</button></div></section>'+
  '<section class="panel" style="margin-top:15px"><div class="title-row"><div><span class="eyebrow">EDIÇÃO DA ETAPA</span><h2 style="font-size:20px">'+esc(draft.title||'Nova etapa')+'</h2></div>'+
  '<span id="unsaved" class="tag '+(dirty?'warn':'')+'">'+(dirty?'Alterações não salvas':'Sem alterações')+'</span></div>'+
  '<div class="stepgrid"><div>'+
   field('Nome da etapa','title',{max:160,placeholder:'Ex.: Pré-oxigenação e plano de resgate'})+
   '<div class="sectionhead">O QUE O PÚBLICO VERÁ</div>'+
   field('Título do slide','slide_title',{max:200,placeholder:'Título visível na apresentação'})+
   field('Texto do slide (alternativa à imagem)','slide_body',{rows:6,placeholder:'Tópicos, dados clínicos, pergunta ou evolução'})+
   field('Legenda / observação da imagem','slide_caption',{max:500})+
   '<label class="field"><span>Enviar slide em PNG, JPG ou WebP (até 10 MB)</span><input id="slideFile" type="file" accept="image/png,image/jpeg,image/webp">'+
   '<small class="hint">Armazenamento privado. Use exportação de slides para imagem 16:9. A imagem fica visível no Maestro e na Tela da Apresentação.</small></label>'+
   (draft.slide_asset_path?'<div class="buttons"><span class="caption">Imagem anexada: '+esc(draft.slide_asset_path.split('/').at(-1))+'</span><button id="removeAsset" type="button">Remover da etapa</button></div>':'')+
   '<div class="sectionhead">FALAS E DIREÇÃO</div>'+
   '<label class="field"><span>Quem conduz?</span><select data-field="speaker">'+speakerOptions.map(([id,label])=>'<option value="'+id+'" '+(draft.speaker===id?'selected':'')+'>'+label+'</option>').join('')+'</select></label>'+
   field('Fala / roteiro de Gil','gil',{rows:7,placeholder:'O que Gil vai dizer, perguntas, ganchos e explicações'})+
   field('Fala / roteiro de Diego','diego',{rows:7,placeholder:'O que Diego vai dizer, perguntas, ganchos e explicações'})+
   field('Comando técnico / OBS','tech',{rows:4,placeholder:'Troca de câmera, enquete, monitor, áudio, app, alerta'})+
   field('Próxima ação / deixa','next',{rows:3,placeholder:'Quem fala a seguir e qual slide entra'})+
   field('Duração / minutagem','duration',{max:50,placeholder:'Ex.: 03:00 – 06:00'})+
   '<div class="buttons"><button class="primary" data-act="save" '+(busy?'disabled':'')+'>Salvar esta etapa</button>'+
   '<span class="caption">Aprovações do bloco são reiniciadas ao salvar alterações.</span></div>'+
  '</div><div><div class="subpanel"><div class="eyebrow">PRÉVIA EXATA DO SLIDE</div><p class="hint">O mesmo conteúdo visual aparecerá para Diego e na saída de tela.</p>'+
   slideHtml()+'<p class="hint" style="margin:12px 0 0">Imagem enviada tem prioridade sobre texto no slide. O texto permanece disponível no roteiro do professor.</p></div>'+
   '<div class="subpanel" style="margin-top:15px"><div class="eyebrow">VALIDAÇÃO DO BLOCO</div>'+
   '<p class="details">✓ '+goodCount(block)+' / '+block.steps.length+' etapas com slide e instruções.</p>'+
   '<p class="details">Gil: '+(block.gil_approved?'aprovou v'+block.revision:'pendente')+' · Diego: '+(block.diego_approved?'aprovou v'+block.revision:'pendente')+'</p>'+
   '<div class="buttons">'+((model.role==='gil'?block.gil_approved:block.diego_approved)?
     '<button data-act="withdraw">Retirar minha aprovação</button>':
     '<button data-act="approve" class="secondary" '+(dirty||goodCount(block)!==block.steps.length?'disabled':'')+'>✓ Aprovar bloco v'+block.revision+'</button>')+
   '</div></div></div></div></section>'+
  '<section class="panel publish"><div class="title-row"><div><span class="eyebrow">PUBLICAÇÃO CONTROLADA</span>'+
  '<h3>Enviar roteiro aprovado ao Maestro</h3><p class="caption">Publicar congela uma versão independente. Não inicia a transmissão e não altera o esqueleto original.</p></div>'+
  '<button id="publish" class="primary" '+(busy||done!==blocks.length||dirty?'disabled':'')+'>Publicar nova versão</button></div>'+
  (done!==blocks.length?'<div class="statusbox">Faltam '+(blocks.length-done)+' blocos aprovados por Gil e Diego para liberar a publicação.</div>':
  '<div class="statusbox ok">Todos os blocos estão aprovados e prontos para uma versão de ensaio.</div>')+
  '<div class="buttons"><a href="./maestro.html?view=maestro">Maestro publicado ↗</a><a href="./maestro.html?view=diego">Roteiro remoto de Diego ↗</a>'+
  '<a href="./maestro.html?view=tela">Tela da apresentação (OBS) ↗</a></div></section>'+
  '</div></div>';
 if(draft.slide_asset_path)loadSlide(draft.slide_asset_path);
}
async function load(force=false){
 if(!force&&(busy||dirty))return;
 const {data:{session}}=await db.auth.getSession();
 if(!session){root.innerHTML='<div class="panel empty"><h2>Login necessário</h2><p>Entre no Command Center com sua conta autorizada.</p><a href="../">Abrir login →</a></div>';return}
 const r=await db.rpc('live_script_snapshot',{p_preview:true});
 if(r.error)throw Error(r.error.message);
 model=r.data;
 const block=getBlock()||model.blocks[0];if(!block)throw Error('Roteiro não encontrado');
 blockId=block.id;
 if(!block.steps.some(s=>s.id===stepId))stepId=block.steps[0]?.id;
 draft=draftValues();dirty=false;
 render();readyFirst=true;
}
async function refRead(){
 const b=getBlock();if(!b?.architecture_id)return;
 const r=await db.from('live_debate_sections').select('fixed_text').eq('unit_id',b.architecture_id).maybeSingle();
 reference=r.error?'Não foi possível carregar a referência: '+r.error.message:(r.data?.fixed_text||'Referência indisponível');
 lastReference=blockId;
 if($('#refText'))$('#refText').textContent=reference;
}
async function action(type,more={}){
 if(busy)return;
 const b=getBlock();if(!b)return;
 busy=true;
 try{
  const payload=type==='save_step'?draft:type==='add_step'?{title:more.title}:type==='move_step'?{delta:more.delta}:{};
  const r=await db.rpc('live_script_action',{p_action:type,p_block_id:b.id,
    p_step_id:more.stepId||stepId,p_payload:payload,p_expected_revision:b.revision});
  if(r.error)throw Error(r.error.message);
  dirty=false;lastReference='';busy=false;
  await load(true);
  flash(type==='save_step'?'Etapa salva. Aprovações do bloco reiniciadas se necessário.':
    type==='approve'?'Sua aprovação foi registrada para a revisão atual.':
    type==='withdraw'?'Sua aprovação foi retirada.':'Roteiro atualizado.');
 }catch(e){flash(e.message,true)}finally{busy=false}
}
async function publish(){
 if(busy||dirty)return;
 const done=model.blocks.filter(fullyApproved).length;
 if(done!==model.blocks.length)return;
 if(!confirm('Publicar uma NOVA versão operacional dos slides e roteiros aprovados por Gil e Diego? Isso não inicia a LIVE e não muda o esqueleto pedagógico.'))return;
 busy=true;
 try{
  const r=await db.rpc('live_script_publish');
  if(r.error)throw Error(r.error.message);
  busy=false;await load(true);
  flash('Roteiro operacional v'+r.data.version+' publicado com '+r.data.steps+' etapas. O Maestro está em ensaio.');
 }catch(e){flash('Publicação bloqueada: '+e.message,true)}finally{busy=false}
}
async function upload(file){
 if(!file)return;
 if(!['image/png','image/jpeg','image/webp'].includes(file.type))return flash('Use PNG, JPEG ou WebP.',true);
 if(file.size>10*1024*1024)return flash('Imagem acima de 10 MB. Reduza o arquivo.',true);
 if(busy)return;
 busy=true;
 try{
  const cleaned=file.name.replace(/[^a-z0-9.\-_]/gi,'-').slice(-70);
  const path='sprint-isr/'+crypto.randomUUID()+'-'+cleaned;
  const {error}=await db.storage.from(BUCKET).upload(path,file,{contentType:file.type,upsert:false});
  if(error)throw Error(error.message);
  draft.slide_asset_path=path;dirty=true;uploadedPath=path;busy=false;
  render();
  flash('Imagem enviada e anexada à etapa. Clique em "Salvar esta etapa" para confirmar.');
 }catch(e){flash('Falha ao enviar slide: '+e.message,true)}finally{busy=false}
}
root.addEventListener('input',e=>{
 if(!e.target.matches('[data-field]'))return;
 draft[e.target.dataset.field]=e.target.value;dirty=true;
 const chip=$('#unsaved');if(chip){chip.textContent='Alterações não salvas';chip.className='tag warn'}
 if(e.target.dataset.field==='slide_title'&&$('#slideTitleView'))$('#slideTitleView').textContent=e.target.value||'Título do slide';
 if(e.target.dataset.field==='slide_body'&&$('#slideBodyView'))$('#slideBodyView').textContent=e.target.value||'Adicione o texto que o aluno verá na tela.';
});
root.addEventListener('change',e=>{
 if(e.target.id==='slideFile'&&e.target.files?.[0])upload(e.target.files[0]);
});
root.addEventListener('toggle',e=>{if(e.target.id==='architectureReference'&&e.target.open&&lastReference!==blockId)refRead()},true);
root.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.block){if(!askDiscard())return;blockId=b.dataset.block;stepId='';dirty=false;lastReference='';draft=null;render();return}
 if(b.dataset.step){if(!askDiscard())return;stepId=b.dataset.step;dirty=false;draft=draftValues();render();return}
 if(b.id==='removeAsset'){draft.slide_asset_path='';dirty=true;render();return}
 if(b.id==='publish'){await publish();return}
 if(!b.dataset.act)return;
 const t=b.dataset.act;
 if(t==='publish')return publish();
 if(t==='save')return action('save_step');
 if(t==='approve')return action('approve');
 if(t==='withdraw')return action('withdraw');
 if(['up','down'].includes(t)){if(!askDiscard())return;return action('move_step',{delta:t==='up'?-1:1})}
 if(t==='delete'){if(!askDiscard()||!confirm('Excluir esta etapa do roteiro? O material publicado anteriormente será preservado.'))return;return action('delete_step')}
 if(t==='add'){if(!askDiscard())return;const name=prompt('Título da nova etapa:','Nova etapa');if(!name?.trim())return;return action('add_step',{title:name.trim()})}
});
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue=''}});
await load();
db.channel('live-script-edit').on('postgres_changes',{event:'*',schema:'public',table:'live_script_blocks'},()=>{if(!dirty&&!busy)load().catch(e=>flash(e.message,true))}).subscribe();
setInterval(()=>{if(!dirty&&!busy)load().catch(e=>flash(e.message,true))},20000);
})().catch(e=>{
 const r=document.getElementById('app');
 r.innerHTML='<div class="panel empty"><h2>Falha ao iniciar o roteiro</h2><p>'+String(e.message||e).replace(/[<>&]/g,'')+'</p><a href="./revisao.html">Voltar à construção</a></div>';
});