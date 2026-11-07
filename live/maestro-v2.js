(async function(){
'use strict';
const root=document.getElementById('root');
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const inline=s=>esc(s).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*([^*]+)\*/g,'<em>$1</em>').replace(/\x60([^\x60]+)\x60/g,'<code>$1</code>');
function markdown(raw){
 const lines=String(raw||'').replace(/\r/g,'').split('\n'),out=[];
 let list='';
 const close=()=>{if(list){out.push('</'+list+'>');list=''}};
 const cells=t=>t.trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(x=>x.trim());
 for(let i=0;i<lines.length;i++){
  const t=lines[i].trim();
  if(!t){close();continue}
  if(/^\|.*\|$/.test(t)&&lines[i+1]&&cells(lines[i+1]).every(c=>/^:?-{3,}:?$/.test(c))){
   close();const heads=cells(t);const rows=[];i+=2;
   while(i<lines.length&&/^\|.*\|$/.test(lines[i].trim())){rows.push(cells(lines[i]));i++}i--;
   out.push('<table><thead><tr>'+heads.map(x=>'<th>'+inline(x)+'</th>').join('')+'</tr></thead><tbody>'+
     rows.map(r=>'<tr>'+r.map(x=>'<td>'+inline(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table>');
   continue;
  }
  const heading=t.match(/^(#{1,6})\s+(.+)$/);
  if(heading){close();const h=Math.min(heading[1].length+1,4);out.push('<h'+h+'>'+inline(heading[2])+'</h'+h+'>');continue}
  if(/^[-_*]{3,}$/.test(t)){close();out.push('<hr>');continue}
  if(/^>\s*/.test(t)){close();out.push('<blockquote>'+inline(t.replace(/^>\s*/,''))+'</blockquote>');continue}
  const bullet=t.match(/^(?:[-*•]|\d+[.)])\s+(.+)$/);
  if(bullet){const next=/^\d+[.)]/.test(t)?'ol':'ul';if(list!==next){close();out.push('<'+next+'>');list=next}out.push('<li>'+inline(bullet[1])+'</li>');continue}
  close();out.push('<p>'+inline(t)+'</p>');
 }
 close();return out.join('');
}
const cfg=await fetch('../index.html',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Falha ao carregar configuração do Command Center');return r.text()});
const url=cfg.match(/SUPABASE_URL:'([^']+)'/)?.[1];
const key=cfg.match(/SUPABASE_ANON_KEY:'([^']+)'/)?.[1];
if(!url||!key||!window.supabase)throw Error('Não foi possível iniciar o Supabase');
const db=window.supabase.createClient(url,key);
const params=new URLSearchParams(location.search);
const availableViews=['maestro','gil','diego','tecnica'];
let view=availableViews.includes(params.get('view'))?params.get('view'):'maestro';
let preview=params.get('preview')==='1';
let localIndex=0,openResource='',model=null,busy=false,first=true,lastSig='';
const textView={maestro:'Maestro',gil:'Roteiro Gil',diego:'Roteiro Diego',tecnica:'Direção técnica'};
const scenes=()=>Array.isArray(model?.items)?model.items.filter(x=>x.stage===true):[];
const refs=()=>Array.isArray(model?.items)?model.items.filter(x=>x.stage!==true):[];
const index=()=>preview?localIndex:Math.min(scenes().length-1,Math.max(0,Number(model?.scene_index)||0));
const current=()=>openResource?model?.items.find(x=>x.id===openResource):scenes()[index()];
function setUrl(){
 const q=new URLSearchParams();
 q.set('view',view);
 if(preview)q.set('preview','1');
 history.replaceState({},'',location.pathname+'?'+q);
}
function message(msg,error=false){
 const el=$('#feedback');
 if(el){el.textContent=msg;el.style.color=error?'#ffad9d':'#f5a524'}
}
function stateChip(){
 if(preview)return '<span class="chip warn">PRÉVIA · NÃO PUBLICADA</span>';
 if(model?.published_version)return '<span class="chip ready">PUBLICADA · V'+model.published_version+'</span>';
 return '<span class="chip warn">SEM PUBLICAÇÃO</span>';
}
function modeButton(code,label){
 return '<button data-mode="'+code+'" class="'+(preview===(code==='preview')?'active':'')+'" '+(code==='published'&&!model?.published_version?'disabled':'')+'>'+label+'</button>';
}
function sceneNav(){
 return scenes().map((s,i)=>'<button class="navitem '+(!openResource&&index()===i?'active':'')+'" data-goto="'+i+'">'+
 '<span class="number">'+String(i+1).padStart(2,'0')+'</span><span style="flex:1">'+esc(s.title)+'</span><small>'+esc('v'+s.revision)+'</small></button>').join('');
}
function refNav(){
 return refs().map(r=>'<button class="navitem '+(openResource===r.id?'active':'')+'" data-resource="'+esc(r.id)+'">'+
 '<span class="number">◎</span><span style="flex:1">'+esc(r.title)+'</span></button>').join('');
}
function content(){
 const n=scenes().length,s=current(),i=index();
 if(!s)return '<div class="panel"><h2>Nenhuma cena disponível</h2><p>Volte à Sala de Construção para concluir os consensos.</p><a href="./revisao.html">Abrir Sala de Construção</a></div>';
 const progress='<span class="tiny">'+(openResource?'Documento de apoio':'Cena '+(i+1)+' de '+n)+' · Texto integral aprovado, sem edição automática</span>';
 const nav='<div class="navbuttons">'+
   '<button data-op="back" '+(openResource||i===0?'disabled':'')+'>← Anterior</button>'+
   '<button data-op="next" class="primary" '+(openResource||i>=n-1?'disabled':'')+'>Próxima →</button>'+
   (openResource?'<button data-resource="" class="primary">Voltar à apresentação</button>':'')+
   '<button data-print="1">Imprimir roteiro</button>'+
   '</div>';
 return '<section class="panel reader">'+
   '<div class="boxrow"><div class="eyebrow">'+esc(openResource?'DOCUMENTAÇÃO':'ROTEIRO OPERACIONAL · '+textView[view])+'</div>'+progress+'</div>'+
   '<h2>'+esc(s.title)+'</h2>'+
   '<p class="intro">Consenso aprovado · revisão '+esc(s.revision)+' · '+(preview?'visualização sem afetar a transmissão':'versão congelada da publicação')+'</p>'+
   nav+'<div class="script">'+markdown(s.text)+'</div>'+nav+'</section>';
}
function show(){
 if(!model)return;
 const hasPub=Number(model.published_version)>0;
 const ready=model.ready&&Number(model.required)>=6&&Number(model.approved)===Number(model.required);
 const list=scenes(),total=Number(model.required)||0,approved=Number(model.approved)||0;
 let context=preview?
   '<div class="notice '+(ready?'good':'warn')+'"><strong>Pré-visualização do roteiro atual.</strong> '+approved+'/'+total+' seções consolidadas. '+(ready?'A versão está apta para publicação manual.':'Finalize as aprovações na Sala de Construção antes de publicar.')+'</div>':
   '<div class="notice good"><strong>Roteiro congelado.</strong> Avançar ou voltar sincroniza a cena entre os painéis Maestro, Gil, Diego e Direção técnica. O texto aprovado permanece intacto.</div>';
 const publish=preview?
   '<button class="primary" id="publish" '+(!ready||busy?'disabled':'')+'>Publicar versão aprovada</button>':
   '<button id="previewButton">Conferir novas aprovações</button>';
 const panel=hasPub?modeButton('published','Versão publicada V'+model.published_version):'';
 root.innerHTML='<div class="headline"><div><span class="overline">SPRINT ISR · NOVO ROTEIRO</span><h1>'+textView[view]+'</h1>'+
   '<p>Abordagem atual: abertura + três casos aprovados. Visão de referência: pauta e próximos passos.</p>'+
   '<div class="toolbar">'+stateChip()+'<span class="tiny">'+(hasPub?'Última publicação: '+new Date(model.published_at).toLocaleString('pt-BR'):'Nenhuma versão publicada ainda')+'</span></div></div>'+
   '<div class="toolbar">'+modeButton('preview','Pré-visualizar')+panel+' '+publish+'</div></div>'+
   context+
   '<div class="layout"><aside class="panel sidebar"><h3>Cenas do Maestro</h3><div class="navitems">'+sceneNav()+'</div>'+
   '<div class="rule"></div><h3>Documentos de apoio</h3><div class="navitems">'+refNav()+'</div>'+
   '<div class="rule"></div><p class="tiny">Atalhos: ← e → para navegar. O conteúdo exibido foi mantido na íntegra.</p>'+
   '<p id="feedback" role="status" aria-live="polite"></p></aside><div>'+content()+
   '<p class="details">Observação operacional: a sincronização v2 controla os painéis dos professores e a direção técnica. A votação dos alunos e a projeção pública antigas ainda são módulos separados; não as utilize como se estivessem sincronizadas com este roteiro.</p></div></div>';
}
async function refresh(force=false){
 if(busy&&!force)return;
 try{
  const s=await db.auth.getSession();
  if(!s.data?.session){root.innerHTML='<div class="panel loading"><h2>Sessão necessária</h2><p>Entre primeiro com sua conta individual no Command Center.</p><a href="../">Ir para o login →</a></div>';$('#connection').textContent='● Login necessário';return}
  const r=await db.rpc('live_v2_snapshot',{p_preview:preview});
  if(r.error)throw Error(r.error.message);
  let next=r.data;
  if(!preview&&(!next.published_version||!next.items?.length)){preview=true;setUrl();const p=await db.rpc('live_v2_snapshot',{p_preview:true});if(p.error)throw Error(p.error.message);next=p.data;}
  const sig=JSON.stringify(next)+'|'+view+'|'+preview+'|'+localIndex+'|'+openResource;
  if(sig!==lastSig||force){model=next;lastSig=sig;localIndex=Math.min(Math.max(0,localIndex),Math.max(0,scenes().length-1));show()}
  $('#connection').textContent='● Sincronizado';
  first=false;
 }catch(e){$('#connection').textContent='● Erro de sincronização';if(first){root.innerHTML='<div class="panel loading"><h2>Falha ao abrir o Maestro</h2><p>'+esc(e.message)+'</p><a href="./revisao.html">Voltar à sala de construção</a></div>'}else message(e.message,true)}
}
function navigatePage(isPreview){
 preview=isPreview;localIndex=0;openResource='';lastSig='';setUrl();refresh(true);
}
async function changeScene(next){
 if(busy||openResource)return;
 next=Math.max(0,Math.min(scenes().length-1,next));
 if(preview){localIndex=next;lastSig='';show();return}
 busy=true;
 try{
  const r=await db.rpc('live_v2_control',{p_action:'goto',p_index:next});
  if(r.error)throw Error(r.error.message);
 }catch(e){message(e.message,true)}finally{busy=false;await refresh(true)}
}
async function publish(){
 if(busy||!preview||!model?.ready)return;
 if(!confirm('Publicar uma nova versão congelada do roteiro aprovado por Gil e Diego? A publicação não inicia uma transmissão nem altera os textos editoriais.'))return;
 busy=true;
 try{
  const r=await db.rpc('live_v2_publish');
  if(r.error)throw Error(r.error.message);
  preview=false;localIndex=0;openResource='';lastSig='';setUrl();
  await refresh(true);
  message('Versão '+r.data.version+' publicada. O Maestro está em modo de ensaio.');
 }catch(e){message('Falha na publicação: '+e.message,true)}finally{busy=false}
}
document.addEventListener('click',async e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.mode){navigatePage(b.dataset.mode==='preview');return}
 if(b.id==='previewButton'){navigatePage(true);return}
 if(b.id==='publish'){await publish();return}
 if(b.hasAttribute('data-goto')){openResource='';await changeScene(Number(b.dataset.goto));return}
 if(b.hasAttribute('data-resource')){openResource=b.dataset.resource||'';lastSig='';show();return}
 if(b.dataset.op==='next'){await changeScene(index()+1);return}
 if(b.dataset.op==='back'){await changeScene(index()-1);return}
 if(b.dataset.print){window.print();return}
});
document.addEventListener('keydown',e=>{
 if(e.altKey||e.ctrlKey||e.metaKey||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable)return;
 if(e.code==='ArrowRight'||e.code==='Space'){e.preventDefault();changeScene(index()+1)}
 if(e.code==='ArrowLeft'){e.preventDefault();changeScene(index()-1)}
});
await refresh(true);
db.channel('live-v2-runtime').on('postgres_changes',{event:'UPDATE',schema:'public',table:'live_v2_runtime',filter:'lesson_id=eq.sprint-isr'},()=>{if(!preview&&!busy)refresh()}).subscribe();
setInterval(()=>{if(!busy)refresh()},8000);
})().catch(e=>{document.getElementById('root').innerHTML='<div class="panel loading"><h2>Falha ao inicializar o Maestro</h2><p>'+String(e.message||e).replace(/[<>&]/g,'')+'</p><a href="../">Voltar ao Command Center</a></div>'});