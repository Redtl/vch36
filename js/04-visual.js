/* ==========================================================================
   vch36 · js/04-visual.js
   визуальный апгрейд v2: небо, PBR, SSAO, FXAA, частицы, качество
   Из index.html (4.2 «разбиение на модули»). Порядок загрузки задан в index.html
   тегами <script defer>; «use strict» сохранён — исходный код был модулем.
   ========================================================================== */
"use strict";
/* ===================== VISUAL UPGRADE v2 ===================== */
const V_SUNDIR=new P(-.469,.559,-.703).normalize();
const VQ={ao:1,grain:1,sharp:1,aberr:1,level:0,shadow:2048,aoStrength:1.05};
let V_post=null,V_aoPass=null,V_gradePass=null,V_sky=null;

/* ---------- shared sky shader (dome + IBL) ---------- */
function vSkyUniforms(){
 const sp=VCH_MAP===2;
 return{
  uTime:{value:0},
  sunDir:{value:V_SUNDIR.clone()},
  zenith:{value:new Ft(sp?0x040718:0x3f74b6)},
  horizon:{value:new Ft(sp?0x0a142c:0xdcd6c6)},
  ground:{value:new Ft(sp?0x0a1020:0x746a5a)},
  sunCol:{value:new Ft(sp?0x9db8ff:0xffe3bc)},
  cloud:{value:sp?0:.46}
 }}
const V_SKY_VS=`varying vec3 vDir;
void main(){ vDir=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`;
const V_SKY_FS=`
uniform float uTime; uniform vec3 sunDir,zenith,horizon,ground,sunCol; uniform float cloud;
varying vec3 vDir;
float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123); }
float n2(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(h21(i),h21(i+vec2(1.0,0.0)),f.x),mix(h21(i+vec2(0.0,1.0)),h21(i+vec2(1.0,1.0)),f.x),f.y); }
float fbm(vec2 p){ float a=.5,s=0.0; for(int i=0;i<5;i++){ s+=a*n2(p); p=p*2.03+vec2(1.7,-2.3); a*=.5; } return s; }
void main(){
  vec3 d=normalize(vDir);
  float hh=d.y;
  float up=clamp(hh,0.0,1.0);
  vec3 col=mix(horizon,zenith,pow(up,0.60));
  col=mix(col,ground,smoothstep(0.0,-0.16,hh));
  float sd=max(dot(d,sunDir),0.0);
  col+=sunCol*pow(sd,6.0)*0.26;
  col+=sunCol*pow(sd,160.0)*0.80;
  col+=sunCol*smoothstep(0.9995,0.99988,sd)*4.6;
  float haze=pow(1.0-clamp(abs(hh),0.0,1.0),4.5);
  col=mix(col,mix(horizon,sunCol,0.26),haze*0.34);
  if(hh>0.015){
    vec2 cp=d.xz/max(hh,0.045)*0.55;
    float f=fbm(cp*0.55+vec2(uTime*0.0045,uTime*0.0021));
    float g=fbm(cp*1.60-vec2(uTime*0.0090,0.0));
    float m=smoothstep(0.50,0.85,f*0.72+g*0.34);
    m*=smoothstep(0.015,0.20,hh)*cloud;
    float lit=smoothstep(0.32,0.94,f);
    vec3 cc=mix(vec3(0.62,0.64,0.68),vec3(1.02,0.99,0.95),lit);
    cc=mix(cc,sunCol*1.15,pow(sd,4.0)*0.55);
    col=mix(col,cc,m);
  }
  gl_FragColor=vec4(max(col,0.0),1.0);
}`;

/* ---------- помощники бесшовного периодического шума и карт нормалей ---------- */
function vTex(canvas,rep,srgb){
  const t=new Ks(canvas);
  t.wrapS=t.wrapT=vi;t.anisotropy=8;
  if(srgb)t.colorSpace=Ie;
  if(rep){if(Array.isArray(rep))t.repeat.set(rep[0],rep[1]);else t.repeat.set(rep,rep)}
  return t
}
function vHash(x,y,seed){
  let h=Math.imul(x^seed,374761393)+Math.imul(y^seed,668265263);
  h=Math.imul(h^(h>>>13),1274126177);
  return((h^(h>>>16))>>>0)/4294967295
}
function vPeriodicFBM(N,freqs,amps,seed){
  const out=new Float32Array(N*N);
  for(let k=0;k<freqs.length;k++){
    const F=freqs[k],A=amps[k],S=seed+k*131,step=N/F;
    const grid=new Float32Array(F*F);
    for(let gy=0;gy<F;gy++)for(let gx=0;gx<F;gx++)grid[gy*F+gx]=vHash(gx,gy,S);
    for(let y=0;y<N;y++){
      const fy=y/step,iy=fy|0,ty=fy-iy,uy=ty*ty*(3-2*ty),iy1=(iy+1)%F,row=y*N;
      for(let x=0;x<N;x++){
        const fx=x/step,ix=fx|0,tx=fx-ix,ux=tx*tx*(3-2*tx),ix1=(ix+1)%F;
        const v00=grid[iy*F+ix],v10=grid[iy*F+ix1],v01=grid[iy1*F+ix],v11=grid[iy1*F+ix1];
        const v0=v00+(v10-v00)*ux,v1=v01+(v11-v01)*ux;
        out[row+x]+=(v0+(v1-v0)*uy-.5)*A
      }
    }
  }
  return out
}
function vHeightToNormal(H,N,strength,rep){
  const c=Qs(N),g=c.getContext("2d"),img=g.createImageData(N,N),d=img.data,nm=N-1;
  for(let y=0;y<N;y++){
    const ym=(y-1)&nm,yp=(y+1)&nm,row=y*N;
    for(let x=0;x<N;x++){
      const xm=(x-1)&nm,xp=(x+1)&nm;
      const dx=(H[row+xp]-H[row+xm])*strength;
      const dy=(H[yp*N+x]-H[ym*N+x])*strength;
      const inv=1/Math.hypot(dx,dy,1);
      const idx=(row+x)<<2;
      d[idx]=(-dx*inv*.5+.5)*255|0;
      d[idx+1]=(dy*inv*.5+.5)*255|0;
      d[idx+2]=(inv*.5+.5)*255|0;
      d[idx+3]=255
    }
  }
  g.putImageData(img,0,0);
  return vTex(c,rep,!1)
}
function vWrapDraw(N,x,y,r,fn){
  const oxs=x<r?[0,N]:x>N-r?[0,-N]:[0];
  const oys=y<r?[0,N]:y>N-r?[0,-N]:[0];
  for(const ox of oxs)for(const oy of oys)fn(x+ox,y+oy)
}

