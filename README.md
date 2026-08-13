# Fish Tank Empire

Küçük, kirli bir fanusla başlayan bir incremental oyun. Ana eylem soyut bir buton
değil: **suyun içine tıklayıp sürükleyerek yem serpiyorsun**, balıklar yeme
saldırıyor, para saçılıyor, sistem yavaş yavaş kontrolden çıkıyor.

```bash
npm install
npm run dev     # http://localhost:3000
```

## Temel döngü

```
yem serp → balık saldırıp yer → büyür → para üretir → topla
   → yükselt → yeni tür aç → sinerji kur → otomasyona geç → daha büyük tank
```

Oyuncunun rolü zamanla değişir: **işçi → akvaryum yöneticisi → ekosistem
tasarımcısı**. İlk on dakika elle yem atarsın; sonra yemliğin konumunu, yem
türünü, balık kombinasyonunu ve üretim zincirini yönetirsin.

Her türün yanında **🧬 Sürü Seviyesi** var: sınırsız, üstel fiyatlı yetiştirme
programı. Tank dolduktan sonra bile her zaman alacak bir şey olmasını sağlayan —
ve ekonominin tahterevallisini kuran — şey odur. Ayrıntısı için [Ekonomi](#ekonomi).

## Sistemler

### Feeding Frenzy

Yenen her lokma combo sayacını ilerletir. Sayaç durursa yavaşça erir.

| Combo | Çarpan |
|------:|-------:|
| 0     | ×1 |
| 5     | ×1.4 |
| 14    | ×1.8 |
| 30    | ×2.4 |
| 55    | ×3.2 |
| 90    | **FRENZY** |

Frenzy sırasında tank delirir: gökten bedava yem yağar, balıklar hızlanır, ekran
sallanır, çerçeve altına döner ve üretim `frenzyPower` (×6 → ×18) ile çarpılır.
Bittikten sonra 25 saniyelik bekleme var — yoksa tank frenzy'den hiç çıkmıyor ve
oyunun en büyük anı sıradan hâle geliyor.

### 15 tür, 15 farklı makine

Balıklar dekorasyon değil üretim makineleri. Her biri suda **gözle görülür** başka
bir şey yapar:

| Tür | Ne yapar |
|---|---|
| 🐟 Japon Balığı | Yem → para. Temel. |
| 🐠 Neon Tetra | Yanındaki her tetra için +%22 (sürü) |
| 🐌 Salyangoz | Suyu temizler |
| 🦐 Karides | Dibe düşen paraları toplar |
| 🤡 Palyaço | Şakayıkla eşleşince pasif gelir |
| 👼 Melek Balığı | Yavaş çiğner, lokması ağır |
| 🐡 Kirpi | 12 lokmada şişip **PATLAR**, biriktirdiğinin 3.4 katını saçar |
| 🦀 Yengeç | Kum kazar + dipten toplar |
| 🥏 Vatoz | Kumu süpürüp gömülü sandık çıkarır |
| ⚡ Yılan Balığı | 9 sn'de bir şok: menzildeki balıklar 5 sn ×3 |
| 🎐 Denizanası | Baloncukları paraya çevirir + pasif gelir |
| 🐙 Ahtapot | Aynı anda 8 nesne toplar |
| 🏮 Fener Balığı | Yemleri kendine çeker |
| 🦈 Köpekbalığı | Küçük balıkları yer, değerlerini kalıcı devralır |
| 🎏 Altın Koi | Hiç yemeden basar |

### Sinerjiler

Asıl soru: *hangi balıkları aynı tankta tutarsan sistem kırılır?* 11 keşfedilebilir
kombinasyon var; panel sahip olmadan önce de şartı gösterir.

- **Temizlik Anlaşması** 🦐🦈 — karides köpekbalığını temizler → ×3
- **Patlat ve Topla** 🐡🐙 — kirpi patlar, ahtapot anında toplar → +%60
- **Toplu Elektrik** ⚡🐠 — 5 tetralık sürüde şok zincirlenir → tüm tank frenzy'e girer
- **Kum Ekibi** 🥏🦀 — her kazı iki hazine
- **Ev Sahibi** 🤡🪸, **Berrak Su** 👼🐌, **Koi Çifti** 🎏, **Hazine Avcısı** 🐙💎 …

### Yemler de bir ilerleme hattı

Normal yem sonsuza kadar bedava (tıklama hiç kurumasın diye). Üstündekiler adet
başına para yakar ve fiyatları **tanktaki en iyi balığın üretimine oranlıdır** —
böylece uzay akvaryumunda bir solucan bedavaya düşmez.

🟤 Normal · 🦐 Karides · 🪱 Solucan (suda ikiye bölünür) · ⭐ Yıldız (combo +4) ·
💥 Patlayıcı (yenince 5 yem fırlatır → zincirleme reaksiyon) · 🌈 Gökkuşağı
(%12 kalıcı nadir varyant) · ☢️ Mutant (8 sn ×5 çılgınlık) · ✨ Altın Krill

### Kirli su

Yenmeyen yem dibe çöker ve çürür. Kirlilik üretimi %45'e kadar düşürür; salyangoz,
karides ve filtre temizler. Aşırı beslemenin bedeli var.

### Tanklar (prestige)

Soyut bir reset yok — **tankı satıp daha büyüğüne taşınıyorsun**.

Fanus (4 balık) → Masaüstü (9) → Tropikal (15) → Restoran (24) → Halka Açık (36)
→ Araştırma Merkezi (52) → Denizaltı Habitatı (72) → Uzay Akvaryumu (100)

Taşınınca **Ün** kazanırsın: kalıcı, her yeni run'ı hızlandıran ve yeni türler açan
para birimi. Tank fiziksel olarak da büyür: aynı cam artık çok daha fazla, çok daha
küçük balık tutar.

Her tankın **kendi ortamı** var — su gradyanı, zemin, ufuk silueti ve fener/yıldız/
gezegen gibi öğeler tank verisinden geliyor ve tek bir shader'da çiziliyor
(`SCENERY_FRAGMENT`). Boyalı arka plan koymak istersen `public/assets/` içine
`tank-N-*.png` bırakman yeterli: dosya varsa o tank görsele geçer, yoksa prosedürel
ortamda kalır. Promptlar [assets/BACKGROUND-PROMPTS.md](public/assets/BACKGROUND-PROMPTS.md)
içinde — kum çizgisi hizası dahil.

## Mimari

Katmanlar birbirini tanımaz; her biri tek yöne bakar.

```
app/game/
  content/      saf veri: türler, yemler, upgrade'ler, tanklar, dekor, sinerjiler
  types.ts      ortak sözlük
  sprites.ts    prosedürel pixel-art atlas (canvas → doku)
  game.ts       kalıcı state, türetilmiş çarpanlar, satın almalar, kayıt
  world.ts      simülasyon: entity'ler, AI, fizik, combo/frenzy, yetenekler
  scene.ts      Three.js: su/caustic/god-ray shader'ları, instanced havuzlar
  ui/           React HUD ve mağaza
  FishTankEmpire.tsx   RAF döngüsü + girdi
```

**React kareyi görmez.** Simülasyon `game.touch()` ile "kirli" işaretler; RAF
döngüsü saniyede 12 kez `game.flush()` çağırır ve tek bir `useSyncExternalStore`
aboneliği tüm ağacı günceller. Uçuşan `+42` yazıları React'e hiç uğramaz — havuzdan
alınan DOM düğümleriyle doğrudan konumlandırılır.

**Sprite'lar kodla üretilir.** 15 canlı, 44×30 piksel çözünürlükte kendi mini
raster motorunda çizilir (elips/poligon tarama, dikey gölgeleme, kontur geçişi),
4× nearest ile büyütülür ve tek bir atlasa yerleştirilir. Dış görsel gerekmez.

**Su, ışık ve derinlik** projede zaten olan shader'lardan gelir: floor'a
projekte edilen caustic ağı, yüzey kırılması, god-ray şaftları ve katmanlar arası
atmosferik perspektif.

### Performans

M3 Pro'da 43 balık, ~200 yem, ~150 para ve ~400 parçacıkla:

| | süre |
|---|---|
| `world.step` | 0.47 ms |
| `scene.render` | 1.35 ms |

Yem, para, parçacık ve baloncuklar tek `InstancedMesh` havuzlarında; balıklar tek
atlas dokusunu paylaşan ayrı mesh'ler (undulation vertex shader'ı için).

