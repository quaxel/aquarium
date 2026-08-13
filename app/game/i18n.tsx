"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { FoodId, SpeciesId, UpgradeCategory } from "./types";

export type Language = "tr" | "en" | "de" | "fr";
type Params = Record<string, string | number>;

export const LANGUAGE_OPTIONS: { id: Language; label: string; short: string }[] = [
  { id: "tr", label: "Türkçe", short: "TR" },
  { id: "en", label: "English", short: "EN" },
  { id: "de", label: "Deutsch", short: "DE" },
  { id: "fr", label: "Français", short: "FR" },
];

const UI = {
  tr: {
    loading: "tank dolduruluyor…", status: "DURUM", shop: "MAĞAZA", food: "YEM",
    dirty: "SU KİRLENDİ — üretim %{percent} düşük", paused: "DURAKLATILDI",
    resetConfirm: "Tüm ilerleme silinecek. Emin misin?", reputation: "ÜN",
    permanentMultiplier: "Kalıcı çarpan {value}", pause: "Duraklat", autoFeeder: "Otomatik yemlik",
    sharkDiet: "Köpekbalığı avlansın mı?", debug: "Debug paneli", reset: "Sıfırla",
    gameStatus: "Oyun durumu", money: "PARA", second: "SANİYE", fish: "BALIK", multiplier: "ÇARPAN",
    frenzyAfter: "frenzy {seconds} sn sonra", combo: "{count} combo", foodChoice: "Yem seçimi",
    each: "/adet", free: "bedava", water: "SU", pelletsCoins: "{pellets} yem · {coins} para",
    dirtHint: "Kirlilik: üretim {value}",
    tabFish: "BALIK", tabUpgrades: "YÜKSELTME", tabDecor: "DEKOR", tabSynergy: "SİNERJİ",
    tabTank: "TANK", tabStats: "KAYIT", capacity: "Tank kapasitesi {current}/{cap}. Daha fazla balık için daha büyük tanka taşın.",
    perSecondShort: "/sn", perBite: "{value} / lokma", breeding: "🧬 Sürü sv.{level}",
    breedingHint: "Yetiştirme programı: bu türün üretimini kalıcı olarak artırır", milestone: "×1.35'e {count}",
    locked: "Henüz açılmadı", tankFull: "TANK DOLU", buy: "SATIN AL", sell: "SAT +{value}",
    sellHint: "En küçük olanı sat ve slotu boşalt", required: "Gerekli", level: "sv.", max: "MAKS", get: "AL",
    decorNote: "Dekorlar tankta görünür ve kalıcı bonus verir. Bazı balıklar onlarla sinerji kurar.",
    allProduction: "tüm üretim {value}", collectedValue: "toplanan değer {value}", specialEffect: "özel etki", place: "YERLEŞTİR",
    synergyNote: "Asıl soru şu: hangi balıkları aynı tankta tutarsan sistem kırılır?", active: "AKTİF",
    next: "SONRAKİ", fishCapacity: "{count} balık kapasitesi", reputationGain: "KAZANILACAK ÜN",
    permanent: "kalıcı {value}", move: "BÜYÜK TANKA TAŞIN", moneyMore: "{value} para daha",
    moveWarning: "Taşınınca balıklar, yükseltmeler ve dekorlar satılır; ün, açılan yemler ve türler kalır.",
    lastTank: "Son tanktasın. Buradan sonrası sadece daha fazlası.", tankChain: "Tank Zinciri", fishCount: "{count} balık",
    records: "Kayıtlar", fishStages: "Balık Kademeleri", developer: "GELİŞTİRİCİ", debugPanel: "DEBUG PANELİ",
    closeDebug: "Debug panelini kapat", goTank: "TANKA GİT", amount: "MİKTAR", add: "+ EKLE", remove: "− ÇIKAR",
    language: "Dil", stats: ["Toplam kazanç", "Bu tankta", "Serpilen yem", "Yenen yem", "İsabet oranı", "En yüksek combo", "Frenzy sayısı", "Kirpi patlaması", "Kazı", "Avlanan balık", "Nadir varyant", "Oynama süresi", "Toplam ün"],
  },
  en: {
    loading: "filling the tank…", status: "STATUS", shop: "SHOP", food: "FOOD",
    dirty: "WATER IS DIRTY — production down {percent}%", paused: "PAUSED",
    resetConfirm: "All progress will be erased. Are you sure?", reputation: "REP",
    permanentMultiplier: "Permanent multiplier {value}", pause: "Pause", autoFeeder: "Auto feeder",
    sharkDiet: "Let the shark hunt?", debug: "Debug panel", reset: "Reset",
    gameStatus: "Game status", money: "COINS", second: "PER SEC", fish: "FISH", multiplier: "MULTIPLIER",
    frenzyAfter: "frenzy in {seconds}s", combo: "{count} combo", foodChoice: "Food selection",
    each: "/each", free: "free", water: "WATER", pelletsCoins: "{pellets} food · {coins} coins",
    dirtHint: "Dirt: production {value}",
    tabFish: "FISH", tabUpgrades: "UPGRADES", tabDecor: "DECOR", tabSynergy: "SYNERGY",
    tabTank: "TANK", tabStats: "STATS", capacity: "Tank capacity {current}/{cap}. Move to a larger tank for more fish.",
    perSecondShort: "/s", perBite: "{value} / bite", breeding: "🧬 School lv.{level}",
    breedingHint: "Breeding program: permanently increases this species' production", milestone: "{count} to ×1.35",
    locked: "Not unlocked yet", tankFull: "TANK FULL", buy: "BUY", sell: "SELL +{value}",
    sellHint: "Sell the smallest one and free a slot", required: "Requires", level: "lv.", max: "MAX", get: "BUY",
    decorNote: "Decor appears in the tank and grants permanent bonuses. Some fish create synergies with it.",
    allProduction: "all production {value}", collectedValue: "collected value {value}", specialEffect: "special effect", place: "PLACE",
    synergyNote: "The real question: which fish break the system when kept together?", active: "ACTIVE",
    next: "NEXT", fishCapacity: "{count} fish capacity", reputationGain: "REPUTATION GAIN",
    permanent: "permanent {value}", move: "MOVE TO BIGGER TANK", moneyMore: "{value} more coins",
    moveWarning: "Moving sells fish, upgrades and decor; reputation, unlocked food and species remain.",
    lastTank: "You are in the final tank. From here, it only gets bigger.", tankChain: "Tank Chain", fishCount: "{count} fish",
    records: "Records", fishStages: "Fish Stages", developer: "DEVELOPER", debugPanel: "DEBUG PANEL",
    closeDebug: "Close debug panel", goTank: "GO TO TANK", amount: "AMOUNT", add: "+ ADD", remove: "− REMOVE",
    language: "Language", stats: ["Total earnings", "This tank", "Food dropped", "Food eaten", "Hit rate", "Best combo", "Frenzies", "Puffer pops", "Digs", "Fish devoured", "Rare variants", "Play time", "Total reputation"],
  },
  de: {
    loading: "Aquarium wird gefüllt…", status: "STATUS", shop: "LADEN", food: "FUTTER",
    dirty: "WASSER IST SCHMUTZIG — Produktion {percent}% niedriger", paused: "PAUSIERT",
    resetConfirm: "Der gesamte Fortschritt wird gelöscht. Bist du sicher?", reputation: "RUHM",
    permanentMultiplier: "Dauerhafter Multiplikator {value}", pause: "Pause", autoFeeder: "Futterautomat",
    sharkDiet: "Soll der Hai jagen?", debug: "Debug-Menü", reset: "Zurücksetzen",
    gameStatus: "Spielstatus", money: "MÜNZEN", second: "PRO SEK.", fish: "FISCHE", multiplier: "MULTIPLIKATOR",
    frenzyAfter: "Frenzy in {seconds}s", combo: "{count} Combo", foodChoice: "Futterauswahl",
    each: "/Stück", free: "gratis", water: "WASSER", pelletsCoins: "{pellets} Futter · {coins} Münzen",
    dirtHint: "Schmutz: Produktion {value}",
    tabFish: "FISCHE", tabUpgrades: "UPGRADES", tabDecor: "DEKO", tabSynergy: "SYNERGIE",
    tabTank: "BECKEN", tabStats: "DATEN", capacity: "Kapazität {current}/{cap}. Ziehe für mehr Fische in ein größeres Becken.",
    perSecondShort: "/s", perBite: "{value} / Bissen", breeding: "🧬 Schwarm St.{level}",
    breedingHint: "Zuchtprogramm: erhöht dauerhaft die Produktion dieser Art", milestone: "noch {count} bis ×1,35",
    locked: "Noch nicht freigeschaltet", tankFull: "BECKEN VOLL", buy: "KAUFEN", sell: "VERKAUF +{value}",
    sellHint: "Verkaufe den kleinsten Fisch und mache einen Platz frei", required: "Benötigt", level: "St.", max: "MAX", get: "KAUFEN",
    decorNote: "Deko ist im Becken sichtbar und gibt dauerhafte Boni. Manche Fische erzeugen Synergien.",
    allProduction: "Gesamtproduktion {value}", collectedValue: "Sammelwert {value}", specialEffect: "Spezialeffekt", place: "PLATZIEREN",
    synergyNote: "Die echte Frage: Welche Fische brechen gemeinsam das System?", active: "AKTIV",
    next: "NÄCHSTES", fishCapacity: "Platz für {count} Fische", reputationGain: "RUHMGEWINN",
    permanent: "dauerhaft {value}", move: "IN GRÖSSERES BECKEN", moneyMore: "noch {value} Münzen",
    moveWarning: "Beim Umzug werden Fische, Upgrades und Deko verkauft; Ruhm sowie freigeschaltetes Futter und Arten bleiben.",
    lastTank: "Du bist im letzten Becken. Ab hier wird alles nur größer.", tankChain: "Beckenfolge", fishCount: "{count} Fische",
    records: "Rekorde", fishStages: "Fischstufen", developer: "ENTWICKLER", debugPanel: "DEBUG-MENÜ",
    closeDebug: "Debug-Menü schließen", goTank: "ZU BECKEN", amount: "MENGE", add: "+ HINZU", remove: "− ABZIEHEN",
    language: "Sprache", stats: ["Gesamteinnahmen", "Dieses Becken", "Futter gestreut", "Futter gefressen", "Trefferquote", "Beste Combo", "Frenzys", "Kugelfisch-Platzer", "Grabungen", "Gefressene Fische", "Seltene Varianten", "Spielzeit", "Gesamtruhm"],
  },
  fr: {
    loading: "remplissage de l'aquarium…", status: "ÉTAT", shop: "BOUTIQUE", food: "NOURRITURE",
    dirty: "EAU SALE — production réduite de {percent}%", paused: "EN PAUSE",
    resetConfirm: "Toute la progression sera effacée. Continuer ?", reputation: "RENOM",
    permanentMultiplier: "Multiplicateur permanent {value}", pause: "Pause", autoFeeder: "Distributeur automatique",
    sharkDiet: "Autoriser le requin à chasser ?", debug: "Panneau de débogage", reset: "Réinitialiser",
    gameStatus: "État du jeu", money: "PIÈCES", second: "PAR SEC.", fish: "POISSONS", multiplier: "MULTIPLICATEUR",
    frenzyAfter: "frénésie dans {seconds}s", combo: "combo {count}", foodChoice: "Choix de nourriture",
    each: "/unité", free: "gratuit", water: "EAU", pelletsCoins: "{pellets} aliments · {coins} pièces",
    dirtHint: "Saleté : production {value}",
    tabFish: "POISSONS", tabUpgrades: "AMÉLIORATIONS", tabDecor: "DÉCOR", tabSynergy: "SYNERGIE",
    tabTank: "AQUARIUM", tabStats: "STATS", capacity: "Capacité {current}/{cap}. Passez à un aquarium plus grand pour ajouter des poissons.",
    perSecondShort: "/s", perBite: "{value} / bouchée", breeding: "🧬 Banc niv.{level}",
    breedingHint: "Élevage : augmente définitivement la production de cette espèce", milestone: "{count} avant ×1,35",
    locked: "Pas encore débloqué", tankFull: "AQUARIUM PLEIN", buy: "ACHETER", sell: "VENDRE +{value}",
    sellHint: "Vendre le plus petit et libérer une place", required: "Requis", level: "niv.", max: "MAX", get: "ACHETER",
    decorNote: "Les décors apparaissent dans l'aquarium et donnent des bonus permanents. Certains poissons créent des synergies.",
    allProduction: "production totale {value}", collectedValue: "valeur collectée {value}", specialEffect: "effet spécial", place: "PLACER",
    synergyNote: "La vraie question : quels poissons brisent le système ensemble ?", active: "ACTIF",
    next: "SUIVANT", fishCapacity: "capacité de {count} poissons", reputationGain: "RENOM GAGNÉ",
    permanent: "permanent {value}", move: "PASSER AU GRAND AQUARIUM", moneyMore: "encore {value} pièces",
    moveWarning: "Le transfert vend poissons, améliorations et décors ; le renom et les éléments débloqués restent.",
    lastTank: "Vous êtes dans le dernier aquarium. Ensuite, tout devient simplement plus grand.", tankChain: "Suite d'aquariums", fishCount: "{count} poissons",
    records: "Records", fishStages: "Stades des poissons", developer: "DÉVELOPPEUR", debugPanel: "PANNEAU DEBUG",
    closeDebug: "Fermer le panneau", goTank: "ALLER À L'AQUARIUM", amount: "MONTANT", add: "+ AJOUTER", remove: "− RETIRER",
    language: "Langue", stats: ["Gains totaux", "Cet aquarium", "Nourriture lancée", "Nourriture mangée", "Précision", "Meilleur combo", "Frénésies", "Explosions du poisson-globe", "Fouilles", "Poissons dévorés", "Variantes rares", "Temps de jeu", "Renom total"],
  },
} as const;

