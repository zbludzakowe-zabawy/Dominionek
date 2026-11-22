# Crownforge – notatki dla Claude

Karciana gra fantasy o budowaniu talii (deck-builder), PWA na telefon. Rozmowy z użytkownikiem po polsku.

## Najważniejsze ustalenia (nie łamać)

- **To nie jest kopia Dominiona.** Zasady i mechaniki są w tym samym duchu, ale nazwy kart, teksty,
  grafika i nazwa gry są własne. Nie używać oryginalnych nazw kart (także jako pierwszego członu nazwy)
  ani tekstów z oryginału czy z polskiego wydania. Pieniądze: Grosz (1), Srebro (2), Złoto (3)
  – EN: Penny, Silver, Gold. Punkty: Zagroda/Dwór/Cytadela (Homestead/Manor/Citadel), Urok (Hex, −1).
- Język kart: EN z przełącznikiem PL (oba teksty w definicji karty).
- **Rysunki kart**: każda karta ma rysunek kreską pasujący do nazwy (Latarnik = latarnia morska itd.),
  na spokojnym wzorzystym tle. Bez cukierkowych ikonek. Zanim zmienisz znaczący element graficzny
  (np. symbol pakietu), pokaż użytkownikowi podgląd do akceptacji.
- Gra solo: człowiek (zawsze gracz 0) + 1–3 boty (łatwy/średni/trudny).

## Pakiety (stan)

| id | EN | PL | stan |
|---|---|---|---|
| `keep` | The Crossroads Keep | Twierdza na Rozstajach | gotowy, 25 kart |
| `hoard` | Dragon's Hoard | Skarbiec Smoka | gotowy, 17 kart (po przeglądzie z 22.11) + Smocze Złoto (9→5 monet) i Pałac (11→10 PZ) |
| `tower` | Alchemist's Tower | Wieża Alchemika | gotowy, 13 kart + Eliksir (skarb za 4, daje 1 Eliksir) |
| `court` | Court Whispers | Szepty Dworu | plan: karty wielotypowe, „jedno z” |

Dalej w planie (kolejność jak w README → Plan):
1. Przegląd działania kart – użytkownik uważa, że efekty kart wymagają zmian (temat z innego wątku).
2. Gra online dla 2–4 osób przez link-pokój (WebRTC/PeerJS, host pilnuje zasad) – nadal ważne.
3. (zrobione: widok „Symbole” stosów Królestwa – ewentualne poprawki ikon/opisów w `symbols.ts`.)
4. Szepty Dworu, statystyki gier.

## Architektura