## Ekonomi

Ekonomi tür standartlarına göre kuruldu: **maliyet üstel, gelir doğrusal**. Bütün
sayılar birkaç isimli sabitten türüyor; elle seçilmiş sihirli sayı yok.

### 1. Tür merdiveni — sabit geri ödeme

Her tür `production = baseValue / chew` (balık başına coin/sn) üzerinde geometrik
bir basamakta oturur:

```
production(k) = 5.5 × 4^k          k = basamak, 0..14
baseCost(k)   = production(k) × 45  → her basamakta 45 saniyelik geri ödeme
```

Sabit geri ödeme, oyunun her kademesinde satın almanın aynı hissettirmesini
sağlar. Yeteneği asıl değeri olan türler (toplayıcı, temizlikçi, kazıcı, yılan
balığının buff'ı) merdivenden **iki taraflı** iskonto alır: daha az üretir, daha
az tutarlar.

`costGrowth` her türde **1.12** — türün 1.07–1.15 bandında, alt uçta. Alt uç
önemli: N slotluk tankı doldurmanın maliyeti `base×(g^N−1)/(g−1)`, yani N'de
üstel, ve tavanlar 4 → 100 gidiyor. 1.15'te son tanklar gelir merdiveninden bir
kat daha pahalı doluyor; testte bu tek başına 34 dakikalık bir tank olarak çıktı.

### 2. Sürü Seviyesi — sürekli para kuyusu

Tank balık sayısını sert sınırladığı için, o olmadan mağaza her run'ın ikinci
dakikasında kuruyor ve geri kalanı bekleyerek geçiyordu. Sürü Seviyesi eksik olan
üstel kuyu: **sınırsız**, seviye başına **1.15×** fiyat, **doğrusal +%25** üretim.

Üstel maliyete karşı doğrusal gelir — türün üzerine kurulduğu tahterevalli budur;
her sonraki alımın bir öncekinden biraz daha uzun sürmesini sağlayan şey odur.

25 seviyede bir **×1.5 kilometre taşı** var. Saf doğrusal artış yüksek seviyede
ölüyor (bir sonraki +%25 yüzdenin küsuratı kalırken fiyat hâlâ %15 tırmanıyor) ve
run düz bir beklemeye dönüşüyor; kilometre taşları hem pisti canlı tutuyor hem de
run'a türün istediği "hızlı alım tümseği" ritmini veriyor. Boyu hassas: ×2/20
seviyede uzun bir run ×2.6M tür çarpanına ulaşıp son iki tankı ikişer dakikaya
düşürüyordu.

### 3. Combo — ödül, ekonominin kendisi değil

Combo ×16, tam bir tür kademesinden daha ağır basıyordu; "daha hızlı tıkla"
yanında diğer bütün kararlar gürültüye dönüşüyordu. Tür normu aktif/pasif farkını
tek haneli tutuyor:

`×1 → ×1.4 → ×1.8 → ×2.4 → ×3.2`, frenzy `×6` (yükseltmeyle ×18).

### 4. Prestige — kök + **doğrusal** çarpan

```
ün      = 3 × (run kazancı / 25.000)^0.35
çarpan  = 1 + ün × 0.12
```

Türün standart şekli. Alt-doğrusal üssü alt-doğrusal bir çarpanın içine koymak
(`^0.33` → `rep^0.7`) çarpanı tank merdiveninin soğurabileceğinden hızlı
bileşikleştiriyor, her run bir öncekinden kısa çıkıyor ve oyun yirmi dakikada
bitiyordu. Doğrusal çarpanda katlamak için ~6 katı kazanç gerekir — aranan
kendi kendini sınırlayan özellik bu.

### 5. Tank merdiveni — tek düğme

```ts
const TANK_BASE = 25000;
const TANK_RATIO = 200;   // moveRequirement = TANK_BASE × TANK_RATIO^index
```

Her tank geliri kendi başına ~156× artırıyor (×16 iki tür basamağı, ×1.5 kapasite,
×6.5 son taşınmanın ödediği ün). Eşik ×200 ile bunun biraz üstünde tutuluyor; o
pay, her tankın bir öncekinden biraz **uzun** sürmesini sağlayan şey.

### Ölçüm

Kalibrasyon tarayıcıda hızlandırılmış simülasyonla yapıldı: saniyede 2 kez yem
atan, hiç durmayan, hep en iyisini alan bir "süper oyuncu" modeli.

| Tank geçişi | 0→1 | 1→2 | 2→3 | 3→4 | 4→5 | 5→6 | 6→7 |
|---|---|---|---|---|---|---|---|
| sim-dakika | 6.0 | 7.3 | 6.4 | 7.3 | 5.4 | 4.9 | 2.3 |

Tam oyun ~40 simülasyon dakikası. Gerçek oyuncu bu tempoyu tutturamayacağı için
pratikte birkaç saatlik bir oyun.

Konsoldan kendin oynayabilirsin: `__tank.game` ve `__tank.world` açık.

## Kayıt

`localStorage` (`fish-tank-empire/v2`), 15 saniyede bir, sekme arka plana alınırken
ve kapanırken kaydedilir. Oyun kapalıyken veya sekme askıdayken ekonomi ilerlemez;
çevrimdışı kazanç yoktur.
