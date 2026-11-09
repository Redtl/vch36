/* =========================================================================
"use strict";
   06d · ВИД КАРТЫ 01: небо (HDRI Polyhaven), свет, дымка, фаска, текстура

   Что делает поверх дословной геометрии из 06a/06b:
     1. НЕБО.  scene.background и scene.environment берутся из HDRI
        (js/06c-map01-sky-data.js: Poly Haven, CC0, зашит в RGBE base64).
        Солнце DirectionalLight ставится по самому яркому направлению HDRI,
        поэтому свет и картинка согласованы.
     2. ДЫМКА.  FogExp2 цвета горизонта + подсветка снизу (fill) от неба.
     3. ФАСКА.  Геометрию не трогаем (625 тыс. треугольников: настоящий bevel
        дал бы ~4 млн). В материал добавлен «шейдерный bevel»: на кромках
        (там, где экранная производная нормали велика) включается светлая
        фаска с узким блеском — читается как снятая фаза 1–2 см.
     4. ТЕКСТУРА.  Трипланарная (без UV) процедурная текстура панелей:
        сгенерирована в canvas при старте — панельные швы, заклёпки, царапины,
        пыль сверху, грязь снизу. Палитра — как на референсах: светло-серый
        металл, белые плиты, жёлтые ограждения/подпорки, тёмная турбина.
   ========================================================================= */
"use strict";

/* ------------------------------ 1. НЕБО ---------------------------------- */
function VCH_MAP01_HDR(){
  const D=VCH_MAP01_SKY;
  const s=atob(D.data),n=s.length,b=new Uint8Array(n);
  for(let i=0;i<n;i++)b[i]=s.charCodeAt(i);
  const w=D.w,h=D.h;
  // VCHE1 + w,h (uint16 LE) + RGBE по 4 байта на пиксель, строки сверху вниз
  const rgb=b.subarray(9);
  const out=new Float32Array(w*h*4);
  for(let i=0,p=0;i<w*h;i++,p+=4){
    const e=rgb[p+3];
    const f=e>0?Math.pow(2,e-136):0;
    out[i*4]=rgb[p]*f;out[i*4+1]=rgb[p+1]*f;out[i*4+2]=rgb[p+2]*f;out[i*4+3]=1;
  }
  const tex=new hf(out,w,h,bn,Un);   /* DataTexture, RGBAFormat, FloatType */
  tex.mapping=Vc;                    /* EquirectangularReflectionMapping */
  tex.colorSpace=Ye;                 /* LinearSRGBColorSpace */
  tex.flipY=false;                   /* первая строка данных — зенит */
  tex.minFilter=pn;                  /* LinearFilter */
  tex.magFilter=pn;
  tex.generateMipmaps=false;
  tex.needsUpdate=true;
  return tex;
}

function VCH_MAP01_sky(scene,renderer,lights){
  try{
    const tex=VCH_MAP01_HDR();
    scene.background=tex;
    scene.backgroundIntensity=.62;
    const pmrem=new vl(renderer);
    const env=pmrem.fromEquirectangular(tex);
    scene.environment=env.texture;
    scene.environmentIntensity=.9;
    pmrem.dispose();
    /* свет по солнцу из HDRI */
    const D=VCH_MAP01_SKY;
    /* азимут берём у HDRI, а высоту поднимаем: у этого неба солнце у самого
       горизонта, тени получаются нечитаемыми */
    const dir=new P(D.sun[0],Math.max(D.sun[1],0.6),D.sun[2]).normalize();
    if(lights&&lights.sun){
      const L=lights.sun;
      L.position.copy(dir).multiplyScalar(180);
      L.target.position.set(0,0,0);
      L.target.updateMatrixWorld();
      L.color.setHex(0xffe6c4);
      L.intensity=3.1;
      if(L.shadow){
        L.shadow.camera.left=-90;L.shadow.camera.right=90;
        L.shadow.camera.top=90;L.shadow.camera.bottom=-90;
        L.shadow.camera.far=420;
        L.shadow.mapSize.set(2048,2048);
        L.shadow.camera.updateProjectionMatrix();
      }
    }
    if(lights&&lights.hemi){lights.hemi.intensity=.7;lights.hemi.color.setHex(0xd6d2ca)}
    if(lights&&lights.fill){lights.fill.intensity=.35;lights.fill.color.setHex(0xffd9b0)}
    if(lights&&lights.bounce)lights.bounce.intensity=.18;
    /* дымка: цвет горизонта HDRI + плотность под масштаб карты */
    const haze=new Ft(0xc9cfd6);
    scene.fog=new Gl(haze,0.0007);
    VCH_MAP01.sky=tex;
    VCH_MAP01.env=env.texture;
    VCH_MAP01.sunDir=dir;
  }catch(e){
    console.error("map01: небо",e);
  }
}

