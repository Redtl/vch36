# Сторонние компоненты

Список того, что в репозитории не авторское. Перед публикацией в открытый
доступ вычитайте этот файл и при необходимости дополните.

## Код

| компонент | где лежит | лицензия |
|---|---|---|
| three.js | `vendor/three-cannon.js` (в бандле, минифицирован) | MIT © 2010–2024 Three.js Authors |
| cannon-es (физика) | `vendor/three-cannon.js` (в бандле, минифицирован) | MIT |

Бандл собран заранее и лежит как есть: содержит лицензионную шапку
`@license Copyright 2010-2024 Three.js Authors · SPDX-License-Identifier: MIT`
в начале файла.

## Графика и модели

| ассет | где лежит | источник | лицензия |
|---|---|---|---|
| Локация «Александровск» (`aleksandrovsk_mm.glb`) | `data/aleksandrovsk-glb.js`, `data/aleksandrovsk-heightfield.js` | Sketchfab, автор **DageLV**; копия исходника — `github.com/Redtl/map3` | **CC-BY-4.0** — требуется указание автора |
| Локация «Карта 01» (`map_01.glb`) | `data/map01-glb.js`, `data/map01-heightfield.js` | исходник — `github.com/Redtl/map2` (`map_01.glb`) | свой репозиторий, лицензию указать по желанию |
| Модель Scorpion (`Scorpion4.glb`) | `data/scorpion-glb.js` | исходник — `github.com/Redtl/scorpion4` (`Scorpion4.glb`) | свой репозиторий, лицензию указать по желанию |
| Небо карты 01 | `data/map01-sky-hdri.js` | Poly Haven, `industrial_sunset_02_puresky` | **CC0** |
| Панорама рассвета | `data/sunrise-sky-hdri.js` | Poly Haven, `qwantani_sunrise_puresky` (4K) | **CC0** |

Позиции «карта 01» и «Scorpion» закрыты: по именам файлов исходники
нашлись в ваших же репозиториях `Redtl/map2` (`map_01.glb`) и
`Redtl/scorpion4` (`Scorpion4.glb`), модель Александровска — в `Redtl/map3`
(`aleksandrovsk_mm.glb`, оригинал DageLV). Сверьте, что это те самые версии,
и при желании укажите для своих моделей лицензию.

## Звук

`js/07a-audio-pcm.js` — пять сэмплов (выстрел, отдача, двигатель, грунт,
взрыв). Синтезированы для проекта (комментарии в `js/07-audio.js` описывают
синтез: «Short 0.55 s bright crack: band-limited noise 2.6–11 kHz…»),
сторонних прав не требует.

## Указание авторства (для CC-BY-4.0)

Минимум, который стоит вынести в README и на страницу игры:

> Локация «Александровск» — `aleksandrovsk_mm.glb` by **DageLV**,
> Sketchfab, лицензия CC-BY-4.0.
> Небо — Poly Haven (`industrial_sunset_02_puresky`,
> `qwantani_sunrise_puresky`), CC0.
> Графика — three.js (MIT), физика — cannon-es (MIT).
