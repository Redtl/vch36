/* ==========================================================================
   vch36 · js/06f-nord.js
   Локация 5: АРКТИЧЕСКАЯ БАЗА «СЕВЕР-3» (?map=nord)
   Полноценная заснеженная военная база на ясном полярном закате:
   - плавный аналитический рельеф 480×480 м с ВПП, ледяным каналом и перевалом;
   - процедурные PBR-текстуры (снег/наст, плиты ПАГ-14, ВПП 03, железобетон, гранит, лёд);
   - сквозной танковый ангар, вышка КДП, склад ГСМ, вращающаяся РЛС, мост-дамба,
     эстакада-путепровод, трамплины, капониры, ДОТы, арка рубежа и разрушаемый реквизит;
   - заснеженные ели, валуны, гранитные скальные пики (InstancedMesh), костры и снежок.
   ========================================================================== */
"use strict";

let VCH_NORD_group = null;
const VCH_NORD_recs = [];
let VCH_NORD_fires = null;
let _VCH_NORD_physics = null;
const VCH_NORD_anim = { radar: null, beacon: null, windsock: null, snowT: 0 };

/* ---- 1. Аналитическая высота и рельеф базы «Север-3» ------------------- */
function VCH_NORD_riverZ(x){
  return -66 + 10 * Math.sin(x * 0.032);
}

function VCH_NORD_boxMask(x, z, cx, cz, hx, hz, feather){
  const dx = Math.max(0, Math.abs(x - cx) - hx);
  const dz = Math.max(0, Math.abs(z - cz) - hz);
  const d = Math.hypot(dx, dz);
  return 1 - Te.smoothstep(d, 0, feather);
}

function VCH_NORD_h(x, z){
  const r = Math.hypot(x, z);

  /* базовые пологие северные холмы */
  let h =
    Math.sin(x * 0.017 + 0.4) * Math.cos(z * 0.015 - 0.5) * 1.15 +
    Math.sin((x - z) * 0.011 + 1.1) * 0.85 +
    Math.cos(x * 0.038 + z * 0.031) * 0.32;

  /* характерные гряды северного перевала и флангов */
  const ridges = [
    [-48, 122, 26, 6.4],
    [ 46, 120, 26, 7.2],
    [  0, 128, 22, 3.2],
    [ 84,  26, 20, 2.8],
    [-92, -108, 24, 4.2],
    [ 88, -105, 24, 3.8]
  ];
  for(const [rx, rz, rad, amp] of ridges){
    const d = Math.hypot(x - rx, z - rz);
    if(d < rad * 2.4){
      const k = Math.exp(-(d * d) / (rad * rad));
      h += amp * k;
    }
  }

  /* выровненные площадки базы, ВПП, строений и подъездов к мосту */
  const mBase = VCH_NORD_boxMask(x, z, 0, 22, 39, 54, 18);
  const mEast = VCH_NORD_boxMask(x, z, 48, 0, 16, 22, 12);
  const mHeli = VCH_NORD_boxMask(x, z, -32, -4, 14, 16, 10);
  const mTower = VCH_NORD_boxMask(x, z, -54, 24, 7, 7, 8);
  const mFuel = VCH_NORD_boxMask(x, z, 56, -32, 13, 12, 10);
  const mRampYard = VCH_NORD_boxMask(x, z, -28, -34, 22, 10, 8);
  const mBridgeN = VCH_NORD_boxMask(x, z, 0, -47, 7, 6, 8);
  const mBridgeS = VCH_NORD_boxMask(x, z, 0, -85, 7, 6, 8);
  const flatBase = Math.max(mBase, mEast, mHeli, mTower, mFuel, mRampYard, mBridgeN, mBridgeS);
  h *= (1 - flatBase);

  /* западная ВПП */
  const mRunway = VCH_NORD_boxMask(x, z, -80, 0, 14, 102, 10);
  h = h * (1 - mRunway) + 0.06 * mRunway;

  /* рулёжка от центра базы к ВПП */
  const mTaxi = VCH_NORD_boxMask(x, z, -52, 2, 22, 10, 8);
  h = h * (1 - mTaxi) + 0.04 * mTaxi;

  /* южное замёрзшее русло восточнее ВПП (от x = -62 до +148, берег уходит в -1.68) */
  const rz = VCH_NORD_riverZ(x);
  const dRiv = Math.abs(z - rz);
  const riverSpan = Te.smoothstep(x, -64, -50) * (1 - Te.smoothstep(x, 128, 150));
  if(dRiv < 22 && riverSpan > 0.001){
    const carve = (1 - Te.smoothstep(dRiv, 9.5, 21.5)) * riverSpan;
    const bridgeEnds = VCH_NORD_boxMask(x, z, 0, -47, 7, 5, 7) + VCH_NORD_boxMask(x, z, 0, -85, 7, 5, 7);
    const eff = carve * (1 - Math.min(1, bridgeEnds));
    h = h * (1 - eff) + (-1.68) * eff;
  }
  h = Math.max(h, -1.52);

  /* естественные рельефные горы по всему внешнему кольцу */
  const rim = Te.smoothstep(r, 128, 224);
  if(rim > 0){
    const ang = Math.atan2(z, x);
    const fold = 0.65 + 0.35 * Math.abs(Math.sin(ang * 5.0 + 0.4) * Math.cos(r * 0.055 - 0.3))
                      + 0.20 * Math.sin(ang * 11.0 - r * 0.04);
    h += rim * rim * 40 * fold;
  }

  return h;
}

/* ---- 2. Процедурные PBR-текстуры (без пересвета и без окон на бетоне) -- */
let VCH_NORD_MATS = null;

function VCH_NORD_tex(canvas, rep, srgb){
  const t = new Ks(canvas);
  t.wrapS = t.wrapT = vi;
  t.anisotropy = 16;
  if(srgb) t.colorSpace = Ie;
  if(rep){
    if(Array.isArray(rep)) t.repeat.set(rep[0], rep[1]);
    else t.repeat.set(rep, rep);
  }
  return t;
}

