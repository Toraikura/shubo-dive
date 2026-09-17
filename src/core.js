'use strict';
const ShuboCore=(()=>{
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const dist=(a,b)=>Math.hypot(a.x-b.x,(a.y||0)-(b.y||0),a.z-b.z);
  const normalize=v=>{const d=Math.hypot(...v)||1;return v.map(x=>x/d);};
  const forward=(yaw,pitch=0)=>[Math.sin(yaw)*Math.cos(pitch),Math.sin(pitch),Math.cos(yaw)*Math.cos(pitch)];
  const qmul=(a,b)=>[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
  const rotation=(yaw,pitch=0,roll=0)=>qmul(qmul([0,Math.sin(yaw/2),0,Math.cos(yaw/2)],[-Math.sin(pitch/2),0,0,Math.cos(pitch/2)]),[0,0,Math.sin(roll/2),Math.cos(roll/2)]);
  function rotate(v,q){const [x,y,z,w]=q,[a,b,c]=v,tx=2*(y*c-z*b),ty=2*(z*a-x*c),tz=2*(x*b-y*a);return [a+w*tx+y*tz-z*ty,b+w*ty+z*tx-x*tz,c+w*tz+x*ty-y*tx];}
  const SECTORS=[
    {name:'米の群島',en:'THE RICE ARCHIPELAGO',sub:'巨大な米の島へ。仲間の信号を追おう。',quota:6,tint:[.014,.085,.11],seed:431},
    {name:'麹の峡谷',en:'THE KOJI CANYON',sub:'白い菌糸の橋をくぐり、峡谷の底へ。',quota:9,tint:[.025,.07,.085],seed:962},
    {name:'菌糸の深域',en:'THE VIOLET DEEP',sub:'紫の深域。上空に最後の救難信号。',quota:11,tint:[.032,.032,.095],seed:1729}
  ];
  const LIMITS={enemies:12,bullets:96,drops:32,events:96,obstacles:14,radius:132,minY:-34,maxY:72};
  const PERKS=[{id:'rapid',name:'連装パルス',label:'射撃間隔 −18%',desc:'次のエリアへ、もっと速い連射を。'},{id:'hull',name:'再生装甲',label:'最大耐久 +25・全回復',desc:'傷を修復し、次の攻撃に備える。'},{id:'pulse',name:'共鳴コア',label:'衝撃波の範囲・威力アップ',desc:'包囲を破る、大きな一撃。'}];
  function rng(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
  function geometry(sector,seed=1){
    const random=rng(SECTORS[sector].seed+seed%997),obstacles=[];
    const add=(x,y,z,sx,sy,sz,yaw=0,roll=0)=>obstacles.push({x,y,z,sx,sy,sz,q:rotation(yaw,0,roll),kind:'rice'});
    add(-31,7,-5,15,34,25,.25,-.23);add(32,5,-17,15,31,29,-.3,.17);
    add(-2,51,-46,30,9,17,.22,-.1);add(4,-31,-43,30,9,27,-.2,.1);
    add(-66,20,-65,19,29,34,.9,.4);add(73,32,-56,16,26,30,-.6,-.2);
    add(-58,-14,47,24,12,31,.8,.2);add(60,33,40,16,25,33,-.5,-.3);
    add(0,-20,92,26,10,19,.6,.1);add(-34,46,-111,24,13,17,1.2,.1);
    for(let i=0;i<3;i++){const a=3.5+i*1.1;add(Math.sin(a)*105,-5+random()*36,Math.cos(a)*100,8+random()*5,12+random()*6,18+random()*6,random()*3,.15);}
    const heights=sector===0?[23,-9,34]:sector===1?[-12,29,2]:[35,-17,46];
    const rescue=[{x:-7,y:heights[0],z:24},{x:8,y:heights[1],z:-24},{x:-6,y:heights[2],z:-76}].map((p,id)=>({...p,id,progress:0,saved:false}));
    return {obstacles,rescue,exit:{x:0,y:18,z:-106},start:{x:0,y:14,z:70}};
  }
  function localPoint(p,o){return rotate([p.x-o.x,p.y-o.y,p.z-o.z],[-o.q[0],-o.q[1],-o.q[2],o.q[3]]);}
  function inside(p,o,pad=0){const v=localPoint(p,o);return Math.hypot(v[0]/(o.sx+pad),v[1]/(o.sy+pad),v[2]/(o.sz+pad))<1;}
  function segmentObstacle(a,b,o,pad=0){
    const aa=localPoint(a,o),bb=localPoint(b,o),s=[o.sx+pad,o.sy+pad,o.sz+pad],p=aa.map((v,i)=>v/s[i]),d=bb.map((v,i)=>(v-aa[i])/s[i]);
    const A=d.reduce((n,v)=>n+v*v,0),B=2*p.reduce((n,v,i)=>n+v*d[i],0),C=p.reduce((n,v)=>n+v*v,0)-1;if(C<0)return 0;if(A<1e-10)return null;const disc=B*B-4*A*C;if(disc<0)return null;const t=(-B-Math.sqrt(disc))/(2*A);return t>=0&&t<=1?t:null;
  }
  function sphereContact(a,b,c,r){const d=[b.x-a.x,b.y-a.y,b.z-a.z],v=[a.x-c.x,a.y-c.y,a.z-c.z],A=d.reduce((n,x)=>n+x*x,0),B=2*v.reduce((n,x,i)=>n+x*d[i],0),C=v.reduce((n,x)=>n+x*x,0)-r*r;if(C<=0)return 0;if(A<1e-10)return null;const discriminant=B*B-4*A*C;if(discriminant<0)return null;const t=(-B-Math.sqrt(discriminant))/(2*A);return t>=0&&t<=1?t:null;}
  const segmentSphere=(a,b,c,r)=>sphereContact(a,b,c,r)!==null;
  class Game{
    constructor(seed=431,levels={},difficulty='normal'){
      this.spaceVersion=2;this.seed=seed>>>0;this.random=rng(this.seed);this.nextId=1;this.status='playing';this.sector=0;this.difficulty=difficulty==='relaxed'?'relaxed':'normal';
      this.clock=0;this.sectorTime=0;this.kills=0;this.stageKills=0;this.saved=0;this.score=0;this.combo=0;this.comboTime=0;this.maxCombo=0;this.paid=false;this.events=[];
      this.perks={rapid:0,hull:0,pulse:0};this.levels={hull:clamp(+levels.hull||0,0,3),gun:clamp(+levels.gun||0,0,3),drive:clamp(+levels.drive||0,0,3)};
      const max=110+this.levels.hull*15+(this.difficulty==='relaxed'?40:0);
      this.player={x:0,y:14,z:70,vx:0,vy:0,vz:0,yaw:Math.PI,pitch:0,roll:0,cruise:true,hp:max,maxHp:max,inv:0,boost:0,boostCd:0,pulseCd:0,shotCd:0,lock:0};
      this.enemies=[];this.bullets=[];this.drops=[];this.bossSpawned=false;this.bossDefeated=false;this.gate=false;this.spawnTimer=3;this.setWorld();
    }
    setWorld(){const w=geometry(this.sector,this.seed);this.obstacles=w.obstacles;this.rescue=w.rescue;this.exit=w.exit;}
    event(type,x=this.player.x,z=this.player.z,value=0,y=this.player.y){if(this.events.length<LIMITS.events)this.events.push({type,x,y,z,value});}
    drain(){const e=this.events;this.events=[];return e;}
    nearestEnemy(range=48){let best=null,d=range;for(const e of this.enemies)if(e.hp>0&&dist(e,this.player)<d){best=e;d=dist(e,this.player);}return best;}
    visible(a,b){return !this.obstacles.some(o=>segmentObstacle(a,b,o,.15)!==null);}
    target(){
      const p=this.player,f=forward(p.yaw,p.pitch);let best=null,rank=Infinity;
      for(const e of this.enemies){const d=dist(p,e),dot=((e.x-p.x)*f[0]+(e.y-p.y)*f[1]+(e.z-p.z)*f[2])/(d||1);if(e.hp<=0||d>50||dot<.58||!this.visible(p,e))continue;const priority=d+(1-dot)*22-(e.id===p.lock?50:0);if(priority<rank){best=e;rank=priority;}}
      return best;
    }
    objective(){
      if(this.gate)return {...this.exit,kind:'exit',title:this.sector===2?'帰還ゲート':'次の海域へ'};
      const boss=this.enemies.find(e=>e.type===3&&e.hp>0);if(boss)return {...boss,kind:'boss',title:'深域の主'};
      let nearest=null,d=Infinity;for(const r of this.rescue)if(!r.saved&&dist(r,this.player)<d){nearest=r;d=dist(r,this.player);}if(nearest)return {...nearest,kind:'rescue',title:'酵母を救出'};
      const e=this.nearestEnemy(400);return e?{...e,kind:'enemy',title:'侵入菌を撃退'}:{x:0,y:18,z:-20,kind:'wait',title:'周囲を警戒'};
    }
    separate(p,r=1){
      for(let pass=0;pass<3;pass++)for(const o of this.obstacles){
        const v=localPoint(p,o),s=[o.sx+r,o.sy+r,o.sz+r];let n=Math.hypot(v[0]/s[0],v[1]/s[1],v[2]/s[2]);if(n>=1)continue;if(n<.0001){v[1]=s[1];n=1;}
        const local=v.map(x=>x/n*1.002),world=rotate(local,o.q);p.x=o.x+world[0];p.y=o.y+world[1];p.z=o.z+world[2];
        if('vx'in p){const normal=normalize(rotate(local.map((x,i)=>x/(s[i]*s[i])),o.q)),dot=p.vx*normal[0]+p.vy*normal[1]+p.vz*normal[2];if(dot<0){p.vx-=normal[0]*dot;p.vy-=normal[1]*dot;p.vz-=normal[2]*dot;}}
      }
      const rr=Math.hypot(p.x,p.z),bound=LIMITS.radius-r;if(rr>bound){p.x*=bound/rr;p.z*=bound/rr;}p.y=clamp(p.y,LIMITS.minY+r,LIMITS.maxY-r);
    }
    spawn(type){
      if(this.enemies.length>=LIMITS.enemies)return null;const p=this.player;
      const hp=[34,52,60,560][type]*(this.difficulty==='relaxed'?.8:1)*(type===3?1:1+this.sector*.1);
      let e={id:this.nextId++,type,x:0,y:18,z:-65,hp,maxHp:hp,cd:1+this.random(),state:0,timer:0,dx:0,dy:0,dz:1,yaw:0,pitch:0,hit:0,age:0,phase:1};
      if(type!==3){for(let i=0;i<12;i++){const a=p.yaw+(this.random()-.5)*2,r=24+this.random()*20;e.x=p.x+Math.sin(a)*r;e.y=clamp(p.y+(this.random()-.5)*23,-25,61);e.z=p.z+Math.cos(a)*r;this.separate(e,1.4);if(this.visible(p,e)&&dist(p,e)>15)break;}}
      else{e.cd=2.2;this.event('boss',e.x,e.z,0,e.y);}
      this.enemies.push(e);return e;
    }
    bullet(x,y,z,dx,dy,dz,enemy=false,damage=12,speed=46){if(this.bullets.length>=LIMITS.bullets)return;const n=normalize([dx,dy,dz]);this.bullets.push({id:this.nextId++,x,y,z,vx:n[0]*speed,vy:n[1]*speed,vz:n[2]*speed,enemy,damage,life:enemy?5:1.4});}
    hurt(amount){const p=this.player;if(p.inv>0||this.status!=='playing')return;p.hp=Math.max(0,p.hp-amount*(this.difficulty==='relaxed'?.65:1));p.inv=1.15;this.combo=0;this.event('hurt',p.x,p.z,amount,p.y);if(p.hp<=0){this.status='lost';this.event('lost');}}
    hit(e,damage){
      if(e.hp<=0)return;e.hp=Math.max(0,e.hp-damage);e.hit=.15;this.event('hit',e.x,e.z,damage,e.y);
      if(e.hp===0){this.kills++;this.stageKills++;this.combo=clamp(this.combo+1,1,8);this.maxCombo=Math.max(this.maxCombo,this.combo);this.comboTime=6;this.score+=(e.type===3?1200:80+e.type*20)*this.combo;this.event('kill',e.x,e.z,e.type,e.y);
        if(this.drops.length<LIMITS.drops)this.drops.push({x:e.x,y:e.y,z:e.z,type:this.random()<.3?'heal':'energy',life:28});
        if(e.type===3){this.bossDefeated=true;this.enemies.forEach(v=>{if(v!==e)v.hp=0;});this.bullets.forEach(b=>b.life=0);this.bullets=[];this.event('bossDown',e.x,e.z,0,e.y);}
      }
    }
    step(dt,input={}){if(this.status!=='playing'||!Number.isFinite(dt)||dt<=0)return;const total=Math.min(dt,.12),steps=Math.ceil(total/(1/60));for(let i=0;i<steps&&this.status==='playing';i++)this.tick(total/steps,{...input,boost:i===0&&input.boost,pulse:i===0&&input.pulse,toggleCruise:i===0&&input.toggleCruise,lookX:(input.lookX||0)/steps,lookY:(input.lookY||0)/steps});}
    tick(dt,input){
      this.clock+=dt;this.sectorTime+=dt;const p=this.player;for(const k of ['inv','boost','boostCd','pulseCd','shotCd'])p[k]=Math.max(0,p[k]-dt);this.comboTime=Math.max(0,this.comboTime-dt);if(!this.comboTime)this.combo=0;
      const turn=clamp(+input.turn||0,-1,1),pitch=clamp(+input.pitch||0,-1,1);
      p.yaw+=turn*1.5*dt+clamp(input.lookX||0,-.3,.3);p.yaw=((p.yaw+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;
      p.pitch=clamp(p.pitch+pitch*1.02*dt+clamp(input.lookY||0,-.25,.25),-1.12,1.12);p.roll+=(turn*-.25-p.roll)*Math.min(1,dt*5);
      if(input.toggleCruise)p.cruise=!p.cruise;
      if(input.boost&&p.boostCd===0){p.boost=.85;p.boostCd=3.4-this.levels.drive*.35;p.inv=Math.max(p.inv,.55);this.event('boost');}
      if(input.pulse&&p.pulseCd===0){const radius=16+this.perks.pulse*3;p.pulseCd=7.5;this.event('pulse',p.x,p.z,radius,p.y);for(const e of this.enemies)if(dist(p,e)<radius)this.hit(e,52+this.perks.pulse*22);this.bullets=this.bullets.filter(b=>!b.enemy||dist(b,p)>radius);}
      const f=forward(p.yaw,p.pitch),speed=p.boost>0?25:input.brake||!p.cruise?0:9.5,blend=1-Math.exp(-dt*8);
      p.vx+=(f[0]*speed-p.vx)*blend;p.vy+=(f[1]*speed-p.vy)*blend;p.vz+=(f[2]*speed-p.vz)*blend;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;this.separate(p,1.1);
      const target=this.target();if(target&&p.shotCd===0){p.shotCd=.27*Math.pow(.82,this.perks.rapid)/(1+this.levels.gun*.09);const muzzle={x:p.x+f[0]*1.9,y:p.y+f[1]*1.9,z:p.z+f[2]*1.9};if(this.visible(p,muzzle))this.bullet(muzzle.x,muzzle.y,muzzle.z,target.x-muzzle.x,target.y-muzzle.y,target.z-muzzle.z,false,14+this.levels.gun*2,49);this.event('shot');}
      this.spawnTimer-=dt;const done=this.stageKills>=SECTORS[this.sector].quota&&this.rescue.every(r=>r.saved);
      if(done&&!this.gate){if(this.sector===2&&!this.bossSpawned){this.enemies=[];this.bullets=[];this.bossSpawned=true;this.spawn(3);}else if(this.sector<2||this.bossDefeated){this.gate=true;this.enemies=[];this.bullets=[];this.event('gate',this.exit.x,this.exit.z,0,this.exit.y);}}
      if(!this.gate&&!this.bossSpawned&&this.spawnTimer<=0){for(let i=0;i<2&&this.enemies.length<4+this.sector*2;i++)this.spawn(this.sector===0&&this.sectorTime<25?(this.random()<.7?0:1):Math.floor(this.random()*3));this.spawnTimer=4.6-this.sector*.45;}
      for(const e of this.enemies){
        if(e.hp<=0)continue;e.age+=dt;e.cd-=dt;e.hit=Math.max(0,e.hit-dt);const dx=p.x-e.x,dy=p.y-e.y,dz=p.z-e.z,d=Math.hypot(dx,dy,dz)||1,n=[dx/d,dy/d,dz/d];e.yaw=Math.atan2(dx,dz);e.pitch=Math.atan2(dy,Math.hypot(dx,dz));
        if(e.type===0){e.x+=n[0]*4*dt;e.y+=n[1]*4*dt;e.z+=n[2]*4*dt;}
        if(e.type===1){if(e.state===0){e.x+=n[0]*3*dt;e.y+=n[1]*3*dt;e.z+=n[2]*3*dt;if(e.cd<=0&&d<33){e.state=1;e.timer=1;e.dx=n[0];e.dy=n[1];e.dz=n[2];}}else if(e.state===1){e.timer-=dt;if(e.timer<=0){e.state=2;e.timer=.85;}}else{e.x+=e.dx*27*dt;e.y+=e.dy*27*dt;e.z+=e.dz*27*dt;e.timer-=dt;if(e.timer<=0){e.state=0;e.cd=2.6;}}}
        if(e.type===2){const move=d>22?1:d<14?-1:0;e.x+=n[0]*move*4*dt;e.y+=n[1]*move*4*dt;e.z+=n[2]*move*4*dt;if(e.cd<=0&&d<46&&this.visible(e,p)){for(let j=-1;j<=1;j++){const dir=forward(e.yaw+j*.18,e.pitch+j*.1);this.bullet(e.x,e.y,e.z,...dir,true,11,12);}e.cd=3;this.event('enemyShot',e.x,e.z,0,e.y);}}
        if(e.type===3){e.phase=e.hp<e.maxHp*.5?2:1;if(e.state===1){e.timer-=dt;if(e.timer<=0){e.state=2;e.timer=1;}}else if(e.state===2){e.x+=e.dx*24*dt;e.y+=e.dy*24*dt;e.z+=e.dz*24*dt;e.timer-=dt;if(e.timer<=0){e.state=0;e.cd=2.4;}}else{if(d>24){e.x+=n[0]*3.1*dt;e.y+=n[1]*3.1*dt;e.z+=n[2]*3.1*dt;}if(e.cd<=0){if(e.phase===2&&Math.floor(e.age/3)%2===0){e.state=1;e.timer=1.2;e.dx=n[0];e.dy=n[1];e.dz=n[2];this.event('warning',e.x,e.z,0,e.y);}else{const count=e.phase===2?12:7;for(let j=0;j<count;j++){const dir=e.phase===2?forward(j/count*Math.PI*2+e.age*.1,e.pitch+Math.sin(j*2)*.45):forward(e.yaw+(j-3)*.16,e.pitch+Math.sin(j)*.13);this.bullet(e.x,e.y,e.z,...dir,true,14,12);}e.cd=e.phase===2?2.3:2.8;this.event('enemyShot',e.x,e.z,0,e.y);}}}}
        this.separate(e,e.type===3?4:1.3);if(dist(e,p)<(e.type===3?4.5:2.1)){this.hurt(e.type===3?24:13);if(this.status==='lost')return;}
      }
      for(const b of this.bullets){
        if(b.life<=0)continue;const old={x:b.x,y:b.y,z:b.z};b.life-=dt;b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;
        let first=Infinity,victim=null;for(const o of this.obstacles){const t=segmentObstacle(old,b,o);if(t!==null)first=Math.min(first,t);}
        if(b.enemy){const t=sphereContact(old,b,p,1.1);if(t!==null&&t<first){first=t;victim=p;}}
        else for(const e of this.enemies)if(e.hp>0){const t=sphereContact(old,b,e,e.type===3?3.8:1.5);if(t!==null&&t<first){first=t;victim=e;}}
        if(first!==Infinity){b.life=0;if(victim===p){this.hurt(b.damage);if(this.status==='lost')return;}else if(victim)this.hit(victim,b.damage);}
      }
      this.bullets=this.bullets.filter(b=>b.life>0&&Math.hypot(b.x,b.z)<175&&b.y>-60&&b.y<105);this.enemies=this.enemies.filter(e=>e.hp>0);
      for(const r of this.rescue)if(!r.saved){if(dist(r,p)<7&&!this.enemies.some(e=>dist(e,r)<7)){r.progress+=dt;if(r.progress>=.75){r.saved=true;this.saved++;this.score+=350;p.hp=Math.min(p.maxHp,p.hp+20);this.event('rescue',r.x,r.z,0,r.y);}}else r.progress=Math.max(0,r.progress-dt*.5);}
      for(const d of this.drops){d.life-=dt;const distance=dist(d,p);if(distance<12&&distance>.01){const v=Math.min(distance,18*dt)/distance;d.x+=(p.x-d.x)*v;d.y+=(p.y-d.y)*v;d.z+=(p.z-d.z)*v;}if(distance<2.2){d.life=0;if(d.type==='heal')p.hp=Math.min(p.maxHp,p.hp+15);else{this.score+=30;p.pulseCd=Math.max(0,p.pulseCd-1);}this.event('pickup',d.x,d.z,0,d.y);}}
      this.drops=this.drops.filter(d=>d.life>0);if(this.status==='playing'&&this.gate&&dist(p,this.exit)<6){this.score+=500;this.status=this.sector===2?'won':'upgrade';this.event(this.status);}
    }
    choosePerk(id){if(this.status!=='upgrade'||!PERKS.some(p=>p.id===id))return false;this.perks[id]++;if(id==='hull'){this.player.maxHp+=25;this.player.hp=this.player.maxHp;}this.player.hp=Math.min(this.player.maxHp,this.player.hp+30);Object.assign(this.player,{x:0,y:14,z:70,vx:0,vy:0,vz:0,yaw:Math.PI,pitch:0,roll:0,cruise:true,inv:2,boost:0,boostCd:0,pulseCd:0,lock:0});this.sector++;this.stageKills=0;this.sectorTime=0;this.enemies=[];this.bullets=[];this.drops=[];this.gate=false;this.spawnTimer=3;this.status='playing';this.setWorld();this.event('sector');return true;}
    reward(){return Math.min(400,Math.floor(this.score/140)+this.saved*5+(this.status==='won'?35:0));}
    snapshot(){const out={};for(const k of ['spaceVersion','seed','nextId','status','sector','difficulty','clock','sectorTime','kills','stageKills','saved','score','combo','comboTime','maxCombo','paid','perks','levels','player','enemies','bullets','drops','bossSpawned','bossDefeated','gate','spawnTimer','rescue'])out[k]=JSON.parse(JSON.stringify(this[k]));return out;}
    static migrate(s){
      if(!s||s.spaceVersion!==undefined)return s;try{
        const v=JSON.parse(JSON.stringify(s));if(!Number.isInteger(v.sector)||v.sector<0||v.sector>2||!v.player||'y'in v.player||!Array.isArray(v.rescue)||v.rescue.length!==3)return null;
        v.spaceVersion=2;Object.assign(v.player,{x:0,y:14,z:70,vx:0,vy:0,vz:0,yaw:Math.PI,pitch:0,roll:0,cruise:true,lock:0});
        v.enemies=[];v.bullets=[];v.drops=[];v.spawnTimer=3;const w=geometry(v.sector,v.seed);v.rescue=w.rescue.map((r,i)=>({...r,saved:v.rescue[i].saved,progress:0}));if(v.bossSpawned&&!v.bossDefeated)v.bossSpawned=false;return v;
      }catch(e){return null;}
    }
    static restore(raw){
      const s=Game.migrate(raw);if(!s||s.spaceVersion!==2||!['playing','upgrade','won','lost'].includes(s.status)||!Number.isInteger(s.sector)||s.sector<0||s.sector>2)return null;
      const numeric=(o,keys,limit=1e8)=>o&&keys.every(k=>typeof o[k]==='number'&&Number.isFinite(o[k])&&Math.abs(o[k])<=limit);
      if(!['normal','relaxed'].includes(s.difficulty)||['paid','bossSpawned','bossDefeated','gate'].some(k=>typeof s[k]!=='boolean'))return null;
      if(s.status==='upgrade'&&s.sector>=2||s.status==='won'&&(s.sector!==2||!s.bossDefeated||!s.gate))return null;
      if(!numeric(s,['seed','nextId','clock','sectorTime','kills','stageKills','saved','score','combo','comboTime','maxCombo','spawnTimer'])||['seed','nextId','kills','stageKills','saved','score','combo','maxCombo'].some(k=>!Number.isInteger(s[k])||s[k]<0)||s.saved>9||s.combo>8||s.maxCombo>8||s.clock<0||s.sectorTime<0)return null;
      if(!numeric(s.player,['x','y','z','vx','vy','vz','yaw','pitch','roll','hp','maxHp','inv','boost','boostCd','pulseCd','shotCd','lock'])||typeof s.player.cruise!=='boolean'||Math.hypot(s.player.x,s.player.z)>134||s.player.y<-35||s.player.y>73||Math.abs(s.player.pitch)>1.13||s.player.maxHp<1||s.player.maxHp>500||s.player.hp<0||s.player.hp>s.player.maxHp)return null;
      if(s.status==='lost'&&s.player.hp!==0||s.status!=='lost'&&s.player.hp<=0||!numeric(s.perks,['rapid','hull','pulse'],2)||!numeric(s.levels,['hull','gun','drive'],3))return null;
      if(!Array.isArray(s.enemies)||s.enemies.length>LIMITS.enemies||!s.enemies.every(e=>numeric(e,['id','type','x','y','z','hp','maxHp','cd','state','timer','dx','dy','dz','yaw','pitch','hit','age','phase'])&&Number.isInteger(e.type)&&e.type>=0&&e.type<=3&&Math.hypot(e.x,e.z)<150&&e.maxHp>0&&e.hp>=0))return null;
      if(s.bossSpawned&&!s.bossDefeated&&!s.enemies.some(e=>e.type===3&&e.hp>0))return null;
      if(!Array.isArray(s.bullets)||s.bullets.length>LIMITS.bullets||!s.bullets.every(b=>numeric(b,['id','x','y','z','vx','vy','vz','damage','life'])&&typeof b.enemy==='boolean'))return null;
      if(!Array.isArray(s.drops)||s.drops.length>LIMITS.drops||!s.drops.every(d=>numeric(d,['x','y','z','life'])&&['heal','energy'].includes(d.type)))return null;
      if(!Array.isArray(s.rescue)||s.rescue.length!==3||!s.rescue.every(r=>numeric(r,['id','x','y','z','progress'])&&typeof r.saved==='boolean'))return null;
      const g=new Game(s.seed,s.levels,s.difficulty);for(const k of Object.keys(g.snapshot()))g[k]=JSON.parse(JSON.stringify(s[k]));g.events=[];g.random=rng((g.seed+Math.floor(g.clock*1000))>>>0);const w=geometry(g.sector,g.seed);g.obstacles=w.obstacles;g.exit=w.exit;return g;
    }
  }
  function meta(raw){const n=(v,max)=>clamp(Number.isFinite(+v)?Math.floor(+v):0,0,max);return {credits:n(raw?.credits,99999),best:n(raw?.best,1e8),wins:n(raw?.wins,99999),sorties:n(raw?.sorties,99999),totalSaved:n(raw?.totalSaved,99999),levels:{hull:n(raw?.levels?.hull,3),gun:n(raw?.levels?.gun,3),drive:n(raw?.levels?.drive,3)}};}
  return {Game,geometry,rng,clamp,dist,forward,rotation,rotate,qmul,normalize,inside,segmentObstacle,segmentSphere,sphereContact,SECTORS,LIMITS,PERKS,meta};
})();
globalThis.ShuboCore=ShuboCore;