const SPECIES_NAMES: Record<Exclude<Language, "tr">, Record<SpeciesId, string>> = {
  en: { goldfish: "Goldfish", tetra: "Neon Tetra", snail: "Snail", shrimp: "Cleaner Shrimp", clownfish: "Clownfish", angelfish: "Angelfish", pufferfish: "Pufferfish", crab: "Crab", stingray: "Stingray", eel: "Electric Eel", jellyfish: "Jellyfish", octopus: "Octopus", anglerfish: "Anglerfish", shark: "Shark", koi: "Golden Koi" },
  de: { goldfish: "Goldfisch", tetra: "Neonsalmler", snail: "Schnecke", shrimp: "Putzergarnele", clownfish: "Clownfisch", angelfish: "Skalar", pufferfish: "Kugelfisch", crab: "Krabbe", stingray: "Rochen", eel: "Zitteraal", jellyfish: "Qualle", octopus: "Oktopus", anglerfish: "Anglerfisch", shark: "Hai", koi: "Goldener Koi" },
  fr: { goldfish: "Poisson rouge", tetra: "Tétra néon", snail: "Escargot", shrimp: "Crevette nettoyeuse", clownfish: "Poisson-clown", angelfish: "Scalaire", pufferfish: "Poisson-globe", crab: "Crabe", stingray: "Raie", eel: "Anguille électrique", jellyfish: "Méduse", octopus: "Poulpe", anglerfish: "Poisson-pêcheur", shark: "Requin", koi: "Koï doré" },
};

