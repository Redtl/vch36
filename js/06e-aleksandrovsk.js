/* =========================================================================
"use strict";
   06e · ЛОКАЦИЯ «АЛЕКСАНДРОВСК»  (aleksandrovsk_mm.glb, Sketchfab: DageLV, CC-BY-4.0)

   Полный перенос модели: геометрия и ВСЕ текстуры (84 изображения) зашиты
   в файл (gzip + base64), поэтому карта работает с file:// без сети.
   Материалы Sketchfab-расширения KHR_materials_pbrSpecularGlossiness
   переведены в metallic/roughness (diffuse -> baseColor, 1-gloss -> roughness).
   Меши слиты по материалам: 78 вызовов отрисовки вместо 2272.
   Для подвески запечена карта высот (шаг 0.5 м) по грунтовым плиткам,
   для корпуса и снарядов собраны статические коллайдеры зданий/стен/обрывов.
   ========================================================================= */
const VCH_ALEKS={
  key:"aleksandrovsk",
  name:"АЛЕКСАНДРОВСК",
  ref:null,
  S:1,
  cx:0,cz:0,yTop:0,
  hx:0,hz:0,
  bounds:{x0:0,x1:0,z0:0,z1:0},
  state:"idle",error:null,
  group:null,root:null,scene3:null,physics:null,lights:null,
  HF:null,hfBuf:null,meshes:0,boxes:0,
  spawnPoint:{x:0,z:0,yaw:0}
};

(function VCH_ALEKS_init(){
  const D=VCH_ALEKS_DATA;
  let S=D.S||1;
  const q=new URLSearchParams(location.search).get("scale");
  if(q!==null){const n=+q;if(isFinite(n)&&n>=.2&&n<=20)S=n}
  VCH_ALEKS.S=S;
  VCH_ALEKS.cx=D.cx;
  VCH_ALEKS.cz=D.cz;
  VCH_ALEKS.yTop=D.yTop;
  VCH_ALEKS.hx=(D.bx1-D.bx0)*S/2;
  VCH_ALEKS.hz=(D.bz1-D.bz0)*S/2;
  VCH_ALEKS.bounds={x0:(D.bx0-VCH_ALEKS.cx)*S,x1:(D.bx1-VCH_ALEKS.cx)*S,
                    z0:(D.bz0-VCH_ALEKS.cz)*S,z1:(D.bz1-VCH_ALEKS.cz)*S};
  VCH_ALEKS.spawnPoint={x:(D.spawn.x-VCH_ALEKS.cx)*S,z:(D.spawn.z-VCH_ALEKS.cz)*S,yaw:D.spawn.yaw||0};
  const s=atob(D.hf),n=s.length,u=new Uint8Array(n);
  for(let i=0;i<n;i++)u[i]=s.charCodeAt(i);
  VCH_ALEKS.hfBuf=u;
  VCH_ALEKS.HF=new Uint16Array(u.buffer,0,n>>1);
})();

/* высота модели в точке (билинейно из запечённой карты) */
function VCH_ALEKS_raw(xm,zm){
  const D=VCH_ALEKS_DATA,RX=D.resX,RZ=D.resZ,HF=VCH_ALEKS.HF;
  let u=(xm-D.bx0)/(D.bx1-D.bx0)*(RX-1),v=(zm-D.bz0)/(D.bz1-D.bz0)*(RZ-1);
  u=u<0?0:u>RX-1?RX-1:u;v=v<0?0:v>RZ-1?RZ-1:v;
  const i0=u|0,j0=v|0,i1=i0<RX-1?i0+1:i0,j1=j0<RZ-1?j0+1:j0,fu=u-i0,fv=v-j0;
  const a=HF[j0*RX+i0],b=HF[j0*RX+i1],c=HF[j1*RX+i0],d2=HF[j1*RX+i1];
  const q=(a+(b-a)*fu)*(1-fv)+(c+(d2-c)*fu)*fv;
  return D.yMin+(q/65535)*(D.yMax-D.yMin);
}

/* высота карты в мировых координатах (0 = уровень стартовой площадки) */
function VCH_ALEKS_h(x,z){
  const S=VCH_ALEKS.S;
  const p=(VCH_ALEKS_raw(x/S+VCH_ALEKS.cx,z/S+VCH_ALEKS.cz)-VCH_ALEKS.yTop)*S;
  const B=VCH_ALEKS.bounds;
  const dx=Math.max(B.x0-x,x-B.x1,0),dz=Math.max(B.z0-z,z-B.z1,0);
  if(dx<=0&&dz<=0)return p;
  return p+(0-p)*Te.smoothstep(Math.hypot(dx,dz),0,1.5);
}

