/* ==========================================================================
   vch36 · js/06-world.js
   пропсы и коллизии, песочница, сцены карт, масштаб текстур
   Из index.html (4.2 «разбиение на модули»). Порядок загрузки задан в index.html
   тегами <script defer>; «use strict» сохранён — исходный код был модулем.
   ========================================================================== */
"use strict";


/* ============ VCH: пропсы, привязанные к земле, и точные по форме коллизии ============ */
const VCH_UP=new P(0,1,0);
/*
  Опорная плоскость по методу наименьших квадратов под (возможно повёрнутым)
  прямоугольным основанием. C выбирается по самой высокой выборке, чтобы ни один
  угол объекта не утонул.
 */
function VCH_groundPlane(x,z,hx,hz,yaw){
 const cs=Math.cos(yaw),sn=Math.sin(yaw),
       S=[[0,0]],pts=[];
 for(let ix=-2;ix<=2;ix++)for(let iz=-2;iz<=2;iz++)S.push([hx*ix/2,hz*iz/2]);
 let sxx=0,szz=0,sxh=0,szh=0;
 for(const [dx,dz] of S){
  const wx=dx*cs+dz*sn,wz=-dx*sn+dz*cs,h=ge(x+wx,z+wz);
  pts.push([wx,wz,h]),sxx+=wx*wx,szz+=wz*wz,sxh+=wx*h,szh+=wz*h;
 }
 const A=sxx>1e-6?sxh/sxx:0,B=szz>1e-6?szh/szz:0;
 let C=-1e9;for(const [wx,wz,h] of pts)C=Math.max(C,h-A*wx-B*wz);
 const n=new P(-A,1,-B).normalize();
 return {y:C,nx:n.x,ny:n.y,nz:n.z};
}
function VCH_bounds(o){
 o.position.set(0,0,0),o.quaternion.identity(),o.updateMatrixWorld(!0);
 const b=new Xe().setFromObject(o);
 return {hx:Math.max(.05,(b.max.x-b.min.x)*.5),hz:Math.max(.05,(b.max.z-b.min.z)*.5),bottom:-b.min.y};
}
function VCH_place(o,x,z,hx,hz,yaw,bottom){
 const p=VCH_groundPlane(x,z,hx,hz,yaw),
       qT=new gn().setFromUnitVectors(VCH_UP,new P(p.nx,p.ny,p.nz)),
       qY=new gn().setFromAxisAngle(VCH_UP,yaw);
 o.quaternion.copy(qT).multiply(qY),o.position.set(x,p.y+bottom*p.ny,z),o.updateMatrixWorld(!0);
}
/*
  После расстановки поднимаем весь пропс ровно на столько, на сколько его самый
  низкий реальный угол коллизии ушёл под рельеф: ничего не тонет и ничего
  заметно не висит.
 */
function VCH_settle(rec){
 const b=rec.body,q=b.quaternion,V=b.position.constructor;let mn=1e9;
 for(let k=0;k<b.shapes.length;k++){
  const sh=b.shapes[k],off=b.shapeOffsets[k],oq=b.shapeOrientations[k];let pts=[];
  if(sh.halfExtents){const h=sh.halfExtents;
   for(const sx of[-1,1])for(const sy of[-1,1])for(const sz of[-1,1])pts.push([sx*h.x,sy*h.y,sz*h.z]);}
  else if(sh.vertices)pts=sh.vertices.map(v=>[v.x,v.y,v.z]);
  for(const c of pts){
   const v=new V(c[0],c[1],c[2]);
   oq.vmult(v,v),v.x+=off.x,v.y+=off.y,v.z+=off.z,q.vmult(v,v),
   v.x+=b.position.x,v.y+=b.position.y,v.z+=b.position.z;
   const gap=v.y-ge(v.x,v.z);if(gap<mn)mn=gap;
  }
 }
 if(mn<.004){const d=.004-mn;b.position.y+=d,rec.mesh.position.y+=d,rec.groundY=rec.mesh.position.y}
 return mn;
}
/*
  Один бокс коллизии на видимый меш, с его точным локальным смещением, поворотом
  и размером. Поэтому группы сталкиваются именно с той формой, которую видно.
 */
function VCH_parts(root){
 root.updateMatrixWorld(!0);
 const inv=root.matrixWorld.clone().invert(),parts=[],p=new P(),q=new gn(),sc=new P();
 root.traverse(o=>{
  if(!o.isMesh||!o.geometry)return;
  const G=o.geometry;G.boundingBox||G.computeBoundingBox();
  const bb=G.boundingBox;if(!bb)return;
  const half=new P((bb.max.x-bb.min.x)*.5,(bb.max.y-bb.min.y)*.5,(bb.max.z-bb.min.z)*.5),
        ctr=new P((bb.max.x+bb.min.x)*.5,(bb.max.y+bb.min.y)*.5,(bb.max.z+bb.min.z)*.5),
        rel=inv.clone().multiply(o.matrixWorld);
  rel.decompose(p,q,sc);
  const off=ctr.multiply(sc).applyQuaternion(q).add(p),
        h=new P(half.x*Math.abs(sc.x),half.y*Math.abs(sc.y),half.z*Math.abs(sc.z));
  parts.push({off:off.clone(),half:h,quat:new gn().copy(q)});
 });
 return parts;
}
/* Точная выпуклая оболочка в виде треугольной призмы для меша трамплина, построенного через zf("x"). */
function VCH_wedge(g,v,p){
 const H=g/2,L=v/2,
       V=[new w(-H,0,-L),new w(-H,p,L),new w(-H,0,L),new w(H,0,-L),new w(H,p,L),new w(H,0,L)],
       C=new w;
 for(const q of V)C.vadd(q,C);C.scale(1/V.length,C);
 for(const q of V)q.vsub(C,q);
 const faces=[[0,1,2],[3,4,5],[0,3,5,2],[2,5,4,1],[0,1,4,3]];
 for(const f of faces){
  const A=V[f[0]],B=V[f[1]],D=V[f[2]],
        ab=new w(B.x-A.x,B.y-A.y,B.z-A.z),ac=new w(D.x-A.x,D.y-A.y,D.z-A.z),
        nn=ab.cross(ac,new w),fc=new w;
  for(const k of f)fc.vadd(V[k],fc);fc.scale(1/f.length,fc);
  nn.dot(fc)<0&&f.reverse();
 }
 return {shape:new Cr({vertices:V,faces}),offset:C};
}