const FOOD_NAMES: Record<Exclude<Language, "tr">, Record<FoodId, string>> = {
  en: { flake: "Basic Food", shrimpPellet: "Shrimp Pellet", worm: "Worm", starFood: "Star Food", explosive: "Explosive Food", rainbow: "Rainbow Pellet", mutant: "Mutant Food", krill: "Golden Krill" },
  de: { flake: "Basisfutter", shrimpPellet: "Garnelenpellet", worm: "Wurm", starFood: "Sternfutter", explosive: "Explosivfutter", rainbow: "Regenbogenpellet", mutant: "Mutantenfutter", krill: "Goldkrill" },
  fr: { flake: "Nourriture simple", shrimpPellet: "Granulé de crevette", worm: "Ver", starFood: "Nourriture étoile", explosive: "Nourriture explosive", rainbow: "Granulé arc-en-ciel", mutant: "Nourriture mutante", krill: "Krill doré" },
};

const SPECIES_BLURBS: Record<Exclude<Language, "tr">, Record<SpeciesId, string>> = {
  en: {
    goldfish: "Eats food and makes coins. Every empire starts in a fishbowl.", tetra: "Small and fast. Each nearby tetra adds 22% production—build a school.",
    snail: "Cleans the glass and floor. Clean water prevents the whole tank from slowing down.", shrimp: "Collects coins from the bottom. Cleaning a shark triples its production.",
    clownfish: "Feels at home beside an anemone: production ×2.6.", angelfish: "Chews slowly but every bite counts. Its value doubles in clear water.",
    pufferfish: "Inflates as it eats. After 12 bites it POPS and scatters 3.4× its stored value.", crab: "Digs through the sand and collects everything below. Doubles digs beside a stingray.",
    stingray: "Sweeps the sand for buried treasure. Chests become an income stream of their own.", eel: "Shocks nearby fish every 9 seconds, granting ×3 production for 5 seconds.",
    jellyfish: "Turns rising bubbles into coins and continuously produces passive income.", octopus: "Eight arms collect eight objects at once, solving collection for good.",
    anglerfish: "Pulls food toward its lure. Everything nearby flows toward it.", shark: "Devours small fish and permanently inherits their value.",
    koi: "Brings fortune and earns without eating. Two koi boost each other by 90%.",
  },
  de: {
    goldfish: "Frisst Futter und erzeugt Münzen. Jedes Imperium beginnt im Goldfischglas.", tetra: "Klein und schnell. Jeder nahe Tetra gibt +22% Produktion—bilde einen Schwarm.",
    snail: "Reinigt Glas und Boden. Sauberes Wasser schützt die Produktion des Beckens.", shrimp: "Sammelt Münzen vom Boden. Reinigt er einen Hai, produziert dieser dreifach.",
    clownfish: "Fühlt sich neben einer Anemone zu Hause: Produktion ×2,6.", angelfish: "Kaut langsam, doch jeder Bissen zählt. In klarem Wasser verdoppelt sich sein Wert.",
    pufferfish: "Bläht sich beim Fressen auf. Nach 12 Bissen platzt er und verteilt den 3,4-fachen Wert.", crab: "Gräbt im Sand und sammelt alles am Boden. Mit einem Rochen gibt es doppelte Funde.",
    stingray: "Durchkämmt den Sand nach Schätzen. Truhen werden zur eigenen Einnahmequelle.", eel: "Schockt alle 9 Sekunden nahe Fische: 5 Sekunden lang ×3 Produktion.",
    jellyfish: "Verwandelt Blasen in Münzen und erzeugt ständig passives Einkommen.", octopus: "Acht Arme sammeln acht Objekte gleichzeitig und lösen jedes Sammelproblem.",
    anglerfish: "Zieht Futter mit seiner Leuchte an. Alles in der Nähe strömt zu ihm.", shark: "Frisst kleine Fische und übernimmt dauerhaft ihren Wert.",
    koi: "Bringt Glück und verdient ohne Futter. Zwei Koi verstärken sich um 90%.",
  },
  fr: {
    goldfish: "Mange et produit des pièces. Tout empire commence dans un bocal.", tetra: "Petit et rapide. Chaque tétra proche ajoute 22% de production—formez un banc.",
    snail: "Nettoie les vitres et le fond. Une eau propre protège la production de l'aquarium.", shrimp: "Ramasse les pièces au fond. Nettoyer un requin triple sa production.",
    clownfish: "Se sent chez lui près d'une anémone : production ×2,6.", angelfish: "Mâche lentement, mais chaque bouchée compte. Sa valeur double dans une eau claire.",
    pufferfish: "Gonfle en mangeant. Après 12 bouchées, il éclate et disperse 3,4× sa réserve.", crab: "Fouille le sable et ramasse tout au fond. Les fouilles doublent près d'une raie.",
    stingray: "Balaye le sable à la recherche de trésors. Les coffres deviennent une source de revenus.", eel: "Électrise les poissons proches toutes les 9 secondes : production ×3 pendant 5 secondes.",
    jellyfish: "Transforme les bulles en pièces et génère continuellement un revenu passif.", octopus: "Huit bras ramassent huit objets à la fois et règlent la collecte définitivement.",
    anglerfish: "Attire la nourriture avec son leurre. Tout ce qui l'entoure vient vers lui.", shark: "Dévore les petits poissons et hérite définitivement de leur valeur.",
    koi: "Porte bonheur et gagne sans manger. Deux koïs se renforcent mutuellement de 90%.",
  },
};

