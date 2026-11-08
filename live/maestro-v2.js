(async()=>{
'use strict';
const root=document.getElementById('root'),BUCKET='ctmed-live-slides';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const mdInline=x=>esc(x)
 .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
 .replace(/\`([^\`]+)\`/g,'<code>$1</code>')
 .replace(/\*([^*]+)\*/g,'<em>$1</em>');
function richText(raw){
 const lines=String(raw??'').replace(/\r/g,'').split('\n');
 const out=[];let inList=false;
 const closeList=()=>{if(inList){out.push('</ul>');inList=false}};
 for(const line of lines){
  const t=line.trim();
  if(!t){closeList();out.push('<div class="rich-gap"></div>');continue}
  if(/^---+$/.test(t)){closeList();out.push('<hr>');continue}
  const hd=t.match(/^(#{1,4})\s+(.+)$/);
  if(hd){closeList();const n=Math.min(4,hd[1].length+1);out.push('<h'+n+'>'+mdInline(hd[2])+'</h'+n+'>');continue}
  if(/^>\s?/.test(t)){closeList();out.push('<blockquote>'+mdInline(t.replace(/^>\s?/,''))+'</blockquote>');continue}
  const bullet=t.match(/^[-*•]\s+(.+)$/);
  if(bullet){if(!inList){out.push('<ul>');inList=true}out.push('<li>'+mdInline(bullet[1])+'</li>');continue}
  closeList();out.push('<p>'+mdInline(t)+'</p>');
 }
 closeList();return out.join('');
}
const cfg=await fetch('../index.html',{cache:'no-store'}).then(r=>r.text());
const url=cfg.match(/SUPABASE_URL:'([^']+)'/)?.[1],key=cfg.match(/SUPABASE_ANON_KEY:'([^']+)'/)?.[1];
if(!url||!key||!window.supabase)throw Error('Configuração do Supabase indisponível');
const db=window.supabase.createClient(url,key);
const params=new URLSearchParams(location.search);
const known=['maestro','gil','diego','tecnica','tela'];
let view=known.includes(params.get('view'))?params.get('view'):'maestro';
let preview=params.get('preview')==='1',indexLocal=0,model=null,busy=false,lastSig='',signedCache=new Map(),first=true;
const names={maestro:'Maestro',gil:'Roteiro Gil',diego:'Roteiro Diego',tecnica:'Direção técnica',tela:'Tela para apresentação'};
const flatten=()=>{
 const blocks=model?.blocks||[];
 return blocks.flatMap(b=>(b.steps||[]).map(s=>({...s,blockId:b.id,blockTitle:b.title})));
};
const index=()=>preview?indexLocal:Math.min(Math.max(0,Number(model?.step_index)||0),Math.max(0,flatten().length-1));
const mainScene=()=>flatten()[index()];
const following=()=>flatten()[index()+1];
const isOperator=()=>view==='maestro'&&!preview;
function setUrl(){
 const p=new URLSearchParams();
 p.set('view',view);
 if(preview)p.set('preview','1');
 history.replaceState({},'',location.pathname+'?'+p.toString());
}
function tag(t,klass=''){return '<span class="chip '+klass+'">'+t+'</span>'}
function stage(slide,role){
 if(!slide)return '<div class="screen"><div class="slidebrand">CT-MED LIVE</div><h2>Fim do roteiro</h2></div>';
 const d=slide.data||{},path=d.slide_asset_path||'';
 const brand='<div class="slidebrand">CT-MED ACADEMY · SPRINT ISR</div>';
 const footer='<div class="slidefooter">'+esc(slide.blockTitle||'')+'</div>';
 if(path)return '<div class="screen"><div class="loading" data-path="'+esc(path)+'" data-asset-role="'+esc(role)+'">Carregando slide privado…</div></div>';
 return '<div class="screen">'+brand+
  '<h2>'+esc(d.slide_title||d.title||'Título ainda não configurado')+'</h2>'+
  '<p>'+esc(d.slide_body||'Slide em construção')+'</p>'+footer+'</div>';
}
function box(title,text,cls='',extra=''){
 const body=text?richText(text):'<p class="placeholder">Fala ainda não cadastrada no roteiro.</p>';
 return '<div class="presenter '+cls+'"><strong>'+title+'</strong>'+
  '<div class="presenter-copy rich-text">'+body+'</div>'+extra+'</div>';
}
function roleNotes(scene){
 const d=scene?.data||{};
 if(view==='maestro'){
  const roteiro=[d.gil,d.diego].filter(x=>String(x||'').trim()).join('\n\n');
  return box('ROTEIRO DA CENA',roteiro,'own',
   '<div class="small" style="margin-top:8px">Condutor desta etapa: '+esc((d.speaker||'ambos').toUpperCase())+'</div>')+
   box('CUE · DIREÇÃO TÉCNICA / OBS',d.tech,'tech')+
   box('PRÓXIMA AÇÃO / DEIXA',d.next);
 }
 let order=['gil','diego','tech','next'];
 if(view==='diego')order=['diego','gil','tech','next'];
 if(view==='tecnica')order=['tech','next','gil','diego'];
 const titles={gil:'FALA DE GIL',diego:'FALA DE DIEGO',tech:'CUE · DIREÇÃO TÉCNICA / OBS',next:'PRÓXIMA AÇÃO / DEIXA'};
 return order.map(key=>box(titles[key],d[key],key===view?'own':key==='tech'?'tech':'',key==='gil'||key==='diego'?
  '<div class="small" style="margin-top:8px">Condutor desta etapa: '+esc((d.speaker||'ambos').toUpperCase())+'</div>':'')).join('');
}
function sceneNav(){
 let pos=0;
 return (model?.blocks||[]).map(b=>{
   const rows=(b.steps||[]).map(s=>{
     const i=pos++;
     return '<button class="scene '+(i===index()?'active':'')+'" data-index="'+i+'" '+(!preview&&view!=='maestro'?'disabled':'')+'>'+
       '<span class="no">'+String(i+1).padStart(2,'0')+'</span><span>'+esc(s.data?.title||'Etapa sem título')+'</span></button>';
   }).join('');
   return '<div class="blockname">'+esc(b.title)+'</div>'+rows;
 }).join('');
}
function controls(){
 const i=index(),n=flatten().length;
 if(view==='tela')return '';
 if(!preview&&view!=='maestro')return '<div class="controls"><span class="small">Acompanhamento remoto: a cena muda automaticamente quando o Maestro avança.</span></div>';
 const buttons=
  '<div class="controls"><button data-action="back" '+(i===0?'disabled':'')+'>← Anterior</button>'+
  '<button data-action="next" class="primary" '+(i>=n-1?'disabled':'')+'>Próximo slide →</button>'+
  '<span class="small">'+(i+1)+' / '+n+' etapas</span>'+
  (isOperator()?'<button data-action="reset" '+(i===0?'disabled':'')+'>Reiniciar</button>':'')+
  '</div>';
 return buttons;
}
function nextPreview(){
 const s=following();
 if(!s||view==='tela')return '<div class="status"><strong>Última etapa</strong><p>Não há slide seguinte neste roteiro.</p></div>';
 return '<div class="card nextslide"><div>'+stage(s,'next')+'</div>'+
  '<div><span class="eyebrow">PRÓXIMO SLIDE</span><strong style="display:block">'+esc(s.data?.title||'')+'</strong>'+
  '<span class="small">'+esc(s.blockTitle)+'</span>'+
  '<span class="small" style="margin-top:5px">Condutor: '+esc(s.data?.speaker||'ambos')+'</span></div></div>';
}
function render(){
 if(!model)return;
 const all=flatten(),s=mainScene(),n=all.length;
 const hasPub=Number(model.published_version)>0;
 if(!s){root.innerHTML='<div class="card" style="margin-top:24px">Nenhuma etapa cadastrada. Abra <a href="./roteiro.html">Roteiro e slides</a>.</div>';return}
 document.body.classList.toggle('screen-only',view==='tela');
 const t=preview?tag('PRÉVIA · NÃO PUBLICADA','warn'):tag('PUBLICADA · V'+model.published_version,'ok');
 const status=preview?
  '<div class="status"><strong>Pré-visualização · rascunho atual</strong><p>'+model.approved+'/'+model.required+
   ' blocos aprovados. Você pode navegar sem alterar o slide remoto. Para publicar, conclua a dupla aprovação dos blocos em Roteiro e Slides.</p></div>':
  '<div class="status"><strong>Versão congelada '+model.published_version+' · '+(model.session_mode==='ao-vivo'?'TRANSMISSÃO':'ENSAIO')+'</strong><p>Todos os computadores autorizados mostram o mesmo slide. A publicação não altera textos antigos.</p></div>';
 const viewBtns=Object.keys(names).map(k=>'<button data-view="'+k+'" class="'+(view===k?'active':'')+'">'+names[k]+'</button>').join('');
 const modes='<div class="tools">'+t+
  '<button data-mode="preview" '+(preview?'disabled':'')+'>Prévia do roteiro em construção</button>'+
  '<button data-mode="published" '+(!preview||!hasPub?'disabled':'')+'>Versão publicada</button>'+
  '</div>';
 const opActions=isOperator()?'<div class="tools" style="margin-top:9px">'+
  '<button data-action="mode" class="'+(model.session_mode==='ao-vivo'?'primary':'')+'">'+
  (model.session_mode==='ao-vivo'?'Encerrar transmissão (voltar ao ensaio)':'Marcar transmissão ao vivo')+'</button></div>':'';
 const notes='<div>'+roleNotes(s)+'</div>';
 root.innerHTML='<div class="heading"><div><span class="eyebrow">SPRINT ISR · ROTEIRO AUDIOVISUAL</span>'+
  '<h1>'+names[view]+'</h1><p>'+esc(s.blockTitle)+' · '+esc(s.data?.title||'')+'</p>'+
  '<div class="switch">'+viewBtns+'</div></div>'+
  '<div>'+modes+opActions+'</div></div>'+
  '<div class="layout"><aside class="card sidebar"><h3>Ordem da apresentação</h3>'+sceneNav()+
  '<p class="small" style="margin-top:14px">Na prévia a navegação é local. Na versão publicada, os controles do Maestro sincronizam todos os painéis.</p></aside>'+
  '<section class="content">'+status+
  '<div class="scenehead"><div><span class="eyebrow">CENA '+String(index()+1).padStart(2,'0')+' / '+String(n).padStart(2,'0')+'</span>'+
  '<h2>'+esc(s.data?.title||'')+'</h2><div class="small">'+esc(s.blockTitle)+
  (s.data?.duration?' · '+esc(s.data.duration):'')+'</div></div>'+
  (view!=='tela'&&s.data?.slide_asset_path?tag('SLIDE · IMAGEM PRIVADA'):'')+'</div>'+
  controls()+
  '<div class="main-grid"><div><div class="card"><div style="margin-bottom:10px" class="eyebrow">TELA QUE O PÚBLICO VERÁ</div>'+stage(s,'main')+
  (s.data?.slide_caption?'<p class="small">'+esc(s.data.slide_caption)+'</p>':'')+'</div>'+nextPreview()+'</div>'+notes+'</div>'+
  '<div class="footnote">A saída “Tela para apresentação” contém apenas o slide, para captura no OBS. Utilize-a autenticado no Command Center. Votação pública do módulo legado não faz parte desta sincronização.</div>'+
  '</section></div>';
 const imageNodes=[...document.querySelectorAll('[data-asset-role]')];
 for(const e of imageNodes)sign(e.dataset.path,e.dataset.assetRole);
}
async function sign(path,role){
 if(!path)return;
 const targets=[...document.querySelectorAll('[data-asset-role]')].filter(el=>el.dataset.path===path&&el.dataset.assetRole===role);
 if(!targets.length)return;
 try{
  let cached=signedCache.get(path);
  if(!cached||cached.until<Date.now()){
   const {data,error}=await db.storage.from(BUCKET).createSignedUrl(path,3600);
   if(error||!data?.signedUrl)throw Error(error?.message||'Slide privado indisponível');
   cached={src:data.signedUrl,until:Date.now()+3200000};signedCache.set(path,cached);
  }
  for(const el of [...document.querySelectorAll('[data-asset-role]')].filter(x=>x.dataset.path===path&&x.dataset.assetRole===role)){
    const image=document.createElement('img');image.alt='Slide apresentado na LIVE';image.src=cached.src;
    image.onerror=()=>{el.textContent='Não foi possível visualizar a imagem do slide.'};
    el.replaceChildren(image);
  }
 }catch(e){
  for(const el of targets)if(el.isConnected)el.textContent='Slide indisponível: '+e.message;
 }
}
async function refresh(force=false){
 if(busy&&!force)return;
 try{
  const {data:{session}}=await db.auth.getSession();
  if(!session){root.innerHTML='<div class="card" style="margin-top:25px"><h2>Faça login</h2>'+
    '<p>O roteiro dos professores e os slides privados exigem sessão no Command Center.</p>'+
    '<a href="../">Entrar no Command Center ↗</a></div>';$('#connection').textContent='● Login necessário';return}
  const r=await db.rpc('live_script_snapshot',{p_preview:preview});
  if(r.error)throw Error(r.error.message);
  let next=r.data;
  if(!preview&&(!next.published_version||!next.blocks?.length)){
    preview=true;setUrl();
    const p=await db.rpc('live_script_snapshot',{p_preview:true});
    if(p.error)throw Error(p.error.message);
    next=p.data;
  }
  const stateSig=JSON.stringify(next)+'|'+view+'|'+preview+'|'+indexLocal;
  if(force||stateSig!==lastSig){model=next;lastSig=stateSig;
   indexLocal=Math.min(Math.max(indexLocal,0),Math.max(flatten().length-1,0));render()}
  $('#connection').textContent='● Sincronizado';
  first=false;
 }catch(e){$('#connection').textContent='● Falha de sincronização';
  if(first){root.innerHTML='<div class="card" style="margin-top:25px"><h2>Falha ao abrir o Maestro</h2><p>'+esc(e.message)+'</p><a href="./roteiro.html">Voltar ao roteiro</a></div>'}
  else{const el=$('.status');if(el)el.innerHTML='<strong>Falha temporária</strong><p>'+esc(e.message)+'</p>'}
 }
}
async function changeScene(n){
 const len=flatten().length;if(!len||busy)return;
 n=Math.max(0,Math.min(len-1,n));
 if(preview){indexLocal=n;lastSig='';render();return}
 if(view!=='maestro')return;
 busy=true;
 try{
  const r=await db.rpc('live_script_control',{p_action:'goto',p_index:n});
  if(r.error)throw Error(r.error.message);
 }catch(e){alert(e.message)}finally{busy=false;await refresh(true)}
}
async function changeMode(){
 if(busy||preview||view!=='maestro')return;
 const live=model.session_mode!=='ao-vivo';
 if(!confirm(live?'Marcar a sessão como AO VIVO? Isso não inicia OBS/streaming; apenas identifica o estado da apresentação.':
     'Encerrar o status AO VIVO e voltar ao ensaio?'))return;
 busy=true;
 try{
  const r=await db.rpc('live_script_control',{p_action:'mode',p_mode:live?'ao-vivo':'ensaio'});
  if(r.error)throw Error(r.error.message);
 }catch(e){alert(e.message)}finally{busy=false;await refresh(true)}
}
function changePreview(mode){
 if(mode==='published'&&!model?.published_version)return;
 preview=mode==='preview';indexLocal=0;lastSig='';setUrl();refresh(true);
}
root.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.view){view=b.dataset.view;setUrl();lastSig='';render();return}
 if(b.dataset.mode){changePreview(b.dataset.mode);return}
 if(b.dataset.index!==undefined){changeScene(Number(b.dataset.index));return}
 if(b.dataset.action==='next'){changeScene(index()+1);return}
 if(b.dataset.action==='back'){changeScene(index()-1);return}
 if(b.dataset.action==='reset'){changeScene(0);return}
 if(b.dataset.action==='mode'){changeMode();return}
});
window.addEventListener('keydown',e=>{
 if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.metaKey||e.altKey||e.ctrlKey)return;
 if(e.code==='Escape'&&view==='tela'){view='maestro';setUrl();lastSig='';render();return}
 if(!preview&&view!=='maestro')return;
 if(e.code==='ArrowRight'||e.code==='Space'){e.preventDefault();changeScene(index()+1)}
 if(e.code==='ArrowLeft'){e.preventDefault();changeScene(index()-1)}
});
setUrl();await refresh(true);
db.channel('live-script-stage').on('postgres_changes',{event:'UPDATE',schema:'public',table:'live_script_runtime',filter:'lesson_id=eq.sprint-isr'},()=>{if(!preview&&!busy)refresh()}).subscribe();
setInterval(()=>{if(!busy)refresh()},3000);
})().catch(e=>{
 document.getElementById('root').innerHTML='<div class="card" style="margin-top:35px"><h2>Erro ao iniciar Maestro</h2><p>'+
 String(e.message||e).replace(/[<>&]/g,'')+'</p><a href="./roteiro.html">Voltar ao roteiro</a></div>';
});