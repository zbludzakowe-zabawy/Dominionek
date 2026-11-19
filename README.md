# Crownforge

Karciana gra fantasy o budowaniu talii (deck-builder) jako aplikacja webowa na telefon.
Karty mają własne nazwy, teksty i abstrakcyjne wzory. Gra jest po angielsku, z przełącznikiem na polski.

## Co już działa

- **Silnik zasad**: tasowanie, tury (akcje → zakupy → porządki), punktacja, koniec gry
  (wyczerpane Cytadele albo 3 puste stosy), remisy rozstrzyga mniejsza liczba tur.
- **Pakiet „The Crossroads Keep” / „Twierdza na Rozstajach”**: 25 kart Królestwa
  (akcje, ataki, reakcja, palenie kart, zdobywanie, karta punktów).
- **Pakiet „Dragon's Hoard” / „Skarbiec Smoka”**: 16 kart Królestwa: skarby z efektami,
  żetony Punktów Zwycięstwa, smocze ataki. Gdy w Królestwie są karty Skarbca, do gry mogą dojść
  Smocze Złoto (5 monet) i Pałac (10 PZ); wyczerpanie Pałaców kończy grę.
- **Pakiet „Alchemist's Tower” / „Wieża Alchemika”**: 13 kart Królestwa ze świata alchemików
  i laboratorium oraz druga waluta, Eliksir: część kart kosztuje monety i Eliksir. Stos Eliksiru
  (skarb za 4) dochodzi do gry sam, gdy w Królestwie są takie karty.
- **Gra solo** przeciwko 1–3 botom, każdy na poziomie łatwym, średnim lub trudnym.
  Trudny bot na starcie partii rozgrywa w pamięci gry próbne i wybiera plan pod wylosowane Królestwo.
- **Królestwo**: losowanie 10 kart, ponowne losowanie pojedynczej karty albo ręczny wybór.
- **EN/PL**: przełącznik języka na każdym ekranie.
- **Autozapis**: gra zapisuje się po każdym ruchu i wraca po zamknięciu aplikacji.

## Plan

1. Pakiet Court Whispers (Szepty Dworu).
2. Gra online dla 2 osób przez link-pokój (WebRTC).
3. Statystyki gier.

## Aplikacja na telefon

Crownforge to PWA: instaluje się z przeglądarki, bez sklepu z aplikacjami.

- **Android (Chrome)**: stuknij baner „Zainstaluj” albo menu ⋮ → *Zainstaluj aplikację*.
- **iPhone/iPad (Safari)**: *Udostępnij* → *Do ekranu początkowego*.
- **Komputer (Chrome/Edge)**: ikona instalacji na pasku adresu.

Po instalacji gra działa **bez internetu**. Bieżąca partia zapisuje się na urządzeniu.
Gdy pojawi się **„Dostępna nowa wersja”**, przycisk *Odśwież* wczytuje nową wersję,
a gra wraca dokładnie w tym samym miejscu. *Później* odkłada aktualizację.

## Uruchomienie lokalne

```bash
npm install
npm run dev      # serwer deweloperski
npm test         # testy silnika (symulacje gier botów) i PWA
npm run build    # wersja produkcyjna w dist/ (z service workerem)
```

Publikacja: workflow `.github/workflows/pages.yml` buduje i publikuje na GitHub Pages przy każdym
pushu na `main` (jednorazowo: Settings → Pages → Source: GitHub Actions).

## Struktura

- `src/engine/`: silnik bez interfejsu
  - `game.ts`: przebieg gry jako generator decyzji. Stan gry = ustawienia + ziarno + lista odpowiedzi,
    dzięki czemu zapis i odtworzenie są deterministyczne (podstawa pod przyszły tryb online).
  - `cards/`: definicje kart (`basic.ts`, `keep.ts`, `hoard.ts`, `tower.ts`)
  - `bot.ts`, `plan.ts`: boty i planowanie trudnego bota
  - `setup.ts`: losowanie Królestwa
- `src/ui/`: interfejs (React): ekrany, karty, rysunki kart (`motifs.ts`), tła i symbole pakietów (`art.ts`), zapis (`store.ts`)
- `src/i18n.ts`: teksty EN/PL
- `src/pwa.ts`, `src/sw-template.js`: instalacja, tryb offline, baner aktualizacji
- `public/`: manifest i ikony (`scripts/icon.svg` → `scripts/make-icons.cjs`)