/* ---------- 1. Tank Armor & Metal PBR Maps ---------- */
let V_surf=null;
function surfMaps(){
  if(V_surf)return V_surf;
  const N=512;
  const h=vPeriodicFBM(N,[4,8,16,32,64,128],[.35,.28,.22,.18,.14,.10],101);
  const wear=vPeriodicFBM(N,[4,8,16,32,64],[.45,.30,.20,.14,.10],307);
  const streak=vPeriodicFBM(N,[8,16,32,64],[.35,.25,.18,.12],509);
  const ac=Qs(N),ag=ac.getContext("2d"),aimg=ag.createImageData(N,N),ad=aimg.data;
  const rc=Qs(N),rg=rc.getContext("2d"),rimg=rg.createImageData(N,N),rd=rimg.data;
  for(let y=0;y<N;y++){
    for(let x=0;x<N;x++){
      const i=y*N+x,sx=x,sy=(y>>2);
      const st=streak[sy*N+sx];
      const w=wear[i],hh=h[i];
      const base=204+hh*26+w*22-Math.max(0,st)*28;
      const warm=w>0.12?8:0;
      const idx=i<<2;
      ad[idx]=Math.min(255,Math.max(120,base+warm))|0;
      ad[idx+1]=Math.min(255,Math.max(120,base+2))|0;
      ad[idx+2]=Math.min(255,Math.max(110,base-6))|0;
      ad[idx+3]=255;
      const rv=Math.min(255,Math.max(95,205-w*75+hh*32+Math.max(0,st)*26))|0;
      rd[idx]=rd[idx+1]=rd[idx+2]=rv;rd[idx+3]=255
    }
  }
  ag.putImageData(aimg,0,0);
  rg.putImageData(rimg,0,0);
  for(let i=0;i<240;i++){
    const x=Vt(0,N),y=Vt(0,N),l=Vt(4,18),a=Vt(0,6.283),r=l+2;
    vWrapDraw(N,x,y,r,(px,py)=>{
      ag.strokeStyle=`rgba(232,230,215,${Vt(.06,.16)})`;ag.lineWidth=Vt(.6,1.3);
      ag.beginPath();ag.moveTo(px,py);ag.lineTo(px+Math.cos(a)*l,py+Math.sin(a)*l);ag.stroke();
      rg.strokeStyle="rgba(120,120,120,.30)";rg.lineWidth=1.2;
      rg.beginPath();rg.moveTo(px,py);rg.lineTo(px+Math.cos(a)*l,py+Math.sin(a)*l);rg.stroke()
    })
  }
  const ntex=vHeightToNormal(h,N,2.2,1);
  V_surf={map:vTex(ac,1,!0),rough:vTex(rc,1,!1),norm:ntex};
  return V_surf
}
let V_metal=null;
function metalMaps(){
  if(V_metal)return V_metal;
  const N=512;
  const h=vPeriodicFBM(N,[8,16,32,64,128],[.25,.25,.24,.20,.16],701);
  const rc=Qs(N),rg=rc.getContext("2d"),rimg=rg.createImageData(N,N),rd=rimg.data;
  for(let i=0;i<N*N;i++){
    const v=Math.min(255,Math.max(70,172+h[i]*95))|0,idx=i<<2;
    rd[idx]=rd[idx+1]=rd[idx+2]=v;rd[idx+3]=255
  }
  rg.putImageData(rimg,0,0);
  V_metal={rough:vTex(rc,1,!1),norm:vHeightToNormal(h,N,3.2,1)};
  return V_metal
}
function vApplySurf(m){
  const s=surfMaps(),k=metalMaps();
  for(const n of["paint","paintLight","paintDark","sleeve","paintWorn","wheelHub"]){
    const t=m[n];if(!t)continue;
    t.map=s.map;t.roughnessMap=s.rough;t.normalMap=s.norm;t.normalScale.set(.26,.26);t.envMapIntensity=.92;t.needsUpdate=!0
  }
  for(const n of["track","steel","steelDark"]){
    const t=m[n];if(!t)continue;
    t.roughnessMap=k.rough;t.normalMap=k.norm;t.normalScale.set(.42,.42);t.envMapIntensity=1.18;t.needsUpdate=!0
  }
  if(m.rubber){m.rubber.normalMap=s.norm;m.rubber.normalScale.set(.32,.32);m.rubber.needsUpdate=!0}
  if(m.glass){m.glass.roughness=.08;m.glass.metalness=.25;m.glass.envMapIntensity=2.2;m.glass.needsUpdate=!0}
  for(const n of["canvas","stowage","stowageDark","rust","mud"]){
    const t=m[n];if(!t)continue;t.normalMap=s.norm;t.normalScale.set(.35,.35);t.roughnessMap=s.rough;t.needsUpdate=!0
  }
  return m
}

/* ---------- 2. Seamless Ground PBR Maps ---------- */
let V_ground=null;
function groundMaps(){
  if(V_ground)return V_ground;
  const N=512;
  const h1=vPeriodicFBM(N,[4,8,16,32,64,128],[.42,.32,.25,.20,.16,.12],911);
  const h2=vPeriodicFBM(N,[8,16,32,64,128],[.35,.28,.24,.18,.14],1213);
  const c=Qs(N),g=c.getContext("2d"),img=g.createImageData(N,N),d=img.data;
  const rc=Qs(N),rg=rc.getContext("2d"),rimg=rg.createImageData(N,N),rd=rimg.data;
  const H=new Float32Array(N*N);
  for(let i=0;i<N*N;i++){
    const a=h1[i],b=h2[i];
    const pebble=Math.max(0,b-.18)*1.8;
    H[i]=a*.7+b*.45+pebble*.35;
    const base=150+a*38+b*22+pebble*24;
    const warm=a*12-b*8;
    const idx=i<<2;
    d[idx]=Math.min(230,Math.max(78,base+warm+4))|0;
    d[idx+1]=Math.min(224,Math.max(74,base+warm*.4))|0;
    d[idx+2]=Math.min(210,Math.max(66,base-warm*.6-8))|0;
    d[idx+3]=255;
    const rv=Math.min(255,Math.max(150,228-pebble*55-a*28))|0;
    rd[idx]=rd[idx+1]=rd[idx+2]=rv;rd[idx+3]=255
  }
  g.putImageData(img,0,0);
  rg.putImageData(rimg,0,0);
  const ntex=vHeightToNormal(H,N,3.8,32);
  V_ground={map:vTex(c,32,!0),norm:ntex,rough:vTex(rc,32,!1)};
  V_ground.map.anisotropy=16;V_ground.norm.anisotropy=16;
  return V_ground
}