const FOOD_BLURBS: Record<Exclude<Language, "tr">, Record<FoodId, string>> = {
  en: { flake: "Free. Forever free. The fuel behind every combo.", shrimpPellet: "Value ×2.4, growth ×1.5. Your first real investment choice.", worm: "Splits in two underwater: two fish, two bites, two combo hits.", starFood: "Each bite advances combo by 4. The shortcut to frenzy.", explosive: "Launches 5 more food when eaten. The source of chain reactions.", rainbow: "12% chance to permanently turn the eater into a rare ×2.5 variant.", mutant: "The eater goes wild: ×5 speed and production for 8 seconds.", krill: "Every bite guarantees a gold coin. Simple and ruthless." },
  de: { flake: "Gratis. Für immer gratis. Der Treibstoff jeder Combo.", shrimpPellet: "Wert ×2,4, Wachstum ×1,5. Die erste echte Investition.", worm: "Teilt sich im Wasser: zwei Fische, zwei Bissen, zwei Combo-Treffer.", starFood: "Jeder Bissen erhöht die Combo um 4. Der kurze Weg zur Frenzy.", explosive: "Schleudert beim Fressen 5 weitere Futterstücke heraus. Startet Kettenreaktionen.", rainbow: "12% Chance auf eine dauerhafte seltene Variante mit ×2,5.", mutant: "Der Fisch dreht durch: 8 Sekunden lang ×5 Tempo und Produktion.", krill: "Jeder Bissen garantiert eine Goldmünze. Einfach und gnadenlos." },
  fr: { flake: "Gratuit. Pour toujours. Le carburant de chaque combo.", shrimpPellet: "Valeur ×2,4, croissance ×1,5. Votre premier vrai investissement.", worm: "Se divise sous l'eau : deux poissons, deux bouchées, deux combos.", starFood: "Chaque bouchée avance le combo de 4. Le raccourci vers la frénésie.", explosive: "Libère 5 aliments supplémentaires quand il est mangé. Lance les réactions en chaîne.", rainbow: "12% de chance de créer définitivement une variante rare ×2,5.", mutant: "Le poisson se déchaîne : vitesse et production ×5 pendant 8 secondes.", krill: "Chaque bouchée garantit une pièce d'or. Simple et impitoyable." },
};

