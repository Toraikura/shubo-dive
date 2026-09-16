'use strict';
// Deterministic simulation, independent of the DOM and renderer.
const ShuboCore = (() => {
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)), dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
  const SECTORS=[
    {name:'米の群島',en:'THE RICE ARCHIPELAGO',sub:'漂う島々に、仲間の反応。',quota:6,tint:[.02,.13,.18],seed:431},
    {name:'麹の峡谷',en:'THE KOJI CANYON',sub:'黄金の胞子を抜け、救難信号へ。',quota:9,tint:[.12,.085,.075],seed:962},
    {name:'菌糸の深域',en:'THE VIOLET DEEP',sub:'最深部で、最後の仲間が待っている。',quota:11,tint:[.055,.035,.14],seed:1729}
  ];
  const LIMITS={enemies:12,bullets:96,drops:32,events:96,obstacles:22,radius:60};
  const PERKS=[
    {id:'rapid',name:'連装パルス',label:'射撃間隔 −18%',desc:'次のエリアへ、もっと速い連射を。'},
    {id:'hull',name:'再生装甲',label:'最大耐久 +25・全回復',desc:'傷を修復し、次の攻撃に備える。'},
    {id:'pulse',name:'共鳴コア',label:'衝撃波の範囲・威力アップ',desc:'包囲を破る、大きな一撃。'}
  ];
  function rng(seed){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
  function geometry(sector,seed=1){
    const random=rng(SECTORS[sector].seed+seed%997),obstacles=[];
    for(let i=0;i<18;i++){
      const angle=i/18*Math.PI*2+.16*(random()-.5),r=14+random()*35;
      const x=Math.cos(angle)*r,z=Math.sin(angle)*r;
      if(Math.hypot(x,z-35)<8||Math.hypot(x,z+43)<9)continue;
      obstacles.push({x,z,r:2.3+random()*1.8,angle:random()*Math.PI,height:2+random()*3,style:i%3});
    }
    const rescue=[{x:-23,z:10},{x:23,z:-6},{x:-7,z:-30}].map((p,i)=>({...p,id:i,progress:0,saved:false}));
    for(const o of obstacles)for(const p of rescue)if(dist(o,p)<o.r+6)o.x+=o.x>0?9:-9;
    return {obstacles,rescue,exit:{x:0,z:-43}};
  }
  class Game {
    constructor(seed=431,levels={},difficulty='normal'){
      this.seed=seed>>>0;this.random=rng(this.seed);this.nextId=1;this.status='playing';this.sector=0;
      this.difficulty=difficulty==='relaxed'?'relaxed':'normal';this.clock=0;this.sectorTime=0;this.kills=0;this.stageKills=0;
      this.saved=0;this.score=0;this.combo=0;this.comboTime=0;this.maxCombo=0;this.paid=false;this.events=[];
      this.perks={rapid:0,hull:0,pulse:0};this.levels={hull:clamp(+levels.hull||0,0,3),gun:clamp(+levels.gun||0,0,3),drive:clamp(+levels.drive||0,0,3)};
      const max=100+this.levels.hull*15+(this.difficulty==='relaxed'?40:0);
      this.player={x:0,z:35,vx:0,vz:0,yaw:Math.PI,hp:max,maxHp:max,inv:0,boost:0,boostCd:0,pulseCd:0,shotCd:0,lock:0};
      this.enemies=[];this.bullets=[];this.drops=[];this.bossSpawned=false;this.bossDefeated=false;this.gate=false;this.spawnTimer=1.5;
      this.setWorld();
    }
    setWorld(){const w=geometry(this.sector,this.seed);this.obstacles=w.obstacles;this.rescue=w.rescue;this.exit=w.exit;}
    event(type,x=0,z=0,value=0){if(this.events.length<LIMITS.events)this.events.push({type,x,z,value});}
    drain(){const e=this.events;this.events=[];return e;}
    nearestEnemy(range=30){
      const p=this.player;let best=null,dd=range;
      for(const e of this.enemies){const d=dist(p,e);if(e.hp>0&&d<dd){best=e;dd=d;}}
      return best;
    }
    target(){return this.enemies.find(e=>e.id===this.player.lock&&e.hp>0&&dist(e,this.player)<34)||this.nearestEnemy();}
    objective(){
      if(this.gate)return {x:this.exit.x,z:this.exit.z,kind:'exit',title:this.sector===2?'帰還ゲートへ':'次のエリアへ'};
      const boss=this.enemies.find(e=>e.type===3&&e.hp>0);
      if(boss)return {...boss,kind:'boss',title:'深域の主を撃破'};
      let nearest=null,d=Infinity;for(const r of this.rescue)if(!r.saved&&dist(r,this.player)<d){nearest=r;d=dist(r,this.player);}
      if(nearest)return {...nearest,kind:'rescue',title:'酵母を救出'};
      const e=this.nearestEnemy(150);return e?{...e,kind:'enemy',title:'残る侵入菌を撃退'}:{x:0,z:0,kind:'wait',title:'周囲を警戒'};
    }
    spawn(type){
      if(this.enemies.length>=LIMITS.enemies)return null;
      const a=this.random()*Math.PI*2,r=19+this.random()*8,p=this.player;
      let x=clamp(p.x+Math.sin(a)*r,-47,47),z=clamp(p.z+Math.cos(a)*r,-47,47);
      const hp=[36,58,64,430][type]*(this.difficulty==='relaxed'?.78:1)*(type===3?1:1+this.sector*.13);
      const e={id:this.nextId++,type,x,z,hp,maxHp:hp,cd:.65+this.random()*.6,state:0,timer:0,dx:0,dz:1,yaw:0,hit:0,age:0,phase:1};
      if(type===3){e.x=0;e.z=-23;e.cd=2.5;this.event('boss',e.x,e.z);}
      this.separate(e,2);this.enemies.push(e);return e;
    }
    separate(p,r){
      for(const o of this.obstacles){let dx=p.x-o.x,dz=p.z-o.z,d=Math.hypot(dx,dz);if(d<o.r+r){if(d<.001){dx=1;dz=0;d=1;}const k=(o.r+r-d)/d;p.x+=dx*k;p.z+=dz*k;}}
      const rr=Math.hypot(p.x,p.z);if(rr>LIMITS.radius-r){p.x*=((LIMITS.radius-r)/rr);p.z*=((LIMITS.radius-r)/rr);}
    }
    bullet(x,z,dx,dz,enemy=false,damage=10,speed=25){
      if(this.bullets.length>=LIMITS.bullets)return;
      const d=Math.hypot(dx,dz)||1;this.bullets.push({id:this.nextId++,x,z,vx:dx/d*speed,vz:dz/d*speed,enemy,damage,life:enemy?4:1.5});
    }
    hurt(amount){
      const p=this.player;if(p.inv>0||this.status!=='playing')return;
      p.hp=Math.max(0,p.hp-amount*(this.difficulty==='relaxed'?.65:1));p.inv=1.05;this.combo=0;this.event('hurt',p.x,p.z,amount);
      if(p.hp<=0){this.status='lost';this.event('lost');}
    }
    hit(e,damage){
      if(e.hp<=0)return;e.hp=Math.max(0,e.hp-damage);e.hit=.13;this.event('hit',e.x,e.z,damage);
      if(e.hp===0){
        this.kills++;this.stageKills++;this.combo=clamp(this.combo+1,1,8);this.maxCombo=Math.max(this.maxCombo,this.combo);this.comboTime=5;
        const points=(e.type===3?1200:80+e.type*20)*this.combo;this.score+=points;this.event('kill',e.x,e.z,e.type);
        if(this.drops.length<LIMITS.drops)this.drops.push({x:e.x,z:e.z,type:this.random()<.2?'heal':'energy',life:24});
        if(e.type===3){this.bossDefeated=true;this.enemies.forEach(other=>{if(other!==e)other.hp=0;});this.bullets.forEach(b=>b.life=0);this.bullets=[];this.event('bossDown',e.x,e.z);}
      }
    }
    step(dt,input={}){
      if(this.status!=='playing'||!Number.isFinite(dt)||dt<=0)return;
      const total=Math.min(dt,.12),steps=Math.ceil(total/(1/60));
      for(let i=0;i<steps&&this.status==='playing';i++)this.tick(total/steps,{...input,boost:i===0&&input.boost,pulse:i===0&&input.pulse});
    }
    tick(dt,input){
      this.clock+=dt;this.sectorTime+=dt;const p=this.player;
      for(const k of ['inv','boost','boostCd','pulseCd','shotCd'])p[k]=Math.max(0,p[k]-dt);
      this.comboTime=Math.max(0,this.comboTime-dt);if(!this.comboTime)this.combo=0;
      let ix=clamp(+input.x||0,-1,1),iz=clamp(+input.z||0,-1,1),len=Math.hypot(ix,iz);if(len>1){ix/=len;iz/=len;}
      if(input.boost&&p.boostCd===0){p.boost=.62;p.boostCd=3.4-this.levels.drive*.35;p.inv=Math.max(p.inv,.45);this.event('boost',p.x,p.z);}
      if(input.pulse&&p.pulseCd===0){
        const radius=12+this.perks.pulse*3;p.pulseCd=8;this.event('pulse',p.x,p.z,radius);
        for(const e of this.enemies)if(dist(p,e)<radius)this.hit(e,48+this.perks.pulse*22);
        this.bullets=this.bullets.filter(b=>!b.enemy||dist(b,p)>radius);
      }
      if(p.boost>0&&len<.1){ix=Math.sin(p.yaw);iz=Math.cos(p.yaw);}
      const speed=p.boost>0?23:8.6,blend=1-Math.exp(-dt*11);
      p.vx+=(ix*speed-p.vx)*blend;p.vz+=(iz*speed-p.vz)*blend;p.x+=p.vx*dt;p.z+=p.vz*dt;this.separate(p,.85);
      if(Math.hypot(p.vx,p.vz)>.4)p.yaw=Math.atan2(p.vx,p.vz);
      let target=this.target();
      if(target&&p.shotCd===0){p.shotCd=.3*Math.pow(.82,this.perks.rapid)/(1+this.levels.gun*.09);const dx=target.x-p.x,dz=target.z-p.z;this.bullet(p.x,p.z,dx,dz,false,12+this.levels.gun*2,38);this.event('shot',p.x,p.z);}
      this.spawnTimer-=dt;
      const done=this.stageKills>=SECTORS[this.sector].quota&&this.rescue.every(r=>r.saved);
      if(done&&!this.gate){
        if(this.sector===2&&!this.bossSpawned){this.enemies=[];this.bullets=[];this.bossSpawned=true;this.spawn(3);}
        else if(this.sector<2||this.bossDefeated){this.gate=true;this.enemies=[];this.bullets=[];this.event('gate',this.exit.x,this.exit.z);}
      }
      if(!this.gate&&!this.bossSpawned&&this.spawnTimer<=0){
        for(let i=0;i<(this.sector===2?3:2)&&this.enemies.length<5+this.sector*2;i++)this.spawn(this.sector===0&&this.sectorTime<25?(this.random()<.7?0:1):Math.floor(this.random()*3));
        this.spawnTimer=3.4-this.sector*.3;
      }
      for(const e of this.enemies){
        if(e.hp<=0)continue;e.age+=dt;e.cd-=dt;e.hit=Math.max(0,e.hit-dt);const dx=p.x-e.x,dz=p.z-e.z,d=Math.hypot(dx,dz)||1;
        e.yaw=Math.atan2(dx,dz);
        if(e.type===0){e.x+=dx/d*2.6*dt;e.z+=dz/d*2.6*dt;}
        if(e.type===1){
          if(e.state===0){e.x+=dx/d*1.8*dt;e.z+=dz/d*1.8*dt;if(e.cd<=0&&d<22){e.state=1;e.timer=.9;e.dx=dx/d;e.dz=dz/d;}}
          else if(e.state===1){e.timer-=dt;if(e.timer<=0){e.state=2;e.timer=.65;}}
          else {e.x+=e.dx*22*dt;e.z+=e.dz*22*dt;e.timer-=dt;if(e.timer<=0){e.state=0;e.cd=2.8;}}
        }
        if(e.type===2){
          const move=d>17?1:d<11?-1:0;e.x+=dx/d*move*2.5*dt;e.z+=dz/d*move*2.5*dt;
          if(e.cd<=0&&d<29){for(let j=-1;j<=1;j++){const a=e.yaw+j*.23;this.bullet(e.x,e.z,Math.sin(a),Math.cos(a),true,11,8);}e.cd=2.7;this.event('enemyShot',e.x,e.z);}
        }
        if(e.type===3){
          e.phase=e.hp<e.maxHp*.5?2:1;
          if(e.state===1){e.timer-=dt;if(e.timer<=0){e.state=2;e.timer=.8;}}
          else if(e.state===2){e.x+=e.dx*18*dt;e.z+=e.dz*18*dt;e.timer-=dt;if(e.timer<=0){e.state=0;e.cd=2.4;}}
          else {
            if(d>17){e.x+=dx/d*1.7*dt;e.z+=dz/d*1.7*dt;}
            if(e.cd<=0){
              if(e.phase===2&&Math.floor(e.age/3)%2===0){e.state=1;e.timer=1.2;e.dx=dx/d;e.dz=dz/d;this.event('warning',e.x,e.z);}
              else {const count=e.phase===2?12:7;for(let j=0;j<count;j++){const a=e.phase===2?j/count*Math.PI*2+e.age*.1:e.yaw+(j-3)*.19;this.bullet(e.x,e.z,Math.sin(a),Math.cos(a),true,14,e.phase===2?9:7);}e.cd=e.phase===2?2:2.5;this.event('enemyShot',e.x,e.z);}
            }
          }
        }
        this.separate(e,e.type===3?3:1);if(dist(e,p)<(e.type===3?4:1.9)){this.hurt(e.type===3?23:14);if(this.status==='lost')return;}
      }
      for(const b of this.bullets){
        if(b.life<=0)continue;b.life-=dt;b.x+=b.vx*dt;b.z+=b.vz*dt;
        if(b.enemy){if(dist(b,p)<1.15){this.hurt(b.damage);b.life=0;if(this.status==='lost')return;}}
        else {for(const e of this.enemies)if(e.hp>0&&dist(b,e)<(e.type===3?3.4:1.4)){this.hit(e,b.damage);b.life=0;break;}}
      }
      this.bullets=this.bullets.filter(b=>b.life>0&&Math.hypot(b.x,b.z)<80);this.enemies=this.enemies.filter(e=>e.hp>0);
      for(const r of this.rescue)if(!r.saved){
        if(dist(r,p)<5&&!this.enemies.some(e=>dist(e,r)<6)){r.progress+=dt;if(r.progress>=1){r.saved=true;this.saved++;this.score+=350;p.hp=Math.min(p.maxHp,p.hp+16);this.event('rescue',r.x,r.z);}}
        else r.progress=Math.max(0,r.progress-dt*.6);
      }
      for(const d of this.drops){
        d.life-=dt;const distance=dist(d,p);if(distance<7&&distance>.01){d.x+=(p.x-d.x)/distance*12*dt;d.z+=(p.z-d.z)/distance*12*dt;}
        if(distance<1.8){d.life=0;if(d.type==='heal')p.hp=Math.min(p.maxHp,p.hp+12);else{this.score+=30;p.pulseCd=Math.max(0,p.pulseCd-1);}this.event('pickup',d.x,d.z);}
      }
      this.drops=this.drops.filter(d=>d.life>0);
      if(this.status==='playing'&&this.gate&&dist(p,this.exit)<4){this.score+=500;this.status=this.sector===2?'won':'upgrade';this.event(this.status);}
    }
    choosePerk(id){
      if(this.status!=='upgrade'||!PERKS.some(p=>p.id===id))return false;
      this.perks[id]++;if(id==='hull'){this.player.maxHp+=25;this.player.hp=this.player.maxHp;}
      this.player.hp=Math.min(this.player.maxHp,this.player.hp+30);this.player.x=0;this.player.z=35;this.player.vx=0;this.player.vz=0;this.player.inv=2;
      this.player.boost=0;this.player.boostCd=0;this.player.pulseCd=0;this.player.lock=0;
      this.sector++;this.stageKills=0;this.sectorTime=0;this.enemies=[];this.bullets=[];this.drops=[];this.gate=false;this.spawnTimer=1.5;this.status='playing';this.setWorld();this.event('sector');return true;
    }
    reward(){return Math.min(400,Math.floor(this.score/140)+this.saved*5+(this.status==='won'?35:0));}
    snapshot(){const out={};for(const k of ['seed','nextId','status','sector','difficulty','clock','sectorTime','kills','stageKills','saved','score','combo','comboTime','maxCombo','paid','perks','levels','player','enemies','bullets','drops','bossSpawned','bossDefeated','gate','spawnTimer','rescue'])out[k]=JSON.parse(JSON.stringify(this[k]));return out;}
    static restore(s){
      if(!s||!['playing','upgrade','won','lost'].includes(s.status)||!Number.isInteger(s.sector)||s.sector<0||s.sector>2)return null;
      if(!['normal','relaxed'].includes(s.difficulty)||['paid','bossSpawned','bossDefeated','gate'].some(k=>typeof s[k]!=='boolean'))return null;
      if(s.status==='upgrade'&&s.sector>=2||s.status==='won'&&(s.sector!==2||!s.bossDefeated||!s.gate))return null;
      const numeric=(obj,keys,limit=1e8)=>obj&&keys.every(k=>typeof obj[k]==='number'&&Number.isFinite(obj[k])&&Math.abs(obj[k])<=limit);
      if(!numeric(s,['seed','nextId','clock','sectorTime','kills','stageKills','saved','score','combo','comboTime','maxCombo','spawnTimer']))return null;
      if(['seed','nextId','kills','stageKills','saved','score','combo','maxCombo'].some(k=>!Number.isInteger(s[k])||s[k]<0)||s.saved>9||s.combo>8||s.maxCombo>8||s.clock<0||s.sectorTime<0)return null;
      if(!numeric(s.player,['x','z','vx','vz','yaw','hp','maxHp','inv','boost','boostCd','pulseCd','shotCd','lock'])||Math.hypot(s.player.x,s.player.z)>65||s.player.maxHp<1||s.player.maxHp>500||s.player.hp<0||s.player.hp>s.player.maxHp)return null;
      if(s.status==='lost'&&s.player.hp!==0||s.status!=='lost'&&s.player.hp<=0)return null;
      if(!numeric(s.perks,['rapid','hull','pulse'],2)||!numeric(s.levels,['hull','gun','drive'],3))return null;
      if(!Array.isArray(s.enemies)||s.enemies.length>LIMITS.enemies||!s.enemies.every(e=>numeric(e,['id','type','x','z','hp','maxHp','cd','state','timer','dx','dz','yaw','hit','age','phase'])&&Number.isInteger(e.type)&&e.type>=0&&e.type<=3&&Math.hypot(e.x,e.z)<80&&e.maxHp>0&&e.hp>=0))return null;
      if(!Array.isArray(s.bullets)||s.bullets.length>LIMITS.bullets||!s.bullets.every(b=>numeric(b,['id','x','z','vx','vz','damage','life'])&&typeof b.enemy==='boolean'))return null;
      if(!Array.isArray(s.drops)||s.drops.length>LIMITS.drops||!s.drops.every(d=>numeric(d,['x','z','life'])&&['heal','energy'].includes(d.type)))return null;
      if(!Array.isArray(s.rescue)||s.rescue.length!==3||!s.rescue.every(r=>numeric(r,['id','x','z','progress'])&&typeof r.saved==='boolean'))return null;
      const g=new Game(s.seed,s.levels,s.difficulty);for(const k of Object.keys(g.snapshot()))g[k]=JSON.parse(JSON.stringify(s[k]));g.events=[];g.random=rng((g.seed+Math.floor(g.clock*1000))>>>0);const w=geometry(g.sector,g.seed);g.obstacles=w.obstacles;g.exit=w.exit;return g;
    }
  }
  function meta(raw){const n=(v,max)=>clamp(Number.isFinite(+v)?Math.floor(+v):0,0,max);return {credits:n(raw?.credits,99999),best:n(raw?.best,1e8),wins:n(raw?.wins,99999),sorties:n(raw?.sorties,99999),totalSaved:n(raw?.totalSaved,99999),levels:{hull:n(raw?.levels?.hull,3),gun:n(raw?.levels?.gun,3),drive:n(raw?.levels?.drive,3)}};}
  return {Game,geometry,rng,clamp,dist,SECTORS,LIMITS,PERKS,meta};
})();
globalThis.ShuboCore=ShuboCore;