- `src/engine/` – czysty silnik (bez DOM), deterministyczny.
  - `game.ts`: cała gra to **generator decyzji**. `Game.pending` = bieżąca `Decision`, `submit(answer)` ją
    rozwiązuje. Stan gry = `GameSetup` (ziarno, gracze, Królestwo, `extras`) + lista `answers`;
    `Game.replay(setup, answers)` odtwarza grę (zapis gry, przyszły multiplayer). Odpowiedzi botów też
    są zapisywane, więc boty mogą używać `Math.random`.
  - Rodzaje decyzji (`types.ts`): `action`, `buy`, `cards` (z ręki albo z listy, `purpose` podpowiada
    botom), `pile`, `options`, `yesno`. Decyzja może mieć `hint` (podpowiedź karty dla botów).
  - Karty: `cards/basic.ts`, `cards/keep.ts`, `cards/hoard.ts`, `cards/tower.ts`, rejestr w `cards/index.ts` (`SETS`
    – flaga `available`). Karta = `CardDef` (`card.ts`): `plus` (standardowe bonusy, rysowane przez UI),
    `play` (generator efektu), `coins`, `vp`/`vpFn`, `blocksAttacks`, `symbol`, `ai` (value/role).
    Pomocnicze metody `Game`: `draw`, `takeTop`, `gain(p,id,'discard'|'hand'|'deck')`, `trashCards`,
    `discardCards`, `addVp`, `attack(p, fn)`, `chooseFromHand/chooseFromList/choosePile/chooseOptions/yesNo`.
  - Eliksir (druga waluta): `CardDef.potionCost` (koszt) i `potions` (ile daje skarb), `TurnState.potions`,
    `Game.canAfford(id)`. `choosePile` ma `maxPotion` (domyślnie 0 – karty z Eliksirem w koszcie są poza
    zasięgiem „zdobądź kartę do X”). Stos `elixir` dochodzi sam, gdy karta Królestwa ma `potionCost`.
  - Cofanie: `Game.undoFloor` / `undoable()` – odpowiedzi przed progiem są nieodwracalne (próg przesuwa
    zmiana tury, odpowiedź bota, dobranie/odkrycie kart, tasowanie). UI cofa przez `Game.replay` bez
    końcówki `answers`; `marks` w `GameScreen` grupują odpowiedzi jednego ruchu (np. kupno).
  - Ręka jest zawsze posortowana (`sortCards`), indeksy w decyzjach dotyczą tej kolejności.
  - Przy 0 zakupach silnik i tak pyta o koniec tury (UI kończy ją sam, jeśli opcja `autoEnd`).
  - `bot.ts` – heurystyki (easy/medium); `plan.ts` – trudny bot na starcie rozgrywa w pamięci gry
    próbne planów „pieniądze + karta X” i wybiera najlepszy (ok. 0,4–0,6 s).
  - `setup.ts` – losowanie Królestwa, `rollHoardExtras`.
- `src/ui/` – React.
  - `App.tsx` – ekrany: start, ustawienia, Królestwo (losowe/ręczne, przełącznik Smocze Złoto+Pałac), zasady.
  - `GameScreen.tsx` – plansza, pętla botów, autozapis (`store.ts`, localStorage, `SavedGame.v = 2`;
    zmiana przebiegu tury wymaga podbicia wersji).
  - `CardView.tsx` – `CardFace`, `PileTile`, `PlayedCard`, `usePress` (stuknięcie / dwuklik /
    przytrzymanie), `ConfirmButton` (zamiast `window.confirm`, który w podglądzie jest blokowany).
  - `motifs.ts` – rysunki kart (pole 48×48, ziemia ~y=44; `m` linie, `a` akcent, `f` wypełnienia).
  - `art.ts` – tło karty (kratka / łuski dla Skarbca / sześciokąty dla Wieży), symbole pakietów
    (Twierdza: wieża; Skarbiec: konturowy łeb smoka z otwartą paszczą, patrzy w lewo, bez płomienia,
    bez tła; Wieża: konturowa buteleczka eliksiru).
  - Koszt z Eliksirem: komponent `Cost` (moneta + fioletowa buteleczka `Flask`); licznik Eliksirów
    na pasku fazy, gdy stos Eliksiru jest w grze.
- `src/i18n.ts` – wszystkie teksty UI/podpowiedzi/dziennika EN+PL (`tr`, liczba mnoga PL).
- PWA: `src/pwa.ts`, `src/sw-template.js` (plugin w `vite.config.ts` liczy wersję SW z plików),
  `public/manifest.webmanifest`, ikony z `scripts/icon.svg` (`scripts/make-icons.cjs`).

## Układ ekranu (ustalony z użytkownikiem)

- Telefon: gracze z punktami (zielone ramki PZ) → stałe stosy w rzędzie (pieniądze rosnąco, Eliksir po Złocie, punkty
  rosnąco, Urok na końcu; z Pałacem 2 rzędy) → Królestwo 2×5 → zagrane (takie same karty w stosiku
  z licznikiem) → pasek fazy → ręka.
