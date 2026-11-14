/* ==========================================================================
"use strict";
   vch36 · js/19-look.js
   рефлексы (IBL), потёртости брони, розовая ливрея
   ---------------------------------------------------------------------------
   Подключается последним <script defer> — после 18-boot.js, поэтому все
   материалы, сцена и шасси уже существуют; новые наборы материалов (танки,
   загружаемые модели) подхватываются через обёртку Nw().

   1. РЕФЛЕКСЫ.  Окружение строится заново из того же шейдера неба, что рисует
      купол (vSkyUniforms/V_SKY_VS/V_SKY_FS), но в отдельной сцене: небо,
      дисковое полусферическое «дно» и яркий диск солнца. PMREM даёт
      префильтрованные мипы — дальше scene.environment работает на ВСЕХ
      MeshStandardMaterial сразу (танк, Скорпион, грунт, бетон, бочки, ракеты).
      Правила по материалам задают шероховатость/металличность под рефлекс:
      краска .42/.22, сталь .18/.92, оптика .06/1.0 и т.д.

   2. ПОТЁРТОСТИ.  В геометрию танка запекается атрибут aWear — кривизна
      поверхности: у скруглённых кромок и рёбер плит нормали соседних граней
      расходятся сильно, на плоских листах — нет. В шейдер материала
      (onBeforeCompile) добавляются: сколы краски до металла по рёбрам,
      царапины, пыль на верхних плоскостях, грязь снизу по высоте над
      грунтом (uBaseY обновляется каждый кадр из шасси). Появляется ровно там,
      где изнашивается реальная машина: рёбра плит и люков, крылья, низ
      корпуса у катков, верхние плоскости под пылью.

   3. ЛИВРЕЯ.  Добавлен розовый вариант в палитру VCH_LIVERY; клавиша L
      перебирает amber → khaki → pink. Выбор сохраняется в vch36.livery.
   ========================================================================== */
"use strict";

/* ============================ 1. РЕФЛЕКСЫ ================================= */

/* Интенсивность окружения по локации: на космодроме небо тёмное, но
   «звёздное» окружение даёт больше контраста на металле. */
function vchEnvLevel(){
  if(VCH_MAP===4)return 1.0;
  if(VCH_MAP===3)return (typeof VCH_MAP01_ENVLEVEL==="number")?VCH_MAP01_ENVLEVEL:0.9;
  return VCH_MAP===2?1.45:(VCH_MAP===1?1.12:1.0);
}

let VCH_ENV_RT=null;
function vchBuildEnv(){
  if(!jf||!cn)return null;
  const sc=new rf();

  /* небо — тот же шейдер, что у купола: отражение совпадает с тем, что видно */
  const sky=new Lt(new Sa(10,48,28),
    new $e({side:Ze,depthWrite:!1,uniforms:vSkyUniforms(),vertexShader:V_SKY_VS,fragmentShader:V_SKY_FS}));
  sc.add(sky);

  /* диск солнца: единственный HDR-источник, из-за него на металле появляется
     резкий горячий блик, а на краске — мягкая дорожка */
  const sunDot=new Lt(new Sa(.55,16,12),new $e({
    vertexShader:"void main(){ gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
    fragmentShader:"void main(){ gl_FragColor=vec4(14.0,12.6,10.4,1.0); }"
  }));
  const sd=V_SUNDIR.clone().multiplyScalar(8.4);
  sunDot.position.copy(sd);
  sc.add(sunDot);

  /* «земля» под горизонтом — тёмная плоскость, чтобы низ корпуса не ловил
     отражение неба снизу (иначе броня выглядит «пластиковой») */
  const floor=new Lt(new Sa(9.4,24,12),new $e({
    side:Ze,
    vertexShader:"varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
    fragmentShader:"varying vec3 vP; void main(){ float k=smoothstep(-1.0,-6.5,vP.y); gl_FragColor=vec4(mix(vec3(.02,.022,.025),vec3(.28,.24,.19),k),1.0); }"
  }));
  floor.position.y=-6.2;
  sc.add(floor);

  const rt=jf.fromScene(sc,.02,.1,40);
  if(VCH_ENV_RT&&VCH_ENV_RT.dispose)VCH_ENV_RT.dispose();
  VCH_ENV_RT=rt;
  cn.environment=rt.texture;
  cn.environmentIntensity=vchEnvLevel();

  sc.traverse(o=>{ if(o.geometry)o.geometry.dispose(); if(o.material)o.material.dispose(); });
  return rt;
}

