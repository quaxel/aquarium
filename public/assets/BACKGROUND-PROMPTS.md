# Tank arka planları — imagegen promptları

Oyun her tank için ayrı bir ortam çiziyor. Şu an bunlar **prosedürel** (shader ile,
`app/game/scene.ts` içindeki `SCENERY_FRAGMENT`). Aşağıdaki promptlarla görsel üretip
bu klasöre koyabilirsin; sekizini tek tek, istediğin sırayla ekleyebilirsin.

**Görsel eklemek iki adım:**

1. PNG'yi bu klasöre, tablodaki adla koy.
2. `app/game/content/progression.ts` içindeki `PAINTED_BACKDROPS` listesinde o tankın
   satırının yorumunu kaldır.

İkinci adım gereksiz görünebilir ama olmayan bir dosyaya referans vermek, görseli
henüz üretilmemiş her tank için her açılışta konsola 404 bastırıyor. Listede olmayan
tank prosedürel ortamında kalır.

| Tank | Dosya adı |
|---|---|
| 0 · Fanus | `tank-0-bowl.png` |
| 1 · Masaüstü Akvaryumu | `tank-1-desk.png` |
| 2 · Tropikal Tank | `tank-2-tropical.png` |
| 3 · Restoran Akvaryumu | `tank-3-restaurant.png` |
| 4 · Halka Açık Akvaryum | `tank-4-public.png` |
| 5 · Okyanus Araştırma Merkezi | `tank-5-research.png` |
| 6 · Denizaltı Habitatı | `tank-6-habitat.png` |
| 7 · Uzay Akvaryumu | `tank-7-space.png` |

## Teknik gereksinimler

- **Oran 16:9**, en az 1672×941 (referans `aquarium-background-v4.png` bu boyutta).
- **Kum çizgisi görüntünün altından yukarı doğru %36'da.** Bu pazarlık konusu değil:
  su shader'ındaki `SAND_LINE = .356` sabiti caustic'leri tam oraya düşürüyor.
  Hizalamazsan ışık deseni zemine oturmaz.
- **Orta alan boş kalsın.** Balıklar, yemler ve paralar orada yüzüyor; kompozisyonun
  ağırlığı sol ve sağ kenarda olmalı.
- Balık, yazı, arayüz, filigran, cam çerçevesi **yok**.

## Ortak stil bloğu

Her promptun başına bunu koy:

> Flat-shaded cartoon vector game background, 16:9. Soft airbrushed gradients, **no
> outlines**, saturated colours, simple rounded shapes. The sandy seabed meets the
> open water about 36% up from the bottom edge. A large soft pool of light glows in
> the centre of the floor and falls off toward the corners. Silhouette shapes in a
> single darker tone stand along the horizon, densest at the far left and far right
> edges, leaving the centre open. No fish, no characters, no text, no watermark, no
> UI, no frame.

En güvenilir yol: **düzenleme modu**. `aquarium-background-v4.png`'yi girdi ver ve
"keep the exact same art style and composition, only change the environment to …"
de. Sıfırdan üretmekten çok daha tutarlı sonuç veriyor.

## Ortamlar

### 0 · Fanus — `tank-0-bowl.png`
> A tiny sunlit goldfish bowl interior. Very shallow, cosy and sparse. Pale warm
> cream gravel instead of sand. Light warm turquoise water, bright and gentle. Only
> a few small rounded pond-plant leaves in a muted blue-green, low and short, at the
> very left and right edges. Lots of empty water.

### 1 · Masaüstü Akvaryumu — `tank-1-desk.png`
> A planted freshwater desk aquarium. Tall thin dark-green grass blades crowding both
> ends of the tank, a few broad leaves among them. Fine grey-brown gravel. Cool green
> teal water lit from directly above, as if by a lamp on the lid.

### 2 · Tropikal Tank — `tank-2-tropical.png`
> A warm tropical reef. Dense rounded coral heads and brain corals running along the
> whole horizon, not just the edges. Bright golden sand. Warm turquoise water. Deep
> teal silhouettes, with a few warmer orange-pink coral shapes among them.

### 3 · Restoran Akvaryumu — `tank-3-restaurant.png`
> A large display tank set into a restaurant wall. Deep blue-teal water, noticeably
> darker and more elegant than a reef. A dark rounded archway frames the top corners,
> as if looking through an opening in the wall. Warm amber lamps glow along the back
> at the sand line. Dark slate gravel. Restrained, few shapes, expensive-looking.

### 4 · Halka Açık Akvaryum — `tank-4-public.png`
> A vast public-aquarium viewing window. One huge dark rounded tunnel arch frames the
> whole scene. Beyond it a wide open expanse of bright blue ocean water, almost empty,
> with the seabed falling away into haze. Pale grey-blue sand. A few distant cool
> white viewing lights near the horizon. Sense of enormous scale.

### 5 · Okyanus Araştırma Merkezi — `tank-5-research.png`
> A clinical marine research facility tank. Behind the water, a wall of steel panels,
> pipes and thin vertical struts in dark blue-grey silhouette, evenly spaced across
> the whole width. Cool cyan-white instrument lights in a row. Grey engineered gravel.
> Cold, clean, technical — no plants.

### 6 · Denizaltı Habitatı — `tank-6-habitat.png`
> A deep-sea habitat on the ocean floor. Near-black navy water with almost no light
> from above. Tall jagged black rock spires and chimneys along the horizon. Turquoise
> bioluminescent glow spots scattered at their bases. Dark grey volcanic sand. Moody
> and pressurised.

### 7 · Uzay Akvaryumu — `tank-7-space.png`
> An orbital aquarium. Deep indigo-violet water. Above the horizon, open black space
> with a field of small stars, and the bright curved limb of a planet filling the
> upper right corner, lit from the left. Pale violet-grey regolith floor. A few low
> dark habitat structures on the horizon. Serene, cosmic.