const TANK_TEXT = {
  en: [
    ["Fishbowl", "BOWL", "Beside a desk lamp, with a single goldfish."],
    ["Desktop Aquarium", "DESKTOP", "A real filter, a real lid, a real hobby."],
    ["Tropical Tank", "TROPICAL", "Heater, coral, color. Now you are collecting."],
    ["Restaurant Aquarium", "RESTAURANT", "A giant wall of glass. Diners watch your fish while they eat."],
    ["Public Aquarium", "PUBLIC", "You sell tickets. Children in the tunnel stare at the shark."],
    ["Ocean Research Center", "RESEARCH", "You no longer feed fish; you fund an ecosystem."],
    ["Underwater Habitat", "HABITAT", "There is water on both sides of the glass. Who is inside the aquarium is debatable."],
    ["Space Aquarium", "SPACE", "A sphere of water in orbit. From here, it only gets bigger."],
  ],
  de: [
    ["Goldfischglas", "GLAS", "Neben einer Schreibtischlampe, mit einem einzigen Goldfisch."],
    ["Schreibtisch-Aquarium", "SCHREIBTISCH", "Ein echter Filter, ein echter Deckel, ein echtes Hobby."],
    ["Tropenbecken", "TROPISCH", "Heizung, Korallen, Farbe. Jetzt sammelst du."],
    ["Restaurant-Aquarium", "RESTAURANT", "Eine riesige Glaswand. Gäste beobachten beim Essen deine Fische."],
    ["Öffentliches Aquarium", "ÖFFENTLICH", "Du verkaufst Tickets. Kinder im Tunnel bestaunen den Hai."],
    ["Meeresforschungszentrum", "FORSCHUNG", "Du fütterst keine Fische mehr; du finanzierst ein Ökosystem."],
    ["Unterwasser-Habitat", "HABITAT", "Auf beiden Seiten des Glases ist Wasser. Wer im Aquarium sitzt, ist umstritten."],
    ["Weltraum-Aquarium", "WELTRAUM", "Eine Wasserkugel im Orbit. Ab hier wird alles nur größer."],
  ],
  fr: [
    ["Bocal", "BOCAL", "Près d'une lampe de bureau, avec un seul poisson rouge."],
    ["Aquarium de bureau", "BUREAU", "Un vrai filtre, un vrai couvercle, une vraie passion."],
    ["Bassin tropical", "TROPICAL", "Chauffage, corail, couleurs. Vous êtes maintenant collectionneur."],
    ["Aquarium de restaurant", "RESTAURANT", "Une immense vitre murale. Les clients observent vos poissons en mangeant."],
    ["Aquarium public", "PUBLIC", "Vous vendez des billets. Dans le tunnel, les enfants admirent le requin."],
    ["Centre de recherche océanique", "RECHERCHE", "Vous ne nourrissez plus des poissons ; vous financez un écosystème."],
    ["Habitat sous-marin", "HABITAT", "Il y a de l'eau des deux côtés de la vitre. Qui est dans l'aquarium reste discutable."],
    ["Aquarium spatial", "ESPACE", "Une sphère d'eau en orbite. Ensuite, tout devient simplement plus grand."],
  ],
} as const;

