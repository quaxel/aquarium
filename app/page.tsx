import type { Metadata } from "next";
import { FishTankEmpire } from "./game/FishTankEmpire";

export const metadata: Metadata = {
  title: "Fish Tank Empire",
  description:
    "Yem serp, beslenme çılgınlığı başlat, balık yetenek zincirleri kur, otomasyona geç ve daha büyük tanka taşın.",
};

export default function Home() {
  return <FishTankEmpire />;
}