/* ---------- 3. World Prop & Building PBR Maps ---------- */
let V_crateMat=null;
function vCrateMaterial(){
  if(V_crateMat)return V_crateMat;
  const N=512,c=Qs(N),g=c.getContext("2d"),H=new Float32Array(N*N);
  const grain=vPeriodicFBM(N,[4,8,16,32,64],[.35,.25,.18,.12,.08],2003);
  g.fillStyle="#9d784d";g.fillRect(0,0,N,N);
  const planks=6,pw=N/planks;
  for(let p=0;p<planks;p++){
    const y0=p*pw,shade=Vt(-12,12);
    g.fillStyle=`rgb(${156+shade|0},${119+shade*.8|0},${76+shade*.6|0})`;
    g.fillRect(0,y0+2,N,pw-4);
    g.fillStyle="rgba(38,26,15,.72)";
    g.fillRect(0,y0,N,2.5);
  }
  const img=g.getImageData(0,0,N,N),d=img.data;
  for(let y=0;y<N;y++){
    for(let x=0;x<N;x++){
      const i=y*N+x,gr=grain[(y>>2)*N+x]*26+grain[i]*10;
      const seam=(y%pw)<3||(y%pw)>pw-3?-.35:0;
      H[i]=grain[(y>>2)*N+x]*.45+seam;
      const idx=i<<2;
      d[idx]=Math.min(255,Math.max(30,d[idx]+gr))|0;
      d[idx+1]=Math.min(255,Math.max(25,d[idx+1]+gr*.82))|0;
      d[idx+2]=Math.min(255,Math.max(20,d[idx+2]+gr*.62))|0
    }
  }
  g.putImageData(img,0,0);
  const b=44;
  g.fillStyle="#8a673f";
  g.fillRect(0,0,N,b);g.fillRect(0,N-b,N,b);g.fillRect(0,0,b,N);g.fillRect(N-b,0,b,N);
  g.strokeStyle="#3b2a18";g.lineWidth=3;
  g.strokeRect(b,b,N-2*b,N-2*b);g.strokeRect(2,2,N-4,N-4);
  g.save();g.beginPath();g.moveTo(b,b);g.lineTo(N-b,N-b);g.lineWidth=36;g.strokeStyle="#87643d";g.stroke();
  g.lineWidth=38;g.strokeStyle="rgba(40,28,16,.55)";g.stroke();
  g.lineWidth=32;g.strokeStyle="#8c6940";g.stroke();g.restore();
  g.fillStyle="#2e302c";
  const csz=26;
  for(const[cx,cy]of[[0,0],[N-csz,0],[0,N-csz],[N-csz,N-csz]])g.fillRect(cx,cy,csz,csz);
  g.fillStyle="rgba(34,36,30,.65)";
  for(const x of[22,N-22])for(let p=0;p<planks;p++){
    const y=(p+.5)*pw;g.beginPath();g.arc(x,y,3.2,0,6.283);g.fill()
  }
  g.fillStyle="rgba(28,30,24,.52)";
  g.font="700 30px monospace";g.textAlign="center";
  g.fillText("LOT 65-A",N/2,N*.36);
  g.fillRect(N/2-68,N*.60,136,8);
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){
    const inFrame=x<b||x>N-b||y<b||y>N-b||Math.abs((x-b)-(y-b))<22;
    if(inFrame)H[y*N+x]+=.35
  }
  const ntex=vHeightToNormal(H,N,3.2,1);
  V_crateMat=new fe({color:0xd8ccb8,map:vTex(c,1,!0),normalMap:ntex,normalScale:new ct(.45,.45),roughness:.86,metalness:.06});
  return V_crateMat
}
let V_concMat=null;
function vConcreteMaterial(){
  if(V_concMat)return V_concMat;
  const N=512,h=vPeriodicFBM(N,[4,8,16,32,64,128],[.38,.30,.24,.20,.15,.12],3001);
  const c=Qs(N),g=c.getContext("2d"),img=g.createImageData(N,N),d=img.data;
  for(let y=0;y<N;y++){
    const groove=(y%128)<2?-.25:0;
    for(let x=0;x<N;x++){
      const i=y*N+x,v=166+(h[i]+groove)*46,idx=i<<2;
      d[idx]=Math.min(235,Math.max(70,v+2))|0;
      d[idx+1]=Math.min(232,Math.max(70,v))|0;
      d[idx+2]=Math.min(224,Math.max(66,v-5))|0;
      d[idx+3]=255
    }
  }
  g.putImageData(img,0,0);
  const ntex=vHeightToNormal(h,N,3.4,1.5);
  return V_concMat=new fe({color:0xa8a399,map:vTex(c,1.5,!0),normalMap:ntex,normalScale:new ct(.42,.42),roughness:.92,metalness:.04})
}
let V_rustMat=null;
function vRustMaterial(){
  if(V_rustMat)return V_rustMat;
  const N=512,h=vPeriodicFBM(N,[4,8,16,32,64],[.42,.32,.24,.18,.12],4001);
  const c=Qs(N),g=c.getContext("2d"),img=g.createImageData(N,N),d=img.data;
  for(let y=0;y<N;y++){
    const rib=Math.sin(y/N*Math.PI*12)*.18;
    for(let x=0;x<N;x++){
      const i=y*N+x,v=h[i];
      const rust=Math.max(0,v+.08);
      const idx=i<<2;
      d[idx]=Math.min(225,Math.max(55,132+v*48+rust*46+rib*18))|0;
      d[idx+1]=Math.min(200,Math.max(45,104+v*36+rust*12+rib*14))|0;
      d[idx+2]=Math.min(185,Math.max(40,86+v*30-rust*10+rib*12))|0;
      d[idx+3]=255;
      h[i]+=rib*.5
    }
  }
  g.putImageData(img,0,0);
  const ntex=vHeightToNormal(h,N,3.5,2);
  return V_rustMat=new fe({color:0x9c826c,map:vTex(c,2,!0),normalMap:ntex,normalScale:new ct(.45,.45),roughness:.78,metalness:.42})
}
let V_bldg=null;
function vBuildingTex(){
  if(V_bldg)return V_bldg;
  const N=512,c=Qs(N),g=c.getContext("2d"),rc=Qs(N),rg=rc.getContext("2d");
  const h=vPeriodicFBM(N,[4,8,16,32,64],[.32,.26,.20,.15,.10],5003);
  const img=g.createImageData(N,N),d=img.data;
  for(let i=0;i<N*N;i++){
    const v=134+h[i]*32,idx=i<<2;
    d[idx]=Math.min(200,Math.max(75,v+2))|0;
    d[idx+1]=Math.min(200,Math.max(75,v+1))|0;
    d[idx+2]=Math.min(202,Math.max(75,v-2))|0;
    d[idx+3]=255
  }
  g.putImageData(img,0,0);
  rg.fillStyle="#ebebeb";rg.fillRect(0,0,N,N);
  for(let y=0;y<N;y+=64){
    g.fillStyle="rgba(45,48,52,.42)";g.fillRect(0,y,N,2);
    g.fillStyle="rgba(195,198,202,.22)";g.fillRect(0,y+2,N,1.5);
    for(let x=0;x<N;x+=64){
      g.fillStyle="rgba(45,48,52,.28)";g.fillRect(x,y,2,64);
      const wx=x+11,wy=y+11,ww=42,wh=34;
      const r=vHash(x>>6,y>>6,77);
      if(r<.82){
        for(let py=wy;py<wy+wh;py++)for(let px=wx;px<wx+ww;px++)h[py*N+px]-=.42;
        g.fillStyle="rgba(28,32,36,.85)";g.fillRect(wx-2,wy-2,ww+4,wh+4);
        if(r<.12){
          const lg=g.createLinearGradient(wx,wy,wx,wy+wh);
          lg.addColorStop(0,"rgba(255,198,120,.75)");lg.addColorStop(1,"rgba(185,115,55,.45)");
          g.fillStyle=lg;g.fillRect(wx,wy,ww,wh)
        }else{
          const lg=g.createLinearGradient(wx,wy,wx,wy+wh);
          lg.addColorStop(0,"rgba(52,68,84,.92)");lg.addColorStop(1,"rgba(22,26,32,.95)");
          g.fillStyle=lg;g.fillRect(wx,wy,ww,wh)
        }
        g.fillStyle="rgba(18,20,24,.9)";
        g.fillRect(wx+ww/2-1,wy,2,wh);g.fillRect(wx,wy+wh*.52,ww,2);
        g.fillStyle="rgba(85,88,92,.85)";g.fillRect(wx-2,wy+wh,ww+4,3.5);
        rg.fillStyle="#383838";rg.fillRect(wx,wy,ww,wh)
      }
    }
  }
  const ntex=vHeightToNormal(h,N,3.6,[2,3]);
  V_bldg={map:vTex(c,[2,3],!0),norm:ntex,rough:vTex(rc,[2,3],!1)};
  return V_bldg
}

