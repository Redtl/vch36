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
    /* Проверка линковки (gl.getProgramParameter + getProgramInfoLog) заставляет
       драйвер дожидаться компиляции прямо в кадре. Замер профилировщиком: на
       первой смене танка это 2.6 с из 5 с окна — 46 % времени потока. В боевом
       режиме ошибки шейдеров не проверяем. */
    try{ Jn.debug.checkShaderErrors=!1 }catch(e){}
    const t0=performance.now();
    Jn.compile(cn,ye);
    Jn.setRenderTarget(null);
    Jn.render(cn,ye);
    if(window.__vchGarage&&window.__vchGarage.active&&typeof Zr!=="undefined"&&Zr)Zr.render();
    window.__vWarm=window.__vWarm||[];
    window.__vWarm.push({tag,ms:Math.round(performance.now()-t0),programs:Jn.info.programs.length})
  }catch(e){console.warn('warm-up',e)}
}
/*
  Полный прогрев: перебираем танки, компилируем их материалы и рендерим кадр —
  только так собираются и теневые (depth) варианты программ. Без этого материалы
  второй машины компилировались в первый же кадр после её активации: 12 новых
  программ и подвисание на первом нажатии TAB.
*/
function vchWarmAll(tag){
  try{
    if(!Jn||!cn||!ye)return;
    try{ Jn.debug.checkShaderErrors=!1 }catch(e){}
    const t0=performance.now();
    const save=VCH_TANKS.indexOf(VCH_ACTIVE);
    /*
      Фары (2 прожектора + 2 точки на машину) создаются в vEnsureTankLights()
      только для активного танка — то есть в первый же кадр после нажатия TAB.
      Число источников света вшито в ключ шейдерной программы, поэтому все
      материалы сцены перекомпилировались прямо во время смены танка: 13 новых
      программ и подвисание на секунды. Создаём фары всем машинам заранее.
    */
    if(typeof J!=="undefined"&&!J.started){
      for(let i=0;i<VCH_TANKS.length;i++){
        if(i!==save)setActiveTank(i);
        try{ if(typeof vEnsureTankLights==="function")vEnsureTankLights() }catch(e){}
      }
      if(save>=0)setActiveTank(save);
    }
    const n0=Jn.info.programs.length;
    Jn.compile(cn,ye);
    /* кадр нужен, чтобы собрались теневые (depth) варианты программ —
       compile() их не трогает. Если новых программ нет, кадр не рисуем:
       на слабом GPU он сам по себе стоит несколько миллисекунд. */
    if(Jn.info.programs.length>n0){ Jn.setRenderTarget(null); Jn.render(cn,ye);
      if(window.__vchGarage&&window.__vchGarage.active&&typeof Zr!=="undefined"&&Zr)Zr.render(); }
    window.__vWarm=window.__vWarm||[];
    window.__vWarm.push({tag:"warm-all:"+(tag||""),ms:Math.round(performance.now()-t0),
                         programs:Jn.info.programs.length})
  }catch(e){console.warn("warm-all",e)}
}
window.__vchWarmAll=vchWarmAll;
const pa=new Ef;let qo=0;const Xo=1/60;let Yo=0,Pc=0;function np(){requestAnimationFrame(np);
  /* 4.2: defer-скрипты исполняются отдельными задачами, поэтому rAF может
     сработать между модулями. Кадр стартует только после того, как весь код
     загружен (флаг ставится в конце 18-boot.js). */
  if(window.__vchBooted!==!0)return;
  const r=Math.min(pa.getDelta(),.05);ip(window.__vchPaused===!0?0:r,!0)}/* Модель весит 10.4 МБ, поэтому лежит в «хвосте» загрузчика (см. tail в
   index.html): стартовое меню появляется, не дожидаясь её закачки, а танк
   встаёт в строй через 1-3 с. Если данные уже в памяти (сборка одним файлом
   или хвост успел догрузиться) — берём их сразу. */
function vchScorpionB64(){
  if(typeof VCH_SCORPION_B64_DATA!=="undefined")return Promise.resolve(VCH_SCORPION_B64_DATA);
  return new Promise(function(ok,no){
    const t0=Date.now();
    (function wait(){
      if(typeof VCH_SCORPION_B64_DATA!=="undefined")return ok(VCH_SCORPION_B64_DATA);
      if(window.__vchAllDone||Date.now()-t0>6e4)
        return no(new Error("данные модели Scorpion не загрузились"));
      setTimeout(wait,60);
    })();
  });
}
/* ============================================================================
   VCH · ВТОРОЙ ТАНК: SCORPION (GLB)  — собственный риг и собственная физика
   ОБТ-36 остаётся танком №1; Kt не меняется.
   ========================================================================== */
/* ---------------------------------------------------------------------------
   Страховка для cannon-es: у части статических пропсов бокс-бокс контакт
   падает с "Cannot read properties of undefined". Такая пара просто
   пропускается — кадр не должен ронять игру.
   ------------------------------------------------------------------------- */


/* Порог фаски: рёбра, у которых угол между гранями круче этого, не скругляются
   вовсе — острые кромки брони и грани зубьев должны остаться живыми. */
