/* ==========================================================================
   vch36 · js/20-garage.js
   Полноценный 3D-гараж с танком на поворотном подиуме и интерфейсом в стиле
   «Танки Онлайн»: выбор танка, карты, режима, окраски, износа и орбитальный
   осмотр техники в подземном бункере-ангаре.
   ========================================================================== */
"use strict";

(function vchGarageInit(){
  const TURNTABLE_Y = 0.26;
  const MAP_META = [
    {
      key: "aleksandrovsk",
      name: "АЛЕКСАНДРОВСК",
      sub: "Рассвет · HDRI-панорама",
      tag: "ГОРОД / ПОБЕРЕЖЬЕ",
      size: "495 × 515 м",
      grav: "1.00 G",
      desc: "Прибрежный промышленный город в лучах утреннего солнца. Плотная застройка, перепады высот, укрытия и длинные прострелы.",
      thumb: "aleks"
    },
    {
      key: "space",
      name: "КОСМОС",
      sub: "Лунная база · Низкая G",
      tag: "ОРБИТА · 0.38 G",
      size: "420 × 420 м",
      grav: "0.38 G",
      desc: "Лунный космодром с пониженной гравитацией: затяжные прыжки с рамп, тёмное звёздное небо и яркие прожекторы.",
      thumb: "space"
    },
    {
      key: "nord",
      name: "СЕВЕР-3",
      sub: "Арктическая база · Закат",
      tag: "АРКТИКА / ВПП",
      size: "480 × 480 м",
      grav: "1.00 G",
      desc: "Заполярная военная база на закате: бетонная ВПП 03/21, сквозной танковый ангар, ледяной канал под мостом, укрепрайон, РЛС и перевал.",
      thumb: "nord"
    }
  ];

  const TANK_META = [
    {
      id: "obt",
      idx: 0,
      name: "ОБТ «36»",
      role: "Т-36М «ГРОЗА» · ОСНОВНОЙ БОЕВОЙ ТАНК",
      tier: "М3 · ОСНОВНОЙ",
      gun: "125 мм 2А82 БОПС",
      mass: "65 т",
      speed: "58 км/ч",
      reload: "3.8 с",
      stats: { armor: 84, power: 82, speed: 88, reload: 85 },
      desc: "Сбалансированный основной боевой танк. Высокая максимальная скорость, быстрый автомат заряжания и стабильная 125-мм пушка."
    },
    {
      id: "scorpion",
      idx: 1,
      name: "SCORPION",
      role: "ТЯЖЁЛЫЙ ШТУРМОВОЙ · РАКЕТНЫЙ КОМПЛЕКС",
      tier: "М3+ · РАКЕТНЫЙ",
      gun: "125 мм + 2×5 ПУ",
      mass: "54 т",
      speed: "54 км/ч",
      reload: "4.6 с",
      stats: { armor: 92, power: 98, speed: 78, reload: 74 },
      desc: "Тяжёлый штурмовой танк с бортовыми пусковыми установками (2×5 навесных ракет на клавишу Q/E или правый залп) и усиленной башней."
    }
  ];

  const MODE_META = [
    { key: "free",   label: "СВОБОДНЫЙ" },
    { key: "battle", label: "БОЙ С ИИ" },
    { key: "range",  label: "СТРЕЛЬБИЩЕ" },
    { key: "track",  label: "ТРАССА" }
  ];

  const state = {
    active: false,
    built: false,
    settledAt: 0,
    selectedTank: 0,
    selectedMap: (typeof VCH_MAP_KEY === "string" && MAP_META.some(m => m.key === VCH_MAP_KEY)) ? VCH_MAP_KEY : "aleksandrovsk",
    selectedMode: "free",
    autoSpin: true,
    turretDemo: true,
    lightsOn: true,
    scorpionReady: false,
    scorpionError: null,
    hasCustom: false,
    /* orbit camera */
    yaw: -0.66,
    pitch: 0.24,
    dist: 11.2,
    tgtYaw: -0.66,
    tgtPitch: 0.24,
    tgtDist: 11.2,
    dragging: false,
    lastX: 0,
    lastY: 0,
    pinchDist: 0,
    spinAngle: 0.32,
    t: 0,
    flashPulse: 0,
    recoil: 0,
    recoilVel: 0,
    muzzleFlashT: 0
  };

  /* ---- чтение сохранённых предпочтений ----------------------------------- */
  try {
    const st = parseInt(localStorage.getItem("vch36.tank") || "0", 10);
    if (st === 0 || st === 1) {
      state.selectedTank = st;
      if (st === 1) state.dist = state.tgtDist = 12.2;
    }
    const sm = localStorage.getItem("vch36.mode");
    if (sm && MODE_META.some(m => m.key === sm)) state.selectedMode = sm;
  } catch (e) {}

  /* ---- 3D-сцена ангара «Танки Онлайн» ------------------------------------ */
  let gScene = null;
  let gEnvRT = null;
  let gTurntable = null;
  let gTankMount = null;
  let gRimMat = null;
  let gUnderglow = null;
  let gKeyLight = null;
  let gMuzzleLight = null;
  let gMuzzleSprite = null;
  let gHeadlights = [];
  let gFans = [];
  let gDust = [];
  let gDisplayOBT = null;
  let gDisplayScorpion = null;
  let gDisplayCustom = null;
  let gActiveHolder = null;
  let gActiveMeta = null;

  function mkCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }

  function makeConcreteTex() {
    const N = 512, c = mkCanvas(N, N), ctx = c.getContext("2d");
    ctx.fillStyle = "#1c2228";
    ctx.fillRect(0, 0, N, N);
    /* бетонная крошка и пятна */
    let seed = 4201;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 6500; i++) {
      const x = rnd() * N, y = rnd() * N, r = 0.6 + rnd() * 2.2;
      const v = 22 + Math.floor(rnd() * 28);
      ctx.fillStyle = `rgba(${v},${v + 4},${v + 8},0.35)`;
      ctx.fillRect(x, y, r, r);
    }
    for (let i = 0; i < 24; i++) {
      const x = rnd() * N, y = rnd() * N, rad = 24 + rnd() * 70;
      const gr = ctx.createRadialGradient(x, y, 2, x, y, rad);
      gr.addColorStop(0, "rgba(8,10,12,0.22)");
      gr.addColorStop(1, "rgba(8,10,12,0)");
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(x, y, rad, 0, Math.PI * 2); ctx.fill();
    }
    /* швы бетонных плит */
    ctx.strokeStyle = "rgba(7,10,13,0.72)";
    ctx.lineWidth = 3;
    for (let p = 0; p < 4; p++) {
      const k = (p * N) / 4;
      ctx.beginPath(); ctx.moveTo(k, 0); ctx.lineTo(k, N); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, k); ctx.lineTo(N, k); ctx.stroke();
      ctx.strokeStyle = "rgba(88,104,118,0.10)";
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(k + 2, 0); ctx.lineTo(k + 2, N); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, k + 2); ctx.lineTo(N, k + 2); ctx.stroke();
      ctx.strokeStyle = "rgba(7,10,13,0.72)";
      ctx.lineWidth = 3;
    }
    const tex = new Ks(c);
    tex.wrapS = tex.wrapT = vi;
    tex.repeat.set(5, 5);
    tex.colorSpace = Ie;
    tex.anisotropy = 4;
    return tex;
  }

  function makeTurntableTex() {
    const N = 512, c = mkCanvas(N, N), ctx = c.getContext("2d"), cx = N / 2, cy = N / 2;
    const gr = ctx.createRadialGradient(cx, cy, 10, cx, cy, N * 0.5);
    gr.addColorStop(0, "#242c34");
    gr.addColorStop(0.55, "#1b2128");
    gr.addColorStop(0.92, "#14191f");
    gr.addColorStop(1, "#0d1115");
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, N, N);

    /* радиальная насечка */
    ctx.strokeStyle = "rgba(180,210,235,0.06)";
    ctx.lineWidth = 1;
    for (let a = 0; a < 72; a++) {
      const th = (a / 72) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(th) * 48, cy + Math.sin(th) * 48);
      ctx.lineTo(cx + Math.cos(th) * 244, cy + Math.sin(th) * 244);
      ctx.stroke();
    }
    /* концентрические кольца */
    for (const r of [64, 118, 168, 212, 238]) {
      ctx.strokeStyle = r === 238 ? "rgba(110,255,95,0.35)" : "rgba(120,150,175,0.16)";
      ctx.lineWidth = r === 238 ? 3 : 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    }
    /* 4 янтарных сектора калибровки */
    ctx.strokeStyle = "rgba(255,172,56,0.45)";
    ctx.lineWidth = 4;
    for (let i = 0; i < 4; i++) {
      const a0 = i * Math.PI / 2 - 0.14;
      ctx.beginPath(); ctx.arc(cx, cy, 224, a0, a0 + 0.28); ctx.stroke();
    }
    const tex = new Ks(c);
    tex.colorSpace = Ie;
    tex.anisotropy = 4;
    return tex;
  }

  function makeHazardTex(repX = 12) {
    const c = mkCanvas(256, 64), ctx = c.getContext("2d");
    ctx.fillStyle = "#171a1d";
    ctx.fillRect(0, 0, 256, 64);
    ctx.fillStyle = "#d9921c";
    for (let x = -64; x < 320; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 64); ctx.lineTo(x + 24, 64);
      ctx.lineTo(x + 56, 0); ctx.lineTo(x + 32, 0);
      ctx.closePath(); ctx.fill();
    }
    const tex = new Ks(c);
    tex.wrapS = tex.wrapT = vi;
    tex.repeat.set(repX, 1);
    tex.colorSpace = Ie;
    return tex;
  }

  function makeWallTex() {
    const N = 256, c = mkCanvas(N, N), ctx = c.getContext("2d");
    ctx.fillStyle = "#1a2129";
    ctx.fillRect(0, 0, N, N);
    for (let y = 0; y < N; y += 32) {
      ctx.fillStyle = "rgba(255,255,255,0.03)";
      ctx.fillRect(0, y, N, 6);
      ctx.fillStyle = "rgba(0,0,0,0.34)";
      ctx.fillRect(0, y + 28, N, 4);
    }
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, N - 4, N - 4);
    ctx.fillStyle = "rgba(180,205,225,0.18)";
    for (let x = 16; x < N; x += 64) {
      for (let y = 16; y < N; y += 64) {
        ctx.fillRect(x, y, 3, 3);
      }
    }
    const tex = new Ks(c);
    tex.wrapS = tex.wrapT = vi;
    tex.repeat.set(4, 2);
    tex.colorSpace = Ie;
    return tex;
  }

  function makeExitSignTex() {
    const c = mkCanvas(512, 128), ctx = c.getContext("2d");
    ctx.fillStyle = "#0a1116";
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = "#4fff56";
    ctx.lineWidth = 4;
    ctx.strokeRect(8, 8, 496, 112);
    ctx.fillStyle = "rgba(79,255,86,0.12)";
    ctx.fillRect(14, 14, 484, 100);
    ctx.fillStyle = "#a8ffae";
    ctx.font = "bold 40px 'Roboto Condensed', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("ВЫЕЗД  //  СЕКТОР 36", 256, 52);
    ctx.fillStyle = "#ffb648";
    ctx.font = "bold 19px 'Roboto Condensed', Arial, sans-serif";
    ctx.fillText("АНГАР ТЕХНИЧЕСКОЙ ПОДГОТОВКИ", 256, 94);
    const tex = new Ks(c);
    tex.colorSpace = Ie;
    return tex;
  }

  function makeMonitorTex() {
    const c = mkCanvas(256, 160), ctx = c.getContext("2d");
    ctx.fillStyle = "#06140c";
    ctx.fillRect(0, 0, 256, 160);
    ctx.strokeStyle = "#2cd85d";
    ctx.lineWidth = 2;
    ctx.strokeRect(6, 6, 244, 148);
    ctx.fillStyle = "#62ff85";
    ctx.font = "bold 16px monospace";
    ctx.fillText("TANK-OS v3.6", 16, 30);
    ctx.fillStyle = "#9effb3";
    ctx.font = "13px monospace";
    ctx.fillText("БАЛАНСИР: OK", 16, 58);
    ctx.fillText("СТАБ ГОН: ГОТОВ", 16, 78);
    ctx.fillText("БРОНЯ  : 100%", 16, 98);
    ctx.fillStyle = "#ffb84d";
    ctx.fillText("ЗАРЯД  : 22/22", 16, 122);
    /* мини-радар */
    ctx.strokeStyle = "rgba(98,255,133,0.55)";
    ctx.beginPath(); ctx.arc(204, 96, 30, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(204, 96, 15, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(204, 96); ctx.lineTo(226, 76); ctx.stroke();
    const tex = new Ks(c);
    tex.colorSpace = Ie;
    return tex;
  }

  function buildGarageEnv() {
    if (!jf) return null;
    const esc = new rf();
    const shell = new Lt(
      new Sa(18, 24, 16),
      new En({ color: 0x0d141c, side: Ze })
    );
    esc.add(shell);

    /* верхние студийные софтбоксы для выразительных бликов на башне и стволе */
    const softMat = new En({ color: 0xffffff });
    softMat.color.setRGB(3.5, 3.8, 4.2);
    for (const [x, z] of [[-3.5, -3.5], [3.5, -3.5], [-3.5, 3.5], [3.5, 3.5]]) {
      const m = new Lt(new _e(4.2, 0.25, 1.5), softMat);
      m.position.set(x, 8.5, z);
      esc.add(m);
    }
    /* тёплый янтарный боковой акцент */
    const warmMat = new En({ color: 0xffffff });
    warmMat.color.setRGB(3.6, 1.9, 0.7);
    const wBar = new Lt(new _e(0.3, 2.2, 8.0), warmMat);
    wBar.position.set(10.5, 3.0, -2.0);
    esc.add(wBar);

    /* холодный стальной контурный акцент слева */
    const coolMat = new En({ color: 0xffffff });
    coolMat.color.setRGB(1.3, 2.4, 4.0);
    const cBar = new Lt(new _e(0.3, 2.2, 8.0), coolMat);
    cBar.position.set(-10.5, 3.2, 2.0);
    esc.add(cBar);

    /* зелёный отсвет от подиума снизу */
    const gBarMat = new En({ color: 0xffffff });
    gBarMat.color.setRGB(0.4, 1.6, 0.55);
    const gRing = new Lt(new mn(4.5, 4.5, 0.3, 24), gBarMat);
    gRing.position.set(0, -3.8, 0);
    esc.add(gRing);

    const rt = jf.fromScene(esc, 0.025, 0.1, 40);
    esc.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    return rt;
  }

  function buildGarageScene() {
    if (state.built) return;
    state.built = true;

    gScene = new rf();
    gScene.background = new Ft(0x0b1016);
    gScene.fog = new Gl(0x0b1016, 0.014);

    gEnvRT = buildGarageEnv();
    if (gEnvRT) {
      gScene.environment = gEnvRT.texture;
      gScene.environmentIntensity = 0.88;
    }

    const tConcrete = makeConcreteTex();
    const tDeck = makeTurntableTex();
    const tHazard = makeHazardTex(14);
    const tHazardShort = makeHazardTex(4);
    const tWall = makeWallTex();
    const tSign = makeExitSignTex();
    const tMon = makeMonitorTex();

    const mFloor = new fe({ map: tConcrete, roughness: 0.78, metalness: 0.16, envMapIntensity: 0.65 });
    const mSteel = new fe({ color: 0x263039, roughness: 0.42, metalness: 0.78, envMapIntensity: 1.0 });
    const mSteelDark = new fe({ color: 0x161b21, roughness: 0.52, metalness: 0.70, envMapIntensity: 0.9 });
    const mWall = new fe({ map: tWall, color: 0xc2ccd6, roughness: 0.66, metalness: 0.45, envMapIntensity: 0.75 });
    const mHazard = new fe({ map: tHazard, roughness: 0.62, metalness: 0.25 });
    const mHazardShort = new fe({ map: tHazardShort, roughness: 0.62, metalness: 0.25 });
    const mCrate = new fe({ color: 0x3b4432, roughness: 0.85, metalness: 0.12 });
    const mCrateDark = new fe({ color: 0x2a3138, roughness: 0.75, metalness: 0.25 });
    const mDrumAmber = new fe({ color: 0xb85b1c, roughness: 0.48, metalness: 0.55 });
    const mDrumGrey = new fe({ color: 0x3e4750, roughness: 0.52, metalness: 0.62 });

    /* 1. Пол бункера */
    const floor = new Lt(new Di(38, 34), mFloor);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    gScene.add(floor);

    /* 2. Поворотный подиум «Танки Онлайн» */
    const pitBase = new Lt(new mn(5.32, 5.56, 0.14, 64), mSteelDark);
    pitBase.position.y = 0.07;
    pitBase.receiveShadow = true;
    gScene.add(pitBase);

    const hazardCollar = new Lt(new ua(4.92, 5.30, 64), mHazard);
    hazardCollar.rotation.x = -Math.PI / 2;
    hazardCollar.position.y = 0.145;
    hazardCollar.receiveShadow = true;
    gScene.add(hazardCollar);

    /* неоновое кольцо по периметру подиума */
    gRimMat = new fe({
      color: 0x1e4020,
      emissive: 0x4eff3d,
      emissiveIntensity: 0.96,
      roughness: 0.25,
      metalness: 0.2
    });
    const neonTorus = new Lt(new Ri(4.78, 0.048, 12, 72), gRimMat);
    neonTorus.rotation.x = Math.PI / 2;
    neonTorus.position.y = 0.235;
    gScene.add(neonTorus);

    const neonDiskRim = new Lt(new ua(4.58, 4.82, 72), gRimMat);
    neonDiskRim.rotation.x = -Math.PI / 2;
    neonDiskRim.position.y = 0.15;
    gScene.add(neonDiskRim);

    gTurntable = new Jt();
    gScene.add(gTurntable);

    const deck = new Lt(
      new mn(4.62, 4.74, 0.24, 64),
      new fe({ map: tDeck, roughness: 0.44, metalness: 0.72, envMapIntensity: 1.05 })
    );
    deck.position.y = 0.14;
    deck.receiveShadow = true;
    gTurntable.add(deck);

    const mClamp = mSteel;
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const lug = new Lt(new _e(0.26, 0.06, 0.48), mClamp);
      lug.position.set(Math.sin(a) * 4.46, 0.245, Math.cos(a) * 4.46);
      lug.rotation.y = a;
      lug.receiveShadow = true;
      gTurntable.add(lug);
    }

    const mAmberGlow = new fe({ color: 0x3a2408, emissive: 0xff9d2e, emissiveIntensity: 1.7 });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const marker = new Lt(new _e(0.55, 0.04, 0.14), mAmberGlow);
      marker.position.set(Math.sin(a) * 4.78, 0.22, Math.cos(a) * 4.78);
      marker.rotation.y = a;
      gScene.add(marker);
    }

    gTankMount = new Jt();
    gTurntable.add(gTankMount);

    /* 3. Несущие арки и стены ангара */
    const sideWallL = new Lt(new _e(0.6, 9.4, 30), mWall);
    sideWallL.position.set(-13.2, 4.7, 0);
    sideWallL.receiveShadow = true;
    gScene.add(sideWallL);

    const sideWallR = new Lt(new _e(0.6, 9.4, 30), mWall);
    sideWallR.position.set(13.2, 4.7, 0);
    sideWallR.receiveShadow = true;
    gScene.add(sideWallR);

    const roof = new Lt(new _e(27.0, 0.5, 30), mSteelDark);
    roof.position.set(0, 9.3, 0);
    gScene.add(roof);

    const mStripCyan = new fe({ color: 0x163844, emissive: 0x52dcff, emissiveIntensity: 1.6 });
    const mStripAmber = new fe({ color: 0x3b240c, emissive: 0xff9b38, emissiveIntensity: 1.5 });
    for (const z of [-10.0, -3.4, 3.4, 10.0]) {
      for (const s of [-1, 1]) {
        /* вертикальная стойка */
        const col = new Lt(new _e(0.72, 8.6, 0.85), mSteel);
        col.position.set(s * 12.1, 4.3, z);
        col.castShadow = true; col.receiveShadow = true;
        gScene.add(col);
        /* наклонный подкос к потолку */
        const brace = new Lt(new _e(0.55, 3.8, 0.72), mSteelDark);
        brace.position.set(s * 10.7, 7.6, z);
        brace.rotation.z = s * 0.62;
        gScene.add(brace);
        /* ниши подсветки вдоль стен */
        const strip = new Lt(new _e(0.08, 3.4, 0.16), (z > 0 ? mStripCyan : mStripAmber));
        strip.position.set(s * 12.82, 2.7, z + (z > 0 ? -1.4 : 1.4));
        gScene.add(strip);
      }
      /* поперечная балка перекрытия */
      const beam = new Lt(new _e(23.5, 0.62, 0.68), mSteel);
      beam.position.set(0, 8.6, z);
      gScene.add(beam);
    }

    /* 4. Массивные броневорота выезда (спереди танка: z = +14.0) */
    const backWallF = new Lt(new _e(27.0, 9.4, 0.7), mWall);
    backWallF.position.set(0, 4.7, 14.3);
    gScene.add(backWallF);

    const gateFrameL = new Lt(new _e(1.1, 6.6, 0.8), mHazardShort);
    gateFrameL.position.set(-5.3, 3.3, 13.75);
    gScene.add(gateFrameL);
    const gateFrameR = new Lt(new _e(1.1, 6.6, 0.8), mHazardShort);
    gateFrameR.position.set(5.3, 3.3, 13.75);
    gScene.add(gateFrameR);
    const gateLintel = new Lt(new _e(11.7, 0.85, 0.9), mSteel);
    gateLintel.position.set(0, 6.8, 13.75);
    gScene.add(gateLintel);

    for (const s of [-1, 1]) {
      const door = new Lt(new _e(4.7, 6.1, 0.48), mSteelDark);
      door.position.set(s * 2.38, 3.05, 13.85);
      gScene.add(door);
      for (const ry of [1.4, 3.0, 4.6]) {
        const rib = new Lt(new _e(4.3, 0.22, 0.14), mSteel);
        rib.position.set(s * 2.38, ry, 13.56);
        gScene.add(rib);
      }
      const beacon = new Lt(new Sa(0.18, 12, 8), gRimMat);
      beacon.position.set(s * 5.3, 6.85, 13.28);
      gScene.add(beacon);
    }

    const exitSign = new Lt(
      new Di(4.6, 1.15),
      new fe({ map: tSign, emissiveMap: tSign, emissive: 0xffffff, emissiveIntensity: 0.95, roughness: 0.3 })
    );
    exitSign.position.set(0, 7.65, 13.25);
    exitSign.rotation.y = Math.PI;
    gScene.add(exitSign);

    /* 5. Задняя переборка (z = -14.0) с вращающимися вытяжными вентиляторами */
    const backWallR = new Lt(new _e(27.0, 9.4, 0.7), mWall);
    backWallR.position.set(0, 4.7, -14.3);
    gScene.add(backWallR);

    for (const fx of [-4.6, 4.6]) {
      const ring = new Lt(new Ri(1.75, 0.18, 10, 28), mSteel);
      ring.position.set(fx, 4.8, -13.85);
      gScene.add(ring);
      const fanHub = new Jt();
      fanHub.position.set(fx, 4.8, -13.95);
      for (let b = 0; b < 5; b++) {
        const blade = new Lt(new _e(0.38, 1.55, 0.06), mSteelDark);
        blade.position.set(0, 0.75, 0);
        blade.rotation.y = 0.28;
        const p = new Jt();
        p.rotation.z = (b / 5) * Math.PI * 2;
        p.add(blade);
        fanHub.add(p);
      }
      gScene.add(fanHub);
      gFans.push(fanHub);
    }

    /* 6. Мостовой кран и потолочные студийные светильники */
    const craneBeam = new Lt(new _e(23.5, 0.55, 0.9), mHazard);
    craneBeam.position.set(0, 7.75, -1.8);
    gScene.add(craneBeam);
    const trolley = new Lt(new _e(1.8, 0.45, 1.4), mSteel);
    trolley.position.set(-2.6, 7.35, -1.8);
    gScene.add(trolley);

    const mSoftPanel = new fe({ color: 0xeef5ff, emissive: 0xdaf0ff, emissiveIntensity: 1.95, roughness: 0.2 });
    for (const [lx, lz] of [[-3.1, -2.8], [3.1, -2.8], [-3.1, 2.8], [3.1, 2.8]]) {
      const housing = new Lt(new _e(2.6, 0.16, 0.95), mSteelDark);
      housing.position.set(lx, 7.05, lz);
      gScene.add(housing);
      const panel = new Lt(new Di(2.35, 0.78), mSoftPanel);
      panel.rotation.x = Math.PI / 2;
      panel.position.set(lx, 6.96, lz);
      gScene.add(panel);
    }

    /* 7. Атмосферное освещение (без жёсткого геом-конуса) */

    /* 8. Пропсы гаража по периметру (не мешают облёту камеры) */
    const crateSpots = [
      [-9.4, 0.55, -8.5, 1.4, 1.1, 1.1, 0.18, mCrate],
      [-9.2, 1.50, -8.4, 0.95, 0.8, 0.85, -0.1, mCrateDark],
      [-10.9, 0.50, -7.1, 1.1, 1.0, 1.0, 0.04, mCrateDark],
      [9.6, 0.60, 8.2, 1.5, 1.2, 1.2, -0.22, mCrate],
      [10.8, 0.45, 6.6, 1.1, 0.9, 1.0, 0.3, mCrateDark],
      [-9.6, 0.45, 7.6, 1.2, 0.9, 1.1, 0.12, mCrate]
    ];
    for (const [x, y, z, w, h, d, ry, mat] of crateSpots) {
      const box = new Lt(new _e(w, h, d), mat);
      box.position.set(x, y, z);
      box.rotation.y = ry;
      box.castShadow = true; box.receiveShadow = true;
      gScene.add(box);
    }

    /* топливные бочки */
    for (const [x, z, m] of [
      [9.8, -7.8, mDrumAmber], [10.65, -7.3, mDrumAmber], [10.1, -6.5, mDrumGrey],
      [-10.4, 8.8, mDrumGrey], [-9.5, 9.2, mDrumAmber]
    ]) {
      const drum = new Lt(new mn(0.32, 0.32, 0.96, 16), m);
      drum.position.set(x, 0.48, z);
      drum.castShadow = true; drum.receiveShadow = true;
      gScene.add(drum);
    }

    /* диагностический пост с монитором */
    const desk = new Lt(new _e(1.7, 1.05, 0.82), mSteel);
    desk.position.set(9.2, 0.525, -2.6);
    desk.rotation.y = -Math.PI / 2 + 0.2;
    desk.castShadow = true; desk.receiveShadow = true;
    gScene.add(desk);
    const mon = new Lt(new _e(0.08, 0.62, 0.96), mSteelDark);
    mon.position.set(9.12, 1.42, -2.6);
    mon.rotation.y = 0.2;
    gScene.add(mon);
    const scr = new Lt(
      new Di(0.88, 0.54),
      new fe({ map: tMon, emissiveMap: tMon, emissive: 0xffffff, emissiveIntensity: 0.95 })
    );
    scr.position.set(9.07, 1.42, -2.6);
    scr.rotation.y = -Math.PI / 2 + 0.2;
    gScene.add(scr);

    /* запасные опорные катки у стены */
    for (let i = 0; i < 3; i++) {
      const wh = new Lt(new mn(0.42, 0.42, 0.24, 18), mSteelDark);
      wh.position.set(-10.8, 0.42, -1.5 + i * 0.62);
      wh.rotation.z = 0.22;
      wh.rotation.x = Math.PI / 2;
      wh.castShadow = true;
      gScene.add(wh);
    }

    /* 9. Плавающие пылинки в лучах прожекторов */
    const dustTex = typeof El === "function" ? El(64, "rgba(255,245,220,0.85)") : null;
    if (dustTex && typeof cf !== "undefined" && typeof Wl !== "undefined") {
      for (let i = 0; i < 28; i++) {
        const sp = new cf(new Wl({
          map: dustTex,
          color: i % 3 === 0 ? 0xa8ffba : 0xffe4b8,
          transparent: true,
          opacity: 0.24,
          blending: Ir,
          depthWrite: false
        }));
        const r = 1.2 + Math.random() * 6.0, a = Math.random() * Math.PI * 2;
        const y = 0.6 + Math.random() * 5.2;
        sp.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
        const sc = 0.07 + Math.random() * 0.09;
        sp.scale.setScalar(sc);
        gScene.add(sp);
        gDust.push({
          sp,
          baseX: sp.position.x,
          baseY: y,
          baseZ: sp.position.z,
          ph: Math.random() * 6.283,
          spd: 0.35 + Math.random() * 0.45
        });
      }
    }

    /* 10. Освещение бункера */
    const hemi = new Sy(0xa6c8e8, 0x222932, 0.86);
    gScene.add(hemi);
    gScene.add(new Ay(0x323d4a, 0.40));

    gKeyLight = new by(0xfff1dc, 68, 30, 0.86, 0.78, 1.45);
    gKeyLight.position.set(-3.6, 9.0, 4.8);
    gKeyLight.target.position.set(0, 1.0, 0);
    gKeyLight.castShadow = true;
    gKeyLight.shadow.mapSize.set(2048, 2048);
    gKeyLight.shadow.camera.near = 2.0;
    gKeyLight.shadow.camera.far = 22.0;
    gKeyLight.shadow.bias = -0.00025;
    gKeyLight.shadow.normalBias = 0.025;
    gScene.add(gKeyLight);
    gScene.add(gKeyLight.target);

    const rimLight = new wl(0x88c4ff, 1.45);
    rimLight.position.set(-8.5, 6.2, -9.5);
    rimLight.target.position.set(0, 1.2, 0);
    gScene.add(rimLight);
    gScene.add(rimLight.target);

    const bayFill = new Ql(0xcadcf0, 22, 32, 1.35);
    bayFill.position.set(0, 8.4, -5.0);
    gScene.add(bayFill);

    const warmFill = new Ql(0xff9b3d, 22, 22, 1.45);
    warmFill.position.set(7.4, 2.9, -5.2);
    gScene.add(warmFill);

    const coolFill = new Ql(0x52b8ff, 15, 20, 1.45);
    coolFill.position.set(-7.6, 2.7, 5.2);
    gScene.add(coolFill);

    gUnderglow = new Ql(0x4eff59, 3.8, 11, 1.6);
    gUnderglow.position.set(0, 0.55, 0);
    gScene.add(gUnderglow);

    gMuzzleLight = new Ql(0xffb552, 0, 22, 1.5);
    gScene.add(gMuzzleLight);

    if (dustTex && typeof cf !== "undefined" && typeof Wl !== "undefined") {
      gMuzzleSprite = new cf(new Wl({
        map: dustTex,
        color: 0xffd07a,
        transparent: true,
        opacity: 0,
        blending: Ir,
        depthWrite: false,
        toneMapped: false
      }));
      gMuzzleSprite.visible = false;
      gScene.add(gMuzzleSprite);
    }

    /* фары на подиуме (подсвечивают танк спереди при желании) */
    for (const s of [-1, 1]) {
      const hl = new by(0xffe6b8, 7.5, 16, 0.52, 0.78, 1.6);
      hl.position.set(s * 3.8, 1.85, 7.2);
      hl.target.position.set(s * 0.7, 1.05, 0);
      gScene.add(hl);
      gScene.add(hl.target);
      gHeadlights.push(hl);
    }
  }

  /* ---- создание / клонирование моделей танков на подиуме ----------------- */
  function findRole(root, role) {
    let hit = null;
    root.traverse(o => {
      if (!hit && o.userData && o.userData.__vchRole === role) hit = o;
    });
    return hit;
  }

  function cloneTankNode(src) {
    let dst;
    if (src.isInstancedMesh) {
      const InstCls = (typeof VCH_InstCls === "function") ? VCH_InstCls : src.constructor;
      const maxN = Math.max(1, (src.instanceMatrix && src.instanceMatrix.count) || src.count || 1);
      dst = new InstCls(src.geometry, src.material, maxN);
      dst.count = src.count;
      if (src.instanceMatrix && dst.instanceMatrix) {
        dst.instanceMatrix.array.set(src.instanceMatrix.array);
        dst.instanceMatrix.needsUpdate = true;
      }
      dst.frustumCulled = src.frustumCulled;
    } else {
      dst = src.clone(false);
    }
    dst.position.copy(src.position);
    dst.rotation.copy(src.rotation);
    dst.quaternion.copy(src.quaternion);
    dst.scale.copy(src.scale);
    dst.castShadow = src.castShadow;
    dst.receiveShadow = src.receiveShadow;
    dst.visible = src.visible;
    dst.name = src.name;
    if (src.userData && src.userData.__vchRole) {
      dst.userData.__vchRole = src.userData.__vchRole;
    }
    for (const ch of src.children) {
      dst.add(cloneTankNode(ch));
    }
    return dst;
  }

  function alignToTurntable(group) {
    group.position.set(0, 0, 0);
    group.updateMatrixWorld(true);
    let minY = Infinity;
    const v = new P();
    const m = new Xt();
    group.traverse(o => {
      if (!o.geometry || !o.geometry.attributes || !o.geometry.attributes.position) return;
      const pos = o.geometry.attributes.position;
      const mw = o.matrixWorld;
      const els = mw.elements;
      for (let i = 0; i < 16; i++) if (!isFinite(els[i])) return;
      if (o.isInstancedMesh && o.instanceMatrix) {
        const cnt = Math.min(o.count || 0, o.instanceMatrix.count || 0);
        for (let i = 0; i < cnt; i++) {
          o.getMatrixAt(i, m);
          m.premultiply(mw);
          for (let k = 0; k < pos.count; k++) {
            v.fromBufferAttribute(pos, k).applyMatrix4(m);
            if (isFinite(v.y) && v.y < minY) minY = v.y;
          }
        }
      } else {
        for (let k = 0; k < pos.count; k++) {
          v.fromBufferAttribute(pos, k).applyMatrix4(mw);
          if (isFinite(v.y) && v.y < minY) minY = v.y;
        }
      }
    });
    if (!isFinite(minY)) {
      const bb = new Xe().setFromObject(group);
      minY = bb.min.y;
    }
    if (isFinite(minY)) {
      group.position.y += (TURNTABLE_Y - minY);
      group.updateMatrixWorld(true);
    }
  }

  function buildOBTDisplay() {
    if (gDisplayOBT || typeof kf !== "function") return;
    const rig = kf();
    rig.group.updateMatrixWorld(true);
    rig.update(0.016, { speedL: 0, speedR: 0, probe: null });
    alignToTurntable(rig.group);

    /* применить текущий износ и отражения, если 19-look уже активен */
    try {
      if (window.__vchLook && window.__vchLook.reflect && rig.materials) {
        window.__vchLook.reflect(rig.materials);
      }
      if (typeof vchBakeWear === "function") {
        rig.group.traverse(o => {
          if (o.isMesh && !o.isInstancedMesh && o.geometry && !(o.geometry.getAttribute && o.geometry.getAttribute("aWear"))) {
            vchBakeWear(o.geometry);
          }
        });
      }
    } catch (e) {}

    rig.group.visible = false;
    gTankMount.add(rig.group);
    gDisplayOBT = {
      group: rig.group,
      turret: rig.turret,
      gunPivot: rig.gunPivot,
      recoilGroup: rig.recoilGroup,
      muzzlePoint: rig.muzzlePoint,
      baseRecoilZ: rig.recoilGroup ? rig.recoilGroup.position.z : 0,
      turretBaseY: rig.turret ? rig.turret.rotation.y : 0
    };
  }

  function buildScorpionDisplay(rig) {
    if (!rig || !rig.group || !gTankMount) return;
    if (gDisplayScorpion && gDisplayScorpion.group.parent) {
      gDisplayScorpion.group.parent.remove(gDisplayScorpion.group);
    }
    const grp = cloneTankNode(rig.group);
    grp.rotation.set(0, 0, 0);
    alignToTurntable(grp);
    grp.visible = false;
    gTankMount.add(grp);

    const turret = findRole(grp, "turret");
    const gunPivot = findRole(grp, "gunPivot");
    const recoilGroup = findRole(grp, "recoilGroup");
    const muzzlePoint = findRole(grp, "muzzlePoint");
    gDisplayScorpion = {
      group: grp,
      turret,
      gunPivot,
      recoilGroup,
      muzzlePoint,
      baseRecoilZ: recoilGroup ? recoilGroup.position.z : 0,
      turretBaseY: turret ? turret.rotation.y : 0
    };
    state.scorpionReady = true;
    syncDisplayedTank();
    syncTankUI();
  }

  function buildCustomDisplay(rig) {
    if (!rig || !rig.group || !gTankMount) return;
    if (gDisplayCustom && gDisplayCustom.group.parent) {
      gDisplayCustom.group.parent.remove(gDisplayCustom.group);
    }
    const grp = cloneTankNode(rig.group);
    grp.rotation.set(0, 0, 0);
    alignToTurntable(grp);
    grp.visible = false;
    gTankMount.add(grp);
    gDisplayCustom = {
      group: grp,
      turret: findRole(grp, "turret"),
      gunPivot: findRole(grp, "gunPivot"),
      recoilGroup: findRole(grp, "recoilGroup"),
      muzzlePoint: findRole(grp, "muzzlePoint"),
      baseRecoilZ: 0,
      turretBaseY: 0
    };
    state.hasCustom = !!rig.custom;
    syncDisplayedTank();
  }

  function syncDisplayedTank() {
    if (!gTankMount) return;
    if (!gDisplayOBT) buildOBTDisplay();

    if (gDisplayOBT) gDisplayOBT.group.visible = false;
    if (gDisplayScorpion) gDisplayScorpion.group.visible = false;
    if (gDisplayCustom) gDisplayCustom.group.visible = false;

    let chosen = null;
    if (state.hasCustom && state.selectedTank === 0 && gDisplayCustom) {
      chosen = gDisplayCustom;
    } else if (state.selectedTank === 1) {
      chosen = gDisplayScorpion || null;
    } else {
      chosen = gDisplayOBT;
    }

    gActiveMeta = chosen;
    if (chosen) {
      chosen.group.visible = true;
      gActiveHolder = chosen.group;
    } else {
      gActiveHolder = null;
    }

    const loaderEl = document.getElementById("g-loader");
    if (loaderEl) {
      const waitScorp = (state.selectedTank === 1 && !state.scorpionReady);
      loaderEl.classList.toggle("hidden", !waitScorp);
      const txtEl = loaderEl.querySelector(".g-loader-txt");
      if (txtEl) {
        txtEl.textContent = state.scorpionError
          ? ("ОШИБКА ЗАГРУЗКИ SCORPION: " + state.scorpionError)
          : "ЗАГРУЗКА 3D-МОДЕЛИ SCORPION…";
      }
    }
  }

  /* ---- переключение активной сцены рендерера ---------------------------- */
  function setGarageActive(on) {
    state.active = !!on;
    window.__vchGarageActive = state.active;

    const rp = (typeof Zr !== "undefined" && Zr && Zr.passes && Zr.passes[0]) ? Zr.passes[0] : null;
    if (state.active) {
      buildGarageScene();
      if (!gDisplayOBT) buildOBTDisplay();
      if (!gDisplayScorpion && window.__scorpion && window.__scorpion.rig) {
        buildScorpionDisplay(window.__scorpion.rig);
      }
      syncDisplayedTank();
      if (rp) {
        rp.scene = gScene;
        rp.camera = ye;
      }
      if (typeof ye !== "undefined" && ye) {
        ye.fov = 44;
        ye.updateProjectionMatrix();
      }
      updateCameraImmediate();
    } else {
      if (rp && typeof cn !== "undefined" && cn) {
        rp.scene = cn;
        rp.camera = ye;
      }
      if (typeof Pr === "function" && typeof J !== "undefined") {
        Pr(J.cameraMode || 0);
      }
    }
  }

  function updateCameraImmediate() {
    if (typeof ye === "undefined" || !ye) return;
    const tx = 0, ty = 1.28, tz = 0;
    const cp = Math.cos(state.pitch);
    ye.position.set(
      tx + Math.sin(state.yaw) * cp * state.dist,
      ty + Math.sin(state.pitch) * state.dist,
      tz + Math.cos(state.yaw) * cp * state.dist
    );
    ye.lookAt(tx, ty + 0.08, tz);
  }

  /* ---- покадровый цикл 3D-гаража ---------------------------------------- */
  function tick(dt) {
    if (!state.active || !gScene) return;
    dt = Math.min(dt || 0.016, 0.05);
    state.t += dt;

    /* плавное доведение камеры */
    const kCam = 1 - Math.exp(-dt * 9.5);
    state.yaw += (state.tgtYaw - state.yaw) * kCam;
    state.pitch += (state.tgtPitch - state.pitch) * kCam;
    state.dist += (state.tgtDist - state.dist) * kCam;
    updateCameraImmediate();

    if (typeof ye !== "undefined" && ye && Math.abs(ye.fov - 44) > 0.05) {
      ye.fov = 44;
      ye.updateProjectionMatrix();
    }

    /* поворот подиума */
    if (state.autoSpin && !state.dragging) {
      state.spinAngle += dt * 0.14;
    }
    if (gTurntable) gTurntable.rotation.y = state.spinAngle;

    /* лёгкое «живое» покачивание и поворот башни */
    if (gActiveMeta) {
      if (gActiveMeta.turret) {
        const tgtTur = state.turretDemo ? Math.sin(state.t * 0.42) * 0.26 + 0.18 : 0;
        gActiveMeta.turret.rotation.y += (tgtTur - gActiveMeta.turret.rotation.y) * Math.min(1, dt * 3.5);
      }
      if (gActiveMeta.gunPivot) {
        const tgtEl = state.turretDemo ? -(0.045 + Math.sin(state.t * 0.65) * 0.025) : 0;
        gActiveMeta.gunPivot.rotation.x += (tgtEl - gActiveMeta.gunPivot.rotation.x) * Math.min(1, dt * 3.5);
      }
      /* откат при огневом тесте */
      if (gActiveMeta.recoilGroup) {
        state.recoilVel += (-140 * state.recoil - 13 * state.recoilVel) * dt;
        state.recoil += state.recoilVel * dt;
        if (state.recoil < 0) {
          state.recoil = 0;
          if (state.recoilVel < 0) state.recoilVel *= -0.22;
        }
        gActiveMeta.recoilGroup.position.z = (gActiveMeta.baseRecoilZ || 0) - Math.min(0.95, state.recoil);
      }
    }

    /* вспышка при огневом тесте */
    if (state.muzzleFlashT > 0) {
      state.muzzleFlashT = Math.max(0, state.muzzleFlashT - dt);
      const fk = state.muzzleFlashT / 0.14;
      if (gMuzzleLight) gMuzzleLight.intensity = 65 * fk * fk;
      if (gMuzzleSprite) {
        gMuzzleSprite.visible = fk > 0.02;
        gMuzzleSprite.material.opacity = 0.85 * fk;
        gMuzzleSprite.scale.setScalar(1.8 * (1.3 - fk * 0.4));
      }
    } else {
      if (gMuzzleLight) gMuzzleLight.intensity = 0;
      if (gMuzzleSprite) gMuzzleSprite.visible = false;
    }

    /* пульсация неонового кольца подиума */
    if (state.flashPulse > 0) state.flashPulse = Math.max(0, state.flashPulse - dt * 2.2);
    const pulse = 0.92 + Math.sin(state.t * 2.2) * 0.14 + state.flashPulse * 1.4;
    if (gRimMat) gRimMat.emissiveIntensity = pulse;
    if (gUnderglow) gUnderglow.intensity = 3.8 + state.flashPulse * 10;

    /* фары */
    const hlI = state.lightsOn ? 7.5 : 0;
    for (const hl of gHeadlights) hl.intensity = hlI;

    /* вентиляторы задней стены */
    for (let i = 0; i < gFans.length; i++) {
      gFans[i].rotation.z += dt * (i === 0 ? 1.45 : -1.30);
    }

    /* дрейфующие пылинки */
    for (const d of gDust) {
      const a = state.t * d.spd + d.ph;
      d.sp.position.set(
        d.baseX + Math.sin(a) * 0.25,
        d.baseY + Math.cos(a * 0.8) * 0.18,
        d.baseZ + Math.cos(a * 0.7) * 0.25
      );
    }
  }

  function fireTest() {
    if (!state.active) return;
    state.recoilVel = 8.8;
    state.flashPulse = 1.0;
    state.muzzleFlashT = 0.14;
    if (gActiveMeta && gActiveMeta.muzzlePoint && gMuzzleLight) {
      gActiveMeta.muzzlePoint.updateWorldMatrix(true, false);
      const mp = new P();
      gActiveMeta.muzzlePoint.getWorldPosition(mp);
      gMuzzleLight.position.copy(mp);
      if (gMuzzleSprite) gMuzzleSprite.position.copy(mp);
    }
    try {
      an.init();
      an.shot && an.shot();
    } catch (e) {
      try { an.clank && an.clank(); } catch (_) {}
    }
  }

  /* ---- синхронизация UI гаража ------------------------------------------ */
  function selectTank(idx, userAction = true) {
    idx = (idx === 1) ? 1 : 0;
    state.selectedTank = idx;
    try { localStorage.setItem("vch36.tank", String(idx)); } catch (e) {}

    if (typeof VCH_PENDING !== "undefined") VCH_PENDING = idx;
    if (typeof VCH_TANKS !== "undefined" && idx < VCH_TANKS.length && typeof setActiveTank === "function") {
      setActiveTank(idx);
    }
    if (userAction) {
      state.flashPulse = 0.9;
      state.tgtDist = (idx === 1) ? 12.2 : 11.2;
      try { an.clank && an.clank(); } catch (e) {}
    }
    syncDisplayedTank();
    syncTankUI();
  }

  function selectMap(key, userAction = true) {
    const meta = MAP_META.find(m => m.key === key);
    if (!meta) return;
    state.selectedMap = key;
    try { localStorage.setItem("vch36.map", key); } catch (e) {}
    if (userAction) {
      state.flashPulse = 0.55;
      try { an.clank && an.clank(); } catch (e) {}
    }
    syncMapUI();
  }

  function selectMode(modeKey) {
    if (!MODE_META.some(m => m.key === modeKey)) return;
    state.selectedMode = modeKey;
    try { localStorage.setItem("vch36.mode", modeKey); } catch (e) {}
    syncModeUI();
  }

  function setLivery(livKey) {
    if (typeof VCH_LIVERY !== "undefined" && !VCH_LIVERY[livKey]) return;
    if (window.__vchLivery && window.__vchLivery.set) window.__vchLivery.set(livKey);
    else if (typeof VCH_LIVERY_ON !== "undefined") {
      VCH_LIVERY_ON = livKey;
      typeof vchLiveryApply === "function" && vchLiveryApply();
    }
    try { localStorage.setItem("vch36.livery", livKey); } catch (e) {}
    try { an.clank && an.clank(); } catch (e) {}
    state.flashPulse = 0.65;
    syncLiveryUI();
  }

  function setWear(val) {
    const v = Math.max(0, Math.min(1, +val || 0));
    if (typeof VCH_WEAR_BASE !== "undefined") VCH_WEAR_BASE = v;
    if (typeof VCH_WEAR_U !== "undefined" && VCH_WEAR_U.uGain) {
      VCH_WEAR_U.uGain.value = v * ((typeof VCH_MAP !== "undefined" && VCH_MAP === 1) ? 1.18 : 1.0);
    }
    try { localStorage.setItem("vch36.wear", String(v)); } catch (e) {}
    syncWearUI();
  }

  function syncTankUI() {
    const meta = TANK_META[state.selectedTank] || TANK_META[0];
    const setT = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    setT("g-tank-name", meta.name);
    setT("g-tank-role", meta.role);
    setT("g-tank-desc", meta.desc);
    setT("g-spec-gun", meta.gun);
    setT("g-spec-mass", meta.mass);
    setT("g-spec-speed", meta.speed);
    setT("g-spec-reload", meta.reload);
    setT("g-top-tank", meta.name);

    const setBar = (id, pct) => {
      const el = document.getElementById(id);
      if (el) el.style.width = pct + "%";
    };
    setBar("g-bar-armor", meta.stats.armor);
    setBar("g-bar-power", meta.stats.power);
    setBar("g-bar-speed", meta.stats.speed);
    setBar("g-bar-reload", meta.stats.reload);

    const cards = document.querySelectorAll("#g-tank-cards .g-tcard");
    cards.forEach(c => {
      const idx = parseInt(c.dataset.tank, 10);
      c.classList.toggle("on", idx === state.selectedTank);
    });

    const scSt = document.getElementById("g-scorp-status");
    if (scSt) {
      if (state.scorpionReady) {
        scSt.textContent = "ГОТОВ";
        scSt.classList.remove("loading", "err");
        scSt.classList.add("ready");
      } else if (state.scorpionError) {
        scSt.textContent = "ОШИБКА";
        scSt.classList.remove("loading", "ready");
        scSt.classList.add("err");
      } else {
        scSt.textContent = "ЗАГРУЗКА…";
        scSt.classList.add("loading");
      }
    }
  }

  function syncMapUI() {
    if (!MAP_META.some(m => m.key === state.selectedMap)) state.selectedMap = "aleksandrovsk";
    const meta = MAP_META.find(m => m.key === state.selectedMap) || MAP_META[0];
    const loadedKey = (typeof VCH_MAP_KEY === "string") ? VCH_MAP_KEY : "aleksandrovsk";
    const needReload = state.selectedMap !== loadedKey;

    const setT = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
    setT("g-top-map", meta.name);
    setT("g-map-title", meta.name);
    setT("g-map-sub", meta.sub + " · " + meta.size);
    setT("g-map-desc", meta.desc);
    setT("g-map-grav", meta.grav);

    const reloadNote = document.getElementById("g-map-note");
    if (reloadNote) {
      reloadNote.textContent = needReload
        ? "При нажатии «В БОЙ!» загрузится локация " + meta.name
        : "Локация загружена в память — мгновенный старт";
      reloadNote.classList.toggle("pending", needReload);
    }

    const cards = document.querySelectorAll("#g-map-list .g-mcard");
    cards.forEach(c => {
      c.classList.toggle("on", c.dataset.map === state.selectedMap);
    });

    const sel = document.getElementById("mapselect");
    if (sel && sel.value !== state.selectedMap) sel.value = state.selectedMap;
  }

  function syncModeUI() {
    document.querySelectorAll("#g-mode-seg button").forEach(b => {
      b.classList.toggle("on", b.dataset.mode === state.selectedMode);
    });
  }

  function syncLiveryUI() {
    const cur = (typeof VCH_LIVERY_ON === "string") ? VCH_LIVERY_ON : "amber";
    document.querySelectorAll("#g-liv-seg button").forEach(b => {
      b.classList.toggle("on", b.dataset.liv === cur);
    });
  }

  function syncWearUI() {
    const cur = (typeof VCH_WEAR_BASE === "number") ? VCH_WEAR_BASE : 1;
    document.querySelectorAll("#g-wear-seg button").forEach(b => {
      b.classList.toggle("on", Math.abs(+b.dataset.wear - cur) < 0.01);
    });
  }

  function syncAllUI() {
    syncTankUI();
    syncMapUI();
    syncModeUI();
    syncLiveryUI();
    syncWearUI();
    const spinBtn = document.getElementById("g-btn-spin");
    if (spinBtn) spinBtn.classList.toggle("on", state.autoSpin);
    const turBtn = document.getElementById("g-btn-turret");
    if (turBtn) turBtn.classList.toggle("on", state.turretDemo);
    const litBtn = document.getElementById("g-btn-lights");
    if (litBtn) litBtn.classList.toggle("on", state.lightsOn);
  }

  /* ---- запуск в бой и возврат в гараж ----------------------------------- */
  function startSelectedMode() {
    const m = state.selectedMode;
    try {
      if (m === "battle" && typeof VCH_AI !== "undefined") {
        VCH_RANGE && VCH_RANGE.clear && VCH_RANGE.clear();
        VCH_TRACK && VCH_TRACK.clear && VCH_TRACK.clear();
        VCH_AI.start(2);
      } else if (m === "range" && typeof VCH_RANGE !== "undefined") {
        VCH_AI && VCH_AI.clear && VCH_AI.clear();
        VCH_TRACK && VCH_TRACK.clear && VCH_TRACK.clear();
        VCH_RANGE.start();
      } else if (m === "track" && typeof VCH_TRACK !== "undefined") {
        VCH_AI && VCH_AI.clear && VCH_AI.clear();
        VCH_RANGE && VCH_RANGE.clear && VCH_RANGE.clear();
        VCH_TRACK.start();
      }
    } catch (e) {
      console.warn("[garage mode]", e);
    }
  }

  function enterBattleNow() {
    if (typeof VCH_PENDING !== "undefined") VCH_PENDING = state.selectedTank;
    if (typeof VCH_TANKS !== "undefined" && state.selectedTank < VCH_TANKS.length && typeof setActiveTank === "function") {
      setActiveTank(state.selectedTank);
    }

    setGarageActive(false);

    const startEl = document.getElementById("start");
    const hudEl = document.getElementById("hud");
    if (startEl) startEl.classList.add("gone");
    if (hudEl) hudEl.classList.remove("hidden");

    if (typeof J !== "undefined") {
      J.started = true;
      J.aimMode = "cursor";
      J.camSwitch = 2;
    }
    document.body.classList.add("playing");
    document.exitPointerLock?.();

    try { an.init(); an.reload(); } catch (e) {}
    try { typeof uh === "function" && uh(); } catch (e) {}
    try { typeof aimSync === "function" && aimSync(); } catch (e) {}
    try { typeof vchTankBadge === "function" && vchTankBadge(); } catch (e) {}
    try { typeof J1 === "function" && J1(1 / 60); } catch (e) {}

    startSelectedMode();
  }

  function launch() {
    closeHelp();
    try { localStorage.setItem("vch36.tank", String(state.selectedTank)); } catch (e) {}
    try { localStorage.setItem("vch36.map", state.selectedMap); } catch (e) {}
    try { localStorage.setItem("vch36.mode", state.selectedMode); } catch (e) {}

    const loadedKey = (typeof VCH_MAP_KEY === "string") ? VCH_MAP_KEY : "aleksandrovsk";
    if (state.selectedMap !== loadedKey && typeof VCH_SETTINGS !== "undefined" && VCH_SETTINGS.goMap) {
      VCH_SETTINGS.goMap(state.selectedMap, true);
      return;
    }

    if (typeof VCH_FADE !== "undefined" && VCH_FADE && VCH_FADE.to) {
      VCH_FADE.to(() => {
        enterBattleNow();
        VCH_FADE.from(160);
      }, 180);
    } else {
      enterBattleNow();
    }
  }

  function open() {
    try {
      if (typeof VCH_AI !== "undefined" && VCH_AI.on) VCH_AI.clear();
      if (typeof VCH_RANGE !== "undefined" && VCH_RANGE.on) VCH_RANGE.clear();
      if (typeof VCH_TRACK !== "undefined" && VCH_TRACK.on) VCH_TRACK.clear();
    } catch (e) {}
    try {
      if (typeof an !== "undefined") {
        if (an.engineLevel) an.engineLevel.gain.value = 0;
        if (an.soilLevel) an.soilLevel.gain.value = 0;
      }
    } catch (e) {}
    if (typeof J !== "undefined") J.started = false;
    document.body.classList.remove("playing", "vch-modal");
    document.exitPointerLock?.();

    const startEl = document.getElementById("start");
    const hudEl = document.getElementById("hud");
    if (hudEl) hudEl.classList.add("hidden");
    if (startEl) startEl.classList.remove("gone");

    if (typeof VCH_TANKS !== "undefined" && typeof VCH_ACTIVE !== "undefined") {
      const idx = VCH_TANKS.indexOf(VCH_ACTIVE);
      if (idx >= 0) state.selectedTank = idx;
    }
    setGarageActive(true);
    syncAllUI();
  }

  function closeHelp() {
    const m = document.getElementById("g-help-modal");
    if (m) m.classList.add("hidden");
  }

  /* ---- подключение интерактивных событий DOM и мыши/тача --------------- */
  function bindUI() {
    const stage = document.getElementById("g-stage");
    if (stage) {
      const pointers = new Map();
      const getPinch = () => {
        if (pointers.size < 2) return 0;
        const pts = Array.from(pointers.values());
        return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      };
      stage.addEventListener("pointerdown", e => {
        if (!state.active) return;
        if (e.button === 2) return;
        stage.setPointerCapture?.(e.pointerId);
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size === 1) {
          state.dragging = true;
          state.lastX = e.clientX;
          state.lastY = e.clientY;
        } else if (pointers.size === 2) {
          state.pinchDist = getPinch();
        }
      });
      stage.addEventListener("pointermove", e => {
        if (!state.active || !pointers.has(e.pointerId)) return;
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size === 2) {
          const pd = getPinch();
          if (state.pinchDist > 0 && pd > 0) {
            state.tgtDist = Te.clamp(state.tgtDist * (state.pinchDist / pd), 5.6, 15.0);
          }
          state.pinchDist = pd;
          return;
        }
        if (!state.dragging) return;
        const dx = e.clientX - state.lastX;
        const dy = e.clientY - state.lastY;
        state.lastX = e.clientX;
        state.lastY = e.clientY;
        state.tgtYaw -= dx * 0.0068;
        state.tgtPitch = Te.clamp(state.tgtPitch + dy * 0.0052, 0.07, 0.90);
      });
      const up = e => {
        pointers.delete(e.pointerId);
        if (pointers.size < 2) state.pinchDist = 0;
        if (pointers.size === 0) state.dragging = false;
      };
      stage.addEventListener("pointerup", up);
      stage.addEventListener("pointercancel", up);
      stage.addEventListener("wheel", e => {
        if (!state.active) return;
        e.preventDefault();
        state.tgtDist = Te.clamp(state.tgtDist + e.deltaY * 0.007, 5.4, 16.5);
      }, { passive: false });
      stage.addEventListener("dblclick", () => {
        if (!state.active) return;
        state.tgtYaw = -0.66;
        state.tgtPitch = 0.24;
        state.tgtDist = (state.selectedTank === 1) ? 12.2 : 11.2;
      });
    }

    /* выбор танка по карточкам */
    document.querySelectorAll("#g-tank-cards .g-tcard").forEach(card => {
      card.addEventListener("click", () => {
        selectTank(parseInt(card.dataset.tank, 10) || 0, true);
      });
    });

    /* выбор карты */
    document.querySelectorAll("#g-map-list .g-mcard").forEach(card => {
      card.addEventListener("click", () => {
        selectMap(card.dataset.map, true);
      });
    });

    /* режим боя */
    document.querySelectorAll("#g-mode-seg button").forEach(btn => {
      btn.addEventListener("click", () => selectMode(btn.dataset.mode));
    });

    /* окраска */
    document.querySelectorAll("#g-liv-seg button").forEach(btn => {
      btn.addEventListener("click", () => setLivery(btn.dataset.liv));
    });

    /* износ */
    document.querySelectorAll("#g-wear-seg button").forEach(btn => {
      btn.addEventListener("click", () => setWear(btn.dataset.wear));
    });

    /* тулбар 3D-подиума */
    document.getElementById("g-btn-spin")?.addEventListener("click", () => {
      state.autoSpin = !state.autoSpin;
      syncAllUI();
    });
    document.getElementById("g-btn-turret")?.addEventListener("click", () => {
      state.turretDemo = !state.turretDemo;
      syncAllUI();
    });
    document.getElementById("g-btn-lights")?.addEventListener("click", () => {
      state.lightsOn = !state.lightsOn;
      syncAllUI();
    });
    document.getElementById("g-btn-fire")?.addEventListener("click", fireTest);
    document.getElementById("g-btn-reset-cam")?.addEventListener("click", () => {
      state.tgtYaw = -0.66;
      state.tgtPitch = 0.24;
      state.tgtDist = (state.selectedTank === 1) ? 12.2 : 11.2;
      state.spinAngle = 0.32;
    });
    document.getElementById("g-btn-glb")?.addEventListener("click", () => {
      document.getElementById("modelfile")?.click();
    });

    /* справка по клавишам */
    document.getElementById("g-btn-help")?.addEventListener("click", () => {
      document.getElementById("g-help-modal")?.classList.toggle("hidden");
    });
    document.getElementById("g-help-close")?.addEventListener("click", closeHelp);
    document.getElementById("g-help-modal")?.addEventListener("click", e => {
      if (e.target && e.target.id === "g-help-modal") closeHelp();
    });

    /* быстрый перебор качества в шапке гаража */
    document.querySelectorAll("#g-q-seg button").forEach(btn => {
      btn.addEventListener("click", () => {
        if (typeof VCH_SETTINGS !== "undefined") VCH_SETTINGS.setQ(btn.dataset.q);
        document.querySelectorAll("#g-q-seg button").forEach(b => {
          b.classList.toggle("on", b.dataset.q === (VCH_SETTINGS ? VCH_SETTINGS.q : "auto"));
        });
      });
    });
    if (typeof VCH_SETTINGS !== "undefined") {
      VCH_SETTINGS.load();
      document.querySelectorAll("#g-q-seg button").forEach(b => {
        b.classList.toggle("on", b.dataset.q === VCH_SETTINGS.q);
      });
    }

    /* клавиша Space в гараже — огневой тест */
    window.addEventListener("keydown", e => {
      if (!state.active) return;
      if (e.code === "Space" && !e.repeat) {
        const tag = (e.target && e.target.tagName) || "";
        if (!/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(tag)) {
          e.preventDefault();
          fireTest();
        }
      }
      if (e.code === "Enter" && !e.repeat) {
        const tag = (e.target && e.target.tagName) || "";
        if (!/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(tag)) {
          e.preventDefault();
          launch();
        }
      }
    });
  }

  /* ---- инициализация гаража и обработка autostart при смене карты ------- */
  let shouldAutoStart = false;
  try {
    if (sessionStorage.getItem("vch36.autostart") === "1") {
      sessionStorage.removeItem("vch36.autostart");
      shouldAutoStart = true;
    }
  } catch (e) {}

  bindUI();

  if (shouldAutoStart) {
    /* переход с другой карты после нажатия «В БОЙ!» — сразу запускаем бой */
    state.active = false;
    window.__vchGarageActive = false;
    enterBattleNow();
  } else {
    setGarageActive(true);
    syncAllUI();
  }

  /* если кто-то уже успел запечь/сменить ливрею до нас */
  try {
    const lv = localStorage.getItem("vch36.livery");
    if (lv && typeof VCH_LIVERY !== "undefined" && VCH_LIVERY[lv] && lv !== VCH_LIVERY_ON) {
      VCH_LIVERY_ON = lv;
      typeof vchLiveryApply === "function" && vchLiveryApply();
    }
    const wr = localStorage.getItem("vch36.wear");
    if (wr !== null && isFinite(+wr) && typeof VCH_WEAR_BASE !== "undefined") {
      VCH_WEAR_BASE = Math.max(0, Math.min(1, +wr));
    }
    syncLiveryUI();
    syncWearUI();
  } catch (e) {}

  window.__vchGarage = {
    get active() { return state.active; },
    get selectedMap() { return state.selectedMap; },
    get selectedTank() { return state.selectedTank; },
    turntableY: TURNTABLE_Y,
    state,
    tick,
    launch,
    open,
    closeHelp,
    fireTest,
    selectTank,
    selectMap,
    selectMode,
    setLivery,
    setWear,
    cycleTank: () => selectTank((state.selectedTank + 1) % 2, true),
    syncLiveryUI,
    syncWearUI,
    isSettled: () => {
      if (!state.settledAt) state.settledAt = performance.now();
      const elapsed = performance.now() - state.settledAt;
      if (typeof VCH_TANKS !== "undefined") {
        const sc = VCH_TANKS.find(t => t.id === "scorpion");
        if (sc && sc.rig && sc.rig.state && sc.rig.state.lift === undefined) return false;
      }
      return elapsed > 1600;
    },
    getDisplayRoots: () => {
      const out = [];
      if (gDisplayOBT && gDisplayOBT.group) out.push(gDisplayOBT.group);
      if (gDisplayScorpion && gDisplayScorpion.group) out.push(gDisplayScorpion.group);
      return out;
    },
    onScorpionReady: rig => buildScorpionDisplay(rig),
    onScorpionError: err => {
      state.scorpionError = (err && err.message) ? err.message : "ошибка декодирования";
      syncDisplayedTank();
      syncTankUI();
    },
    onCustomModel: rig => {
      if (rig && rig.custom && !rig.scorpion) {
        buildCustomDisplay(rig);
      } else {
        state.hasCustom = false;
        syncDisplayedTank();
      }
    },
    scene: () => gScene,
    turntable: () => gTurntable
  };
})();