function $w(r,t,e){
 const n=[],i=Yw(),s=Kw(),o=new fe({color:4079941,roughness:.8,metalness:.55}),a=Vf(4711);
 const add=(mesh,opt={},wedge=null)=>{
  const g=new Et({mass:0,type:Et.STATIC,position:new w(mesh.position.x,mesh.position.y,mesh.position.z),material:void 0,angularDamping:.4,linearDamping:.05});
  g.quaternion.set(mesh.quaternion.x,mesh.quaternion.y,mesh.quaternion.z,mesh.quaternion.w);
  if(wedge)g.addShape(wedge.shape,new w(wedge.offset.x,wedge.offset.y,wedge.offset.z));
  else for(const p of VCH_parts(mesh))g.addShape(new ns(new w(p.half.x,p.half.y,p.half.z)),new w(p.off.x,p.off.y,p.off.z),new Fe(p.quat.x,p.quat.y,p.quat.z,p.quat.w));
  g.collisionFilterGroup=wedge?VCH_RAMP:is,g.collisionFilterMask=7|VCH_RAMP,t.addBody(g);
  const rec={mesh,body:g,hp:opt.hp??1,destructible:opt.destructible!==!1,kind:opt.kind||"concrete",dynamic:!!opt.mass,alive:!0};
  return mesh.userData.prop=rec,n.push(rec),rec;
 };
 const put=(mesh,x,z,yaw,opt={},wedge=null)=>{
  const b=VCH_bounds(mesh);VCH_place(mesh,x,z,b.hx,b.hz,yaw,b.bottom),r.add(mesh);
  const rec=add(mesh,opt,wedge);rec.groundY=mesh.position.y;VCH_settle(rec);return rec;
 };
 const l=[];
 for(let u=0;u<26;u++){const f=a()*Math.PI*2,m=16+a()*72;l.push([Math.cos(f)*m,Math.sin(f)*m,a()])}
 for(const [u,f,m] of l){
  const p=1.6+m*1.4,g=1.1+m*.9,_=1.2+m*1.1,y=new Lt(new _e(p,g,_),i);
  y.castShadow=!0,y.receiveShadow=!0,put(y,u,f,m*3,{hp:2,kind:"concrete",destructible:!0});
 }
 for(let u=0;u<14;u++){
  const f=a()*Math.PI*2,m=22+a()*60,v=Math.cos(f)*m,p=Math.sin(f)*m,_=new Jt,
        x=new Lt(new _e(2.6,.5,.42),i);_.add(x);
  const y=x.clone();y.rotation.z=.9,y.position.y=.1,_.add(y),_.traverse(R=>{R.castShadow=!0,R.receiveShadow=!0});
  put(_,v,p,a()*3,{hp:1.6,kind:"concrete"});
 }
 for(let u=0;u<12;u++){
  const f=a()*Math.PI*2,m=20+a()*55,v=Math.cos(f)*m,p=Math.sin(f)*m,
        _=new Lt(new mn(.34,.34,.95,12),s);
  _.castShadow=!0,_.receiveShadow=!0,put(_,v,p,a()*3,{hp:2.4,kind:"barrel",destructible:!0,mass:90});
 }
 for(let u=0;u<9;u++){
  const f=a()*Math.PI*2,m=24+a()*62,v=Math.cos(f)*m,p=Math.sin(f)*m,_=new Jt,
        x=new Lt(new _e(1.9,.75,4.3),s);x.position.y=.62,_.add(x);
  const y=new Lt(new _e(1.7,.62,1.9),o);y.position.set(0,1.28,-.15),_.add(y);
  for(const [R,A] of [[-.9,1.4],[.9,1.4],[-.9,-1.4],[.9,-1.4]]){
   const T=new Lt(new mn(.36,.36,.26,10),o);T.rotation.z=Math.PI/2,T.position.set(R,.36,A),_.add(T);
  }
  _.traverse(R=>{R.castShadow=!0,R.receiveShadow=!0}),put(_,v,p,a()*6.28,{hp:2.2,kind:"car",destructible:!0});
 }
 const ramp=(u,f,m,v,p,g)=>{
  const y=[{at:-g/2,pts:[[0,-v/2],[p,v/2],[0,v/2]]},{at:g/2,pts:[[0,-v/2],[p,v/2],[0,v/2]]}],
        R=zf("x",y,{capStart:!0,capEnd:!0});R.computeVertexNormals();
  const A=new Lt(R,i);A.castShadow=!0,A.receiveShadow=!0;
  put(A,u,f,m,{hp:999,destructible:!1,kind:"ramp"},VCH_wedge(g,v,p));
 };
 ramp(0,16,0,9,1.1,6),ramp(-9,22,.35,10,1.9,6),ramp(10,24,-.3,11,2.8,6.5);
 for(let u=0;u<6;u++){
  const f=-19+u*2.2,m=9.8,p=1+u%2*.5,g=new _e(1.9,p,1.1),_=new Lt(g,i);
  _.castShadow=!0,_.receiveShadow=!0,put(_,f,m,0,{hp:2,kind:"concrete",destructible:!0});
 }
 for(let u=0;u<4;u++){
  const f=8+u*2.2,m=13-u*.6,p=new Jt;
  for(const g of [0,1.05,2.1]){const _=new Lt(new _e(2.4,.34,.34),o);_.rotation.z=g,p.add(_)}
  p.traverse(g=>{g.castShadow=!0,g.receiveShadow=!0}),put(p,f,m,u*.5,{hp:1.4,kind:"concrete"});
 }
 const d=jw();
 for(let u=0;u<7;u++){
  const f=-3.2+u%3*1.35,m=6.2+Math.floor(u/3)*1.3,p=.62+u%3*.12,
        g=new Lt(new _e(p,p,p),d);
  g.castShadow=!0,g.receiveShadow=!0,put(g,f,m,u*.4,{hp:.45,kind:"crate",destructible:!0,mass:22});
 }
 for(let u=0;u<5;u++){
  const f=3.4+u%2*.9,m=5.4+Math.floor(u/2)*1.1,
        p=new Lt(new mn(.34,.34,.95,12),s);
  p.castShadow=!0,p.receiveShadow=!0,put(p,f,m,u*.7,{hp:2.4,kind:"barrel",destructible:!0,mass:90});
 }
 for(let u=0;u<3;u++){
  const f=1.1+u*2.1,m=46+u*12,v=Math.cos(f)*m,p=Math.sin(f)*m,_=new Jt,
        x=new Lt(new _e(3.2,1.1,6.2),s);x.position.y=.85,_.add(x);
  const y=new Lt(new _e(2.4,.85,3),s);y.position.set(0,1.7,-.2),_.add(y);
  const R=new Lt(new mn(.13,.13,4.2,10),o);R.rotation.x=Math.PI/2,R.position.set(0,1.9,2.4),_.add(R);
  for(const A of [-1,1]){const T=new Lt(new _e(.7,1,5.6),o);T.position.set(A*1.6,.5,0),_.add(T)}
  _.traverse(A=>{A.castShadow=!0,A.receiveShadow=!0}),put(_,v,p,a()*6.28,{hp:6,kind:"tank",destructible:!0});
 }
 for(let u=0;u<40;u++){
  const f=a()*Math.PI*2,m=14+a()*80,v=Math.cos(f)*m,p=Math.sin(f)*m,
        _=.8+a()*2.4,x=.4+a()*1.4,y=.8+a()*2.4,grp=new Jt,
        R=new Lt(new _e(_,x,y),i);
  R.rotation.set(a()*.6,a()*6.28,a()*.6),grp.add(R),grp.traverse(q=>{q.castShadow=!0,q.receiveShadow=!0});
  put(grp,v,p,0,{hp:1,kind:"rubble"});
 }
 return n;
}
class Zw{constructor(t,e,n){this.scene=t,this.effects=e,this.spots=n,this.timer=0,this.lightCount=0,this.maxLights=4,this.tex=El(64,"rgba(255,220,160,1)"),this.glows=[],this.lights=[];if(this.scene)for(let k=0;k<this.maxLights;k++){const L=new Ql(16742946,0,34,2);L.castShadow=!1,L.position.set(0,-600,0),this.scene.add(L),this.lights.push(L),this.lightCount++}for(const i of n)this.addSpot(i.x,i.z,i.y,i.power,!1)}_takeLight(){for(const L of this.lights)if(!L.userData.vBusy)return L.userData.vBusy=!0,L;for(const g of this.glows)if(g.light){const L=g.light;return g.light=null,L}return null}addSpot(t,e,n,i=22,s=!0){if(!this.scene)return;s&&(t+=(Math.random()-.5)*1.6,e+=(Math.random()-.5)*1.6);const o=this._takeLight();o&&(o.position.set(t,n+2.2,e),o.intensity=i);const a=new cf(new Wl({map:this.tex,color:16747056,transparent:!0,opacity:.5,blending:Ir,depthWrite:!1}));if(a.position.set(t,n+1.3,e),a.scale.setScalar(3.4),this.scene.add(a),this.glows.length>14){const c=this.glows.shift();this.scene.remove(c.sprite),c.sprite.material.dispose(),c.light&&(c.light.intensity=0,c.light.position.set(0,-600,0),c.light.userData.vBusy=!1)}this.glows.push({light:o,sprite:a,s:{x:t,z:e,y:n,power:i}})}update(t,e){this.timer+=t;for(const n of this.glows){const i=.72+.28*Math.sin(e*9+n.s.x)*Math.sin(e*5.3+n.s.z);n.light&&(n.light.intensity=(n.s.power||30)*i),n.sprite.material.opacity=.35+.25*i,n.sprite.position.y=n.s.y+1.2+Math.sin(e*3+n.s.z)*.12}if(this.timer>.035){this.timer=0;for(const n of this.glows){for(let i=0;i<2;i++)this.effects._get(this.effects.sparks).spawn({pos:new P(n.s.x+(Math.random()-.5)*1.6,n.s.y+Math.random()*.8,n.s.z+(Math.random()-.5)*1.6),vel:new P((Math.random()-.5)*1.2,2.2+Math.random()*2,(Math.random()-.5)*1.2),life:.5+Math.random()*.5,size0:1.1,size1:.35,color:Math.random()>.5?16752704:16734736,drag:1.2,grav:-3,opacity:.9});Math.random()>.55&&this.effects._get(this.effects.pool).spawn({pos:new P(n.s.x+(Math.random()-.5)*1.4,n.s.y+1.4,n.s.z+(Math.random()-.5)*1.4),vel:new P((Math.random()-.5)*.8,2.6+Math.random()*1.6,(Math.random()-.5)*.8),life:3.4+Math.random()*2.4,size0:1.6,size1:9+Math.random()*5,color:3025704,drag:.5,grav:-1.2,opacity:.45})}}}}/* =========================================================================
   SANDBOX / «ПЕСОЧНИЦА» — second selectable location, built strictly after
   the supplied references: square walled arena, cracked-asphalt yard with
   white winding markings, raised central slab with four concrete ramp wedges,
   red brick watch-tower with a timber cabin, billboards, conifers, dirt
   patches on grass, distant hills, plus the starry "space" variant.
   ========================================================================= */