const VCH_SC_REACH=100;

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
  /* Посадка ленты на ведущем колесе: 0 — по сплошному телу колеса,
     1 — по кончикам зубьев. У модели ведущее колесо — тело r≈0.358 с десятью
     зубьями высотой 10 см (до r≈0.458): при посадке 1 лента держалась на
     кончиках и до тела оставалось 10.6 см пустоты. По умолчанию 0 — лента
     ложится на само колесо, а зубья модельными вершинами сжимаются по радиусу
     и уходят под трак (иначе проткнут его на 4 см). */
  gearSeat:0,
  /* Кронштейны катков (Gear_Low*) едут вместе с катками. Выключить — каток
     снова поедет внутри неподвижного кронштейна. */
  armMove:!0,
  /* «Шейд смуз» катков: до какого угла (градусы) между соседними гранями
     нормали усредняются. Диски приходят из GLB с разнесёнными вершинами
     (1970 вершин на 1052 треугольника), поэтому светятся гранями; 0 —
     выключить и вернуть нормали модели как есть. */
  smoothDeg:62,
  /* Bevel («фаска») по всей модели: на сколько градусов нормаль вершины
     может уйти от плоскости своей грани. Это скругление по нормалям, а не
     правка геометрии: силуэт тот же, рёбра мягче ловят свет.
     Ограничение обязательно: без него сглаживание расходится по всей
     поверхности и машина становится «мыльной» — плоские панели выглядят
     выпуклыми, сегменты ствола пропадают. Здесь фаска не может стать шире
     bevelDeg, сколько бы граней ни сошлось в вершине. Рёбра, повёрнутые
     друг к другу круче VCH_SC_REACH, не трогаются вовсе. 0 — как в модели. */
  bevelDeg:5,
  /* Подобрано по кадру: доля резких перепадов яркости на стволе — 31.5% у
     исходной модели, 32.8% при 5°, 28.2% при 8°, 21.5% при 12° и 13.7% при
     20°. То есть с 12° сглаживание начинает съедать саму сетку («мыло»),
     а 5° держит читаемость формы и даёт фаску ~4.5°. */
  settings:{restLength:0.550,wheelRadius:0.405,stiffness:1.62e5,damping:5.6e4,
            maxSpeed:15.0,maxReverse:7.0,accel:5.2,reverseAccel:2.9,
            rollK:3.0e5,rollD:2.2e5,rollDead:.012,yawGain:11,yawMax:18},
  weapon:{ammo:22,ammoMax:22,reload:4.6}
};

const vchScNorm=n=>String(n||"").toLowerCase().replace(/[\s._\-]+/g,"");
function vchScFind(root,key){const k=vchScNorm(key);let hit=null;root.traverse(o=>{if(!hit&&vchScNorm(o.name)===k)hit=o});return hit}
function vchScFindRe(root,re){let hit=null;root.traverse(o=>{if(!hit&&o.name&&re.test(o.name))hit=o});return hit}

/* glTF требует выравнивания элементов по 4 байта, поэтому квантованный VEC3
   (3 x int16 = 6 байт) лежит с шагом 8. three.js видит byteStride != размеру
   элемента и собирает такие атрибуты как InterleavedBufferAttribute, а у того
   нет работающего clone() — игра клонирует геометрию катков (shrinkRadial) и
   падает. Раскладываем их в обычные BufferAttribute: данных становится даже
   меньше (шаг 8 -> 6), а дальше всё работает как с прежней моделью. */
/* Квантованные атрибуты модели (int/uint + normalized) раскладываем в обычный
   Float32. Модель приходит сжатой EXT_meshopt_compression и квантованной, а
   игра правит геометрию на месте: позиции вершин зубьев (shrinkRadial) и
   нормали (computeVertexNormals / normalizeNormals). Запись дробного значения
   в Int16Array округляет его к нулю — нормали обнуляются, танк становится
   чёрным, а зубья схлопываются. Расквантовка делает модель по структуре
   такой же, как старая: те же Float32-атрибуты. */
function vchDequantScale(arr){
  if(arr.constructor===Int16Array)return 32767;
  if(arr.constructor===Int8Array)return 127;
  if(arr.constructor===Uint16Array)return 65535;
  if(arr.constructor===Uint8Array)return 255;
  return 0;
}
function vchDeinterleave(root){
  let n=0;
  root.traverse(function(o){
    if(!o.isMesh||!o.geometry)return;
    const g=o.geometry,names=[];
    for(const k in g.attributes) if(g.attributes[k]&&g.attributes[k].isInterleavedBufferAttribute) names.push(k);
    for(const k of names){
      const a=g.attributes[k],cnt=a.count,c=a.itemSize,src=a.array,st=a.data.stride,off=a.offset;
      const out=new src.constructor(cnt*c);
      for(let i=0;i<cnt;i++)for(let j=0;j<c;j++) out[i*c+j]=src[off+i*st+j];
      const na=new Ve(out,c);
      na.normalized=!!a.normalized;
      g.setAttribute(k,na); n++;
    }
    /* Расквантовываем только то, что игра перезаписывает: позиции и нормали.
       Текстурные координаты остаются квантованными — их никто не меняет. */
    for(const k of ["position","normal"]){
      const a=g.attributes[k];
      if(!a||!a.normalized)continue;
      const src=a.array, d=vchDequantScale(src);
      if(!d)continue;
      const out=new Float32Array(src.length);
      for(let i=0;i<src.length;i++) out[i]=src[i]/d;
      g.setAttribute(k,new Ve(out,a.itemSize)); n++;
    }
  });
  return n;
}

