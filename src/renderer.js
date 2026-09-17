'use strict';
const ShuboRender=(()=>{
  const {rng,clamp,geometry,SECTORS,forward,rotation,rotate,qmul,normalize,segmentObstacle}=ShuboCore;
  const STRIDE=15,TYPES=['sphere','grain','tube','box','ring','sphereLow','sphereTiny','tubeLow','grainLow'];
  const color={rice:[.88,.86,.7],hypha:[.81,.87,.74],cyan:[.12,.86,1],gold:[1,.7,.25],violet:[.62,.35,.77],enemy:[1,.34,.23],white:[.91,.91,.79],hull:[.7,.74,.66]};
  function multiply(a,b){const out=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)out[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return out;}
  function perspective(fov,aspect,near,far){const f=1/Math.tan(fov/2),nf=1/(near-far);return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)*nf,-1,0,0,2*far*near*nf,0]);}
  function lookAt(eye,at){let z=normalize(eye.map((v,i)=>v-at[i]));if(Math.hypot(...z)<.001)z=[0,0,1];const up=Math.abs(z[1])>.995?[0,0,1]:[0,1,0];const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],x=normalize(cross(up,z)),y=cross(z,x);return new Float32Array([x[0],y[0],z[0],0,x[1],y[1],z[1],0,x[2],y[2],z[2],0,-x.reduce((s,v,i)=>s+v*eye[i],0),-y.reduce((s,v,i)=>s+v*eye[i],0),-z.reduce((s,v,i)=>s+v*eye[i],0),1]);}
  function cameraPose(player,obstacles,portrait=false){
    const f=forward(player.yaw,player.pitch),right=[Math.cos(player.yaw),0,-Math.sin(player.yaw)],distance=portrait?20:11,shoulder=portrait?.75:1.5;
    const eye=[player.x-f[0]*distance+right[0]*shoulder,player.y-f[1]*distance+3.2,player.z-f[2]*distance+right[2]*shoulder],at=[player.x+f[0]*24,player.y+f[1]*24+1,player.z+f[2]*24];
    const origin={x:player.x,y:player.y+.4,z:player.z},end={x:eye[0],y:eye[1],z:eye[2]};let fraction=1;
    for(const o of obstacles){const t=segmentObstacle(origin,end,o,.6);if(t!==null)fraction=Math.min(fraction,Math.max(0,t-.06));}
    if(fraction<1)for(let i=0;i<3;i++)eye[i]=[origin.x,origin.y,origin.z][i]+(eye[i]-[origin.x,origin.y,origin.z][i])*fraction;
    return {eye,at,forward:f};
  }
  function mesh(type){
    const p=[],n=[];const tri=(a,b,c,smooth=false)=>{const u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]),nn=normalize([u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]);for(const pt of [a,b,c]){p.push(...pt);n.push(...(smooth?normalize(pt):nn));}};
    if(type.startsWith('sphere')||type.startsWith('grain')){
      const grain=type.startsWith('grain'),rings=type==='grain'?24:type==='grainLow'?12:type==='sphereTiny'?4:type==='sphereLow'?6:8,segs=type==='grain'?36:type==='grainLow'?18:type==='sphereTiny'?6:type==='sphereLow'?8:12;
      const point=(j,i)=>{const a=j/rings*Math.PI,b=i/segs*Math.PI*2,x=Math.sin(a)*Math.cos(b),y=Math.cos(a),z=Math.sin(a)*Math.sin(b);const r=grain?1+.025*Math.sin(x*19+z*7)*Math.sin(y*17-z*11)+.013*Math.sin(x*41+y*23+z*17):1;return [x*r,y*r,z*r];};
      for(let j=0;j<rings;j++)for(let i=0;i<segs;i++){const a=point(j,i),b=point(j+1,i),c=point(j+1,i+1),d=point(j,i+1);if(j>0)tri(a,d,b,true);if(j<rings-1)tri(b,d,c,true);}
    }else if(type==='ring'){
      const point=(i,j)=>{const a=i/28*Math.PI*2,b=j/6*Math.PI*2,normal=[Math.cos(a)*Math.cos(b),Math.sin(b),Math.sin(a)*Math.cos(b)];return {p:[Math.cos(a)+normal[0]*.05,normal[1]*.05,Math.sin(a)+normal[2]*.05],n:normal};};
      for(let i=0;i<28;i++)for(let j=0;j<6;j++){const a=point(i,j),b=point(i+1,j),c=point(i+1,j+1),d=point(i,j+1);for(const v of [a,c,b,a,d,c]){p.push(...v.p);n.push(...v.n);}}
    }else if(type.startsWith('tube')){
      const sides=type==='tubeLow'?4:8;for(let i=0;i<sides;i++){const a=i/sides*Math.PI*2,b=(i+1)/sides*Math.PI*2,A=[Math.cos(a),-1,Math.sin(a)],B=[Math.cos(b),-1,Math.sin(b)],C=[Math.cos(b),1,Math.sin(b)],D=[Math.cos(a),1,Math.sin(a)];tri(A,C,B);tri(A,D,C);tri([0,1,0],C,D);tri([0,-1,0],A,B);}
    }else{const vs=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];for(const [a,b,c,d]of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]]){tri(vs[a],vs[b],vs[c]);tri(vs[a],vs[c],vs[d]);}}
    return {p:new Float32Array(p),n:new Float32Array(n),count:p.length/3};
  }
  const group=()=>Object.fromEntries(TYPES.map(type=>[type,[]]));
  function item(b,shape,pos,scale,c,em=0,q=[0,0,0,1],mat=0){b[shape].push(...pos,...scale,...q,...c,em,mat);}
  function beam(b,a,c,r,col,em=0,mat=5){const d=c.map((v,i)=>v-a[i]),len=Math.hypot(...d);if(len<.0001)return;const u=d.map(v=>v/len);let q=[u[2],0,-u[0],1+u[1]],l=Math.hypot(...q);q=l<.001?[1,0,0,0]:q.map(v=>v/l);item(b,'tube',a.map((v,i)=>(v+c[i])/2),[r,len/2,r],col,em,q,mat);}
  function ring(b,x,y,z,r,col,vertical=false,em=.7,q=[0,0,0,1],thick=.065){if(r<=.0001)return;item(b,'ring',[x,y,z],[r,thick,r],col,em,vertical?qmul(q,[Math.SQRT1_2,0,0,Math.SQRT1_2]):q,6);}
  function frustum(matrix){const planes=[];for(let axis=0;axis<3;axis++)for(const sign of [1,-1]){const a=[matrix[3]+sign*matrix[axis],matrix[7]+sign*matrix[4+axis],matrix[11]+sign*matrix[8+axis],matrix[15]+sign*matrix[12+axis]],length=Math.hypot(a[0],a[1],a[2]);planes.push(a.map(v=>v/(length||1)));}return planes;}
  function bounds(type,a,i){const x=Math.abs(a[i+3]),y=Math.abs(a[i+4]),z=Math.abs(a[i+5]);return type==='ring'?x+y:type==='box'?Math.hypot(x,y,z):type.startsWith('tube')?Math.hypot(y,Math.max(x,z)):Math.max(x,y,z)*(type.startsWith('grain')?1.038:1);}
  const inFrustum=(planes,x,y,z,r)=>!planes||planes.every(p=>p[0]*x+p[1]*y+p[2]*z+p[3]>=-r);
  function detailMesh(type,pixels,thickness,previous){
    if(type==='sphere'){if(previous==='sphere'&&pixels>=16.2)return previous;if(previous==='sphereLow'&&pixels>=5.4&&pixels<=19.8)return previous;if(previous==='sphereTiny'&&pixels<=6.6)return previous;return pixels<6?'sphereTiny':pixels<18?'sphereLow':type;}
    if(type==='grain'){if(previous==='grain'&&pixels>=108||previous==='grainLow'&&pixels<=132)return previous;return pixels<120?'grainLow':type;}
    if(type==='tube'){if(previous==='tube'&&thickness>=1.62||previous==='tubeLow'&&thickness<=1.98)return previous;return thickness<1.8?'tubeLow':type;}return type;
  }
  // Capacity persists across frames; only the occupied portion is uploaded.
  class InstanceStream{
    constructor(){this.data=new Float32Array(0);this.ids=new Int32Array(0);this.count=0;this.previous=-1;this.gpuBytes=0;this.changed=true;}
    reset(){this.count=0;this.changed=false;}
    append(source,offset){const index=this.count++,end=this.count*STRIDE;if(end>this.data.length){const capacity=Math.max(240,this.data.length*2,end),data=new Float32Array(capacity),ids=new Int32Array(capacity/STRIDE);data.set(this.data);ids.fill(-1);ids.set(this.ids);this.data=data;this.ids=ids;this.changed=true;}if(this.ids[index]!==offset){this.changed=true;this.ids[index]=offset;}for(let j=0;j<STRIDE;j++)this.data[index*STRIDE+j]=source[offset+j];}
  }
  class ResolutionBudget{
    constructor(){this.scale=1;this.reset();}
    reset(){this.ms=0;this.frames=0;this.slow=0;this.fast=0;this.stable=0;this.grace=1500;this.baseline=0;this.trialScale=this.scale;this.cooldown=0;}
    observe(ms,active,enabled=true){if(!enabled){this.scale=1;this.reset();return;}if(!active){this.reset();return;}if(!Number.isFinite(ms)||ms<=0)return;ms=Math.min(ms,100);if(this.cooldown>0){this.cooldown-=ms;return;}if(this.grace>0){this.grace-=ms;return;}this.ms+=ms;this.frames++;if(ms>24)this.slow++;if(ms<=19)this.fast++;if(this.ms<2000||this.frames<20)return;
      const mean=this.ms/this.frames;if(this.baseline&&this.scale<=.72&&mean>=this.baseline*.9){this.scale=this.trialScale;this.baseline=0;this.stable=0;this.cooldown=30000;}
      else if(this.slow/this.frames>.3&&this.scale>.72){if(!this.baseline){this.baseline=mean;this.trialScale=this.scale;}this.scale=Math.max(.72,Math.round((this.scale-.08)*100)/100);this.stable=0;this.grace=3000;}else if(this.fast/this.frames>.92){this.baseline=0;this.stable+=this.ms;if(this.stable>8000&&this.scale<1){this.scale=Math.min(1,Math.round((this.scale+.04)*100)/100);this.stable=0;this.grace=3000;}}else this.stable=0;this.ms=0;this.frames=0;this.slow=0;this.fast=0;
    }
  }
  function poreTexture(size=256){
    const height=new Float32Array(size*size),data=new Uint8Array(size*size*4),random=rng(549),grid=10,centers=Array.from({length:grid*grid},()=>[.22+random()*.56,.22+random()*.56,.21+random()*.12]);
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){const u=x/size*grid,v=y/size*grid,gx=Math.floor(u),gy=Math.floor(v);let value=1;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const c=centers[((gy+j+grid)%grid)*grid+(gx+i+grid)%grid],d=Math.hypot(u-(gx+i+c[0]),v-(gy+j+c[1]))/c[2];let h=clamp((d-.5)/.8,0,1);h=h*h*(3-2*h);value=Math.min(value,h);}height[y*size+x]=.16+.84*value;}
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){const i=(y*size+x)*4,dx=height[y*size+(x+1)%size]-height[y*size+(x+size-1)%size],dy=height[((y+1)%size)*size+x]-height[((y+size-1)%size)*size+x];data[i]=Math.round(height[y*size+x]*255);data[i+1]=Math.round(clamp(.5+dx,0,1)*255);data[i+2]=Math.round(clamp(.5+dy,0,1)*255);data[i+3]=255;}return {size,data};
  }
  function scenery(sector,seed,quality='balanced'){
    const b=group(),random=rng(seed+SECTORS[sector].seed),world=geometry(sector,seed),low=quality==='low';
    function cell(x,y,z,s=.7){item(b,'sphere',[x,y,z],[s,s*1.35,s],color.violet,.05,rotation(random()*6,random()*.3),2);item(b,'sphere',[x+s*.55,y+s*.88,z+s*.2],[s*.48,s*.65,s*.48],color.violet,.04,rotation(.3),2);}
    function head(at,size=.8){item(b,'sphere',at,[size,size,size],color.hypha,0,[0,0,0,1],5);for(let i=0;i<(low?7:14);i++){const angle=i*2.39996,yy=1-2*(i+.5)/(low?7:14),rr=Math.sqrt(1-yy*yy),dir=[Math.cos(angle)*rr,yy,Math.sin(angle)*rr];const tip=at.map((v,k)=>v+dir[k]*size*1.65);beam(b,at,tip,.07,color.hypha);item(b,'sphere',tip,[size*.23,size*.3,size*.23],color.white,0,rotation(angle),5);}}
    for(let index=0;index<world.obstacles.length;index++){
      const o=world.obstacles[index];item(b,'grain',[o.x,o.y,o.z],[o.sx,o.sy,o.sz],color.rice,0,o.q,1);
      const count=index<4?(low?7:12):5;
      for(let j=0;j<count;j++){
        const theta=random()*6.283,ny=(random()-.5)*1.7,rr=Math.sqrt(1-ny*ny),normal=[Math.cos(theta)*rr,ny,Math.sin(theta)*rr],local=[normal[0]*o.sx,normal[1]*o.sy,normal[2]*o.sz],base=rotate(local,o.q).map((v,k)=>v+[o.x,o.y,o.z][k]),out=normalize(rotate(normal,o.q));
        let from=base;for(let k=1;k<=3;k++){const reach=(3+random()*2)*k,tip=base.map((v,a)=>v+out[a]*reach+Math.sin(j+k+a)*.55);beam(b,from,tip,.12-k*.018,color.hypha,0,5);if(k===2){const fork=tip.map((v,a)=>v+out[a]*2+Math.cos(j+a)*2);beam(b,tip,fork,.07,color.hypha);item(b,'sphere',fork,[.22,.32,.22],color.white,0,[0,0,0,1],5);}from=tip;}if(j%3===0&&index<6)head(from,.72+random()*.35);
        if(j%2===0&&index<6)cell(base[0]+out[0]*1.3,base[1]+out[1]*1.3,base[2]+out[2]*1.3,.9+random()*.7);
      }
    }
    // Curved mycelial bridges cross the volume above and below the flight corridor.
    for(let j=0;j<(low?6:12);j++){
      const z=32-j*11,y=j%2?30+j%3*6:-15-j%3*2;let previous=[-18,y,z];
      for(let k=1;k<=12;k++){const x=-18+k*3,at=[x,y+Math.sin(k/12*Math.PI)*4,z+Math.sin(k+j)*.7];beam(b,previous,at,.08+(j%3)*.025,color.hypha);if(k%3===0){const branch=[x+2,y+(j%2?-1:1)*4,z-1];beam(b,at,branch,.05,color.hypha);if(j%3===0)head(branch,.5);}previous=at;}
    }
    // Cell colonies and pale fungal silhouettes give the canyon a coherent scale.
    for(let i=0;i<(low?12:25);i++){const o=world.obstacles[i%4],a=random()*6.28;cell(o.x+Math.cos(a)*o.sx*.8,o.y+o.sy*.4,o.z+Math.sin(a)*o.sz*.7,.55+random()*.8);}
    ring(b,0,10,70,4,color.cyan);item(b,'sphere',[0,8.5,70],[5,.75,5],[.09,.19,.22],0,rotation(0),3);
    return b;
  }
  const vs=`precision highp float;attribute vec3 aP,aN,aPos,aScale,aColor;attribute vec4 aQ;attribute vec2 aExtra;uniform mat4 uVP;varying mediump vec3 vN,vL,vC;varying highp vec3 vW;varying mediump vec2 vE;
  vec3 rot(vec3 v){return v+2.0*cross(aQ.xyz,cross(aQ.xyz,v)+aQ.w*v);}void main(){vec3 local=aP*aScale,normal=aN/aScale;if(aExtra.y>5.5){local=(aP-aN*.05)*aScale.x+aN*aScale.y;normal=aN;}vL=aP;vW=rot(local)+aPos;vN=normalize(rot(normal));vC=aColor;vE=aExtra;gl_Position=uVP*vec4(vW,1.0);}`;
  const fs=`precision highp float;varying mediump vec3 vN,vL,vC;varying highp vec3 vW;varying mediump vec2 vE;uniform vec3 uEye,uFog;uniform float uTime;uniform sampler2D uPores;
  void main(){vec3 N=normalize(vN),V=normalize(uEye-vW),L=normalize(vec3(-.45,.8,.5)),C=vC;float cavity=1.0;
  if(vE.y>.5&&vE.y<1.5){vec3 weights=pow(abs(normalize(vL)),vec3(4.0));weights/=max(dot(weights,vec3(1.0)),.001);vec3 a=texture2D(uPores,vL.yz*2.8).rgb,b=texture2D(uPores,vL.xz*2.8).rgb,c=texture2D(uPores,vL.xy*2.8).rgb;float h=dot(vec3(a.r,b.r,c.r),weights);N=normalize(N+vec3(c.g-.5,a.b-.5,b.g-.5)*.7);cavity=.3+h*.7;C*=.79+h*.23;}
  if(vE.y>1.5&&vE.y<2.5){float veins=sin(vL.x*44.0+sin(vL.y*36.0)*2.0+vL.z*19.0);C*=.93+veins*.055;}
  float diffuse=max(0.0,dot(N,L)),rim=pow(1.0-clamp(dot(N,V),0.0,1.0),2.5),spec=pow(max(0.0,dot(N,normalize(L+V))),vE.y>2.5&&vE.y<4.5?70.0:19.0);
  float caustic=pow(max(0.0,sin(vW.x*.27+sin(vW.z*.3+uTime*.22))*sin(vW.z*.31-uTime*.2)),6.0);
  vec3 c=C*(.26+.7*diffuse+.12*max(N.y,0.0))*cavity+vec3(.16,.31,.33)*rim+vec3(.9,.98,1.0)*spec*(vE.y>2.5&&vE.y<5.5?.6:.18)+vec3(.11,.3,.32)*caustic;
  if(vE.y>3.5&&vE.y<4.5)c=C*(.28+diffuse*.2)+vec3(.28,.7,.78)*rim+vec3(.9,1.0,1.0)*spec;
  c+=C*vE.x*1.7;float fog=1.0-exp(-length(uEye-vW)*.0075);c=mix(c,uFog,clamp(fog,0.0,.92));gl_FragColor=vec4(c,1.0);}`;
  const screenVS=`attribute vec2 aPoint;varying vec2 uv;void main(){uv=aPoint*.5+.5;gl_Position=vec4(aPoint,0.0,1.0);}`;
  const skyFS=`precision mediump float;varying vec2 uv;uniform float uTime;uniform vec3 uFog;void main(){vec3 c=mix(uFog*.48,uFog*1.8,uv.y);float ray=pow(max(0.0,sin((uv.x+uv.y*.22)*23.0+sin(uTime*.1)*.15)),22.0);c+=vec3(.1,.22,.25)*ray*pow(uv.y,2.0)*.38;float light=exp(-length((uv-vec2(.72,1.12))*vec2(1.4,1.0))*4.0);c+=vec3(.13,.3,.34)*light;gl_FragColor=vec4(c,1.0);}`;
  const bloomFS=`precision mediump float;varying vec2 uv;uniform sampler2D uScene;uniform vec2 uPixel;void main(){vec3 c=vec3(0.0);for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++){vec3 v=texture2D(uScene,uv+vec2(float(x),float(y))*uPixel*3.0).rgb;c+=max(v-vec3(.62),0.0);}gl_FragColor=vec4(c/9.0,1.0);}`;
  const blurFS=`precision mediump float;varying vec2 uv;uniform sampler2D uBloom;uniform vec2 uPixel;void main(){vec3 glow=texture2D(uBloom,uv).rgb*.4;glow+=(texture2D(uBloom,uv+vec2(uPixel.x,0.0)*2.0).rgb+texture2D(uBloom,uv-vec2(uPixel.x,0.0)*2.0).rgb+texture2D(uBloom,uv+vec2(0.0,uPixel.y)*2.0).rgb+texture2D(uBloom,uv-vec2(0.0,uPixel.y)*2.0).rgb)*.15;gl_FragColor=vec4(glow,1.0);}`;
  const composeFS=`precision mediump float;varying vec2 uv;uniform sampler2D uScene,uBloom;void main(){vec3 c=texture2D(uScene,uv).rgb+texture2D(uBloom,uv).rgb*.7;float vig=1.0-.18*pow(length((uv-.5)*1.35),2.0);gl_FragColor=vec4(c*vig,1.0);}`;
  const particleVS=`precision highp float;attribute vec3 aP,aColor;attribute vec2 aExtra;uniform mat4 uVP;uniform float uTime,uRatio;varying vec3 c;void main(){vec3 p=aP;p.y=mod(p.y+uTime*.45+40.0,115.0)-40.0;p.x+=sin(uTime*.25+aExtra.y)*.9;gl_Position=uVP*vec4(p,1.0);gl_PointSize=clamp(aExtra.x*uRatio*240.0/max(gl_Position.w,1.0),1.0,13.0);c=aColor;}`;
  const particleFS=`precision mediump float;varying vec3 c;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(c,pow(1.0-d*2.0,1.5)*.75);}`;
  class Renderer{
    constructor(canvas,overlay){this.canvas=canvas;this.overlay=overlay;this.ctx=overlay.getContext('2d');this.gl=null;this.ext=null;this.sector=-1;this.seed=-1;this.width=1;this.height=1;this.ratio=1;this.elapsed=0;this.effects=[];this.camera=null;this.vp=new Float32Array(16);this.static=group();this.dynamic=group();this.budget=new ResolutionBudget();this.planes=null;this.lost=false;this.fatal=false;this.stats={mode:'unavailable',triangles:0,instances:0,draws:0};
      try{this.init();}catch(e){this.error=String(e.message);this.fatal=true;this.lost=true;}
      this.canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.lost=true;this.onLost?.();});this.canvas.addEventListener('webglcontextrestored',()=>{try{this.init();this.sector=-1;this.width=1;this.camera=null;this.lost=false;this.fatal=false;this.onRestored?.();}catch(e){this.error=String(e.message);this.fatal=true;this.onLost?.();}});
    }
    init(){
      const gl=this.canvas.getContext('webgl',{alpha:false,antialias:false,powerPreference:'high-performance'});if(!gl)throw new Error('WebGLを初期化できませんでした。');this.gl=gl;this.ext=gl.getExtension('ANGLE_instanced_arrays');this.highp=gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER,gl.HIGH_FLOAT).precision>0;
      const program=(vertex,fragment,names)=>{const compile=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,this.highp?src:src.replace(/highp/g,'mediump'));gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const msg=gl.getShaderInfoLog(s);gl.deleteShader(s);throw new Error('Shader: '+msg);}return s;};const v=compile(gl.VERTEX_SHADER,vertex),f=compile(gl.FRAGMENT_SHADER,fragment),p=gl.createProgram();gl.attachShader(p,v);gl.attachShader(p,f);gl.bindAttribLocation(p,0,vertex.includes('aPoint')?'aPoint':'aP');gl.linkProgram(p);gl.deleteShader(v);gl.deleteShader(f);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error('Program: '+gl.getProgramInfoLog(p));const result={p,loc:{}};for(const name of names)result.loc[name]=name.startsWith('a')?gl.getAttribLocation(p,name):gl.getUniformLocation(p,name);return result;};
      this.main=program(vs,fs,['aP','aN','aPos','aScale','aQ','aColor','aExtra','uVP','uEye','uFog','uTime','uPores']);this.sky=program(screenVS,skyFS,['aPoint','uTime','uFog']);this.bloom=program(screenVS,bloomFS,['aPoint','uScene','uPixel']);this.blur=program(screenVS,blurFS,['aPoint','uBloom','uPixel']);this.compose=program(screenVS,composeFS,['aPoint','uScene','uBloom']);this.particles=program(particleVS,particleFS,['aP','aColor','aExtra','uVP','uTime','uRatio']);
      this.meshes={};this.staticBuffers={};this.dynamicBuffers={};this.staticStreams={};this.dynamicStreams={};for(const type of TYPES){const m=mesh(type);for(const [key,data]of [['pb',m.p],['nb',m.n]]){m[key]=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,m[key]);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);}this.meshes[type]=m;this.staticBuffers[type]=gl.createBuffer();this.dynamicBuffers[type]=gl.createBuffer();this.staticStreams[type]=new InstanceStream();this.dynamicStreams[type]=new InstanceStream();}
      this.quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
      const tex=poreTexture(256);this.pores=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,this.pores);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,tex.size,tex.size,0,gl.RGBA,gl.UNSIGNED_BYTE,tex.data);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.generateMipmap(gl.TEXTURE_2D);
      const random=rng(901),points=[];for(let i=0;i<260;i++){const c=i%8===0?color.gold:[.45,.8,.85];points.push((random()-.5)*230,random()*115-40,(random()-.5)*250,...c,.45+random(),random()*6.28);}this.snow=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,this.snow);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(points),gl.STATIC_DRAW);this.snowCount=260;
      this.targets=null;gl.enable(gl.DEPTH_TEST);gl.enable(gl.CULL_FACE);this.stats.mode=this.ext?'webgl-instanced-3d':'webgl-basic-3d';
    }
    resetAttributes(){const gl=this.gl;for(let i=0;i<7;i++){gl.disableVertexAttribArray(i);if(this.ext)this.ext.vertexAttribDivisorANGLE(i,0);}}
    observeFrame(ms,active,enabled=true){this.budget.observe(ms,active,enabled);}
    resize(quality='balanced'){
      const w=innerWidth,h=innerHeight,cap=quality==='high'?1.5:quality==='low'?1:1.25,scale=quality==='low'?1:this.budget.scale,ratio=Math.min(devicePixelRatio||1,cap,Math.sqrt(1800000/(w*h)))*scale,post=quality!=='low';
      const changed=this.width!==w||this.height!==h||this.ratio!==ratio;this.width=w;this.height=h;this.ratio=ratio;
      if(changed){this.canvas.width=Math.max(1,Math.floor(w*ratio));this.canvas.height=Math.max(1,Math.floor(h*ratio));this.overlay.width=w;this.overlay.height=h;}
      if(this.gl&&!this.fatal&&(changed||post!==Boolean(this.targets)))this.createTargets(post);
    }
    createTargets(enabled=true){
      const gl=this.gl;if(this.targets){for(const t of Object.values(this.targets)){gl.deleteTexture(t.tex);gl.deleteFramebuffer(t.fbo);if(t.depth)gl.deleteRenderbuffer(t.depth);}this.targets=null;}if(!enabled)return;
      const make=(width,height,depth)=>{const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);for(const [k,v]of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);const fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0);let rb=null;if(depth){rb=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,rb);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,width,height);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,rb);}return {tex,fbo,depth:rb,width,height,ok:gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE};};
      const w=Math.max(1,Math.floor(this.canvas.width/4)),h=Math.max(1,Math.floor(this.canvas.height/4));this.targets={scene:make(this.canvas.width,this.canvas.height,true),small:make(w,h,false),blurred:make(w,h,false)};gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    }
    uploadStatic(){for(const stream of Object.values(this.staticStreams))stream.previous=-1;}
    load(game,quality){this.static=scenery(game.sector,game.seed,quality);this.staticDetail=Object.fromEntries(TYPES.map(type=>[type,[]]));this.sector=game.sector;this.seed=game.seed;this.quality=quality;this.uploadStatic();this.effects=[];}
    addEvent(e,motion){if(!motion)return;if(['kill','rescue','pulse','bossDown'].includes(e.type)){if(this.effects.length>=24)this.effects.shift();this.effects.push({...e,t:0,life:e.type==='pulse'?.6:1.15});}}
    ship(b,p,time,motion){
      const q=rotation(p.yaw,p.pitch,motion?p.roll:0),place=(x,y,z)=>rotate([x,y,z],q).map((v,i)=>v+[p.x,p.y,p.z][i]);
      const inv=p.inv>0&&Math.floor(time*10)%2===0;
      item(b,'sphere',place(0,0,0),[1.1,.73,1.8],inv?color.white:color.hull,0,q,3);
      item(b,'sphere',place(0,.5,.55),[.86,.68,1.13],[.065,.35,.42],0,q,4);
      for(const side of [-1,1]){
        item(b,'box',place(side*1.2,-.04,-.2),[.7,.12,.5],[.16,.24,.25],0,q,3);
        item(b,'sphere',place(side*1.52,-.08,-.35),[.48,.47,1.26],color.white,0,q,3);
        const axis=place(side*1.52,-.08,-1.45);item(b,'sphere',axis,[.36,.36,.13],[.025,.075,.095],0,q,3);
        item(b,'sphere',place(side*1.52,-.08,-1.57),[.25,.25,.1],color.cyan,1.6,q);
        item(b,'sphere',place(side*1.52,-.08,-(p.boost>0?3.4:2.25)),[.18,.18,p.boost>0?1.8:.72],color.cyan,.95,q);
        const front=place(side*.69,.15,1.4);item(b,'sphere',front,[.14,.14,.15],color.gold,1.1,q);
        for(let j=0;j<3;j++)item(b,'box',place(side*1.52,.25,-.7+j*.45),[.43,.028,.045],[.16,.22,.24],0,q,3);
      }
      item(b,'box',place(0,.92,-1),[.09,.68,.38],color.enemy,0,q,3);item(b,'sphere',place(0,.25,-1.55),[.34,.18,.25],[.1,.19,.2],0,q,3);
      beam(b,place(-.72,.7,.05),place(-.6,.78,.95),.035,color.hull,0,3);beam(b,place(.72,.7,.05),place(.6,.78,.95),.035,color.hull,0,3);
    }
    buildDynamic(game,time,motion){
      const b=this.dynamic||group(),p=game.player,t=motion?time:0;for(const type of TYPES)b[type].length=0;this.ship(b,p,t,motion);
      for(const e of game.enemies){const size=e.type===3?3.2:1,c=e.hit>0?color.white:e.type===2?[.94,.52,.23]:e.type===3?[.85,.21,.4]:color.enemy,q=rotation(e.yaw,e.pitch);item(b,'sphere',[e.x,e.y,e.z],[.72*size,.7*size,(e.type===1?1.8:1.4)*size],c,.06,q,2);item(b,'sphere',[e.x,e.y+.3*size,e.z],[.28*size,.3*size,.45*size],color.gold,.12,q,2);
        for(let j=0;j<(e.type===3?8:5);j++){const a=j*2.4;let last=[e.x+Math.cos(a)*size*.55,e.y+Math.sin(a)*size*.5,e.z];for(let k=1;k<=4;k++){const v=rotate([Math.cos(a)*(.6+k*.16)*size+Math.sin(t*3+j+k)*.2,Math.sin(a)*(.5+k*.12)*size,-k*.9*size],q),at=[e.x+v[0],e.y+v[1],e.z+v[2]];beam(b,last,at,.036*size,c,.08,2);last=at;}}
        if(e.state===1)beam(b,[e.x,e.y,e.z],[e.x+e.dx*24,e.y+e.dy*24,e.z+e.dz*24],.1,color.gold,1.5,0);
      }
      for(const s of game.bullets){const yaw=Math.atan2(s.vx,s.vz),pitch=Math.atan2(s.vy,Math.hypot(s.vx,s.vz)),q=rotation(yaw,pitch);item(b,'sphere',[s.x,s.y,s.z],s.enemy?[.26,.26,.6]:[.13,.13,1.2],s.enemy?color.enemy:color.cyan,1.6,q);}
      for(const r of game.rescue){if(r.saved)continue;const bob=motion?Math.sin(t*1.2+r.id)*.18:0;item(b,'sphere',[r.x,r.y+bob,r.z],[1.2,1.6,1.2],color.violet,.1,rotation(.4),2);item(b,'sphere',[r.x+.95,r.y+1.15+bob,r.z],[.61,.8,.62],color.violet,.08,rotation(.3),2);ring(b,r.x,r.y,r.z,3.1,color.cyan,true,.45);for(let j=0;j<3;j++){const a=t*.35+j*2.094;item(b,'sphere',[r.x+Math.sin(a)*3.3,r.y+Math.cos(a)*2.4,r.z],[.12,.12,.12],color.gold,1.1);}}
      const f=forward(p.yaw,p.pitch),right=[Math.cos(p.yaw),0,-Math.sin(p.yaw)];for(let i=0;i<Math.min(3,game.saved);i++){const pos=[p.x-f[0]*4+right[0]*(i-1)*1.5,p.y-f[1]*4+.4,p.z-f[2]*4+right[2]*(i-1)*1.5];item(b,'sphere',pos,[.39,.55,.39],color.violet,.12,rotation(p.yaw),2);}
      for(const d of game.drops)item(b,'sphere',[d.x,d.y,d.z],[.38,.38,.38],d.type==='heal'?color.cyan:color.gold,.9);
      if(game.gate){for(let i=0;i<3;i++)ring(b,game.exit.x,game.exit.y,game.exit.z-i*.7,6-i*.45,color.cyan,true,1.25);}
      for(const e of this.effects){const progress=e.t/e.life;if(e.type==='shot')continue;const r=progress*(e.type==='pulse'?e.value:e.type==='bossDown'?18:5);ring(b,e.x,e.y,e.z,r,e.type==='kill'?color.gold:color.cyan,true,1-progress,rotation(t*.2),.07);if(e.type==='pulse')ring(b,e.x,e.y,e.z,r,color.cyan,false,1-progress);}
      this.dynamic=b;
    }
    drawGroup(batch,buffers,dynamic){
      const gl=this.gl,l=this.main.loc,streams=dynamic?this.dynamicStreams:this.staticStreams;
      for(const type of TYPES)streams[type].reset();
      for(const type of TYPES){const a=batch[type],history=dynamic?null:this.staticDetail?.[type];for(let i=0;i<a.length;i+=STRIDE){const r=bounds(type,a,i);this.stats.sourceInstances++;this.stats.sourceTriangles+=this.meshes[type].count/3;if(!inFrustum(this.planes,a[i],a[i+1],a[i+2],r)){this.stats.culledInstances++;continue;}
        const depth=this.vp[3]*a[i]+this.vp[7]*a[i+1]+this.vp[11]*a[i+2]+this.vp[15],factor=(this.pixelFocal||600)/Math.max(.1,depth),selected=detailMesh(type,2*r*factor,2*Math.max(a[i+3],a[i+5])*factor,history?.[i/STRIDE]);if(history)history[i/STRIDE]=selected;if(selected!==type)this.stats.lodInstances++;streams[selected].append(a,i);
      }}
      for(const type of TYPES){const stream=streams[type],count=stream.count;if(!count){stream.previous=0;continue;}const m=this.meshes[type],a=stream.data;
        for(const [name,buffer]of [['aP',m.pb],['aN',m.nb]]){gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(l[name]);gl.vertexAttribPointer(l[name],3,gl.FLOAT,false,0,0);if(this.ext)this.ext.vertexAttribDivisorANGLE(l[name],0);}
        const attrs=[['aPos',3,0],['aScale',3,3],['aQ',4,6],['aColor',3,10],['aExtra',2,13]];
        if(this.ext){gl.bindBuffer(gl.ARRAY_BUFFER,buffers[type]);let resized=false;if(stream.gpuBytes<a.byteLength){gl.bufferData(gl.ARRAY_BUFFER,a.byteLength,gl.DYNAMIC_DRAW);stream.gpuBytes=a.byteLength;this.stats.bufferAllocations++;resized=true;}if(dynamic||resized||stream.changed||count!==stream.previous){const used=a.subarray(0,count*STRIDE);gl.bufferSubData(gl.ARRAY_BUFFER,0,used);this.stats.uploadedBytes+=used.byteLength;}
          for(const [name,size,offset]of attrs){gl.enableVertexAttribArray(l[name]);gl.vertexAttribPointer(l[name],size,gl.FLOAT,false,STRIDE*4,offset*4);this.ext.vertexAttribDivisorANGLE(l[name],1);}this.ext.drawArraysInstancedANGLE(gl.TRIANGLES,0,m.count,count);this.stats.draws++;
        }else{for(const [name]of attrs)gl.disableVertexAttribArray(l[name]);for(let i=0;i<count*STRIDE;i+=STRIDE){gl.vertexAttrib3f(l.aPos,a[i],a[i+1],a[i+2]);gl.vertexAttrib3f(l.aScale,a[i+3],a[i+4],a[i+5]);gl.vertexAttrib4f(l.aQ,a[i+6],a[i+7],a[i+8],a[i+9]);gl.vertexAttrib3f(l.aColor,a[i+10],a[i+11],a[i+12]);gl.vertexAttrib2f(l.aExtra,a[i+13],a[i+14]);gl.drawArrays(gl.TRIANGLES,0,m.count);this.stats.draws++;}}
        stream.previous=count;this.stats.instances+=count;this.stats.triangles+=count*m.count/3;
      }
    }
    quadPass(program){const gl=this.gl;this.resetAttributes();gl.useProgram(program.p);gl.bindBuffer(gl.ARRAY_BUFFER,this.quad);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);}
    project(x,y,z){const m=this.vp,raw=m[3]*x+m[7]*y+m[11]*z+m[15],w=Math.abs(raw)<.0001?(raw<0?-.0001:.0001):raw;return {x:((m[0]*x+m[4]*y+m[8]*z+m[12])/w*.5+.5)*this.width,y:(.5-(m[1]*x+m[5]*y+m[9]*z+m[13])/w*.5)*this.height,w};}
    draw(game,dt,settings,home=false){
      const quality=this.ext?settings.quality:'low';this.resize(quality);if(this.lost||this.fatal)return;const gl=this.gl;if(this.sector!==game.sector||this.seed!==game.seed||this.quality!==quality)this.load(game,quality);
      const motion=settings.motion;if(motion)this.elapsed+=Math.min(dt,.05);for(const e of this.effects)e.t+=dt;this.effects=this.effects.filter(e=>e.t<e.life);if(!motion)this.effects=[];
      const p=game.player,portrait=this.width<this.height,pose=cameraPose(p,game.obstacles,portrait),desired=pose.eye;if(!this.camera||this.justLoaded){this.camera=desired;this.justLoaded=false;}else{const ease=1-Math.exp(-Math.max(.016,dt)*(motion?12:40));this.camera=this.camera.map((v,i)=>v+(desired[i]-v)*ease);}
      // Check the interpolated camera too: smoothing must not pass through a rice wall.
      const origin={x:p.x,y:p.y+.4,z:p.z};for(const o of game.obstacles){const hit=segmentObstacle(origin,{x:this.camera[0],y:this.camera[1],z:this.camera[2]},o,.3);if(hit!==null){this.camera=desired;break;}}
      this.vp=multiply(perspective((portrait?72:65)*Math.PI/180,this.width/this.height,.18,340),lookAt(this.camera,pose.at));this.planes=frustum(this.vp);this.pixelFocal=this.height/(2*Math.tan((portrait?72:65)*Math.PI/360));this.buildDynamic(game,this.elapsed,motion);for(const key of ['instances','triangles','draws','sourceInstances','sourceTriangles','culledInstances','lodInstances','uploadedBytes','bufferAllocations'])this.stats[key]=0;this.stats.renderScale=this.ratio;this.stats.adaptiveScale=this.budget.scale;this.stats.pixels=this.canvas.width*this.canvas.height;
      const post=quality!=='low'&&this.targets?.scene.ok&&this.targets?.small.ok&&this.targets?.blurred.ok,bg=SECTORS[game.sector].tint;gl.bindFramebuffer(gl.FRAMEBUFFER,post?this.targets.scene.fbo:null);gl.viewport(0,0,this.canvas.width,this.canvas.height);gl.clearColor(...bg,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);this.quadPass(this.sky);gl.uniform1f(this.sky.loc.uTime,motion?this.elapsed:0);gl.uniform3fv(this.sky.loc.uFog,bg);gl.drawArrays(gl.TRIANGLES,0,6);
      this.resetAttributes();gl.enable(gl.DEPTH_TEST);gl.useProgram(this.main.p);const l=this.main.loc;gl.uniformMatrix4fv(l.uVP,false,this.vp);gl.uniform3fv(l.uEye,this.camera);gl.uniform3fv(l.uFog,bg);gl.uniform1f(l.uTime,motion?this.elapsed%1024:0);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.pores);gl.uniform1i(l.uPores,0);this.drawGroup(this.static,this.staticBuffers,false);this.drawGroup(this.dynamic,this.dynamicBuffers,true);
      this.resetAttributes();gl.useProgram(this.particles.p);const pl=this.particles.loc;gl.bindBuffer(gl.ARRAY_BUFFER,this.snow);for(const [name,size,offset]of [['aP',3,0],['aColor',3,3],['aExtra',2,6]]){gl.enableVertexAttribArray(pl[name]);gl.vertexAttribPointer(pl[name],size,gl.FLOAT,false,32,offset*4);}gl.uniformMatrix4fv(pl.uVP,false,this.vp);gl.uniform1f(pl.uTime,motion?this.elapsed%1024:0);gl.uniform1f(pl.uRatio,this.ratio);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE);gl.depthMask(false);gl.drawArrays(gl.POINTS,0,quality==='low'?120:this.snowCount);gl.depthMask(true);gl.disable(gl.BLEND);
      if(post){const a=this.targets.scene,b=this.targets.small,c=this.targets.blurred;gl.disable(gl.DEPTH_TEST);gl.bindFramebuffer(gl.FRAMEBUFFER,b.fbo);gl.viewport(0,0,b.width,b.height);this.quadPass(this.bloom);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,a.tex);gl.uniform1i(this.bloom.loc.uScene,0);gl.uniform2f(this.bloom.loc.uPixel,1/a.width,1/a.height);gl.drawArrays(gl.TRIANGLES,0,6);
        gl.bindFramebuffer(gl.FRAMEBUFFER,c.fbo);this.quadPass(this.blur);gl.bindTexture(gl.TEXTURE_2D,b.tex);gl.uniform1i(this.blur.loc.uBloom,0);gl.uniform2f(this.blur.loc.uPixel,1/b.width,1/b.height);gl.drawArrays(gl.TRIANGLES,0,6);
        gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,a.width,a.height);this.quadPass(this.compose);gl.bindTexture(gl.TEXTURE_2D,a.tex);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,c.tex);gl.uniform1i(this.compose.loc.uScene,0);gl.uniform1i(this.compose.loc.uBloom,1);gl.drawArrays(gl.TRIANGLES,0,6);}

      this.drawOverlay(game,settings,home);
    }
    drawOverlay(game,settings,home){
      const ctx=this.ctx,w=this.width,h=this.height;ctx.clearRect(0,0,w,h);if(home)return;const p=game.player,f=forward(p.yaw,p.pitch),aim=this.project(p.x+f[0]*30,p.y+f[1]*30,p.z+f[2]*30);
      ctx.strokeStyle='rgba(179,248,244,.5)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(aim.x,aim.y,6,0,Math.PI*2);ctx.moveTo(aim.x-12,aim.y);ctx.lineTo(aim.x-8,aim.y);ctx.moveTo(aim.x+8,aim.y);ctx.lineTo(aim.x+12,aim.y);ctx.stroke();
      const target=game.target();if(target){const pt=this.project(target.x,target.y,target.z),r=target.type===3?40:23;ctx.strokeStyle='#95fff8';ctx.lineWidth=1.4;for(let i=0;i<4;i++){ctx.beginPath();ctx.arc(pt.x,pt.y,r,i*Math.PI/2+.1,i*Math.PI/2+.65);ctx.stroke();}ctx.fillStyle='#25404a';ctx.fillRect(pt.x-24,pt.y-r-11,48,3);ctx.fillStyle='#ffad8c';ctx.fillRect(pt.x-24,pt.y-r-11,48*target.hp/target.maxHp,3);}
      const objective=game.objective(),pt=this.project(objective.x,objective.y,objective.z),pad=w<600?34:62,top=Math.min(155,h*.27),bottom=Math.max(top+50,h-(w<600?210:125)),on=pt.w>0&&pt.x>=pad&&pt.x<=w-pad&&pt.y>=top&&pt.y<=bottom;
      let x=pt.x,y=pt.y,angle=0;if(!on){const sign=pt.w<0?-1:1,dx=(pt.x-w/2)*sign,dy=(pt.y-h/2)*sign,k=Math.min((w/2-pad)/Math.max(.001,Math.abs(dx)),(bottom-top)/2/Math.max(.001,Math.abs(dy)));angle=Math.atan2(dy,dx);x=w/2+dx*k;y=(top+bottom)/2+dy*k;}
      ctx.strokeStyle=objective.kind==='boss'?'#ffa487':'#c5ffff';ctx.fillStyle=ctx.strokeStyle;ctx.save();ctx.translate(x,y);if(on){ctx.rotate(Math.PI/4);ctx.strokeRect(-6,-6,12,12);}else{ctx.rotate(angle);ctx.beginPath();ctx.moveTo(9,0);ctx.lineTo(-5,-5);ctx.lineTo(-5,5);ctx.closePath();ctx.fill();}ctx.restore();ctx.font='12px ui-monospace, monospace';ctx.textAlign='center';const height=objective.y-p.y,vertical=Math.abs(height)>5?(height>0?' ↑ 上方':' ↓ 下方'):'';ctx.fillText(`${objective.title}${vertical} · ${Math.round(ShuboCore.dist(p,objective))}`,clamp(x,90,w-90),y+26);
      for(const r of game.rescue)if(!r.saved&&r.progress>0){const pt=this.project(r.x,r.y+2,r.z);if(pt.w>0){ctx.strokeStyle='#b2ffff';ctx.lineWidth=3;ctx.beginPath();ctx.arc(pt.x,pt.y,27,-Math.PI/2,-Math.PI/2+r.progress/.75*Math.PI*2);ctx.stroke();}}
      const size=w<600?67:87,cx=w-(w<600?53:73),cy=w<600?160:180,scale=size/110;ctx.fillStyle='rgba(2,14,24,.45)';ctx.beginPath();ctx.arc(cx,cy,size/2+5,0,Math.PI*2);ctx.fill();ctx.strokeStyle='rgba(155,229,235,.3)';ctx.lineWidth=1;ctx.stroke();
      const dot=(e,c,r)=>{const dx=e.x-p.x,dz=e.z-p.z,right=dx*Math.cos(p.yaw)-dz*Math.sin(p.yaw),front=dx*Math.sin(p.yaw)+dz*Math.cos(p.yaw),length=Math.hypot(right,front),fac=Math.min(1,50/Math.max(1,length));ctx.fillStyle=c;ctx.beginPath();ctx.arc(cx+right*scale*fac,cy-front*scale*fac,r,0,Math.PI*2);ctx.fill();};for(const e of game.enemies)dot(e,'#ff977e',2);for(const r of game.rescue)if(!r.saved)dot(r,'#d4b8ff',2.5);if(game.gate)dot(game.exit,'#a4fff8',3);ctx.fillStyle='#effff8';ctx.beginPath();ctx.moveTo(cx,cy-4);ctx.lineTo(cx-3,cy+3);ctx.lineTo(cx+3,cy+3);ctx.fill();
      if(p.boost>0&&settings.motion){ctx.strokeStyle='rgba(129,237,249,.23)';for(let i=0;i<18;i++){const a=i/18*Math.PI*2,r=Math.min(w,h)*.4;ctx.beginPath();ctx.moveTo(aim.x+Math.cos(a)*r,aim.y+Math.sin(a)*r);ctx.lineTo(aim.x+Math.cos(a)*r*1.5,aim.y+Math.sin(a)*r*1.5);ctx.stroke();}}
    }
  }
  return {Renderer,mesh,scenery,multiply,perspective,lookAt,cameraPose,poreTexture,frustum,bounds,inFrustum,detailMesh,InstanceStream,ResolutionBudget,group,item,beam,ring,STRIDE,TYPES,vs,fs,screenVS,skyFS,bloomFS,blurFS,composeFS,particleVS,particleFS};
})();
globalThis.ShuboRender=ShuboRender;