/* --------------------------- СБОРКА ЛОКАЦИИ ------------------------------ */
function VCH_ALEKS_insert(root){
  try{
    const S=VCH_ALEKS.S,D=VCH_ALEKS_DATA;
    VCH_ALEKS.root=root;
    root.position.set(-VCH_ALEKS.cx*S,-VCH_ALEKS.yTop*S,-VCH_ALEKS.cz*S);
    root.scale.setScalar(S);
    let meshes=0;
    root.traverse(o=>{
      if(!o.isMesh)return;
      o.castShadow=!0;
      o.receiveShadow=!0;
      const m=o.material;
      if(m){
        if(m.roughness!==undefined)m.roughness=1;
        if(m.metalness!==undefined&&m.metalness>0)m.metalness=0;
        m.envMapIntensity=1.0;
        m.needsUpdate=!0;
      }
      meshes++;
    });
    VCH_ALEKS.meshes=meshes;
    (VCH_ALEKS.group||cn).add(root);
    /* коллайдеры зданий / стен / обрывов */
    const ph=VCH_ALEKS.physics;
    if(ph&&typeof Et!=="undefined"&&typeof ns!=="undefined"){
      let added=0;
      for(const b of D.boxes){
        const x=(b[0]-VCH_ALEKS.cx)*S,z=(b[1]-VCH_ALEKS.cz)*S;
        const hx=Math.max(b[2]*S,.08),hz=Math.max(b[3]*S,.08);
        const y0=(b[4]-VCH_ALEKS.yTop)*S,y1=(b[5]-VCH_ALEKS.yTop)*S;
        const hy=Math.max((y1-y0)/2,.1);
        const body=new Et({mass:0,type:Et.STATIC,position:new w(x,(y0+y1)/2,z)});
        body.addShape(new ns(new w(hx,hy,hz)));
        body.collisionFilterGroup=is;
        body.collisionFilterMask=7|VCH_RAMP;
        ph.addBody(body);
        added++;
      }
      VCH_ALEKS.boxes=added;
    }
    /* свет и дымка под размер карты (250 м) */
    const L=VCH_ALEKS.lights;
    if(L&&L.sun){
      const sh=L.sun.shadow;
      if(sh){
        sh.camera.left=-95;sh.camera.right=95;
        sh.camera.top=95;sh.camera.bottom=-95;
        sh.camera.far=460;sh.mapSize.set(2048,2048);
        sh.camera.updateProjectionMatrix();
      }
      L.sun.intensity=Math.max(L.sun.intensity||2.4,2.7);
    }
    if(VCH_ALEKS.scene3&&VCH_ALEKS.scene3.fog){
      const f=VCH_ALEKS.scene3.fog;
      if(f.color)f.color.setHex(0xc9cfd6);
      f.density=.0010;
    }
    root.updateMatrixWorld(!0);
    VCH_ALEKS.state="ready";
    console.log("aleksandrovsk: готово, мешей "+meshes+", коллайдеров "+VCH_ALEKS.boxes);
  }catch(e){
    VCH_ALEKS.state="error";VCH_ALEKS.error=String(e&&e.message||e);
    console.error("aleksandrovsk: сборка",e);
  }
}

/* распаковка gzip+base64 */
function VCH_ALEKS_unpack(b64){
  const s=atob(b64),n=s.length,u=new Uint8Array(n);
  for(let i=0;i<n;i++)u[i]=s.charCodeAt(i);
  if(typeof DecompressionStream==="undefined")
    throw new Error("браузер без DecompressionStream — нужен Chrome/Edge/Firefox/Safari свежих версий");
  const st=new Blob([u]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(st).arrayBuffer();
}

function VCH_ALEKS_load(){
  if(VCH_ALEKS.state!=="idle")return;
  if(typeof Wf==="undefined"||!Wf.parse){setTimeout(VCH_ALEKS_load,120);return}
  VCH_ALEKS.state="loading";
  VCH_ALEKS_unpack(VCH_ALEKS_DATA.glbGz).then(buf=>{
    Wf.parse(buf,"",g=>VCH_ALEKS_insert(g.scene),e=>{
      VCH_ALEKS.state="error";VCH_ALEKS.error=String(e&&e.message||e);
      console.error("aleksandrovsk: разбор GLB",e);
    });
  }).catch(e=>{
    VCH_ALEKS.state="error";VCH_ALEKS.error=String(e&&e.message||e);
    console.error("aleksandrovsk: распаковка",e);
  });
}

function VCH_ALEKS_scene(scene,physics,lights){
  const G=new Jt();G.name="aleksandrovsk";
  scene.add(G);
  VCH_ALEKS.group=G;VCH_ALEKS.scene3=scene;
  VCH_ALEKS.physics=physics;VCH_ALEKS.lights=lights;
  setTimeout(VCH_ALEKS_load,0);
  return G;
}

/* реквизит и очаги уже в модели */
function VCH_ALEKS_props(scene,physics,effects){
  return {props:[],fires:null};
}

/* точка старта (ровная площадка на дороге, считает build_map.py) */
function VCH_ALEKS_spawn(){
  const p=VCH_ALEKS.spawnPoint;
  return {x:p.x,z:p.z,yaw:p.yaw||0};
}

function VCH_ALEKS_size(){
  return {x:VCH_ALEKS.hx*2,y:(VCH_ALEKS_DATA.yMax-VCH_ALEKS_DATA.yMin)*VCH_ALEKS.S,z:VCH_ALEKS.hz*2};
}

window.__vchAleks={
  get cfg(){return VCH_ALEKS},
  h:VCH_ALEKS_h,size:VCH_ALEKS_size,spawn:VCH_ALEKS_spawn,
  insert:VCH_ALEKS_insert,load:VCH_ALEKS_load
};