/* ---------- правила «как поверхность отвечает на окружение» ---------------- */
/* Общий множитель к правилам отражения. HDRI рассвета заметно ярче синтетического
   окружения дневной сборки, поэтому правила «как есть» (paint 1.05, steel 1.30)
   выжигали краску и металл в белое. 1.0 — правила без изменений, 0.72 — рабочее
   значение рассвета. Меняется на ходу ползунком «Блеск брони» (клавиша F). */
let VCH_REFLECT_GAIN=0.72;
const VCH_REFLECT={
  /* Краска остаётся полуматовой: блеск есть (небо читается на плоскостях),
     но плоские грани не выжигаются в белое. Блестящее — металл и оптика. */
  paint:      {r:.58,m:.22,e:1.05},
  paintLight: {r:.55,m:.20,e:1.10},
  paintDark:  {r:.62,m:.34,e:1.00},
  sleeve:     {r:.50,m:.30,e:1.10},
  paintWorn:  {r:.62,m:.26,e:.95},
  wheelHub:   {r:.55,m:.45,e:1.05},
  steel:      {r:.30,m:.85,e:1.30},
  steelDark:  {r:.38,m:.75,e:1.10},
  track:      {r:.68,m:.50,e:.80},
  capRed:     {r:.38,m:.40,e:1.15},
  rubber:     {r:.90,m:.04,e:.35},
  optic:      {r:.08,m:1.0,e:1.80},
  lampAmber:  {r:.30,m:.20,e:1.00},
  lampRed:    {r:.38,m:.20,e:1.00},
  canvas:     {r:.94,m:.03,e:.45},
  rust:       {r:.86,m:.30,e:.60},
  mud:        {r:1.0,m:.02,e:.30},
  stowage:    {r:.88,m:.08,e:.55},
  stowageDark:{r:.88,m:.10,e:.55}
};

function vchReflectApply(M){
  if(!M)return M;
  for(const k in M){
    const mat=M[k]; if(!mat||!mat.isMeshStandardMaterial)continue;
    const rule=VCH_REFLECT[k];
    if(rule){
      mat.roughness=rule.r;
      mat.metalness=rule.m;
      mat.envMapIntensity=rule.e*VCH_REFLECT_GAIN;
    }else if(mat.envMapIntensity===undefined||mat.envMapIntensity<.85){
      mat.envMapIntensity=.9*VCH_REFLECT_GAIN;
    }
    mat.needsUpdate=true;
  }
  return M;
}

/* Материалы сцены вне набора танка (грунт, бетон, бочки, ракеты, небо-объекты):
   им тоже нужен отклик окружения, иначе они «выпадают» из общей картинки. */
function vchReflectScene(){
  cn.traverse(o=>{
    const m=o.material; if(!m)return;
    for(const mm of (Array.isArray(m)?m:[m])){
      if(!mm||!mm.isMeshStandardMaterial)continue;
      if(mm.__vchRefl)continue;
      mm.__vchRefl=1;
      if((mm.envMapIntensity??0)<.9)mm.envMapIntensity=.9;
      /* ничего не должно превращаться в зеркало: ниже .12 не опускаем */
      if((mm.roughness??1)<.12)mm.roughness=.12;
      mm.needsUpdate=true;
    }
  });
}

/* ============================ 2. ПОТЁРТОСТИ =============================== */