function VCH_NORD_materials(){
  if(VCH_NORD_MATS) return VCH_NORD_MATS;
  const N = 512;

  /* 2.1. Снежный наст и ветровая рябь (умеренная яркость без bloom-пересвета) */
  const f1 = vPeriodicFBM(N, [4, 8, 16, 32, 64], [0.46, 0.30, 0.22, 0.14, 0.08], 501);
  const f2 = vPeriodicFBM(N, [8, 16, 32, 64], [0.32, 0.26, 0.20, 0.12], 809);
  const snowH = new Float32Array(N * N);
  const sc = Qs(N), sg = sc.getContext("2d"), simg = sg.createImageData(N, N), sd = simg.data;
  const src = Qs(N), srg = src.getContext("2d"), rimg = srg.createImageData(N, N), rd = rimg.data;
  for(let y = 0; y < N; y++){
    for(let x = 0; x < N; x++){
      const i = y * N + x;
      const drift = Math.sin((x * 0.06 + y * 0.025) + f1[i] * 5.2) * 0.14;
      const v = f1[i] * 0.6 + f2[i] * 0.35 + drift;
      snowH[i] = v;
      const shade = Math.min(224, Math.max(176, 202 + v * 28)) | 0;
      const idx = i << 2;
      sd[idx]     = Math.max(166, shade - 5);
      sd[idx + 1] = Math.max(174, shade);
      sd[idx + 2] = Math.min(234, shade + 10);
      sd[idx + 3] = 255;
      const rv = Math.min(248, Math.max(185, 226 - v * 32)) | 0;
      rd[idx] = rd[idx + 1] = rd[idx + 2] = rv;
      rd[idx + 3] = 255;
    }
  }
  sg.putImageData(simg, 0, 0);
  srg.putImageData(rimg, 0, 0);
  const snowNorm = vHeightToNormal(snowH, N, 2.0, 26);
  const snowMap = VCH_NORD_tex(sc, 26, true);
  const snowRough = VCH_NORD_tex(src, 26, false);

  /* 2.2. Армированный монолитный железобетон (для бункеров, моста, ангара, трамплинов) */
  const cf1 = vPeriodicFBM(N, [4, 8, 16, 32, 64], [0.40, 0.28, 0.20, 0.14, 0.10], 1901);
  const cH = new Float32Array(N * N);
  const cc = Qs(N), cg = cc.getContext("2d"), cimg = cg.createImageData(N, N), cd = cimg.data;
  const crc = Qs(N), crg = crc.getContext("2d"), crimg = crg.createImageData(N, N), crd = crimg.data;
  for(let y = 0; y < N; y++){
    for(let x = 0; x < N; x++){
      const i = y * N + x;
      const seam = ((y % 128) < 2 || (x % 256) < 2) ? 1 : 0;
      const frost = Math.max(0, cf1[i] - 0.15) * 0.9;
      cH[i] = seam ? -0.35 : cf1[i] * 0.5;
      const base = seam ? 86 : 132 + cf1[i] * 38 + frost * 26;
      const idx = i << 2;
      cd[idx]     = Math.min(205, Math.max(70, base - 2)) | 0;
      cd[idx + 1] = Math.min(208, Math.max(72, base + 1)) | 0;
      cd[idx + 2] = Math.min(215, Math.max(76, base + 6)) | 0;
      cd[idx + 3] = 255;
      const rv = seam ? 245 : Math.min(244, Math.max(175, 220 - cf1[i] * 30)) | 0;
      crd[idx] = crd[idx + 1] = crd[idx + 2] = rv;
      crd[idx + 3] = 255;
    }
  }
  cg.putImageData(cimg, 0, 0);
  crg.putImageData(crimg, 0, 0);
  const concMap = VCH_NORD_tex(cc, 2, true);
  const concNorm = vHeightToNormal(cH, N, 2.5, 2);
  const concRough = VCH_NORD_tex(crc, 2, false);

  /* Однородный бетон без длинных швов для треугольных клиньев трамплинов */
  const rcPlain = Qs(256), rpg = rcPlain.getContext("2d"), rpi = rpg.createImageData(256, 256), rpd = rpi.data;
  const rfbm = vPeriodicFBM(256, [4, 8, 16, 32], [0.4, 0.3, 0.2, 0.1], 2411);
  for(let i = 0; i < 256 * 256; i++){
    const b = Math.min(188, Math.max(96, 142 + rfbm[i] * 48)) | 0;
    const idx = i << 2;
    rpd[idx] = b; rpd[idx + 1] = b + 3; rpd[idx + 2] = b + 7; rpd[idx + 3] = 255;
  }
  rpg.putImageData(rpi, 0, 0);
  const rampMap = VCH_NORD_tex(rcPlain, 1, true);

  /* 2.3. Колотый северный гранит и сланец (для скал и валунов) */
  const gf1 = vPeriodicFBM(N, [4, 8, 16, 32, 64], [0.48, 0.34, 0.24, 0.16, 0.10], 3307);
  const rockH = new Float32Array(N * N);
  const rkc = Qs(N), rkg = rkc.getContext("2d"), rkimg = rkg.createImageData(N, N), rkd = rkimg.data;
  for(let i = 0; i < N * N; i++){
    const v = gf1[i];
    const crack = Math.abs(v) < 0.04 ? -0.4 : 0;
    rockH[i] = v * 0.9 + crack;
    const base = Math.min(165, Math.max(58, 102 + v * 65 + crack * 55)) | 0;
    const idx = i << 2;
    rkd[idx]     = base;
    rkd[idx + 1] = base + 4;
    rkd[idx + 2] = base + 10;
    rkd[idx + 3] = 255;
  }
  rkg.putImageData(rkimg, 0, 0);
  const rockMap = VCH_NORD_tex(rkc, 3, true);
  const rockNorm = vHeightToNormal(rockH, N, 3.6, 3);

  /* 2.4. Аэродромные плиты ПАГ-14 */
  const pc = Qs(N), pg = pc.getContext("2d");
  const prc = Qs(N), prg = prc.getContext("2d");
  const pf = vPeriodicFBM(N, [8, 16, 32, 64], [0.34, 0.25, 0.18, 0.12], 1423);
  const pH = new Float32Array(N * N);
  const pimg = pg.createImageData(N, N), pd = pimg.data;
  const primg = prg.createImageData(N, N), prd = primg.data;
  for(let y = 0; y < N; y++){
    for(let x = 0; x < N; x++){
      const i = y * N + x;
      const seam = (x % 128) < 2 || (x % 128) > 126 || (y % 64) < 2 || (y % 64) > 62;
      const frost = Math.max(0, pf[i] - 0.14) * 1.1;
      const base = seam ? (84 + frost * 22) : (110 + pf[i] * 28 + frost * 30);
      pH[i] = seam ? -0.24 : pf[i] * 0.35;
      const idx = i << 2;
      pd[idx]     = Math.min(198, Math.max(48, base - 2)) | 0;
      pd[idx + 1] = Math.min(204, Math.max(50, base + 1)) | 0;
      pd[idx + 2] = Math.min(212, Math.max(55, base + 7)) | 0;
      pd[idx + 3] = 255;
      const rv = seam ? 245 : Math.min(238, Math.max(162, 212 - pf[i] * 32)) | 0;
      prd[idx] = prd[idx + 1] = prd[idx + 2] = rv;
      prd[idx + 3] = 255;
    }
  }
  pg.putImageData(pimg, 0, 0);
  prg.putImageData(primg, 0, 0);
  const pagNorm = vHeightToNormal(pH, N, 2.8, [2, 16]);

  /* 2.5. ВПП 03 / 21 */
  const rc = Qs(1024), rg = rc.getContext("2d");
  for(let yy = 0; yy < 1024; yy += 256){
    for(let xx = 0; xx < 1024; xx += 256) rg.drawImage(pc, xx, yy, 256, 256);
  }
  const rgGrad = rg.createLinearGradient(0, 0, 1024, 0);
  rgGrad.addColorStop(0.28, "rgba(22,25,30,0)");
  rgGrad.addColorStop(0.45, "rgba(20,23,28,0.34)");
  rgGrad.addColorStop(0.55, "rgba(20,23,28,0.34)");
  rgGrad.addColorStop(0.72, "rgba(22,25,30,0)");
  rg.fillStyle = rgGrad;
  rg.fillRect(0, 60, 1024, 904);
  rg.fillStyle = "#dce3ea";
  rg.fillRect(34, 18, 18, 988);
  rg.fillRect(972, 18, 18, 988);
  rg.fillStyle = "#dfaa34";
  rg.fillRect(62, 24, 8, 976);
  rg.fillRect(954, 24, 8, 976);
  rg.fillStyle = "#e2e8ee";
  for(let i = 0; i < 8; i++){
    const sx = 120 + i * 102;
    rg.fillRect(sx, 28, 52, 74);
    rg.fillRect(sx, 922, 52, 74);
  }
  rg.save();
  rg.fillStyle = "#e2e8ee";
  rg.font = "900 92px monospace";
  rg.textAlign = "center";
  rg.fillText("03", 512, 190);
  rg.translate(512, 834);
  rg.rotate(Math.PI);
  rg.fillText("21", 0, 0);
  rg.restore();
  rg.fillStyle = "#e5ebf0";
  for(let yy = 228; yy < 775; yy += 64) rg.fillRect(498, yy, 28, 38);
  const runwayTex = VCH_NORD_tex(rc, 1, true);

  /* 2.6. Вертолётная площадка H */
  const hc = Qs(N), hg = hc.getContext("2d");
  hg.drawImage(pc, 0, 0);
  hg.strokeStyle = "#e0aa34";
  hg.lineWidth = 18;
  hg.beginPath(); hg.arc(256, 256, 178, 0, Math.PI * 2); hg.stroke();
  hg.strokeStyle = "#e2e8ee";
  hg.lineWidth = 10;
  hg.strokeRect(24, 24, 464, 464);
  hg.fillStyle = "#e2e8ee";
  hg.fillRect(166, 134, 38, 244);
  hg.fillRect(308, 134, 38, 244);
  hg.fillRect(166, 236, 180, 40);
  const heliTex = VCH_NORD_tex(hc, 1, true);

  /* 2.7. Потрескавшийся зеркальный полярный лёд + матовые трещины */
  const ic = Qs(N), ig = ic.getContext("2d");
  const irc = Qs(N), irg = irc.getContext("2d");
  const ifbm = vPeriodicFBM(N, [4, 8, 16, 32], [0.42, 0.28, 0.18, 0.10], 2137);
  const iceH = new Float32Array(N * N);
  const iimg = ig.createImageData(N, N), idd = iimg.data;
  const irimg = irg.createImageData(N, N), irdd = irimg.data;
  for(let i = 0; i < N * N; i++){
    const v = ifbm[i];
    iceH[i] = v * 0.48;
    const idx = i << 2;
    idd[idx]     = Math.min(205, Math.max(76,  104 + v * 56)) | 0;
    idd[idx + 1] = Math.min(222, Math.max(115, 146 + v * 50)) | 0;
    idd[idx + 2] = Math.min(238, Math.max(150, 182 + v * 44)) | 0;
    idd[idx + 3] = 255;
    const rv = Math.min(230, Math.max(28, 72 + v * 155)) | 0;
    irdd[idx] = irdd[idx + 1] = irdd[idx + 2] = rv; irdd[idx + 3] = 255;
  }
  ig.putImageData(iimg, 0, 0);
  irg.putImageData(irimg, 0, 0);
  ig.strokeStyle = "rgba(218, 238, 252, 0.54)";
  irg.strokeStyle = "rgba(235, 235, 235, 0.85)";
  const rng = Vf(319);
  for(let k = 0; k < 56; k++){
    let x = rng() * N, y = rng() * N, a = rng() * Math.PI * 2;
    ig.lineWidth = 0.8 + rng() * 1.5;
    irg.lineWidth = 1.6 + rng() * 2.0;
    ig.beginPath(); ig.moveTo(x, y);
    irg.beginPath(); irg.moveTo(x, y);
    for(let s = 0; s < 5; s++){
      a += (rng() - 0.5) * 0.85;
      x += Math.cos(a) * (16 + rng() * 28);
      y += Math.sin(a) * (16 + rng() * 28);
      ig.lineTo(x, y);
      irg.lineTo(x, y);
    }
    ig.stroke();
    irg.stroke();
  }
  const iceMap = VCH_NORD_tex(ic, [14, 5], true);
  const iceRough = VCH_NORD_tex(irc, [14, 5], false);
  const iceNorm = vHeightToNormal(iceH, N, 2.8, [14, 5]);

  /* 2.8. Гофролист ангара с шевроном */
  const mc = Qs(256), mg = mc.getContext("2d");
  mg.fillStyle = "#515b63";
  mg.fillRect(0, 0, 256, 256);
  for(let x = 0; x < 256; x += 16){
    mg.fillStyle = (x % 32 === 0) ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.14)";
    mg.fillRect(x, 0, 8, 256);
  }
  mg.fillStyle = "rgba(180,196,214,0.22)";
  mg.fillRect(0, 0, 256, 36);
  mg.save();
  mg.beginPath(); mg.rect(0, 212, 256, 44); mg.clip();
  mg.fillStyle = "#d4a432"; mg.fillRect(0, 212, 256, 44);
  mg.fillStyle = "#1b1f24";
  for(let x = -64; x < 320; x += 32){
    mg.beginPath();
    mg.moveTo(x, 212); mg.lineTo(x + 16, 212);
    mg.lineTo(x + 44, 256); mg.lineTo(x + 28, 256);
    mg.closePath(); mg.fill();
  }
  mg.restore();
  const hangarTex = VCH_NORD_tex(mc, [2, 1], true);

  /* 2.9. Цистерны ГСМ */
  const tc = Qs(256), tg = tc.getContext("2d");
  tg.fillStyle = "#7a848c";
  tg.fillRect(0, 0, 256, 256);
  tg.fillStyle = "#b03a28";
  tg.fillRect(0, 108, 256, 40);
  tg.fillStyle = "#e6ecee";
  tg.font = "bold 20px monospace";
  tg.textAlign = "center";
  tg.fillText("ГСМ · ОГНЕОПАСНО", 128, 135);
  tg.fillStyle = "rgba(0,0,0,0.16)";
  for(let y = 32; y < 256; y += 64) tg.fillRect(0, y, 256, 2);
  const cisternTex = VCH_NORD_tex(tc, 1, true);

  /* 2.10. Дорожные знаки */
  function makeSignTex(title, sub, accent){
    const c = Qs(256), g = c.getContext("2d");
    g.fillStyle = "#1d2c3a"; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = accent || "#e8b339"; g.lineWidth = 10; g.strokeRect(10, 10, 236, 236);
    g.fillStyle = accent || "#e8b339"; g.fillRect(16, 16, 224, 52);
    g.fillStyle = "#121a21"; g.font = "900 26px monospace"; g.textAlign = "center";
    g.fillText("СЕВЕР-3", 128, 52);
    g.fillStyle = "#e5eef4"; g.font = "bold 24px monospace"; g.fillText(title, 128, 128);
    g.fillStyle = "#9ab4c8"; g.font = "bold 17px monospace"; g.fillText(sub, 128, 174);
    return VCH_NORD_tex(c, 1, true);
  }

  const pagMap = VCH_NORD_tex(pc, [2, 16], true);
  const pagRough = VCH_NORD_tex(prc, [2, 16], false);
  const pagYardMap = VCH_NORD_tex(pc, [6, 6], true);
  const pagYardNorm = vHeightToNormal(pH, N, 2.6, [6, 6]);
  const crateMat = vCrateMaterial();
  const rustMat = vRustMaterial();

  VCH_NORD_MATS = {
    snow: new fe({
      map: snowMap, normalMap: snowNorm, normalScale: new ct(0.42, 0.42),
      roughnessMap: snowRough, vertexColors: true,
      roughness: 0.96, metalness: 0.01, envMapIntensity: 0.28, dithering: true
    }),
    snowPure: new fe({
      map: snowMap, normalMap: snowNorm, normalScale: new ct(0.26, 0.26),
      color: 0x9aa9bc, roughness: 0.94, metalness: 0.01, envMapIntensity: 0.28
    }),
    runway: new fe({
      map: runwayTex, normalMap: pagNorm, normalScale: new ct(0.45, 0.45),
      roughness: 0.88, metalness: 0.05, envMapIntensity: 0.48,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
    }),
    apron: new fe({
      map: pagYardMap, normalMap: pagYardNorm, normalScale: new ct(0.42, 0.42),
      roughness: 0.90, metalness: 0.04, envMapIntensity: 0.45,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
    }),
    taxi: new fe({
      map: pagMap, normalMap: pagNorm, normalScale: new ct(0.40, 0.40),
      roughnessMap: pagRough, roughness: 0.90, metalness: 0.04, envMapIntensity: 0.45,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
    }),
    helipad: new fe({
      map: heliTex, normalMap: pagYardNorm, normalScale: new ct(0.38, 0.38),
      roughness: 0.88, metalness: 0.05, envMapIntensity: 0.45,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1
    }),
    ice: new fe({
      map: iceMap, normalMap: iceNorm, normalScale: new ct(0.62, 0.62),
      roughnessMap: iceRough, color: 0xa4d0ec, roughness: 0.48, metalness: 0.16, envMapIntensity: 1.55
    }),
    concrete: new fe({
      map: concMap, normalMap: concNorm, normalScale: new ct(0.42, 0.42),
      roughnessMap: concRough, color: 0x9aa4ae, roughness: 0.90, metalness: 0.06, envMapIntensity: 0.45
    }),
    concreteDark: new fe({
      map: concMap, normalMap: concNorm, normalScale: new ct(0.45, 0.45),
      roughnessMap: concRough, color: 0x67707a, roughness: 0.92, metalness: 0.08, envMapIntensity: 0.42
    }),
    ramp: new fe({
      map: rampMap, normalMap: concNorm, normalScale: new ct(0.32, 0.32),
      color: 0x98a2ac, roughness: 0.90, metalness: 0.05, envMapIntensity: 0.45
    }),
    hangar: new fe({
      map: hangarTex, normalMap: concNorm, normalScale: new ct(0.30, 0.30),
      roughness: 0.66, metalness: 0.42, envMapIntensity: 0.68
    }),
    steel: new fe({ color: 0x3b444d, roughness: 0.52, metalness: 0.65, envMapIntensity: 0.85 }),
    steelBright: new fe({ color: 0x73808c, roughness: 0.45, metalness: 0.70, envMapIntensity: 0.95 }),
    cistern: new fe({ map: cisternTex, roughness: 0.50, metalness: 0.52, envMapIntensity: 0.78 }),
    glass: new fe({ color: 0x224462, roughness: 0.28, metalness: 0.25, envMapIntensity: 1.4 }),
    wood: crateMat,
    barrel: new fe({ color: 0xb23222, roughness: 0.56, metalness: 0.42, envMapIntensity: 0.75 }),
    rust: rustMat,
    warnYellow: new fe({ color: 0xd69e2c, roughness: 0.64, metalness: 0.22, envMapIntensity: 0.55 }),
    pine: new fe({ color: 0x1e3625, roughness: 0.94, metalness: 0.02, envMapIntensity: 0.38 }),
    bark: new fe({ color: 0x3d2c20, roughness: 0.95, metalness: 0.02, envMapIntensity: 0.35 }),
    rock: new fe({
      map: rockMap, normalMap: rockNorm, normalScale: new ct(0.55, 0.55),
      color: 0x808b96, roughness: 0.92, metalness: 0.04, envMapIntensity: 0.42
    }),
    mountain: new fe({
      map: rockMap, normalMap: rockNorm, normalScale: new ct(0.50, 0.50),
      vertexColors: true, roughness: 0.92, metalness: 0.03, envMapIntensity: 0.42
    }),
    lampAmber: new fe({
      color: 0xffd088, emissive: 0xffa63a, emissiveIntensity: 2.6, roughness: 0.30
    }),
    lampRed: new fe({
      color: 0xff5a42, emissive: 0xff2e14, emissiveIntensity: 3.0, roughness: 0.30
    }),
    signRunway: new fe({ map: makeSignTex("ВПП 03 / 21", "ЗАПАД · КДП", "#eab238"), roughness: 0.78 }),
    signFuel:   new fe({ map: makeSignTex("СКЛАД ГСМ", "ВОСТОК · ОПАСНО", "#e2583e"), roughness: 0.78 }),
    signRange:  new fe({ map: makeSignTex("ОГНЕВОЙ РУБЕЖ", "СЕВЕР · ПОЛИГОН", "#62cc44"), roughness: 0.78 })
  };
  return VCH_NORD_MATS;
}