const VCH_MAP_NAMES=["ПОЛИГОН","ПЕСОЧНИЦА","ПЕСОЧНИЦА · КОСМОС","КАРТА 01","АЛЕКСАНДРОВСК","СЕВЕР-3"];
/*
  Аналитическая высота, отдаваемая лучам катков, намеренно на 4 см ВЫШЕ
  отрисованного асфальта: траки сидят на ~2-3 см ниже аналитической поверхности.
  Визуальная земля = VCH_sbH - VCH_SB_VIS, тела коллизий остаются на VCH_sbH,
  поэтому «посадка на землю» соблюдается.
 */
const VCH_SB_BASE=.04,VCH_SB_VIS=.04;
let VCH_SB_group=null,VCH_SB_recs=[],VCH_SB_fires={glows:[],update(){},addSpot(){}};

/*
  аналитическая высота песочницы: плоская трава плюс поднятое центральное плато
  с четырьмя рампами, чтобы танк действительно заезжал на них через лучи
  подвески
 */
function VCH_sbH(r,t){
 const flat=Math.max(Math.abs(r),Math.abs(t))<66;
 const e=flat?0:(.14*Math.sin(r*.031)*Math.cos(t*.027)+.09*Math.sin(r*.067+t*.041)+.05*Math.cos(r*.11-t*.09));
 const SX=30,SZ=26,RAMP=9,H=2.2;
 const ax=Math.abs(r),az=Math.abs(t);
 const sx=Te.clamp((SX+RAMP-ax)/RAMP,0,1),sz=Te.clamp((SZ+RAMP-az)/RAMP,0,1);
 const up=H*Math.min(sx,sz);
 const far=Te.smoothstep(Math.hypot(r,t),100,200)*3;
 return VCH_SB_BASE+up+far+e;
}


function VCH_SB_groundTex(){
 return VCH_SB_tex((g,N)=>{
  g.fillStyle="#cdcabf";g.fillRect(0,0,N,N);
  const rng=Vf(7717);
  for(let i=0;i<120;i++){
   const x=rng()*N,y=rng()*N,r=9+rng()*48,gr=g.createRadialGradient(x,y,0,x,y,r);
   gr.addColorStop(0,`rgba(116,112,102,${.05+rng()*.13})`),gr.addColorStop(1,"rgba(116,112,102,0)");
   g.fillStyle=gr,g.beginPath(),g.arc(x,y,r,0,6.283),g.fill();
  }
  for(let i=0;i<11000;i++){
   const v=(rng()-.5)*70|0;g.fillStyle=`rgba(${176+v},${172+v},${160+v},.26)`;
   g.fillRect(rng()*N,rng()*N,1+rng()*2,1+rng()*2);
  }
  for(let i=0;i<70;i++){
   const x=rng()*N,y=rng()*N,l=6+rng()*22;
   g.strokeStyle="rgba(96,66,38,.3)",g.lineWidth=.8+rng()*1.2;
   g.beginPath(),g.moveTo(x,y),g.lineTo(x+l,y+l*.4),g.stroke();
  }
 },16);
}
function VCH_SB_asphaltTex(){
 return VCH_SB_tex((g,N)=>{
  g.fillStyle="#636464";g.fillRect(0,0,N,N);
  const rng=Vf(3311);
  for(let i=0;i<4200;i++){
   const v=(rng()-.5)*60|0;g.fillStyle=`rgba(${118+v},${118+v},${116+v},.32)`;
   g.fillRect(rng()*N,rng()*N,1+rng()*3,1+rng()*3);
  }
  g.strokeStyle="rgba(42,42,42,.42)";
  for(let i=0;i<190;i++){
   let x=rng()*N,y=rng()*N;g.lineWidth=.5+rng()*1.1;
   g.beginPath(),g.moveTo(x,y);
   for(let k=0;k<4;k++)g.lineTo(x+= (rng()-.5)*22,y+=(rng()-.5)*22);
   g.stroke();
  }
 },7);
}
function VCH_SB_yardTex(){
 const t=VCH_SB_tex((g,N)=>{
  g.fillStyle="#686969";g.fillRect(0,0,N,N);
  const rng=Vf(3311);
  for(let i=0;i<4200;i++){
   const v=(rng()-.5)*55|0;g.fillStyle=`rgba(${122+v},${122+v},${120+v},.30)`;
   g.fillRect(rng()*N,rng()*N,1+rng()*3,1+rng()*3);
  }
  g.strokeStyle="rgba(40,40,40,.40)";
  for(let i=0;i<190;i++){
   let x=rng()*N,y=rng()*N;g.lineWidth=.5+rng()*1.1;
   g.beginPath(),g.moveTo(x,y);
   for(let k=0;k<4;k++)g.lineTo(x+=(rng()-.5)*22,y+=(rng()-.5)*22);
   g.stroke();
  }
  // вырез под приподнятую плиту и её четыре рампы (|x|<40, |z|<36)
  g.clearRect(93,110,326,292);
 },1);
 return t;
}
function VCH_SB_dirtTex(){
 return VCH_SB_tex((g,N)=>{
  g.clearRect(0,0,N,N);
  const rng=Vf(6619);
  for(let i=0;i<8;i++){
   const x=rng()*N,y=rng()*N,r=N*(.18+rng()*.20),gr=g.createRadialGradient(x,y,0,x,y,r);
   gr.addColorStop(0,`rgba(150,92,50,${.30+rng()*.28})`),gr.addColorStop(1,"rgba(150,92,50,0)");
   g.fillStyle=gr,g.beginPath(),g.arc(x,y,r,0,6.283),g.fill();
  }
 },1);
}
function VCH_SB_dirtPatches(){
 const M=VCH_SB_materials(),rng=Vf(4409);
 for(let i=0;i<54;i++){
  const a=rng()*6.283,d=69+rng()*58;
  const x=Math.cos(a)*d,z=Math.sin(a)*d,s=5+rng()*11;
  const m=VCH_SB_mesh(new Di(s,s,1,1),M.dirt,x,ge(x,z)-VCH_SB_VIS+.08,z,rng()*6.283);
  m.rotation.x=-Math.PI/2,m.castShadow=!1,m.receiveShadow=!1;
 }
}
function VCH_SB_concreteTex(){
 return VCH_SB_tex((g,N)=>{
  g.fillStyle="#8d9090";g.fillRect(0,0,N,N);
  const rng=Vf(5519);
  for(let i=0;i<2600;i++){
   const v=(rng()-.5)*52|0;g.fillStyle=`rgba(${140+v},${142+v},${140+v},.3)`;
   g.fillRect(rng()*N,rng()*N,1+rng()*4,1+rng()*4);
  }
  g.strokeStyle="rgba(50,52,52,.25)";
  for(let i=0;i<90;i++){
   const x=rng()*N,y=rng()*N;g.lineWidth=.6;
   g.beginPath(),g.moveTo(x,y),g.lineTo(x+(rng()-.5)*30,y+(rng()-.5)*30),g.stroke();
  }
 },3);
}
function VCH_SB_stoneTex(){
 return VCH_SB_tex((g,N)=>{
  g.fillStyle="#c9c1a8";g.fillRect(0,0,N,N);
  const rng=Vf(8821);
  for(let y=0;y<N;y+=42)for(let x=0;x<N;x+=86){
   g.fillStyle=`rgba(${150+rng()*44|0},${146+rng()*44|0},${128+rng()*44|0},.55)`;
   g.fillRect(x+2,y+2,82,38);
  }
  g.strokeStyle="rgba(70,66,58,.35)";g.lineWidth=2;
  for(let y=0;y<N;y+=42)g.beginPath(),g.moveTo(0,y),g.lineTo(N,y),g.stroke();
 },4);
}
function VCH_SB_brickTex(){
 return VCH_SB_tex((g,N)=>{
  g.fillStyle="#8d3b28";g.fillRect(0,0,N,N);
  const rng=Vf(4413);
  for(let y=0;y<N;y+=34)for(let x=((y/34|0)%2)*-38;x<N;x+=76){
   const v=rng()*40|0;
   g.fillStyle=`rgb(${146+v},${64+v*.5|0},${44+v*.4|0})`;
   g.fillRect(x+2,y+2,72,30);
  }
  g.strokeStyle="rgba(214,196,170,.5)",g.lineWidth=3;
  for(let y=0;y<N;y+=34){g.beginPath(),g.moveTo(0,y),g.lineTo(N,y),g.stroke();}
 },3);
}
function VCH_SB_signTex(){
 return VCH_SB_tex((g,N)=>{
  g.fillStyle="#e8e6dc";g.fillRect(0,0,N,N);
  g.strokeStyle="#30343a",g.lineWidth=14,g.strokeRect(18,18,N-36,N-36);
  g.strokeStyle="#30343a",g.lineWidth=6,g.strokeRect(34,34,N-68,N-68);
  g.save();g.translate(N/2,N*.44);
  g.beginPath(),g.moveTo(0,-92),g.lineTo(78,0),g.lineTo(0,92),g.lineTo(-78,0),g.closePath();
  g.fillStyle="#2b3036",g.fill();
  g.fillStyle="#e8e6dc";g.font="bold 74px Arial";g.textAlign="center";g.textBaseline="middle";g.fillText("Т",0,4);
  g.restore();
  g.fillStyle="#2b3036",g.font="bold 54px Arial";g.textAlign="center";g.fillText("ТАНКИ",N/2,N*.78);
 },1);
}

