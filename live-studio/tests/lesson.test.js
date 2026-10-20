const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const lesson=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/lesson.json'),'utf8'));
test('Os quatro blocos e cinco pacientes estão presentes',()=>{assert.equal(lesson.cases.length,4);assert.match(lesson.cases[3].patient,/EAP.*BAVT/)});
test('Todas as cenas possuem roteiro e direção técnica',()=>{const scenes=lesson.cases.flatMap(c=>c.scenes);assert.equal(scenes.length,10);for(const scene of scenes)for(const key of ['id','title','gil','diego','clinical','technical','cueGil','cueDiego','objective'])assert.ok(scene[key],`${scene.id}: ${key}`)});
test('Todas as votações possuem opções e explicação',()=>{for(const c of lesson.cases)for(const s of c.scenes){assert.ok(s.poll.options.length>=2);assert.ok(s.poll.options[s.poll.correct]);assert.ok(s.poll.explanation)}});
