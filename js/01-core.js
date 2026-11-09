/* ==========================================================================
   vch36 · js/01-core.js
   базовые помощники: текстуры, округление, примитивы
   Из index.html (4.2 «разбиение на модули»). Порядок загрузки задан в index.html
   тегами <script defer>; «use strict» сохранён — исходный код был модулем.
   ========================================================================== */
"use strict";
function _w(r,t=1e-4){t=Math.max(t,Number.EPSILON);const e={},n=r.getIndex(),i=r.getAttribute("position"),s=n?n.count:i.count;let o=0;const a=Object.keys(r.attributes),c={},l={},h=[],d=["getX","getY","getZ","getW"],u=["setX","setY","setZ","setW"];for(let _=0,x=a.length;_<x;_++){const y=a[_],R=r.attributes[y];c[y]=new R.constructor(new R.array.constructor(R.count*R.itemSize),R.itemSize,R.normalized);const A=r.morphAttributes[y];A&&(l[y]||(l[y]=[]),A.forEach((T,N)=>{const V=new T.array.constructor(T.count*T.itemSize);l[y][N]=new T.constructor(V,T.itemSize,T.normalized)}))}const f=t*.5,m=Math.log10(1/t),v=Math.pow(10,m),p=f*v;for(let _=0;_<s;_++){const x=n?n.getX(_):_;let y="";for(let R=0,A=a.length;R<A;R++){const T=a[R],N=r.getAttribute(T),V=N.itemSize;for(let M=0;M<V;M++)y+=`${~~(N[d[M]](x)*v+p)},`}if(y in e)h.push(e[y]);else{for(let R=0,A=a.length;R<A;R++){const T=a[R],N=r.getAttribute(T),V=r.morphAttributes[T],M=N.itemSize,b=c[T],H=l[T];for(let D=0;D<M;D++){const F=d[D],z=u[D];if(b[z](o,N[F](x)),V)for(let U=0,K=V.length;U<K;U++)H[U][z](o,V[U][F](x))}}e[y]=o,h.push(o),o++}}const g=r.clone();for(const _ in r.attributes){const x=c[_];if(g.setAttribute(_,new x.constructor(x.array.slice(0,o*x.itemSize),x.itemSize,x.normalized)),_ in l)for(let y=0;y<l[_].length;y++){const R=l[_][y];g.morphAttributes[_][y]=new R.constructor(R.array.slice(0,o*R.itemSize),R.itemSize,R.normalized)}}return g.setIndex(h),g}function hd(r,t){if(t===Bp)return console.warn("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Geometry already defined as triangles."),r;if(t===ml||t===kd){let e=r.getIndex();if(e===null){const o=[],a=r.getAttribute("position");if(a!==void 0){for(let c=0;c<a.count;c++)o.push(c);r.setIndex(o),e=r.getIndex()}else return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Undefined position attribute. Processing not possible."),r}const n=e.count-2,i=[];if(t===ml)for(let o=1;o<=n;o++)i.push(e.getX(0)),i.push(e.getX(o)),i.push(e.getX(o+1));else for(let o=0;o<n;o++)o%2===0?(i.push(e.getX(o)),i.push(e.getX(o+1)),i.push(e.getX(o+2))):(i.push(e.getX(o+2)),i.push(e.getX(o+1)),i.push(e.getX(o)));i.length/3!==n&&console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unable to generate correct amount of triangles.");const s=r.clone();return s.setIndex(i),s.clearGroups(),s}else return console.error("THREE.BufferGeometryUtils.toTrianglesDrawMode(): Unknown draw mode:",t),r}function Qs(r=512){const t=document.createElement("canvas");return t.width=t.height=r,t}function Vt(r,t){return r+Math.random()*(t-r)}/* ---------------------------------------------------------------------------
   2.3  Текстуры в воркере
   ---------------------------------------------------------------------------
   Раньше все 512² текстуры земли/асфальта/бетона рисовались на главном потоке
   в момент создания материала — это заметный «залип» на старте. Теперь каждая
   такая текстура получает дешёвую заглушку 8×8 и уходит в воркер на
   OffscreenCanvas; результат приходит ImageBitmap'ом и подменяет картинку.
   Если в воркере код не собрался (нужен helper, которого нет в песочнице),
   текстура честно дорисовывается на главном потоке — визуально ничего не
   теряется, просто без выигрыша по времени.
   ------------------------------------------------------------------------- */
let VCH_TW=null,VCH_TWid=0,VCH_TWok=0,VCH_TWbad=0,VCH_TWerr="";const VCH_TWcb=new Map();
const VCH_TW_SRC=`
 function Vf(s){let x=(s>>>0)||1;return function(){x^=x<<13;x>>>=0;x^=x>>>17;x^=x<<5;x>>>=0;return (x>>>0)/4294967296}}
 function Vt(a,b){return a+Math.random()*(b-a)}
 self.onmessage=function(e){
   var d=e.data,W=(d.w|0)||512,H=(d.h|0)||W,c=new OffscreenCanvas(W,H),g=c.getContext("2d");
   try{
     (new Function("g","N","Vf","Vt",d.code))(g,W,Vf,Vt);
     var bmp=c.transferToImageBitmap();
     self.postMessage({id:d.id,bmp:bmp},[bmp]);
   }catch(err){ self.postMessage({id:d.id,err:String(err)}) }
 };`;
