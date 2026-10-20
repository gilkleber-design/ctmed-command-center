const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 8000);
const HOST = process.env.HOST || '0.0.0.0';
const DATA = path.join(__dirname,'data');
const PUBLIC = path.join(__dirname,'public');
const LESSON = path.join(DATA,'lesson.json');
const RUNTIME = path.join(DATA,'runtime.json');
const SECRET = process.env.LIVE_STUDIO_SECRET;
if (!SECRET || SECRET.length < 12) {
 console.error('Defina LIVE_STUDIO_SECRET com pelo menos 12 caracteres antes de iniciar.');
 process.exit(1);
}
const protectedOps = new Set(['advance','back','goto','start_poll','close_poll','reveal_poll','reset_poll','vitals','notice','save_lesson','reset_session']);
function read(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return fallback}}
function save(file,val){let tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(val,null,2));fs.renameSync(tmp,file)}
let lesson=read(LESSON,{});
const scenes=()=>lesson.cases.flatMap(c=>c.scenes.map(s=>({...s,caseTitle:c.title,patient:c.patient})));
let runtime=read(RUNTIME,{index:0,step:0,pollPhase:'hidden',votes:{},notice:'',startedAt:null,session:'ensaio',vitalsOverride:{}});
const phases=['case','question','poll','results','answer','discussion'];
const current=()=>scenes()[Math.min(Math.max(runtime.index,0),scenes().length-1)];
function snapshot(){return {lesson,runtime,scene:current(),total:scenes().length,phases}}
function response(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
function auth(token){return !!token&&token===SECRET}
const MIME={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
const clients=new Set();
function broadcast(){const m=`data: ${JSON.stringify({type:'state',data:snapshot()})}\n\n`;for(const c of clients){try{c.write(m)}catch{clients.delete(c)}}}
function handle(m){
 if(m.type==='vote'){
   if(runtime.pollPhase!=='open'||!current()?.poll)return {error:'Votação fechada'};
   const opt=Number(m.option);if(!Number.isInteger(opt)||opt<0||opt>=current().poll.options.length)return {error:'Alternativa inválida'};
   const client=String(m.voter||'').slice(0,80);if(!/^[a-zA-Z0-9_-]{10,80}$/.test(client))return {error:'Identificador inválido'};
   runtime.votes[client]=opt;save(RUNTIME,runtime);broadcast();return {ok:true};
 }
 if(protectedOps.has(m.type)&&!auth(m.token))return {error:'Senha de controle inválida.'};
 let changed=true;
 if(m.type==='advance'){
   if(runtime.step<phases.length-1)runtime.step++;
   else if(runtime.index<scenes().length-1){runtime.index++;runtime.step=0;runtime.votes={};runtime.pollPhase='hidden';runtime.vitalsOverride={}}
   if(runtime.step===2)runtime.pollPhase='open';if(runtime.step===3)runtime.pollPhase='closed';if(runtime.step===4)runtime.pollPhase='revealed';
 }else if(m.type==='back'){
   if(runtime.step>0)runtime.step--;
   else if(runtime.index>0){runtime.index--;runtime.step=0;runtime.votes={};runtime.pollPhase='hidden';runtime.vitalsOverride={}}
   if(runtime.step<2)runtime.pollPhase='hidden';else if(runtime.step===2)runtime.pollPhase='open';else if(runtime.step===3)runtime.pollPhase='closed';else runtime.pollPhase='revealed';
 }else if(m.type==='goto'){
   const i=Number(m.index);if(!Number.isInteger(i)||i<0||i>=scenes().length)return {error:'Cena inválida'};
   runtime.index=i;runtime.step=0;runtime.votes={};runtime.pollPhase='hidden';runtime.vitalsOverride={};
 }else if(m.type==='start_poll'){runtime.step=2;runtime.pollPhase='open';runtime.votes={}}
  else if(m.type==='close_poll'){runtime.step=3;runtime.pollPhase='closed'}
  else if(m.type==='reveal_poll'){runtime.step=4;runtime.pollPhase='revealed'}
  else if(m.type==='reset_poll'){runtime.step=1;runtime.pollPhase='hidden';runtime.votes={}}
  else if(m.type==='vitals'){runtime.vitalsOverride={...runtime.vitalsOverride,...m.vitals}}
  else if(m.type==='notice'){runtime.notice=String(m.notice||'').slice(0,220)}
  else if(m.type==='reset_session'){runtime={index:0,step:0,pollPhase:'hidden',votes:{},notice:'',startedAt:Date.now(),session:m.session==='ao-vivo'?'ao-vivo':'ensaio',vitalsOverride:{}}}
  else if(m.type==='save_lesson'){
    const l=m.lesson;if(!l||!Array.isArray(l.cases)||l.cases.length<1||l.cases.some(c=>!Array.isArray(c.scenes)||!c.scenes.length))return {error:'Estrutura inválida'};
    lesson={...l,version:Number(lesson.version||0)+1};save(path.join(DATA,`backup-${Date.now()}.json`),read(LESSON,{}));save(LESSON,lesson);runtime.index=Math.min(runtime.index,scenes().length-1);
  }else changed=false;
 if(changed){save(RUNTIME,runtime);broadcast()}return {ok:true};
}
const srv=http.createServer((req,res)=>{
 let url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/state')return response(res,200,snapshot());
 if(url.pathname==='/api/health')return response(res,200,{ok:true,clients:clients.size});
 if(url.pathname==='/api/export')return response(res,200,lesson);
 if(url.pathname==='/api/events'){
  res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
  clients.add(res);res.write(`data: ${JSON.stringify({type:'state',data:snapshot()})}\n\n`);req.on('close',()=>clients.delete(res));return;
 }
 if(url.pathname==='/api/action'&&req.method==='POST'){
  let data='';req.on('data',d=>{data+=d;if(data.length>2000000)req.destroy()});req.on('end',()=>{try{const out=handle(JSON.parse(data));response(res,out.error?403:200,out)}catch(e){response(res,400,{error:'Dados inválidos'})}});return;
 }
 if(url.pathname.startsWith('/api/'))return response(res,404,{error:'Not found'});
 const rel=url.pathname==='/'?'/index.html':url.pathname;const full=path.resolve(PUBLIC,'.'+rel);
 if(!full.startsWith(PUBLIC+path.sep))return response(res,403,{error:'Forbidden'});
 fs.readFile(full,(err,data)=>{if(err){res.writeHead(404);res.end('Arquivo não encontrado');return;}res.writeHead(200,{'Content-Type':MIME[path.extname(full)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(data)});
});
srv.listen(PORT,HOST,()=>console.log(`CT-MED LIVE STUDIO → http://localhost:${PORT}`));
