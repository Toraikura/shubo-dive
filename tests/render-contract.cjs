// WebGL API/state contract only. The mock does not compile shaders or render pixels.
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.join(__dirname,'..');let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;};
function surface({instancing=true,highp=true,compile=true,available=true,framebuffer=true}={}){
  let uid=0,boundBuffer=null,program=null,active=0,fbo=null;
  const live={Buffer:new Set(),Texture:new Set(),Framebuffer:new Set(),Renderbuffer:new Set()},attributes=new Map(),bindings=new Map(),sources=[],calls=[];
  const gl={};let constant=100;for(const key of ['ARRAY_BUFFER','STATIC_DRAW','DYNAMIC_DRAW','VERTEX_SHADER','FRAGMENT_SHADER','HIGH_FLOAT','COMPILE_STATUS','LINK_STATUS','TEXTURE_2D','RGBA','UNSIGNED_BYTE','TEXTURE_WRAP_S','TEXTURE_WRAP_T','REPEAT','TEXTURE_MIN_FILTER','TEXTURE_MAG_FILTER','LINEAR_MIPMAP_LINEAR','LINEAR','DEPTH_TEST','CULL_FACE','FRAMEBUFFER','COLOR_ATTACHMENT0','RENDERBUFFER','DEPTH_COMPONENT16','DEPTH_ATTACHMENT','CLAMP_TO_EDGE','FRAMEBUFFER_COMPLETE','COLOR_BUFFER_BIT','DEPTH_BUFFER_BIT','BLEND','FLOAT','TRIANGLES','POINTS','SRC_ALPHA','ONE','TEXTURE0','TEXTURE1'])gl[key]=constant++;active=gl.TEXTURE0;
  for(const kind of Object.keys(live)){gl['create'+kind]=()=>{const object={id:++uid,kind,bytes:0};live[kind].add(object);return object;};gl['delete'+kind]=object=>live[kind].delete(object);}
  const attrib=i=>{if(!attributes.has(i))attributes.set(i,{enabled:false,divisor:0});return attributes.get(i);};
  function draw(mode,first,count,instances=1){
    ok(Boolean(program),'program bound');for(const [id,a]of attributes)if(a.enabled){ok(Boolean(a.buffer),'attribute buffer bound');const last=a.divisor?Math.floor((instances-1)/a.divisor):first+count-1,needed=a.offset+last*(a.stride||a.size*4)+a.size*4;ok(needed<=a.buffer.bytes,`attribute ${id} buffer bounds: ${needed}/${a.buffer.bytes}`);}
    if(fbo)for(const shader of program.shaders)for(const match of shader.source.matchAll(/uniform sampler2D ([^;]+);/g))for(const name of match[1].split(',')){const texture=bindings.get(gl.TEXTURE0+(program.uniforms.get(name.trim())||0));ok(texture!==fbo.texture,'no render/texture feedback loop');}calls.push({mode,count,instances,fbo});
  }
  Object.assign(gl,{
    getExtension:()=>instancing?{vertexAttribDivisorANGLE:(i,n)=>{attrib(i).divisor=n;},drawArraysInstancedANGLE:draw}:null,
    getShaderPrecisionFormat:()=>({precision:highp?23:0}),createShader:type=>({type}),shaderSource:(s,source)=>{s.source=source;sources.push(source);},compileShader(){},getShaderParameter:()=>compile,getShaderInfoLog:()=> 'mock compile failure',deleteShader(){},
    createProgram:()=>({id:++uid,attrs:new Map(),uniforms:new Map(),shaders:[]}),attachShader:(p,s)=>p.shaders.push(s),bindAttribLocation:(p,i,name)=>p.attrs.set(name,i),linkProgram(){},getProgramParameter:()=>true,getProgramInfoLog:()=>'',getAttribLocation:(p,name)=>{if(!p.attrs.has(name)){let n=0;while([...p.attrs.values()].includes(n))n++;p.attrs.set(name,n);}return p.attrs.get(name);},getUniformLocation:(p,name)=>({p,name}),useProgram:p=>{program=p;},
    bindBuffer:(target,b)=>{boundBuffer=b;},bufferData:(target,data)=>{ok(Boolean(boundBuffer),'upload bound buffer');boundBuffer.bytes=typeof data==='number'?data:data.byteLength;},
    bufferSubData:(target,offset,data)=>{ok(boundBuffer&&offset+data.byteLength<=boundBuffer.bytes,'subdata within allocated capacity');},bindTexture:(target,t)=>bindings.set(active,t),activeTexture:i=>{active=i;},texImage2D(){},texParameteri(){},generateMipmap(){},bindFramebuffer:(target,f)=>{fbo=f;},framebufferTexture2D:(target,attachment,textarget,t)=>{fbo.texture=t;},bindRenderbuffer(){},renderbufferStorage(){},framebufferRenderbuffer(){},checkFramebufferStatus:()=>framebuffer?gl.FRAMEBUFFER_COMPLETE:0,
    enableVertexAttribArray:i=>{attrib(i).enabled=true;},disableVertexAttribArray:i=>{attrib(i).enabled=false;},vertexAttribPointer:(i,size,type,normalized,stride,offset)=>Object.assign(attrib(i),{buffer:boundBuffer,size,stride,offset}),
    vertexAttrib2fv(){},vertexAttrib3fv(){},vertexAttrib4fv(){},vertexAttrib2f(){},vertexAttrib3f(){},vertexAttrib4f(){},uniform1f(){},uniform1i:(loc,value)=>loc.p.uniforms.set(loc.name,value),uniform2f(){},uniform3fv(){},uniformMatrix4fv:(loc,transpose,value)=>{ok(!transpose&&value.length===16&&[...value].every(Number.isFinite),'finite matrix uniform');},enable(){},disable(){},depthMask(){},blendFunc(){},viewport(){},clearColor(){},clear(){},drawArrays:draw
  });
  const listeners={},canvas={width:1,height:1,getContext:type=>type==='webgl'&&available?gl:null,addEventListener:(name,cb)=>listeners[name]=cb};
  const ctx=new Proxy({}, {get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)}),overlay={getContext:()=>ctx};
  const sandbox={console,Float32Array,Uint8Array,Math,Number,JSON,Set,innerWidth:390,innerHeight:844,devicePixelRatio:3};vm.createContext(sandbox);for(const file of ['core','renderer'])vm.runInContext(fs.readFileSync(path.join(root,'src',file+'.js'),'utf8'),sandbox);
  const renderer=new sandbox.ShuboRender.Renderer(canvas,overlay);return {renderer,sandbox,gl,canvas,live,listeners,sources,calls};
}
const cases=[];
for(const opts of [{},{instancing:false},{highp:false},{framebuffer:false}]){
  const m=surface(opts),r=m.renderer,g=new m.sandbox.ShuboCore.Game(941);ok(!r.fatal,'WebGL construction succeeds');
  // Exclude unbound legacy texture slots in the mock; WebGL defaults to TEXTURE0.
  const settings={quality:'balanced',motion:true};r.draw(g,1/60,settings);ok(r.stats.mode.startsWith('webgl-'),'all available paths remain 3D');ok(m.canvas.width*m.canvas.height<=1800000,'pixel budget');ok(r.stats.triangles>1000,'volume meshes submitted');
  const staticArrays=Object.values(r.staticStreams).map(s=>s.data);r.draw(g,1/60,settings);ok(r.stats.bufferAllocations===0,'stable draw reuses GPU capacities');ok(staticArrays.every((a,i)=>a===Object.values(r.staticStreams)[i].data),'stable draw reuses typed arrays');const count=()=>Object.fromEntries(Object.entries(m.live).map(([k,set])=>[k,set.size])),before=count();for(let i=0;i<4;i++){m.sandbox.innerWidth=i%2?1440:390;m.sandbox.innerHeight=i%2?900:844;r.draw(g,1/30,settings);}ok(JSON.stringify(before)===JSON.stringify(count()),'resize replaces resources without growth');
  r.draw(g,1/30,{quality:'low',motion:false});ok(r.stats.triangles<130000,'low quality geometry bounded');ok(r.targets===null&&m.live.Framebuffer.size===0,'low quality releases unused offscreen targets');
  if(opts.highp===false)ok(m.sources.every(s=>!s.includes('highp')),'mediump fallback sources');
  let lost=false,restored=false;r.onLost=()=>lost=true;r.onRestored=()=>restored=true;m.listeners.webglcontextlost({preventDefault(){}});ok(lost&&r.lost,'context loss pauses callback');m.listeners.webglcontextrestored();ok(restored&&!r.lost&&!r.fatal,'restore reinitializes contract');r.draw(g,1/60,settings);
  cases.push({options:opts,mode:r.stats.mode,submittedTriangles:r.stats.triangles,sceneDrawCalls:r.stats.draws,resources:before});
}
const unavailable=surface({available:false});ok(unavailable.renderer.fatal&&unavailable.renderer.lost,'WebGL unavailable is explicit');const failed=surface({compile:false});ok(failed.renderer.fatal&&failed.renderer.error.includes('Shader'),'compile failure is explicit');
const report={checks,cases,scope:'Mocked WebGL API state, typed buffer bounds, resource counts and callbacks. No actual shader compilation, rasterization, GPU, browser or device validation.'};fs.writeFileSync(path.join(root,'docs/render-contract-verification.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
