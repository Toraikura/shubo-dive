'use strict';
(() => {
  const {Game,SECTORS,PERKS,meta,clamp}=ShuboCore,$=id=>document.getElementById(id),SAVE='shubo.dive.v1';
  const motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
  let settings={animations:true,reduced:false,sound:false,quality:'balanced',difficulty:'normal'},profile=meta({}),savedRun=null,storageOK=true;
  let recoveryNotice=false;
  try{const raw=localStorage.getItem(SAVE);if(raw&&raw.length<180000){let saved=null;try{saved=JSON.parse(raw);}catch(e){recoveryNotice=true;}if(saved?.version===1){profile=meta(saved.profile);const s=saved.settings||{};for(const k of ['animations','reduced','sound'])if(typeof s[k]==='boolean')settings[k]=s[k];if(['low','balanced','high'].includes(s.quality))settings.quality=s.quality;if(['normal','relaxed'].includes(s.difficulty))settings.difficulty=s.difficulty;savedRun=Game.restore(saved.run);if(saved.run&&!savedRun)recoveryNotice=true;}}}catch(e){storageOK=false;}
  let game=savedRun||new Game(941,profile.levels,settings.difficulty),hasRun=Boolean(savedRun),screen='home',paused=true,hidden=document.hidden,menuReturn='home',last=0,saveClock=0,uiClock=0,toastUntil=0,toastText='',joystickId=null,stickX=0,stickZ=0,lastFocus=null;
  let pendingBoost=false,pendingPulse=false,previousStatus=game.status,previousSector=game.sector;
  const keys=new Set(),renderer=new ShuboRender.Renderer($('world'),$('overlay'));
  const audio={context:null,last:0,init(){if(!settings.sound)return;try{if(!this.context)this.context=new(window.AudioContext||window.webkitAudioContext)();this.context.resume().catch(()=>{});}catch(e){settings.sound=false;}},play(type){if(!settings.sound||!this.context||this.context.state!=='running')return;const t=this.context.currentTime;if(type==='shot'&&t-this.last<.1)return;this.last=t;const o=this.context.createOscillator(),g=this.context.createGain();const frequencies={shot:530,hit:175,kill:310,rescue:780,pulse:95,boost:130,hurt:65,gate:640,won:920,lost:110,enemyShot:210,pickup:990,boss:90,bossDown:720,sector:550,warning:170};if(!frequencies[type])return;o.type=['shot','hit','hurt'].includes(type)?'triangle':'sine';o.frequency.setValueAtTime(frequencies[type],t);o.frequency.exponentialRampToValueAtTime(frequencies[type]*(type==='rescue'||type==='won'?1.6:.45),t+.18);g.gain.setValueAtTime(type==='shot'?.022:.045,t);g.gain.exponentialRampToValueAtTime(.001,t+.2);o.connect(g);g.connect(this.context.destination);o.start(t);o.stop(t+.22);}};
  const motion=()=>settings.animations&&!settings.reduced&&!motionQuery.matches;
  function syncSettings(){document.body.classList.toggle('motion-off',!motion());$('sound').setAttribute('aria-pressed',String(settings.sound));$('sound').setAttribute('aria-label',settings.sound?'音をオフにする':'音をオンにする');$('sound').textContent=settings.sound?'♫':'♪';$('storageNote').hidden=storageOK;}
  function save(){
    try{localStorage.setItem(SAVE,JSON.stringify({version:1,profile,settings,run:hasRun?game.snapshot():null}));storageOK=true;}catch(e){storageOK=false;}$('storageNote').hidden=storageOK;saveClock=0;
  }
  function release(){keys.clear();pendingBoost=false;pendingPulse=false;stickX=0;stickZ=0;joystickId=null;$('stick').style.transform='translate(0,0)';}
  function notice(text,duration=3){toastText=text;toastUntil=performance.now()+duration*1000;$('toast').textContent=text;$('toast').classList.add('visible');}
  function setMenu(html,kind='panel'){
    release();paused=true;screen=kind;$('menu').hidden=false;$('menu').classList.toggle('centered',kind!=='home');$('menuContent').innerHTML=html;$('hud').inert=true;
    requestAnimationFrame(()=>{$('menuContent').querySelector('button:not(:disabled),input,select')?.focus({preventScroll:true});});
  }
  function closeMenu(){
    screen='play';paused=false;last=performance.now();$('menu').hidden=true;$('hud').hidden=false;$('hud').inert=false;release();audio.init();lastFocus?.focus({preventScroll:true});lastFocus=null;
  }
  function home(){
    $('hud').hidden=true;const resumable=hasRun&&['playing','upgrade'].includes(game.status);
    setMenu(`<p class="eyebrow">A MICROSCOPIC ODYSSEY</p><h1 id="menuTitle" class="game-title">SHUBO<span class="outline">DIVE.</span></h1><p class="japanese-title">酒母潜航隊</p><p class="menu-description">一粒の米が、未知の惑星になる。<br>菌糸の森を飛び、<strong>仲間を救って帰ろう。</strong></p><button class="primary wide" data-action="${resumable?'resume':'start'}">${resumable?'潜航を続ける':'潜航開始'} <span>↗</span></button>${resumable?'<button class="text-button" data-action="restart-confirm">新しい出撃を始める</button>':''}<div class="home-secondary"><button class="text-button" data-action="hangar">機体を強化 <span class="credit">${profile.credits} ◇</span></button><button class="text-button" data-action="help">遊び方</button><button class="text-button" data-action="settings">設定</button></div><div class="home-stats"><div>BEST SCORE<b>${String(profile.best).padStart(6,'0')}</b></div><div>RESCUED<b>${String(profile.totalSaved).padStart(2,'0')}</b></div><div>EXPEDITIONS<b>${String(profile.wins).padStart(2,'0')}</b></div></div><p class="fiction">発酵の世界を舞台にしたフィクションです。<br>敵の行動・武器・救出はゲーム上の表現です。</p>`,'home');
  }
  function start(){
    game=new Game(Math.floor(Math.random()*999999)+1,profile.levels,settings.difficulty);hasRun=true;profile.sorties=clamp(profile.sorties+1,0,99999);savedRun=null;renderer.justLoaded=true;renderer.sector=-1;previousStatus='playing';previousSector=0;closeMenu();save();notice('救難信号を追って、酵母を3体救出しよう。',5);updateHUD();
  }
  function resume(){if(game.status==='upgrade'){upgrades();return;}closeMenu();notice('潜航を再開。仲間の信号へ。',2);}
  function pause(){if(screen!=='play')return;lastFocus=document.activeElement;release();save();setMenu(`<p class="eyebrow">ON HOLD</p><h1 id="menuTitle" class="panel-title">ひと息つこう。</h1><p class="panel-sub">潜航はここで止まっています。</p><button class="primary wide" data-action="resume">潜航を続ける</button><div class="button-row"><button class="secondary" data-action="settings">設定</button><button class="secondary" data-action="home">母港へ</button></div>`,'pause');}
  function upgrades(){
    setMenu(`<p class="eyebrow">SECTOR ${String(game.sector+1).padStart(2,'0')} CLEAR</p><h1 id="menuTitle" class="panel-title">次の深度へ。</h1><p class="panel-sub">今回の出撃で使う装備を、一つ選ぼう。<br>次は「${SECTORS[game.sector+1].name}」。機体耐久も少し回復します。</p><div class="card-grid">${PERKS.map((p,i)=>`<button class="perk" data-action="perk" data-value="${p.id}"><span class="number">0${i+1}</span><b>${p.name}</b><em>${p.label}</em><small>${p.desc}</small></button>`).join('')}</div>`,'upgrade');save();
  }
  function settle(){
    if(game.paid)return;game.paid=true;profile.credits=clamp(profile.credits+game.reward(),0,99999);profile.best=Math.max(profile.best,game.score);profile.totalSaved=clamp(profile.totalSaved+game.saved,0,99999);if(game.status==='won')profile.wins=clamp(profile.wins+1,0,99999);save();
  }
  function result(){
    settle();const won=game.status==='won',rank=won?(game.saved===9&&game.player.hp>=game.player.maxHp*.6?'S':game.saved===9?'A':'B'):'—';
    setMenu(`<p class="eyebrow">${won?'EXPEDITION COMPLETE':'EMERGENCY RETURN'}</p><h1 id="menuTitle" class="panel-title">${won?'おかえり、潜航隊。':'機体を回収。次の出撃へ。'}</h1><p class="panel-sub">${won?'3つの海域を突破。救った仲間と、母港へ帰還しました。':'ここまでの救出と戦果は、強化素材として持ち帰れます。'}</p><div class="result-score">${String(game.score).padStart(6,'0')}</div><div class="result-stats"><div>救出した酵母<b>${game.saved} / 9</b></div><div>獲得素材<b class="credit">+${game.reward()} ◇</b></div><div>任務ランク<b>${rank}</b></div></div><button class="primary wide" data-action="start">もう一度、潜航する ↗</button><div class="button-row"><button class="secondary" data-action="hangar">機体を強化</button><button class="secondary" data-action="home">母港へ</button></div>`,'result');
  }
  function hangar(){
    const entries=[['hull','耐圧フレーム','最大耐久 +15 / レベル'],['gun','パルス発振器','威力 +2・射撃間隔を短縮'],['drive','循環エンジン','ブースト再使用 −0.35秒 / レベル']];
    setMenu(`<p class="eyebrow">SCOUT-01 / HANGAR</p><h1 id="menuTitle" class="panel-title">次の潜航に、備える。</h1><p class="panel-sub">素材 <strong class="credit">${profile.credits} ◇</strong>　強化は次の新しい出撃から反映。</p>${entries.map(([id,name,desc])=>{const lv=profile.levels[id],cost=40*(lv+1);return `<div class="hangar-item"><div><h3>${name} <span class="credit">${'▰'.repeat(lv)}${'▱'.repeat(3-lv)}</span></h3><p>${desc}</p></div><button class="secondary" data-action="buy" data-value="${id}" ${lv>=3||profile.credits<cost?'disabled':''}>${lv>=3?'MAX':cost+' ◇ 強化'}</button></div>`;}).join('')}<div class="button-row"><button class="secondary" data-action="back">戻る</button></div>`,'hangar');
  }
  function settingsMenu(){
    setMenu(`<p class="eyebrow">FLIGHT SETTINGS</p><h1 id="menuTitle" class="panel-title">潜航の設定</h1><label class="setting"><span>サウンド<small>射撃・救出・機体の効果音</small></span><input id="setSound" type="checkbox" ${settings.sound?'checked':''}></label><label class="setting"><span>アニメーション<small>水中の揺らぎ・速度線・波紋</small></span><input id="setAnimations" type="checkbox" ${settings.animations?'checked':''}></label><label class="setting"><span>動きを控えめに<small>${motionQuery.matches?'端末の設定も有効になっています':'演出の動きを抑えます'}</small></span><input id="setReduced" type="checkbox" ${settings.reduced?'checked':''}></label><label class="setting"><span>画質</span><select id="setQuality"><option value="low" ${settings.quality==='low'?'selected':''}>軽量</option><option value="balanced" ${settings.quality==='balanced'?'selected':''}>標準</option><option value="high" ${settings.quality==='high'?'selected':''}>精細</option></select></label><label class="setting"><span>次の出撃の難易度<small>変更は新しい出撃から反映</small></span><select id="setDifficulty"><option value="normal" ${settings.difficulty==='normal'?'selected':''}>標準</option><option value="relaxed" ${settings.difficulty==='relaxed'?'selected':''}>やさしい</option></select></label><p class="fiction">${renderer.gl?'3D描画':'軽量2D描画'}。アニメーションをオフにしても、操縦と戦闘は動きます。進行を止める時は一時停止。</p><div class="button-row"><button class="primary wide" data-action="back">戻る</button></div>`,'settings');
  }
  function help(){
    setMenu(`<p class="eyebrow">PILOT BRIEFING</p><h1 id="menuTitle" class="panel-title">救って、帰って、強くなる。</h1><div class="help-grid"><div><b>01　信号へ向かう</b><p>紫の酵母に近づくと救出。近くに敵がいる時は、先に撃退しよう。</p></div><div><b>02　自動で射撃</b><p>射程内の敵を自動攻撃。敵をタップすると狙う相手を選べます。</p></div><div><b>03　囲まれたら回避</b><p>ブーストで高速移動。突進の光を見て横へ。衝撃波は周囲の敵と敵弾に有効。</p></div><div><b>04　ゲートへ帰還</b><p>救出と撃退の目標を達成するとゲートが開く。3つの海域とボスを突破しよう。</p></div></div><p class="panel-sub"><span class="key">WASD / 矢印</span> 移動　<span class="key">Space</span> ブースト<br><span class="key">E</span> 衝撃波　<span class="key">Esc / P</span> 一時停止<br>スマホは左スティックと右の2ボタン。</p><p class="fiction">高さは自動調整。菌の赤い色や攻撃行動はゲームの目印です。酵母の遊泳・探索艇・武器は創作で、現実の製造工程を再現していません。</p><button class="primary wide" data-action="back">準備できた</button>`,'help');
  }
  function back(){if(menuReturn==='pause'){screen='play';pause();}else if(menuReturn==='result')result();else home();}
  $('menu').addEventListener('click',e=>{
    const b=e.target.closest('button[data-action]');if(!b||b.disabled)return;audio.init();const a=b.dataset.action,value=b.dataset.value;
    if(['hangar','settings','help'].includes(a)){menuReturn=screen==='pause'?'pause':screen==='result'?'result':'home';({hangar,settings:settingsMenu,help})[a]();}
    else if(a==='start')start();else if(a==='resume')resume();else if(a==='home')home();else if(a==='back')back();
    else if(a==='perk'){if(game.choosePerk(value)){renderer.justLoaded=true;closeMenu();save();notice(SECTORS[game.sector].sub,4);}}
    else if(a==='buy'){const lv=profile.levels[value];if(Number.isInteger(lv)&&lv<3&&profile.credits>=40*(lv+1)){profile.credits-=40*(lv+1);profile.levels[value]++;save();hangar();}}
    else if(a==='restart-confirm'){setMenu('<p class="eyebrow">NEW EXPEDITION</p><h1 id="menuTitle" class="panel-title">新しく潜航しますか？</h1><p class="panel-sub">途中の出撃は終了します。確定済みの強化と記録は残ります。</p><div class="button-row"><button class="secondary" data-action="home">戻る</button><button class="primary" data-action="start">新しい出撃</button></div>','confirm');}
  });
  $('menu').addEventListener('change',e=>{
    const map={setSound:'sound',setAnimations:'animations',setReduced:'reduced',setQuality:'quality',setDifficulty:'difficulty'},key=map[e.target.id];if(!key)return;settings[key]=e.target.type==='checkbox'?e.target.checked:e.target.value;syncSettings();if(key==='sound')audio.init();save();
  });
  $('pause').addEventListener('click',pause);$('sound').addEventListener('click',()=>{settings.sound=!settings.sound;audio.init();syncSettings();save();});
  $('boost').addEventListener('click',()=>{if(!paused)pendingBoost=true;});$('pulse').addEventListener('click',()=>{if(!paused)pendingPulse=true;});
  function stickMove(e){if(e.pointerId!==joystickId)return;const box=$('joystick').getBoundingClientRect(),x=e.clientX-box.left-box.width/2,z=e.clientY-box.top-box.height/2,d=Math.hypot(x,z),scale=Math.min(1,38/Math.max(d,1));stickX=x*scale/38;stickZ=z*scale/38;$('stick').style.transform=`translate(${x*scale}px,${z*scale}px)`;}
  $('joystick').addEventListener('pointerdown',e=>{if(paused||joystickId!==null)return;e.preventDefault();joystickId=e.pointerId;$('joystick').setPointerCapture(e.pointerId);stickMove(e);audio.init();});
  $('joystick').addEventListener('pointermove',stickMove);for(const event of ['pointerup','pointercancel','lostpointercapture'])$('joystick').addEventListener(event,e=>{if(e.pointerId===joystickId){joystickId=null;stickX=0;stickZ=0;$('stick').style.transform='translate(0,0)';}});
  renderer.canvas.addEventListener('pointerdown',e=>{
    if(paused)return;let nearest=null,distance=80;for(const enemy of game.enemies){const pt=renderer.project(enemy.x,2,enemy.z),d=Math.hypot(pt.x-e.clientX,pt.y-e.clientY);if(pt.w>0&&d<distance){nearest=enemy;distance=d;}}if(nearest){game.player.lock=nearest.id;notice('目標をロック',1);}audio.init();
  });
  document.addEventListener('keydown',e=>{
    const key=e.key.toLowerCase();
    if(!$('menu').hidden){
      if(key==='tab'){const controls=[...$('menuContent').querySelectorAll('button:not(:disabled),input,select')];if(controls.length){const first=controls[0],end=controls[controls.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();end.focus();}else if(!e.shiftKey&&document.activeElement===end){e.preventDefault();first.focus();}}}
      if(key==='escape'&&screen==='pause'){e.preventDefault();resume();}else if(key==='escape'&&['settings','help','hangar'].includes(screen)){e.preventDefault();back();}return;
    }
    if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright',' ','e','escape','p'].includes(key))e.preventDefault();
    if(key==='escape'||key==='p'){pause();return;}if(!e.repeat){if(key===' ')pendingBoost=true;if(key==='e')pendingPulse=true;}keys.add(key);audio.init();
  });
  document.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
  window.addEventListener('blur',()=>{release();if(screen==='play')pause();});
  document.addEventListener('visibilitychange',()=>{hidden=document.hidden;if(hidden){release();if(screen==='play')pause();save();}last=performance.now();});
  window.addEventListener('pagehide',save);motionQuery.addEventListener?.('change',syncSettings);
  renderer.onLost=()=>{if(screen==='play')pause();notice('描画を一時停止しました。復帰を待っています。',5);};
  renderer.onRestored=()=>{renderer.justLoaded=true;notice('描画が復帰しました。潜航を再開できます。',4);};
  function updateHUD(){
    const p=game.player,sector=SECTORS[game.sector];$('sectorTitle').textContent=sector.name;document.querySelectorAll('#sectorSteps span').forEach((el,i)=>{el.className=i===game.sector?'current':i<game.sector?'done':'';});
    $('missionText').textContent=game.gate?'航路が開いた。光のゲートへ。':game.bossSpawned?'深域の主を撃破し、帰還しよう。':'酵母を救出して、航路を開こう。';
    $('rescueCount').textContent=`${game.rescue.filter(r=>r.saved).length} / 3`;$('killCount').textContent=`${Math.min(game.stageKills,sector.quota)} / ${sector.quota}`;
    $('hpText').textContent=Math.ceil(p.hp);$('hpBar').style.width=`${p.hp/p.maxHp*100}%`;$('hpBar').style.background=p.hp<p.maxHp*.3?'#ff8069':'#81f2e9';
    $('score').textContent=String(game.score).padStart(6,'0');$('combo').textContent=game.combo>1?`×${game.combo}`:'';
    $('pulseTime').textContent=p.pulseCd>0?`${p.pulseCd.toFixed(1)} s`:'E / READY';$('boostTime').textContent=p.boostCd>0?`${p.boostCd.toFixed(1)} s`:'SPACE / READY';$('pulse').classList.toggle('cooling',p.pulseCd>0);$('boost').classList.toggle('cooling',p.boostCd>0);
    $('pulse').setAttribute('aria-disabled',String(p.pulseCd>0));$('boost').setAttribute('aria-disabled',String(p.boostCd>0));
    const boss=game.enemies.find(e=>e.type===3);$('bossHud').hidden=!boss;if(boss){$('bossBar').style.width=`${boss.hp/boss.maxHp*100}%`;$('bossPhase').textContent=`PHASE 0${boss.phase}`;}
    $('timer').textContent=`${String(Math.floor(game.clock/60)).padStart(2,'0')}:${String(Math.floor(game.clock%60)).padStart(2,'0')}`;$('flightLabel').textContent=game.player.boost>0?'BOOST / 急速潜航':game.gate?'ROUTE OPEN / ゲートへ':'SCOUT-01 / 潜航中';
    $('tutorial').textContent=game.clock<16?'スティック / WASDで移動。近くの敵へ自動射撃。':game.clock<32?'囲まれたら衝撃波。紫の酵母のそばで救出。':game.clock<46?'目標のひし形と右上のレーダーを追おう。':'';
  }
  function processEvents(){
    for(const e of game.drain()){
      renderer.addEvent(e,motion());audio.play(e.type);
      if(e.type==='rescue')notice(`酵母を救出。仲間が ${game.saved} 体になった。`,3);
      if(e.type==='gate')notice(game.sector===2?'帰還ゲート、開放。仲間と母港へ！':'航路を確保。光のゲートへ！',4);
      if(e.type==='boss')notice('巨大な反応。深域の主が現れた。',4);
      if(e.type==='warning')notice('突進の予兆。進路から離れよう。',1.7);
      if(e.type==='bossDown')notice('深域の主を撃破！ 帰還ゲートへ。',4);
    }
  }
  let lastDraw=0;
  function frame(now){
    requestAnimationFrame(frame);const dt=last?Math.min((now-last)/1000,.06):0;last=now;if(hidden)return;
    if(!paused&&!renderer.lost){
      const x=stickX+(keys.has('d')||keys.has('arrowright')?1:0)-(keys.has('a')||keys.has('arrowleft')?1:0),z=stickZ+(keys.has('s')||keys.has('arrowdown')?1:0)-(keys.has('w')||keys.has('arrowup')?1:0);
      game.step(dt,{x,z,boost:pendingBoost,pulse:pendingPulse});pendingBoost=false;pendingPulse=false;processEvents();saveClock+=dt;if(saveClock>=5)save();
      if(game.status!==previousStatus){previousStatus=game.status;if(game.status==='upgrade')upgrades();if(['won','lost'].includes(game.status))result();}
      if(game.sector!==previousSector){previousSector=game.sector;previousStatus=game.status;}
    }
    const drawInterval=paused?(motion()&&screen==='home'?40:200):settings.quality==='low'?32:16;
    if(now-lastDraw>=drawInterval){renderer.draw(game,(now-lastDraw)/1000,{...settings,motion:motion()&&(!paused||screen==='home')},screen==='home');lastDraw=now;}
    uiClock+=dt;if(uiClock>.1){uiClock=0;updateHUD();if(toastText&&now>toastUntil){$('toast').classList.remove('visible');toastText='';}}
  }
  syncSettings();home();updateHUD();requestAnimationFrame(frame);
  if(recoveryNotice){const note=document.createElement('p');note.className='fiction';note.textContent='前回の潜航データを読み込めませんでした。新しい出撃から再開できます。';$('menuContent').append(note);}
  // Read-only diagnostics for code-level validation and user-authorized QA.
  globalThis.SHUBO_DIVE=Object.freeze({version:'1.0.0',inspect:()=>({screen,paused,sector:game.sector,status:game.status,score:game.score,saved:game.saved,render:{...renderer.stats},limits:{...ShuboCore.LIMITS}})});
  const context=document.modelContext;
  if(context?.registerTool){
    const lifecycle=new AbortController(),empty=input=>{if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).length)throw new Error('Expected an empty object');};
    for(const tool of [
      {name:'read_flight_status',title:'潜航の状態を見る',description:'現在の海域、進行状態、救出数とスコアを読む。',annotations:{readOnlyHint:true,untrustedContentHint:false},execute(input){empty(input);return globalThis.SHUBO_DIVE.inspect();}},
      {name:'pause_flight',title:'潜航を一時停止',description:'進行中の潜航を止め、画面の一時停止メニューを開く。',annotations:{readOnlyHint:false,untrustedContentHint:false},execute(input){empty(input);if(screen==='play')pause();return globalThis.SHUBO_DIVE.inspect();}}
    ])try{Promise.resolve(context.registerTool({...tool,inputSchema:{type:'object',properties:{},additionalProperties:false}},{signal:lifecycle.signal})).catch(()=>{});}catch(e){}
    window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
  }
})();