async function vchScorpionGLB(){
  /* модель сжата EXT_meshopt_compression — декодер подключаем до разбора */
  if(typeof VCH_MeshoptDecoder!=="undefined"&&typeof Wf!=="undefined")
    Wf.setMeshoptDecoder(VCH_MeshoptDecoder);
  const s=await vchScorpionB64(),b=atob(s),u=new Uint8Array(b.length);
  for(let i=0;i<b.length;i++)u[i]=b.charCodeAt(i);
  const ab=await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();
  const sc=(await k1(ab)).scene;
  vchDeinterleave(sc);
  return sc;
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
  /* Два радиуса одного колеса. tip — крайние вершины (98-й процентиль, как и
     раньше). body — сплошная поверхность: 20-й процентиль максимумов по 36
     угловым секторам, то есть радиус, под которым материал есть почти везде.
     У гладкого колеса они совпадают, у ведущего между ними — зубец, и ставить
     ленту по tip значит держать её на кончиках зубьев с пустотой до тела. */
  const rimR=(node,lc,prof)=>{
    const rs=[];
    const NB=36,bmax=new Array(NB).fill(-1);
    node.updateWorldMatrix(!0,!0);
    node.traverse(ch=>{
      if(!ch.isMesh||!ch.geometry||!ch.geometry.attributes.position)return;
      const pos=ch.geometry.attributes.position;
      for(let i=0;i<pos.count;i++){
        vRim.fromBufferAttribute(pos,i).applyMatrix4(ch.matrixWorld);
        modelRoot.worldToLocal(vRim);
        const dx=vRim.x-lc.x,dy=vRim.y-lc.y,r=Math.hypot(dx,dy);
        rs.push(r);
        const b=Math.floor((((Math.atan2(dy,dx)+Math.PI*2)%(Math.PI*2))/(Math.PI*2))*NB)%NB;
        if(r>bmax[b])bmax[b]=r;
      }
    });
    if(!rs.length)return 0;
    rs.sort((a,b)=>a-b);
    const tip=rs[Math.min(rs.length-1,Math.floor(rs.length*.98))]*s;
    const nz=bmax.filter(v=>v>=0).sort((a,b)=>a-b);
    let body=tip;
    if(nz.length>=12){
      const b20=nz[Math.floor(nz.length*.20)]*s;
      body=Math.min(tip,Math.max(b20,nz[0]*s));
    }
    if(prof){prof.tip=tip;prof.body=body}
    return tip;
  };
  const makePivot=node=>{
    const d=discOf(node)||node;
    const bb=new Xe().setFromObject(d),c=bb.getCenter(new P()),sz=bb.getSize(new P());
    const lc=modelRoot.worldToLocal(c.clone());
    const prof={};
    const rGeo=rimR(node,lc,prof);
    const piv=new Jt();piv.position.copy(lc);
    modelRoot.add(piv);modelRoot.updateMatrixWorld(!0);
    piv.attach(node);modelRoot.updateMatrixWorld(!0);
    return {piv,lc,r:rGeo||Math.min(sz.y,sz.z)*.5,prof};
  };
  /* Каток в модели сидит в своём кронштейне: родитель диска Gear_Low*.001 —
     это кронштейн Gear_Low*.002, прикреплённый к корпусу. Раньше пивот катка
     вешался прямо на корпус и каток ездил вверх-вниз отдельно от кронштейна.
     Теперь кронштейн получает свой пивот на корпусе, пивот катка становится
     его ребёнком, и подвеска двигает весь узел целиком. */
  const armRigs=[];
  const armOfDisk=o=>{const a=o&&o.parent;return(a&&/gear/i.test(a.name||""))?a:null};
  const wheelRigs=[];
  for(const w of wheels){
    const armNode=armOfDisk(w.o);
    let arm=null;
    if(armNode&&!armRigs.some(a=>a.node===armNode)){
      const armLc=modelRoot.worldToLocal(armNode.getWorldPosition(new P()));
      const armPiv=new Jt();armPiv.position.copy(armLc);armPiv.name="arm_piv_"+armNode.name;
      modelRoot.add(armPiv);modelRoot.updateMatrixWorld(!0);
      armPiv.attach(armNode);modelRoot.updateMatrixWorld(!0);
      arm={piv:armPiv,lc:armLc,baseY:armLc.y,node:armNode};
      armRigs.push(arm);
    }else if(armNode)arm=armRigs.find(a=>a.node===armNode);
    const {piv,lc,r}=makePivot(w.o);
    if(arm){
      arm.piv.add(piv);
      piv.position.set(lc.x-arm.lc.x,lc.y-arm.lc.y,lc.z-arm.lc.z);
      modelRoot.updateMatrixWorld(!0);
    }
    wheelRigs.push({piv,arm,baseY:piv.position.y,r,side:lc.z>0?-1:1,
                    z:lc.x*s,y:lc.y*s,dy:0,dyT:0});
  }
  /* ведущее колесо (звёздочка) и ленивец: свои пивоты, чтобы крутились вместе
     с лентой; центры и радиусы берём ИЗ МОДЕЛИ — иначе лента идёт мимо них */
  const gearRigs=[];
  for(const [list,drive] of [[sprockets,1],[idlers,0]]){
    for(const node of list){
      if(!node||gearRigs.some(g=>g.node===node))continue;
      const {piv,lc,r,prof}=makePivot(node);
      const rTip=prof&&prof.tip||r,rBody=prof&&prof.body||rTip;
      gearRigs.push({node,piv,lc,drive,side:lc.z>0?-1:1,r,z:lc.x*s,y:lc.y*s,rTip,rBody});
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
  /* Обход граней правим до материалов и до пересчёта нормалей: и bevel, и
     сглаживание катков считают нормаль грани по порядку вершин, поэтому
     вывернутые треугольники должны быть вывернуты обратно заранее. */
  scWindPass();
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
        gearNodes=new Set(gearRigs.map(g=>g.node)),
        /* ведущие колёса (drive=1) выделяем отдельно: ленивцы остаются
           стальными, а ведущие красятся в цвет опорных катков. Проверять
           drive НАДО ПЕРВЫМ — эти узлы лежат и в gearNodes тоже. */
        driveNodes=new Set(gearRigs.filter(g=>g.drive).map(g=>g.node));
  const roleOf=o=>{
    for(let p=o;p;p=p.parent){
      if(wheelNodes.has(p))return "wheel";
      if(driveNodes.has(p))return "drive";
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
      /* ведущее колесо получает тот же материал, что и опорный каток:
         иначе оно светилось светлой сталью (M.steel, #9aa1a9) на фоне
         тёмных wheelHub-катков и выбивалось из ливреи */
      if(host==="wheel"||host==="drive")return M.wheelHub;   // опорный + ведущий
      if(host==="gear")return M.steel;                       // ленивец
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
    /* Lw() без возвратных роликов не умеет: подставляем один «ролик» нулевого
     радиуса ровно на линию верхней касательной — верхняя ветвь остаётся
     прямой, а код остаётся тем же, что у ОБТ. Считается заново при смене
     посадки ленты: от радиусов шестерён зависит и эта линия. */
  function scRoller(t){
    const id=t.idler,sp=t.sprocket;
    if(!id||!sp)return;
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
    scRoller(t);
  }
  /* Посадка ленты на шестернях: 0 — по сплошному телу колеса, 1 — по кончикам
     зубьев. Меняется на ходу: петля и число звеньев пересчитываются сами. */
  /* Зубья модели вдвое выше трака: при посадке ленты на тело колеса они
     проткнут её наизнанку. Поэтому вершины выше тела сжимаются по радиусу —
     зубец сохраняет форму, но становится ниже наружной грани трака и целиком
     уходит под ленту. Оригинал positions хранится: посадку можно крутить
     туда-обратно, при k>=1 геометрия возвращается как была. */
  const VCH_PLATE=.025;                    // половина толщины плиты трака
  function scGearShape(){
    for(const g of gearRigs){
      const body=(g.rBody||0)/s,tip=(g.rTip||0)/s;
      const limit=(g.r+Kt.trackShoe*.5+VCH_PLATE-.012)/s;
      const span=tip-body;
      if(span<1e-6||body<1e-6)continue;
      const k=Te.clamp((limit-body)/span,0,1);
      shrinkRadial(g.piv,g.lc,body,tip,k);
    }
  }
  function shrinkRadial(node,lc,body,tip,k){
    const M4c=src.matrixWorld.constructor;
    const inv=new M4c().copy(modelRoot.matrixWorld).invert();
    node.updateWorldMatrix(!0,!0);
    node.traverse(ch=>{
      if(!ch.isMesh||!ch.geometry||!ch.geometry.attributes.position)return;
      if(!ch.userData.__vchOrig){
        ch.geometry=ch.geometry.clone();
        ch.userData.__vchOrig=ch.geometry.attributes.position.array.slice(0);
      }
      const pos=ch.geometry.attributes.position,arr=pos.array,orig=ch.userData.__vchOrig;
      const toRoot=new M4c().multiplyMatrices(inv,ch.matrixWorld);
      const back=new M4c().copy(toRoot).invert();
      const v=new P();
      for(let i=0;i<pos.count;i++){
        const i3=i*3;
        v.set(orig[i3],orig[i3+1],orig[i3+2]).applyMatrix4(toRoot);
        const dx=v.x-lc.x,dy=v.y-lc.y,r=Math.hypot(dx,dy);
        if(r>body&&k<1){
          const rr=body+(r-body)*k,m=rr/(r||1e-6);
          v.x=lc.x+dx*m;v.y=lc.y+dy*m;v.applyMatrix4(back);
          arr[i3]=v.x;arr[i3+1]=v.y;arr[i3+2]=v.z;
        }else{arr[i3]=orig[i3];arr[i3+1]=orig[i3+1];arr[i3+2]=orig[i3+2]}
      }
      pos.needsUpdate=!0;
      ch.geometry.computeVertexNormals();
      ch.geometry.computeBoundingBox();ch.geometry.computeBoundingSphere();
    });
  }
  /* ===== Шейд смуз: сглаженные нормали колёс ==============================
     Диски катков приходят из GLB с разнесёнными вершинами (1970 вершин на
     1052 треугольника): у каждой грани свои три вершины, поэтому каток
     светится гранями, даже хотя NORMAL в модели загружен — средний угол
     между соседними гранями 33.6° (у катка ОБТ-36, собранного из lathe,
     — 10.9°). Здесь вершины с одинаковой позицией находят друг друга и
     получают усреднённую нормаль, но только от граней, повёрнутых к этой
     не круче smoothDeg: фаски по кругу диска перестают читаться как
     многоугольник, а кромки обода и грани зубьев остаются живыми.
     Исходный NORMAL сохраняется — при smoothDeg=0 всё возвращается.       */
  function scSmoothGeom(ch,maxDeg){
    const g=ch.geometry;
    if(!g||!g.attributes||!g.attributes.position)return 0;
    if(!(maxDeg>0)){                            /* выключено — вернуть как было */
      const n0=ch.userData.__vchNor0;
      if(n0){const B=n0.constructor;
        g.setAttribute("normal",new B(n0.array.slice(0),n0.itemSize,n0.normalized));
        g.attributes.normal.needsUpdate=!0;return 1}
      return 0;
    }
    const p=g.attributes.position;
    if(!p||p.isInterleavedBufferAttribute)return 0;
    /* Считаем прямо по индексированной геометрии: разворот в toNonIndexed
       подменял бы буфер position, а на нём держится кэш __vchOrig у
       shrinkRadial (сжатие зубьев) — посадка ленты перестала бы
       откатываться. Здесь не трогается ни position, ни индекс. */
    const idx=g.index,vc=p.count,tri=idx?Math.floor(idx.count/3):Math.floor(vc/3);
    if(tri<4)return 0;
    if(!ch.userData.__vchNor0&&g.attributes.normal)ch.userData.__vchNor0=g.attributes.normal.clone();
    const vi=t=>idx?idx.getX(t):t;               /* номер вершины угла t */
    const cosMin=Math.cos(Math.min(179,Math.max(1,maxDeg))*Math.PI/180),
          fn=new Float32Array(tri*3);
    for(let t=0;t<tri;t++){
      const a=vi(3*t),b=vi(3*t+1),c=vi(3*t+2),
            ax=p.getX(a),ay=p.getY(a),az=p.getZ(a),
            ux=p.getX(b)-ax,uy=p.getY(b)-ay,uz=p.getZ(b)-az,
            vx=p.getX(c)-ax,vy=p.getY(c)-ay,vz=p.getZ(c)-az;
      let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
      const L=Math.hypot(nx,ny,nz);
      if(L>1e-12){fn[3*t]=nx/L;fn[3*t+1]=ny/L;fn[3*t+2]=nz/L}
    }
    /* вершины-клоны (одинаковая позиция, разные индексы) ищем по координате */
    const q=v=>Math.round(v*1e4),keyOf=i=>q(p.getX(i))+","+q(p.getY(i))+","+q(p.getZ(i));
    const keys=new Array(vc),groups=new Map();
    for(let i=0;i<vc;i++){keys[i]=keyOf(i);groups.set(keys[i],[])}
    for(let t=0;t<tri;t++)for(let k=0;k<3;k++){
      const arr=groups.get(keys[vi(3*t+k)]);
      if(arr&&arr.indexOf(t)<0)arr.push(t);      /* грань считается один раз */
    }
    const out=new Float32Array(vc*3),Buf=p.constructor;
    for(let i=0;i<vc;i++){
      const arr=groups.get(keys[i]);
      if(!arr||!arr.length){out[i*3]=0;out[i*3+1]=1;out[i*3+2]=0;continue}
      /* опорное направление склейки — среднее по всем граням этой точки */
      let rx=0,ry=0,rz=0;
      for(let j=0;j<arr.length;j++){rx+=fn[3*arr[j]];ry+=fn[3*arr[j]+1];rz+=fn[3*arr[j]+2]}
      let RL=Math.hypot(rx,ry,rz);
      if(RL>1e-8){rx/=RL;ry/=RL;rz/=RL}else{rx=fn[3*arr[0]];ry=fn[3*arr[0]+1];rz=fn[3*arr[0]+2]}
      let sx=0,sy=0,sz=0;
      for(let j=0;j<arr.length;j++){
        const t=arr[j],x=fn[3*t],y=fn[3*t+1],z=fn[3*t+2];
        if(x*x+y*y+z*z<.5)continue;              /* вырожденная грань */
        if(rx*x+ry*y+rz*z>=cosMin){sx+=x;sy+=y;sz+=z}
      }
      let L=Math.hypot(sx,sy,sz);
      if(L<1e-8){sx=rx,sy=ry,sz=rz;L=Math.hypot(sx,sy,sz)}
      if(L<1e-8){sx=0;sy=1;sz=0;L=1}
      out[i*3]=sx/L;out[i*3+1]=sy/L;out[i*3+2]=sz/L;
    }
    if(!g.attributes.normal||g.attributes.normal.count!==vc)
      g.setAttribute("normal",new Buf(new Float32Array(vc*3),3));
    const na=g.attributes.normal;
    for(let i=0;i<vc*3;i++)na.array[i]=out[i];
    na.needsUpdate=!0;
    return 1;
  }
  /* Колёса, кронштейны и звёздочки/ленивцы: одна и та же геометрия у модели
     не переиспользуется, но на всякий случай дедуплицируем по uuid. */
  function scApplySmooth(deg){
    C.smoothDeg=Te.clamp(+deg||0,0,179);
    try{localStorage.setItem("vch.scSmooth",String(C.smoothDeg))}catch(e){}
    const seen=new Set();let meshes=0;
    const roots=[];
    for(const w of wheelRigs){roots.push(w.piv);if(w.arm&&w.arm.node)roots.push(w.arm.node)}
    for(const g of gearRigs)roots.push(g.piv);
    for(const root of roots)root.traverse(o=>{
      if(!o.isMesh||o.isInstancedMesh||!o.geometry)return;
      const id=o.geometry.uuid;if(seen.has(id))return;seen.add(id);
      meshes+=scSmoothGeom(o,C.smoothDeg);
    });
    return {smoothDeg:C.smoothDeg,meshes};
  }
  function scWindPass(force){
    const t0=performance.now();
    const a=scFixWinding(modelRoot,force),b=scFixWinding(group,force);
    const st=window.__vchWindStat||(window.__vchWindStat={passes:0,fresh:0,flipped:0,ms:0});
    st.passes++,st.fresh+=a.fresh+b.fresh,st.flipped+=a.flipped+b.flipped,
    st.ms=Math.round(st.ms+performance.now()-t0);
    return {flipped:a.flipped+b.flipped,fresh:a.fresh+b.fresh,meshes:a.meshes+b.meshes};
  }
  /* ===== Вывернутые грани ==================================================
     В модели часть треугольников завёрнута не той стороной: порядок вершин
     даёт нормаль грани против вершинной нормали (в корме это воздухозаборник
     охлаждения — 15.9% граней, Side_Armor_04 — 11.6%, всего 18 мешей).
     Такая грань либо пропадает при отсечении задних поверхностей, либо ловит
     свет изнанкой — отсюда провалы и «плохой шейдинг» на корме.
     Лечим по вершинным нормалям: они в модели верные, поэтому у грани, у
     которой обход с ними спорит, меняем местами два индекса. Позиции, UV и
     нормали не трогаются — меняется только порядок обхода.              */
  /*
    Геометрию проверяем один раз. Повторные проходы раньше переворачивали спорные
    грани обратно (порог мягкий, у решёток нормали почти перпендикулярны грани) и
    каждый такой проход пересчитывал нормали всей модели — шесть проходов по
    0.15–0.3 с в первые 4.5 с, как раз пока висит стартовое меню.
    Сырые массивы вместо getX/getY/getZ: на 83 тыс. граней это в разы быстрее.
  */
  function scFixWinding(root,force){
    const seen=new Set();let meshes=0,flipped=0,fresh=0;
    root.traverse(o=>{
      if(!o.isMesh||o.isInstancedMesh||!o.geometry)return;
      const g=o.geometry;
      if(!g.index||!g.attributes.position||!g.attributes.normal)return;
      if(g.__vchWindChk&&!force)return;
      g.__vchWindChk=1;fresh++;
      const id=g.uuid;if(seen.has(id))return;seen.add(id);
      const ix=g.index,a=ix.array,p=g.attributes.position.array,n=g.attributes.normal.array,
            tri=Math.floor(g.index.count/3);
      if(!p||!n)return;
      let f=0;
      for(let t=0;t<tri;t++){
        const i0=3*t,i1=i0+1,i2=i0+2,A=3*a[i0],B=3*a[i1],C=3*a[i2];
        const ax=p[A],ay=p[A+1],az=p[A+2],
              ux=p[B]-ax,uy=p[B+1]-ay,uz=p[B+2]-az,
              vx=p[C]-ax,vy=p[C+1]-ay,vz=p[C+2]-az;
        const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,
              L=Math.hypot(nx,ny,nz);
        if(L<1e-10)continue;                        /* вырожденная — не тронута */
        const mx=n[A]+n[B]+n[C],
              my=n[A+1]+n[B+1]+n[C+1],
              mz=n[A+2]+n[B+2]+n[C+2],
              ML=Math.hypot(mx,my,mz);
        if(ML<1e-9)continue;
        /* Порог мягкий (-0.05): на тонких рёбрах решёток вершинные нормали
           почти перпендикулярны грани, и при строгом пороге такие грани
           остались бы вывернутыми. Переворот идемпотентен — после него
           скалярное произведение положительное и грань больше не трогается. */
        if((nx*mx+ny*my+nz*mz)/(L*ML) < -0.05){      /* обход спорит с нормалью */
          const tmp=a[i1];a[i1]=a[i2];a[i2]=tmp;f++
        }
      }
      if(f){ix.needsUpdate=!0;meshes++;flipped+=f}
    });
    return {meshes,flipped,fresh};
  }
  /* ===== Bevel: скругление рёбер по всей модели ==========================
     Фаску по-настоящему (вставкой граней) на импортированной GLB в рантайме
     не сделать: пришлось бы перестраивать индексы 139 узлов и ломать UV.
     Поэтому рёбра скругляются нормалями — так же делают «bevel shader»:
     вершина у ребра получает нормаль между двумя гранями, и грань ловит
     свет как фаска. Силуэт не меняется, меняется только свет.

     Вес плавный: до 30° грани усредняются целиком (это одна поверхность),
     от 30° до bevelDeg вес гасится smoothstep, круче — не трогаем вовсе.
     Так прямой угол корпуса (~90°) получает фаску примерно в 8°, а не
     «плывёт» в подушку, как при обычном сглаживании нормалей.            */
  function scBevelGeom(ch,deg){
    const g=ch.geometry;
    if(!g||!g.attributes||!g.attributes.position)return 0;
    if(!(deg>0)){                                  /* выключено — вернуть как было */
      const n0=ch.userData.__vchBev0;
      if(n0){const B=n0.constructor;
        g.setAttribute("normal",new B(n0.array.slice(0),n0.itemSize,n0.normalized));
        g.attributes.normal.needsUpdate=!0;return 1}
      return 0;
    }
    const p=g.attributes.position;
    if(!p||p.isInterleavedBufferAttribute)return 0;
    const idx=g.index,vc=p.count,tri=idx?Math.floor(idx.count/3):Math.floor(vc/3);
    if(tri<3)return 0;
    if(!ch.userData.__vchBev0&&g.attributes.normal)ch.userData.__vchBev0=g.attributes.normal.clone();
    const vi=t=>idx?idx.getX(t):t;
    const fn=new Float32Array(tri*3),fa=new Float32Array(tri);
    for(let t=0;t<tri;t++){
      const a=vi(3*t),b=vi(3*t+1),c=vi(3*t+2),
            ax=p.getX(a),ay=p.getY(a),az=p.getZ(a),
            ux=p.getX(b)-ax,uy=p.getY(b)-ay,uz=p.getZ(b)-az,
            vx=p.getX(c)-ax,vy=p.getY(c)-ay,vz=p.getZ(c)-az;
      let nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;
      const L=Math.hypot(nx,ny,nz);
      if(L>1e-12){fn[3*t]=nx/L;fn[3*t+1]=ny/L;fn[3*t+2]=nz/L}
      fa[t]=L*.5;                                  /* площадь грани — её вес */
    }
    /* вершины-клоны (одна позиция, разные индексы) — по координате */
    const q=v=>Math.round(v*1e4),keyOf=i=>q(p.getX(i))+","+q(p.getY(i))+","+q(p.getZ(i));
    const keys=new Array(vc),groups=new Map();
    for(let i=0;i<vc;i++){keys[i]=keyOf(i);groups.set(keys[i],[])}
    for(let t=0;t<tri;t++)for(let k=0;k<3;k++){
      const arr=groups.get(keys[vi(3*t+k)]);
      if(arr&&arr.indexOf(t)<0)arr.push(t);
    }
    const REACH=VCH_SC_REACH,
          FULL=Math.min(30,REACH*.35),
          cosFull=Math.cos(FULL*Math.PI/180),cosMax=Math.cos(REACH*Math.PI/180),
          inv=1/Math.max(1e-6,cosFull-cosMax);
    const out=new Float32Array(vc*3),Buf=p.constructor;
    for(let i=0;i<vc;i++){
      const arr=groups.get(keys[i]);
      if(!arr||!arr.length){out[i*3]=0;out[i*3+1]=1;out[i*3+2]=0;continue}
      /* опорная нормаль точки — площадное среднее, на неё опирается вес */
      let rx=0,ry=0,rz=0,rt=0;
      for(let j=0;j<arr.length;j++){const t=arr[j],w=fa[t]||1;
        rx+=fn[3*t]*w;ry+=fn[3*t+1]*w;rz+=fn[3*t+2]*w;rt+=w}
      let RL=Math.hypot(rx,ry,rz);
      if(RL>1e-8){rx/=RL;ry/=RL;rz/=RL}else{rx=fn[3*arr[0]];ry=fn[3*arr[0]+1];rz=fn[3*arr[0]+2]}
      let sx=0,sy=0,sz=0;
      for(let j=0;j<arr.length;j++){
        const t=arr[j],x=fn[3*t],y=fn[3*t+1],z=fn[3*t+2];
        if(x*x+y*y+z*z<.5)continue;                /* вырожденная грань */
        const c=rx*x+ry*y+rz*z;
        if(c<=cosMax)continue;                     /* острее bevelDeg — не трогаем */
        const w=(c>=cosFull)?1:(c-cosMax)*inv;
        const a=(fa[t]||1)*w*w*(3-2*w);            /* smoothstep по косинусу */
        sx+=x*a;sy+=y*a;sz+=z*a;
      }
      let L=Math.hypot(sx,sy,sz);
      if(L<1e-8){sx=rx;sy=ry;sz=rz;L=Math.hypot(sx,sy,sz)}
      if(L<1e-8){sx=0;sy=1;sz=0;L=1}
      out[i*3]=sx/L;out[i*3+1]=sy/L;out[i*3+2]=sz/L;
    }
    /* Ограничитель фаски: нормаль не уходит от плоскости своей самой крупной
       грани дальше чем на deg. Без этого на цилиндре и на стыке нескольких
       граней нормаль усреднялась до полного сглаживания, и машина становилась
       «мыльной»: пропадали сегменты ствола, плоские панели выглядели дутыми. */
    if(deg<90){
      const lim=deg*Math.PI/180;
      for(let i=0;i<vc;i++){
        const arr=groups.get(keys[i]);
        if(!arr||!arr.length)continue;
        let best=arr[0],ba=-1;
        for(let j=0;j<arr.length;j++){const t=arr[j];if(fa[t]>ba){ba=fa[t];best=t}}
        const rx=fn[3*best],ry=fn[3*best+1],rz=fn[3*best+2],
              ox=out[i*3],oy=out[i*3+1],oz=out[i*3+2];
        let c=ox*rx+oy*ry+oz*rz;
        if(c>1)c=1;else if(c<-1)c=-1;
        const ang=Math.acos(c);
        if(ang>lim){
          const t=lim/ang,
                nx2=rx*(1-t)+ox*t,ny2=ry*(1-t)+oy*t,nz2=rz*(1-t)+oz*t,
                L=Math.hypot(nx2,ny2,nz2)||1;
          out[i*3]=nx2/L;out[i*3+1]=ny2/L;out[i*3+2]=nz2/L;
        }
      }
    }
    if(!g.attributes.normal||g.attributes.normal.count!==vc)
      g.setAttribute("normal",new Buf(new Float32Array(vc*3),3));
    const na=g.attributes.normal;
    for(let i=0;i<vc*3;i++)na.array[i]=out[i];
    na.needsUpdate=!0;
    return 1;
  }
  /* Bevel на всю машину: и корпус (modelRoot), и башню со стволом — они при
     монтировании перепривязываются из модели в свои узлы рига (turret /
     gunPivot / recoilGroup), поэтому обход одного modelRoot их не видел:
     обрабатывался 51 меш из 182, башня (105 мешей) оставалась без фаски.
     Исключения: катки и звёздочки — у них свой, более агрессивный режим
     (smoothDeg), он накатывается поверх; лента — у неё свой материал с
     flatShading и процедурная геометрия, её вид не должен меняться. */
  function scApplyBevel(deg){
    C.bevelDeg=Te.clamp(+deg||0,0,30);
    try{localStorage.setItem("vch.scBevel",String(C.bevelDeg))}catch(e){}
    const skip=new Set();
    const mark=root=>{ if(!root)return; root.traverse(o=>{ if(o.isMesh)skip.add(o) }) };
    for(const w of wheelRigs){ mark(w.piv); if(w.arm&&w.arm.node)mark(w.arm.node) }
    for(const g of gearRigs) mark(g.piv);
    const seen=new Set();let meshes=0;
    group.traverse(o=>{
      if(!o.isMesh||o.isInstancedMesh||!o.geometry||skip.has(o))return;
      const M=Array.isArray(o.material)?o.material:[o.material];
      if(M.some(m=>m&&m.flatShading))return;         /* лента */
      const id=o.geometry.uuid;if(seen.has(id))return;seen.add(id);
      meshes+=scBevelGeom(o,C.bevelDeg);
    });
    return {bevelDeg:C.bevelDeg,meshes};
  }
  function scGearSeat(k){
    const v=Te.clamp(+k,0,1);
    C.gearSeat=v;
    try{localStorage.setItem("vch.scSeat",String(v))}catch(e){}
    for(const g of gearRigs){
      const b=(typeof g.rBody==="number"&&g.rBody>0)?g.rBody:g.rTip;
      const tp=(typeof g.rTip==="number"&&g.rTip>0)?g.rTip:g.r;
      g.r=b+(tp-b)*v;
    }
    scGearShape();
    /* сжатие зубьев пересчитывает нормали вычислением — после него катки
       снова гранёные, поэтому сглаживание накатываем заново */
    if(C.smoothDeg>0)scApplySmooth(C.smoothDeg);
    for(const t of trackGroups){t.linkCount=0;scRoller(t)}
    return v;
  }
  try{const sv=localStorage.getItem("vch.scSeat");if(sv!=null&&isFinite(+sv))C.gearSeat=Te.clamp(+sv,0,1)}catch(e){}
  try{const sv=localStorage.getItem("vch.scSmooth");if(sv!=null&&isFinite(+sv))C.smoothDeg=Te.clamp(+sv,0,179)}catch(e){}
  try{const sv=localStorage.getItem("vch.scBevel");if(sv!=null&&isFinite(+sv)&&+sv<=30)C.bevelDeg=Te.clamp(+sv,0,30)}catch(e){}
  scGearSeat(C.gearSeat);
  /* Часть узлов (решётки, навесное оборудование) добавляется в модель уже
     после монтирования — при монтировании их в дереве ещё нет (75 и 130 мешей
     против 182 в собранной машине). Поэтому вывернутые грани ловим несколькими
     проходами с нарастающим интервалом: проход, нашедший хоть одну грань,
     пересчитывает нормали заново, иначе bevel считал бы нормали граней по
     старому, вывернутому обходу. */
  scWindPass();
  { const steps=[120,400,1200,2600,5000];let i=0,idle=0;
    const tick=()=>{
      const rw=scWindPass();
      if(rw.flipped&&C.bevelDeg>0)scApplyBevel(C.bevelDeg); /* нормали считаются по обходу */
      /* новых геометрий нет — модель собрана, правка больше не нужна:
         выходим и прогреваем шейдеры уже на собранной машине */
      idle=rw.fresh?0:idle+1;
      if(idle<2&&i<steps.length)setTimeout(tick,steps[i++]);
      else vchWarmAll("assembled");
    };
    setTimeout(tick,steps[i++]);
  }
  scApplyBevel(C.bevelDeg);          /* после посадки: колеса уже обработаны */

  (window.__vchScRigs=window.__vchScRigs||[]).push({seat:scGearSeat,smooth:scApplySmooth,bevel:scApplyBevel});
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
      /* двигаем весь узел: кронштейн на корпусе, каток — его ребёнок */
      if(w.arm&&C.armMove!==!1){
        w.arm.piv.position.y=w.arm.baseY+w.dy/s;
        if(w.piv.position.y!==w.baseY)w.piv.position.y=w.baseY;
      }else w.piv.position.y=(w.arm?w.baseY+w.dy/s:w.baseY+w.dy/s);
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
              gearSeat:+C.gearSeat.toFixed(3),
              gearRadii:gearRigs.map(g=>({side:g.side,drive:!!g.drive,
                r:+g.r.toFixed(3),tip:+(g.rTip||0).toFixed(3),body:+(g.rBody||0).toFixed(3)})),
              /* длина петли — из живого солвера (до первого кадра — оценка по оболочке) */
              get trackLen(){const g=trackGroups[0];
                const v=g&&g.sampler?g.sampler.total:(bandPaths[-1]||vchScBelt(circlesNow(),.1)).total;
                return +v.toFixed(2)},
              bandPath:!!bandPaths[-1]};
  window.__vchScArm=on=>{C.armMove=!!on;return{armMove:C.armMove,arms:armRigs.length}};
  /* Шейд смуз катков: __vchScSmooth(62) — сгладить, __vchScSmooth(0) — вернуть
     нормали модели. Угол в градусах: чем больше, тем мягче (кромки тоже
     замыливаются). Значение хранится в localStorage["vch.scSmooth"]. */
  window.__vchScSmooth=d=>scApplySmooth(d);
  /* Bevel («фаска») по всей модели Скорпиона: __vchScBevel(100) — по умолчанию,
     __vchScBevel(0) — вернуть нормали модели. Угол в градусах: чем больше,
     тем мягче рёбра (150 — почти полное сглаживание). Хранится в
     localStorage["vch.scBevel"]. */
  window.__vchScBevel=d=>scApplyBevel(d);
  /* Повторно выправить обход граней (на случай, если модель пересобрана):
     __vchScWind() -> {meshes, flipped}. */
  window.__vchScWind=()=>{const f=scWindPass(!0).flipped;
    if(f&&C.bevelDeg>0)scApplyBevel(C.bevelDeg);
    if(f&&C.smoothDeg>0)scApplySmooth(C.smoothDeg);
    return {flipped:f};};
  window.__vchScSeat=v=>({seat:scGearSeat(v),
    gears:gearRigs.map(g=>({side:g.side,drive:!!g.drive,r:+g.r.toFixed(4),
      tip:+(g.rTip||0).toFixed(4),body:+(g.rBody||0).toFixed(4)}))});
  chassis.userData.__vchRole="chassis";
  turret.userData.__vchRole="turret";
  gunPivot.userData.__vchRole="gunPivot";
  recoilGroup.userData.__vchRole="recoilGroup";
  muzzlePoint.userData.__vchRole="muzzlePoint";
  function bakeFlatTracks(){
    chassis.updateWorldMatrix(!0,!1);
    for(const t of trackGroups){
      for(const w of t.wheels)w.dy=0;
      scTrack(t,0,0);
    }
  }
  return {group,chassis,turret,turretStab,gunPivot,recoilGroup,muzzlePoint,muzzle:muzzlePoint,
          casePort,caseFlap,
          tracks:{left:{userData:{update(){}}},right:{userData:{update(){}}}},
          wheels:{left:wheelRigs.filter(w=>w.side<0),right:wheelRigs.filter(w=>w.side>0)},
          gearRigs,wheelRigs,
          trackGroups,
          materials:{paint:M.paint,paintLight:M.paintLight,paintDark:M.paintDark,
                     wheelHub:M.wheelHub,steel:M.steel,steelDark:M.steelDark,
                     track:M.track,trackTex:!!M.track.map},
          update,fireRecoil,getMuzzle,getMuzzleBrakepoints,bakeFlatTracks,
          state:D,custom:!0,scorpion:!0,info,source:src};
}