/* ---------- шум для сколов/грязи (одна текстура на все материалы) --------- */
let VCH_WEAR_TEX=null;
function vchWearTex(){
  if(VCH_WEAR_TEX)return VCH_WEAR_TEX;
  const N=256,c=Qs(N),g=c.getContext("2d"),img=g.createImageData(N,N),d=img.data;
  /* value-noise с несколькими октавами + редкие «волосяные» штрихи */
  const lat=(n)=>{const a=new Float32Array(n*n);for(let i=0;i<n*n;i++)a[i]=Math.random();return a};
  const layers=[[8,lat(8)],[16,lat(16)],[32,lat(32)],[64,lat(64)],[128,lat(128)]];
  const sm=(t)=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    let v=0,amp=.5,tot=0;
    for(const [n,a] of layers){
      const fx=x/N*n, fy=y/N*n, x0=Math.floor(fx), y0=Math.floor(fy),
            tx=sm(fx-x0), ty=sm(fy-y0),
            i0=(y0%n)*n+(x0%n), i1=(y0%n)*n+((x0+1)%n),
            i2=((y0+1)%n)*n+(x0%n), i3=((y0+1)%n)*n+((x0+1)%n);
      v+=amp*((a[i0]*(1-tx)+a[i1]*tx)*(1-ty)+(a[i2]*(1-tx)+a[i3]*tx)*ty);
      tot+=amp;amp*=.55;
    }
    v/=tot;
    const px=(y*N+x)<<2, g8=Math.max(0,Math.min(255,(v*255)|0));
    d[px]=d[px+1]=d[px+2]=g8;d[px+3]=255;
  }
  g.putImageData(img,0,0);
  /* царапины: короткие светлые штрихи — читаются как задиры на металле */
  g.strokeStyle="rgba(255,255,255,0.55)";g.lineWidth=1;
  for(let i=0;i<220;i++){
    const x=Math.random()*N,y=Math.random()*N,a=Math.random()*6.283,l=3+Math.random()*22;
    g.beginPath();g.moveTo(x,y);g.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l);g.stroke();
  }
  const t=new Ks(c);
  t.wrapS=t.wrapT=vi;t.anisotropy=4;
  VCH_WEAR_TEX=t;
  return t;
}

/* Общие uniform'ы: один объект на все материалы, обновляется в кадре. */
let VCH_WEAR_BASE=1;                       /* 0 выкл … 1 норма (пауза → ИЗНОС) */
const VCH_WEAR_U={
  uBaseY:{value:0},      /* мировая высота днища танка */
  uGain:{value:1},       /* общая сила износа */
  uMudCol:{value:new Ft(0x4a3b2b)},
  uDustCol:{value:new Ft(0x8b8069)},
  uSteelCol:{value:new Ft(0x6b6f72)}
};

const VCH_WEAR_VS_HEAD=`
attribute float aWear;
varying float vWear;
varying vec3 vWP;
varying vec3 vWN;
`;
const VCH_WEAR_VS_BODY=`
  vWear = aWear;
  vec4 vchWp = modelMatrix * vec4( position, 1.0 );
  vWP = vchWp.xyz;
  vWN = normalize( mat3( modelMatrix ) * objectNormal );
`;

const VCH_WEAR_FS_HEAD=`
uniform sampler2D uWearNoise;
uniform float uBaseY;
uniform float uGain;
uniform vec3 uMudCol;
uniform vec3 uDustCol;
uniform vec3 uSteelCol;
varying float vWear;
varying vec3 vWP;
varying vec3 vWN;
`;

/* Вызывается сразу после <map_fragment>: дальше этой точки идут чанки
   roughnessmap/metalnessmap, поэтому переменные видны и им. */
