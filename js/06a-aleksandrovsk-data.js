/*
  06a · ДАННЫЕ КАРТЫ (АВТОГЕНЕРАЦИЯ, не править руками).
  Источник: map_full.glb, сборка tools/inline_map.py
  Модель: 543 узлов, 526 мешей,
    треугольников 625158, материалов 0
  Танк-эталон: «BerserkBody», длина 5.761 ширина 3.661 высота 1.878 -> масштаб 1.784
  Карта высот: 598×601 (0.15 м/ячейка), int16, -11.023..14.642, «поле» -4.200
  GLB вшит gzip+base64 (браузер распаковывает DecompressionStream): file:// без сети.
*/
"use strict";
const VCH_MAP01_DATA={
  src:"map_full.glb",
  bx0:-31.768385, bx1:57.714776, bz0:-41.417664, bz1:48.524816,
  resX:598, resZ:601,
  cx:-20.3769, cz:11.4985,
  spawn:{"x": -20.376894152928685, "z": 11.498494705010316, "y": -4.2338175773620605, "flat": 8.881784197001252e-16},
  yMin:-11.022647, yMax:14.642319, yTop:-4.200000,
  tankCenter:[-10.8048,-3.3001,21.7142],
  tank:{name:"BerserkBody",L:5.7614,W:3.6611,H:1.8782,center:[-10.8048,-3.3001,21.7142],scaleW:0.8877,scaleL:1.0553,scaleH:1.7943,scale:1.7835,mapScale:1.5000},
  get glbGz(){return (typeof VCH_ALEKS_GLB_GZ!=="undefined")?VCH_ALEKS_GLB_GZ:window.VCH_ALEKS_GLB_GZ},
  get hf(){return (typeof VCH_ALEKS_HF_B64!=="undefined")?VCH_ALEKS_HF_B64:window.VCH_ALEKS_HF_B64}
};