/* ---- 3. Помощники размещения и физики ---------------------------------- */
function VCH_NORD_mesh(geo, mat, x, y, z, yaw = 0, rx = 0, rz = 0){
  const m = new Lt(geo, mat);
  m.position.set(x, y, z);
  if(yaw) m.rotation.y = yaw;
  if(rx)  m.rotation.x = rx;
  if(rz)  m.rotation.z = rz;
  m.castShadow = true;
  m.receiveShadow = true;
  VCH_NORD_group.add(m);
  return m;
}

function VCH_NORD_staticBox(physics, wX, hY, dZ, mat, x, y, z, yaw = 0, opt = {}){
  const m = VCH_NORD_mesh(new _e(wX, hY, dZ), mat, x, y, z, yaw);
  const b = new Et({
    mass: 0,
    type: Et.STATIC,
    position: new w(x, y, z),
    angularDamping: 0.4,
    linearDamping: 0.05
  });
  b.quaternion.setFromEuler(0, yaw, 0);
  b.addShape(new ns(new w(wX * 0.5, hY * 0.5, dZ * 0.5)));
  b.collisionFilterGroup = opt.ramp ? VCH_RAMP : is;
  b.collisionFilterMask = 7 | VCH_RAMP;
  physics.addBody(b);
  const rec = {
    mesh: m,
    body: b,
    hp: opt.hp ?? 999,
    destructible: !!opt.destructible,
    kind: opt.kind || "concrete",
    dynamic: false,
    alive: true
  };
  m.userData.prop = rec;
  VCH_NORD_recs.push(rec);
  return rec;
}

function VCH_NORD_wedge(physics, x, z, yaw, width, len, height, baseY = null){
  const M = VCH_NORD_materials();
  const gy = (baseY !== null) ? baseY : ge(x, z);
  const prof = [
    { at: -width / 2, pts: [[0, -len / 2], [height, len / 2], [0, len / 2]] },
    { at:  width / 2, pts: [[0, -len / 2], [height, len / 2], [0, len / 2]] }
  ];
  const geo = zf("x", prof, { capStart: true, capEnd: true });
  geo.computeVertexNormals();
  const m = VCH_NORD_mesh(geo, M.ramp, x, gy - 0.02, z, yaw);
  const lip = new Lt(new _e(width, 0.14, 0.42), M.warnYellow);
  lip.position.set(0, height - 0.04, len / 2 - 0.22);
  lip.castShadow = true;
  m.add(lip);

  const wdg = VCH_wedge(width, len, height);
  const b = new Et({ mass: 0, type: Et.STATIC, position: new w(x, gy - 0.02, z) });
  b.quaternion.setFromEuler(0, yaw, 0);
  b.addShape(wdg.shape, new w(wdg.offset.x, wdg.offset.y, wdg.offset.z));
  b.collisionFilterGroup = VCH_RAMP;
  b.collisionFilterMask = 7 | VCH_RAMP;
  physics.addBody(b);
  const rec = { mesh: m, body: b, hp: 999, destructible: false, kind: "ramp", dynamic: false, alive: true };
  m.userData.prop = rec;
  VCH_NORD_recs.push(rec);
  return rec;
}

function VCH_NORD_prop(physics, mesh, x, z, yaw, opt){
  const b = VCH_bounds(mesh);
  VCH_place(mesh, x, z, b.hx, b.hz, yaw, b.bottom);
  VCH_NORD_group.add(mesh);
  const g = new Et({
    mass: opt.mass || 0,
    type: opt.mass ? Et.DYNAMIC : Et.STATIC,
    position: new w(mesh.position.x, mesh.position.y, mesh.position.z),
    angularDamping: 0.45,
    linearDamping: 0.15
  });
  g.quaternion.set(mesh.quaternion.x, mesh.quaternion.y, mesh.quaternion.z, mesh.quaternion.w);
  for(const p of VCH_parts(mesh)){
    g.addShape(
      new ns(new w(p.half.x, p.half.y, p.half.z)),
      new w(p.off.x, p.off.y, p.off.z),
      new Fe(p.quat.x, p.quat.y, p.quat.z, p.quat.w)
    );
  }
  g.collisionFilterGroup = is;
  g.collisionFilterMask = 7 | VCH_RAMP;
  physics.addBody(g);
  const rec = {
    mesh,
    body: g,
    hp: opt.hp ?? 1,
    destructible: opt.destructible !== false,
    kind: opt.kind || "crate",
    dynamic: !!opt.mass,
    alive: true
  };
  rec.groundY = mesh.position.y;
  VCH_settle(rec);
  mesh.userData.prop = rec;
  VCH_NORD_recs.push(rec);
  return rec;
}


