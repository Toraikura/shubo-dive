const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const path=require('node:path'),root=path.join(__dirname,'..');
const context=vm.createContext({console,Float32Array,Math,Number,JSON,Set});
for(const file of ['core.js','renderer.js'])vm.runInContext(fs.readFileSync(path.join(root,'src',file),'utf8'),context,{filename:file});
const C=context.ShuboCore,R=context.ShuboRender;
let checks=0;function ok(value,message){assert.ok(value,message);checks++;}
const html=fs.readFileSync(path.join(root,'dist/index.html'),'utf8');
ok(!/<(?:script|link|img|iframe)[^>]+(?:src|href)=/i.test(html),'no external runtime assets');
ok(!/fetch\(|XMLHttpRequest|import\(/.test(html),'offline runtime');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
// Dynamic menu strings may repeat an ID across mutually exclusive screens.
const shell=fs.readFileSync(path.join(root,'src/shell.html'),'utf8'),shellIds=[...shell.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
ok(new Set(shellIds).size===shellIds.length,'unique static IDs');
for(const s of html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g))new vm.Script(s[1]);
ok(!html.includes('/* INLINE_'),'all build placeholders replaced');
const meshCounts={};
for(const kind of ['sphere','tube','box']){
  const m=R.mesh(kind);meshCounts[kind]=m.count/3;ok(m.p.length===m.n.length,'normal count');ok([...m.p,...m.n].every(Number.isFinite),'finite mesh');
  for(let i=0;i<m.p.length;i+=9){const center=[0,1,2].map(k=>(m.p[i+k]+m.p[i+3+k]+m.p[i+6+k])/3),dot=center.reduce((v,x,k)=>v+x*m.n[i+k],0);ok(dot>0,`${kind} outward normal ${i/9}: ${dot}`);}
}
const budgets=[];
function validateBatch(b){let count=0,triangles=0;for(const [kind,data]of Object.entries(b)){ok(data.length%14===0,'instance stride');ok(data.every(Number.isFinite),'finite instances');for(let i=0;i<data.length;i+=14){ok(data.slice(i+3,i+6).every(n=>n>0),'positive scale');ok(Math.abs(Math.hypot(...data.slice(i+6,i+10))-1)<.001,'normalized quaternion');}count+=data.length/14;triangles+=data.length/14*meshCounts[kind];}return {count,triangles};}
for(let stage=0;stage<3;stage++){
  const batch=R.scenery(stage,941),stat=validateBatch(batch);ok(stat.triangles<150000,'bounded static geometry');budgets.push({stage,...stat});
  const game=new C.Game();game.sector=stage;game.setWorld();game.saved=9;game.gate=true;game.spawn(3);for(let i=0;i<11;i++)game.spawn(i%3);for(let i=0;i<96;i++)game.bullet(0,0,1,1,i%2===0);
  const renderer=Object.create(R.Renderer.prototype);renderer.effects=Array.from({length:24},()=>({type:'pulse',x:0,z:0,t:.25,life:.55,value:18}));renderer.buildDynamic(game,5,true);const dyn=validateBatch(renderer.dynamic);ok(dyn.triangles<100000,'bounded worst-case dynamic geometry');budgets.at(-1).worstDynamic=dyn;
}
const view=R.lookAt([0,10,20],[0,0,0]),proj=R.perspective(Math.PI/3,1,.2,200),vp=R.multiply(proj,view);ok([...vp].every(Number.isFinite),'camera finite');
const w=vp[15];ok(Math.abs(vp[12]/w)<1e-6&&Math.abs(vp[13]/w)<1e-6,'look target centered');
function finiteGame(g){
  ok(Number.isFinite(g.score)&&g.score>=0,'score valid');ok(g.player.hp>=0&&g.player.hp<=g.player.maxHp,'health valid');ok(Math.hypot(g.player.x,g.player.z)<=61,'arena bounded');
  ok(g.enemies.length<=C.LIMITS.enemies&&g.bullets.length<=C.LIMITS.bullets&&g.drops.length<=C.LIMITS.drops,'entity caps');
  for(const list of [g.enemies,g.bullets,g.drops])ok(list.every(e=>Number.isFinite(e.x)&&Number.isFinite(e.z)),'finite moving entities');
}
const run=new C.Game(18);for(let i=0;i<30000&&run.status==='playing';i++){run.step(1/60);run.drain();if(i%60===0)finiteGame(run);}ok(run.status==='lost','unattended play reaches defeat');
const shot=new C.Game(1);shot.spawnTimer=999;const enemy=shot.spawn(0);enemy.x=0;enemy.z=24;const hp=enemy.hp;
for(let i=0;i<120;i++){shot.step(1/60);shot.drain();}ok(shot.kills>0||enemy.hp<hp,'auto-shot hits');
const pulse=new C.Game(2);pulse.spawnTimer=999;const e=pulse.spawn(0);e.x=2;e.z=35;pulse.bullet(2,35,-1,0,true);pulse.step(.016,{pulse:true});ok(pulse.kills===1,'pulse kills nearby enemy');ok(pulse.bullets.every(b=>!b.enemy),'pulse clears hostile projectiles');const cd=pulse.player.pulseCd;pulse.step(.016,{pulse:true});ok(pulse.player.pulseCd<cd,'cooldown prevents repeated pulse');
const inv=new C.Game(3);inv.hurt(10);const damaged=inv.player.hp;inv.hurt(10);ok(inv.player.hp===damaged,'damage invulnerability');inv.step(.016,{boost:true});ok(inv.player.boostCd>0,'boost starts');
const rescued=new C.Game(6);rescued.spawnTimer=999;rescued.player.x=rescued.rescue[0].x;rescued.player.z=rescued.rescue[0].z;for(let i=0;i<80;i++)rescued.step(1/60);ok(rescued.saved===1&&rescued.score===350,'rescue counted once');
const blocked=new C.Game(6);blocked.spawnTimer=999;blocked.player.x=blocked.rescue[0].x;blocked.player.z=blocked.rescue[0].z;const guard=blocked.spawn(3);guard.x=blocked.player.x;guard.z=blocked.player.z;guard.cd=999;blocked.player.shotCd=999;blocked.player.inv=999;for(let i=0;i<80;i++)blocked.step(1/60);ok(blocked.saved===0,'nearby enemies prevent rescue');
for(const source of [shot,pulse,run,rescued]){const original=source.snapshot(),restored=C.Game.restore(JSON.parse(JSON.stringify(original)));ok(restored,'valid save restores');ok(JSON.stringify(restored.snapshot())===JSON.stringify(original),'state round trip');}
for(const bad of [null,{}, {status:'playing',sector:99}, {...rescued.snapshot(),player:{...rescued.player,x:Infinity}}, {...rescued.snapshot(),enemies:Array(100).fill({})}])ok(C.Game.restore(bad)===null,'invalid saves rejected');
for(const key of Object.keys(rescued.snapshot())){const missing=rescued.snapshot();delete missing[key];ok(C.Game.restore(missing)===null,`missing save field safely rejected: ${key}`);}
ok(C.Game.restore({...rescued.snapshot(),status:'upgrade',sector:2})===null,'no upgrade after final sector');
const transition=new C.Game(7);transition.rescue.forEach(r=>r.saved=true);transition.saved=3;transition.stageKills=6;transition.step(.016);ok(transition.gate,'cleared goals open gate');transition.player.x=transition.exit.x;transition.player.z=transition.exit.z;transition.step(.016);ok(transition.status==='upgrade','gate reaches upgrade');ok(!transition.choosePerk('fake'),'invalid perk rejected');ok(transition.choosePerk('hull')&&transition.sector===1&&transition.player.maxHp===125,'perk advances stage');ok(!transition.choosePerk('hull'),'perk cannot repeat');
const boss=new C.Game(8);boss.sector=2;boss.setWorld();boss.stageKills=11;boss.rescue.forEach(r=>r.saved=true);boss.saved=9;boss.step(.016);ok(boss.bossSpawned&&boss.enemies.some(e=>e.type===3),'boss spawned after objectives');const big=boss.enemies[0];boss.hit(big,big.maxHp*.55);boss.step(.016);ok(big.phase===2,'boss phase two');boss.hit(big,999);boss.step(.016);ok(boss.bossDefeated&&boss.gate,'boss defeat opens final gate');boss.player.x=boss.exit.x;boss.player.z=boss.exit.z;boss.step(.016);ok(boss.status==='won','final extraction wins');const final=boss.snapshot();boss.step(1);ok(JSON.stringify(boss.snapshot())===JSON.stringify(final),'finished world does not progress');
const sameTick=new C.Game(4);sameTick.sector=2;sameTick.setWorld();sameTick.spawnTimer=999;sameTick.bossSpawned=true;sameTick.player.hp=1;sameTick.player.shotCd=999;const lastBoss=sameTick.spawn(3);lastBoss.hp=12;lastBoss.cd=999;lastBoss.x=20;lastBoss.z=0;sameTick.bullet(20,0,1,0,false,12,0);sameTick.bullet(sameTick.player.x,sameTick.player.z,1,0,true,99,0);sameTick.step(.016);ok(sameTick.bossDefeated&&sameTick.player.hp===1&&sameTick.status==='playing','boss kill cancels same-tick hostile bullets');
// Continuous gameplay, no teleportation / damage overrides: a simple navigator.
function navigation(game,target){
  const step=2.5,N=49,origin=-60,key=(x,z)=>z*N+x,cell=(v)=>clamp(Math.round((v-origin)/step),0,N-1),clamp=C.clamp;
  const sx=cell(game.player.x),sz=cell(game.player.z),tx=cell(target.x),tz=cell(target.z),start=key(sx,sz),end=key(tx,tz);
  const blocked=(x,z)=>{const p={x:origin+x*step,z:origin+z*step};return Math.hypot(p.x,p.z)>57||game.obstacles.some(o=>C.dist(o,p)<o.r+1.5);};
  const open=[start],cost=new Map([[start,0]]),parent=new Map(),closed=new Set();let found=start;
  for(let k=0;k<3000&&open.length;k++){
    let bi=0,bscore=Infinity;for(let j=0;j<open.length;j++){const id=open[j],x=id%N,z=Math.floor(id/N),score=cost.get(id)+Math.hypot(x-tx,z-tz);if(score<bscore){bi=j;bscore=score;}}
    const current=open.splice(bi,1)[0],x=current%N,z=Math.floor(current/N);if(Math.hypot(x-tx,z-tz)<1.5){found=current;break;}closed.add(current);
    for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
      const xx=x+dx,zz=z+dz;if(xx<0||xx>=N||zz<0||zz>=N||blocked(xx,zz)||((dx&&dz)&&(blocked(x+dx,z)||blocked(x,z+dz))))continue;
      const id=key(xx,zz);if(closed.has(id))continue;const nc=cost.get(current)+Math.hypot(dx,dz);if(nc<(cost.get(id)??Infinity)){cost.set(id,nc);parent.set(id,current);if(!open.includes(id))open.push(id);}
    }
  }
  if(found===start)return [target];const nodes=[];while(found!==start){nodes.push({x:origin+(found%N)*step,z:origin+Math.floor(found/N)*step});found=parent.get(found);if(found===undefined)break;}return nodes.reverse().concat([target]);
}
const campaigns=[];
for(const seed of [941,1842,3091]){
  const g=new C.Game(seed,{},'normal');let route=[],goalKey='',frames=0,stages=0;
  while(!['won','lost'].includes(g.status)&&frames<60*800){
    if(g.status==='upgrade'){g.choosePerk(stages++===0?'hull':'rapid');route=[];goalKey='';}
    let goal=g.objective();if(goal.kind==='boss'){
      const angle=g.clock*.25;goal={x:goal.x+Math.cos(angle)*15,z:goal.z+Math.sin(angle)*15,kind:'boss-orbit'};
    }
    const k=`${g.sector}:${goal.kind}:${goal.id??''}`;if(goalKey!==k||frames%90===0||!route.length){route=navigation(g,goal);goalKey=k;}
    while(route.length>1&&C.dist(g.player,route[0])<2)route.shift();const point=route[0]||goal,dx=point.x-g.player.x,dz=point.z-g.player.z,d=Math.hypot(dx,dz),near=g.nearestEnemy(12);
    let x=d>1?dx/d:0,z=d>1?dz/d:0;
    // Sidestep a nearby hostile projectile; all movement goes through step().
    const threat=g.bullets.find(b=>b.enemy&&C.dist(b,g.player)<4);if(threat){x+=-threat.vz*.15;z+=threat.vx*.15;}
    g.step(1/60,{x,z,pulse:!!near,boost:!!threat});g.drain();if(frames%60===0)finiteGame(g);frames++;
  }
  campaigns.push({seed,status:g.status,seconds:Math.round(g.clock),score:g.score,rescued:g.saved,hp:Math.round(g.player.hp),sector:g.sector});
  ok(g.status==='won',`full mission completes for seed ${seed}: ${JSON.stringify(campaigns.at(-1))}`);
}
const report={checks,bytes:Buffer.byteLength(html),meshTriangles:meshCounts,budgets,campaigns,unattendedDefeatSeconds:Math.round(run.clock),scope:'Node simulation and geometry only; no browser, shader compilation, GPU, or physical-device tests.'};
console.log(JSON.stringify(report,null,2));fs.writeFileSync(path.join(root,'docs','verification.json'),JSON.stringify(report,null,2)+'\n');