let VCH_SB_mats=null;
function VCH_SB_materials(){
 if(VCH_SB_mats)return VCH_SB_mats;
 const ground=VCH_SB_groundTex(),asphalt=VCH_SB_asphaltTex(),conc=VCH_SB_concreteTex(),
       stone=VCH_SB_stoneTex(),brick=VCH_SB_brickTex(),sign=VCH_SB_signTex();
 VCH_SB_mats={
  grass:new fe({map:ground,vertexColors:!0,roughness:.98,metalness:.0,dithering:!0}),
  asphalt:new fe({map:asphalt,roughness:.96,metalness:.02,dithering:!0}),
  yard:null,
  concrete:new fe({map:conc,color:0x9ea2a0,roughness:.93,metalness:.05}),
  concreteDark:new fe({map:conc,color:0x6f7476,roughness:.93,metalness:.05}),
  stone:new fe({map:stone,color:0xd6cdb4,roughness:.95,metalness:.02}),
  brick:new fe({map:brick,color:0xc06a4c,roughness:.94,metalness:.02}),
  timber:new fe({color:0x5b4a36,roughness:.92,metalness:.04}),
  metal:new fe({color:0x42484c,roughness:.62,metalness:.55}),
  white:new fe({color:0xf2ecda,roughness:.92,metalness:.0,emissive:0x302c20,emissiveIntensity:.12}),
  pine:new fe({color:0x2f5a36,roughness:.95,metalness:.0}),
  pineLight:new fe({color:0x3c7041,roughness:.95}),
  hill:new fe({color:0x7f8a58,roughness:1,metalness:0,flatShading:!0}),
  hill2:new fe({color:0x96a06a,roughness:1,metalness:0,flatShading:!0}),
  sign:new fe({map:sign,roughness:.82,metalness:.06,emissive:0x151515,emissiveIntensity:VCH_MAP===2?1.2:.12}),
 };
 VCH_SB_mats.dirt=new fe({map:VCH_SB_dirtTex(),transparent:!0,depthWrite:!1,roughness:1,metalness:0,
   polygonOffset:!0,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 VCH_SB_mats.yard=new fe({map:VCH_SB_yardTex(),roughness:.96,metalness:.02,dithering:!0,
   alphaTest:.5,polygonOffset:!0,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 return VCH_SB_mats;
}

function VCH_SB_mesh(geo,mat,x,y,z,yaw=0){
 const m=new Lt(geo,mat);m.position.set(x,y,z),m.rotation.y=yaw;
 m.castShadow=!0,m.receiveShadow=!0;
 VCH_SB_group.add(m);return m;
}
function VCH_SB_body(physics,x,y,z,hx,hy,hz,yaw=0){
 const b=new Et({mass:0,type:Et.STATIC,position:new w(x,y,z)});
 if(yaw)b.quaternion.setFromAxisAngle(new w(0,1,0),yaw);
 b.addShape(new ns(new w(hx,hy,hz)));
 b.collisionFilterGroup=is,b.collisionFilterMask=7|VCH_RAMP;
 physics.addBody(b);return b;
}
function VCH_SB_rec(mesh,body,kind="concrete"){
 const rec={mesh:mesh,body:body,hp:999,destructible:!1,kind:kind,dynamic:!1,alive:!0};
 mesh.userData.prop=rec;VCH_SB_recs.push(rec);return rec;
}
function VCH_SB_box(physics,w,h,d,mat,x,y,z,yaw=0,meshY=y){
 const m=VCH_SB_mesh(new _e(w,h,d),mat,x,meshY,z,yaw);
 const b=VCH_SB_body(physics,x,y,z,w/2,h/2,d/2,yaw);
 VCH_SB_rec(m,b);return m;
}
function VCH_SB_footprintMax(x,z,w,d,yaw=0){
 const c=Math.cos(yaw),q=Math.sin(yaw);let H=-1e9;
 for(let i=-2;i<=2;i++)for(let k=-2;k<=2;k++){
  const lx=w*i/4,lz=d*k/4;
  H=Math.max(H,ge(x+lx*c+lz*q,z-lx*q+lz*c));
 }
 return H;
}
function VCH_SB_groundBox(physics,w,h,d,mat,x,z,yaw=0){
 const fh=VCH_SB_footprintMax(x,z,w,d,yaw);
 const gy=fh+.02,vy=fh-VCH_SB_VIS;
 return VCH_SB_box(physics,w,h,d,mat,x,gy+h/2,z,yaw,vy+h/2);
}
function VCH_SB_wedge(physics,x,z,yaw,ww,l,h){
 const y=[{at:-ww/2,pts:[[0,-l/2],[h,l/2],[0,l/2]]},{at:ww/2,pts:[[0,-l/2],[h,l/2],[0,l/2]]}];
 const geo=zf("x",y,{capStart:!0,capEnd:!0});geo.computeVertexNormals();
 const y0=VCH_SB_BASE-VCH_SB_VIS+.01;
 const m=VCH_SB_mesh(geo,VCH_SB_materials().concrete,x,y0,z,yaw);
 return m;
}
function VCH_SB_tree(x,z,s){
 const M=VCH_SB_materials();
 VCH_SB_mesh(new mn(.14*s,.2*s,1.1*s,7),M.timber,x,.55*s,z);
 for(let k=0;k<3;k++){
  const r=(.95-k*.22)*s,h=1.5*s;
  VCH_SB_mesh(new mn(0,r,h,8),k%2?M.pine:M.pineLight,x,(1.25+k*.72)*s,z,k*.5);
 }
}
function VCH_SB_bush(x,z,s){
 const M=VCH_SB_materials();
 const m=VCH_SB_mesh(new Sa(.62*s,8,6),M.pine,x,.42*s,z);m.scale.set(1,.72,1);
}
function VCH_SB_tower(physics,x,z){
 const M=VCH_SB_materials(),gy=VCH_SB_footprintMax(x,z,7,7,0),vy=gy-VCH_SB_VIS;
 VCH_SB_box(physics,7,13,7,M.brick,x,gy+6.5,z,0,vy+6.5);
 for(let k=0;k<3;k++)VCH_SB_mesh(new _e(7.35,.30,7.35),M.concrete,x,vy+3.2+k*3.6,z);
 VCH_SB_box(physics,8.6,2.8,8.6,M.timber,x,gy+14.3,z,0,vy+14.3);
 VCH_SB_mesh(new _e(9.8,.55,9.8),M.metal,x,vy+16,z);
 for(const sx of[-1,1])for(const sz of[-1,1])
  VCH_SB_mesh(new _e(.38,2.6,.38),M.timber,x+sx*4.1,vy+14.3,z+sz*4.1);
 VCH_SB_mesh(new _e(9.9,.28,9.9),M.metal,x,vy+15.8,z);
 for(const sx of[-1,1])VCH_SB_mesh(new _e(.12,1.25,6.2),M.metal,x+sx*4.32,vy+14.4,z);
 for(const sz of[-1,1])VCH_SB_mesh(new _e(6.2,1.25,.12),M.metal,x,vy+14.4,z+sz*4.32);
}

function VCH_SB_lattice(physics,x,z){
 const M=VCH_SB_materials(),base=VCH_SB_footprintMax(x,z,5,5,0),vb=base-VCH_SB_VIS,H=11.5;
 for(const sx of[-1,1])for(const sz of[-1,1])
  VCH_SB_box(physics,.38,H,.38,M.metal,x+sx*2.2,base+H/2,z+sz*2.2,0,vb+H/2);
 for(const lev of[3,6,9]){
  for(const sz of[-1,1])VCH_SB_box(physics,4.9,.22,.22,M.metal,x,base+lev,z+sz*2.2,0,vb+lev);
  for(const sx of[-1,1])VCH_SB_box(physics,.22,.22,4.9,M.metal,x+sx*2.2,base+lev,z,0,vb+lev);
  for(const sz of[-1,1]){
   const m=VCH_SB_mesh(new _e(.18,3.4,.18),M.metal,x,vb+lev+1.5,z+sz*2.2);
   m.rotation.z=.62;
  }
 }
 VCH_SB_box(physics,5.6,.45,5.6,M.timber,x,base+H+.22,z,0,vb+H+.22);
 VCH_SB_mesh(new _e(6.2,.30,6.2),M.metal,x,vb+H+.6,z);
 for(const sx of[-1,1])for(const sz of[-1,1])
  VCH_SB_mesh(new _e(.24,1.5,.24),M.timber,x+sx*2.8,vb+H+1.2,z+sz*2.8);
}

function VCH_SB_sign(physics,x,z,yaw){
 const M=VCH_SB_materials(),gy=VCH_SB_footprintMax(x,z,.5,.5,0),vy=gy-VCH_SB_VIS;
 VCH_SB_mesh(new mn(.16,.16,4.3,10),M.metal,x,vy+2.15,z);
 VCH_SB_box(physics,4.2,3.0,.28,M.sign,x,gy+4.7,z,yaw,vy+4.7);
 VCH_SB_mesh(new _e(4.5,.18,.5),M.metal,x,vy+6.3,z,yaw);
}

function VCH_SB_dashes(pts,y){
 const M=VCH_SB_materials();
 for(let i=0;i<pts.length-1;i+=2){
  const [x1,z1]=pts[i],[x2,z2]=pts[i+1],dx=x2-x1,dz=z2-z1,L=Math.hypot(dx,dz)||1;
  const yy=Math.max(ge((x1+x2)/2,(z1+z2)/2)-VCH_SB_VIS+.012,.012);
  const m=VCH_SB_mesh(new _e(.24,.045,L*.86),M.white,(x1+x2)/2,yy,(z1+z2)/2);
  m.rotation.y=Math.atan2(dx,dz);
 }
}

function VCH_SB_hills(){
 const M=VCH_SB_materials(),rng=Vf(9911);
 for(let i=0;i<26;i++){
  const a=i/26*Math.PI*2+rng()*.16,d=155+rng()*95,r=26+rng()*38,h=16+rng()*30;
  const m=VCH_SB_mesh(new Sa(r,20,12),i%2?M.hill:M.hill2,Math.cos(a)*d,-r*.72+h*.30,Math.sin(a)*d,rng()*3);
  m.scale.set(1,.46,1),m.castShadow=!1;
 }
}
function VCH_SB_stars(r){
 if(VCH_MAP!==2)return;
 const rng=Vf(6621),n=900,a=new Float32Array(n*3);
 for(let i=0;i<n;i++){
  const u=rng()*2-1,t=rng()*6.283,s=Math.sqrt(1-u*u);
  a[i*3]=Math.cos(t)*s*430,a[i*3+1]=Math.abs(u)*430+14,a[i*3+2]=Math.sin(t)*s*430;
 }
 const g=new Pe();g.setAttribute("position",new Ve(a,3));
 const p=new Lx(g,new df({color:0xffffff,size:1.8,sizeAttenuation:!1,fog:!1}));
 p.frustumCulled=!1,r.add(p);
}
function VCH_SB_terrain(r){
 const M=VCH_SB_materials(),g=new Di(320,320,168,168);g.rotateX(-Math.PI/2);
 const pos=g.attributes.position,col=new Float32Array(pos.count*3),o=new Ft(),nv=new P;
 for(let i=0;i<pos.count;i++){
  const x=pos.getX(i),z=pos.getZ(i),h=ge(x,z);pos.setY(i,h-VCH_SB_VIS);
  Hw(x,z,nv);
  const up=Te.clamp((h-.35)/1.9,0,1);
  const dirt=.5+.5*Math.sin(x*.15)*Math.cos(z*.12);
  if(Math.max(Math.abs(x),Math.abs(z))<64){
   const gr=.55+.10*dirt+.05*up;
   o.setRGB(gr,gr+.005,gr+.012);
  }else{
   o.setRGB(.36+.20*dirt,.50+.10*dirt,.25+.10*dirt);
  }
  col[i*3]=o.r,col[i*3+1]=o.g,col[i*3+2]=o.b;
 }
 g.setAttribute("color",new Ve(col,3)),g.computeVertexNormals();
 const nm=g.attributes.normal;
 for(let i=0;i<pos.count;i++)Hw(pos.getX(i),pos.getZ(i),nv),nm.setXYZ(i,nv.x,nv.y,nv.z);nm.needsUpdate=!0;
 const m=new Lt(g,M.grass);m.receiveShadow=!0;r.add(m);return m;
}

function VCH_SB_scene(r,physics,lights){
 const M=VCH_SB_materials();
 VCH_SB_group=new Jt();r.add(VCH_SB_group);
 const terrain=VCH_SB_terrain(r);
 // треснувший асфальт: верх приподнятой плиты + четыре полосы двора (без коричневой
 // земли с травой)
 M.asphalt.polygonOffset=!0,M.asphalt.polygonOffsetFactor=-1,M.asphalt.polygonOffsetUnits=-1;
 const visBase=VCH_SB_BASE-VCH_SB_VIS;
 const ap=new Lt(new Di(60,52,1,1),M.asphalt);ap.rotation.x=-Math.PI/2;ap.position.y=visBase+2.2+.005;
 ap.receiveShadow=!0;VCH_SB_group.add(ap);
 const yard=new Lt(new Di(126,126,1,1),M.yard);
 yard.rotation.x=-Math.PI/2,yard.position.y=visBase+.005,yard.receiveShadow=!0;
 VCH_SB_group.add(yard);
 // извилистая белая прерывистая разметка
 const p1=[],p2=[];
 for(let i=0;i<=44;i++){
  const u=i/44,x=-58+116*u;
  p1.push([x,-49+6*Math.sin(u*6.283*1.5)]),p2.push([x,49+5*Math.sin(u*6.283*1.2+1)]);
 }
 VCH_SB_dashes(p1,.09),VCH_SB_dashes(p2,.09);
 const ring=[[-46,-34],[-30,-34],[-30,-22],[30,-22],[30,-34],[46,-34]];
 VCH_SB_dashes(ring,.09);
 // вертикальные бетонные борта центрального плато
 const H=2.2;
 for(const sx of[-1,1])for(const sz of[-1,1])
  VCH_SB_groundBox(physics,1.1,1.2,19.5,M.concreteDark,sx*30,sz*17.25);
 for(const sz of[-1,1])for(const sx of[-1,1])
  VCH_SB_groundBox(physics,23,1.2,1.1,M.concreteDark,sx*18.8,sz*26);
 // четыре клина-рампы на плато
 VCH_SB_wedge(physics,0,-30.5,0,15,9,H);
 VCH_SB_wedge(physics,0,30.5,Math.PI,15,9,H);
 VCH_SB_wedge(physics,-34.5,0,Math.PI/2,15,9,H);
 VCH_SB_wedge(physics,34.5,0,-Math.PI/2,15,9,H);
 // детали верха приподнятой плиты / низкие блоки
 VCH_SB_groundBox(physics,7,1.5,7,M.concrete,-14,-8);
 VCH_SB_groundBox(physics,7,1.5,7,M.concrete,14,8);
 // каменный бортик арены с кремовым оголовком
 const B=62,T=2.8,BH=3.4;
 for(const s of[-1,1]){
  VCH_SB_groundBox(physics,2*B+6,BH,T,M.stone,0,s*B);
  VCH_SB_mesh(new _e(2*B+6,.42,T+.5),M.stone,0,ge(0,s*B)-VCH_SB_VIS+BH-.18,s*B);
  VCH_SB_groundBox(physics,T,BH,2*B+6,M.stone,s*B,0);
  VCH_SB_mesh(new _e(T+.5,.42,2*B+6),M.stone,s*B,ge(s*B,0)-VCH_SB_VIS+BH-.18,0);
 }
 // стены лабиринта / бетонные блоки
 const blocks=[
  [-45,18,18,2.6,2.6,0],[45,-18,18,2.6,2.6,0],
  [-18,44,18,2.6,2.6,Math.PI/2],[18,-44,18,2.6,2.6,Math.PI/2],
  [-46,-8,14,2.6,2.6,Math.PI/2],[46,8,14,2.6,2.6,Math.PI/2],
  [-8,-46,14,2.6,2.6,0],[8,46,14,2.6,2.6,0],
  [-36,34,9,2.2,2.2,0],[36,-34,9,2.2,2.2,0]
 ];
 for(const [x,z,w,h,d,y] of blocks)VCH_SB_groundBox(physics,w,h,d,M.concreteDark,x,z,y);
 // башня + билборды
 VCH_SB_tower(physics,-45,-45);
 VCH_SB_lattice(physics,45,45);
 VCH_SB_sign(physics,-20,14,0);
 VCH_SB_sign(physics,22,-16,0);
 // ели и кусты
 const rng=Vf(2207);
 for(let i=0;i<34;i++){
  const a=i/34*6.283+rng()*.2,d=48+rng()*11;
  VCH_SB_tree(Math.cos(a)*d,Math.sin(a)*d,.75+rng()*.7);
 }
 for(let i=0;i<14;i++){
  const a=i/14*6.283+.2,d=52+rng()*8;
  VCH_SB_bush(Math.cos(a)*d,Math.sin(a)*d,.8+rng()*.6);
 }
 VCH_SB_dirtPatches();VCH_SB_hills();VCH_SB_stars(r);
 // свет / туман по варианту
 if(VCH_MAP===2){
  lights.sun.intensity=1.25,lights.sun.color.setHex(0xb9ccff);
  lights.hemi.intensity=.24,lights.hemi.color.setHex(0x3a4a72);
  lights.fill.intensity=.85,lights.fill.color.setHex(0x86a0ff);
  lights.bounce.intensity=.16;
  r.fog.color.setHex(0x0b1222),r.fog.density=.0014;
 }else{
  lights.sun.intensity=3.35,lights.sun.color.setHex(0xffecc9);
  lights.hemi.intensity=1.02,lights.hemi.color.setHex(0xbcd8f0);
  lights.fill.intensity=.58;r.fog.color.setHex(0xcbd6cf),r.fog.density=.0016;
 }
 return terrain;
}
function VCH_SB_props(r,physics,effects){
 return {props:VCH_SB_recs,fires:VCH_SB_fires};
}
function VCH_MAP_UI(){
 const sel=document.querySelector("#mapselect");
 if(sel){
  sel.value=VCH_MAP===1?"sandbox":VCH_MAP===2?"space":VCH_MAP===3?"map01":VCH_MAP===4?"aleksandrovsk":VCH_MAP===5?"nord":"polygon";
  sel.addEventListener("change",e=>{
   const v=e.target.value;
   location.search=v==="polygon"?"":"?map="+v;
  });
 }
 const name=VCH_MAP_NAMES[VCH_MAP];
 const a=document.querySelector("#mapname"),b=document.querySelector("#maplabel"),c=document.querySelector("#startloc");
 if(a)a.textContent=name;
 if(b)b.textContent="ЛОКАЦИЯ: "+name;
 if(c)c.textContent="ВЫБРАННАЯ ЛОКАЦИЯ: "+name+(VCH_MAP===4?" · модель: DageLV · Sketchfab · CC-BY-4.0":"");
}

function Jw(r,t){
 const e=new iw({gravity:new w(0,-9.82,0)});
 e.broadphase=new Cs(e),e.solver.iterations=10,e.allowSleep=!0,e.defaultContactMaterial.friction=.5,e.defaultContactMaterial.restitution=.05;
 r.fog=new Gl(VCH_MAP?0xbdcac6:0xc4c4bb,VCH_MAP?.0012:.0019),Gw(r);
 const n=Ww(r);let i=null,s=null;
 if(VCH_MAP===5){i=VCH_NORD_scene(r,e,n),s=VCH_NORD_group}
 else if(VCH_MAP===3){i=VCH_MAP01_scene(r,e,n),s=null}else if(VCH_MAP===4){i=VCH_ALEKS_scene(r,e,n),s=null}
 else if(VCH_MAP){i=VCH_SB_scene(r,e,n),s=VCH_SB_group}
 else{i=qw(r),({group:s}=Xw(r))}
 return{physics:e,lights:n,terrain:i,buildingGroup:s,heightAt:ge,normalAt:Hw,props:[],fires:null,effects:null}}
function Qw(r,t,e){if(VCH_MAP===5)return VCH_NORD_props(r,t,e);if(VCH_MAP===3)return VCH_MAP01_props(r,t,e);if(VCH_MAP===4)return VCH_ALEKS_props(r,t,e);if(VCH_MAP)return VCH_SB_props(r,t,e);const n=$w(r,t),i=[{x:-26,z:-30,power:34},{x:33,z:26,power:28},{x:8,z:-58,power:24},{x:-52,z:18,power:30}].map(o=>({...o,y:ge(o.x,o.z)})),s=new Zw(r,e,i);return{props:n,fires:s}}class dd{constructor(t,e,n){const i=new Wl({map:e,transparent:!0,depthWrite:!1,blending:n});this.sprite=new cf(i),this.sprite.visible=!1,this.sprite.frustumCulled=!1,t.add(this.sprite),this.alive=!1,this.vel=new P,this.life=0,this.maxLife=1,this.size0=1,this.size1=2,this.drag=1,this.grav=0,this.rot=0,this.rotVel=0,this.fade=1}spawn(t){this.alive=!0,this.sprite.visible=!0,this.sprite.position.copy(t.pos),this.vel.copy(t.vel||new P),this.life=0,this.maxLife=t.life||1,this.size0=t.size0??1,this.size1=t.size1??this.size0,this.drag=t.drag??1.5,this.grav=t.grav??0,this.rot=Math.random()*6.283,this.rotVel=(Math.random()-.5)*(t.rotVel??0),this.fade=t.opacity??1,this.sprite.material.color.set(t.color??16777215),this.sprite.material.opacity=this.fade,this.sprite.material.rotation=this.rot,this.sprite.scale.setScalar(this.size0)}update(t){if(!this.alive)return;this.life+=t;const e=this.life/this.maxLife;if(e>=1){this.alive=!1,this.sprite.visible=!1;return}const n=Math.exp(-this.drag*t);this.vel.multiplyScalar(n),this.vel.y-=this.grav*t,this.sprite.position.addScaledVector(this.vel,t);const i=this.size0+(this.size1-this.size0)*e;this.sprite.scale.setScalar(i),this.rot+=this.rotVel*t,this.sprite.material.rotation=this.rot;const s=this.fade*Math.min(1,e*8)*(1-Math.pow(e,1.6));this.sprite.material.opacity=Math.max(0,s)}}/* множитель числа частиц: задаётся ступенью качества (2.2) */
/* ---------------------------------------------------------------------------
   2.2  Разрешение текстур под ступень качества (512 → 256 → 128)
   ---------------------------------------------------------------------------
   Оригиналы сохраняются, поэтому возврат на высокое качество восстанавливает
   полное разрешение без перезагрузки. Работает только с растровыми источниками
   (canvas / image / ImageBitmap); DataTexture и кубические карты не трогаем.
   ------------------------------------------------------------------------- */
let VCH_TEXORIG=null;
function VCH_texScale(f){
  try{
    f=+f||1;
    if(!VCH_TEXCACHE||!VCH_TEXCACHE.length)VCH_anisoApply(8);
    if(!VCH_TEXORIG)VCH_TEXORIG=new Map();
    for(const t of VCH_TEXCACHE){
      const img=t.image;
      if(!img||t.isCompressedTexture||t.isDataTexture||img.isDataTexture)continue;
      const w=img.width|0,h=img.height|0;
      if(!w||!h)continue;
      if(!VCH_TEXORIG.has(t))VCH_TEXORIG.set(t,img);
      const src=VCH_TEXORIG.get(t),sw=src.width|0;
      if(f>=.999){
        if(t.image!==src){t.dispose();t.image=src;t.needsUpdate=!0}
        continue;
      }
      const tw=Math.max(16,Math.round(sw*f)),th=Math.max(16,Math.round((src.height|0)*f));
      if(t.image&&t.image.__tw===tw&&t.image.__th===th)continue;
      if(tw>=sw){if(t.image!==src){t.dispose();t.image=src;t.needsUpdate=!0}continue}
      const c=document.createElement("canvas");c.width=tw;c.height=th;
      const cx=c.getContext("2d");
      cx.imageSmoothingEnabled=!0;cx.imageSmoothingQuality="high";
      try{cx.drawImage(src,0,0,tw,th)}catch(e){continue}
      c.__tw=tw;c.__th=th;
      t.dispose();t.image=c;t.needsUpdate=!0;
    }
  }catch(e){}
}
let VCH_FXK=1,
    VCH_TEXCACHE=null;      /* уникальные текстуры сцены — для анизотропии */

/* Анизотропия всех карт сцены под текущую ступень качества. Список текстур
   собирается один раз: обход графа сцены на каждое переключение слишком дорог. */
function VCH_anisoApply(a){
  try{
    const max=Jn.capabilities.getMaxAnisotropy(),want=Math.max(1,Math.min(a|0,max));
    if(!VCH_TEXCACHE||!VCH_TEXCACHE.length){
      const set=new Set();VCH_TEXCACHE=[];
      cn.traverse(o=>{
        const m=o.material;if(!m)return;
        for(const mm of Array.isArray(m)?m:[m])
          for(const k of["map","normalMap","roughnessMap","metalnessMap","aoMap","emissiveMap"]){
            const t=mm[k];if(t&&t.isTexture&&!set.has(t)){set.add(t);VCH_TEXCACHE.push(t)}
          }
      });
    }
    for(const t of VCH_TEXCACHE){
      if(t.anisotropy===want)continue;
      t.anisotropy=want;t.needsUpdate=!0;
    }
  }catch(e){}          /* вызов может прийти до инициализации сцены */
}

/* Тени мелких пропсов: на низком качестве их отключаем — это самая дорогая
   часть проходa теней при 130+ объектах, а визуально почти не читается. */
function VCH_propShadow(on){
  try{
    for(const o of ba){
      if(!o||!o.mesh||!o.mesh.isObject3D)continue;
      if(o.mesh.castShadow!==on)o.mesh.castShadow=on;
    }
  }catch(e){}
}
class t1{constructor(t,e={}){this.scene=t,this.onShake=e.onShake||(()=>{}),this.onLight=e.onLight||(()=>{});const n=El(128,"rgba(255,255,255,0.95)"),i=El(64,"rgba(255,255,255,1)");this.pool=[];for(let s=0;s<1100;s++){const o=new dd(t,n,Qi);this.pool.push(o)}this.sparks=[];for(let s=0;s<260;s++){const o=new dd(t,i,Ir);this.sparks.push(o)}this.smokeTex=n,this.sparkTex=i,this.flashLight=new Ql(16756832,0,60,2),this.flashLight.castShadow=!1,t.add(this.flashLight),this.flashTimer=0,this.debris=[],this.debrisGeo=new _e(.22,.16,.3),this.debrisMat=new fe({color:8028036,roughness:.9,metalness:.2}),this.debrisPool=[];this.debrisCur=0;for(let s=0;s<90;s++){const o=new Lt(this.debrisGeo,this.debrisMat);o.castShadow=!0,o.visible=!1,t.add(o),this.debrisPool.push({mesh:o,alive:!1,vel:new P,av:new P,life:0})}this.tracers=[]}_get(t){for(const e of t)if(!e.alive)return e;return t[Math.random()*t.length|0]}muzzleBurst(t,e,n=[]){for(let i=0,iN=Math.max(6,Math.round(34*VCH_FXK));i<iN;i++){const s=this._get(this.sparks),o=e.clone().multiplyScalar(22+Math.random()*46);o.x+=(Math.random()-.5)*8,o.y+=(Math.random()-.5)*8,o.z+=(Math.random()-.5)*8,s.spawn({pos:t.clone().addScaledVector(e,Math.random()*.9),vel:o,life:.12+Math.random()*.18,size0:.35+Math.random()*.8,size1:1.6,color:Math.random()>.35?16769200:16742944,drag:6,grav:2,opacity:1})}for(const i of n)for(let s=0;s<5;s++){const o=this._get(this.pool),a=new P(Math.random()-.5,Math.random()*.5,Math.random()-.5).multiplyScalar(5).addScaledVector(e,2);o.spawn({pos:i.clone(),vel:a,life:1.1+Math.random(),size0:.45,size1:3.6,color:10328722,drag:1.6,grav:-.5,opacity:.34})}for(let i=0;i<9;i++)this._get(this.pool).spawn({pos:t.clone().addScaledVector(e,2.5+Math.random()*3),vel:e.clone().multiplyScalar(10+Math.random()*12),life:1.3+Math.random()*1.5,size0:.9,size1:5+Math.random()*3,color:10262156,drag:1.2,grav:-.8,opacity:.34});this.flashLight.position.copy(t).addScaledVector(e,1.2),this.flashLight.intensity=1500,this.flashTimer=.09,this.onShake(.9)}impact(t,e,n=1,k=1){for(let i=0,nP=Math.min(24,Math.round(16*n*VCH_FXK));i<nP;i++){const s=this._get(this.pool),o=e.clone().multiplyScalar(3+Math.random()*6);o.x+=(Math.random()-.5)*6,o.y+=Math.random()*5,o.z+=(Math.random()-.5)*6,s.spawn({pos:t.clone().addScaledVector(e,.2),vel:o,life:.8+Math.random()*1.1,size0:.5,size1:3.4+Math.random()*2,color:10262156,drag:2.2,grav:-1.2,opacity:.55})}for(let i=0;i<14;i++){const s=this._get(this.sparks),o=e.clone().multiplyScalar(8+Math.random()*22);o.x+=(Math.random()-.5)*10,o.y+=(Math.random()-.2)*10,o.z+=(Math.random()-.5)*10,s.spawn({pos:t.clone(),vel:o,life:.18+Math.random()*.3,size0:.25,size1:1.1,color:16760944,drag:1.2,grav:12,opacity:1})}this.flashLight.position.copy(t),this.flashLight.intensity=260*n,this.flashTimer=.06,this.onShake(Te.clamp(.35*n*k,0,.9))}explosion(t,e=1){for(let n=0,nS=Math.min(34,Math.round(22*e*VCH_FXK));n<nS;n++){const i=this._get(this.sparks),s=new P((Math.random()-.5)*9,Math.random()*8+1,(Math.random()-.5)*9).multiplyScalar(e);i.spawn({pos:t.clone(),vel:s,life:.3+Math.random()*.4,size0:1.4*e,size1:4.5*e,color:Math.random()>.5?16756800:16737296,drag:3,grav:-4,opacity:.95})}for(let n=0,nP=Math.min(22,Math.round(16*e*VCH_FXK));n<nP;n++){const i=this._get(this.pool),s=new P((Math.random()-.5)*6,Math.random()*5+2,(Math.random()-.5)*6).multiplyScalar(e);i.spawn({pos:t.clone(),vel:s,life:2+Math.random()*2.5,size0:1.6*e,size1:7*e,color:3617583,drag:1.2,grav:-1.6,opacity:.62})}for(let n=0,nD=Math.min(12,Math.round(14*e));n<nD;n++)this.spawnDebris(t,1);this.flashLight.position.copy(t),this.flashLight.intensity=1400*e,this.flashTimer=.22,this.onShake(Te.clamp(.95*e,0,1.35))}spawnDebris(t,e=1){const DP=this.debrisPool,LN=DP.length;let n=null;for(let k=0;k<LN;k++){const c=DP[(this.debrisCur+k)%LN];if(!c.alive){n=c,this.debrisCur=(this.debrisCur+k+1)%LN;break}}n&&(n.alive=!0,n.life=0,n.mesh.visible=!0,n.mesh.position.copy(t),n.mesh.scale.setScalar(.4+Math.random()*1.2),n.vel.set((Math.random()-.5)*16*e,Math.random()*14*e+3,(Math.random()-.5)*16*e),n.av.set(Math.random()*12,Math.random()*12,Math.random()*12),this.debris.push(n))}trackDust(t,e=.3,n=1,d){if(Math.random()>e*VCH_FXK)return;const _p=this.pool,_f=this.dustFrom||0;let _o=null;for(let _i=_f;_i<_p.length;_i++)if(!_p[_i].alive){_o=_p[_i];break}(_o||this._get(_p)).spawn({pos:t.clone().add(new P((Math.random()-.5)*1.15,.1+Math.random()*.25,(Math.random()-.5)*1.15)),vel:new P((Math.random()-.5)*1.9+(d?d.x:0),.75+Math.random()*1.15,(Math.random()-.5)*1.9+(d?d.z:0)).multiplyScalar(.62+n*.3),life:1.15+Math.random()*1.05,size0:.95,size1:2.7+n*.65,color:11050906,drag:1.45,grav:-.62,opacity:.42})}trail(t,e){this._get(this.pool).spawn({pos:t.clone(),vel:new P(0,.3,0),life:.9+Math.random()*.5,size0:.22,size1:1.6,color:12104360,drag:2.5,grav:-.4,opacity:.4})}update(t){for(const e of this.pool)e.update(t);for(const e of this.sparks)e.update(t);this.flashTimer>0&&(this.flashTimer-=t,this.flashLight.intensity*=Math.pow(.001,t),this.flashTimer<=0&&(this.flashLight.intensity=0));for(let e=this.debris.length-1;e>=0;e--){const n=this.debris[e];n.life+=t,n.vel.y-=24*t,n.mesh.position.addScaledVector(n.vel,t),n.mesh.rotation.x+=n.av.x*t,n.mesh.rotation.y+=n.av.y*t,n.mesh.rotation.z+=n.av.z*t,n.mesh.position.y<.1&&(n.mesh.position.y=.1,n.vel.set(0,0,0),n.av.set(0,0,0)),n.life>14&&(n.alive=!1,n.mesh.visible=!1,this.debris.splice(e,1))}}}
/* ============================================================================
   3.4 (остаток) · КАТЯЩИЕСЯ БОЧКИ И ЦЕПНОЙ ПОДРЫВ
   ----------------------------------------------------------------------------
   Пропсы стоят на статических телах (mass 0) — это дёшево и стабильно, но
   такое тело нельзя толкнуть: удар по бочке раньше только снимал hp, и бочка
   «исчезала» на месте. Теперь у свободных пропсов (масса > 0 — бочки и ящики)
   есть собственный интегратор на аналитическом рельефе ge():

     • удар (снаряд, взрыв, гусеница) задаёт скорость vchKnock();
     • дальше — баллистика, отскок с затуханием .32, трение о грунт;
     • лежащая бочка КАТИТСЯ: наклон .90° вокруг направления движения, затем
       вращение вокруг своей продольной оси на путь / R (катится туда, куда
       летит), поэтому силуэт бочки читается как катящийся предмет;
     • упавший боком предмет обратно НЕ встаёт (наклон фиксируется при > .55);
     • через 1.2 с покоя предмет засыпает — кадр больше ничего не считает.

   Статическое тело остаётся в мире и едет вместе с мешем (position/quaternion +
   aabbNeedsUpdate), поэтому танк по-прежнему физически упирается в бочку, а
   raycast снаряда попадает в неё там, где она лежит.

   Цепной подрыв: бочка/машина детонирует соседей в радиусе 7 м (задержка
   60–240 мс, чтобы взрыв шёл волной, а не одним кадром), остальные пропсы
   рядом получают толчок vchKnock() и разлетаются. Ящики и бетон, как и раньше,
   не взрываются — только разваливаются.
   ========================================================================== */
const VCH_KNOCK_GEOM=new WeakMap();
const VCH_KNOCK={q:new gn(),tilt:new gn(),axis:new P(),v:new P(),sz:new P()};

function vchKnockGeom(rec){
  let g=VCH_KNOCK_GEOM.get(rec);
  if(g)return g;
  let up=.4,side=.25;
  try{
    const bb=new Xe().setFromObject(rec.mesh),sz2=bb.getSize(VCH_KNOCK.sz);
    up=Math.max(.05,sz2.y*.5);side=Math.max(.05,Math.min(sz2.x,sz2.z)*.5);
  }catch(e){}
  g={up:up,side:side,R:rec.kind==="barrel"?side:0};
  VCH_KNOCK_GEOM.set(rec,g);
  return g;
}
function vchKnockInit(rec){
  if(rec.loose)return rec.loose;
  const g=vchKnockGeom(rec);
  rec.loose={on:!1,vx:0,vy:0,vz:0,roll:0,tilt:0,restT:0,R:g.R,up:g.up,side:g.side,
             baseQ:rec.mesh.quaternion.clone()};
  return rec.loose;
}
/* dir — направление толчка (горизонтальное), power — сила удара/урона */
function vchKnock(rec,dir,power){
  if(!rec||!rec.alive||!rec.dynamic||!rec.mesh)return null;
  const L=vchKnockInit(rec),k=Math.max(.4,+power||0);
  let dx=(dir&&dir.x)||0,dz=(dir&&dir.z)||0;
  const d=Math.hypot(dx,dz);
  if(d<1e-4){dx=1;dz=0}else{dx/=d;dz/=d}
  const push=Math.min(8,1.2+k*1.4);
  L.on=!0;L.restT=0;
  L.vx+=dx*push;L.vz+=dz*push;
  L.vy=Math.max(L.vy,.35+Math.min(2.2,k*.55));
  return L;
}
function vchPropDyn(dt){
  const arr=(typeof ba!=="undefined"&&ba)||null;
  if(!arr||!dt||dt<=0)return;
  const step=Math.min(dt,.05),
        hull=(typeof qt!=="undefined"&&qt&&qt.group)?qt.group.position:null,
        spT=(typeof Ce!=="undefined"&&Ce)?Math.abs(Ce.forwardSpeed||0):0,
        K=VCH_KNOCK;
  for(const r of arr){
    if(!r||!r.alive||!r.dynamic||!r.mesh)continue;
    const L=r.loose;
    if(!L||!L.on)continue;
    const m=r.mesh,p=m.position;
    /* --- танк толкает бочку, если едет --- */
    if(hull&&spT>.6){
      const dx=p.x-hull.x,dz=p.z-hull.z,dd=Math.hypot(dx,dz);
      if(dd<2.7){
        const nx=dx/(dd||1e-4),nz=dz/(dd||1e-4),push=Math.min(6,spT*(2.7-dd));
        L.vx=L.vx*.4+nx*push;L.vz=L.vz*.4+nz*push;
        L.vy=Math.max(L.vy,push*.12);
      }
    }
    /* --- интеграция: гравитация, перенос, отскок --- */
    L.vy-=9.82*step;
    p.x+=L.vx*step;p.y+=L.vy*step;p.z+=L.vz*step;
    const gy=ge(p.x,p.z),sup=L.up+(L.side-L.up)*L.tilt;
    if(p.y-sup<=gy){
      p.y=gy+sup;
      if(L.vy<-1.1){L.vy=-L.vy*.32;try{an.impact(r.kind)}catch(e){}}
      else L.vy=0;
      const fr=Math.pow(.06,step);L.vx*=fr;L.vz*=fr;
    }else{
      const air=Math.pow(.72,step);L.vx*=air;L.vz*=air;
    }
    const sp=Math.hypot(L.vx,L.vz);
    /* --- качение / скольжение --- */
    if(L.R>0){
      const want=sp>.45?1:(L.tilt>.55?1:0);
      L.tilt+=(want-L.tilt)*Math.min(1,step*4.5);
      if(sp>1e-3)K.axis.set(L.vx,0,L.vz).normalize();
      K.tilt.setFromAxisAngle(K.axis,L.tilt*Math.PI/2).multiply(L.baseQ);
      L.roll-=sp*step/L.R;                       /* знак: катится по ходу движения */
      m.quaternion.copy(K.tilt).multiply(K.q.set(0,1,0,L.roll));
    }
    /* --- тело едет вместе с мешем, чтобы коллизия была честной --- */
    if(r.body){
      const q=m.quaternion;
      r.body.position.set(p.x,p.y,p.z);
      r.body.quaternion.set(q.x,q.y,q.z,q.w);
      r.body.aabbNeedsUpdate=!0;
    }
    if(p.y<gy-8){p.y=gy+sup;L.vy=0;L.vx=L.vz=0}  /* страховка: не улетел в бездну */
    /* --- сон --- */
    if(sp<.08&&Math.abs(L.vy)<.15){
      L.restT+=step;
      if(L.restT>1.2){L.on=!1;L.vx=L.vz=L.vy=0}
    }else L.restT=0;
  }
}