/* ---- 3.5. Справочные детали (реалистичная арктическая архитектура) ------- */
function VCH_NORD_radome(cx, cz, gy, radius = 2.6, towerH = 5.6){
  const M = VCH_NORD_materials();
  const root = new Jt();
  root.position.set(cx, gy, cz);
  const leg = 0.22;
  const half = radius * 0.92;
  for(const s of [-1, 1]){
    VCH_NORD_mesh(new _e(leg, towerH, leg), M.steel, s * half, gy + towerH * 0.5, s * half);
  }
  const dome = new Lt(new Sa(radius, 14, 10), M.snowPure);
  dome.position.set(0, gy + towerH + radius * 0.55, 0);
  dome.castShadow = true; dome.receiveShadow = true;
  root.add(dome);
  VCH_NORD_group.add(root);
  return root;
}
function VCH_NORD_latticeTower(cx, cz, gy, height = 7.0, cell = 1.1){
  const M = VCH_NORD_materials();
  const root = new Jt();
  root.position.set(cx, gy, cz);
  const leg = 0.14;
  const h = cell * 0.9;
  const n = Math.round(height / h);
  for(let i = 0; i <= n; i++){
    const y = gy + i * h;
    for(const s of [-1, 1]){
      VCH_NORD_mesh(new _e(leg, h, leg), M.steel, s * cell * 0.5, y + h * 0.5, s * cell * 0.5);
      VCH_NORD_mesh(new _e(leg, h, leg), M.steel, s * cell * 0.5, y + h * 0.5, -s * cell * 0.5);
    }
    if(i < n){
      const y2 = y + h;
      VCH_NORD_mesh(new mn(leg, leg, cell * 1.05, 6), M.steelBright, cell * 0.5, (y + y2) * 0.5, 0);
      VCH_NORD_mesh(new mn(leg, leg, cell * 1.05, 6), M.steelBright, -cell * 0.5, (y + y2) * 0.5, 0);
      VCH_NORD_mesh(new mn(leg, leg, cell * 1.05, 6), M.steelBright, 0, (y + y2) * 0.5, cell * 0.5);
      VCH_NORD_mesh(new mn(leg, leg, cell * 1.05, 6), M.steelBright, 0, (y + y2) * 0.5, -cell * 0.5);
    }
  }
  VCH_NORD_group.add(root);
  return root;
}
function VCH_NORD_fuelTank(physics, cx, cz, gy, r = 1.35, len = 8.6, yaw = 0){
  const M = VCH_NORD_materials();
  const root = new Jt();
  root.position.set(cx, gy, cz);
  root.rotation.y = yaw;
  const body = new Lt(new mn(r, r, len, 20), M.cistern);
  body.rotation.z = -Math.PI / 2;
  body.position.set(0, r + 0.18, 0);
  body.castShadow = true; body.receiveShadow = true;
  root.add(body);
  for(const s of [-1, 1]){
    const sad = new Lt(new _e(len * 0.55, 0.34, 0.62), M.concreteDark);
    sad.rotation.z = -Math.PI / 2;
    sad.position.set(s * (len * 0.28), 0.17, 0);
    sad.castShadow = true; sad.receiveShadow = true;
    root.add(sad);
  }
  const neck = new Lt(new mn(0.34, 0.34, 0.72, 10), M.steel);
  neck.rotation.z = -Math.PI / 2;
  neck.position.set(len * 0.34, r + 0.18 + r + 0.02, 0);
  neck.castShadow = true;
  root.add(neck);
  const hatch = new Lt(new _e(0.72, 0.05, 0.72), M.warnYellow);
  hatch.rotation.z = -Math.PI / 2;
  hatch.position.set(len * 0.34, r + 0.18 + r + 0.38, 0);
  root.add(hatch);
  const roof = new Lt(new _e(1.1, 0.12, 1.1), M.steelBright);
  roof.rotation.z = -Math.PI / 2;
  roof.position.set(len * 0.34, r + 0.18 + r + 0.62, 0);
  roof.castShadow = true;
  root.add(roof);
  VCH_NORD_group.add(root);
  const ph = new Et({ mass: 0, type: Et.STATIC, position: new w(cx, gy + r + 0.18, cz) });
  ph.quaternion.setFromEuler(0, yaw, 0);
  ph.addShape(new ns(new w(len * 0.55, r + 0.5, r * 1.05)));
  ph.collisionFilterGroup = is;
  ph.collisionFilterMask = 7 | VCH_RAMP;
  physics.addBody(ph);
  const rec = { mesh: root, body: ph, hp: 9, destructible: true, kind: "tank", dynamic: false, alive: true };
  root.userData.prop = rec;
  VCH_NORD_recs.push(rec);
  return root;
}
function VCH_NORD_bund(physics, cx, cz, gy, w = 6.6, d = 6.6, h = 0.9){
  const M = VCH_NORD_materials();
  const recs = [];
  const segs = [
    [-w * 0.5, 0, w + 0.14, d * 0.5], [w * 0.5, 0, w + 0.14, d * 0.5],
    [0, -d * 0.5, w * 0.5, d + 0.14], [0, d * 0.5, w * 0.5, d + 0.14]
  ];
  for(const [lx, lz, sw, sd] of segs){
    const rec = VCH_NORD_staticBox(physics, sw, h, sd, M.concreteDark,
      cx + lx, gy + h * 0.5, cz + lz, 0);
    recs.push(rec);
  }
  return recs;
}
function VCH_NORD_pipeRun(physics, points, r = 0.16){
  const M = VCH_NORD_materials();
  const recs = [];
  for(let i = 0; i < points.length - 1; i++){
    const [x0, z0] = points[i], [x1, z1] = points[i + 1];
    const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz) || 0.1;
    const yaw = Math.atan2(dx, dz);
    const mx = (x0 + x1) * 0.5, mz = (z0 + z1) * 0.5;
    const my = ge(mx, mz);
    const pipe = new Lt(new mn(r, r, len, 8), M.steelBright);
    pipe.position.set(mx, my + r, mz);
    pipe.rotation.y = yaw;
    pipe.castShadow = true; pipe.receiveShadow = true;
    VCH_NORD_group.add(pipe);
    const body = new Et({ mass: 0, type: Et.STATIC, position: new w(mx, my + r, mz) });
    body.quaternion.setFromEuler(0, yaw, 0);
    body.addShape(new ns(new w(len * 0.5, r, r)));
    body.collisionFilterGroup = is;
    body.collisionFilterMask = 7 | VCH_RAMP;
    physics.addBody(body);
    recs.push({ mesh: pipe, body, hp: 999, destructible: false, kind: "pipe", dynamic: false, alive: true });
  }
  return recs;
}
function VCH_NORD_snowdrift(physics, x, z, r = 2.2, h = 0.55){
  const M = VCH_NORD_materials();
  const gy = ge(x, z);
  const drift = new Lt(new Sa(r, 8, 6), M.snowPure);
  drift.position.set(x, gy + h * 0.45, z);
  drift.scale.set(1, h / r, 1);
  drift.castShadow = true; drift.receiveShadow = true;
  VCH_NORD_group.add(drift);
  const body = new Et({ mass: 0, type: Et.STATIC, position: new w(x, gy + h * 0.45, z) });
  body.addShape(new ns(new w(r, h * 0.45, r)));
  body.collisionFilterGroup = is;
  body.collisionFilterMask = 7 | VCH_RAMP;
  physics.addBody(body);
  const rec = { mesh: drift, body, hp: 999, destructible: false, kind: "snowdrift", dynamic: false, alive: true };
  drift.userData.prop = rec;
  VCH_NORD_recs.push(rec);
  return rec;
}
function VCH_NORD_pillbox(physics, cx, cz, gy, yaw = 0, r = 3.4){
  const M = VCH_NORD_materials();
  const root = new Jt();
  root.position.set(cx, gy, cz);
  root.rotation.y = yaw;
  const wall = new Lt(new _e(r * 2, 2.6, r * 2), M.concrete);
  wall.position.y = 1.3;
  wall.castShadow = true; wall.receiveShadow = true;
  root.add(wall);
  const roof = new Lt(new _e(r * 2 + 0.5, 0.3, r * 2 + 0.5), M.concreteDark);
  roof.position.y = 2.8;
  roof.castShadow = true;
  root.add(roof);
  for(const s of [-1, 1]){
    const embr = new Lt(new _e(0.5, 0.5, 0.5), M.steel);
    embr.position.set(s * (r - 0.28), 1.35, 0);
    embr.rotation.y = s > 0 ? 0 : Math.PI;
    embr.castShadow = true;
    root.add(embr);
    const embr2 = new Lt(new _e(0.5, 0.5, 0.5), M.steel);
    embr2.position.set(0, 1.35, s * (r - 0.28));
    embr2.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
    embr2.castShadow = true;
    root.add(embr2);
  }
  VCH_NORD_group.add(root);
  const b = new Et({ mass: 0, type: Et.STATIC, position: new w(cx, gy + 1.3, cz) });
  b.quaternion.setFromEuler(0, yaw, 0);
  b.addShape(new ns(new w(r, 1.3, r)));
  b.collisionFilterGroup = is;
  b.collisionFilterMask = 7 | VCH_RAMP;
  physics.addBody(b);
  const rec = { mesh: root, body: b, hp: 12, destructible: true, kind: "pillbox", dynamic: false, alive: true };
  root.userData.prop = rec;
  VCH_NORD_recs.push(rec);
  return rec;
}
function VCH_NORD_girder(cx, cz, gy, len = 10, h = 1.6, yaw = 0){
  const M = VCH_NORD_materials();
  const root = new Jt();
  root.position.set(cx, gy, cz);
  root.rotation.y = yaw;
  const fb = 0.16;
  const hs = h * 0.5;
  for(const s of [-1, 1]){
    const col = new Lt(new _e(fb, h, fb), M.steel);
    col.position.set(s * 1.9, hs, 0);
    col.castShadow = true;
    root.add(col);
  }
  const top = new Lt(new _e(len, fb, fb), M.steel);
  top.position.set(0, hs, 0);
  top.castShadow = true;
  root.add(top);
  const bot = new Lt(new _e(len, fb, fb), M.steel);
  bot.position.set(0, -hs, 0);
  bot.castShadow = true;
  root.add(bot);
  const diag = new mn(fb, fb, Math.hypot(len, h) * 1.02, 6);
  const d1 = new Lt(diag, M.steel); d1.position.set(0, 0, -len * 0.42); d1.rotation.z = Math.atan2(h, len);
  d1.castShadow = true; root.add(d1);
  const d2 = new Lt(diag, M.steel); d2.position.set(0, 0, len * 0.42); d2.rotation.z = -Math.atan2(h, len);
  d2.castShadow = true; root.add(d2);
  VCH_NORD_group.add(root);
  return root;
}

