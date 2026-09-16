'use strict';
const ShuboRender=(()=>{
  const {rng,clamp,geometry,SECTORS}=ShuboCore;
  const color={rice:[.56,.7,.64],hypha:[.23,.65,.59],cyan:[.1,.94,1],gold:[1,.69,.2],violet:[.67,.35,1],enemy:[1,.27,.24],white:[.86,.96,.92],hull:[.4,.61,.66]};
  const qyaw=a=>[0,Math.sin(a/2),0,Math.cos(a/2)];
  function multiply(a,b){const out=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)out[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return out;}
  function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),nf=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);}
  function lookAt(eye,at){let z=eye.map((v,i)=>v-at[i]),d=Math.hypot(...z);z=z.map(v=>v/d);let x=[z[2],0,-z[0]];d=Math.hypot(...x);x=x.map(v=>v/d);let y=[z[1]*x[2]-z[2]*x[1],z[2]*x[0]-z[0]*x[2],z[0]*x[1]-z[1]*x[0]];return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-x.reduce((s,v,i)=>s+v*eye[i],0),-y.reduce((s,v,i)=>s+v*eye[i],0),-z.reduce((s,v,i)=>s+v*eye[i],0),1]);}
  function mesh(type){
    const p=[],n=[];
    const tri=(a,b,c)=>{const u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]);let nn=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],d=Math.hypot(...nn)||1;nn=nn.map(t=>t/d);for(const pt of [a,b,c]){p.push(...pt);n.push(...nn);}};
    if(type==='sphere'){
      const point=(j,i)=>{const a=j/6*Math.PI,b=i/10*Math.PI*2;return [Math.sin(a)*Math.cos(b),Math.cos(a),Math.sin(a)*Math.sin(b)];};
      for(let j=0;j<6;j++)for(let i=0;i<10;i++){let a=point(j,i),b=point(j+1,i),c=point(j+1,i+1),d=point(j,i+1);if(j>0)tri(a,d,b);if(j<5)tri(b,d,c);}
    }else if(type==='tube'){
      for(let i=0;i<8;i++){const a=i/8*Math.PI*2,b=(i+1)/8*Math.PI*2,A=[Math.cos(a),-1,Math.sin(a)],B=[Math.cos(b),-1,Math.sin(b)],C=[Math.cos(b),1,Math.sin(b)],D=[Math.cos(a),1,Math.sin(a)];tri(A,C,B);tri(A,D,C);tri([0,1,0],C,D);tri([0,-1,0],A,B);}
    }else{
      const vs=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
      for(const [a,b,c,d] of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]]){tri(vs[a],vs[b],vs[c]);tri(vs[a],vs[c],vs[d]);}
    }
    return {p:new Float32Array(p),n:new Float32Array(n),count:p.length/3};
  }
  function group(){return {sphere:[],tube:[],box:[]};}
  function item(batch,shape,pos,scale,col,em=0,q=[0,0,0,1]){batch[shape].push(...pos,...scale,...q,...col,em);}
  function beam(batch,a,b,r,col,em=0){const d=b.map((v,i)=>v-a[i]),len=Math.hypot(...d);if(len<.001)return;const u=d.map(v=>v/len);let q=[u[2],0,-u[0],1+u[1]],ql=Math.hypot(...q);q=ql<.001?[1,0,0,0]:q.map(v=>v/ql);item(batch,'tube',a.map((v,i)=>(v+b[i])/2),[r,len/2,r],col,em,q);}
  function ring(batch,x,y,z,r,col,vertical=false,em=.65){for(let i=0;i<24;i++){let a=i/24*Math.PI*2,b=(i+1)/24*Math.PI*2;beam(batch,vertical?[x+Math.cos(a)*r,y+Math.sin(a)*r,z]:[x+Math.cos(a)*r,y,z+Math.sin(a)*r],vertical?[x+Math.cos(b)*r,y+Math.sin(b)*r,z]:[x+Math.cos(b)*r,y,z+Math.sin(b)*r],.085,col,em);}}
  function scenery(sector,seed){
    const b=group(),random=rng(seed+SECTORS[sector].seed),w=geometry(sector,seed),tint=sector===1?[.58,.43,.22]:sector===2?[.38,.32,.61]:color.rice;
    item(b,'sphere',[0,-8,0],[74,3,74],[.035,.075,.09]);
    for(const o of w.obstacles){
      item(b,'sphere',[o.x,-1.4,o.z],[o.r*.72,o.r*.65,o.r*1.12],tint,0,qyaw(o.angle));
      for(let j=0;j<3;j++){const a=o.angle+j*.65;item(b,'sphere',[o.x+Math.sin(a)*o.r*.3,-.15,o.z+Math.cos(a)*o.r*.4],[o.r*.12,.08,o.r*.62],sector===1?[.79,.62,.32]:[.76,.86,.7],.06,qyaw(o.angle));}
      for(let j=0;j<3;j++){
        const angle=random()*Math.PI*2,x=o.x+Math.cos(angle)*o.r*.7,z=o.z+Math.sin(angle)*o.r*.7,h=3+random()*6;
        beam(b,[x,-1,z],[x+.4,h,z+.6],.1,sector===2?[.39,.3,.7]:color.hypha);
        for(let k=0;k<3;k++){const a=k*2.09+angle,tip=[x+Math.cos(a)*1.5,h-1+random()*1.6,z+Math.sin(a)*1.5];beam(b,[x+.3,h-2,z+.4],tip,.065,color.hypha);item(b,'sphere',tip,[.21,.23,.21],sector===1?color.gold:color.white,.35);}
      }
    }
    // Distant silhouettes bound the arena without simulating extra organisms.
    for(let i=0;i<16;i++){const a=i/16*Math.PI*2,r=66+random()*12;item(b,'sphere',[Math.sin(a)*r,-5+random()*3,Math.cos(a)*r],[3+random()*5,4+random()*5,7+random()*5],tint,0,qyaw(a));}
    for(let i=0;i<65;i++)item(b,'sphere',[(random()-.5)*120,-4+random()*17,(random()-.5)*120],[.055,.055,.055],[.14,.43,.51],.65);
    ring(b,0,-.6,35,4.5,color.cyan);item(b,'tube',[0,-1.8,35],[5,.5,5],[.055,.18,.22]);
    return b;
  }
  const vs=`attribute vec3 aP,aN,aPos,aScale;attribute vec4 aQ,aColor;uniform mat4 uVP;varying vec3 vN,vW;varying vec4 vC;
  vec3 rotate(vec3 v){return v+2.0*cross(aQ.xyz,cross(aQ.xyz,v)+aQ.w*v);}void main(){vec3 w=rotate(aP*aScale)+aPos;vW=w;vN=normalize(rotate(aN/aScale));vC=aColor;gl_Position=uVP*vec4(w,1.0);}`;
  const fs=`precision mediump float;varying vec3 vN,vW;varying vec4 vC;uniform vec3 uEye,uFog;uniform float uTime;
  void main(){vec3 N=normalize(vN),V=normalize(uEye-vW);float key=max(0.0,dot(N,normalize(vec3(-.4,.9,.25))));float rim=pow(1.0-max(0.0,dot(N,V)),2.4);float caustic=sin(vW.x*1.3+sin(vW.z*.8+uTime*.3))*sin(vW.z*1.1-uTime*.28);vec3 c=vC.rgb*(.28+key*.66+caustic*.055)+vec3(.09,.23,.26)*rim+vC.rgb*vC.a*.8;float fog=1.0-exp(-length(uEye-vW)*.013);c=mix(c,uFog,clamp(fog,0.0,.94));gl_FragColor=vec4(c,1.0);}`;
  class Renderer{
    constructor(canvas,overlay){
      this.canvas=canvas;this.overlay=overlay;this.ctx=overlay.getContext('2d');this.gl=null;this.ext=null;this.sector=-1;this.seed=-1;this.width=1;this.height=1;this.ratio=1;this.elapsed=0;this.effects=[];this.camera=[0,22,60];this.vp=new Float32Array(16);this.static=group();this.dynamic=group();this.lost=false;this.stats={mode:'2d',triangles:0,instances:0,draws:0};
      try{this.init();}catch(error){this.error=String(error.message);this.gl=null;}
      if(!this.gl){const replacement=canvas.cloneNode();canvas.replaceWith(replacement);this.canvas=replacement;this.fallback=replacement.getContext('2d');}
      this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;this.onLost?.();});
      this.canvas.addEventListener('webglcontextrestored',()=>{try{this.init();this.sector=-1;this.lost=false;this.onRestored?.();}catch(e){this.error=String(e.message);this.onLost?.();}});
    }
    init(){
      const gl=this.canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'low-power'});if(!gl)throw new Error('WebGL unavailable');
      const ext=gl.getExtension('ANGLE_instanced_arrays');if(!ext)throw new Error('Instancing unavailable');this.gl=gl;this.ext=ext;
      const compile=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s;};
      const vertex=compile(gl.VERTEX_SHADER,vs),fragment=compile(gl.FRAGMENT_SHADER,fs),program=gl.createProgram();gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));gl.deleteShader(vertex);gl.deleteShader(fragment);gl.useProgram(program);this.program=program;
      this.loc={};for(const n of ['aP','aN','aPos','aScale','aQ','aColor'])this.loc[n]=gl.getAttribLocation(program,n);for(const n of ['uVP','uEye','uFog','uTime'])this.loc[n]=gl.getUniformLocation(program,n);
      this.meshes={};this.staticBuffers={};this.dynamicBuffers={};
      for(const type of ['sphere','tube','box']){const m=mesh(type);m.pb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,m.pb);gl.bufferData(gl.ARRAY_BUFFER,m.p,gl.STATIC_DRAW);m.nb=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,m.nb);gl.bufferData(gl.ARRAY_BUFFER,m.n,gl.STATIC_DRAW);this.meshes[type]=m;this.staticBuffers[type]=gl.createBuffer();this.dynamicBuffers[type]=gl.createBuffer();}
      gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);this.stats.mode='webgl';
    }
    resize(quality='balanced'){
      const w=innerWidth,h=innerHeight,ratio=Math.min(devicePixelRatio||1,quality==='high'?1.6:quality==='low'?1:1.25);
      if(this.width===w&&this.height===h&&this.ratio===ratio)return;this.width=w;this.height=h;this.ratio=ratio;this.canvas.width=Math.floor(w*ratio);this.canvas.height=Math.floor(h*ratio);this.overlay.width=w;this.overlay.height=h;if(this.gl)this.gl.viewport(0,0,this.canvas.width,this.canvas.height);
    }
    uploadStatic(){if(!this.gl)return;for(const type of Object.keys(this.static)){this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.staticBuffers[type]);this.gl.bufferData(this.gl.ARRAY_BUFFER,new Float32Array(this.static[type]),this.gl.STATIC_DRAW);}}
    load(game){this.static=scenery(game.sector,game.seed);this.sector=game.sector;this.seed=game.seed;this.uploadStatic();this.effects=[];}
    addEvent(e,motion){
      if(!motion)return;
      if(['kill','rescue','pulse','hurt','boost','bossDown'].includes(e.type)){
        if(this.effects.length>=24)this.effects.shift();this.effects.push({...e,t:0,life:e.type==='pulse'?.55:e.type==='boost'?.3:1});
      }
    }
    ship(b,x,y,z,yaw,boost,inv){
      const place=(px,py,pz)=>[x+Math.cos(yaw)*px+Math.sin(yaw)*pz,y+py,z-Math.sin(yaw)*px+Math.cos(yaw)*pz],q=qyaw(yaw);
      item(b,'sphere',place(0,0,0),[.95,.6,1.6],inv?color.white:color.hull,.08,q);
      item(b,'sphere',place(0,.42,.45),[.68,.43,.86],color.cyan,.35,q);
      for(const side of [-1,1]){item(b,'sphere',place(side*1.25,-.1,-.25),[.4,.42,1.1],color.white,0,q);item(b,'sphere',place(side*1.25,-.1,-1.15),[.29,.3,boost?2.1:.65],color.cyan,.95,q);item(b,'box',place(side*1.02,0,-.1),[.66,.08,.47],color.hull,0,q);}
      item(b,'box',place(0,.67,-1),[.09,.62,.38],color.enemy,.1,q);
    }
    buildDynamic(game,time,motion){
      const b=group(),p=game.player,t=motion?time:0,y=2.1+(motion?Math.sin(t*1.3)*.08:0);
      this.ship(b,p.x,y,p.z,p.yaw,p.boost>0,p.inv>0&&Math.floor(t*12)%2===0);
      for(const e of game.enemies){
        const c=e.hit>0?color.white:e.type===2?[1,.62,.22]:e.type===3?[.85,.19,.6]:color.enemy,scale=e.type===3?2.5:1,q=qyaw(e.yaw),ey=2.1+Math.sin(t*2+e.id)*.25;
        item(b,'sphere',[e.x,ey,e.z],[.72*scale,.65*scale,(e.type===1?1.7:1.05)*scale],c,.1,q);
        if(e.type===2){item(b,'sphere',[e.x,ey+.6,e.z],[1.25,.35,1.25],c,.12);}
        item(b,'sphere',[e.x,ey+.35,e.z],[.32*scale,.33*scale,.38*scale],color.gold,.7);
        for(let j=0;j<(e.type===3?8:3);j++){
          const angle=j/(e.type===3?8:3)*Math.PI*2+t*.3,px=e.x+Math.sin(angle)*scale*1.5,pz=e.z+Math.cos(angle)*scale*1.5;
          beam(b,[e.x,ey-.25,e.z],[px,ey-.65,pz],.07*scale,c,.12);item(b,'sphere',[px,ey-.65,pz],[.18*scale,.18*scale,.18*scale],c,.35);
        }
        if(e.state===1){const end=[e.x+e.dx*12,.2,e.z+e.dz*12];beam(b,[e.x,.2,e.z],end,.12,color.gold,.9);ring(b,e.x,.2,e.z,2.6*scale,color.enemy);}
      }
      for(const shot of game.bullets){item(b,'sphere',[shot.x,2.1,shot.z],shot.enemy?[.29,.29,.29]:[.14,.14,.65],shot.enemy?color.enemy:color.cyan,1,qyaw(Math.atan2(shot.vx,shot.vz)));}
      for(const r of game.rescue){
        if(r.saved)continue;const yy=2.5+Math.sin(t*1.6+r.id)*.4;
        item(b,'sphere',[r.x,yy,r.z],[.75,1.05,.75],color.violet,.35);item(b,'sphere',[r.x+.62,yy+.7,r.z],[.4,.5,.4],color.violet,.3);
        ring(b,r.x,.1,r.z,3.1,color.cyan,false,.8);
        for(let j=0;j<3;j++){const a=t*.6+j*Math.PI*2/3;item(b,'sphere',[r.x+Math.sin(a)*2,yy+1,r.z+Math.cos(a)*2],[.11,.11,.11],color.gold,.9);}
      }
      // Recovered companions are capped at three representatives.
      for(let i=0;i<Math.min(3,game.saved);i++){const xx=p.x+Math.sin(p.yaw+Math.PI+(i-1)*.45)*(3.6+i*.7),zz=p.z+Math.cos(p.yaw+Math.PI+(i-1)*.45)*(3.6+i*.7);item(b,'sphere',[xx,y+.3,zz],[.34,.48,.34],color.violet,.3);}
      for(const d of game.drops)item(b,'sphere',[d.x,1.8+Math.sin(t*3)*.2,d.z],[.4,.4,.4],d.type==='heal'?color.cyan:color.gold,.8);
      if(game.gate){ring(b,game.exit.x,3,game.exit.z,4,color.cyan,true,1);ring(b,game.exit.x,3,game.exit.z-.6,3.6,color.cyan,true,.7);for(let i=0;i<6;i++){const a=i/6*Math.PI*2+t;item(b,'sphere',[game.exit.x+Math.sin(a)*3,3+Math.cos(a)*3,game.exit.z],[.15,.15,.15],color.white,1);}}
      for(const effect of this.effects){const progress=effect.t/effect.life;if(effect.type==='pulse'||effect.type==='kill'||effect.type==='rescue'||effect.type==='bossDown'){const r=effect.type==='pulse'?progress*effect.value:progress*(effect.type==='bossDown'?12:4);ring(b,effect.x,2,effect.z,r,effect.type==='kill'?color.gold:color.cyan,false,1-progress);}}
      this.dynamic=b;
    }
    drawGroup(batch,buffers,dynamic){
      const gl=this.gl,ext=this.ext,l=this.loc;
      for(const type of ['sphere','tube','box']){
        const values=batch[type],count=values.length/14;if(!count)continue;const m=this.meshes[type];
        for(const [attr,buffer] of [['aP',m.pb],['aN',m.nb]]){gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(l[attr]);gl.vertexAttribPointer(l[attr],3,gl.FLOAT,false,0,0);ext.vertexAttribDivisorANGLE(l[attr],0);}
        gl.bindBuffer(gl.ARRAY_BUFFER,buffers[type]);if(dynamic)gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(values),gl.DYNAMIC_DRAW);
        for(const [attr,size,offset] of [['aPos',3,0],['aScale',3,3],['aQ',4,6],['aColor',4,10]]){gl.enableVertexAttribArray(l[attr]);gl.vertexAttribPointer(l[attr],size,gl.FLOAT,false,56,offset*4);ext.vertexAttribDivisorANGLE(l[attr],1);}
        ext.drawArraysInstancedANGLE(gl.TRIANGLES,0,m.count,count);this.stats.instances+=count;this.stats.triangles+=count*m.count/3;this.stats.draws++;
      }
    }
    project(x,y,z){const m=this.vp,w=m[3]*x+m[7]*y+m[11]*z+m[15];return {x:((m[0]*x+m[4]*y+m[8]*z+m[12])/w*.5+.5)*this.width,y:(.5-(m[1]*x+m[5]*y+m[9]*z+m[13])/w*.5)*this.height,w};}
    draw(game,dt,settings,home=false){
      this.resize(settings.quality);if(this.lost)return;if(this.sector!==game.sector||this.seed!==game.seed)this.load(game);
      const motion=settings.motion;if(motion)this.elapsed+=Math.min(dt,.05);
      for(const e of this.effects)e.t+=dt;this.effects=this.effects.filter(e=>e.t<e.life);if(!motion)this.effects=[];
      const p=game.player,portrait=this.width<this.height,offset=home?[Math.sin(this.elapsed*.035)*8,20,30]:[0,portrait?33:23,portrait?36:28],desired=[p.x+offset[0],offset[1],p.z+offset[2]],smooth=home?.045:1-Math.exp(-Math.max(.016,dt)*7);
      if(this.justLoaded){this.camera=desired;this.justLoaded=false;}else this.camera=this.camera.map((v,i)=>v+(desired[i]-v)*smooth);
      const look=[p.x,1,p.z-(portrait?5:6)],view=lookAt(this.camera,look),projection=perspective((portrait?68:61)*Math.PI/180,this.width/this.height,.2,180);this.vp=multiply(projection,view);
      this.buildDynamic(game,this.elapsed,motion);this.stats.instances=0;this.stats.triangles=0;this.stats.draws=0;
      if(this.gl){const gl=this.gl,background=SECTORS[game.sector].tint;gl.clearColor(...background,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(this.program);gl.uniformMatrix4fv(this.loc.uVP,false,this.vp);gl.uniform3fv(this.loc.uEye,this.camera);gl.uniform3fv(this.loc.uFog,background);gl.uniform1f(this.loc.uTime,motion?this.elapsed:0);this.drawGroup(this.static,this.staticBuffers,false);this.drawGroup(this.dynamic,this.dynamicBuffers,true);}
      else this.drawFallback(game);
      this.drawOverlay(game,settings,home);
    }
    drawFallback(game){
      const ctx=this.fallback,w=this.canvas.width,h=this.canvas.height;ctx.setTransform(this.ratio,0,0,this.ratio,0,0);const bg=ctx.createLinearGradient(0,0,0,this.height);bg.addColorStop(0,'#092a38');bg.addColorStop(1,'#020b18');ctx.fillStyle=bg;ctx.fillRect(0,0,this.width,this.height);
      const shapes=[];for(const g of [this.static,this.dynamic])for(const type of ['sphere','box'])for(let i=0;i<g[type].length;i+=14){const a=g[type],p=this.project(a[i],a[i+1],a[i+2]);if(p.w>.1&&p.x>-80&&p.x<this.width+80&&p.y>-80&&p.y<this.height+80)shapes.push({p,a:a.slice(i,i+14)});}
      shapes.sort((a,b)=>b.p.w-a.p.w);for(const {p,a} of shapes){const r=this.height/(p.w*1.25);ctx.fillStyle=`rgb(${a.slice(10,13).map(v=>Math.round(v*255)).join(',')})`;ctx.globalAlpha=clamp(1-p.w/160,.15,.92);ctx.beginPath();ctx.ellipse(p.x,p.y,Math.max(1,a[3]*r),Math.max(1,a[4]*r),0,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;
    }
    drawOverlay(game,settings,home){
      const ctx=this.ctx,w=this.width,h=this.height;ctx.clearRect(0,0,w,h);if(home)return;
      const target=game.target();if(target){const p=this.project(target.x,3,target.z);if(p.w>0){ctx.strokeStyle='#7ff4f3';ctx.lineWidth=1.5;const r=target.type===3?30:19;for(let i=0;i<4;i++){ctx.beginPath();ctx.arc(p.x,p.y,r,i*Math.PI/2+.1,i*Math.PI/2+.7);ctx.stroke();}ctx.fillStyle='#20353e';ctx.fillRect(p.x-22,p.y-r-10,44,3);ctx.fillStyle='#ff8069';ctx.fillRect(p.x-22,p.y-r-10,44*target.hp/target.maxHp,3);}}
      const objective=game.objective(),pt=this.project(objective.x,3,objective.z),padding=w<600?32:60,top=Math.min(150,h*.3),bottom=Math.max(top+40,h-(w<600?215:120));
      const on=pt.w>0&&pt.x>=padding&&pt.x<=w-padding&&pt.y>=top&&pt.y<=bottom;
      let x=pt.x,y=pt.y,angle=0;if(!on){const sign=pt.w<0?-1:1,dx=(pt.x-w/2)*sign,dy=(pt.y-h/2)*sign,cx=w/2,cy=(top+bottom)/2;angle=Math.atan2(dy,dx);const k=Math.min((w/2-padding)/Math.max(.001,Math.abs(dx)),(bottom-top)/2/Math.max(.001,Math.abs(dy)));x=cx+dx*k;y=cy+dy*k;}
      ctx.strokeStyle=objective.kind==='boss'?'#ff8876':'#b2ffff';ctx.fillStyle=ctx.strokeStyle;ctx.lineWidth=1.2;
      ctx.save();ctx.translate(x,y);if(on){ctx.strokeRect(-7,-7,14,14);}else{ctx.rotate(angle);ctx.beginPath();ctx.moveTo(9,0);ctx.lineTo(-6,-6);ctx.lineTo(-6,6);ctx.closePath();ctx.fill();}ctx.restore();
      ctx.font='12px ui-monospace, monospace';ctx.textAlign='center';ctx.fillText(`${objective.title} · ${Math.round(Math.hypot(objective.x-game.player.x,objective.z-game.player.z))}`,x,y+27);
      for(const r of game.rescue)if(!r.saved&&r.progress>0){const p=this.project(r.x,4,r.z);ctx.strokeStyle='#b2ffff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,24,-Math.PI/2,-Math.PI/2+r.progress*Math.PI*2);ctx.stroke();}
      // Radar expresses arena positions, not an additional simulated scene.
      const size=w<600?74:102,cx=w-(w<600?58:82),cy=w<600?167:194,scale=size/124;
      ctx.fillStyle='rgba(3,15,27,.65)';ctx.beginPath();ctx.arc(cx,cy,size/2+7,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(114,219,223,.28)';ctx.lineWidth=1;ctx.stroke();
      ctx.beginPath();ctx.moveTo(cx-size/2,cy);ctx.lineTo(cx+size/2,cy);ctx.moveTo(cx,cy-size/2);ctx.lineTo(cx,cy+size/2);ctx.stroke();
      const dot=(x,z,c,r)=>{ctx.fillStyle=c;ctx.beginPath();ctx.arc(cx+x*scale,cy+z*scale,r,0,Math.PI*2);ctx.fill();};
      for(const e of game.enemies)dot(e.x,e.z,'#ff8069',e.type===3?4:2);
      for(const r of game.rescue)if(!r.saved)dot(r.x,r.z,'#d8afff',3);
      if(game.gate)dot(game.exit.x,game.exit.z,'#8bfff3',4);dot(game.player.x,game.player.z,'#f3ffff',3.5);
      if(game.player.inv>.65&&settings.motion){ctx.strokeStyle='rgba(255,99,91,.25)';ctx.lineWidth=18;ctx.strokeRect(0,0,w,h);}
      if(game.player.boost>0&&settings.motion){ctx.strokeStyle='rgba(125,233,250,.27)';ctx.lineWidth=1;for(let i=0;i<16;i++){const a=i/16*Math.PI*2,r=Math.min(w,h)*.42;ctx.beginPath();ctx.moveTo(w/2+Math.cos(a)*r,h*.54+Math.sin(a)*r);ctx.lineTo(w/2+Math.cos(a)*r*1.5,h*.54+Math.sin(a)*r*1.5);ctx.stroke();}}
    }
  }
  return {Renderer,mesh,scenery,multiply,perspective,lookAt,group,item,beam,ring,vs,fs};
})();
globalThis.ShuboRender=ShuboRender;
