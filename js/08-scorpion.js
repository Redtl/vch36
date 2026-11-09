/* ==========================================================================
   vch36 · js/08-scorpion.js
   модель Scorpion и прогрев шейдеров
   Из index.html (4.2 «разбиение на модули»). Порядок загрузки задан в index.html
   тегами <script defer>; «use strict» сохранён — исходный код был модулем.
   ========================================================================== */
"use strict";
/* ---- прогрев шейдеров: компилируем ВСЕ материалы сцены на загрузке, чтобы
   первый взрыв/первая ракета не спотыкались о линковку программ ---------- */
function vWarmUp(tag){
  try{
    if(!Jn||!cn||!ye)return;
    const t0=performance.now();
    Jn.compile(cn,ye);
    Jn.setRenderTarget(null);
    Jn.render(cn,ye);
    window.__vWarm=window.__vWarm||[];
    window.__vWarm.push({tag,ms:Math.round(performance.now()-t0),programs:Jn.info.programs.length})
  }catch(e){console.warn('warm-up',e)}
}
const pa=new Ef;let qo=0;const Xo=1/60;let Yo=0,Pc=0;function np(){requestAnimationFrame(np);
  /* 4.2: defer-скрипты исполняются отдельными задачами, поэтому rAF может
     сработать между модулями. Кадр стартует только после того, как весь код
     загружен (флаг ставится в конце 18-boot.js). */
  if(window.__vchBooted!==!0)return;
  const r=Math.min(pa.getDelta(),.05);ip(window.__vchPaused===!0?0:r,!0)}const VCH_SCORPION_B64=VCH_SCORPION_B64_DATA;
/* ============================================================================
   VCH · ВТОРОЙ ТАНК: SCORPION (GLB)  — собственный риг и собственная физика
   ОБТ-36 остаётся танком №1; Kt не меняется.
   ========================================================================== */
/* ---------------------------------------------------------------------------
   Страховка для cannon-es: у части статических пропсов бокс-бокс контакт
   падает с "Cannot read properties of undefined". Такая пара просто
   пропускается — кадр не должен ронять игру.
   ------------------------------------------------------------------------- */


const VCH_SC_CFG={
  scale:0.349,
  hullH:1.55,
  mass:5.4e4,
  trackWidth:0.66,
  halfTrack:1.790,
  wheelRadius:0.405,
  wheelLocalY:-0.930,
  roadZ:[-1.797,-0.892,0.064,0.909,1.820],
  sprocketZ:-2.971, sprocketY:1.151, sprocketR:0.593,
  idlerZ:2.971,     idlerY:1.240,     idlerR:0.471,
  settings:{restLength:0.550,wheelRadius:0.405,stiffness:1.62e5,damping:5.6e4,
            maxSpeed:15.0,maxReverse:7.0,accel:5.2,reverseAccel:2.9,
            rollK:3.0e5,rollD:2.2e5,rollDead:.012,yawGain:11,yawMax:18},
  weapon:{ammo:22,ammoMax:22,reload:4.6}
};

const vchScNorm=n=>String(n||"").toLowerCase().replace(/[\s._\-]+/g,"");
function vchScFind(root,key){const k=vchScNorm(key);let hit=null;root.traverse(o=>{if(!hit&&vchScNorm(o.name)===k)hit=o});return hit}
function vchScFindRe(root,re){let hit=null;root.traverse(o=>{if(!hit&&o.name&&re.test(o.name))hit=o});return hit}

async function vchScorpionGLB(){
  const s=VCH_SCORPION_B64,b=atob(s),u=new Uint8Array(b.length);
  for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);
  const ab=await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
  return (await k1(ab)).scene;
}

/* ---- лента: оболочка набора окружностей (z,y) ------------------------------ */
function vchScBelt(circles,step){
  const n=circles.length;
  let cz=0,cy=0,rs=0;for(const c of circles){cz+=c.z*c.r;cy+=c.y*c.r;rs+=c.r}
  cz/=rs||1;cy/=rs||1;
  const cs=circles.slice().sort((a,b)=>Math.atan2(a.y-cy,a.z-cz)-Math.atan2(b.y-cy,b.z-cz));
  const angs=cs.map(()=>({inn:null,out:null})),lines=[];
  for(let i=0;i<n;i++){
    const A=cs[i],B=cs[(i+1)%n],dz=B.z-A.z,dy=B.y-A.y,dist=Math.hypot(dz,dy);
    if(dist<1e-6){angs[i].out=0;angs[(i+1)%n].inn=0;lines.push(null);continue}
    const phi=Math.atan2(dy,dz),al=Math.acos(Math.max(-1,Math.min(1,(A.r-B.r)/dist)));
    let best=null;
    for(const sg of[1,-1]){
      const t=phi+sg*al,
            az=A.z+Math.cos(t)*A.r,ay=A.y+Math.sin(t)*A.r,
            bz=B.z+Math.cos(t)*B.r,by=B.y+Math.sin(t)*B.r,
            d=Math.hypot((az+bz)/2-cz,(ay+by)/2-cy);
      if(!best||d>best.d)best={d,t,az,ay,bz,by};
    }
    angs[i].out=best.t;angs[(i+1)%n].inn=best.t;
    lines.push([best.az,best.ay,best.bz,best.by]);
  }
  const raw=[];
  const arc=(c,a0,a1)=>{let d=a1-a0;while(d<0)d+=Math.PI*2;
    const k=Math.max(1,Math.ceil(Math.abs(d)*c.r/Math.max(step,1e-3)));
    for(let i=0;i<=k;i++){const t=a0+d*i/k;raw.push([c.z+Math.cos(t)*c.r,c.y+Math.sin(t)*c.r])}};
  for(let i=0;i<n;i++){
    const c=cs[i],a=angs[i],L=lines[i];
    if(a.inn!==null&&a.out!==null&&Math.abs(a.out-a.inn)>1e-5)arc(c,a.inn,a.out);
    if(L){const d=Math.hypot(L[2]-L[0],L[3]-L[1]),k=Math.max(1,Math.ceil(d/Math.max(step,1e-3)));
      for(let j=1;j<=k;j++)raw.push([L[0]+(L[2]-L[0])*j/k,L[1]+(L[3]-L[1])*j/k])}
  }
  raw.reverse();
  const pts=[],s=[];let acc=0;
  for(let i=0;i<raw.length;i++){
    const p=raw[i],q=raw[i+1];
    if(q)acc+=Math.hypot(q[0]-p[0],q[1]-p[1]);
    pts.push({z:p[0],y:p[1]});s.push(acc);
  }
  const total=acc||1;
  for(let i=0;i<pts.length;i++){
    const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)];
    let tz=a.z-b.z,ty=a.y-b.y;
    const l=Math.hypot(tz,ty)||1;pts[i].tz=tz/l;pts[i].ty=ty/l;
    /* внешняя нормаль: перпендикуляр к касательной, развёрнутый от центра петли
       (иначе грунтозацепы смотрят внутрь — «лента вывернута») */
    let nz=-pts[i].ty,ny=pts[i].tz;
    if(nz*(pts[i].z-cz)+ny*(pts[i].y-cy)<0)nz=-nz,ny=-ny;
    pts[i].nz=nz;pts[i].ny=ny;
  }
  return {pts,s,total};
}