const VCH_WEAR_FS_BODY=`
  float vchH = vWP.y - uBaseY;
  float vchBig  = texture2D( uWearNoise, vWP.xz * 0.075 ).r;
  float vchMid  = texture2D( uWearNoise, vec2( vWP.x + vWP.z, vWP.y ) * 0.42 ).r;
  float vchFine = texture2D( uWearNoise, vec2( vWP.z - vWP.x, vWP.y * 1.7 ) * 1.35 ).r;

  /* грязь снизу: поднимается от днища, рваная по шуму */
  float vchMudBand = smoothstep( 1.15, 0.03, vchH );
  float vchMud = vchMudBand * smoothstep( 0.22, 0.86, vchBig * 0.75 + vchFine * 0.25 );
  vchMud *= uGain;

  /* пыль на верхних плоскостях: чем «ровнее вверх» нормаль, тем больше */
  float vchUp = clamp( vWN.y, 0.0, 1.0 );
  float vchDust = pow( vchUp, 2.2 ) * smoothstep( 0.30, 0.92, vchBig ) * ( 0.22 + 0.34 * smoothstep( 0.55, 1.5, vchH ) );
  vchDust *= uGain;

  /* сколы по рёбрам: кривизна из aWear × шум, металл проступает из-под краски */
  /* кромки: сколы идут пятнами по шуму, а не сплошной каймой */
  float vchEdge = clamp( vWear, 0.0, 1.0 );
  /* Геометрия танка собрана из крупных примитивов: у плоской плиты все
     вершины лежат на кромках, поэтому aWear задаёт не «где именно скол», а
     «здесь краска может быть сбита». Конкретные пятна выбирает шум, и сила
     скола намеренно умеренная — броня остаётся крашеной, а не голым металлом. */
  /* Крупные грани модели дают грубую интерполяцию aWear: без второй маски
     скол разливался светлыми плитами на всю панель. Поэтому скол — это
     мелкая крапина: строгий порог по высокочастотному шуму и мягкий предел
     смешивания, чтобы краска оставалась краской. */
  float vchSpk  = texture2D( uWearNoise, vec2( vWP.x + vWP.z, vWP.y * 2.3 ) * 2.55 ).r;
  float vchChip = smoothstep( 0.70, 0.97, vchEdge * ( 0.34 + vchMid * 0.95 ) )
                * smoothstep( 0.52, 0.88, vchSpk );
  float vchScr  = smoothstep( 0.84, 0.99, vchFine ) * smoothstep( 0.55, 0.98, vchEdge );

  vchChip *= clamp( uGain, 0.0, 1.0 );
  vchScr  *= clamp( uGain, 0.0, 1.0 );

  #ifdef VCH_CHIP
    diffuseColor.rgb = mix( diffuseColor.rgb, uSteelCol, clamp( vchChip, 0.0, 0.26 ) );
    diffuseColor.rgb = mix( diffuseColor.rgb, uSteelCol, vchScr * 0.30 );
  #endif

  diffuseColor.rgb = mix( diffuseColor.rgb, uMudCol,  clamp( vchMud  * 0.62, 0.0, 0.70 ) );
  diffuseColor.rgb = mix( diffuseColor.rgb, uDustCol, clamp( vchDust,       0.0, 0.28 ) );
`;

const VCH_WEAR_ROUGH=`
  roughnessFactor = mix( roughnessFactor, 0.52, clamp( vchChip + vchScr, 0.0, 1.0 ) * 0.30 );
  roughnessFactor = mix( roughnessFactor, 0.97, clamp( vchMud + vchDust * 1.6, 0.0, 1.0 ) );
`;
/* Металличность от скола не поднимаем: на плоских гранях металл ловит
   окружение и превращается в белые пятна. Металл под краской читается
   цветом и шероховатостью, без скачка металличности. */
const VCH_WEAR_METAL=``;