function VCH_texWorker(){
  if(VCH_TW!==null)return VCH_TW;
  if(typeof Worker==="undefined"||typeof OffscreenCanvas==="undefined")return VCH_TW=!1;
  try{
    VCH_TW=new Worker(URL.createObjectURL(new Blob([VCH_TW_SRC],{type:"text/javascript"})));
    VCH_TW.onmessage=e=>{const d=e.data||{},cb=VCH_TWcb.get(d.id);VCH_TWcb.delete(d.id);cb&&cb(d.bmp,d.err)};
    VCH_TW.onerror=e=>{VCH_TWbad++;VCH_TWerr=String((e&&e.message)||"worker error").slice(0,200);VCH_TW=!1};
  }catch(e){VCH_TW=!1}
  return VCH_TW;
}
function VCH_SB_tex(fn,rep){
  const W=VCH_texWorker();
  const make=(img)=>{const t=new Ks(img);t.wrapS=t.wrapT=vi,t.repeat.set(rep,rep),t.anisotropy=8,t.colorSpace=Ie;return t};
  if(W){
    const ph=Qs(8),pg=ph.getContext("2d");
    pg.fillStyle="#8b8b86";pg.fillRect(0,0,8,8);
    const t=make(ph),id=++VCH_TWid;
    const fallback=()=>{
      try{const c=Qs(512),g=c.getContext("2d");fn(g,512);t.image=c;t.needsUpdate=!0}catch(e){}
    };
    VCH_TWcb.set(id,(bmp,err)=>{
      if(bmp&&!err){VCH_TWok++;t.image=bmp;t.needsUpdate=!0}
      else{VCH_TWbad++;VCH_TWerr=String(err||"no bitmap").slice(0,200);fallback()}
    });
    try{W.postMessage({id,w:512,h:512,code:fn.toString()})}catch(e){VCH_TWcb.delete(id);fallback()}
    return t;
  }
  const c=Qs(512),g=c.getContext("2d");fn(g,512);
  return make(c);
}
function da({size:r=512,base:t="#b9bfc5",grime:e=.5}={}){const n=Qs(r),i=n.getContext("2d");i.fillStyle=t,i.fillRect(0,0,r,r);for(let c=0;c<90;c++){const l=Vt(0,r),h=Vt(0,r),d=Vt(20,130),u=i.createRadialGradient(l,h,0,l,h,d),f=Vt(.02,.09)*e*2;u.addColorStop(0,`rgba(52,48,42,${f})`),u.addColorStop(1,"rgba(52,48,42,0)"),i.fillStyle=u,i.beginPath(),i.arc(l,h,d,0,Math.PI*2),i.fill()}const s=i.getImageData(0,0,r,r),o=s.data;for(let c=0;c<o.length;c+=4){const l=(Math.random()-.5)*26;o[c]+=l,o[c+1]+=l,o[c+2]+=l}i.putImageData(s,0,0),i.strokeStyle="rgba(30,34,38,0.22)",i.lineWidth=1.2;for(let c=0;c<16;c++){if(i.beginPath(),Math.random()>.5){const l=Vt(0,r);i.moveTo(0,l),i.lineTo(r,l)}else{const l=Vt(0,r);i.moveTo(l,0),i.lineTo(l,r)}i.stroke()}for(let c=0;c<220;c++){const l=Vt(0,r),h=Vt(0,r);i.fillStyle="rgba(40,45,50,0.18)",i.beginPath(),i.arc(l,h,Vt(1,2.2),0,6.283),i.fill(),i.fillStyle="rgba(235,240,245,0.10)",i.beginPath(),i.arc(l-.7,h-.7,Vt(.6,1.4),0,6.283),i.fill()}for(let c=0;c<46;c++){const l=Vt(0,r),h=Vt(0,r*.7),d=Vt(30,220),u=Vt(1,5),f=i.createLinearGradient(l,h,l,h+d);f.addColorStop(0,`rgba(96,58,28,${Vt(.05,.2)})`),f.addColorStop(1,"rgba(96,58,28,0)"),i.fillStyle=f,i.fillRect(l,h,u,d)}i.strokeStyle="rgba(240,244,248,0.14)";for(let c=0;c<70;c++){i.lineWidth=Vt(.4,1.3),i.beginPath();const l=Vt(0,r),h=Vt(0,r),d=Vt(0,6.283),u=Vt(6,46);i.moveTo(l,h),i.lineTo(l+Math.cos(d)*u,h+Math.sin(d)*u),i.stroke()}const a=new Ks(n);return a.wrapS=a.wrapT=vi,a.anisotropy=8,a.colorSpace=Ie,a}function xw(r=1024){const t=Qs(r),e=t.getContext("2d");e.fillStyle="#8d8a80",e.fillRect(0,0,r,r);for(let i=0;i<900;i++){const s=Vt(0,r),o=Vt(0,r),a=Vt(4,90);e.fillStyle=`rgba(${Math.random()>.5?"110,104,94":"72,70,66"},${Vt(.03,.14)})`,e.beginPath(),e.arc(s,o,a,0,6.283),e.fill()}for(let i=0;i<9e3;i++){const s=Vt(0,r),o=Vt(0,r),a=Vt(.5,2.2),c=Math.random()>.5?210:70;e.fillStyle=`rgba(${c},${c},${c-6},${Vt(.04,.2)})`,e.beginPath(),e.arc(s,o,a,0,6.283),e.fill()}e.strokeStyle="rgba(58,56,52,0.22)";for(let i=0;i<40;i++){e.lineWidth=Vt(.6,2.2),e.beginPath();let s=Vt(0,r),o=Vt(0,r);e.moveTo(s,o);for(let a=0;a<6;a++)s+=Vt(-70,70),o+=Vt(-40,90),e.lineTo(s,o);e.stroke()}const n=new Ks(t);return n.wrapS=n.wrapT=vi,n.anisotropy=8,n.colorSpace=Ie,n}function yw(r=512){const t=Qs(r),e=t.getContext("2d");e.fillStyle="#6c7176",e.fillRect(0,0,r,r);for(let i=0;i<r;i+=64)for(let s=0;s<r;s+=64)e.fillStyle=`rgba(${Vt(80,130)},${Vt(84,132)},${Vt(88,136)},0.5)`,e.fillRect(s+1,i+1,62,62);for(let i=12;i<r;i+=64)for(let s=12;s<r;s+=64)Math.random()<.72&&(e.fillStyle=Math.random()<.18?"rgba(255,170,90,0.35)":"rgba(18,20,24,0.85)",e.fillRect(s,i,34,26),e.fillStyle="rgba(0,0,0,0.4)",e.fillRect(s,i+26,34,3));for(let i=0;i<120;i++){const s=Vt(0,r),o=Vt(0,r),a=Vt(10,90),c=e.createRadialGradient(s,o,0,s,o,a);c.addColorStop(0,`rgba(24,22,20,${Vt(.05,.3)})`),c.addColorStop(1,"rgba(24,22,20,0)"),e.fillStyle=c,e.beginPath(),e.arc(s,o,a,0,6.283),e.fill()}const n=new Ks(t);return n.wrapS=n.wrapT=vi,n.colorSpace=Ie,n.anisotropy=8,n}function Mw(r="36",{color:t="#2c3238",size:e=256}={}){const n=Qs(e),i=n.getContext("2d");i.clearRect(0,0,e,e),i.fillStyle=t,i.font=`700 ${e*.72}px "Arial Black", Impact, sans-serif`,i.textAlign="center",i.textBaseline="middle",i.fillText(r,e/2,e*.52),i.globalCompositeOperation="destination-out";for(let o=0;o<160;o++)i.fillStyle=`rgba(0,0,0,${Vt(.1,.7)})`,i.beginPath(),i.arc(Vt(0,e),Vt(0,e),Vt(.5,3.4),0,6.283),i.fill();const s=new Ks(n);return s.colorSpace=Ie,s.anisotropy=8,s}function Sw(r=128){const t=Qs(r),e=t.getContext("2d");e.fillStyle="#f2f4f6",e.fillRect(0,0,r,r),e.fillStyle="#1c3f8f",e.fillRect(0,r/3,r,r/3),e.fillStyle="#c0232e",e.fillRect(0,r/3*2,r,r/3),e.globalAlpha=.18;for(let i=0;i<60;i++)e.fillStyle="#3b3428",e.beginPath(),e.arc(Vt(0,r),Vt(0,r),Vt(1,8),0,6.283),e.fill();const n=new Ks(t);return n.colorSpace=Ie,n}function El(r=128,t="rgba(255,255,255,1)",e="rgba(255,255,255,0)"){const n=Qs(r),i=n.getContext("2d"),s=i.createRadialGradient(r/2,r/2,0,r/2,r/2,r/2);s.addColorStop(0,t),s.addColorStop(.45,"rgba(255,255,255,0.42)"),s.addColorStop(1,e),i.fillStyle=s,i.fillRect(0,0,r,r);const o=new Ks(n);return o.colorSpace=Ie,o}function Of(r,t=0,e=0,n=0,i=1.35){const s=r.attributes.position;if(!s)return r;const o=r.attributes.normal,a=s.count,c=new Float32Array(a*2);for(let l=0;l<a;l++){const h=s.getX(l)+t,d=s.getY(l)+e,u=s.getZ(l)+n;let f=0,m=0,v=0;o&&(f=Math.abs(o.getX(l)),m=Math.abs(o.getY(l)),v=Math.abs(o.getZ(l)));let p,g;f>=m&&f>=v?(p=u,g=d):m>=f&&m>=v?(p=h,g=u):(p=h,g=d),c[l*2]=p/i,c[l*2+1]=g/i}return r.setAttribute("uv",new Ve(c,2)),r}/* ---- общие помощники скругления и фасок ---------------------------- */
// Скруглённый бокс: подразделённая BoxGeometry, вершины которой спроецированы на
// скруглённый куб. normal/uv отбрасываются перед _w(), чтобы совпадающие вершины
// граней сваривались и фаска шейдилась гладко; Of() возвращает плоские UV.
function VCH_roundBox(r,t,e,n){
  const s=new _e(r,t,e,4,4,4),p=s.attributes.position,
        q=Math.min(n||.02,Math.min(r,t,e)*.45),
        a=r/2-q,b=t/2-q,c=e/2-q;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),
          u=Math.max(-a,Math.min(a,x)),v=Math.max(-b,Math.min(b,y)),w=Math.max(-c,Math.min(c,z)),
          d=Math.hypot(x-u,y-v,z-w)||1;
    p.setXYZ(i,u+(x-u)/d*q,v+(y-v)/d*q,w+(z-w)/d*q)
  }
  p.needsUpdate=!0,s.deleteAttribute("normal"),s.deleteAttribute("uv");
  const g=_w(s,1e-5);g.computeVertexNormals();return Of(g,0,0,0,1.25)
}
// Скругление углов для ОТКРЫТОЙ 2D-полилинии (лате-профили). Ew() обрабатывает
// замкнутые полигоны; здесь оба конца сохраняются, а каждый внутренний угол
// получает короткую квадратичную дугу — так скругляются ободья колёс и плечи без
// изменения CAD.
function VCH_roundProfile(r,t=.010,e=3){
  const n=r.length;if(n<3)return r;const o=[r[0]];
  for(let i=1;i<n-1;i++){
    const a=r[i-1],c=r[i],b=r[i+1],u=[a[0]-c[0],a[1]-c[1]],v=[b[0]-c[0],b[1]-c[1]],
          h=Math.hypot(u[0],u[1])||1,f=Math.hypot(v[0],v[1])||1,
          m=Math.max(.0005,Math.min(t,h*.42,f*.42)),
          A=[c[0]+u[0]/h*m,c[1]+u[1]/h*m],B=[c[0]+v[0]/f*m,c[1]+v[1]/f*m];
    for(let k=0;k<=e;k++){const s=k/e,j=1-s;
      o.push([j*j*A[0]+2*j*s*c[0]+s*s*B[0],j*j*A[1]+2*j*s*c[1]+s*s*B[1]])}
  }
  return o.push(r[n-1]),o
}
// Осреднение нормалей вершин с одинаковой позицией. Топология и UV остаются целыми,
// поэтому текстурированные материалы сохраняют развёртку, а жёсткие кромки шейдятся
// как круглые.

