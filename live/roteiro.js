(async()=>{
'use strict';
const root=document.getElementById('app'),BUCKET='ctmed-live-slides';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const cfg=await fetch('../index.html',{cache:'no-store'}).then(r=>r.text());
const url=cfg.match(/SUPABASE_URL:'([^']+)'/)?.[1],key=cfg.match(/SUPABASE_ANON_KEY:'([^']+)'/)?.[1];
if(!url||!key||!window.supabase)throw Error('Não foi possível iniciar o Supabase');
const db=window.supabase.createClient(url,key);
let model=null,blockId='abertura',stepId='',draft=null,dirty=false,busy=false,reference='',lastReference='',readyFirst=false,activeTab='conteudo',dragState=null,sidebarScrollTop=0;
const expandedBlocks=new Set(['abertura']);
let uploadedPath='';
const slideCache=new Map();
const getBlock=()=>model?.blocks.find(x=>x.id===blockId);
const getStep=()=>getBlock()?.steps.find(x=>x.id===stepId);
const draftValues=()=>{
 const d=structuredClone(getStep()?.data||{});
 if(!String(d.scene_script||'').trim()){
  d.scene_script=[d.gil,d.diego].filter(x=>String(x||'').trim()).join('\n\n');
 }
 return d;
};
const fullyApproved=b=>b.gil_approved&&b.diego_approved;
const completeStep=s=>{
 const d=s.data||{};
 return !!String(d.title||'').trim()&&!!String(d.slide_title||d.slide_asset_path||'').trim()&&
 !!(String(d.scene_script||'').trim()||String(d.gil||'').trim()||String(d.diego||'').trim()||String(d.tech||'').trim());
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
 '<div class="ctmedmark">CT-MED ACADEMY</div>'+
 '<h3 id="slideTitleView">'+esc(d.slide_title||'Título do slide')+'</h3>'+
 '<p id="slideBodyView">'+esc(d.slide_body||'Adicione o texto que o aluno verá na tela.')+'</p>')+
 '</div>';
}
async function loadSlide(path){
 if(!path)return;
 const holder=$('#mediaHolder');if(!holder||holder.dataset.path!==path)return;
 const embedded=path.startsWith('case1:')?window.CTMED_CASE1_SLIDES?.[path.slice(6)]:'';
 if(embedded){
  holder.innerHTML='<img src="'+esc(embedded)+'" alt="Slide do Caso 1" onerror="this.replaceWith(document.createTextNode(\'Não foi possível carregar a imagem\'))">';
  return;
 }
 if(/^(?:\/|\.\/|\.\.\/|https?:\/\/|data:image\/)/i.test(path)){
  holder.innerHTML='<img src="'+esc(path)+'" alt="Slide do roteiro" onerror="this.replaceWith(document.createTextNode(\'Não foi possível carregar a imagem\'))">';
  return;
 }
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
function treeHtml(blocks){
 return blocks.map(b=>{
  const open=expandedBlocks.has(b.id),active=b.id===blockId;
  const state=fullyApproved(b)?'✓':b.gil_approved||b.diego_approved?'●':'○';
  const steps=(b.steps||[]).map((s,i)=>'<div class="tree-step-row" draggable="true" data-dragstep="'+esc(s.id)+'" data-dragblock="'+esc(b.id)+'"><span class="drag-handle" title="Arraste para reordenar">☷</span><button class="tree-step '+(s.id===stepId?'active':'')+'" data-step="'+esc(s.id)+'" data-blockstep="'+esc(b.id)+'">'+
   '<span>'+String(i+1).padStart(2,'0')+' · '+esc(s.data?.title||'Sem título')+'</span><span class="step-state '+(completeStep(s)?'ok':'')+'">'+(completeStep(s)?'✓':'·')+'</span></button>'+
   '<button class="tree-delete" title="Excluir etapa" aria-label="Excluir '+esc(s.data?.title||'etapa')+'" data-deletestep="'+esc(s.id)+'" data-deleteblock="'+esc(b.id)+'">✕</button></div>').join('');
  return '<div class="tree-block"><button class="tree-head '+(active?'active':'')+'" data-treeblock="'+esc(b.id)+'">'+
   '<span class="tree-caret">'+(open?'▾':'▸')+'</span><span>'+esc(b.title)+'</span><span class="tree-status '+(fullyApproved(b)?'ok':'')+'">'+state+'</span></button>'+
   (open?'<div class="tree-steps">'+steps+'</div>':'')+'</div>';
 }).join('');
}
function tabButton(id,label){return '<button class="tab '+(activeTab===id?'active':'')+'" data-tab="'+id+'">'+label+'</button>'}
function render(){
 if(!model)return;
 const currentSidebar=document.querySelector('.sidebar');
 if(currentSidebar)sidebarScrollTop=currentSidebar.scrollTop;
 const blocks=model.blocks||[],block=getBlock();
 if(!block){root.innerHTML='<div class="panel">Ainda não há blocos cadastrados.</div>';return}
 if(!block.steps.some(x=>x.id===stepId))stepId=block.steps[0]?.id||'';
 const step=getStep();if(!step){root.innerHTML='<div class="panel">Nenhuma etapa encontrada.</div>';return}
 if(!dirty)draft=draftValues();
 const done=blocks.filter(fullyApproved).length,percent=Math.round(100*done/Math.max(1,blocks.length));
 const idx=block.steps.findIndex(s=>s.id===stepId),prev=idx>0?block.steps[idx-1]:null,next=idx<block.steps.length-1?block.steps[idx+1]:null;
 const progress='<span class="tag '+(done===blocks.length?'ok':'warn')+'">'+done+'/'+blocks.length+' blocos aprovados</span>';
 const approval='<span class="caption">Gil: '+(block.gil_approved?'✓':'—')+' · Diego: '+(block.diego_approved?'✓':'—')+' · revisão '+block.revision+'</span>';
 root.innerHTML=
  '<div class="intro"><div><span class="eyebrow">CT-MED LIVE · SALA DE CONSTRUÇÃO</span><h1>Roteiro de apresentação</h1>'+
  '<p>Navegue pelo roteiro na árvore à esquerda. À direita, trabalhe somente na etapa selecionada: conteúdo, slide, técnica e histórico.</p>'+
  '<div class="actions">'+progress+'<span class="tag">Conectado como '+(model.role==='gil'?'Gil':'Diego')+'</span><span class="caption">v'+(model.published_version||0)+' publicada · '+percent+'% aprovado</span></div></div>'+
  '<div class="actions"><a href="./maestro.html?view=maestro&amp;preview=1" class="primary" style="display:inline-block;padding:11px 13px;border-radius:9px;color:#101923;font-weight:850">Prévia Maestro →</a><button data-act="publish" '+(busy||done!==blocks.length||dirty?'disabled':'')+'>Publicar aprovado</button></div></div>'+
  '<div class="layout"><aside class="panel sidebar"><h3>Roteiro</h3>'+treeHtml(blocks)+
  '<div class="divider"></div><div class="caption">▸ expande bloco · ✓ etapa completa · ● aprovação parcial</div>'+
  '<div class="divider"></div><a href="./revisao.html">← Esqueleto pedagógico aprovado</a></aside>'+
  '<main class="editor-shell"><section class="panel"><div class="editor-head"><div><div class="breadcrumb">'+esc(block.title)+' › '+String(idx+1).padStart(2,'0')+'</div>'+
  '<h2>'+esc(draft.title||'Nova etapa')+'</h2><div class="actions"><span id="unsaved" class="tag '+(dirty?'warn':'')+'">'+(dirty?'Alterações não salvas':'Salvo')+'</span>'+approval+'</div></div>'+
  '<div class="editor-actions"><button data-stepnav="prev" '+(!prev?'disabled':'')+'>← Anterior</button><button data-stepnav="next" '+(!next?'disabled':'')+'>Próximo →</button><button data-addcurrent="1" class="secondary">+ Adicionar etapa</button></div></div>'+
  '<div class="tabs">'+tabButton('conteudo','CONTEÚDO')+tabButton('slide','SLIDE')+tabButton('tecnica','TÉCNICA')+tabButton('historico','HISTÓRICO')+'</div>'+
  '<div class="tabpane" data-pane="conteudo" '+(activeTab!=='conteudo'?'hidden':'')+'>'+
   '<div class="stepgrid"><div>'+
    field('Nome da etapa','title',{max:160,placeholder:'Ex.: Pré-oxigenação e plano de resgate'})+
    '<label class="field"><span>Quem conduz?</span><select data-field="speaker">'+speakerOptions.map(([id,label])=>'<option value="'+id+'" '+(draft.speaker===id?'selected':'')+'>'+label+'</option>').join('')+'</select></label>'+
    field('Roteiro da cena','scene_script',{rows:14,placeholder:'Falas, perguntas, ganchos e transições, na ordem em que acontecerão'})+
    field('Próxima ação / deixa','next',{rows:4,placeholder:'Quem fala a seguir e qual slide entra'})+
    field('Duração / minutagem','duration',{max:50,placeholder:'Ex.: 03:00 – 06:00'})+
    '<div class="buttons"><button class="primary" data-act="save" '+(busy?'disabled':'')+'>Salvar etapa</button></div>'+
   '</div><div class="subpanel"><div class="eyebrow">SLIDE ATUAL</div><p class="hint">Prévia rápida. Para trocar o arquivo, use a aba SLIDE.</p>'+slideHtml()+
   '<div class="buttons"><button data-tabjump="slide">Editar slide</button><button data-tabjump="tecnica">Direção técnica</button></div></div></div>'+
  '</div>'+
  '<div class="tabpane" data-pane="slide" '+(activeTab!=='slide'?'hidden':'')+'>'+
   '<div class="stepgrid"><div>'+
    field('Título do slide','slide_title',{max:200,placeholder:'Título visível na apresentação'})+
    field('Texto do slide (alternativa à imagem)','slide_body',{rows:7,placeholder:'Tópicos, dados clínicos, pergunta ou evolução'})+
    field('Legenda / observação da imagem','slide_caption',{max:500})+
    '<label class="field"><span>Enviar slide em PNG, JPG ou WebP (até 10 MB)</span><input id="slideFile" type="file" accept="image/png,image/jpeg,image/webp"><small class="hint">A imagem enviada tem prioridade na apresentação.</small></label>'+
    (draft.slide_asset_path?'<div class="buttons"><span class="caption">Arquivo: '+esc(draft.slide_asset_path.split('/').at(-1))+'</span><button id="removeAsset" type="button">Remover da etapa</button></div>':'')+
    '<div class="buttons"><button class="primary" data-act="save" '+(busy?'disabled':'')+'>Salvar etapa</button></div>'+
   '</div><div class="subpanel"><div class="eyebrow">PRÉVIA EXATA DO SLIDE</div><p class="hint">É isto que aparece no Maestro e na saída de tela.</p>'+slideHtml()+'</div></div>'+
  '</div>'+
  '<div class="tabpane" data-pane="tecnica" '+(activeTab!=='tecnica'?'hidden':'')+'>'+
    field('Comando técnico / OBS','tech',{rows:12,placeholder:'Troca de câmera, enquete, monitor, áudio, app, alerta'})+
    '<div class="buttons"><button class="primary" data-act="save" '+(busy?'disabled':'')+'>Salvar etapa</button></div>'+
  '</div>'+
  '<div class="tabpane" data-pane="historico" '+(activeTab!=='historico'?'hidden':'')+'>'+
   '<div class="subpanel"><div class="eyebrow">CONTROLE DO BLOCO</div><p class="details">Bloco: '+esc(block.title)+'</p>'+
   '<p class="details">'+block.steps.length+' etapas · '+goodCount(block)+' completas</p>'+
   '<p class="details">Revisão atual: '+block.revision+' · Gil: '+(block.gil_approved?'aprovou':'pendente')+' · Diego: '+(block.diego_approved?'aprovou':'pendente')+'</p>'+
   '<div class="buttons">'+((model.role==='gil'?block.gil_approved:block.diego_approved)?'<button data-act="withdraw">Retirar minha aprovação</button>':'<button data-act="approve" class="secondary" '+(dirty||goodCount(block)!==block.steps.length?'disabled':'')+'>✓ Aprovar bloco v'+block.revision+'</button>')+
   '<button data-act="up">↑ Mover etapa</button><button data-act="down">↓ Mover etapa</button><button data-act="delete" class="danger">Excluir etapa</button></div></div>'+
   '<details id="architectureReference" class="reference"><summary>Referência pedagógica aprovada</summary><div class="caption" style="margin:9px 0">Somente leitura.</div><pre id="refText">'+esc(lastReference===blockId?reference:'Abra esta seção para carregar a referência.')+'</pre></details>'+
   '<div class="subpanel" style="margin-top:15px"><div class="eyebrow">PUBLICAÇÃO</div><p class="details">A publicação só é liberada quando todos os blocos têm dupla aprovação.</p>'+
   '<div class="buttons"><button data-act="publish" class="primary" '+(busy||done!==blocks.length||dirty?'disabled':'')+'>Publicar nova versão</button><a href="./maestro.html?view=maestro">Maestro publicado ↗</a></div></div>'+
  '</div>'+
  '</section></main></div>';
 if(draft.slide_asset_path)loadSlide(draft.slide_asset_path);
 requestAnimationFrame(()=>{
   const sidebar=document.querySelector('.sidebar');
   if(sidebar)sidebar.scrollTop=sidebarScrollTop;
 });
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
root.addEventListener('scroll',e=>{
 const sidebar=e.target.closest?.('.sidebar');
 if(sidebar)sidebarScrollTop=sidebar.scrollTop;
},true);
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
root.addEventListener('dragstart',e=>{
 const row=e.target.closest('.tree-step-row[draggable="true"]');
 if(!row||dirty||busy){e.preventDefault();return}
 dragState={stepId:row.dataset.dragstep,blockId:row.dataset.dragblock};
 row.classList.add('dragging');
 e.dataTransfer.effectAllowed='move';
 e.dataTransfer.setData('text/plain',dragState.stepId);
});
root.addEventListener('dragover',e=>{
 const row=e.target.closest('.tree-step-row[draggable="true"]');
 if(!row||!dragState||row.dataset.dragblock!==dragState.blockId||row.dataset.dragstep===dragState.stepId)return;
 e.preventDefault();
 e.dataTransfer.dropEffect='move';
 document.querySelectorAll('.tree-step-row.drop-before,.tree-step-row.drop-after').forEach(x=>x.classList.remove('drop-before','drop-after'));
 const rect=row.getBoundingClientRect();
 row.classList.add(e.clientY<rect.top+rect.height/2?'drop-before':'drop-after');
});
root.addEventListener('dragleave',e=>{
 const row=e.target.closest('.tree-step-row[draggable="true"]');
 if(row&&!row.contains(e.relatedTarget))row.classList.remove('drop-before','drop-after');
});
root.addEventListener('drop',async e=>{
 const row=e.target.closest('.tree-step-row[draggable="true"]');
 if(!row||!dragState||row.dataset.dragblock!==dragState.blockId||row.dataset.dragstep===dragState.stepId)return;
 e.preventDefault();
 const source=dragState;
 const rect=row.getBoundingClientRect();
 const before=e.clientY<rect.top+rect.height/2;
 document.querySelectorAll('.tree-step-row').forEach(x=>x.classList.remove('dragging','drop-before','drop-after'));
 dragState=null;
 if(!askDiscard())return;
 const block=model.blocks.find(x=>x.id===source.blockId);
 if(!block)return;
 busy=true;
 try{
   const r=await db.rpc('live_script_reorder_step',{
     p_block_id:source.blockId,
     p_step_id:source.stepId,
     p_target_step_id:row.dataset.dragstep,
     p_before:before,
     p_expected_revision:block.revision
   });
   if(r.error)throw Error(r.error.message);
   blockId=source.blockId;stepId=source.stepId;dirty=false;lastReference='';busy=false;
   await load(true);
   flash('Ordem dos slides atualizada.');
 }catch(err){flash(err.message,true)}finally{busy=false}
});
root.addEventListener('dragend',()=>{
 document.querySelectorAll('.tree-step-row').forEach(x=>x.classList.remove('dragging','drop-before','drop-after'));
 dragState=null;
});
root.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.treeblock){
   const id=b.dataset.treeblock;
   if(id===blockId){expandedBlocks.has(id)?expandedBlocks.delete(id):expandedBlocks.add(id);render();return}
   if(!askDiscard())return;
   blockId=id;stepId='';dirty=false;lastReference='';draft=null;expandedBlocks.add(id);activeTab='conteudo';render();return;
 }
 if(b.dataset.blockstep){
   if(!askDiscard())return;
   blockId=b.dataset.blockstep;expandedBlocks.add(blockId);stepId=b.dataset.step;dirty=false;draft=draftValues();activeTab='conteudo';render();return;
 }
 if(b.dataset.deletestep){
   if(!askDiscard())return;
   const targetBlock=b.dataset.deleteblock,targetStep=b.dataset.deletestep;
   const target=model.blocks.find(x=>x.id===targetBlock)?.steps.find(x=>x.id===targetStep);
   if(!confirm('Excluir "'+(target?.data?.title||'esta etapa')+'" do roteiro? O material já publicado anteriormente será preservado.'))return;
   blockId=targetBlock;stepId=targetStep;expandedBlocks.add(blockId);dirty=false;draft=draftValues();
   return action('delete_step',{stepId:targetStep});
 }
 if(b.dataset.addcurrent){
   if(!askDiscard())return;
   const name=prompt('Título da nova etapa:','Nova etapa');if(!name?.trim())return;
   return action('add_step',{title:name.trim()});
 }
 if(b.dataset.addblock){
   if(!askDiscard())return;
   blockId=b.dataset.addblock;expandedBlocks.add(blockId);
   const name=prompt('Título da nova etapa:','Nova etapa');if(!name?.trim())return;
   return action('add_step',{title:name.trim()});
 }
 if(b.dataset.tab){activeTab=b.dataset.tab;render();return}
 if(b.dataset.tabjump){activeTab=b.dataset.tabjump;render();return}
 if(b.dataset.stepnav){
   if(!askDiscard())return;
   const block=getBlock(),i=block.steps.findIndex(s=>s.id===stepId),n=b.dataset.stepnav==='prev'?i-1:i+1;
   if(n>=0&&n<block.steps.length){stepId=block.steps[n].id;dirty=false;draft=draftValues();render()}return;
 }
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