/* --------------------- 2. ПРОЦЕДУРНАЯ ТЕКСТУРА ПАНЕЛЕЙ ------------------- */
let VCH_MAP01_PANEL=null;
function VCH_MAP01_panelTex(){
  if(VCH_MAP01_PANEL)return VCH_MAP01_PANEL;
  const S=512,c=document.createElement("canvas");
  c.width=c.height=S;
  const g=c.getContext("2d");
  let seed=1337;const rnd=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
  g.fillStyle="#8b8f95";g.fillRect(0,0,S,S);
  /* крупные плиты: светлее/темнее, с тёмными швами */
  for(let i=0;i<26;i++){
    const w=40+rnd()*150,h=30+rnd()*140,x=rnd()*S,y=rnd()*S;
    const v=118+Math.floor(rnd()*46);
    g.fillStyle=`rgb(${v},${v+2},${v+5})`;
    g.fillRect(x,y,w,h);
    g.strokeStyle="rgba(18,22,28,.85)";g.lineWidth=2.6;
    g.strokeRect(x+.5,y+.5,w,h);
  }
  /* мелкие панели и люки */
  for(let i=0;i<70;i++){
    const w=8+rnd()*36,h=8+rnd()*36,x=rnd()*S,y=rnd()*S;
    const v=110+Math.floor(rnd()*60);
    g.fillStyle=`rgb(${v},${v+2},${v+6})`;
    g.fillRect(x,y,w,h);
    g.strokeStyle="rgba(20,24,30,.7)";g.lineWidth=1.8;
    g.strokeRect(x+.5,y+.5,w,h);
  }
  /* заклёпки по краям плит */
  g.fillStyle="rgba(196,202,210,.55)";
  for(let i=0;i<900;i++){
    const x=rnd()*S,y=rnd()*S,r=.9+rnd()*1.1;
    g.beginPath();g.arc(x,y,r,0,6.284);g.fill();
  }
  /* царапины */
  g.strokeStyle="rgba(215,220,228,.22)";g.lineWidth=1;
  for(let i=0;i<130;i++){
    const x=rnd()*S,y=rnd()*S,l=6+rnd()*40,a=rnd()*6.284;
    g.beginPath();g.moveTo(x,y);g.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l);g.stroke();
  }
  /* потёки и грязь */
  for(let i=0;i<60;i++){
    const x=rnd()*S,y=rnd()*S,r=6+rnd()*40;
    const gr=g.createRadialGradient(x,y,0,x,y,r);
    gr.addColorStop(0,"rgba(44,48,54,.20)");
    gr.addColorStop(1,"rgba(44,48,54,0)");
    g.fillStyle=gr;g.beginPath();g.arc(x,y,r,0,6.284);g.fill();
  }
  const t=new Ks(c);
  t.wrapS=t.wrapT=vi;
  t.colorSpace=Ie;
  t.anisotropy=16;
  VCH_MAP01_PANEL=t;
  return t;
}

/* --------------------------- 3. ПАЛИТРА ---------------------------------- */
/* как на референсах: металл, белые плиты, жёлтые ограждения, тёмный узел */
const VCH_MAP01_SLOTS={
  metal:   {color:0x9ea3aa,metalness:.55,roughness:.46,scale:1.8},
  light:   {color:0xc6cbd1,metalness:.38,roughness:.52,scale:2.4},
  dark:    {color:0x4b5057,metalness:.62,roughness:.40,scale:1.4},
  yellow:  {color:0xc4ad3a,metalness:.26,roughness:.60,scale:1.0},
  red:     {color:0xa63a2c,metalness:.30,roughness:.55,scale:1.0},
};
/* жёлтые ограждения/подпорки и тёмные узлы — по именам объектов в модели */
const VCH_MAP01_RULES=[
  [/огражден|подпорк|держател|приёмник|приемник|устройство|труба/i,"yellow"],
  [/ребро турбины|турбин/i,"dark"],
  [/панель/i,"light"],
];