/* ---------- 4. SSAO без артефактов на двух масштабах + шейдеры грейда ---------- */
const V_AO_SHADER={
  uniforms:{tDiffuse:{value:null},tDepth:{value:null},uInvProj:{value:new Xt},uProj:{value:new Xt},
    uRes:{value:new ct(1,1)},uStrength:{value:1.05}},
  vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader:`
uniform sampler2D tDiffuse,tDepth; uniform mat4 uInvProj,uProj; uniform vec2 uRes;
uniform float uStrength; varying vec2 vUv;
vec3 vpos(vec2 uv){
  float d=texture2D(tDepth,uv).x;
  vec4 c=uInvProj*vec4(uv*2.0-1.0,d*2.0-1.0,1.0);
  return c.xyz/c.w;
}
void main(){
  vec4 src=texture2D(tDiffuse,vUv);
  float d=texture2D(tDepth,vUv).x;
  if(d>=0.9999||uStrength<=0.0){ gl_FragColor=src; return; }
  vec2 tx=1.0/uRes;
  vec3 P=vpos(vUv);
  float z=-P.z;
  if(z>95.0){ gl_FragColor=src; return; }
  vec3 Pr=vpos(vUv+vec2(tx.x,0.0)),Pl=vpos(vUv-vec2(tx.x,0.0));
  vec3 Pu=vpos(vUv+vec2(0.0,tx.y)),Pd=vpos(vUv-vec2(0.0,tx.y));
  vec3 dx=abs(Pr.z-P.z)<abs(P.z-Pl.z)?(Pr-P):(P-Pl);
  vec3 dy=abs(Pu.z-P.z)<abs(P.z-Pd.z)?(Pu-P):(P-Pd);
  vec3 N=normalize(cross(dx,dy));
  float rnd=fract(sin(dot(floor(vUv*uRes),vec2(12.9898,78.233)))*43758.5453);
  float ang=rnd*6.2831853;
  vec2 sc=vec2(uProj[0][0],uProj[1][1])*0.5/max(0.35,z);
  float occ=0.0;
  const int NS=12;
  for(int i=0;i<NS;i++){
    float fi=(float(i)+0.5)/float(NS);
    float rWorld=i<6?mix(0.045,0.22,fi*1.6):mix(0.24,0.68,(fi-0.5)*2.0);
    float a=ang+float(i)*2.399963;
    vec2 suv=vUv+vec2(cos(a),sin(a))*rWorld*sc;
    if(suv.x<0.0||suv.x>1.0||suv.y<0.0||suv.y>1.0) continue;
    vec3 S=vpos(suv);
    vec3 v=S-P;
    float dist=length(v)+1e-5;
    vec3 dir=v/dist;
    float nd=dot(N,dir)-0.085;
    float range=smoothstep(rWorld*1.85,rWorld*0.25,dist);
    occ+=clamp(nd,0.0,1.0)*range;
  }
  float ao=clamp(1.0-(occ/float(NS))*uStrength*2.15,0.22,1.0);
  ao=mix(1.0,ao,smoothstep(90.0,22.0,z));
  gl_FragColor=vec4(src.rgb*ao,src.a);
}`};