/* ---- PBR-текстуры Скорпиона -------------------------------------------------
   Модель приходит совсем без карт, поэтому рисуем их процедурно на canvas:
   albedo (нейтральный, умножается на цвет материала), roughness, metalness и
   normal (из карты высот по Собелю). Считается один раз на страницу. */
let VCH_SC_PBR=null;
function vchScCv(n){const c=document.createElement("canvas");c.width=c.height=n;return c}
function vchScPBR(){
  if(VCH_SC_PBR)return VCH_SC_PBR;
  const S=512,TAU=Math.PI*2,
        hC=vchScCv(S),aC=vchScCv(S),nC=vchScCv(S),
        rP=vchScCv(S),rM=vchScCv(S),mP=vchScCv(S),mM=vchScCv(S),
        hh=hC.getContext("2d"),aa=aC.getContext("2d"),
        rp=rP.getContext("2d"),rm=rM.getContext("2d"),
        mp=mP.getContext("2d"),mm=mM.getContext("2d");
  /* ---- раскладка панелей и заклёпок считается ОДИН раз, чтобы все карты совпали */
  const panels=[],rivets=[],scr=[],grime=[];
  let py=0;
  while(py<S){
    const ph=64+Math.random()*86;
    let px=0;
    while(px<S){
      const pw=84+Math.random()*150;
      panels.push({x:px,y:py,w:pw,h:ph,v:Math.random()});
      for(let rx=6;rx<pw;rx+=26)rivets.push({x:px+rx,y:py+7});
      for(let ry=14;ry<ph;ry+=26)rivets.push({x:px+7,y:py+ry});
      px+=pw;
    }
    py+=ph;
  }
  for(let i=0;i<150;i++){
    const x=Math.random()*S,y=Math.random()*S,a=Math.random()*TAU,l=8+Math.random()*54;
    scr.push({x,y,x2:x+Math.cos(a)*l,y2:y+Math.sin(a)*l,w:.5+Math.random()*1.3,a:.05+Math.random()*.22});
  }
  for(let i=0;i<70;i++)grime.push({x:Math.random()*S,y:Math.random()*S,r:12+Math.random()*90,a:.03+Math.random()*.10});
  /* ---- карта высот: панели чуть разной высоты, швы вдавлены, заклёпки выпуклые */
  hh.fillStyle="#7f7f7f";hh.fillRect(0,0,S,S);
  for(const p of panels){
    const v=Math.round(120+p.v*22);
    hh.fillStyle="rgb("+v+","+v+","+v+")";hh.fillRect(p.x,p.y,p.w,p.h);
    hh.fillStyle="rgba(38,38,38,.95)";hh.fillRect(p.x,p.y,p.w,2);hh.fillRect(p.x,p.y,2,p.h);
    hh.fillStyle="rgba(196,196,196,.5)";hh.fillRect(p.x+2,p.y+2,p.w-4,1);hh.fillRect(p.x+2,p.y+2,1,p.h-4);
  }
  for(const r of rivets){
    hh.fillStyle="rgba(214,214,214,.9)";hh.beginPath();hh.arc(r.x,r.y,2.1,0,TAU);hh.fill();
    hh.fillStyle="rgba(52,52,52,.55)";hh.beginPath();hh.arc(r.x+.8,r.y+.8,2.0,0,TAU);hh.fill();
  }
  for(const q of scr){
    hh.strokeStyle="rgba(58,58,58,"+q.a+")";hh.lineWidth=q.w;
    hh.beginPath();hh.moveTo(q.x,q.y);hh.lineTo(q.x2,q.y2);hh.stroke();
  }
  /* ---- albedo: нейтральный, чуть темнее в швах и грязнее пятнами */
  aa.fillStyle="#eceae6";aa.fillRect(0,0,S,S);
  for(const p of panels){
    const v=Math.round(228+p.v*20);
    aa.fillStyle="rgb("+v+","+(v-1)+","+(v-4)+")";aa.fillRect(p.x,p.y,p.w,p.h);
    aa.fillStyle="rgba(74,74,70,.5)";aa.fillRect(p.x,p.y,p.w,2);aa.fillRect(p.x,p.y,2,p.h);
  }
  for(const r of rivets){aa.fillStyle="rgba(196,196,190,.85)";aa.beginPath();aa.arc(r.x,r.y,1.9,0,TAU);aa.fill()}
  for(const g of grime){
    const gr=aa.createRadialGradient(g.x,g.y,0,g.x,g.y,g.r);
    gr.addColorStop(0,"rgba(96,88,76,"+g.a+")");gr.addColorStop(1,"rgba(96,88,76,0)");
    aa.fillStyle=gr;aa.beginPath();aa.arc(g.x,g.y,g.r,0,TAU);aa.fill();
  }
  for(const q of scr){
    aa.strokeStyle="rgba(162,160,152,"+(q.a*1.1)+")";aa.lineWidth=q.w*.85;
    aa.beginPath();aa.moveTo(q.x,q.y);aa.lineTo(q.x2,q.y2);aa.stroke();
  }
  /* ---- шероховатость/металличность: краска слегка глянцевая, металл — блестящий,
          швы и грязь шершавее, царапины дают блеск и «железо» */
  rp.fillStyle="#b6b6b6";rp.fillRect(0,0,S,S);
  rm.fillStyle="#9e9e9e";rm.fillRect(0,0,S,S);
  mp.fillStyle="#1c1c1c";mp.fillRect(0,0,S,S);
  mm.fillStyle="#4d4d4d";mm.fillRect(0,0,S,S);
  for(const p of panels){
    const v=Math.round(150+p.v*46);
    rp.fillStyle="rgba("+v+","+v+","+v+",.85)";rp.fillRect(p.x,p.y,p.w,p.h);
    const w=Math.round(96+p.v*40);
    rm.fillStyle="rgba("+w+","+w+","+w+",.85)";rm.fillRect(p.x,p.y,p.w,p.h);
    rp.fillStyle="rgba(238,238,238,.75)";rp.fillRect(p.x,p.y,p.w,2);rp.fillRect(p.x,p.y,2,p.h);
    rm.fillStyle="rgba(200,200,200,.6)";rm.fillRect(p.x,p.y,p.w,2);rm.fillRect(p.x,p.y,2,p.h);
  }
  for(const g of grime){
    for(const[c,a0]of[[rp,"60,60,60"],[rm,"120,120,120"]]){
      const gr=c.createRadialGradient(g.x,g.y,0,g.x,g.y,g.r);
      gr.addColorStop(0,"rgba("+a0+","+(g.a*2.2)+")");gr.addColorStop(1,"rgba("+a0+",0)");
      c.fillStyle=gr;c.beginPath();c.arc(g.x,g.y,g.r,0,TAU);c.fill();
    }
  }
  for(const q of scr){
    for(const[c,col]of[[rp,"rgba(70,70,70,.5)"],[rm,"rgba(70,70,70,.5)"],
                        [mp,"rgba(210,210,210,.55)"],[mm,"rgba(210,210,210,.35)"]]){
      c.strokeStyle=col;c.lineWidth=q.w;c.beginPath();c.moveTo(q.x,q.y);c.lineTo(q.x2,q.y2);c.stroke();
    }
  }
  /* ---- нормали из карты высот (Sobel, с заворотом — карта бесшовная) */
  const hs=hh.getImageData(0,0,S,S).data,nd=nC.getContext("2d").createImageData(S,S);
  const H=(x,y)=>hs[(((y+S)%S)*S+((x+S)%S))*4]/255;
  const d=nd.data;
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){
    const dx=(H(x+1,y)-H(x-1,y))*2.6,dy=(H(x,y+1)-H(x,y-1))*2.6,
          nx=-dx,ny=dy,nz=1,L=Math.sqrt(nx*nx+ny*ny+1),i=(y*S+x)*4;
    d[i]=(nx/L*.5+.5)*255;d[i+1]=(ny/L*.5+.5)*255;d[i+2]=(nz/L*.5+.5)*255;d[i+3]=255;
  }
  nC.getContext("2d").putImageData(nd,0,0);
  const mk=(cv,srgb)=>{const t=new Ks(cv);t.wrapS=t.wrapT=vi;t.anisotropy=8;
    if(srgb&&"colorSpace"in t)t.colorSpace=Ie;
    t.needsUpdate=true;return t};
  VCH_SC_PBR={albedo:mk(aC,!0),normal:mk(nC,!1),
              roughP:mk(rP,!1),roughM:mk(rM,!1),metalP:mk(mP,!1),metalM:mk(mM,!1)};
  return VCH_SC_PBR;
}