function vchWearPatch(mat,chip){
  if(!mat||mat.__vchWear)return mat;
  mat.__vchWear=1;
  if(chip)mat.defines=Object.assign({},mat.defines,{VCH_CHIP:1});
  mat.onBeforeCompile=function(shader){
    shader.uniforms.uWearNoise={value:vchWearTex()};
    shader.uniforms.uBaseY=VCH_WEAR_U.uBaseY;
    shader.uniforms.uGain=VCH_WEAR_U.uGain;
    shader.uniforms.uMudCol=VCH_WEAR_U.uMudCol;
    shader.uniforms.uDustCol=VCH_WEAR_U.uDustCol;
    shader.uniforms.uSteelCol=VCH_WEAR_U.uSteelCol;

    shader.vertexShader=VCH_WEAR_VS_HEAD+shader.vertexShader
      .replace("#include <begin_vertex>","#include <begin_vertex>"+VCH_WEAR_VS_BODY);

    shader.fragmentShader=VCH_WEAR_FS_HEAD+shader.fragmentShader
      .replace("#include <map_fragment>","#include <map_fragment>"+VCH_WEAR_FS_BODY)
      .replace("#include <roughnessmap_fragment>","#include <roughnessmap_fragment>"+VCH_WEAR_ROUGH)
      .replace("#include <metalnessmap_fragment>","#include <metalnessmap_fragment>"+VCH_WEAR_METAL);
  };
  mat.customProgramCacheKey=function(){return "vch36wear-"+(chip?"chip":"bare")};
  mat.needsUpdate=true;
  return mat;
}

const VCH_WEAR_CHIP_SLOTS=["paint","paintLight","paintDark","sleeve","paintWorn","wheelHub","canvas","stowage","stowageDark"];
const VCH_WEAR_BARE_SLOTS=["steel","steelDark","track","capRed"];

function vchWearApply(M){
  if(!M)return M;
  for(const k of VCH_WEAR_CHIP_SLOTS)if(M[k])vchWearPatch(M[k],true);
  for(const k of VCH_WEAR_BARE_SLOTS)if(M[k])vchWearPatch(M[k],false);
  return M;
}

/* ---------- запекание кривизны в атрибут aWear ---------------------------- */

/* Метрика — локальная кривизна: |ΔN| / |Δp| по соседям в радиусе 7 см.
   Плоский лист: нормали соседей совпадают → 0. Скруглённая кромка плиты:
   нормаль «поворачивается» на десятки градусов на паре сантиметров → десятки
   радиан на метр. Гладкий каток (R 0.4 м) — единицы: почти не изнашивается.
   Так сколы сами собой оказываются на рёбрах, кромках люков и мелкой
   оснастке, а не размазываются по всей броне. */
function vchBakeWear(geo){
  if(!geo||!geo.attributes||!geo.attributes.position)return false;
  if(geo.getAttribute&&geo.getAttribute("aWear"))return true;
  const pos=geo.attributes.position, nrm=geo.attributes.normal, n=pos.count;
  if(!nrm||n>160000)return false;

  /* 1. свариваем вершины по позиции: одна геометрическая точка — одна запись */
  const keyOf=i=>((pos.getX(i)*1200)|0)+","+((pos.getY(i)*1200)|0)+","+((pos.getZ(i)*1200)|0);
  const uniq=new Map(), verts=new Array(n);
  for(let i=0;i<n;i++){
    const k=keyOf(i);
    let u=uniq.get(k);
    if(!u){u={x:pos.getX(i),y:pos.getY(i),z:pos.getZ(i),nx:0,ny:0,nz:0,c:0,idx:uniq.size};uniq.set(k,u)}
    u.nx+=nrm.getX(i);u.ny+=nrm.getY(i);u.nz+=nrm.getZ(i);u.c++;
    verts[i]=u.idx;
  }
  const pts=[];
  for(const u of uniq.values()){
    const l=Math.hypot(u.nx,u.ny,u.nz)||1;
    pts[u.idx]={x:u.x,y:u.y,z:u.z,nx:u.nx/l,ny:u.ny/l,nz:u.nz/l,k:0};
  }
  const m=pts.length;
  if(!m)return false;

  /* 2. сетка 7 см: для каждой точки — сумма |ΔN| и |Δp| по сосседям */
  const CELL=.07, C2=CELL*CELL, grid=new Map();
  const ck=(x,y,z)=>((x/CELL)|0)+","+((y/CELL)|0)+","+((z/CELL)|0);
  for(let i=0;i<m;i++){
    const p=pts[i], k=ck(p.x,p.y,p.z);
    let a=grid.get(k);if(!a){a=[];grid.set(k,a)}
    a.push(i);
  }
  for(let i=0;i<m;i++){
    const p=pts[i], cx=(p.x/CELL)|0, cy=(p.y/CELL)|0, cz=(p.z/CELL)|0;
    let num=0, den=0;
    for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){
      const a=grid.get((cx+dx)+","+(cy+dy)+","+(cz+dz));
      if(!a)continue;
      for(const j of a){
        if(j===i)continue;
        const q=pts[j], ddx=q.x-p.x, ddy=q.y-p.y, ddz=q.z-p.z;
        const d2=ddx*ddx+ddy*ddy+ddz*ddz;
        if(d2>C2||d2<1e-10)continue;
        num+=Math.hypot(q.nx-p.nx,q.ny-p.ny,q.nz-p.nz);
        den+=Math.sqrt(d2);
      }
    }
    p.k=den>1e-6?num/den:0;
  }

  /* 3. кривизна -> 0..1 и обратно в вершины */
  const wear=new Float32Array(n);
  for(let i=0;i<n;i++){
    const k=pts[verts[i]].k;
    let w=(k-4)/12;                       /* 4 рад/м — почти плоско, 16 — острая кромка */
    w=w<0?0:(w>1?1:w);
    wear[i]=w*w*(3-2*w);
  }
  geo.setAttribute("aWear",new Ve(wear,1));
  return true;
}