const V_GRADE_SHADER={
  uniforms:{tDiffuse:{value:null},uRes:{value:new ct(1,1)},uTime:{value:0},uExposure:{value:1.02},
    uVignette:{value:.26},uGrain:{value:.010},uAberr:{value:.22},uSharp:{value:.10},
    uSat:{value:.05},uContrast:{value:1.12},uTM:{value:1.0}},
  vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader:`
uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uTime,uExposure,uVignette,uGrain,uAberr,uSharp,uSat,uContrast,uTM;
varying vec2 vUv;
vec3 rrt(vec3 v){ vec3 a=v*(v+0.0245786)-0.000090537; vec3 b=v*(0.983729*v+0.4329510)+0.238081; return a/b; }
vec3 aces(vec3 c){
  const mat3 IM=mat3(0.59719,0.07600,0.02840,0.35458,0.90834,0.13383,0.04823,0.01566,0.83777);
  const mat3 OM=mat3(1.60475,-0.10208,-0.00327,-0.53108,1.10813,-0.07276,-0.07367,-0.00605,1.07602);
  c*=uExposure/0.6; c=IM*c; c=rrt(c); c=OM*c; return clamp(c,0.0,1.0);
}
vec3 srgb(vec3 c){ return mix(pow(max(c,0.0),vec3(0.41666))*1.055-0.055,c*12.92,vec3(lessThanEqual(c,vec3(0.0031308)))); }
void main(){
  vec2 uv=vUv,cc=uv-0.5; float r2=dot(cc,cc);
  vec2 ca=cc*uAberr*r2*0.0085;
  vec3 lin;
  lin.r=texture2D(tDiffuse,uv+ca).r;
  lin.g=texture2D(tDiffuse,uv).g;
  lin.b=texture2D(tDiffuse,uv-ca).b;
  if(uSharp>0.0){
    vec2 t=1.0/uRes;
    vec3 b=(texture2D(tDiffuse,uv+vec2(t.x,0.0)).rgb+texture2D(tDiffuse,uv-vec2(t.x,0.0)).rgb
           +texture2D(tDiffuse,uv+vec2(0.0,t.y)).rgb+texture2D(tDiffuse,uv-vec2(0.0,t.y)).rgb)*0.25;
    lin=max(lin+(lin-b)*uSharp,0.0);
  }
  /* Материалы уже тонмаппируются рендерером (ACES), поэтому второй ACES здесь
     работает по уже сжатой картинке: поднимает середину и снижает контраст —
     «молочный» пересвет. uTM=1 — как было, uTM=0 — только грейдинг. */
  vec3 col=srgb(mix(lin*uExposure,aces(lin),uTM));
  float l=dot(col,vec3(0.2126,0.7152,0.0722));
  col=mix(col,vec3(l),uSat);
  col=(col-0.5)*uContrast+0.5;
  /*
  мягкое раздельное тонирование — холодная тень, тёплый свет — заставляет небо,
  пыль, краску и металл читаться как одно изображение, а не как набор разных
  материалов
 */
  col+=vec3(0.008,0.014,0.026)*(1.0-smoothstep(0.0,0.40,l));
  col+=vec3(0.030,0.014,-0.012)*smoothstep(0.55,1.0,l);
  col=mix(col,vec3(l),0.035*(1.0-smoothstep(0.20,0.95,l)));
  float v=smoothstep(1.08,0.20,r2*2.0);
  col*=mix(1.0,v,uVignette);
  float g=fract(sin(dot(uv*uRes+fract(uTime)*451.0,vec2(12.9898,78.233)))*43758.5453)-0.5;
  col+=g*uGrain*(1.0-0.55*l);
  gl_FragColor=vec4(clamp(col,0.0,1.0),1.0);
}`};

/*
  ---------- FXAA (консольный вариант Lottes 3.11, подогнанный под эту картинку)
  ---------- Идёт ПОСЛЕДНИМ, по уже тонированной sRGB-картинке — именно там FXAA
  работает лучше всего: собранный кадр получает один дешёвый полноэкранный
  проход сглаживания, и кромки корпуса, траков, проводов и контуров зданий
  перестают «лестничить».
 */