// Проход по всей модели: настоящие фаски на оставшихся боксах, гладкий шейдинг на
// всех прочих поверхностях, flatShading выключен, чтобы скруглённые нормали были
// реально видны.
/*
  Восстановление нормалей с учётом рёбер: выкидываем вырожденные треугольники,
  сглаживаем только внутри действительно непрерывных поверхностей, а жёсткие
  кромки панелей оставляем жёсткими. Это убирает швы затенения, которые
  появлялись от усреднения несвязанных нормалей.
 */
function VCH_repairNormals(g){
  let src=g.index?g.toNonIndexed():g.clone();
  let p=src.attributes.position;
  if(!p||p.isInterleavedBufferAttribute)return src;
  let tri=Math.floor(p.count/3);
  const keep=new Uint8Array(tri),fn0=new Float32Array(tri*3);
  for(let t=0;t<tri;t++){
    const a=3*t,b=a+1,c=a+2,ax=p.getX(a),ay=p.getY(a),az=p.getZ(a);
    const ux=p.getX(b)-ax,uy=p.getY(b)-ay,uz=p.getZ(b)-az,vx=p.getX(c)-ax,vy=p.getY(c)-ay,vz=p.getZ(c)-az;
    let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
    const L=Math.hypot(nx,ny,nz);
    if(L>1e-12){fn0[3*t]=nx/L,fn0[3*t+1]=ny/L,fn0[3*t+2]=nz/L,keep[t]=1}
  }
  let dropped=0;for(let t=0;t<tri;t++)if(!keep[t])dropped++;
  if(dropped&&!(src.groups&&src.groups.length)){
    const out=new Pe(),n=tri-dropped;
    for(const name of Object.keys(src.attributes)){
      if(name==="normal")continue;
      const a=src.attributes[name],Arr=a.array.constructor,arr=new Arr(n*3*a.itemSize);
      let o=0;
      for(let t=0;t<tri;t++)if(keep[t])for(let k=0;k<3;k++){
        const i=3*t+k;for(let c=0;c<a.itemSize;c++)arr[o++]=a.array[i*a.itemSize+c]}
      out.setAttribute(name,new a.constructor(arr,a.itemSize,a.normalized))
    }
    src=out,p=src.attributes.position,tri=n
  }
  const fn=new Float32Array(tri*3),keys=new Array(p.count),groups=new Map(),q=v=>Math.round(v*1e4);
  for(let i=0;i<p.count;i++)keys[i]=q(p.getX(i))+","+q(p.getY(i))+","+q(p.getZ(i));
  for(let t=0;t<tri;t++){
    const a=3*t,b=a+1,c=a+2,ax=p.getX(a),ay=p.getY(a),az=p.getZ(a);
    const ux=p.getX(b)-ax,uy=p.getY(b)-ay,uz=p.getZ(b)-az,vx=p.getX(c)-ax,vy=p.getY(c)-ay,vz=p.getZ(c)-az;
    let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
    const L=Math.hypot(nx,ny,nz)||1;fn[3*t]=nx/L,fn[3*t+1]=ny/L,fn[3*t+2]=nz/L;
    for(let k=0;k<3;k++){const kk=keys[a+k];let arr=groups.get(kk);arr||groups.set(kk,arr=[]);arr.push(t)}
  }
  const n=new ne(new Float32Array(p.count*3),3),cosMin=.35,
    ok=j=>fn[3*j]*fn[3*j]+fn[3*j+1]*fn[3*j+1]+fn[3*j+2]*fn[3*j+2]>.5;
  for(let t=0;t<tri;t++){
    const bx=fn[3*t],by=fn[3*t+1],bz=fn[3*t+2];
    for(let k=0;k<3;k++){
      const i=3*t+k,arr=groups.get(keys[i]);let sx=0,sy=0,sz=0;
      for(const j of arr){if(!ok(j))continue;const x=fn[3*j],y=fn[3*j+1],z=fn[3*j+2];
        if(bx*x+by*y+bz*z>=cosMin){sx+=x,sy+=y,sz+=z}}
      let L=Math.hypot(sx,sy,sz);
      if(L<1e-8){sx=0,sy=0,sz=0;for(const j of arr){if(!ok(j))continue;sx+=fn[3*j],sy+=fn[3*j+1],sz+=fn[3*j+2]}L=Math.hypot(sx,sy,sz)}
      if(L<1e-8){sx=0,sy=1,sz=0,L=1}
      n.setXYZ(i,sx/L,sy/L,sz/L)
    }
  }
  return src.setAttribute("normal",n),n.needsUpdate=!0,src
}
function VCH_applyAll(root){
  const rep=new Map();
  root.traverse(o=>{if(!o.isMesh||o.isInstancedMesh||!o.geometry||rep.has(o.geometry))return;
    const old=o.geometry;let g=old;
    /* 6.5: у бокса с текстурой не трогаем геометрию — roundBox выдаёт вершины без
       UV (они восстанавливаются плоско, но для карты это уже неверная развёртка),
       поэтому такие меши остаются с исходной геометрией и корректными UV. */
    const mats=Array.isArray(o.material)?o.material:[o.material];
    if(mats.some(m=>m&&m.map))return;
    if(g.type==="BoxGeometry"&&g.parameters){const p=g.parameters;
      g=VCH_roundBox(p.width,p.height,p.depth,Math.min(.028,Math.min(p.width,p.height,p.depth)*.3))}
    g=VCH_repairNormals(g);
    rep.set(old,g)});
  root.traverse(o=>{if(!o.isMesh||o.isInstancedMesh)return;
    if(o.geometry&&rep.has(o.geometry))o.geometry=rep.get(o.geometry);
    const M=Array.isArray(o.material)?o.material:[o.material];
    for(const x of M)x&&x.flatShading&&(x.flatShading=!1,x.needsUpdate=!0)})
}
function ww(r,t,e,n=.075){const i=Math.min(n,Math.min(r,t,e)*.45),s=new $l,o=r/2-i,a=t/2-i;s.moveTo(-o,-t/2),s.lineTo(o,-t/2),s.lineTo(r/2,-a),s.lineTo(r/2,a),s.lineTo(o,t/2),s.lineTo(-o,t/2),s.lineTo(-r/2,a),s.lineTo(-r/2,-a),s.closePath();const c=new Ma(s,{depth:Math.max(.001,e-i*2),bevelEnabled:!0,bevelThickness:i,bevelSize:i*.85,bevelSegments:2,curveSegments:1});return c.translate(0,0,-(e-i*2)/2),c.computeVertexNormals(),c}function zf(r,t,{flip:e=!1,capStart:n=!0,capEnd:i=!0}={}){const s={z:(m,v,p)=>[v,p,m],y:(m,v,p)=>[v,m,p],x:(m,v,p)=>[m,v,p]}[r],o=t[0].pts.length,a=[],c=[],l=[],h=(m,v,p)=>{const[g,_,x]=s(m,v,p);return a.push(g,_,x),c.push((v+p)*.22+m*.14,(p-v)*.22+m*.2),a.length/3-1},d=t.map(m=>m.pts.map(([v,p])=>h(m.at,v,p)));for(let m=0;m<t.length-1;m++)for(let v=0;v<o;v++){const p=(v+1)%o,g=d[m][v],_=d[m][p],x=d[m+1][p],y=d[m+1][v];e?l.push(g,x,_,g,y,x):l.push(g,_,x,g,x,y)}const u=(m,v)=>{const p=[];for(let g=0;g<o;g++){const _=m[g]*3;a.push(a[_],a[_+1],a[_+2]),c.push(c[m[g]*2],c[m[g]*2+1]),p.push(a.length/3-1)}for(let g=1;g<o-1;g++){const _=p[0],x=p[g],y=p[g+1];v?l.push(_,y,x):l.push(_,x,y)}};n&&u(d[0],!0),i&&u(d[d.length-1],!1);const f=new Pe;return f.setAttribute("position",new ne(a,3)),f.setAttribute("uv",new ne(c,2)),f.setIndex(l),f.computeVertexNormals(),f}function bw(r,t,e,n){const i=1-n;return[i*i*r[0]+2*i*n*t[0]+n*n*e[0],i*i*r[1]+2*i*n*t[1]+n*n*e[1]]}function Ew(r,t=.08,e=3){const n=r.length,i=[];for(let o=0;o<n;o++){const a=r[(o-1+n)%n],c=r[o],l=r[(o+1)%n],h=[a[0]-c[0],a[1]-c[1]],d=[l[0]-c[0],l[1]-c[1]],u=Math.hypot(h[0],h[1])||1,f=Math.hypot(d[0],d[1])||1,m=Math.max(.012,Math.min(t,u*.46,f*.46)),v=[c[0]+h[0]/u*m,c[1]+h[1]/u*m],p=[c[0]+d[0]/f*m,c[1]+d[1]/f*m];for(let g=0;g<=e;g++)i.push(bw(v,c,p,g/e))}const s=[];for(const o of i){const a=s[s.length-1];(!a||Math.hypot(o[0]-a[0],o[1]-a[1])>1e-4)&&s.push(o)}return s}function ud(r,t,e,n,i){const s=i*i,o=s*i;return .5*(2*t+(-r+e)*i+(2*r-5*t+4*e-n)*s+(-r+3*t-3*e+n)*o)}function Tw(r,t=3){const e=r.length,n=[];for(let i=0;i<e-1;i++){const s=r[Math.max(0,i-1)],o=r[i],a=r[i+1],c=r[Math.min(e-1,i+2)];for(let l=0;l<t;l++){const h=l/t;n.push({at:o.at+(a.at-o.at)*h,pts:o.pts.map((d,u)=>{const f=s.pts[u]||d,m=o.pts[u]||d,v=a.pts[u]||d,p=c.pts[u]||d;return[ud(f[0],m[0],v[0],p[0],h),ud(f[1],m[1],v[1],p[1],h)]})})}}return n.push(r[e-1]),n}function gr(r,t,{radius:e=.12,segs:n=3,subdiv:i=3,flip:s=!1,capStart:o=!0,capEnd:a=!0}={}){const c=t.map(d=>({at:d.at,pts:e>0?Ew(d.pts,d.r??e,n):d.pts})),l=i>1?Tw(c,i):c,h=zf(r,l,{flip:s,capStart:o,capEnd:a});return h.computeVertexNormals(),rh(h)}function Aw(r,t,e,n=.04,i=14,s=9){const o=r/2,a=t/2,c=e/2,l=Math.max(.04,Math.min(.3,1.15*n/Math.min(o,a,c))),h=g=>Math.sign(Math.cos(g))*Math.pow(Math.abs(Math.cos(g)),l),d=g=>Math.sign(Math.sin(g))*Math.pow(Math.abs(Math.sin(g)),l),u=[],f=[],m=[];for(let g=0;g<=s;g++){const _=-Math.PI/2+Math.PI*g/s,x=h(_),y=d(_);for(let R=0;R<=i;R++){const A=-Math.PI+2*Math.PI*R/i;u.push(o*x*h(A),a*y,c*x*d(A)),f.push(R/i,g/s)}}const v=i+1;for(let g=0;g<s;g++)for(let _=0;_<i;_++){const x=g*v+_,y=x+1,R=x+v,A=R+1;m.push(x,R,y,y,R,A)}const p=new Pe;return p.setAttribute("position",new ne(u,3)),p.setAttribute("uv",new ne(f,2)),p.setIndex(m),p.computeVertexNormals(),p}function ze(r,t=24,e="y"){const n=VCH_roundProfile(r).map(([s,o])=>new ct(Math.max(4e-4,s),o)),i=new Kl(n,t);return e==="z"?i.rotateX(Math.PI/2):e==="x"&&i.rotateZ(-Math.PI/2),i.computeVertexNormals(),rh(i)}function Wi(r,t=.018,e=.4,n=!1){const i=new ff(r.map(a=>new P(a[0],a[1],a[2])),n,"catmullrom",e),s=Math.max(8,Math.min(120,r.length*8)),o=new Zl(i,s,t,6,n);return o.computeVertexNormals(),o}function Bf(r,t,e,n=.05,i=3){const s=Math.max(.0015,Math.min(n,Math.min(r,t,e)*.48)),o=new $l,a=r/2-s,c=t/2-s;o.moveTo(-a,-t/2),o.lineTo(a,-t/2),o.quadraticCurveTo(r/2,-t/2,r/2,-c),o.lineTo(r/2,c),o.quadraticCurveTo(r/2,t/2,a,t/2),o.lineTo(-a,t/2),o.quadraticCurveTo(-r/2,t/2,-r/2,c),o.lineTo(-r/2,-c),o.quadraticCurveTo(-r/2,-t/2,-a,-t/2),o.closePath();let l=new Ma(o,{depth:Math.max(.002,e-s*2),bevelEnabled:!0,bevelThickness:s,bevelSize:s,bevelSegments:i,curveSegments:3,steps:1});return l.translate(0,0,-(e-s*2)/2),l.deleteAttribute("normal"),l.deleteAttribute("uv"),l=_w(l,1e-5),l.computeVertexNormals(),rh(l)}function rh(r){const t=r.index,e=r.attributes.position;if(!e)return r;let n=0;const i=new P,s=new P,o=new P,a=t?t.count:e.count;for(let c=0;c<a;c+=3){const l=t?t.getX(c):c,h=t?t.getX(c+1):c+1,d=t?t.getX(c+2):c+2;i.fromBufferAttribute(e,l),s.fromBufferAttribute(e,h),o.fromBufferAttribute(e,d),n+=i.dot(s.clone().cross(o))/6}if(n<0){if(t){const c=t.array;for(let l=0;l<c.length;l+=3){const h=c[l+1];c[l+1]=c[l+2],c[l+2]=h}t.needsUpdate=!0}else{const c=e.array;for(let l=0;l<c.length;l+=9)for(let h=0;h<3;h++){const d=c[l+3+h];c[l+3+h]=c[l+6+h],c[l+6+h]=d}if(e.needsUpdate=!0,r.attributes.normal){const l=r.attributes.normal.array;for(let h=0;h<l.length;h++)l[h]=-l[h];r.attributes.normal.needsUpdate=!0}}r.computeVertexNormals()}return r}const Ps=420;function Cw(){return{x:new Float32Array(Ps),z:new Float32Array(Ps),y:new Float32Array(Ps),nz:new Float32Array(Ps),ny:new Float32Array(Ps),n:0}}function Pw(r){const t=[];for(let e=0;e<r;e++)t.push({x:0,z:0,y:0,r:.3});return t}function Lw(r,t,e){
  // Осевая линия трака. Участок по земле — монотонный сплайн, касательный к каждому
  // опорному катку, поэтому все катки сохраняют контакт и никакая обёртка не может
  // вывернуться в точку возврата или в петлю на 360 градусов при артикуляции
  // подвески.
  r.n=0;
  const TAU=2*Math.PI;
  const guard=[];
  const push=(x,z,y,nz,ny)=>{
    const k=r.n;
    if(k>=Ps)return;
    // Держим осевую линию на ободе каждого опорного катка или снаружи него: сплайн
    // может изогнуться чуть круче обода сразу после узла контакта.
    for(let i=0;i<guard.length;i++){
      const c=guard[i];
      if(Math.abs(x-c.x)>.02)continue;
      const dz=z-c.z,dy=y-c.y,d=Math.hypot(dz,dy);
      if(d<c.r&&d>1e-6){const s=c.r/d;z=c.z+dz*s;y=c.y+dy*s;nz=dz/d;ny=dy/d;}
    }
    if(k>0&&Math.hypot(x-r.x[k-1],z-r.z[k-1],y-r.y[k-1])<1e-6)return;
    r.x[k]=x;r.z[k]=z;r.y[k]=y;r.nz[k]=nz;r.ny[k]=ny;r.n++;
  };
  const norm=(z,y)=>{const h=Math.hypot(z,y)||1;return{z:z/h,y:y/h}};
  const point=(c,n)=>({x:c.x,z:c.z+c.r*n.z,y:c.y+c.r*n.y,nz:n.z,ny:n.y});
  const add=p=>push(p.x,p.z,p.y,p.nz,p.ny);
  const segment=(a,b)=>{
    const dz=b.z-a.z,dy=b.y-a.y,dx=b.x-a.x;
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dy,dz)/.07),Math.ceil(Math.abs(dx)/.018));
    for(let k=1;k<=steps;k++){
      const u=k/steps,w=u*u*(3-2*u),n=norm(a.nz+(b.nz-a.nz)*u,a.ny+(b.ny-a.ny)*u);
      push(a.x+dx*w,a.z+dz*u,a.y+dy*u,n.z,n.y);
    }
  };
  // Кубический участок Эрмита между двумя узлами; наклоны заданы как dy/dz, x
  // смешивается плавно.
  const run=(az,ay,as,ax,bz,by,bs,bx)=>{
    const h=bz-az,steps=Math.max(4,Math.ceil(Math.abs(h)/.035));
    for(let k=1;k<=steps;k++){
      const u=k/steps,u2=u*u,u3=u2*u,w=u2*(3-2*u);
      const y=(2*u3-3*u2+1)*ay+(u3-2*u2+u)*h*as+(-2*u3+3*u2)*by+(u3-u2)*h*bs;
      const dy=(6*u2-6*u)*ay+(3*u2-4*u+1)*h*as+(-6*u2+6*u)*by+(3*u2-2*u)*h*bs;
      const n=norm(dy/h,-1);
      push(ax+(bx-ax)*w,az+h*u,y,n.z,n.y);
    }
  };
  const arc=(c,from,to)=>{
    const a=Math.atan2(from.y,from.z),b=Math.atan2(to.y,to.z);
    const sweep=((a-b)%TAU+TAU)%TAU,delta=-sweep;
    if(Math.abs(delta)<1e-7){add(point(c,to));return}
    const steps=Math.max(1,Math.ceil(Math.abs(delta)/.05));
    for(let k=1;k<=steps;k++){
      const angle=a+delta*k/steps;
      add(point(c,{z:Math.cos(angle),y:Math.sin(angle)}));
    }
  };
  // Самая низкая касательная из окружности катка к точке: трак уходит с крайнего
  // катка по касательной и провисает вниз к первому опорному катку.
  const lowerTangent=(c,pz,py)=>{
    const dz=pz-c.z,dy=py-c.y,h=Math.hypot(dz,dy)||1e-6,u=norm(dz,dy);
    const q=Math.max(-1,Math.min(1,c.r/h)),v=Math.sqrt(Math.max(0,1-q*q));
    const n1={z:u.z*q-u.y*v,y:u.y*q+u.z*v},n2={z:u.z*q+u.y*v,y:u.y*q-u.z*v};
    return n1.y<n2.y?n1:n2;
  };
  const upperTangent=(c,p,side)=>{
    const dz=p.z-c.z,dy=p.y-c.y,h=Math.hypot(dz,dy)||1e-6,u=norm(dz,dy);
    const q=Math.max(-1,Math.min(1,c.r/h)),v=Math.sqrt(Math.max(0,1-q*q))*side;
    return{z:u.z*q-u.y*v,y:u.y*q+u.z*v};
  };
  let lastRoad=0;
  for(let k=1;k<e&&t[k].kind==="wheel";k++)lastRoad=k;
  const sprocket=t[lastRoad+1],idler=t[0],road=[];
  for(let k=1;k<=lastRoad;k++)road.push(t[k]);
  const m=road.length;
  if(m<2)return r;
  for(const c of road)guard.push(c);
  // Узлы контакта: каждый опускается на r*sqrt(1+slope^2), чтобы сплайн оставался
  // касательным к катку и не врезался в его обод на склоне.
  const zs=road.map(c=>c.z),ys=road.map(c=>c.y),rr=road[0].r;
  let q=ys.map(y=>y-rr),slope=new Array(m).fill(0);
  const secant=i=>(q[i+1]-q[i])/(zs[i+1]-zs[i]);
  for(let pass=0;pass<4;pass++){
    for(let i=0;i<m;i++){
      if(i===0||i===m-1){slope[i]=0;continue}
      const d0=secant(i-1),d1=secant(i);
      if(d0*d1<=0){slope[i]=0;continue}
      let v=(d0+d1)*.5;
      const lim=3*Math.min(Math.abs(d0),Math.abs(d1));
      if(Math.abs(v)>lim)v=Math.sign(v)*lim;
      slope[i]=v;
    }
    q=ys.map((y,i)=>y-rr*Math.sqrt(1+slope[i]*slope[i]));
  }
  const frontN=lowerTangent(idler,zs[0],q[0]),frontP=point(idler,frontN);
  const rearN=lowerTangent(sprocket,zs[m-1],q[m-1]),rearP=point(sprocket,rearN);
  const firstRoller=t[lastRoad+2],lastRoller=t[e-1];
  const rearUpper=upperTangent(sprocket,{z:firstRoller.z,y:firstRoller.y+firstRoller.r},1);
  const frontUpper=upperTangent(idler,{z:lastRoller.z,y:lastRoller.y+lastRoller.r},-1);
  add(frontP);
  run(frontP.z,frontP.y,(q[0]-frontP.y)/(zs[0]-frontP.z),frontP.x,zs[0],q[0],0,road[0].x);
  for(let i=0;i<m-1;i++)run(zs[i],q[i],slope[i],road[i].x,zs[i+1],q[i+1],slope[i+1],road[i+1].x);
  run(zs[m-1],q[m-1],0,road[m-1].x,rearP.z,rearP.y,(rearP.y-q[m-1])/(rearP.z-zs[m-1]),rearP.x);
  arc(sprocket,rearN,rearUpper);
  let previous=rearP;
  previous=point(sprocket,rearUpper);
  for(let k=lastRoad+2;k<e;k++){
    const c=t[k],top={x:c.x,z:c.z,y:c.y+c.r,nz:0,ny:1};
    segment(previous,top);previous=top;
  }
  segment(previous,point(idler,frontUpper));
  arc(idler,frontUpper,frontN);
  if(r.n>1&&Math.hypot(r.x[r.n-1]-r.x[0],r.z[r.n-1]-r.z[0],r.y[r.n-1]-r.y[0])<1e-6)r.n--;
  return r;
}function Iw(r){
  const t={cum:new Float32Array(Ps+1),total:1};
  t.build=()=>{
    let length=0;t.cum[0]=0;
    for(let i=0;i<r.n;i++){
      const j=(i+1)%r.n;
      length+=Math.hypot(r.x[j]-r.x[i],r.z[j]-r.z[i],r.y[j]-r.y[i]);
      t.cum[i+1]=length;
    }
    t.total=length||1;return t;
  };
  t.at=(distance,out)=>{
    let s=distance%t.total;if(s<0)s+=t.total;
    let lo=0,hi=r.n;
    while(lo<hi){const mid=lo+hi>>1;if(t.cum[mid+1]<s)lo=mid+1;else hi=mid;}
    const i=Math.min(lo,r.n-1),j=(i+1)%r.n;
    const span=t.cum[i+1]-t.cum[i]||1e-6,u=(s-t.cum[i])/span;
    out.x=r.x[i]+(r.x[j]-r.x[i])*u;
    out.z=r.z[i]+(r.z[j]-r.z[i])*u;
    out.y=r.y[i]+(r.y[j]-r.y[i])*u;
    out.nz=r.nz[i]+(r.nz[j]-r.nz[i])*u;
    out.ny=r.ny[i]+(r.ny[j]-r.ny[i])*u;
    const n=Math.hypot(out.nz,out.ny)||1;out.nz/=n;out.ny/=n;
    const dx=r.x[j]-r.x[i],dz=r.z[j]-r.z[i],dy=r.y[j]-r.y[i],h=Math.hypot(dx,dy,dz)||1;
    out.tx=dx/h;out.tz=dz/h;out.ty=dy/h;
    return out;
  };
  return t;
}const Kt={groundY:-1.1,length:6.5,trackHalfTrack:1.33,trackWidth:.56,wheelRadius:.40,roadWheelZ:[1.83,.915,0,-.915,-1.83],roadWheelY:-.64,sprocket:{z:-2.68,y:-.14,r:.35},idler:{z:2.68,y:-.14,r:.35},rollers:[{z:1.28},{z:0},{z:-1.28}],rollerY:.085,rollerR:.09,linksPerSide:80,maxLinks:160,trackPitch:.169,endWheelOffset:.10,trackShoe:.062,wheelTravelUp:.17,trackNotch:.05},oh=Math.PI*2;