/* Скан: атрибут aWear нужен геометрии танков (игрок, ИИ, Скорпион, загруженные
   модели). Бочки/ящики/здания не трогаем — у них в шейдере aWear = 0, хватает
   грязи и пыли по высоте. Обход — раз в 20 кадров, запекание — по 3 геометрии
   за кадр, чтобы старт не залипал. */
let VCH_WEAR_QUEUE=[], VCH_WEAR_TICK=0;
function vchTankRoots(){
  const out=[];
  try{
    if(typeof qt!=="undefined"&&qt&&qt.group)out.push(qt.group);
    if(typeof VCH_TANKS!=="undefined")for(const t of VCH_TANKS){
      if(t&&t.rig&&t.rig.group&&out.indexOf(t.rig.group)<0)out.push(t.rig.group);
    }
    if(window.__vchGarage&&window.__vchGarage.getDisplayRoots){
      for(const r of window.__vchGarage.getDisplayRoots()){
        if(r&&out.indexOf(r)<0)out.push(r);
      }
    }
  }catch(e){}
  return out;
}
function vchWearScan(){
  if(!cn)return 0;
  if(VCH_WEAR_TICK++ % 20 === 0){
    for(const root of vchTankRoots()){
      root.traverse(o=>{
        if(!o.isMesh||o.isInstancedMesh)return;
        const m=o.material;if(!m||Array.isArray(m))return;
        const g=o.geometry;
        if(!g||(g.getAttribute&&g.getAttribute("aWear")))return;
        if(VCH_WEAR_QUEUE.indexOf(g)<0)VCH_WEAR_QUEUE.push(g);
      });
    }
  }
  let done=0;
  while(VCH_WEAR_QUEUE.length&&done<3){
    const g=VCH_WEAR_QUEUE.shift();
    if(vchBakeWear(g))done++;
  }
  return VCH_WEAR_QUEUE.length;
}

/* ======================= 3. ЛИВРЕЯ: РОЗОВАЯ =============================== */

/* Парадная розовая: тёплый розовый по броне, графит по силовому набору,
   бордовые торцы ракет — по той же схеме слотов, что amber/khaki. */
/* программная смена (__vchLivery.set / консоль) тоже должна обновлять HUD */
if(window.__vchLivery&&!window.__vchLivery.__vchBadge){
  const set0=window.__vchLivery.set;
  window.__vchLivery.set=function(k){
    const r=set0?set0(k):undefined;
    const b=document.getElementById("liverybadge");
    if(b){
      b.textContent="ОКРАСКА: "+vchLiverySpec().label;
      b.classList.remove("flash");void b.offsetWidth;b.classList.add("flash");
    }
    if(window.__vchLookLiveryUI)window.__vchLookLiveryUI();
    if(window.__vchGarage&&window.__vchGarage.syncLiveryUI)window.__vchGarage.syncLiveryUI();
    return r;
  };
  window.__vchLivery.__vchBadge=!0;
}