/* ---- сборка рига ----------------------------------------------------------- */
function mountScorpion(src){
  const C=VCH_SC_CFG,s=C.scale,M=Nw();
  src.updateMatrixWorld(!0);
  const A={
    turret:vchScFind(src,"tower_low")||vchScFindRe(src,_r.turret),
    gun:   vchScFind(src,"empty011"),
    barrel:vchScFind(src,"mainbarrel_low")||vchScFindRe(src,_r.barrel),
    muzzle:vchScFind(src,"empty007")||vchScFind(src,"muzzlebrake_low"),
    bandL: vchScFind(src,"cube"),
    bandR: vchScFind(src,"cube001")
  };
  if(!A.turret||!A.barrel)throw new Error("Scorpion: башня/ствол не найдены");
  if(!A.gun)A.gun=A.barrel;
  /* катки (круглые меши Gear_Low*) и рычаги */
  const wheels=[];
  src.traverse(o=>{
    if(!o.isMesh)return;
    if(!vchScNorm(o.name).startsWith("gearlow"))return;
    const bb=new Xe().setFromObject(o),sz=bb.getSize(new P),c=bb.getCenter(new P);
    if(Math.abs(sz.y-sz.z)<.08*Math.max(sz.y,sz.z))wheels.push({o,bb,sz,c});
  });
  wheels.sort((a,b)=>a.c.x-b.c.x);
  const sprockets=[vchScFind(src,"maingear_low"),vchScFind(src,"maingear_low004")].filter(Boolean);
  const idlers=[vchScFind(src,"maingear_low001"),vchScFind(src,"maingear_low005")].filter(Boolean);
  const boxOf=o=>new Xe().setFromObject(o);
  const spC=sprockets.length?boxOf(sprockets[0]).getCenter(new P):new P(-12.95,3.3,4.05);
  const idC=idlers.length?boxOf(idlers[0]).getCenter(new P):new P(4.08,3.55,5.28);
  const spR=sprockets.length?Math.max(boxOf(sprockets[0]).getSize(new P).y,boxOf(sprockets[0]).getSize(new P).z)*.5:1.7;
  const idR=idlers.length?Math.max(boxOf(idlers[0]).getSize(new P).y,boxOf(idlers[0]).getSize(new P).z)*.5:1.35;
  /* авторская лента модели (Cube/Cube001) — по ней и ставим трак: вылет/ширина */
  let bandLat=0,bandW2=0,bn=0;
  for(const bm of [vchScFind(src,"cube"),vchScFind(src,"cube001")]){
    if(!bm)continue;
    const bb2=boxOf(bm),c2=bb2.getCenter(new P),s2=bb2.getSize(new P);
    if(Math.abs(c2.z)*s<.6)continue;                 /* отсечь мелочь у оси */
    bandLat+=Math.abs(c2.z);bandW2=Math.max(bandW2,Math.abs(s2.z));bn++;
  }
  const xc=(spC.x+idC.x)*.5;
  const turretPos=new P().setFromMatrixPosition(A.turret.matrixWorld);
  const gunPos=new P().setFromMatrixPosition(A.gun.matrixWorld);
  const groundModel=Math.min.apply(null,wheels.map(w=>w.bb.min.y).concat([spC.y-spR,idC.y-idR]));
  /* контейнеры */
  const group=new Jt(),chassis=new Jt();
  chassis.position.y=-C.hullH;group.add(chassis);
  const modelRoot=new Jt();
  modelRoot.rotation.y=-Math.PI/2;modelRoot.scale.setScalar(s);
  chassis.add(modelRoot);
  src.position.x-=xc;src.position.y-=groundModel;
  modelRoot.add(src);
  const gx=mz=>-mz*s,gz=mx=>mx*s,gy=my=>my*s;
  /* башня / орудие — в ИГРОВЫХ осях (как у процедурного рига) */
  const turretStab=new ue();
  turretStab.position.set(gx(turretPos.z),gy(turretPos.y-groundModel),gz(turretPos.x-xc));
  chassis.add(turretStab);turretStab.updateMatrixWorld(!0);
  const turret=new Jt();turretStab.add(turret);turret.updateMatrixWorld(!0);
  turret.attach(A.turret);
  const gunPivot=new Jt();
  turret.updateMatrixWorld(!0);
  gunPivot.position.copy(turret.worldToLocal(new P().setFromMatrixPosition(A.gun.matrixWorld)));
  turret.add(gunPivot);gunPivot.updateMatrixWorld(!0);
  gunPivot.attach(A.gun);
  const recoilGroup=new Jt();gunPivot.add(recoilGroup);recoilGroup.updateMatrixWorld(!0);
  recoilGroup.attach(A.barrel);
  const muzzlePoint=A.muzzle||A.barrel;
  const casePort=new ue(),caseFlap=new ue();
  casePort.position.set(0,.3,-1.0);caseFlap.position.copy(casePort.position);
  gunPivot.add(casePort);gunPivot.add(caseFlap);
  /* пивоты (катки, ведущие колёса, ленивцы). Матрицы мира считаем ДО attach:
     three.js attach() берёт parent.matrixWorld — устаревшая матрица даёт
     «дёрнутые» детали (передние колёса уезжали с места и крутились не вокруг
     своего центра). Центр берём по самому крупному КРУГЛОМУ мешу узла, иначе
     bbox группы с рычагом смещает ось вращения. */
  chassis.updateMatrixWorld(!0);
  const discOf=node=>{
    let best=null,ba=-1;
    node.traverse(m=>{
      if(!m.isMesh||!m.geometry)return;
      m.geometry.computeBoundingBox();
      const g2=new Xe().setFromObject(m).getSize(new P());
      /* диск лежит в плоскости борта: высота ≈ длина, толщина любая */
      if(Math.abs(g2.y-g2.z)>.25*Math.max(g2.y,g2.z))return;
      const a=g2.y*g2.z;if(a>ba){ba=a;best=m}
    });
    return best;
  };
  /* Настоящий радиус диска по ВЕРШИНАМ (98-й процентиль расстояний от центра
     в плоскости борта). bbox повёрнутого меша завышает радиус на 10-20%:
     из-за этого лента шла на 5-14 см снаружи катков и шестерён. */
  const M4p=src.matrixWorld.constructor;
  const vRim=new P();
  const rimR=(node,lc)=>{
    const rs=[];
    node.updateWorldMatrix(!0,!0);
    node.traverse(ch=>{
      if(!ch.isMesh||!ch.geometry||!ch.geometry.attributes.position)return;
      const pos=ch.geometry.attributes.position;
      for(let i=0;i<pos.count;i+=2){
        vRim.fromBufferAttribute(pos,i).applyMatrix4(ch.matrixWorld);
        modelRoot.worldToLocal(vRim);
        rs.push(Math.hypot(vRim.x-lc.x,vRim.y-lc.y));
      }
    });
    if(!rs.length)return 0;
    rs.sort((a,b)=>a-b);
    return rs[Math.min(rs.length-1,Math.floor(rs.length*.98))]*s;
  };
  const makePivot=node=>{
    const d=discOf(node)||node;
    const bb=new Xe().setFromObject(d),c=bb.getCenter(new P()),sz=bb.getSize(new P());
    const lc=modelRoot.worldToLocal(c.clone());
    const rGeo=rimR(node,lc);
    const piv=new Jt();piv.position.copy(lc);
    modelRoot.add(piv);modelRoot.updateMatrixWorld(!0);
    piv.attach(node);modelRoot.updateMatrixWorld(!0);
    return {piv,lc,r:rGeo||Math.min(sz.y,sz.z)*.5};
  };
  const wheelRigs=[];
  for(const w of wheels){
    const {piv,lc,r}=makePivot(w.o);
    wheelRigs.push({piv,baseY:piv.position.y,r,side:lc.z>0?-1:1,
                    z:lc.x*s,y:lc.y*s,dy:0,dyT:0});
  }
  /* ведущее колесо (звёздочка) и ленивец: свои пивоты, чтобы крутились вместе
     с лентой; центры и радиусы берём ИЗ МОДЕЛИ — иначе лента идёт мимо них */
  const gearRigs=[];
  for(const [list,drive] of [[sprockets,1],[idlers,0]]){
    for(const node of list){
      if(!node||gearRigs.some(g=>g.node===node))continue;
      const {piv,lc,r}=makePivot(node);
      gearRigs.push({node,piv,drive,side:lc.z>0?-1:1,r,z:lc.x*s,y:lc.y*s});
    }
  }
  /* развёртка: у модели UV по узлам и с разным масштабом — плитка на корпусе
     выходит растянутой. Переразворачиваем «коробкой» в осях танка, чтобы
     плотность текселей была одинаковой на всей машине. */
  {
    src.updateMatrixWorld(!0);
    const M4=src.matrixWorld.constructor,
          rootInv=new M4(),mtx=new M4(),
          /* у ОБТ UV считаются Of(geom,0,0,0,1.25): один повтор карты на
             1.25 мировой единицы. повторы берём те же, иначе грязь/царапины
             на Скорпионе крупнее, чем на ОБТ */
          uvK=s/1.25;
    rootInv.copy(src.matrixWorld).invert();
    group.traverse(o=>{        /* от корня рига: башня/ствол висят на chassis, катки — на modelRoot */
      if(!o.isMesh||o.isInstancedMesh||!o.geometry)return;
      const g=o.geometry,pos=g.attributes.position,nor=g.attributes.normal;
      if(!pos||!nor)return;
      mtx.multiplyMatrices(rootInv,o.matrixWorld);
      const e=mtx.elements,cnt=pos.count,ap=pos.array,an=nor.array,
            Buf=pos.constructor,uv=new Float32Array(cnt*2);
      for(let i=0;i<cnt;i++){
        const x=ap[i*3],y=ap[i*3+1],z=ap[i*3+2],
              nx=an[i*3],ny=an[i*3+1],nz=an[i*3+2];
        const wx=e[0]*x+e[4]*y+e[8]*z+e[12],
              wy=e[1]*x+e[5]*y+e[9]*z+e[13],
              wz=e[2]*x+e[6]*y+e[10]*z+e[14],
              ax=Math.abs(e[0]*nx+e[4]*ny+e[8]*nz),
              ay=Math.abs(e[1]*nx+e[5]*ny+e[9]*nz),
              az=Math.abs(e[2]*nx+e[6]*ny+e[10]*nz);
        let u,v;
        if(ax>=ay&&ax>=az){u=wz;v=wy}
        else if(ay>=az){u=wx;v=wz}
        else{u=wx;v=wy}
        uv[i*2]=u*uvK;uv[i*2+1]=v*uvK;
      }
      g.setAttribute("uv",new Buf(uv,2));
      g.attributes.uv.needsUpdate=!0;
    });
  }
  /* ===== Материалы — ТЕ ЖЕ, что у ОБТ-36 ==================================
     У ОБТ набор M собирается в Nw(): paint/paintLight/paintDark/sleeve/
     paintWorn/wheelHub получают карту surfMaps() (периодический FBM: затёртая
     краска, потёки, царапины) + roughness/normal, а track/steel/steelDark —
     metalMaps(). Скорпион до этого рисовал СВОИ карты (vchScPBR) — отсюда
     «другая» поверхность. Теперь каждой детали выдаётся материал ОБТ по роли:
     опорные катки — wheelHub, шестерни — steel, всё крашеное — paint.
     Стекло и фары остаются своими объектами (прозрачность/эмиссия), но
     настроены по значениям оптики/фар ОБТ. */
  const wheelNodes=new Set(wheelRigs.map(w=>w.piv)),
        gearNodes=new Set(gearRigs.map(g=>g.node));
  const roleOf=o=>{
    for(let p=o;p;p=p.parent){
      if(wheelNodes.has(p))return "wheel";
      if(gearNodes.has(p))return "gear";
    }
    return null;
  };
  group.traverse(o=>{
    if(!o.isMesh||o.isInstancedMesh)return;
    o.castShadow=!0;o.receiveShadow=!0;
    const host=roleOf(o);
    const pick=mt=>{
      const nm=(mt.name||"").toLowerCase();
      if(nm.indexOf("glass")>=0){                 // оптика: как M.optic у ОБТ
        mt.transparent=!0;mt.opacity=.5;
        if(mt.color)mt.color.setHex(0x101f26);
        mt.metalness=1;mt.roughness=.08;mt.envMapIntensity=2.2;
        if("emissive"in mt){mt.emissive.setHex(0x0d3038);mt.emissiveIntensity=.5}
        mt.side=Yn;mt.needsUpdate=!0;return mt;
      }
      if(nm.indexOf("light")>=0){                 // фары: как M.lampAmber
        if(mt.color)mt.color.setHex(0xffe4a8);
        mt.metalness=.2;mt.roughness=.3;
        if("emissive"in mt){mt.emissive.setHex(0xffc164);mt.emissiveIntensity=1.5}
        mt.needsUpdate=!0;return mt;
      }
      if(host==="wheel")return M.wheelHub;        // опорный каток
      if(host==="gear")return M.steel;            // ведущее/ленивец
      /* двухцветная ливрея по референсу: бронеплиты модели («Painted metall»)
         — янтарь, силовой набор («MetalTank») — графит, торцы ракет — красные */
      if(nm.indexOf("rocket")>=0&&nm.indexOf("cap")>=0)return M.capRed;
      if(nm.indexOf("painted")>=0)return M.paint;
      if(nm.indexOf("metal")>=0)return M.paintDark;
      return M.paint;                             // корпус, башня, ствол, прочее
    };
    if(Array.isArray(o.material))o.material=o.material.map(m=>m?pick(m):m);
    else if(o.material)o.material=pick(o.material);
  });
  if(A.bandL)A.bandL.visible=!1;
  if(A.bandR)A.bandR.visible=!1;
  /* Петля ленты — по АВТОРСКОЙ геометрии трака (Cube/Cube001): выпуклая
     оболочка его сечения в плоскости борта. Тогда натяжение, обхват ведущего
     колеса и ленивца — родные, без подгонки радиусов по bbox. */
  const M4c=src.matrixWorld.constructor;
  const hullPath=mesh=>{
    if(!mesh||!mesh.geometry||!mesh.geometry.attributes.position)return null;
    mesh.updateWorldMatrix(!0,!1);
    const pos=mesh.geometry.attributes.position,v=new P(),
          m=new M4c().copy(modelRoot.matrixWorld).invert().multiply(mesh.matrixWorld);
    const raw=[];
    for(let i=0;i<pos.count;i++){
      v.fromBufferAttribute(pos,i).applyMatrix4(m);
      raw.push([v.x*s,v.y*s]);
    }
    raw.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    const cr=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
    const lo=[],up=[];
    for(const q of raw){while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],q)<=0)lo.pop();lo.push(q)}
    for(let i=raw.length-1;i>=0;i--){const q=raw[i];
      while(up.length>=2&&cr(up[up.length-2],up[up.length-1],q)<=0)up.pop();up.push(q)}
    const hull=lo.slice(0,-1).concat(up.slice(0,-1));
    if(hull.length<8)return null;
    let cz=0,cy=0;for(const q of hull){cz+=q[0];cy+=q[1]}cz/=hull.length;cy/=hull.length;
    const pts=[],ss=[];let acc=0;
    for(let i=0;i<hull.length;i++){
      const a=hull[i],b=hull[(i+1)%hull.length];
      const len=Math.hypot(b[0]-a[0],b[1]-a[1]),k=Math.max(1,Math.ceil(len/.06));
      for(let j=0;j<k;j++){
        const t=j/k,z=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t;
        if(pts.length){const q=pts[pts.length-1];acc+=Math.hypot(z-q.z,y-q.y)}
        pts.push({z,y});ss.push(acc);
      }
    }
    const total=acc+Math.hypot(pts[0].z-pts[pts.length-1].z,pts[0].y-pts[pts.length-1].y);
    for(let i=0;i<pts.length;i++){
      const a=pts[(i-1+pts.length)%pts.length],b=pts[(i+1)%pts.length];
      let tz=a.z-b.z,ty=a.y-b.y;
      const l=Math.hypot(tz,ty)||1;tz/=l;ty/=l;
      let nz=-ty,ny=tz;
      if(nz*(pts[i].z-cz)+ny*(pts[i].y-cy)<0){nz=-nz;ny=-ny}
      pts[i].tz=tz;pts[i].ty=ty;pts[i].nz=nz;pts[i].ny=ny;
    }
    return {pts,s:ss,total:total||1};
  };
  const bandPaths={};
  {const Lp=hullPath(A.bandL),Rp=hullPath(A.bandR);   /* Cube: лок. +z → борт −1 */
   if(Lp)bandPaths[-1]=Lp;
   if(Rp)bandPaths[1]=Rp;}
  /* лента */
  /* Вылет и ширина трака — по авторской ленте модели (Cube/Cube001):
     иначе лента либо шире катков, либо утоплена внутрь корпуса. */
  const beltX=bn?(bandLat/bn)*s:C.halfTrack,
        beltW=bn?Math.min(bandW2*s,0.74):Math.min(C.trackWidth,.74);
  const InstCls=VCH_InstCls,linkGeo=Uw(beltW),linkMat=M.track;
  const trackGroups=[];
  for(const side of[-1,1]){
    const inst=new InstCls(linkGeo,linkMat,220);
    inst.castShadow=!0;inst.receiveShadow=!0;inst.frustumCulled=!1;
    chassis.add(inst);
    trackGroups.push({inst,side,offset:0,dummy:new ue(),n:0});
  }
  /* ===== Гусеницы Скорпиона — ТЕМ ЖЕ решателем, что у ОБТ-36 ================
     Петля строится Lw(): нижняя ветвь — сплайн, касательный к каждому катку,
     плюс касательные к ленивцу/ведущему и дуги вокруг них. Линки ставятся
     семплером Iw() с полным базисом и выносом на половину толщины трака.
     Ход катков считается по лучам (probe) с ограничением натяжения: тугая
     лента мостит впадину и не даёт катку провалиться. */
  const M4sc=src.matrixWorld.constructor;
  const SC_UP=.15,SC_DN=-.15;                       // ход подвески Скорпиона, м
  const scV=new P(),scN=new P(),scT=new P(),scX=new P();
  const scMat=new M4sc(),scQuat=new gn(),scP={x:0,y:0,z:0,nz:0,ny:0,tx:0,ty:0,tz:1};
  for(const t of trackGroups){
    const gs=gearRigs.filter(x=>x.side===t.side);
    t.idler=gs.find(x=>!x.drive);
    t.sprocket=gs.find(x=>x.drive);
    t.wheels=wheelRigs.filter(w=>w.side===t.side).sort((a,b)=>b.z-a.z);  // z по убыванию
    t.C=Pw(1+t.wheels.length+2);
    t.buf=Cw();
    t.sampler=null;t.pitch=.17;t.linkCount=0;
    t.tension=new Float64Array(t.wheels.length+2);
    t.dummy=new ue();
    /* Lw() без возвратных роликов не умеет: подставляем один «ролик» нулевого
       радиуса ровно на линию верхней касательной — верхняя ветвь остаётся
       прямой, а код остаётся тем же, что у ОБТ */
    const id=t.idler,sp=t.sprocket;
    const dz=sp.z-id.z,dy=sp.y-id.y,d=Math.hypot(dz,dy)||1;
    const al=Math.asin(Te.clamp((id.r-sp.r)/d,-1,1));
    const ux=dz/d,uy=dy/d,ca=Math.cos(al),sa=Math.sin(al);
    const tx=ux*ca-uy*sa,ty=ux*sa+uy*ca;
    let nx=-ty,ny=tx;
    if(ny<0){nx=-nx;ny=-ny}
    const p1z=id.z+id.r*nx,p1y=id.y+id.r*ny,
          p2z=sp.z+sp.r*nx,p2y=sp.y+sp.r*ny;
    t.roller={z:(p1z+p2z)*.5,y:(p1y+p2y)*.5,r:.0015};
  }
  const D={trackOffsetL:0,trackOffsetR:0,recoil:0,recoilVel:0,wheelDrop:0};
  /* Круги для Lw(): порядок как у ОБТ — ленивец, катки, ведущее, «ролик» */
  function scFill(t){
    const C=t.C;let k=0;
    C[k].x=0;C[k].z=t.idler.z;C[k].y=t.idler.y;C[k].r=t.idler.r;C[k].kind="idler";k++;
    for(const w of t.wheels){C[k].x=0;C[k].z=w.z;C[k].y=w.y+w.dy;C[k].r=w.r;C[k].kind="wheel";k++}
    C[k].x=0;C[k].z=t.sprocket.z;C[k].y=t.sprocket.y;C[k].r=t.sprocket.r;C[k].kind="sprocket";k++;
    C[k].x=0;C[k].z=t.roller.z;C[k].y=t.roller.y;C[k].r=t.roller.r;C[k].kind="roller";
    return C;
  }
  /* Подвеска: цель по лучу вниз из центра катка + натяжение ленты + фильтр —
     ровно как zt() у ОБТ-36 */
  function scSusp(t,dt,probe){
    const W=t.wheels,n=W.length;
    if(!probe||!n)return;
    chassis.updateWorldMatrix(!0,!1);
    for(const w of W){
      scV.set(t.side*beltX,w.y,w.z);chassis.localToWorld(scV);
      const dist=probe(scV.x,scV.y,scV.z,1.6);
      w.target=Te.clamp(w.r+Kt.trackShoe-dist,SC_DN,SC_UP);
    }
    const d=t.tension,notch=Kt.trackNotch;
    d[0]=0;d[n+1]=0;
    for(let i=0;i<n;i++)d[i+1]=W[i].target;
    for(let pass=0;pass<12;pass++){
      let moved=0;
      for(let i=1;i<=n;i++){
        const floor=(d[i-1]+d[i+1])*.5-notch;
        if(d[i]<floor){const v=Math.min(SC_UP,floor);moved+=Math.abs(v-d[i]);d[i]=v}
      }
      if(moved<1e-5)break;
    }
    const alpha=1-Math.exp(-dt*VCH_SUS_RATE*VCH_susK),
          maxStep=VCH_SUS_MAXV*VCH_susK*dt;
    for(let i=0;i<n;i++){
      const w=W[i],tgt=Te.clamp(d[i+1],SC_DN,SC_UP),
            goal=w.dy+(tgt-w.dy)*alpha;
      w.dy=Te.clamp(Te.clamp(goal,w.dy-maxStep,w.dy+maxStep),SC_DN,SC_UP);
      w.piv.position.y=w.baseY+w.dy/s;
    }
  }
  /* Петля + линки: Lw() -> Iw() -> расстановка как в rt() у ОБТ */
  function scTrack(t,dt,speed){
    scFill(t);
    const Lw_f=Lw(t.buf,t.C,t.C.length);
    const S=t.sampler||(t.sampler=Iw(t.buf));
    S.build();
    if(!(S.total>.5))return;
    if(!t.linkCount){
      t.linkCount=Math.max(10,Math.min(200,Math.round(S.total/Kt.trackPitch)));
      t.n=t.linkCount;t.inst.count=t.linkCount;
    }
    t.pitch=S.total/t.linkCount;
    t.offset=(t.offset+speed*dt)%S.total;
    const ht=Kt.trackShoe*.5;                        // вынос на половину трака
    for(let i=0;i<t.linkCount;i++){
      S.at(i*t.pitch+t.offset,scP);
      scN.set(0,scP.ny,scP.nz);scT.set(scP.tx,scP.ty,scP.tz);
      scX.crossVectors(scN,scT).normalize();
      scN.crossVectors(scT,scX).normalize();
      t.dummy.position.set(t.side*beltX+scN.x*ht,
                           scP.y+scN.y*ht,
                           scP.z+scN.z*ht);
      scMat.makeBasis(scX,scN,scT);
      scQuat.setFromRotationMatrix(scMat);
      t.dummy.quaternion.copy(scQuat);
      t.dummy.scale.set(1,1,t.pitch);
      t.dummy.updateMatrix();
      t.inst.setMatrixAt(i,t.dummy.matrix);
    }
    t.inst.instanceMatrix.needsUpdate=!0;
  }
  const tmpV=new P(),q3=new gn(),ax3=new P();
  const dV1=new P(),dV2=new P();
  const circlesNow=()=>{
    const arr=[];
    for(const w of wheelRigs)if(w.side<0)arr.push({z:w.z,y:w.y+w.dy,r:w.r});
    for(const g of gearRigs)if(g.side<0&&(g.drive||g.y>.6))arr.push({z:g.z,y:g.y,r:g.r});
    if(!gearRigs.length){                      /* запасной путь: конфиг */
      arr.push({z:C.idlerZ,y:C.idlerY,r:C.idlerR});
      arr.push({z:C.sprocketZ,y:C.sprocketY,r:C.sprocketR});
    }
    arr.sort((a,b)=>a.z-b.z);
    return arr;
  };
  function update(dt,st){
    st=st||{};
    const spL=st.speedL||0,spR=st.speedR||0,probe=st.probe||Jf;
    dt=dt>0?dt:1/60;
    D.trackOffsetL+=spL*dt;D.trackOffsetR+=spR*dt;
    D.recoilVel+=(-150*D.recoil-13*D.recoilVel)*dt;
    D.recoil+=D.recoilVel*dt;
    if(D.recoil<0){D.recoil=0;D.recoilVel<0&&(D.recoilVel*=-.25)}
    recoilGroup.position.z=-Math.min(1.05,D.recoil);
    /* сопоставить видимые катки с колёсами физики (один раз) */
    if(st.wheels&&st.wheels.length&&wheels[0]&&!wheelRigs[0].physW){
      for(const w of wheelRigs){
        let best=null,bd=1e9;
        for(const pw of st.wheels){
          if((pw.local.x<0?-1:1)!==w.side)continue;
          const d=Math.abs(pw.local.z-w.z);
          if(d<bd){bd=d,best=pw}
        }
        w.physW=best;
      }
    }
    for(const w of wheelRigs)w.piv.rotation.z-=((w.side<0?spL:spR)*dt)/w.r;
    for(const g of gearRigs)g.piv.rotation.z-=((g.side<0?spL:spR)*dt)/g.r;
    chassis.updateWorldMatrix(!0,!1);
    /* Модель визуально сидела на 7-8 см НИЖЕ физического грунта: катки были
       «утоплены», а лента, посаженная на грунт, проходила мимо них — отсюда
       и «наматывание» трака на опорный каток. Подтягиваем корпус ОДИН раз по
       среднему контакту колёс из физики, дальше смещение жёсткое. */
    D.t=(D.t||0)+dt;

    if(D.lift===undefined&&D.t>1.0){
      let sum=0,n=0;
      for(const w of wheelRigs){
        const pw=w.physW;
        if(pw&&pw.contact&&typeof pw.lastCy==="number"){sum+=pw.lastCy;n++}
      }

      if(n>=4){
        chassis.getWorldPosition(dV1);
        let lowest=1e9;
        for(const w of wheelRigs){
          const pw=w.physW;
          if(pw&&pw.contact)lowest=Math.min(lowest,w.y+w.dy-w.r);
        }
        if(!(lowest<1e8))lowest=0;
        D.lift=Te.clamp(sum/n-(dV1.y+lowest),-.35,.35);
        chassis.position.y+=D.lift;
        chassis.updateMatrixWorld(!0);

      }
    }
    if(probe){
      for(const t of trackGroups){
        scSusp(t,dt,probe);           /* катки — по лучам, с натяжением ленты */
        scTrack(t,dt,t.side<0?spL:spR);
      }
    }
  }
  function fireRecoil(k){D.recoilVel=9.0*(k||1)}
  function getMuzzle(pos,dir){
    group.updateWorldMatrix(!0,!0);
    muzzlePoint.getWorldPosition(pos);
    gunPivot.getWorldQuaternion(q3);
    dir.set(0,0,1).applyQuaternion(q3);
    return pos;
  }
  function getMuzzleBrakepoints(n){
    n=n||3;const out=[];
    group.updateWorldMatrix(!0,!0);
    const mp=new P();muzzlePoint.getWorldPosition(mp);
    gunPivot.getWorldQuaternion(q3);ax3.set(0,0,1).applyQuaternion(q3);
    for(let i=0;i<n;i++)out.push(mp.clone().addScaledVector(ax3,-.10*(i+1)/(n+1)));
    return out;
  }
  const info={size:new Xe().setFromObject(group).getSize(new P),scale:s,
              beltX:+beltX.toFixed(3),beltW:+beltW.toFixed(3),
              gears:gearRigs.map(g=>({side:g.side,drive:!!g.drive,z:+g.z.toFixed(2),y:+g.y.toFixed(2),r:+g.r.toFixed(3)})),
              wheelLat:wheels.map(w=>+ (Math.abs(w.c.z)*s).toFixed(2)).slice(0,2),
              turret:A.turret.name,barrel:A.barrel.name,wheels:wheelRigs.length,xc,groundModel,
              radii:wheelRigs.slice(0,2).map(w=>+w.r.toFixed(3)).concat(gearRigs.map(g=>+g.r.toFixed(3))),
              lift:D.lift===undefined?null:+D.lift.toFixed(3),
              /* длина петли — из живого солвера (до первого кадра — оценка по оболочке) */
              get trackLen(){const g=trackGroups[0];
                const v=g&&g.sampler?g.sampler.total:(bandPaths[-1]||vchScBelt(circlesNow(),.1)).total;
                return +v.toFixed(2)},
              bandPath:!!bandPaths[-1]};
  return {group,chassis,turret,turretStab,gunPivot,recoilGroup,muzzlePoint,muzzle:muzzlePoint,
          casePort,caseFlap,
          tracks:{left:{userData:{update(){}}},right:{userData:{update(){}}}},
          wheels:{left:wheelRigs.filter(w=>w.side<0),right:wheelRigs.filter(w=>w.side>0)},
          gearRigs,wheelRigs,
          trackGroups,
          materials:{paint:M.paint,paintLight:M.paintLight,paintDark:M.paintDark,
                     wheelHub:M.wheelHub,steel:M.steel,steelDark:M.steelDark,
                     track:M.track,trackTex:!!M.track.map},
          update,fireRecoil,getMuzzle,getMuzzleBrakepoints,
          state:D,custom:!0,scorpion:!0,info,source:src};
}