/* ---- 4. Ландшафт, лёд без лесенок и архитектурные комплексы ---------- */
function VCH_NORD_terrain(scene){
  const M = VCH_NORD_materials();
  const g = new Di(480, 480, 200, 200);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const c = new Ft(), nv = new P();

  for(let i = 0; i < pos.count; i++){
    const x = pos.getX(i), z = pos.getZ(i);
    const h = ge(x, z);
    pos.setY(i, h);
    Hw(x, z, nv);

    const roadNS = Math.exp(-Math.pow(x / 6.5, 2)) * VCH_NORD_boxMask(x, z, 0, -24, 9, 44, 10);
    const roadEW = Math.exp(-Math.pow((z - 4) / 7.5, 2)) * VCH_NORD_boxMask(x, z, 0, 4, 58, 12, 12);
    const track = Math.min(1, roadNS + roadEW);

    const slope = Te.smoothstep(nv.y, 0.94, 0.78);
    const rockMask = Math.min(1, slope * 0.92 + Te.smoothstep(h, 8.5, 24.0) * 0.65);
    const bank = Te.smoothstep(-h, 0.25, 1.40);

    /* сдержанный базовый тон снега, чтобы даже на солнечных склонах не выбивало в bloom */
    c.setRGB(0.65, 0.72, 0.80);
    if(track > 0.01) c.lerp(new Ft(0.43, 0.46, 0.52), track * 0.72);
    if(bank > 0.01)  c.lerp(new Ft(0.36, 0.41, 0.47), bank * 0.70);
    if(rockMask > 0.01) c.lerp(new Ft(0.30, 0.34, 0.40), rockMask);

    col[i * 3] = c.r;
    col[i * 3 + 1] = c.g;
    col[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new Ve(col, 3));
  g.computeVertexNormals();
  const nm = g.attributes.normal;
  for(let i = 0; i < pos.count; i++){
    Hw(pos.getX(i), pos.getZ(i), nv);
    nm.setXYZ(i, nv.x, nv.y, nv.z);
  }
  nm.needsUpdate = true;

  const mesh = new Lt(g, M.snow);
  mesh.receiveShadow = true;
  scene.add(mesh);

  /* гладкая ледяная поверхность в русле восточнее ВПП */
  const iceGeo = new Di(208, 60, 88, 22);
  iceGeo.rotateX(-Math.PI / 2);
  const ipos = iceGeo.attributes.position;
  for(let i = 0; i < ipos.count; i++){
    const ix = ipos.getX(i) + 40, iz = ipos.getZ(i);
    ipos.setX(i, ix);
    ipos.setZ(i, iz + VCH_NORD_riverZ(ix));
  }
  iceGeo.computeVertexNormals();
  const ice = new Lt(iceGeo, M.ice);
  ice.position.set(0, -1.45, 0);
  ice.receiveShadow = true;
  VCH_NORD_group.add(ice);

  return mesh;
}

function VCH_NORD_airstrip(){
  const M = VCH_NORD_materials();
  const rw = new Lt(new Di(22, 196, 1, 1), M.runway);
  rw.rotation.x = -Math.PI / 2;
  rw.position.set(-80, 0.068, 0);
  rw.receiveShadow = true;
  VCH_NORD_group.add(rw);

  const tx = new Lt(new Di(44, 12, 1, 1), M.taxi);
  tx.rotation.x = -Math.PI / 2;
  tx.position.set(-48, 0.048, 2);
  tx.receiveShadow = true;
  VCH_NORD_group.add(tx);

  const ap = new Lt(new Di(48, 42, 1, 1), M.apron);
  ap.rotation.x = -Math.PI / 2;
  ap.position.set(0, 0.015, 10);
  ap.receiveShadow = true;
  VCH_NORD_group.add(ap);

  const hp = new Lt(new Di(16, 16, 1, 1), M.helipad);
  hp.rotation.x = -Math.PI / 2;
  hp.position.set(-32, 0.046, -4);
  hp.receiveShadow = true;
  VCH_NORD_group.add(hp);

  /* Ветроуказатель */
  const poleX = -22, poleZ = -13, gy = ge(poleX, poleZ);
  VCH_NORD_mesh(new mn(0.08, 0.11, 5.2, 8), M.steelBright, poleX, gy + 2.6, poleZ);
  const sockPivot = new Jt();
  sockPivot.position.set(poleX, gy + 5.1, poleZ);
  const s1 = new Lt(new mn(0.32, 0.18, 0.75, 10), M.barrel);
  s1.rotation.z = Math.PI / 2; s1.position.x = 0.55;
  const s2 = new Lt(new mn(0.18, 0.11, 0.65, 10), M.snowPure);
  s2.rotation.z = Math.PI / 2; s2.position.x = 1.25;
  sockPivot.add(s1, s2);
  VCH_NORD_group.add(sockPivot);
  VCH_NORD_anim.windsock = sockPivot;

  /* Рулёжные огни ВПП и вертолётной площадки */
  const lampPts = [];
  for(let z = -92; z <= 92; z += 18.4){
    lampPts.push([-91.4, ge(-91.4, z) + 0.18, z]);
    lampPts.push([-68.6, ge(-68.6, z) + 0.18, z]);
  }
  for(const [hx, hz] of [[-40, -12], [-24, -12], [-40, 4], [-24, 4]]){
    lampPts.push([hx, ge(hx, hz) + 0.18, hz]);
  }
  const baseInst = new xa(new mn(0.14, 0.18, 0.24, 8), M.steel, lampPts.length);
  const bulbInst = new xa(new Sa(0.12, 8, 6), M.lampAmber, lampPts.length);
  const dm = new ue();
  lampPts.forEach((p, idx) => {
    dm.position.set(p[0], p[1] - 0.08, p[2]);
    dm.updateMatrix();
    baseInst.setMatrixAt(idx, dm.matrix);
    dm.position.set(p[0], p[1] + 0.08, p[2]);
    dm.updateMatrix();
    bulbInst.setMatrixAt(idx, dm.matrix);
  });
  baseInst.instanceMatrix.needsUpdate = true;
  bulbInst.instanceMatrix.needsUpdate = true;
  VCH_NORD_group.add(baseInst, bulbInst);
}

function VCH_NORD_hangar(physics, cx, cz){
  const M = VCH_NORD_materials();
  const gy = ge(cx, cz);
  const L = 24, W = 15, H = 6.2;

  const floor = new Lt(new Di(W - 0.6, L + 2, 1, 1), M.apron);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, gy + 0.02, cz);
  floor.receiveShadow = true;
  VCH_NORD_group.add(floor);

  for(const sx of [-1, 1]){
    const wx = cx + sx * (W * 0.5 - 1.1);
    VCH_NORD_staticBox(physics, 2.2, 4.2, L, M.concrete, wx, gy + 2.1, cz);
    for(let kz = -9; kz <= 9; kz += 6){
      VCH_NORD_staticBox(physics, 1.0, 3.4, 0.9, M.concreteDark, wx + sx * 1.35, gy + 1.7, cz + kz);
    }
    for(const sz of [-1, 1]){
      VCH_NORD_mesh(new _e(0.45, 4.3, 0.6), M.warnYellow, wx - sx * 1.15, gy + 2.15, cz + sz * (L * 0.5 - 0.35));
    }
  }
  for(const sz of [-1, 1]){
    const dz = cz + sz * (L * 0.5 - 0.55);
    VCH_NORD_staticBox(physics, 1.6, 3.6, 1.1, M.concreteDark, cx - (W * 0.5 - 1.3), gy + 1.78, dz);
    VCH_NORD_staticBox(physics, 1.6, 3.6, 1.1, M.concreteDark, cx + (W * 0.5 - 1.3), gy + 1.78, dz);
    VCH_NORD_mesh(new _e(1.9, 0.14, 1.4), M.warnYellow, cx, gy + 3.45, dz);
  }

  VCH_NORD_staticBox(physics, W + 0.6, 0.9, L + 0.8, M.hangar, cx, gy + H - 0.35, cz);
  VCH_NORD_mesh(new _e(W - 3.6, 0.7, L + 0.4), M.hangar, cx, gy + H + 0.45, cz);
  VCH_NORD_mesh(new _e(W - 4.0, 0.28, L - 0.8), M.snowPure, cx, gy + H + 0.92, cz);
  for(let kz = -6; kz <= 6; kz += 6){
    VCH_NORD_mesh(new mn(0.45, 0.62, 0.9, 10), M.steel, cx, gy + H + 1.35, cz + kz);
  }
  for(const sz of [-1, 1]){
    const dz = cz + sz * (L * 0.5 - 1.15);
    VCH_NORD_staticBox(physics, W - 1.2, 4.6, 0.22, M.hangar, cx, gy + 2.3, dz, 0);
    VCH_NORD_mesh(new _e(W - 1.4, 0.12, 0.28), M.warnYellow, cx, gy + 4.5, dz);
  }

  const sTx = cx + (W * 0.5 - 1.05), sTz = cz - (L * 0.5 - 1.05);
  const sGy = ge(sTx, sTz);
  VCH_NORD_staticBox(physics, 1.1, 3.4, 1.1, M.concreteDark, sTx, sGy + 1.7, sTz);
  VCH_NORD_mesh(new _e(1.4, 0.16, 1.4), M.warnYellow, sTx, sGy + 3.48, sTz);
  const siren = new Lt(new Sa(0.55, 10, 8), M.lampRed);
  siren.position.set(sTx, sGy + 3.66, sTz);
  siren.castShadow = true;
  VCH_NORD_group.add(siren);
  const sLight = new Ql(0xff4a3a, 14, 16, 1.2);
  sLight.position.set(sTx, sGy + 3.7, sTz);
  VCH_NORD_group.add(sLight);

  for(const ox of [-3.6, 0, 3.6]){
    VCH_NORD_staticBox(physics, 0.6, 5.9, 0.6, M.concreteDark, cx + ox, gy + 2.95, cz);
  }

  const hLight = new Ql(0xffc982, 26, 30, 1.8);
  hLight.position.set(cx, gy + 4.9, cz);
  VCH_NORD_group.add(hLight);
  for(const kz of [-6, 6]){
    VCH_NORD_mesh(new _e(2.4, 0.16, 0.45), M.lampAmber, cx, gy + H - 0.88, cz + kz);
  }

  VCH_NORD_snowdrift(physics, cx - (W * 0.5 - 1.4), cz - (L * 0.5 - 1.6));
  VCH_NORD_snowdrift(physics, cx + (W * 0.5 - 1.4), cz + (L * 0.5 - 1.6));

  for(const zOff of [-7, 1, 7]){
    const cr = new Lt(new _e(0.95, 0.95, 0.95), M.wood);
    cr.castShadow = true; cr.receiveShadow = true;
    VCH_NORD_prop(physics, cr, cx - 4.2, cz + zOff, zOff * 0.2, { hp: 0.45, kind: "crate", mass: 26 });
  }
  for(const zOff of [-5, 4]){
    const br = new Lt(new mn(0.35, 0.35, 0.98, 12), M.barrel);
    br.castShadow = true; br.receiveShadow = true;
    VCH_NORD_prop(physics, br, cx + 4.3, cz + zOff, 0.4, { hp: 2.0, kind: "barrel", mass: 85 });
  }
  const wb = new Lt(new _e(1.6, 0.9, 0.5), M.wood);
  wb.position.set(cx - 5.4, gy + 0.48, cz + 2);
  wb.castShadow = true; wb.receiveShadow = true;
  VCH_NORD_prop(physics, wb, cx - 5.4, cz + 2, 0.1, { hp: 0.5, kind: "crate", mass: 18 });
}

function VCH_NORD_tower(physics, x, z){
  const M = VCH_NORD_materials();
  const gy = ge(x, z);

  VCH_NORD_staticBox(physics, 8.4, 4.2, 8.4, M.concrete, x, gy + 2.0, z);
  VCH_NORD_staticBox(physics, 3.2, 2.8, 2.4, M.concreteDark, x + 5.1, gy + 1.4, z);
  for(const sz of [-1, 1]){
    VCH_NORD_staticBox(physics, 1.0, 3.4, 1.0, M.concreteDark, x + sz * 3.35, gy + 1.9, z);
    VCH_NORD_mesh(new _e(1.2, 0.14, 1.2), M.warnYellow, x + sz * 3.35, gy + 3.6, z);
  }
  VCH_NORD_staticBox(physics, 7.6, 0.45, 7.6, M.steel, x, gy + 9.6, z);
  VCH_NORD_mesh(new _e(7.4, 0.08, 0.08), M.warnYellow, x, gy + 10.05, z + 3.65);
  VCH_NORD_mesh(new _e(7.4, 0.08, 0.08), M.warnYellow, x, gy + 10.05, z - 3.65);
  VCH_NORD_mesh(new _e(0.08, 0.08, 7.4), M.warnYellow, x + 3.65, gy + 10.05, z);
  VCH_NORD_mesh(new _e(0.08, 0.08, 7.4), M.warnYellow, x - 3.65, gy + 10.05, z);
  VCH_NORD_staticBox(physics, 5.4, 2.8, 5.4, M.glass, x, gy + 10.5, z);
  VCH_NORD_staticBox(physics, 6.4, 0.45, 6.4, M.steel, x, gy + 13.1, z);
  VCH_NORD_mesh(new _e(5.8, 0.22, 5.8), M.snowPure, x, gy + 13.42, z);

  VCH_NORD_latticeTower(x, z, gy + 13.55, 6.4, 1.05);
  VCH_NORD_radome(x, z, gy + 13.55 + 6.4, 2.5, 0.05);

  for(const [dx, dz] of [[3.6, 3.6], [3.6, -3.6], [-3.6, 3.6], [-3.6, -3.6]]){
    const dGy = ge(x + dx, z + dz);
    VCH_NORD_staticBox(physics, 1.6, 1.4, 1.6, M.concreteDark, x + dx, dGy + 0.5, z + dz);
    VCH_NORD_mesh(new Sa(0.95, 10, 8), M.snowPure, x + dx, dGy + 0.5 + 0.95, z + dz);
  }

  const beacon = new Jt();
  beacon.position.set(x + 1.4, gy + 13.45, z + 1.4);
  beacon.add(new Lt(new mn(0.24, 0.24, 0.42, 10), M.lampRed));
  const beam = new Lt(new _e(1.2, 0.18, 0.18), M.lampRed);
  beam.position.x = 0.6;
  beacon.add(beam);
  VCH_NORD_group.add(beacon);
  VCH_NORD_anim.beacon = beacon;

  VCH_NORD_snowdrift(physics, x - 4.6, z - 4.6);
}

