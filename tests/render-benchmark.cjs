'use strict';
// CPU-only renderer comparison. No browser, WebGL implementation, or GPU is used.
// Renderer API calls are sent to an explicit no-op command sink for counting.
// Synthetic render fixtures are not playthroughs and make no FPS claim.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),os=require('node:os'),crypto=require('node:crypto');
const {performance}=require('node:perf_hooks');
const BASE=path.join(__dirname,'..'),{execFileSync}=require('node:child_process'),baseline='2010fee';
const args=process.argv.slice(2);const option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const useBaseline=args.includes('--baseline'),target=useBaseline?'git:'+baseline+':src/renderer.js':path.resolve(option('--renderer',path.join(BASE,'src/renderer.js')));
const label=option('--label',useBaseline?'baseline':'optimized');const out=path.resolve(option('--out',path.join(BASE,'docs','render-benchmark-'+label+'.json')));
const warmup=Number(option('--warmup','20')),samples=Number(option('--samples','7')),iterations=Number(option('--iterations','30'));
const baselinePath='git:'+baseline+':src/core.js';
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const old=file=>execFileSync('git',['show',baseline+':src/'+file],{cwd:BASE,encoding:'utf8'}),coreCode=old('core.js'),renderCode=useBaseline?old('renderer.js'):fs.readFileSync(target,'utf8');
function sink(){
  let constant=1000,handle=0;const constants=new Map(),counts={drawCalls:0,triangleInstances:0,pointVertices:0,instancedMeshTriangles:0,instancedMeshInstances:0,instancedMeshDraws:0,fullscreenTriangles:0,bufferUploadBytes:0,bufferAllocatedBytes:0,bufferDataCalls:0,bufferSubDataCalls:0};
  const reset=()=>{for(const k in counts)counts[k]=0;};
  let gl;const submission=(mode,vertices,instances=1)=>{counts.drawCalls++;if(mode===gl.TRIANGLES)counts.triangleInstances+=vertices/3*instances;if(mode===gl.POINTS)counts.pointVertices+=vertices*instances;};
  const ext={vertexAttribDivisorANGLE(){},drawArraysInstancedANGLE(mode,first,count,instances){submission(mode,count,instances);counts.instancedMeshDraws++;counts.instancedMeshInstances+=instances;counts.instancedMeshTriangles+=count/3*instances;},drawElementsInstancedANGLE(mode,count,type,offset,instances){submission(mode,count,instances);counts.instancedMeshDraws++;counts.instancedMeshInstances+=instances;counts.instancedMeshTriangles+=count/3*instances;}};
  const api={getExtension:name=>name==='ANGLE_instanced_arrays'?ext:null,getShaderPrecisionFormat:()=>({precision:23}),getShaderParameter:()=>true,getProgramParameter:()=>true,getShaderInfoLog:()=>'',getProgramInfoLog:()=>'',getAttribLocation:(p,name)=>['aP','aN','aPos','aScale','aQ','aColor','aExtra'].indexOf(name),getUniformLocation:(p,name)=>name,checkFramebufferStatus:()=>gl.FRAMEBUFFER_COMPLETE,bufferData(target,data){counts.bufferDataCalls++;const bytes=typeof data==='number'?data:data?.byteLength||0;counts.bufferAllocatedBytes+=bytes;if(typeof data!=='number')counts.bufferUploadBytes+=bytes;},bufferSubData(target,offset,data){counts.bufferSubDataCalls++;counts.bufferUploadBytes+=data?.byteLength||0;},drawArrays(mode,first,count){submission(mode,count);if(mode===gl.TRIANGLES&&count===6)counts.fullscreenTriangles+=2;},drawElements(mode,count){submission(mode,count);}};
  const noopNames='shaderSource compileShader attachShader bindAttribLocation linkProgram deleteShader bindBuffer bindTexture texImage2D texParameteri generateMipmap enable disable disableVertexAttribArray enableVertexAttribArray vertexAttribPointer bindFramebuffer framebufferTexture2D bindRenderbuffer renderbufferStorage framebufferRenderbuffer deleteTexture deleteFramebuffer deleteRenderbuffer useProgram uniformMatrix4fv uniform3fv uniform1f uniform1i uniform2f activeTexture viewport clearColor clear blendFunc depthMask vertexAttrib2fv vertexAttrib3fv vertexAttrib4fv vertexAttrib2f vertexAttrib3f vertexAttrib4f'.split(' ');
  for(const name of noopNames)api[name]=()=>{};
  for(const name of ['createShader','createProgram','createBuffer','createTexture','createFramebuffer','createRenderbuffer'])api[name]=()=>({cpuSinkResource:++handle});
  gl=new Proxy(api,{get(obj,key){if(key in obj)return obj[key];if(typeof key==='string'&&/^[A-Z][A-Z_0-9]+$/.test(key)){if(!constants.has(key))constants.set(key,constant++);return constants.get(key);}throw new Error(`CPU sink has no method ${String(key)}; update explicitly before measuring.`);}});
  return {gl,counts,reset};
}
const commandSink=sink(),ctx2d={clearRect(){}};
const canvas={width:1,height:1,getContext(name){if(name!=='webgl')throw new Error(`Unexpected context ${name}`);return commandSink.gl;},addEventListener(){}};
const overlay={width:1,height:1,getContext(name){if(name!=='2d')throw new Error(`Unexpected overlay context ${name}`);return ctx2d;}};
const sandbox={console,performance,innerWidth:390,innerHeight:844,devicePixelRatio:2};vm.createContext(sandbox);vm.runInContext(coreCode,sandbox,{filename:baselinePath});vm.runInContext(renderCode,sandbox,{filename:target});
const C=sandbox.ShuboCore,R=sandbox.ShuboRender,renderer=new R.Renderer(canvas,overlay);if(renderer.fatal)throw new Error(renderer.error);
const viewports=[{name:'portrait',width:390,height:844,dpr:2},{name:'landscape',width:1280,height:720,dpr:2}];
const poses=[
 {name:'start-forward',x:0,y:14,z:70,yaw:Math.PI,pitch:0},
 {name:'start-reverse',x:0,y:14,z:70,yaw:0,pitch:0},
 {name:'lower-look-up',x:8,y:-12,z:-24,yaw:Math.PI/2,pitch:1.05},
 {name:'upper-look-down',x:-6,y:46,z:-76,yaw:-Math.PI/2,pitch:-1.05},
 {name:'deep-forward',x:-6,y:34,z:-76,yaw:Math.PI,pitch:-.35},
 {name:'cross-canyon',x:4,y:4,z:-22,yaw:1.2,pitch:.3}
];
const profiles=[{name:'combat',enemies:6,bullets:24,drops:8,effects:6},{name:'limit-stress',enemies:12,bullets:96,drops:32,effects:24}];
function fixture(sector,pose,profile){
 const g=new C.Game(941,{},'normal');g.sector=sector;g.setWorld();Object.assign(g.player,pose,{boost:.4,roll:.15});g.saved=sector*3+1;g.rescue[0].saved=profile.name==='combat';
 g.enemies=Array.from({length:profile.enemies},(_,i)=>{const a=i*2.39996,r=14+(i%4)*14,type=sector===2&&i===profile.enemies-1?3:i%3;return {id:i+1,type,x:Math.sin(a)*r,y:-15+(i%5)*15,z:-22+Math.cos(a)*r,yaw:a+.4,pitch:(i%3-1)*.35,state:i%4===0?1:0,dx:Math.sin(a),dy:0,dz:Math.cos(a),hit:0,hp:type===3?260:40,maxHp:type===3?560:60,phase:type===3?2:1};});
 g.bullets=Array.from({length:profile.bullets},(_,i)=>{const a=i*2.39996,r=6+(i%11)*6;return {id:100+i,x:Math.sin(a)*r,y:-22+(i%8)*11,z:-24+Math.cos(a)*r,vx:Math.sin(a)*15,vy:(i%5-2)*3,vz:Math.cos(a)*15,enemy:i%3===0,life:2};});
 g.drops=Array.from({length:profile.drops},(_,i)=>({x:Math.sin(i*1.3)*36,y:-10+i%6*10,z:-24+Math.cos(i*1.3)*36,type:i%3===0?'heal':'energy',life:12}));
 const effects=Array.from({length:profile.effects},(_,i)=>({type:['kill','rescue','pulse','bossDown','shot'][i%5],x:Math.sin(i*1.7)*30,y:-8+i%5*11,z:-24+Math.cos(i*1.7)*30,t:.15+(i%3)*.05,life:i%5===2?.6:1.15,value:16}));
 return {g,effects};
}
function batchCounts(batch){let instances=0,triangles=0,byType={};for(const type of R.TYPES){const a=batch[type];if(!a)continue;const n=a.length/R.STRIDE;if(!Number.isInteger(n))throw new Error(`Non-integral instance count ${type}:${n}`);const mesh=renderer.meshes[type]||R.mesh(type);byType[type]={instances:n,triangles:n*mesh.count/3};instances+=n;triangles+=n*mesh.count/3;}return {instances,triangles,byType};}
const quantile=(v,q)=>{const s=[...v].sort((a,b)=>a-b);return s[Math.min(s.length-1,Math.floor(s.length*q))];};
const rows=[];const start=performance.now();
for(const quality of ['low','balanced','high'])for(let sector=0;sector<3;sector++)for(const profile of profiles)for(const pose of poses)for(const viewport of viewports){
 const {g,effects}=fixture(sector,pose,profile);sandbox.innerWidth=viewport.width;sandbox.innerHeight=viewport.height;sandbox.devicePixelRatio=viewport.dpr;
 const effectiveQuality=quality;renderer.resize(quality);if(renderer.sector!==sector||renderer.seed!==g.seed||renderer.quality!==effectiveQuality)renderer.load(g,effectiveQuality);
 renderer.camera=null;renderer.elapsed=12;renderer.effects=effects.map(e=>({...e}));commandSink.reset();renderer.draw(g,0,{quality,motion:true},true);
 const firstFrameSubmitted={...renderer.stats},firstFrameSinkCalls={...commandSink.counts};commandSink.reset();renderer.draw(g,0,{quality,motion:true},true);const submitted={...renderer.stats};const sinkCalls={...commandSink.counts};const staticGenerated=batchCounts(renderer.static),dynamicGenerated=batchCounts(renderer.dynamic);
 const camera={eye:[...renderer.camera],vp:Array.from(renderer.vp)};
 const generatedInstances=staticGenerated.instances+dynamicGenerated.instances,generatedTriangles=staticGenerated.triangles+dynamicGenerated.triangles;
 if(sinkCalls.instancedMeshTriangles!==submitted.triangles||sinkCalls.instancedMeshInstances!==submitted.instances||sinkCalls.instancedMeshDraws!==submitted.draws)throw new Error('GL-command sink and renderer submitted counts differ');
 if(Number.isFinite(submitted.sourceInstances)&&(submitted.sourceInstances!==generatedInstances||submitted.sourceTriangles!==generatedTriangles||submitted.sourceInstances-submitted.culledInstances!==submitted.instances))throw new Error('Source/culling accounting differs');
 if(Number.isFinite(submitted.uploadedBytes)&&submitted.uploadedBytes!==sinkCalls.bufferUploadBytes)throw new Error('Upload-byte accounting differs');
 // The camera setup, scenery, GL-call sink and counting are outside this interval.
 for(let i=0;i<warmup;i++)renderer.buildDynamic(g,12+(i%7)/60,true);
 const timings=[];for(let s=0;s<samples;s++){const t=performance.now();for(let i=0;i<iterations;i++)renderer.buildDynamic(g,12+(i%7)/60,true);timings.push((performance.now()-t)/iterations);}
 rows.push({caseId:[quality,sector+1,profile.name,pose.name,viewport.name].join('/'),quality,sector:sector+1,profile:profile.name,pose:{...pose},viewport:{...viewport},camera,staticGenerated,dynamicGenerated,generated:{instances:staticGenerated.instances+dynamicGenerated.instances,triangles:staticGenerated.triangles+dynamicGenerated.triangles},submitted,sinkCalls,firstFrameSubmitted,firstFrameSinkCalls,buildDynamicMs:{median:quantile(timings,.5),p90BatchMean:quantile(timings,.9),minBatchMean:Math.min(...timings),samples:timings},renderResolution:{width:renderer.canvas.width,height:renderer.canvas.height,ratio:renderer.ratio}});
}
const summary=[];for(const quality of ['low','balanced','high'])for(const profile of profiles){const rr=rows.filter(r=>r.quality===quality&&r.profile===profile.name);summary.push({quality,profile:profile.name,cases:rr.length,generatedTriangles:{min:Math.min(...rr.map(r=>r.generated.triangles)),max:Math.max(...rr.map(r=>r.generated.triangles))},submittedTriangles:{min:Math.min(...rr.map(r=>r.submitted.triangles)),max:Math.max(...rr.map(r=>r.submitted.triangles)),mean:rr.reduce((a,r)=>a+r.submitted.triangles,0)/rr.length},submittedInstances:{min:Math.min(...rr.map(r=>r.submitted.instances)),max:Math.max(...rr.map(r=>r.submitted.instances)),mean:rr.reduce((a,r)=>a+r.submitted.instances,0)/rr.length},buildDynamicMedianMs:quantile(rr.map(r=>r.buildDynamicMs.median),.5),buildDynamicP90OfCaseMediansMs:quantile(rr.map(r=>r.buildDynamicMs.median),.9)});}
const result={label,benchmarkSha256:hash(fs.readFileSync(__filename)),rendererPath:target,rendererSha256:hash(renderCode),frozenCorePath:baselinePath,frozenCoreSha256:hash(coreCode),node:process.version,platform:process.platform,arch:process.arch,cpu:os.cpus()[0]?.model,createdAt:new Date().toISOString(),method:{kind:'Node CPU code count and buildDynamic microbenchmark; not GPU or FPS',gpuUsed:false,browserUsed:false,fixtureSeed:941,profiles,viewportCount:viewports.length,poseCount:poses.length,sectors:3,qualities:3,caseCount:rows.length,warmup,samples,iterations,measurement:`Median of ${samples} batch means in ms/buildDynamic; load, camera, GL sink and counting excluded from timing. Geometry and uploads include first and steady identical-frame counters.`,timingCaveat:'Node JIT, GC, host load and measurement order affect results. Compare repeated paired runs; these times do not predict browser/GPU FPS.',submittedCaveat:'renderer.stats and explicit CPU command-sink counts only; no driver, GPU rasterization, visual check or framebuffer validation.',fixtureCaveat:'Synthetic deterministic render fixtures, including upper-limit stress; not a recorded normal gameplay distribution.'},durationSeconds:(performance.now()-start)/1000,summary,rows};
fs.writeFileSync(out,JSON.stringify(result,null,2));console.log(JSON.stringify({out,rendererSha256:result.rendererSha256,caseCount:rows.length,durationSeconds:result.durationSeconds,summary},null,2));
