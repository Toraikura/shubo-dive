'use strict';
const fs=require('node:fs');const vm=require('node:vm');const crypto=require('node:crypto');
const path=require('node:path'),root=path.join(__dirname,'..'),source=path.join(root,'src/core.js');
const code=fs.readFileSync(source,'utf8');vm.runInThisContext(code,{filename:source});
const {Game,dist,forward,inside,segmentObstacle,clamp,SECTORS}=globalThis.ShuboCore;
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const point=p=>({x:p.x,y:p.y,z:p.z});
function makeNav(g){
  const nodes=[];const grid=new Map();let edgeCache=new Map();
  const safe=p=>Math.hypot(p.x,p.z)<125&&!g.obstacles.some(o=>inside(p,o,3));
  for(let ix=0;ix<15;ix++)for(let iy=0;iy<7;iy++)for(let iz=0;iz<15;iz++){
    const p={x:-112+ix*16,y:-28+iy*16,z:-112+iz*16,ix,iy,iz};
    if(safe(p)){p.id=nodes.length;nodes.push(p);grid.set(`${ix},${iy},${iz}`,p.id);}
  }
  const line=(a,b,pad=2)=>!g.obstacles.some(o=>segmentObstacle(a,b,o,pad)!==null);
  const flyable=(a,b)=>Math.abs(b.y-a.y)<Math.hypot(b.x-a.x,b.z-a.z)*1.78+1;
  const clear=(a,b,pad=2)=>line(a,b,pad)&&flyable(a,b);
  function path(a,b){
    const pad=g.obstacles.some(o=>inside(a,o,2))?1.11:2;
    if(clear(a,b,pad))return [point(b)];
    const starts=nodes.map(n=>({id:n.id,d:dist(n,a)})).sort((x,y)=>x.d-y.d).slice(0,40).filter(n=>clear(a,nodes[n.id],pad));
    const goals=nodes.map(n=>({id:n.id,d:dist(n,b)})).sort((x,y)=>x.d-y.d).slice(0,40).filter(n=>clear(nodes[n.id],b));
    if(!starts.length||!goals.length)return null;
    const ends=new Set(goals.map(n=>n.id));const cost=new Map(starts.map(n=>[n.id,n.d]));const parent=new Map();const seen=new Set();const open=starts.map(n=>n.id);
    while(open.length){
      open.sort((x,y)=>(cost.get(x)+dist(nodes[x],b))-(cost.get(y)+dist(nodes[y],b)));const id=open.shift();if(seen.has(id))continue;seen.add(id);
      if(ends.has(id)){let out=[point(b)],cur=id;while(cur!==undefined){out.push(point(nodes[cur]));cur=parent.get(cur);}out.reverse();let smooth=[],from=a;for(let i=0;i<out.length;){let j=out.length-1;while(j>i&&!clear(from,out[j],smooth.length?2:pad))j--;smooth.push(out[j]);from=out[j];i=j+1;}return smooth;}
      const n=nodes[id];
      for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){
        if(!dx&&!dz)continue;const next=grid.get(`${n.ix+dx},${n.iy+dy},${n.iz+dz}`);if(next===undefined||seen.has(next))continue;
        const key=id<next?`${id}:${next}`:`${next}:${id}`;let allowed=edgeCache.get(key);if(allowed===undefined){allowed=line(n,nodes[next],2);edgeCache.set(key,allowed);}if(!allowed)continue;
        const nc=cost.get(id)+dist(n,nodes[next]);if(nc<(cost.get(next)??Infinity)){cost.set(next,nc);parent.set(next,id);open.push(next);}
      }
    }return null;
  }return {path,line,clear};
}
function run(seed){
  const g=new Game(seed,{},'normal');let nav=makeNav(g),route=[],routeKey='',planAt=-99,sector=-1,lastHp=g.player.hp,lowestHp=g.player.hp,counts={},phases=new Set(),stages=[],badPaths=0,lastProgress=0,lastKills=0,lastSaved=0,trace=[];
  const dt=1/60;let controls={frames:0,turn:0,pitch:0,brake:0,pulse:0,boost:0};let stalled=0, escape=null, escapeUntil=0, bossState=0;const motion={minX:g.player.x,maxX:g.player.x,minY:g.player.y,maxY:g.player.y,minZ:g.player.z,maxZ:g.player.z,distance:0,ascent:0,descent:0,maxEnemies:0,maxBullets:0,terrainOverlapFrames:0};
  for(let frame=0;frame<60*600;frame++){
    if(g.status==='upgrade')g.choosePerk('hull');
    if(g.status!=='playing')break;
    if(g.sector!==sector){sector=g.sector;nav=makeNav(g);route=[];routeKey='';stages.push({sector:sector+1,start:g.clock});lastProgress=g.clock;}
    const p=g.player,boss=g.enemies.find(e=>e.type===3);if(boss)phases.add(boss.phase);
    const nearest=g.enemies.filter(e=>e.hp>0&&g.visible(p,e)).sort((a,b)=>dist(a,p)-dist(b,p))[0];
    let goal=g.objective();let mode=goal.kind;
    // Turn to threats within rescue radius; otherwise follow the ordinary objective.
    if(!g.gate&&nearest&&dist(nearest,p)<19){goal={...nearest,kind:'combat'};mode='combat';}
    if(mode==='enemy'||mode==='boss')mode='combat';
    if(boss&&((boss.state===1&&bossState!==1)||(dist(p,boss)<8&&g.clock>escapeUntil))){
      const ang=boss.state===1?Math.atan2(boss.dx,boss.dz)+Math.PI/2:Math.atan2(p.x-boss.x,p.z-boss.z);
      const choices=[ang,ang+Math.PI,ang+Math.PI/2,ang-Math.PI/2].map(a=>({x:p.x+Math.sin(a)*28,y:p.y,z:p.z+Math.cos(a)*28,kind:'escape'}));
      escape=choices.find(v=>Math.hypot(v.x,v.z)<125&&nav.clear(p,v,2))||choices[0];escapeUntil=g.clock+2.8;
    }
    bossState=boss?.state??0;
    if(boss&&escape&&g.clock<escapeUntil&&dist(p,escape)>4){goal=escape;mode='escape';}
    const key=mode==='combat'?`combat:${goal.id}`:`${sector}:${mode}:${goal.id??''}`;
    let aim=goal;const distance=dist(p,goal);
    if(mode!=='combat'){
      if(key!==routeKey||!route.length||g.clock-planAt>4){route=nav.path(p,goal)||[];if(!route.length)badPaths++;routeKey=key;planAt=g.clock;}
      while(route.length>1&&dist(p,route[0])<4)route.shift();aim=route[0]||goal;
    }else{routeKey=key;route=[];}
    let yaw=Math.atan2(aim.x-p.x,aim.z-p.z),pitch=Math.atan2(aim.y-p.y,Math.hypot(aim.x-p.x,aim.z-p.z));
    const yawErr=wrap(yaw-p.yaw),pitchErr=clamp(pitch,-1.10,1.10)-p.pitch;
    let brake=Math.abs(yawErr)>.48||Math.abs(pitchErr)>.35;
    if(mode==='combat')brake=brake||distance<27;
    else brake=brake||(route.length<=1&&distance<(mode==='rescue'?5.4:4.2));
    const close=g.enemies.some(e=>dist(e,p)<14.8);
    const input={turn:clamp(yawErr*3.5,-1,1),pitch:clamp(pitchErr*4,-1,1),brake,pulse:close&&p.pulseCd===0,boost:false};
    // An aligned, long, unobstructed travel segment can use the player's boost.
    if(mode!=='combat'&&!brake&&distance>24&&Math.abs(yawErr)<.12&&Math.abs(pitchErr)<.12&&p.boostCd===0){const f=forward(p.yaw,p.pitch),end={x:p.x+f[0]*25,y:p.y+f[1]*25,z:p.z+f[2]*25};input.boost=nav.line(p,end,3);}
    const before=point(p);g.step(dt,input);
    for(const axis of ['X','Y','Z']){motion['min'+axis]=Math.min(motion['min'+axis],p[axis.toLowerCase()]);motion['max'+axis]=Math.max(motion['max'+axis],p[axis.toLowerCase()]);}
    motion.distance+=dist(before,p);motion.ascent+=Math.max(0,p.y-before.y);motion.descent+=Math.max(0,before.y-p.y);motion.maxEnemies=Math.max(motion.maxEnemies,g.enemies.length);motion.maxBullets=Math.max(motion.maxBullets,g.bullets.length);if(g.obstacles.some(o=>inside(p,o,1.09)))motion.terrainOverlapFrames++;
    controls.frames++;for(const k of ['turn','pitch','brake','pulse','boost'])if(input[k])controls[k]++;
    if(g.player.hp<lastHp){counts.damageTaken=(counts.damageTaken||0)+(lastHp-g.player.hp);counts.hits=(counts.hits||0)+1;}lastHp=g.player.hp;lowestHp=Math.min(lowestHp,g.player.hp);
    for(const e of g.drain()){counts[e.type]=(counts[e.type]||0)+1;if(['rescue','gate','boss','bossDown','upgrade','lost','won'].includes(e.type))trace.push({event:e.type,t:+g.clock.toFixed(2),sector:g.sector+1,hp:g.player.hp,kills:g.stageKills,saved:g.rescue.filter(r=>r.saved).length,p:point(p)});}
    if(g.kills!==lastKills||g.saved!==lastSaved){lastProgress=g.clock;lastKills=g.kills;lastSaved=g.saved;}
    if(frame%600===0)trace.push({event:'sample',t:+g.clock.toFixed(2),sector:g.sector+1,hp:p.hp,mode,goal:point(goal),p:point(p),distance:+distance.toFixed(2),enemy:g.enemies.length,kills:g.stageKills,route:route.length});
    if(g.clock-lastProgress>80&&!g.gate){stalled++;break;}
  }
  const result={seed,status:g.status,sector:g.sector+1,clock:+g.clock.toFixed(2),hp:g.player.hp,maxHp:g.player.maxHp,lowestHp,kills:g.kills,saved:g.saved,bossSpawned:g.bossSpawned,bossDefeated:g.bossDefeated,bossPhases:[...phases],perks:g.perks,counts,controls,motion,badPaths,stalled,stages,final:{p:point(g.player),objective:g.objective(),enemies:g.enemies.map(e=>({id:e.id,type:e.type,hp:e.hp,...point(e)}))}};
  return result;
}
const seeds=process.argv.slice(2).map(Number);const results=(seeds.length?seeds:[941,1842,3091]).map(run);const out={source:'src/core.js',sha256:crypto.createHash('sha256').update(code).digest('hex'),inputOnly:true,allowedMutators:['step','choosePerk','drain'],results};fs.writeFileSync(path.join(root,'docs/campaign-verification.json'),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out,null,2));process.exitCode=results.every(r=>r.status==='won'&&r.saved===9&&r.motion.ascent>80&&r.motion.descent>80&&r.motion.terrainOverlapFrames===0)?0:1;