- Komputer (≥900 px): jedna kolumna, ręka na dole. Stałe stosy w dwóch kolumnach przy lewym brzegu
  (punkty od Pałacu/Cytadeli do Uroku, obok pieniądze od Smoczego Złota do Grosza, Eliksir pod nimi), Królestwo obok;
  dolny panel gracza wcięty do wysokości Królestwa (miejsce po lewej zostawione na później).
- Telefon poziomo (`(orientation: landscape) and (max-height: 520px)`): jedna kolumna, ręka mała na dole,
  stałe stosy w jednym niskim rzędzie bez obrazków, Królestwo w jednym rzędzie 10 kart (od najtańszej
  z lewej, CSS `order: var(--ko)`), zagrane karty jako same nazwy. Układ komputerowy działa tylko przy
  `min-width: 900px` i `min-height: 521px`.
- Widok stosów Królestwa (`settings.pileView`, domyślnie `'art'`, zapamiętany na urządzeniu; przełącznik
  w ustawieniach i w menu gry): „Obraz” albo „Symbole” – niski pasek obrazu, nazwa, pod nią skrót działania
  karty ikonkami (zestaw „kontur”: +N karta, +N A = akcja, torba = zakup, moneta, tarcza PZ, kosz = spal,
  karty ze strzałką = odrzuć, prostokąt z 3 kropkami = dłuższy opis). Symbole: `src/ui/symbols.ts` – bonusy
  z `plus`/`coins`, resztę opisuje `EXTRA` (test pilnuje wpisu dla każdej karty Królestwa). Na niskim ekranie
  i poziomo bez obrazka, licznik i koszt w górnym pasku. Stałe stosy bez zmian.
- Pasek fazy można zwinąć do jednej linijki (strzałka; `settings.barCollapsed`, null = auto: zwinięty
  w poziomie). Podpowiedzi do wyborów (atak, palenie) widać zawsze.
- Skarby na karcie: duża moneta z wartością (najważniejsza informacja). Moneta (`.coin`) jest **płaska**:
  jednolite pole i podniesiony rant (jasny u góry, ciemny u dołu), cyfra szeryfowa – bez wypukłego środka.
- Królestwo: od najtańszej (lewy dolny róg) do najdroższej (prawy górny).
- Liczba kart na stosie: kwadracik w lewym górnym rogu. Licznik monet: tylko zagrane monety.
  Faza zakupów: „Faza zakupów: (monety) Zakupy N”. „Koniec tury” – niebieski przycisk, obok „↶ Cofnij”.
- Dwuklik: kupno/zdobycie stosu, zatwierdzenie wyboru kart. Przytrzymanie: podgląd karty.
- Okienko wyboru (odkryte karty, opcje) ma „Pokaż rękę” – chowa je (`peek`), na pasku fazy pojawia się
  „Wróć do wyboru”.

## Polecenia

```bash
npm install
npm test          # vitest: symulacje gier botów, testy kart, PWA
npm run build     # tsc + vite build → dist/ (z sw.js)
```

Podgląd dla użytkownika (Artifact na claude.ai, ten sam link przy każdej publikacji:
https://claude.ai/artifact/Wmw4mKshmWcNMo6q18wBp7):
`npm run build && python3 scripts/build-artifact.py <scratchpad>` → opublikuj `<scratchpad>/crownforge.html`
narzędziem Artifact. Do testów lokalnych dołóż na początku `<!doctype html><meta name="viewport" ...>`.

Weryfikacja wizualna: Playwright (Chromium jest preinstalowany), emulacja `devices['Pixel 7']`,
`devices['iPhone 8']` i okno 1280×720; zrzuty oglądać przed zgłoszeniem.

## Sposób pracy z użytkownikiem

- Gałąź robocza, PR do `main` dopiero na prośbę („Rób PR”); po scaleniu GitHub Actions publikuje
  na https://zbludzakowe-zabawy.github.io/Dominionek/ (instalowana PWA).
- Po każdej zmianie: testy, build, podgląd Artifact, commit + push na gałąź.
- Commity i PR po polsku.