const V_FXAA_SHADER={
  uniforms:{tDiffuse:{value:null},uRes:{value:new ct(1,1)},uSpanMax:{value:8.0},uReduceMin:{value:1/128},uReduceMul:{value:1/8}},
  vertexShader:`varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader:`
uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uSpanMax,uReduceMin,uReduceMul;
varying vec2 vUv;
float fxLuma(vec3 c){ return dot(c,vec3(0.299,0.587,0.114)); }
void main(){
  vec2 inv=1.0/uRes;
  vec3 cM =texture2D(tDiffuse,vUv).rgb;
  vec3 cNW=texture2D(tDiffuse,vUv+vec2(-1.0,-1.0)*inv).rgb;
  vec3 cNE=texture2D(tDiffuse,vUv+vec2( 1.0,-1.0)*inv).rgb;
  vec3 cSW=texture2D(tDiffuse,vUv+vec2(-1.0, 1.0)*inv).rgb;
  vec3 cSE=texture2D(tDiffuse,vUv+vec2( 1.0, 1.0)*inv).rgb;
  float lM=fxLuma(cM),lNW=fxLuma(cNW),lNE=fxLuma(cNE),lSW=fxLuma(cSW),lSE=fxLuma(cSE);
  float lMin=min(lM,min(min(lNW,lNE),min(lSW,lSE)));
  float lMax=max(lM,max(max(lNW,lNE),max(lSW,lSE)));
  vec2 dir=vec2(-((lNW+lNE)-(lSW+lSE)),((lNW+lSW)-(lNE+lSE)));
  float reduce=max((lNW+lNE+lSW+lSE)*0.25*uReduceMul,uReduceMin);
  float rcpMin=1.0/(min(abs(dir.x),abs(dir.y))+reduce);
  dir=clamp(dir*rcpMin,-uSpanMax,uSpanMax)*inv;
  vec3 rgbA=0.5*(texture2D(tDiffuse,vUv+dir*(1.0/3.0-0.5)).rgb+
                 texture2D(tDiffuse,vUv+dir*(2.0/3.0-0.5)).rgb);
  vec3 rgbB=rgbA*0.5+0.25*(texture2D(tDiffuse,vUv+dir*(-0.5)).rgb+
                           texture2D(tDiffuse,vUv+dir*( 0.5)).rgb);
  float lB=fxLuma(rgbB);
  gl_FragColor=vec4((lB<lMin||lB>lMax)?rgbA:rgbB,1.0);
}`};

function vBuildPost(){
  const size=Jn.getSize(new ct),pr=Jn.getPixelRatio();
  for(const rt of[Zr.renderTarget1,Zr.renderTarget2]){
    rt.depthTexture=new Qd(Math.max(1,size.x*pr|0),Math.max(1,size.y*pr|0),Un);
    rt.depthBuffer=!0
  }
  V_aoPass=new fw(V_AO_SHADER);
  const ao=V_aoPass,aoRender=ao.render.bind(ao);
  ao.render=function(r,w,rb,dt,ma){
    ao.uniforms.tDepth.value=rb.depthTexture;
    ao.uniforms.uInvProj.value.copy(ye.projectionMatrixInverse);
    ao.uniforms.uProj.value.copy(ye.projectionMatrix);
    ao.uniforms.uRes.value.set(rb.width,rb.height);
    ao.uniforms.uStrength.value=VQ.ao?VQ.aoStrength:0;
    aoRender(r,w,rb,dt,ma)
  };
  Zr.insertPass(ao,1);
  V_gradePass=new fw(V_GRADE_SHADER);
  const gp=V_gradePass,gpRender=gp.render.bind(gp);
  gp.render=function(r,w,rb,dt,ma){
    gp.uniforms.uRes.value.set(rb.width,rb.height);
    gp.uniforms.uTime.value=performance.now()*.001;
    gp.uniforms.uExposure.value=Jn.toneMappingExposure;
    gp.uniforms.uGrain.value=VQ.grain?.010:0;
    gp.uniforms.uSharp.value=VQ.sharp?.10:0;
    gp.uniforms.uAberr.value=VQ.aberr?.22:0;
    gpRender(r,w,rb,dt,ma)
  };
  Zr.addPass(gp);
  const fx=new fw(V_FXAA_SHADER),fxRender=fx.render.bind(fx);
  fx.render=function(r,w,rb,dt,ma){
    fx.uniforms.uRes.value.set(rb.width,rb.height);
    fxRender(r,w,rb,dt,ma)
  };
  Zr.addPass(fx);
  V_post={ao,grade:gp,fxaa:fx};
  return V_post
}

/* ---------- 5. Объёмные частицы, дульная вспышка, ударная волна и выхлоп ---------- */
function vCloudTex(N=256){
  const c=Qs(N),g=c.getContext("2d"),img=g.createImageData(N,N),d=img.data;
  const fbm=vPeriodicFBM(N,[4,8,16,32],[.45,.30,.20,.12],8009);
  const lobes=[[0,0,.44],[-.14,-.08,.32],[.15,-.06,.30],[-.10,.13,.30],[.12,.11,.31]];
  for(let y=0;y<N;y++){
    const ny=(y/N-.5)*2;
    for(let x=0;x<N;x++){
      const nx=(x/N-.5)*2;
      let m=0;
      for(const[lx,ly,lr]of lobes){
        const r=Math.hypot(nx-lx,ny-ly)/lr;
        m=Math.max(m,Math.max(0,1-r*r))
      }
      const n=fbm[y*N+x];
      const a=Math.pow(Math.max(0,Math.min(1,m*(.88+n*.55))),1.45);
      const shade=Math.min(255,Math.max(175,242-ny*28+n*26))|0;
      const idx=(y*N+x)<<2;
      d[idx]=shade;d[idx+1]=shade-2;d[idx+2]=shade-5;d[idx+3]=(a*242)|0
    }
  }
  g.putImageData(img,0,0);
  const t=new Ks(c);return t.colorSpace=Ie,t
}
function vSparkTex(N=128){
  const c=Qs(N),g=c.getContext("2d");
  const gr=g.createRadialGradient(N/2,N/2,0,N/2,N/2,N/2);
  gr.addColorStop(0,"rgba(255,255,250,1)");
  gr.addColorStop(.18,"rgba(255,236,185,.95)");
  gr.addColorStop(.48,"rgba(255,168,72,.45)");
  gr.addColorStop(1,"rgba(255,110,20,0)");
  g.fillStyle=gr;g.fillRect(0,0,N,N);
  const t=new Ks(c);return t.colorSpace=Ie,t
}
function vFlashTex(){
  const N=256,c=Qs(N),g=c.getContext("2d");
  g.clearRect(0,0,N,N);
  const gr=g.createRadialGradient(N/2,N/2,0,N/2,N/2,N/2);
  gr.addColorStop(0,"rgba(255,255,248,1)");gr.addColorStop(.16,"rgba(255,232,170,.95)");
  gr.addColorStop(.42,"rgba(255,164,64,.42)");gr.addColorStop(1,"rgba(255,120,30,0)");
  g.fillStyle=gr;g.beginPath();g.arc(N/2,N/2,N/2,0,6.283);g.fill();
  g.globalCompositeOperation="lighter";
  for(let i=0;i<9;i++){
    const a=i/9*6.283+.2,l=N*(.30+Math.random()*.20);
    g.save();g.translate(N/2,N/2);g.rotate(a);
    const lg=g.createLinearGradient(0,0,l,0);
    lg.addColorStop(0,"rgba(255,240,200,.85)");lg.addColorStop(1,"rgba(255,150,60,0)");
    g.fillStyle=lg;g.beginPath();g.moveTo(0,-N*.045);g.lineTo(l,0);g.lineTo(0,N*.045);g.closePath();g.fill();g.restore()
  }
  const t=new Ks(c);return t.colorSpace=Ie,t
}
function vRingTex(){
  const N=256,c=Qs(N),g=c.getContext("2d");
  g.clearRect(0,0,N,N);
  const gr=g.createRadialGradient(N/2,N/2,N*.30,N/2,N/2,N*.5);
  gr.addColorStop(0,"rgba(255,255,255,0)");gr.addColorStop(.55,"rgba(255,244,222,.55)");
  gr.addColorStop(.82,"rgba(220,208,190,.22)");gr.addColorStop(1,"rgba(200,190,175,0)");
  g.fillStyle=gr;g.fillRect(0,0,N,N);
  const t=new Ks(c);return t.colorSpace=Ie,t
}
function vUpgradeEffects(fx,scene){
  if(fx.__v)return fx;fx.__v=!0;
  const ctex=vCloudTex(256),stex=vSparkTex(128),ftex=vFlashTex(),rtex=vRingTex();
  fx.smokeTex=ctex;fx.sparkTex=stex;
  for(const p of fx.pool)p.sprite.material.map=ctex,p.sprite.material.needsUpdate=!0;
  /*
  Пыль из-под гусениц получает свою, гораздо более плотную текстуру и свою часть
  пула: облако взрыва настолько мягкое (средняя альфа ~6 %), что шлейф пыли,
  построенный из него, не виден вовсе.
 */
  const dtex=El(160,"rgba(255,255,255,0.92)");
  fx.dustTex=dtex;
  fx.dustFrom=Math.max(0,fx.pool.length-700);
  for(let i=fx.dustFrom;i<fx.pool.length;i++){const p=fx.pool[i];p.sprite.material.map=dtex;p.sprite.material.needsUpdate=!0}
  for(const p of fx.sparks)p.sprite.material.map=stex,p.sprite.material.needsUpdate=!0;
  const oldSpawn=dd.prototype.spawn;
  dd.prototype.spawn=function(t){
    if(t&&t.rotVel===void 0)t.rotVel=1.2;
    return oldSpawn.call(this,t)
  };
  fx.vFlash=[];
  for(let i=0;i<4;i++){
    const s=new cf(new Wl({map:ftex,color:0xffffff,transparent:!0,opacity:0,blending:Ir,depthWrite:!1,depthTest:!0,toneMapped:!1}));
    s.visible=!1;s.renderOrder=6;scene.add(s);fx.vFlash.push({s,life:0,max:1,size:1})
  }
  fx.vRing=[];
  for(let i=0;i<8;i++){
    const s=new cf(new Wl({map:rtex,color:0xffffff,transparent:!0,opacity:0,blending:Ir,depthWrite:!1,toneMapped:!1}));
    s.visible=!1;s.renderOrder=5;scene.add(s);fx.vRing.push({s,life:0,max:1,s0:1,s1:8})
  }
  const imp=fx.impact.bind(fx);
  fx.impact=function(pos,norm,scale=1,shk=1){
    imp(pos,norm,scale,shk);
    fx.flashLight.intensity=22*scale;fx.flashLight.distance=22
  };
  const burst=fx.muzzleBurst.bind(fx);
  fx.muzzleBurst=function(pos,dir,brake){
    burst(pos,dir,brake);
    fx.flashLight.intensity=38;fx.flashLight.distance=26;fx.flashLight.color.setHex(0xffb45c);
    const f=fx.vFlash.find(o=>o.life<=0)||fx.vFlash[0];
    f.life=f.max=.11;f.size=3.6+Math.random()*.9;
    f.s.visible=!0;f.s.position.copy(pos).addScaledVector(dir,.55);
    f.s.material.rotation=Math.random()*6.283;f.s.material.opacity=.88;f.s.scale.setScalar(f.size);
    const rg=fx.vRing.find(o=>o.life<=0)||fx.vRing[0];
    rg.life=rg.max=.45;rg.s0=1.3;rg.s1=9.5;
    rg.s.visible=!0;rg.s.position.copy(pos).addScaledVector(dir,1.1);rg.s.material.opacity=.44;rg.s.scale.setScalar(rg.s0);
    for(let i=0;i<14;i++){
      const a=Math.random()*6.283,r=Math.random()*.55;
      const v=new P(Math.cos(a)*r,Math.sin(a)*r,0).addScaledVector(dir,3+Math.random()*8);
      fx._get(fx.pool).spawn({pos:pos.clone().addScaledVector(dir,.8+Math.random()),vel:v,life:.65+Math.random()*.6,
        size0:.4,size1:2.8,color:0xfff0d0,drag:3.2,grav:-.4,opacity:.32})
    }
    const gy=ge(pos.x,pos.z);
    for(let i=0;i<14;i++){
      const a=i/14*6.283+Math.random()*.3,sp=3.5+Math.random()*4.5;
      fx._get(fx.pool).spawn({pos:new P(pos.x+Math.cos(a)*1.2,gy+.22,pos.z+Math.sin(a)*1.2),
        vel:new P(Math.cos(a)*sp,.6+Math.random()*.8,Math.sin(a)*sp),
        life:1.2+Math.random()*.9,size0:.65,size1:3.4,color:0xa89d86,drag:2.2,grav:-.3,opacity:.28})
    }
  };
  const expl=fx.explosion.bind(fx);
  fx.explosion=function(pos,scale){
    expl(pos,scale);
    fx.flashLight.intensity=62*(scale||1);fx.flashLight.distance=36;
    const rg=fx.vRing.find(o=>o.life<=0)||fx.vRing[0];
    rg.life=rg.max=.6;rg.s0=2*(scale||1);rg.s1=22*(scale||1);
    rg.s.visible=!0;rg.s.position.copy(pos);rg.s.material.opacity=.7;rg.s.scale.setScalar(rg.s0);
    const f=fx.vFlash.find(o=>o.life<=0)||fx.vFlash[0];
    f.life=f.max=.16;f.size=9*(scale||1);
    f.s.visible=!0;f.s.position.copy(pos);f.s.material.opacity=1;f.s.scale.setScalar(f.size)
  };
  const upd=fx.update.bind(fx);
  fx.update=function(dt){
    upd(dt);
    for(const f of fx.vFlash){
      if(f.life<=0)continue;
      f.life-=dt;
      const k=Math.max(0,f.life/f.max);
      f.s.material.opacity=k*k;f.s.scale.setScalar(f.size*(1.25-k*.35));
      if(f.life<=0){f.s.visible=!1;f.s.material.opacity=0}
    }
    for(const r of fx.vRing){
      if(r.life<=0)continue;
      r.life-=dt;
      const k=1-Math.max(0,r.life/r.max);
      r.s.scale.setScalar(r.s0+(r.s1-r.s0)*Math.pow(k,.55));
      r.s.material.opacity=.6*Math.pow(1-k,1.8);
      if(r.life<=0){r.s.visible=!1;r.s.material.opacity=0}
    }
  };
  return fx
}

/* ---------- 6. Фары танка, выхлоп и общая полировка сцены ---------- */
let V_exT=0;const V_exP=new P,V_exD=new P;
function vExhaust(dt){
  if(typeof en=="undefined"||!en||!en.__v||!qt)return;
  V_exT-=dt;if(V_exT>0)return;
  const spd=Math.abs(Ce.forwardSpeed||0),thr=Math.min(1,Math.abs(J.smoothThrottle||0));
  V_exT=.14-.08*thr;
  const n=thr>.55?2:1;
  for(let i=0;i<n;i++){
    const side=Math.random()>.5?1:-1;
    V_exP.set(side*.88,.50,-3.30).applyMatrix4(qt.chassis.matrixWorld);
    V_exD.set(0,0,-1).applyQuaternion(qt.group.quaternion).multiplyScalar(1.1+spd*.22);
    V_exD.x+=(Math.random()-.5)*.4;V_exD.y+=.85+Math.random()*.7;V_exD.z+=(Math.random()-.5)*.4;
    en._get(en.pool).spawn({pos:V_exP.clone(),vel:V_exD.clone(),life:1.3+Math.random()*1.3,
      size0:.22,size1:1.4+thr*1.3,color:thr>.6?0x50504a:0x9c9b94,drag:1.1,grav:-.55,opacity:.14+thr*.17})
  }
}
/* ---- адаптивное качество: 4 ступени, шагаем вниз при просадке < 48 fps и
   возвращаемся вверх, когда кадр снова стабильно дешевле 1/58 с ---------- */
let V_fpsT=0,V_fpsN=0,V_qCool=6,V_goodT=0,V_lastFps=60;
const V_Q_STEPS=[
  {pr:1.5,shadow:2048,ao:1,grain:1,sharp:1,aberr:1,fx:1,aniso:8,propShadow:1,tex:1},
  {pr:1.5,shadow:2048,ao:0,grain:1,sharp:1,aberr:0,fx:.8,aniso:4,propShadow:1,tex:1},
  {pr:1.0,shadow:2048,ao:0,grain:0,sharp:0,aberr:0,fx:.55,aniso:2,propShadow:1,tex:.5},
  {pr:.85,shadow:1024,ao:0,grain:0,sharp:0,aberr:0,fx:.35,aniso:1,propShadow:0,tex:.25}
];
function vSunLight(){return cn.children.find(o=>o.isDirectionalLight&&o.castShadow)}
function vSetPR(pr){
  if(Math.abs(Jn.getPixelRatio()-pr)<1e-3)return;
  Jn.setPixelRatio(pr);
  Jn.setSize(window.innerWidth,window.innerHeight);
  Zr.setPixelRatio(pr);
  Zr.setSize(window.innerWidth,window.innerHeight);
  const sz=Jn.getSize(new ct),p=Jn.getPixelRatio();
  for(const rt of[Zr.renderTarget1,Zr.renderTarget2]){
    if(rt.depthTexture)rt.depthTexture.dispose();
    rt.depthTexture=new Qd(Math.max(1,sz.x*p|0),Math.max(1,sz.y*p|0),Un);
    rt.depthBuffer=!0
  }
}
function vApplyQ(i){
  const q=V_Q_STEPS[Te.clamp(i|0,0,V_Q_STEPS.length-1)];
  VQ.level=V_Q_STEPS.indexOf(q);
  VQ.ao=q.ao;VQ.grain=q.grain;VQ.sharp=q.sharp;VQ.aberr=q.aberr;VQ.shadow=q.shadow;
  /* 2.2: частицы, анизотропия и тени мелких пропсов идут за той же ступенью */
  VCH_FXK=q.fx;VCH_anisoApply(q.aniso);VCH_propShadow(!!q.propShadow);VCH_texScale(q.tex);
  vSetPR(Math.min(window.devicePixelRatio||1,q.pr));
  const L=vSunLight();
  if(L&&L.shadow.mapSize.x!==q.shadow){
    L.shadow.mapSize.set(q.shadow,q.shadow);
    L.shadow.map&&L.shadow.map.dispose();L.shadow.map=null
  }
}
function vAdapt(dt){
  /* ручное качество из меню: авто-адаптер молчит */
  if(window.__vchQFix)return;
  V_fpsT+=dt;V_fpsN++;V_qCool-=dt;
  if(V_fpsT<1.2)return;
  const fps=V_fpsN/V_fpsT;V_fpsT=0;V_fpsN=0;V_lastFps=fps;
  if(V_qCool>0)return;
  if(fps<48&&VQ.level<V_Q_STEPS.length-1){
    V_qCool=2.5;V_goodT=0;
    vApplyQ(VQ.level+(fps<28?2:1))
  }else if(fps>58&&VQ.level>0){
    V_goodT+=1.2;
    if(V_goodT>8){V_goodT=0;V_qCool=5;vApplyQ(VQ.level-1)}
  }else V_goodT=0;
}
window.__vq={apply:vApplyQ,get:()=>({level:VQ.level,pr:+Jn.getPixelRatio().toFixed(2),
  shadow:VQ.shadow,fps:+V_lastFps.toFixed(1)})};
function vEnsureTankLights(){
  if(!qt||!qt.chassis||qt.__vLights)return;
  qt.__vLights=!0;
  for(const sx of[-.83,.83]){
    const sp=new by(0xffe1a6,3.2,24,.58,.65,1.5);
    sp.position.set(sx,.56,2.80);
    sp.target.position.set(sx*1.05,-.85,11.5);
    qt.chassis.add(sp);qt.chassis.add(sp.target)
  }
  for(const sx of[-.88,.88]){
    const rl=new Ql(0xff5a26,.35,2.4,2);
    rl.position.set(sx,.60,-3.36);qt.chassis.add(rl)
  }
}