if(!VCH_LIVERY.pink){
  VCH_LIVERY.pink={
    label:"РОЗОВЫЙ (парадный)",
    paint:0xd9538a, paintLight:0xf08cb4, paintDark:0x43323a, sleeve:0xcf4a80,
    paintWorn:0xe794b3, wheelHub:0x554349, rubber:0x1d191c, track:0xa39aa0,
    steel:0xa8a0a6, steelDark:0x453c42, capRed:0xb02f4f
  };
  VCH_LIVERY_KEYS.push("pink");
}

/* Кнопки окраски в меню паузы: три варианта, активная подсвечена. */
function vchLookLiveryUI(){
  const seg=document.getElementById("pm-liv");
  if(!seg)return;
  const mark=()=>{
    for(const b of seg.children)b.classList.toggle("on",b.dataset.liv===VCH_LIVERY_ON);
  };
  for(const b of seg.children){
    b.addEventListener("click",()=>{
      const k=b.dataset.liv;
      if(!VCH_LIVERY[k])return;
      /* идём через __vchLivery.set — он же обновляет HUD-бейдж */
      if(window.__vchLivery&&window.__vchLivery.set)window.__vchLivery.set(k);
      else{VCH_LIVERY_ON=k;vchLiveryApply()}
      try{localStorage.setItem("vch36.livery",k)}catch(e){}
      try{an.clank()}catch(e){}
      mark();
    });
  }
  mark();
  window.__vchLookLiveryUI=mark;
  /* при каждом открытии паузы подсветка пересчитывается — на случай, если
     окраску сменили клавишей L или из консоли, пока меню было закрыто */
  try{
    const P=window.__vchUI&&window.__vchUI.pause;
    if(P&&!P.__vchSeg){const tg=P.toggle;P.toggle=function(){const r=tg.apply(this,arguments);if(this.on){mark();if(window.__vchLookWearUI)window.__vchLookWearUI()}return r};P.__vchSeg=!0}
  }catch(e){}
}

/* Кнопки силы износа в меню паузы. */
function vchLookWearUI(){
  const seg=document.getElementById("pm-wear");
  if(!seg)return;
  const mark=()=>{
    for(const b of seg.children)b.classList.toggle("on",Math.abs(+b.dataset.wear-VCH_WEAR_BASE)<.01);
  };
  for(const b of seg.children){
    b.addEventListener("click",()=>{
      VCH_WEAR_BASE=+b.dataset.wear;
      VCH_WEAR_U.uGain.value=VCH_WEAR_BASE*(VCH_MAP===1?1.18:1.0);
      try{localStorage.setItem("vch36.wear",String(VCH_WEAR_BASE))}catch(e){}
      mark();
      if(window.__vchGarage&&window.__vchGarage.syncWearUI)window.__vchGarage.syncWearUI();
    });
  }
  try{
    const v=localStorage.getItem("vch36.wear");
    if(v!==null){ const n=+v; if(isFinite(n)&&n>=0&&n<=1)VCH_WEAR_BASE=n; }
  }catch(e){}
  VCH_WEAR_U.uGain.value=VCH_WEAR_BASE*(VCH_MAP===1?1.18:1.0);
  mark();
  window.__vchLookWearUI=mark;
}

/* ============================ ПОДКЛЮЧЕНИЕ ================================ */