function VCH_NORD_fuelDepot(physics, cx, cz){
  const M = VCH_NORD_materials();
  const gy = ge(cx, cz);

  VCH_NORD_staticBox(physics, 30, 1.0, 30, M.apron, cx, gy + 0.02, cz);
  const pads = [[-8, -8], [8, -8], [-8, 8], [8, 8]];
  const tankRecs = [];
  for(const [dx, dz] of pads){
    const tx = cx + dx, tz = cz + dz;
    const tgy = ge(tx, tz);
    tankRecs.push(VCH_NORD_fuelTank(physics, tx, tz, tgy, 1.35, 8.6, Math.PI / 4));
  }
  const bundRecs = [];
  for(const [dx, dz] of pads){
    const tx = cx + dx, tz = cz + dz;
    const tgy = ge(tx, tz);
    bundRecs.push(VCH_NORD_bund(physics, tx, tz, tgy, 6.6, 6.6, 0.9));
  }
  const pipePoints = [
    [cx - 4, cz - 14], [cx - 4, cz - 6],
    [cx - 10, cz - 6], [cx - 10, cz],
    [cx + 4, cz], [cx + 4, cz + 12]
  ];
  const pipeRecs = VCH_NORD_pipeRun(physics, pipePoints, 0.16);

  VCH_NORD_staticBox(physics, 5.2, 2.6, 5.2, M.concreteDark, cx - 11, gy + 1.2, cz + 1);
  VCH_NORD_mesh(new mn(0.22, 2.4, 0.22, 10), M.steel, cx - 11, gy + 1.2 + 1.2, cz + 1);
  VCH_NORD_mesh(new _e(1.6, 0.14, 1.6), M.warnYellow, cx - 11, gy + 3.68, cz + 1);
  const pLight = new Ql(0xffd166, 18, 22, 1.4);
  pLight.position.set(cx - 11, gy + 3.7, cz + 1);
  VCH_NORD_group.add(pLight);

  for(let bi = 0; bi < 9; bi++){
    const bx = cx - 10 + (bi % 3) * 1.4, bz = cz - 12 + Math.floor(bi / 3) * 1.4;
    const bgy = ge(bx, bz);
    const br = new Lt(new mn(0.35, 0.35, 0.98, 12), M.barrel);
    br.position.set(bx, bgy + 0.49, bz);
    br.castShadow = true; br.receiveShadow = true;
    VCH_NORD_group.add(br);
    VCH_NORD_prop(physics, br, bx, bz, 0, { hp: 2.0, kind: "barrel", mass: 85 });
  }

  VCH_NORD_snowdrift(physics, cx - 14, cz - 14);
  VCH_NORD_snowdrift(physics, cx + 14, cz + 14);
}

function VCH_NORD_radarStation(physics, cx, cz){
  const M = VCH_NORD_materials();
  const gy = ge(cx, cz);

  VCH_NORD_staticBox(physics, 12.5, 3.2, 12.5, M.concrete, cx, gy + 0.55, cz);
  VCH_NORD_staticBox(physics, 6.2, 4.2, 6.2, M.concreteDark, cx, gy + 3.45, cz);
  VCH_NORD_mesh(new mn(0.2, 3.2, 0.2, 10), M.steel, cx - 2.7, gy + 3.45 + 1.6, cz - 2.7);
  VCH_NORD_mesh(new mn(0.2, 3.2, 0.2, 10), M.steel, cx + 2.7, gy + 3.45 + 1.6, cz - 2.7);
  VCH_NORD_mesh(new mn(0.2, 3.2, 0.2, 10), M.steel, cx - 2.7, gy + 3.45 + 1.6, cz + 2.7);
  VCH_NORD_mesh(new mn(0.2, 3.2, 0.2, 10), M.steel, cx + 2.7, gy + 3.45 + 1.6, cz + 2.7);
  VCH_NORD_mesh(new _e(5.8, 0.14, 5.8), M.warnYellow, cx, gy + 7.75, cz);

  VCH_NORD_latticeTower(cx, cz, gy + 8.0, 7.2, 1.1);
  VCH_NORD_radome(cx, cz, gy + 8.0 + 7.2, 2.7, 0.05);

  const comm = new Jt();
  comm.position.set(cx - 3.4, gy + 7.9, cz - 3.4);
  comm.add(new Lt(new Sa(1.1, 10, 8), M.snowPure));
  comm.add(new Lt(new mn(0.16, 2.2, 0.16, 10), M.steel));
  VCH_NORD_group.add(comm);
  const comm2 = new Jt();
  comm2.position.set(cx + 3.4, gy + 7.9, cz + 3.4);
  comm2.add(new Lt(new Sa(0.95, 10, 8), M.snowPure));
  comm2.add(new Lt(new mn(0.16, 1.9, 0.16, 10), M.steel));
  VCH_NORD_group.add(comm2);

  for(const [dx, dz] of [[-5.6, -5.6], [5.6, -5.6], [-5.6, 5.6], [5.6, 5.6]]){
    const dGy = ge(cx + dx, cz + dz);
    VCH_NORD_staticBox(physics, 1.4, 1.2, 1.4, M.concreteDark, cx + dx, dGy + 0.5, cz + dz);
    VCH_NORD_mesh(new Sa(0.85, 10, 8), M.snowPure, cx + dx, dGy + 0.5 + 0.85, cz + dz);
  }

  const rLight = new Ql(0x4aa3ff, 22, 26, 1.5);
  rLight.position.set(cx, gy + 9.5, cz);
  VCH_NORD_group.add(rLight);

  VCH_NORD_snowdrift(physics, cx - 7.4, cz - 7.4);
  VCH_NORD_snowdrift(physics, cx + 7.4, cz + 7.4);
}

function VCH_NORD_bridge(physics){
  const M = VCH_NORD_materials();
  const bx = 0, bz = -66;
  const deckY = 0.58;
  const L = 24, W = 10;

  VCH_NORD_staticBox(physics, L + 4, 0.5, W + 4, M.apron, bx, deckY - 0.28, bz);
  VCH_NORD_girder(bx - W * 0.5 - 1.6, bz, deckY + 0.1, L + 3.2, 1.6, 0);
  VCH_NORD_girder(bx + W * 0.5 + 1.6, bz, deckY + 0.1, L + 3.2, 1.6, 0);
  VCH_NORD_girder(bx, bz - L * 0.5 - 1.6, deckY + 0.1, W + 3.2, 1.6, Math.PI / 2);
  VCH_NORD_girder(bx, bz + L * 0.5 + 1.6, deckY + 0.1, W + 3.2, 1.6, Math.PI / 2);

  VCH_NORD_staticBox(physics, W + 2, 0.3, L + 2, M.steel, bx, deckY + 0.22, bz);
  VCH_NORD_mesh(new _e(W, 0.06, L), M.snowPure, bx, deckY + 0.6, bz);

  for(const [dx, dz] of [[-W * 0.5 - 0.9, -L * 0.5 - 0.9], [W * 0.5 + 0.9, -L * 0.5 - 0.9], [-W * 0.5 - 0.9, L * 0.5 + 0.9], [W * 0.5 + 0.9, L * 0.5 + 0.9]]){
    const pGy = ge(bx + dx, bz + dz);
    VCH_NORD_staticBox(physics, 0.7, 2.2, 0.7, M.steel, bx + dx, pGy + 1.1, bz + dz);
    VCH_NORD_mesh(new _e(0.95, 0.12, 0.95), M.warnYellow, bx + dx, pGy + 2.32, bz + dz);
  }

  for(const s of [-1, 1]){
    VCH_NORD_staticBox(physics, 0.14, 0.9, L + 1.4, M.steelBright, bx + s * (W * 0.5 + 0.14), deckY + 0.9, bz);
    VCH_NORD_mesh(new _e(L + 1.4, 0.08, 0.14), M.steelBright, bx + s * (W * 0.5 + 0.28), deckY + 1.45, bz);
  }
  for(const s of [-1, 1]){
    VCH_NORD_staticBox(physics, W + 1.4, 0.9, 0.14, M.steelBright, bx, deckY + 0.9, bz + s * (L * 0.5 + 0.14));
    VCH_NORD_mesh(new _e(0.14, 0.08, W + 1.4), M.steelBright, bx, deckY + 1.45, bz + s * (L * 0.5 + 0.28));
  }

  for(const s of [-1, 1]){
    const ibx = bx + s * (W * 0.5 - 0.5);
    const ibz = bz - L * 0.5 - 4.2;
    const ibGy = ge(ibx, ibz);
    VCH_NORD_staticBox(physics, 1.4, 3.2, 1.4, M.concreteDark, ibx, ibGy + 1.6, ibz);
    VCH_NORD_mesh(new _e(1.6, 0.14, 1.6), M.warnYellow, ibx, ibGy + 3.34, ibz);
  }

  VCH_NORD_snowdrift(physics, bx - W * 0.5 - 3.2, bz - L * 0.5 - 3.2);
  VCH_NORD_snowdrift(physics, bx + W * 0.5 + 3.2, bz + L * 0.5 + 3.2);
}