const SMALL_LABELS = {
  en: { categories: { feed: "Feeding", fish: "Fish", collect: "Collection", auto: "Automation", frenzy: "Frenzy", tank: "Tank" }, abilities: { collector: "collector", cleaner: "cleaner", inflate: "bursts", dig: "digger", shock: "shock", school: "school", lure: "lure", predator: "predator", passive: "passive income", bubbler: "bubbles" }, stages: ["Fry", "Young", "Adult", "Veteran", "Legend"] },
  de: { categories: { feed: "Fütterung", fish: "Fische", collect: "Sammeln", auto: "Automatisierung", frenzy: "Frenzy", tank: "Becken" }, abilities: { collector: "Sammler", cleaner: "Reiniger", inflate: "platzt", dig: "Gräber", shock: "Schock", school: "Schwarm", lure: "Lockruf", predator: "Jäger", passive: "passives Einkommen", bubbler: "Blasen" }, stages: ["Jungfisch", "Jung", "Ausgewachsen", "Veteran", "Legende"] },
  fr: { categories: { feed: "Nourrissage", fish: "Poissons", collect: "Collecte", auto: "Automatisation", frenzy: "Frénésie", tank: "Aquarium" }, abilities: { collector: "collecteur", cleaner: "nettoyeur", inflate: "éclate", dig: "fouilleur", shock: "choc", school: "banc", lure: "leurre", predator: "prédateur", passive: "revenu passif", bubbler: "bulles" }, stages: ["Alevin", "Jeune", "Adulte", "Vétéran", "Légende"] },
} as const;