/*
  Отдельная карта изношенной стали для траков: пятна ржавчины, плотное зерно и
  короткие царапины — без длинных направленных штрихов, которые читались бы как
  дерево.
 */
function VCH_trackTex(){
 /* 2.3: та же картинка, но считается в воркере (заглушка 8×8 до готовности) */
 return VCH_SB_tex((g,N)=>{
  g.fillStyle="#4a4a45";g.fillRect(0,0,N,N);
  for(let c=0;c<110;c++){
   const x=Vt(0,N),y=Vt(0,N),d=Vt(10,72),
         gr=g.createRadialGradient(x,y,0,x,y,d),rust=Math.random()<.62;
   gr.addColorStop(0,rust?`rgba(112,86,62,${Vt(.12,.34)})`:`rgba(20,22,21,${Vt(.24,.58)})`);
   gr.addColorStop(1,"rgba(0,0,0,0)");g.fillStyle=gr;g.beginPath();g.arc(x,y,d,0,6.283);g.fill()
  }
  for(let c=0;c<9000;c++){
   const v=(Math.random()-.5)*70|0;
   g.fillStyle=`rgba(${132+v},${130+v},${122+v},${Vt(.05,.18)})`;
   g.fillRect(Vt(0,N),Vt(0,N),Vt(.5,2),Vt(.5,2))
  }
  g.strokeStyle="rgba(212,214,210,0.18)";
  for(let c=0;c<160;c++){
   const x=Vt(0,N),y=Vt(0,N),a2=Vt(0,6.283),l=Vt(3,20);
   g.lineWidth=Vt(.4,1.1);g.beginPath();g.moveTo(x,y);g.lineTo(x+Math.cos(a2)*l,y+Math.sin(a2)*l);g.stroke()
  }
 },1);
}
