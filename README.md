# Crownforge

Karciana gra fantasy o budowaniu talii (deck-builder) jako aplikacja webowa na telefon.
Karty mają własne nazwy, teksty i abstrakcyjne wzory. Gra jest po angielsku, z przełącznikiem na polski.

## Co już działa

- **Silnik zasad**: tasowanie, tury (akcje → zakupy → porządki), punktacja, koniec gry
  (wyczerpane Cytadele albo 3 puste stosy), remisy rozstrzyga mniejsza liczba tur.
- **Pakiet „The Crossroads Keep” / „Twierdza na Rozstajach”**: 25 kart Królestwa
  (akcje, ataki, reakcja, palenie kart, zdobywanie, karta punktów).
- **Pakiet „Dragon's Hoard” / „Skarbiec Smoka”**: 17 kart Królestwa: skarby z efektami,
  skarb z punktami (Pradawna Moneta), smocze ataki. Gdy w Królestwie są karty Skarbca, do gry mogą dojść
  Smocze Złoto (5 monet) i Pałac (10 PZ); wyczerpanie Pałaców kończy grę.
- **Pakiet „Alchemist's Tower” / „Wieża Alchemika”**: 14 kart Królestwa ze świata alchemików
  i laboratorium oraz druga waluta, Eliksir: część kart kosztuje monety i Eliksir. Stos Eliksiru
  (skarb za 4) dochodzi do gry sam, gdy w Królestwie są takie karty.
- **Pakiet „Court Whispers” / „Szepty Dworu”**: 16 kart Królestwa z dworu książęcego – bale, damy
  i służba; karty wielotypowe (Akcja–Zwycięstwo, Skarb–Reakcja, Skarb–Zwycięstwo) i karty „wybierz jedno”.
- **Gra solo** przeciwko 1–3 botom, każdy na poziomie łatwym, średnim lub trudnym.
  Trudny bot na starcie partii rozgrywa w pamięci gry próbne i wybiera plan pod wylosowane Królestwo.
- **Królestwo**: losowanie 10 kart, ponowne losowanie pojedynczej karty albo ręczny wybór.
- **EN/PL**: przełącznik języka na każdym ekranie.
- **Autozapis**: gra zapisuje się po każdym ruchu i wraca po zamknięciu aplikacji.
- **Gra online** dla 2–4 osób (plus boty) przez link-pokój, bez logowania – opis i zakładanie bazy: `docs/gra-online.md`.

## Plan

1. **Przegląd działania kart** (najbliższy krok): przemyśleć, co karty mają robić – obecne efekty
   prawdopodobnie wymagają zmian (kontynuacja rozmowy z innego wątku).
2. **Gra online dla 2–4 osób** przez link-pokój – zrobione (Firebase Realtime Database, `docs/gra-online.md`); do sprawdzenia na prawdziwej bazie.
   - „Koniec gry – poddaję się” w menu gry online – zrobione: po potwierdzeniu gra kończy się u wszystkich,
     pozostali widzą, kto się poddał, i „Wygrywasz walkowerem”.
3. **Skrót działania karty na stosach w Królestwie**: przemyśleć inny widok dostępnych kart, gdzie
   stos na stole pokazuje ikonkami w skrócie, co robi karta – np. torba zakupowa = +zakup,
   moneta = +monety, karta = +karty (podobnie akcje, palenie, atak). Najpierw podgląd do akceptacji.
4. Pakiet Court Whispers (Szepty Dworu) – zrobione (16 kart, do oceny przez użytkownika).
5. Statystyki gier.

### Do poprawy (zgłoszenia użytkownika)

- ~~**Rzezimieszek nie pokazuje, co stało się u przeciwnika**~~ (25.11) – zrobione: okienko z kartami odkrytymi
  u każdego przeciwnika i tym, co się z nimi stało (też Herszt Bandytów i Plotka).

## Aplikacja na telefon

Crownforge to PWA: instaluje się z przeglądarki, bez sklepu z aplikacjami.

- **Android (Chrome)**: stuknij baner „Zainstaluj” albo menu ⋮ → *Zainstaluj aplikację*.
- **iPhone/iPad (Safari)**: *Udostępnij* → *Do ekranu początkowego*.
- **Komputer (Chrome/Edge)**: ikona instalacji na pasku adresu.

Po instalacji gra działa **bez internetu**. Bieżąca partia zapisuje się na urządzeniu.
Gdy pojawi się **„Dostępna nowa wersja”**, przycisk *Odśwież* wczytuje nową wersję,
a gra wraca dokładnie w tym samym miejscu. *Później* odkłada aktualizację.

Żeby wysłać grę znajomym, stuknij małą ikonę udostępniania (trzy połączone kropki) w lewym górnym
rogu ekranu startowego – na telefonie otworzy się systemowe okno udostępniania, na komputerze link
trafi do schowka.

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
  - `cards/`: definicje kart (`basic.ts`, `keep.ts`, `hoard.ts`, `tower.ts`, `court.ts`)
  - `bot.ts`, `plan.ts`: boty i planowanie trudnego bota
  - `setup.ts`: losowanie Królestwa
- `src/ui/`: interfejs (React): ekrany, karty, rysunki kart (`motifs.ts`), tła i symbole pakietów (`art.ts`), zapis (`store.ts`)
- `src/i18n.ts`: teksty EN/PL
- `src/pwa.ts`, `src/sw-template.js`: instalacja, tryb offline, baner aktualizacji
- `public/`: manifest i ikony (`scripts/icon.svg` → `scripts/make-icons.cjs`)