let VCH_LOOK_ON=!1;
function vchLookInit(){
  if(VCH_LOOK_ON)return VCH_LOOK_ON;
  VCH_LOOK_ON=!0;

  /* 1. окружение */
  try{vchBuildEnv()}catch(e){console.warn("[look] env",e)}

  /* 2. материалы: сначала уже созданные наборы, потом перехват Nw() */
  try{
    for(const M of VCH_MATSETS){vchReflectApply(M);vchWearApply(M)}
  }catch(e){console.warn("[look] matsets",e)}

  if(typeof window.Nw==="function"&&!window.Nw.__vchLook){
    const base=window.Nw;
    const wrapped=function(){
      const M=base.apply(this,arguments);
      try{vchReflectApply(M);vchWearApply(M)}catch(e){}
      return M;
    };
    wrapped.__vchLook=!0;
    window.Nw=wrapped;
  }

  vchReflectScene();

  /* 3. износ: докачиваем атрибуты порциями + ведём высоту днища */
  const tick=()=>{
    try{
      vchWearScan();
      /* высота днища = высота грунта под машиной: от неё считается грязевой пояс */
      if(window.__vchGarage&&window.__vchGarage.active){
        VCH_WEAR_U.uBaseY.value=window.__vchGarage.turntableY??0.26;
      }else if(Ce&&Ce.body&&Ce.body.position){
        const bp=Ce.body.position;
        VCH_WEAR_U.uBaseY.value=(typeof ge==="function")?ge(bp.x,bp.z):bp.y-1.6;
      }
      /* сила износа: выбор игрока (пауза → ИЗНОС) × «на песочнице грязнее» */
      VCH_WEAR_U.uGain.value=VCH_WEAR_BASE*(VCH_MAP===1?1.18:1.0);
      if(cn&&cn.environment&&cn.environmentIntensity!==vchEnvLevel())cn.environmentIntensity=vchEnvLevel();
    }catch(e){}
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  /* 4a. кнопки окраски и силы износа в паузе */
  vchLookLiveryUI();
  vchLookWearUI();

  /* 4. сохранённая ливрея могла быть розовой — теперь ключ известен */
  try{
    const lv=localStorage.getItem("vch36.livery");
    if(lv&&VCH_LIVERY[lv]&&lv!==VCH_LIVERY_ON){VCH_LIVERY_ON=lv;vchLiveryApply()}
  }catch(e){}

  return !0;
}

/* API для проверок и консоли */
window.__vchLook={
  init:vchLookInit,
  env:()=>vchBuildEnv(),
  envLevel:vchEnvLevel,
  wearQueue:()=>VCH_WEAR_QUEUE.length,
  wearGain:(v)=>{ if(v!==undefined){VCH_WEAR_BASE=Math.max(0,Math.min(1,v));VCH_WEAR_U.uGain.value=VCH_WEAR_BASE*(VCH_MAP===1?1.18:1.0);} return VCH_WEAR_BASE},
  /* подстройка цветов износа из консоли/тестов */
  setWear:(o={})=>{
    if(o.steel!==undefined)VCH_WEAR_U.uSteelCol.value.setHex(o.steel);
    if(o.mud!==undefined)VCH_WEAR_U.uMudCol.value.setHex(o.mud);
    if(o.dust!==undefined)VCH_WEAR_U.uDustCol.value.setHex(o.dust);
    if(o.gain!==undefined)VCH_WEAR_U.uGain.value=o.gain;
    return {steel:VCH_WEAR_U.uSteelCol.value.getHex(),mud:VCH_WEAR_U.uMudCol.value.getHex(),
            dust:VCH_WEAR_U.uDustCol.value.getHex(),gain:VCH_WEAR_U.uGain.value};
  },
  /* тестовая подмена окружения (например, шахматной текстурой) */
  envTexture:(tex)=>{ if(tex===undefined)return cn.environment; cn.environment=tex||null;
    if(!tex)cn.environmentIntensity=0; else cn.environmentIntensity=vchEnvLevel(); return cn.environment; },
  baseY:()=>VCH_WEAR_U.uBaseY.value,
  scan:vchWearScan,
  livery:()=>VCH_LIVERY_KEYS.slice(),
  /* доступ к сцене/камере/рендереру — для скриншот-проверок кадром */
  scene:()=>cn, camera:()=>ye, renderer:()=>Jn,
  bakeAll:()=>{let guard=0;while(VCH_WEAR_QUEUE.length&&guard++<4000){vchBakeWear(VCH_WEAR_QUEUE.shift())}return VCH_WEAR_QUEUE.length},
  reflect:(M)=>{vchReflectApply(M);return M}
};

vchLookInit();