const EXTRA_CONTENT: Record<Exclude<Language, "tr">, Record<string, readonly [string, string]>> = {
  en: {
    doubleFeed: ["Double Feed", "Drops one extra piece of food per click."], scatterFeed: ["Scatter Feed", "Throws a wide handful of food into the water."], feedSpeed: ["Quick Hand", "Shortens the delay between feeds so combos rise faster."], sinkSlow: ["Floating Food", "Food sinks more slowly, giving fish time to reach it."],
    hungryFish: ["Hungry Fish", "Fish charge as soon as they spot food."], wideMouth: ["Wide Mouth", "Shorter chewing means reaching the next bite sooner."], metabolism: ["Metabolism", "Speeds up the whole tank."], heater: ["Heater", "Warm water improves digestion and growth."], growthHormone: ["Growth Supplement", "Fish need fewer bites to reach the next stage."], breeding: ["Breeding Program", "Fish reproduce until the tank is full."],
    coinMagnet: ["Coin Magnet", "Coins around the cursor collect themselves."], freshCatch: ["Fresh Collection", "Manually clicked coins are worth more."], glassPolish: ["Auto Vault", "Uncollected coins reach the vault sooner."], goldenPoop: ["Golden Digestion", "Fish sometimes drop gold instead of coins."], bubbleCollector: ["Bubble Collector", "Rising bubbles begin carrying money."], airStone: ["Air Stone", "More bubbles mean more scenery and income."],
    autoFeeder: ["Auto Feeder", "Food now drops on its own."], feederRate: ["Feeder Speed", "The feeder drops food more often."], feederSpread: ["Feeder Mouth", "More food per drop across the tank."], smartFeeder: ["Smart Feeder", "Aims at the hungriest available fish."], filter: ["Filter", "Continuously removes dirt left by rotting food."],
    comboGrace: ["Combo Grace", "The combo meter takes longer to reset."], comboRamp: ["Combo Ramp", "Each bite advances the combo farther."], frenzyLength: ["Long Frenzy", "Frenzy lasts longer."], frenzyPower: ["Frenzy Power", "Raises the multiplier during frenzy."],
    anemone: ["Sea Anemone", "A home for clownfish and a permanent tank bonus."], coral: ["Coral Garden", "Raises production across the entire tank."], wreck: ["Shipwreck", "Collected coins become more valuable."], helmet: ["Diving Helmet", "Bubbles escape from it and boost production."], amphora: ["Ancient Amphora", "Everything collected becomes more valuable."], chest: ["Treasure Chest", "Its open lid hides a huge production bonus."],
    cleanShark: ["Cleaning Deal", "The shrimp cleans the shark; the shark produces three times more."], popCollect: ["Pop and Collect", "When the puffer pops, the octopus collects everything instantly."], massShock: ["Mass Current", "The eel's shock chains through a tetra school and triggers tank-wide frenzy."], clownHome: ["Home Owner", "A clownfish settles into its anemone for ×2.6 production."], sandCrew: ["Sand Crew", "Stingray and crab uncover two treasures per dig."], bubbleChoir: ["Bubble Choir", "Two jellyfish turn every bubble into a money carrier."], koiPair: ["Koi Pair", "Two koi strengthen each other for ×1.9 production."], calmWater: ["Clear Water", "Two snails keep the water clear and boost angelfish ×2.4."], classicSchool: ["Classic School", "Four goldfish give the whole tank +15%."], deepHunters: ["Deep Hunters", "Anglerfish gathers the school; shark finishes the job: tank ×1.6."], treasureHunter: ["Treasure Hunter", "An octopus beside the chest makes all collections worth ×2.2."],
  },
  de: {
    doubleFeed: ["Doppelfutter", "Pro Klick fällt ein zusätzliches Futterstück."], scatterFeed: ["Streufutter", "Wirft eine breite Handvoll Futter ins Wasser."], feedSpeed: ["Schnelle Hand", "Verkürzt die Pause zwischen Fütterungen."], sinkSlow: ["Schwebefutter", "Futter sinkt langsamer und bleibt länger erreichbar."],
    hungryFish: ["Hungrige Fische", "Fische stürmen los, sobald sie Futter sehen."], wideMouth: ["Breites Maul", "Kürzeres Kauen führt schneller zum nächsten Bissen."], metabolism: ["Stoffwechsel", "Beschleunigt das ganze Becken."], heater: ["Heizung", "Warmes Wasser verbessert Verdauung und Wachstum."], growthHormone: ["Wachstumszusatz", "Fische brauchen weniger Bissen für die nächste Stufe."], breeding: ["Zuchtprogramm", "Fische vermehren sich, bis das Becken voll ist."],
    coinMagnet: ["Münzmagnet", "Münzen am Cursor sammeln sich von selbst."], freshCatch: ["Frisch gesammelt", "Manuell geklickte Münzen sind mehr wert."], glassPolish: ["Auto-Tresor", "Nicht gesammelte Münzen landen früher im Tresor."], goldenPoop: ["Goldene Verdauung", "Fische lassen manchmal Gold statt Münzen fallen."], bubbleCollector: ["Blasensammler", "Aufsteigende Blasen transportieren Geld."], airStone: ["Ausströmer", "Mehr Blasen bedeuten mehr Aussicht und Einkommen."],
    autoFeeder: ["Futterautomat", "Futter fällt nun von selbst."], feederRate: ["Automatentempo", "Der Automat füttert häufiger."], feederSpread: ["Breite Öffnung", "Mehr Futter pro Wurf im ganzen Becken."], smartFeeder: ["Kluger Automat", "Zielt auf den hungrigsten freien Fisch."], filter: ["Filter", "Entfernt ständig Schmutz von verrottendem Futter."],
    comboGrace: ["Combo-Toleranz", "Die Combo wird später zurückgesetzt."], comboRamp: ["Combo-Rampe", "Jeder Bissen steigert die Combo stärker."], frenzyLength: ["Lange Frenzy", "Die Frenzy dauert länger."], frenzyPower: ["Frenzy-Kraft", "Erhöht den Multiplikator während der Frenzy."],
    anemone: ["Seeanemone", "Heimat für Clownfische und dauerhafter Beckenbonus."], coral: ["Korallengarten", "Steigert die Produktion des ganzen Beckens."], wreck: ["Schiffswrack", "Gesammelte Münzen werden wertvoller."], helmet: ["Taucherhelm", "Seine Blasen steigern die Produktion."], amphora: ["Antike Amphore", "Alles Gesammelte wird wertvoller."], chest: ["Schatztruhe", "Unter dem offenen Deckel steckt ein großer Produktionsbonus."],
    cleanShark: ["Putzvertrag", "Die Garnele putzt den Hai; er produziert dreifach."], popCollect: ["Platzen und Sammeln", "Beim Platzen sammelt der Oktopus sofort alles ein."], massShock: ["Massenstrom", "Der Aalschock springt durch den Tetraschwarm und startet eine Frenzy."], clownHome: ["Eigenes Zuhause", "Der Clownfisch zieht in die Anemone: Produktion ×2,6."], sandCrew: ["Sandteam", "Rochen und Krabbe finden bei jeder Grabung zwei Schätze."], bubbleChoir: ["Blasenchor", "Zwei Quallen machen jede Blase zum Geldträger."], koiPair: ["Koi-Paar", "Zwei Koi verstärken sich auf ×1,9."], calmWater: ["Klares Wasser", "Zwei Schnecken halten das Wasser klar und geben dem Skalar ×2,4."], classicSchool: ["Klassischer Schwarm", "Vier Goldfische geben dem ganzen Becken +15%."], deepHunters: ["Tiefseejäger", "Anglerfisch sammelt, Hai beendet: gesamtes Becken ×1,6."], treasureHunter: ["Schatzjäger", "Oktopus an der Truhe macht alle Funde ×2,2 wertvoller."],
  },
  fr: {
    doubleFeed: ["Double ration", "Ajoute un aliment à chaque clic."], scatterFeed: ["Nourrissage dispersé", "Lance une large poignée de nourriture."], feedSpeed: ["Main rapide", "Réduit l'attente entre deux distributions."], sinkSlow: ["Nourriture flottante", "La nourriture coule plus lentement."],
    hungryFish: ["Poissons affamés", "Les poissons foncent dès qu'ils voient la nourriture."], wideMouth: ["Grande bouche", "Une mastication plus courte accélère la bouchée suivante."], metabolism: ["Métabolisme", "Accélère tout l'aquarium."], heater: ["Chauffage", "L'eau chaude améliore digestion et croissance."], growthHormone: ["Supplément de croissance", "Moins de bouchées sont nécessaires pour changer de stade."], breeding: ["Programme d'élevage", "Les poissons se reproduisent jusqu'à remplir l'aquarium."],
    coinMagnet: ["Aimant à pièces", "Les pièces proches du curseur se ramassent seules."], freshCatch: ["Collecte fraîche", "Les pièces cliquées manuellement valent plus."], glassPolish: ["Coffre automatique", "Les pièces oubliées rejoignent plus vite le coffre."], goldenPoop: ["Digestion dorée", "Les poissons lâchent parfois de l'or."], bubbleCollector: ["Collecteur de bulles", "Les bulles montantes transportent de l'argent."], airStone: ["Diffuseur d'air", "Plus de bulles, plus de décor et de revenus."],
    autoFeeder: ["Distributeur automatique", "La nourriture tombe désormais seule."], feederRate: ["Vitesse du distributeur", "Le distributeur nourrit plus souvent."], feederSpread: ["Large ouverture", "Plus de nourriture par distribution."], smartFeeder: ["Distributeur intelligent", "Vise le poisson libre le plus affamé."], filter: ["Filtre", "Élimine en continu la saleté des restes."],
    comboGrace: ["Tolérance combo", "Le combo met plus de temps à retomber."], comboRamp: ["Rampe de combo", "Chaque bouchée augmente davantage le combo."], frenzyLength: ["Longue frénésie", "La frénésie dure plus longtemps."], frenzyPower: ["Puissance de frénésie", "Augmente le multiplicateur pendant la frénésie."],
    anemone: ["Anémone de mer", "Maison des poissons-clowns et bonus permanent."], coral: ["Jardin de corail", "Augmente la production de tout l'aquarium."], wreck: ["Épave", "Les pièces collectées prennent de la valeur."], helmet: ["Casque de plongée", "Ses bulles augmentent la production."], amphora: ["Amphore antique", "Tout ce qui est collecté gagne en valeur."], chest: ["Coffre au trésor", "Son couvercle ouvert cache un grand bonus de production."],
    cleanShark: ["Accord de nettoyage", "La crevette nettoie le requin ; sa production triple."], popCollect: ["Éclater et collecter", "Quand le poisson-globe éclate, le poulpe ramasse tout."], massShock: ["Courant collectif", "Le choc de l'anguille traverse le banc et déclenche une frénésie générale."], clownHome: ["Propriétaire", "Le poisson-clown s'installe dans l'anémone : production ×2,6."], sandCrew: ["Équipe du sable", "La raie et le crabe trouvent deux trésors par fouille."], bubbleChoir: ["Chœur de bulles", "Deux méduses transforment chaque bulle en transporteur de pièces."], koiPair: ["Paire de koïs", "Deux koïs se renforcent pour une production ×1,9."], calmWater: ["Eau claire", "Deux escargots gardent l'eau claire et donnent ×2,4 au scalaire."], classicSchool: ["Banc classique", "Quatre poissons rouges donnent +15% à tout l'aquarium."], deepHunters: ["Chasseurs des profondeurs", "Le poisson-pêcheur rassemble, le requin termine : aquarium ×1,6."], treasureHunter: ["Chasseur de trésors", "Un poulpe près du coffre rend toute collecte ×2,2."],
  },
};