function VCH_MAP01_slotFor(name){
  for(const [re,slot] of VCH_MAP01_RULES)if(re.test(name))return slot;
  return "metal";
}

/* ---------------------------- 4. МАТЕРИАЛ -------------------------------- */
const VCH_MAP01_MATS=new Map();
function VCH_MAP01_material(slot){
  slot=slot||"metal";
  if(VCH_MAP01_MATS.has(slot))return VCH_MAP01_MATS.get(slot);
  const S=VCH_MAP01_SLOTS[slot]||VCH_MAP01_SLOTS.metal;
  const m=new fe({color:S.color,metalness:S.metalness,roughness:S.roughness});
  m.userData.vchSlot=slot;
  const tex=VCH_MAP01_panelTex();
  m.onBeforeCompile=sh=>{
    sh.uniforms.uDetail={value:tex};
    sh.uniforms.uScale={value:S.scale};
    sh.uniforms.uBevel={value:1.0};
    sh.uniforms.uDust={value:new Ft(0x8e8b84)};
    sh.vertexShader=sh.vertexShader
      .replace("#include <common>","#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;")
      .replace("#include <begin_vertex>","#include <begin_vertex>\n  vWPos=(modelMatrix*vec4(position,1.0)).xyz;\n  vWNrm=normalize(mat3(modelMatrix)*normal);");
    sh.fragmentShader=sh.fragmentShader
      .replace("#include <common>",`#include <common>
        varying vec3 vWPos;varying vec3 vWNrm;
        uniform sampler2D uDetail;uniform float uScale;uniform float uBevel;uniform vec3 uDust;`)
      .replace("#include <map_fragment>",`#include <map_fragment>
        {
          vec3 N=normalize(vWNrm);
          vec3 bw=pow(abs(N),vec3(4.0));bw/=(bw.x+bw.y+bw.z);
          vec3 d=texture2D(uDetail,vWPos.zy/uScale).rgb*bw.x
                +texture2D(uDetail,vWPos.xz/uScale).rgb*bw.y
                +texture2D(uDetail,vWPos.xy/uScale).rgb*bw.z;
          /* текстура как модуляция света/тени, а не как цвет */
          float l=dot(d,vec3(0.299,0.587,0.114));
          diffuseColor.rgb*=clamp(0.52+(l-0.55)*2.1,0.40,1.55);
          /* пыль на верхних плоскостях, грязь у грунта */
          float up=smoothstep(0.45,0.95,N.y);
          diffuseColor.rgb=mix(diffuseColor.rgb,uDust,up*0.16);
          float low=1.0-smoothstep(0.02,0.55,vWPos.y);
          diffuseColor.rgb*=mix(1.0,0.90,low*0.8);
          /* фаска: кромки ловят свет */
          float e=clamp((length(dFdx(N))+length(dFdy(N)))*1.15*uBevel,0.0,1.0);
          float bev=smoothstep(0.06,0.45,e);
          diffuseColor.rgb=mix(diffuseColor.rgb,min(vec3(1.0),diffuseColor.rgb*2.1+0.045),bev*0.9);
        }`)
      .replace("#include <roughnessmap_fragment>",`#include <roughnessmap_fragment>
        {
          vec3 N=normalize(vWNrm);
          float e=clamp((length(dFdx(N))+length(dFdy(N)))*1.15*uBevel,0.0,1.0);
          float bev=smoothstep(0.06,0.45,e);
          vec3 d=texture2D(uDetail,vWPos.xz/uScale).rgb;
          roughnessFactor=clamp(mix(roughnessFactor,0.20,bev*0.85)*(0.85+0.3*d.g),0.04,1.0);
        }`);
  };
  m.customProgramCacheKey=()=>"vch_map01_"+slot;
  VCH_MAP01_MATS.set(slot,m);
  return m;
}

/* ============================================================================
   PCM-константы звука — собраны из папки audio/ (tools/inline_audio.py).
   Байты те же, что в присланной версии index (49).html.
   base64 от Int16 little-endian; движок собирает из них AudioBuffer
   синхронно в init(), поэтому звук не зависит от сети и протокола
   (http:// и file:// звучат одинаково).
   Форматы: shot 1ch@22050, kick 2ch@44100, engine 1ch@22050,
             soil 1ch@44100, explosion 2ch@22050.
   ========================================================================== */