function VCH_NORD_overpass(physics){
  const M = VCH_NORD_materials();
  const ox = -28, oz = -34;
  const deckY = 0.45;
  const L = 16, W = 8;

  VCH_NORD_staticBox(physics, L + 3, 0.5, W + 3, M.apron, ox, deckY - 0.28, oz);
  VCH_NORD_girder(ox - W * 0.5 - 1.4, oz, deckY + 0.1, L + 2.8, 1.4, 0);
  VCH_NORD_girder(ox + W * 0.5 + 1.4, oz, deckY + 0.1, L + 2.8, 1.4, 0);
  VCH_NORD_girder(ox, oz - L * 0.5 - 1.4, deckY + 0.1, W + 2.8, 1.4, Math.PI / 2);
  VCH_NORD_girder(ox, oz + L * 0.5 + 1.4, deckY + 0.1, W + 2.8, 1.4, Math.PI / 2);

  VCH_NORD_staticBox(physics, W + 1.5, 0.25, L + 1.5, M.steel, ox, deckY + 0.2, oz);
  VCH_NORD_mesh(new _e(W, 0.05, L), M.snowPure, ox, deckY + 0.55, oz);

  for(const s of [-1, 1]){
    VCH_NORD_staticBox(physics, 0.12, 0.8, L + 1.2, M.steelBright, ox + s * (W * 0.5 + 0.12), deckY + 0.85, oz);
    VCH_NORD_mesh(new _e(L + 1.2, 0.06, 0.12), M.steelBright, ox + s * (W * 0.5 + 0.26), deckY + 1.35, oz);
  }
  for(const s of [-1, 1]){
    VCH_NORD_staticBox(physics, W + 1.2, 0.8, 0.12, M.steelBright, ox, deckY + 0.85, oz + s * (L * 0.5 + 0.12));
    VCH_NORD_mesh(new _e(0.12, 0.06, W + 1.2), M.steelBright, ox, deckY + 1.35, oz + s * (L * 0.5 + 0.26));
  }

  // Ramp railings at near side
  for(const s of [-1, 1]){
    const rz = oz + L * 0.5 + 1.6;
    VCH_NORD_staticBox(physics, W + 1.2, 0.5, 0.12, M.steelBright, ox, deckY + 0.8, rz);
    VCH_NORD_mesh(new _e(0.12, 0.06, W + 1.2), M.steelBright, ox, deckY + 1.15, rz);
  }

  VCH_NORD_snowdrift(physics, ox - W * 0.5 - 2.6, oz - L * 0.5 - 2.6);
  VCH_NORD_snowdrift(physics, ox + W * 0.5 + 2.6, oz + L * 0.5 + 2.6);
}

/* Входные ворота огневого рубежа (z = 77, за мишенями — красиво обрамляют линию старта) */
function VCH_NORD_rangeArch(physics){
  const M = VCH_NORD_materials();
  const z = 77;

  for(const sx of [-1, 1]){
    const px = sx * 16, gy = ge(px, z);
    VCH_NORD_staticBox(physics, 1.4, 6.2, 1.4, M.concreteDark, px, gy + 3.0, z);
    VCH_NORD_mesh(new _e(1.6, 1.1, 1.6), M.warnYellow, px, gy + 1.0, z);
    VCH_NORD_staticBox(physics, 1.4, 0.5, 1.4, M.steel, px, gy + 6.45, z);
    VCH_NORD_mesh(new _e(1.8, 0.1, 1.8), M.warnYellow, px, gy + 6.7, z);
  }

  const topY = Math.max(ge(-16, z), ge(16, z)) + 6.4;
  VCH_NORD_staticBox(physics, 34, 0.5, 1.6, M.steel, 0, topY + 0.25, z);
  VCH_NORD_mesh(new _e(34, 0.08, 0.08), M.warnYellow, 0, topY + 0.72, z);
  VCH_NORD_mesh(new _e(34, 0.08, 0.08), M.warnYellow, 0, topY - 0.2, z);
  VCH_NORD_staticBox(physics, 0.5, 6.4, 1.6, M.steel, -17, topY - 3.0, z);
  VCH_NORD_staticBox(physics, 0.5, 6.4, 1.6, M.steel, 17, topY - 3.0, z);

  for(const kx of [-12, 0, 12]){
    const lGy = ge(kx, z - 2);
    VCH_NORD_mesh(new mn(0.14, 0.14, 1.2, 6), M.steel, kx, lGy + 0.6, z - 2);
  }

  const archLight = new Ql(0xffd166, 20, 24, 1.5);
  archLight.position.set(0, topY + 1.0, z);
  VCH_NORD_group.add(archLight);

  VCH_NORD_snowdrift(physics, -18, z - 4);
  VCH_NORD_snowdrift(physics, 18, z - 4);
}

function VCH_NORD_bunkers(physics){
  const M = VCH_NORD_materials();

  // Caponier / pillbox emplacements along the forward ridge
  for(const [px, pz, yaw] of [[-40, 30, 0], [40, 30, Math.PI], [-30, -20, Math.PI / 2], [30, -20, -Math.PI / 2]]){
    const pGy = ge(px, pz);
    VCH_NORD_pillbox(physics, px, pz, pGy, yaw, 3.4);
    VCH_NORD_snowdrift(physics, px - 4, pz - 4);
    VCH_NORD_snowdrift(physics, px + 4, pz + 4);
  }

  // Sandbag revetments at bunker entrances
  for(const [px, pz] of [[-40, 26], [40, 26], [-26, -24], [26, -24]]){
    const pGy = ge(px, pz);
    for(const s of [-1, 1]){
      VCH_NORD_staticBox(physics, 1.6, 0.5, 0.5, M.concreteDark, px + s * 0.9, pGy + 0.28, pz);
      VCH_NORD_staticBox(physics, 0.5, 0.5, 1.6, M.concreteDark, px, pGy + 0.28, pz + s * 0.9);
    }
  }

  // Wedge firing positions (existing, upgraded)
  for(const [wx, wz, wyaw, ww, wlen, wH] of [
    [-60, 0, 0, 6, 14, 2.2], [60, 0, Math.PI, 6, 14, 2.2],
    [0, -55, Math.PI / 2, 6, 14, 2.2], [0, 55, -Math.PI / 2, 6, 14, 2.2]
  ]){
    const wGy = ge(wx, wz);
    VCH_NORD_wedge(physics, wx, wz, wyaw, ww, wlen, wH, wGy);
    VCH_NORD_mesh(new _e(0.5, 0.5, 0.5), M.warnYellow, wx, wGy + wH + 0.3, wz);
  }

  VCH_NORD_snowdrift(physics, -50, 10);
  VCH_NORD_snowdrift(physics, 50, -10);
}


function VCH_NORD_isClear(x, z, pad = 6){
  if(Math.hypot(x, z) < 20 || Math.hypot(x - 12, z) < 16) return false;
  if(x > -98 - pad && x < -62 + pad && Math.abs(z) < 105 + pad) return false;
  if(x > -72 && x < -20 && Math.abs(z - 2) < 15 + pad) return false;
  if(Math.abs(x) < 42 + pad && z > 18 && z < 82 + pad) return false;
  const keepouts = [
    [48, 6, 17], [-54, 24, 12], [56, -32, 16], [56, 52, 15],
    [0, -66, 22], [-28, -34, 20], [-32, -4, 13]
  ];
  for(const [kx, kz, r] of keepouts) if(Math.hypot(x - kx, z - kz) < r + pad) return false;
  for(let i = 0; i < 10; i++){
    const a = i / 10 * Math.PI * 2, rad = (i % 2) ? 96 : 78;
    if(Math.hypot(x - Math.cos(a) * rad, z - Math.sin(a) * rad) < 10 + pad) return false;
  }
  return true;
}

/* ---- 5. Природа: заснеженные ели, валуны и гранитные скальные массивы ---- */
function VCH_NORD_makeMountainGeo(){
  const g = new Sa(1.0, 10, 6);
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const c = new Ft();
  for(let i = 0; i < pos.count; i++){
    let vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
    const ang = Math.atan2(vz, vx);
    const hNorm = Math.max(0, (vy + 1.0) * 0.5);
    /* широкие альпийские скальные гряды с глубоким цоколем без висячих краёв */
    const taper = 1.32 - hNorm * 0.88;
    const jag = 0.80 + 0.22 * Math.sin(ang * 4.0 + vy * 2.8) + 0.14 * Math.cos(ang * 7.0 - vy * 2.2);
    vx *= taper * jag;
    vz *= taper * jag;
    vy = hNorm * 1.9 - 0.85 + (hNorm > 0.65 ? 0.14 * Math.cos(ang * 3) : 0);
    pos.setXYZ(i, vx, vy, vz);

    const snowK = Te.smoothstep(hNorm, 0.42, 0.78);
    c.setRGB(0.26, 0.30, 0.36).lerp(new Ft(0.62, 0.68, 0.76), snowK);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new Ve(col, 3));
  g.computeVertexNormals();
  return g;
}

function VCH_NORD_nature(){
  const M = VCH_NORD_materials();
  const rng = Vf(8821);

  /* 92 заснеженные ели (1 ствол + 3 яруса хвои + 3 аккуратных снежных слоя сверху) */
  const trees = [];
  for(let attempt = 0; attempt < 550 && trees.length < 92; attempt++){
    const a = rng() * Math.PI * 2;
    const d = 44 + rng() * 112;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if(!VCH_NORD_isClear(x, z, 5.5)) continue;
    const gy = ge(x, z);
    if(gy < -0.5) continue;
    trees.push({ x, y: gy, z, s: 0.78 + rng() * 0.75, yaw: rng() * Math.PI * 2 });
  }
  if(trees.length){
    const N = trees.length;
    const trunkG = new mn(0.16, 0.28, 2.2, 7);
    const tierG1 = new mn(0.05, 1.95, 2.7, 9), snowG1 = new mn(0.06, 1.62, 0.70, 9);
    const tierG2 = new mn(0.05, 1.52, 2.4, 9), snowG2 = new mn(0.06, 1.24, 0.65, 9);
    const tierG3 = new mn(0.03, 1.06, 2.2, 9), snowG3 = new mn(0.03, 0.82, 0.72, 9);
    const iTr = new xa(trunkG, M.bark, N);
    const iT1 = new xa(tierG1, M.pine, N), iS1 = new xa(snowG1, M.snowPure, N);
    const iT2 = new xa(tierG2, M.pine, N), iS2 = new xa(snowG2, M.snowPure, N);
    const iT3 = new xa(tierG3, M.pine, N), iS3 = new xa(snowG3, M.snowPure, N);
    for(const im of [iTr, iT1, iT2, iT3, iS1, iS2, iS3]){
      im.castShadow = true;
      im.receiveShadow = true;
      VCH_NORD_group.add(im);
    }
    const dm = new ue();
    trees.forEach((t, idx) => {
      const s = t.s;
      const set = (im, dy) => {
        dm.position.set(t.x, t.y + dy * s, t.z);
        dm.rotation.set(0, t.yaw, 0);
        dm.scale.setScalar(s);
        dm.updateMatrix();
        im.setMatrixAt(idx, dm.matrix);
      };
      set(iTr, 1.0);
      set(iT1, 2.45); set(iS1, 3.15);
      set(iT2, 4.05); set(iS2, 4.65);
      set(iT3, 5.45); set(iS3, 5.95);
    });
    for(const im of [iTr, iT1, iT2, iT3, iS1, iS2, iS3]) im.instanceMatrix.needsUpdate = true;
  }

  /* 68 гранитных заснеженных валунов */
  const rocks = [];
  for(let attempt = 0; attempt < 400 && rocks.length < 68; attempt++){
    const a = rng() * Math.PI * 2;
    const d = 38 + rng() * 110;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if(!VCH_NORD_isClear(x, z, 4)) continue;
    rocks.push({
      x, y: ge(x, z), z,
      sx: 0.9 + rng() * 1.8, sy: 0.55 + rng() * 0.95, sz: 0.8 + rng() * 1.6,
      yaw: rng() * 6.28
    });
  }
  if(rocks.length){
    const rGeo = new Sa(1.0, 7, 5);
    const iRk = new xa(rGeo, M.rock, rocks.length);
    const iSn = new xa(rGeo, M.snowPure, rocks.length);
    iRk.castShadow = true; iRk.receiveShadow = true;
    iSn.receiveShadow = true;
    const dm = new ue();
    rocks.forEach((rk, idx) => {
      dm.position.set(rk.x, rk.y + rk.sy * 0.25, rk.z);
      dm.rotation.set(0.15, rk.yaw, 0.1);
      dm.scale.set(rk.sx, rk.sy, rk.sz);
      dm.updateMatrix();
      iRk.setMatrixAt(idx, dm.matrix);

      dm.position.set(rk.x, rk.y + rk.sy * 0.42, rk.z);
      dm.scale.set(rk.sx * 0.85, rk.sy * 0.72, rk.sz * 0.85);
      dm.updateMatrix();
      iSn.setMatrixAt(idx, dm.matrix);
    });
    iRk.instanceMatrix.needsUpdate = true;
    iSn.instanceMatrix.needsUpdate = true;
    VCH_NORD_group.add(iRk, iSn);
  }

  /* Органические заснеженные скальные хребты по горизонту (глубоко посажены в хребет) */
  const mtnGeo = VCH_NORD_makeMountainGeo();
  const peaks = 26;
  const iMtn = new xa(mtnGeo, M.mountain, peaks);
  iMtn.receiveShadow = true;
  const dm = new ue();
  for(let i = 0; i < peaks; i++){
    const a = (i / peaks) * Math.PI * 2 + rng() * 0.14;
    const d = 186 + rng() * 50;
    const scXZ = 28 + rng() * 18;
    const scY = 14 + rng() * 14;
    const px = Math.cos(a) * d, pz = Math.sin(a) * d;
    const py = ge(px, pz) * 0.45 - 2.0;
    dm.position.set(px, py, pz);
    dm.rotation.set(0, rng() * 6.28, 0);
    dm.scale.set(scXZ * (1 + rng() * 0.4), scY, scXZ);
    dm.updateMatrix();
    iMtn.setMatrixAt(i, dm.matrix);
  }
  iMtn.instanceMatrix.needsUpdate = true;
  VCH_NORD_group.add(iMtn);
}