type I18nContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: keyof typeof UI.tr, params?: Params) => string;
  speciesName: (id: SpeciesId, fallback: string) => string;
  foodName: (id: FoodId, fallback: string) => string;
  speciesBlurb: (id: SpeciesId, fallback: string) => string;
  foodBlurb: (id: FoodId, fallback: string) => string;
  tankText: (index: number, field: 0 | 1 | 2, fallback: string) => string;
  categoryLabel: (category: UpgradeCategory, fallback: string) => string;
  abilityLabel: (ability: string, fallback: string) => string;
  stageName: (index: number, fallback: string) => string;
  extraText: (id: string, field: 0 | 1, fallback: string) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);
const STORAGE_KEY = "fish-tank-empire/language";

function interpolate(value: string, params: Params = {}) {
  return value.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key] ?? `{${key}}`));
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("tr");
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const saved = localStorage.getItem(STORAGE_KEY) as Language | null;
      if (saved && LANGUAGE_OPTIONS.some((option) => option.id === saved)) setLanguageState(saved);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  const setLanguage = (next: Language) => {
    setLanguageState(next);
    localStorage.setItem(STORAGE_KEY, next);
  };
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const value = useMemo<I18nContextValue>(() => ({
    language,
    setLanguage,
    t: (key, params) => {
      const entry = UI[language][key];
      return typeof entry === "string" ? interpolate(entry, params) : "";
    },
    speciesName: (id, fallback) => language === "tr" ? fallback : SPECIES_NAMES[language][id],
    foodName: (id, fallback) => language === "tr" ? fallback : FOOD_NAMES[language][id],
    speciesBlurb: (id, fallback) => language === "tr" ? fallback : SPECIES_BLURBS[language][id],
    foodBlurb: (id, fallback) => language === "tr" ? fallback : FOOD_BLURBS[language][id],
    tankText: (index, field, fallback) => language === "tr" ? fallback : TANK_TEXT[language][index]?.[field] ?? fallback,
    categoryLabel: (category, fallback) => language === "tr" ? fallback : SMALL_LABELS[language].categories[category],
    abilityLabel: (ability, fallback) => language === "tr" ? fallback : SMALL_LABELS[language].abilities[ability as keyof typeof SMALL_LABELS.en.abilities] ?? fallback,
    stageName: (index, fallback) => language === "tr" ? fallback : SMALL_LABELS[language].stages[index] ?? fallback,
    extraText: (id, field, fallback) => language === "tr" ? fallback : EXTRA_CONTENT[language][id]?.[field] ?? fallback,
  }), [language]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used inside LanguageProvider");
  return context;
}

export function statLabels(language: Language): readonly string[] { return UI[language].stats; }