function VCH_NORD_tacticalProps(physics){
  const M = VCH_NORD_materials();

  VCH_NORD_wedge(physics,  26, -42,  0.35, 6.8, 10.5, 2.0);
  VCH_NORD_wedge(physics, -62, -20,  0.00, 6.4, 10.0, 1.85);
  VCH_NORD_wedge(physics,  18, -14, -0.35, 6.8, 10.5, 1.9);

  const putSign = (x, z, yaw, mat) => {
    const gy = ge(x, z);
    VCH_NORD_mesh(new mn(0.10, 0.12, 3.6, 8), M.steel, x, gy + 1.8, z);
    VCH_NORD_staticBox(physics, 3.2, 2.2, 0.22, mat, x, gy + 3.8, z, yaw);
  };
  putSign(-24,  15,  0.45, M.signRunway);
  putSign( 32, -20, -0.55, M.signFuel);
  putSign( 16,  24,  0.15, M.signRange);

  for(let i = 0; i < 6; i++){
    const nx = -42 + i * 3.4, nz = 78;
    const pyr = new Lt(new mn(0.18, 0.85, 1.45, 4), M.concreteDark);
    pyr.castShadow = true; pyr.receiveShadow = true;
    VCH_NORD_prop(physics, pyr, nx, nz, 0.78, { hp: 2.2, kind: "concrete", destructible: true });
  }

  for(const [mx, mz] of [[-52, -30], [34, 18], [46, -42]]){
    const gy = ge(mx, mz);
    VCH_NORD_staticBox(physics, 0.6, 10.5, 0.6, M.steel, mx, gy + 5.2, mz);
    VCH_NORD_mesh(new _e(2.4, 0.35, 0.4), M.steelBright, mx, gy + 10.5, mz);
    VCH_NORD_mesh(new _e(2.0, 0.5, 0.25), M.lampAmber, mx, gy + 10.2, mz + 0.25);
  }

  for(const [tx, tz, yaw] of [[-38, 44, 0.9], [36, -54, -0.8]]){
    const g = new Jt();
    const hull = new Lt(new _e(3.0, 1.0, 5.6), M.rust); hull.position.y = 0.8; g.add(hull);
    const tur = new Lt(new _e(2.2, 0.8, 2.7), M.rust); tur.position.set(0, 1.6, -0.2); tur.rotation.y = 0.4; g.add(tur);
    const brl = new Lt(new mn(0.12, 0.14, 3.6, 8), M.steel); brl.rotation.x = Math.PI / 2; brl.position.set(0.3, 1.75, 2.1); g.add(brl);
    g.traverse(o => { o.castShadow = true; o.receiveShadow = true; });
    VCH_NORD_prop(physics, g, tx, tz, yaw, { hp: 6, kind: "tank", destructible: true });
  }

  const crateSpots = [[-16, 18], [20, 12], [-18, -14], [14, -44], [-42, -8]];
  for(const [cx, cz] of crateSpots){
    for(let k = 0; k < 3; k++){
      const sz = 0.72 + (k % 2) * 0.16;
      const box = new Lt(new _e(sz, sz, sz), M.wood);
      box.castShadow = true; box.receiveShadow = true;
      VCH_NORD_prop(physics, box, cx + (k - 1) * 1.1, cz + (k % 2) * 0.8, k * 0.5,
        { hp: 0.45, kind: "crate", mass: 24, destructible: true });
    }
    const bar = new Lt(new mn(0.35, 0.35, 0.98, 12), M.barrel);
    bar.castShadow = true; bar.receiveShadow = true;
    VCH_NORD_prop(physics, bar, cx + 1.5, cz - 1.0, 0.2,
      { hp: 1.9, kind: "barrel", mass: 85, destructible: true });
  }
}


function VCH_NORD_auditPlacements(){
  if(!_VCH_NORD_physics) return;
  let issues = 0;
  VCH_NORD_group.traverse(o => {
    if(!o.userData.prop) return;
    const p = o.userData.prop;
    if(!p.body) return;
    const pos = p.body.position;
    const gy = ge(pos.x, pos.z);
    const below = gy - (pos.y - (p.mesh ? p.mesh.scale.y || 1 : 1) * 0.5);
    if(below > 0.3){
      issues++;
      p.body.position.y = gy + (p.mesh ? p.mesh.scale.y || 1 : 1) * 0.5;
      p.body.wakeUp();
    }
  });
  if(issues) console.log('[VCH_NORD audit] settled', issues, 'floating/sunk colliders');
}


/* ---- 6. Главная сборка сцены «Север-3» и анимация -------------------- */
function VCH_NORD_scene(scene, physics, lights){
  VCH_NORD_recs.length = 0;
  VCH_NORD_anim.radar = null;
  VCH_NORD_anim.beacon = null;
  VCH_NORD_anim.windsock = null;

  VCH_NORD_group = new Jt();
  scene.add(VCH_NORD_group);
  _VCH_NORD_physics = physics;

  const terrain = VCH_NORD_terrain(scene);
  VCH_NORD_airstrip();
  VCH_NORD_hangar(physics, 48, 6);
  VCH_NORD_tower(physics, -54, 24);
  VCH_NORD_fuelDepot(physics, 56, -32);
  VCH_NORD_radarStation(physics, 56, 52);
  VCH_NORD_bridge(physics);
  VCH_NORD_overpass(physics);
  VCH_NORD_rangeArch(physics);
  VCH_NORD_bunkers(physics);
  VCH_NORD_tacticalProps(physics);
  VCH_NORD_nature();

  /* Сбалансированный морозный свет заката + расширенный охват теней для 4K карт */
  if(lights){
    lights.sun.color.setHex(0xffd7ac);
    lights.sun.intensity = 2.15;
    if(lights.sun.shadow && lights.sun.shadow.camera){
      const sh = lights.sun.shadow;
      sh.camera.left = -56; sh.camera.right = 56;
      sh.camera.top = 56;  sh.camera.bottom = -56;
      sh.camera.far = 230;
      sh.camera.updateProjectionMatrix();
    }
    lights.hemi.color.setHex(0x88b6eb);
    lights.hemi.groundColor.setHex(0x5e748d);
    lights.hemi.intensity = 0.66;
    lights.fill.color.setHex(0x7eaeef);
    lights.fill.intensity = 0.42;
    lights.bounce.color.setHex(0xffb478);
    lights.bounce.intensity = 0.24;
  }
  if(scene.fog){
    scene.fog.color.setHex(0xb5cade);
    scene.fog.density = 0.00112;
  }

  VCH_NORD_auditPlacements();
  return terrain;
}

function VCH_NORD_props(scene, physics, effects){
  const spots = [
    { x: -25, z: -16, power: 24 },
    { x:  38, z: -12, power: 26 },
    { x: -16, z: -48, power: 22 },
    { x:  34, z:  46, power: 24 }
  ].map(s => ({ ...s, y: ge(s.x, s.z) }));
  VCH_NORD_fires = new Zw(scene, effects, spots);
  return { props: VCH_NORD_recs, fires: VCH_NORD_fires };
}

function VCH_NORD_tick(dt){
  if(VCH_MAP !== 5) return;
  if(VCH_NORD_anim.radar) VCH_NORD_anim.radar.rotation.y += dt * 0.85;
  if(VCH_NORD_anim.beacon) VCH_NORD_anim.beacon.rotation.y += dt * 4.4;
  if(VCH_NORD_anim.windsock){
    const t = (typeof pa !== "undefined" && pa) ? pa.elapsedTime : performance.now() * 0.001;
    VCH_NORD_anim.windsock.rotation.y = Math.sin(t * 1.4) * 0.22 + 0.6;
    VCH_NORD_anim.windsock.rotation.z = -0.14 + Math.sin(t * 3.1) * 0.08;
  }
  if(typeof en !== "undefined" && en && en.pool && typeof qt !== "undefined" && qt && typeof J !== "undefined" && J.started){
    VCH_NORD_anim.snowT -= dt;
    if(VCH_NORD_anim.snowT <= 0){
      VCH_NORD_anim.snowT = 0.045;
      const tp = qt.group.position;
      for(let i = 0; i < 2; i++){
        const sx = tp.x + (Math.random() - 0.5) * 44;
        const sz = tp.z + (Math.random() - 0.5) * 44;
        const sy = tp.y + 8 + Math.random() * 10;
        en._get(en.pool).spawn({
          pos: new P(sx, sy, sz),
          vel: new P(1.6 + Math.random() * 1.2, -1.8 - Math.random() * 1.2, 0.6 + Math.random() * 0.8),
          life: 2.6 + Math.random() * 1.2,
          size0: 0.14,
          size1: 0.22,
          color: 0xeaf4ff,
          drag: 0.15,
          grav: 0.2,
          opacity: 0.52
        });
      }
    }
  }
}
