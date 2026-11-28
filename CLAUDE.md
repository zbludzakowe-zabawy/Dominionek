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
- Gra solo: człowiek (zawsze gracz 0) + 1–3 boty (łatwy/średni/trudny). Gra online: 2–4 ludzi (+ boty), link-pokój
  w Firebase, gospodarz = miejsce 0.

## Pakiety (stan)

| id | EN | PL | stan |
|---|---|---|---|
| `keep` | The Crossroads Keep | Twierdza na Rozstajach | gotowy, 25 kart |
| `hoard` | Dragon's Hoard | Skarbiec Smoka | gotowy, 17 kart (po przeglądzie z 22.11) + Smocze Złoto (9→5 monet) i Pałac (11→10 PZ) |
| `tower` | Alchemist's Tower | Wieża Alchemika | gotowy, 14 kart (po przeglądzie z 22.11) + Eliksir (skarb za 4, daje 1 Eliksir) |
| `court` | Court Whispers | Szepty Dworu | nowy (23.11), 16 kart: karty wielotypowe (Akcja–Zwycięstwo, Skarb–Reakcja, Skarb–Zwycięstwo), „wybierz jedno/dwa” |

Dalej w planie (kolejność jak w README → Plan):
1. Przegląd działania kart – użytkownik uważa, że efekty kart wymagają zmian (temat z innego wątku).
2. Gra online – zrobiona (25.11): Firebase Realtime Database przez REST, link-pokój bez logowania (`docs/gra-online.md`).
   Baza: projekt Firebase `crownforge-5710b` (adres w `src/online/config.ts`, `ONLINE_DB`; użytkownik nie chce, by dało się
   go zmienić w aplikacji). Sprawdzone na prawdziwej bazie 25.11 (środowisko chmurowe „Dominionek” ma dostęp do tego hosta).
   Rewanż ustawia tylko gospodarz (`RematchSlots` w `App.tsx`: gracze z imionami, ✕ usuwa na stałe, nowy gracz = ten sam
   link); reszta widzi „Czekaj…” z kubkiem (`prep`, `TeaCup` w `Icons.tsx`, wersja B2 zaakceptowana); nowy pokój od razu
   z graczami na miejscach (bez nowych graczy – od razu ze `start`), stary dostaje `next`. Kasowanie: 14 dni bez
   aktywności (`act`), pokój z `next` po 2 dniach (`cleanupRooms` przy starcie aplikacji). Cotygodniowe sprzątanie
   całej bazy: `.github/workflows/cleanup-rooms.yml` + `scripts/cleanup-rooms.mjs` (klucz konta usługi w sekrecie
   `FIREBASE_SERVICE_ACCOUNT`; zmiana zasad kasowania = aplikacja, reguły i skrypt – test pilnuje zgodności).
   Zmiany reguł wymagają opublikowania ich w konsoli Firebase. Środowisko chmurowe „Dominionek” ma dostęp do bazy
   (zapis testowych danych do prawdziwej bazy tylko za zgodą użytkownika).
   Poddanie gry (25.11): menu gry online → „Koniec gry – poddaję się” (`ConfirmButton`) → `RoomConn.resign` zapisuje raz
   pole `end` (nr miejsca); reguły nie pozwalają potem dopisywać ruchów. `GameScreen` (`online.resigned`): brak decyzji
   i botów, okienko końca: „Gra została poddana przez gracza: X.” + „Wygrywasz walkowerem!” (wszyscy pozostali), punkty
   w chwili poddania, poddający na końcu listy bez miejsca. Pokój z `end` kasowany po 2 dniach bez aktywności
   (jak z `next`; aplikacja: `MyRoom.over`/`markRoomOver`, reguły, skrypt sprzątania). Wyniki – przycisk „Wyniki” na pasku fazy (też przy zwykłym końcu).
3. (zrobione: widok „Symbole” stosów Królestwa – ewentualne poprawki ikon/opisów w `symbols.ts`.)
4. Statystyki gier.

## Architektura

- `src/engine/` – czysty silnik (bez DOM), deterministyczny.
  - `game.ts`: cała gra to **generator decyzji**. `Game.pending` = bieżąca `Decision`, `submit(answer)` ją
    rozwiązuje. Stan gry = `GameSetup` (ziarno, gracze, Królestwo, `extras`) + lista `answers`;
    `Game.replay(setup, answers)` odtwarza grę (zapis gry, przyszły multiplayer). Odpowiedzi botów też
    są zapisywane, więc boty mogą używać `Math.random`.
  - Rodzaje decyzji (`types.ts`): `action`, `buy`, `cards` (z ręki albo z listy, `purpose` podpowiada
    botom), `pile`, `options` (`count` > 1 = „wybierz dwa”, UI z zaznaczaniem i Zatwierdź), `yesno`. Decyzja może mieć `hint` (podpowiedź karty dla botów).
  - Karty: `cards/basic.ts`, `cards/keep.ts`, `cards/hoard.ts`, `cards/tower.ts`, `cards/court.ts`, rejestr w `cards/index.ts` (`SETS`
    – flaga `available`). Karta = `CardDef` (`card.ts`): `plus` (standardowe bonusy, rysowane przez UI),
    `play` (generator efektu), `onCleanup` (na koniec tury, np. Warzelnik), `coins`, `vp`/`vpFn`, `blocksAttacks`
    (Runa – chroni zawsze), `onAttack` (reakcja z wyborem, np. Homunkulus: pokaż i odrzuć 1 kartę),
    `symbol`, `ai` (value/role).
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
- `src/online/` – gra online (bez SDK Firebase): `firebase.ts` (REST: PUT, strumień zdarzeń EventSource),
  `transport.ts` (interfejs + `MemoryStore` do testów), `room.ts` (pokój: `cfg` jako tekst JSON, `seats`, `start`,
  `moves` jako teksty JSON – Firebase gubi puste tablice; `RoomConn.push` zapisuje brakujące odpowiedzi po kolei,
  każdą tylko w puste miejsce; `rename` – zmiana imienia w poczekalni, przed startem; „moje pokoje” w localStorage `crownforge-rooms`), `sync.ts` (`reconcile`: dopisz ruchy
  z bazy albo odtwórz grę przy konflikcie), `config.ts` (`ONLINE_DB`, do testów `VITE_ONLINE_DB` przy budowaniu). Reguły bazy: `firebase/database.rules.json`
  (zmiana zapisu = zmiana reguł + `scripts/fake-firebase.mjs`). Format pokoju `ROOM_V`; pokój pamięta `CARDS_REV`
  – inna wersja kart = komunikat „odśwież aplikację”.
- `src/ui/` – React.
  - `App.tsx` – ekrany: start, ustawienia, Królestwo (losowe/ręczne, przełącznik Smocze Złoto+Pałac), zasady.
  - `Online.tsx` – poczekalnia pokoju (link, gracze, Królestwo, start; gość: wyróżnione pole „Wpisz swoje imię” na górze,
    „Dołącz” bez imienia najpierw prosi o imię, drugie stuknięcie = „Gracz N”; „✎ Zmień” przy własnym imieniu), `JoinScreen` (wklejenie linku), `OnlineRoom`
    (połączenie z pokojem → `GameScreen` z `online`). Link: `#room=<id>`, odczytywany przy starcie i przy `hashchange` (link wklejony w otwartej karcie).
  - `GameScreen.tsx` – plansza; „ja” = `online.seat` (solo 0), boty liczy tylko gospodarz (`runBots`), online bez Cofnij
    i bez „Zacznij od nowa”; pętla botów, autozapis (`store.ts`, localStorage, `SavedGame.v = 2`;
    zmiana przebiegu tury wymaga podbicia wersji; zmiana działania kart → `CARDS_REV` + `CHANGED_IN`).
  - `Fx.tsx` – animacje (`useCardFx`): silnik zapisuje zdarzenia w `Game.fx` (`hand` = dobrane z efektu / włożone na rękę,
    `gain`, `trash`; zwykłe dobieranie 5 kart – `draw(p, n, true)` – bez zdarzenia). Zdobyte karty innych graczy (i moje
    zakupy) lecą ze stosu (`data-pile`) do gracza (`.opp[data-p]`) / do talii; moje karty z efektów – okienko, karty
    dochodzą po kolei, potem lecą na rękę/talię, spalone przechylają się i wpadają do kosza. Ręka chowa karty,
    które jeszcze są w okienku (`fx.hidden`); boty czekają na koniec animacji. Wyłącznik: `settings.anim` (menu gry).
    Karty odkryte u przeciwników przez atak: `Game.revealFx(by, v, src, cards, out, show)` → zdarzenie `reveal`
    (co z każdą kartą: odrzucona / wraca na talię / spalona; `show` = komu pokazać) → okienko `RevealSheet` z wierszem
    na każdego przeciwnika (~2 s, stuknięcie zamyka). Tym samym okienkiem pokazujemy skutek każdego ataku (`RevealOut`:
    odrzucona / wraca na talię / spalona / zdobyta / zdobyta na talię). Zasada: widzi to, kto nie wybierał sam.
    Rzezimieszek, Tkaczka Uroków, Smocza Danina: grający i ofiara (zdobyty Urok/Grosz ofiary nie ma osobnego „Zdobywasz”);
    Herszt Bandytów, Syrena, Najemny Strażnik, Prastary Smok, Hrabianka, Skandal, Trujące Opary: grający (Opary bez Skarbu
    na ręce – też ofiara); Plotka: ofiara; Smoczątko: nikt (karta zakryta). Nowy atak → też `revealFx`.
  - `CardView.tsx` – `CardFace`, `PileTile`, `PlayedCard`, `usePress` (stuknięcie / dwuklik /
    przytrzymanie), `ConfirmButton` (zamiast `window.confirm`, który w podglądzie jest blokowany).
  - `Icons.tsx` – ikona dziennika (otwarta książka, inna niż ☰ menu) i `ShareButton` (trzy połączone kropki,
    lewy górny róg ekranu startowego; udostępnia stały adres GitHub Pages: share → schowek → komunikat).
  - `motifs.ts` – rysunki kart (pole 48×48, ziemia ~y=44; `m` linie, `a` akcent, `f` wypełnienia).
  - `art.ts` – tło karty (kratka / łuski dla Skarbca / sześciokąty dla Wieży), symbole pakietów
    (Twierdza: wieża; Skarbiec: konturowy łeb smoka z otwartą paszczą, patrzy w lewo, bez płomienia,
    bez tła; Wieża: konturowa buteleczka eliksiru; Dwór: konturowa maska karnawałowa z wypełnionymi oczami, przechylona, z falującymi sznureczkami,
    tło w arlekinowe romby). Karty wielotypowe (bez Ataku) mają ramkę po skosie w dwóch kolorach
    (`typeClass`, `--tc2`).
  - Koszt z Eliksirem: komponent `Cost` (moneta + fioletowa buteleczka `Flask`); licznik Eliksirów
    na pasku fazy, gdy stos Eliksiru jest w grze.
- `src/i18n.ts` – wszystkie teksty UI/podpowiedzi/dziennika EN+PL (`tr`, liczba mnoga PL).
- Tłumaczenie przeglądarki wyłączone (`translate="no"`, `<meta name="google" content="notranslate">`, też w `main.tsx`
  dla podglądu): Google Tłumacz podmieniał teksty, React się wywracał (szary ekran, błąd „removeChild”), imiona
  graczy były „tłumaczone” („Do” → „Rób”). `ErrorBoundary.tsx` – zamiast szarego ekranu komunikat z treścią błędu
  i „Wróć do gry” (owija całą aplikację oraz ekrany gry/pokoju w `App.tsx`).
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
  w ustawieniach, w menu gry i na ekranie Królestwa – losowe i ręczny wybór; tam kafelki też w wybranym widoku): „Obraz” albo „Symbole” – niski pasek obrazu, nazwa, pod nią skrót działania
  karty ikonkami (zestaw „kontur”: +N karta, +N A = akcja, torba = zakup, płaska złota moneta bez cyfry (liczba przed nią), tarcza PZ, kosz = spal,
  karty ze strzałką = odrzuć, prostokąt z 3 kropkami = dłuższy opis). Symbole: `src/ui/symbols.ts` – bonusy
  z `plus`/`coins`, resztę opisuje `EXTRA` (test pilnuje wpisu dla każdej karty Królestwa; przy zmianie
  działania karty poprawić też jej wpis). Na niskim ekranie
  i poziomo bez obrazka, licznik i koszt w górnym pasku. Stałe stosy bez zmian.
- Pasek fazy można zwinąć do jednej linijki (strzałka; `settings.barCollapsed`, null = auto: zwinięty
  w poziomie). Podpowiedzi do wyborów (atak, palenie) widać zawsze.
- Bonus monet na karcie (`plus.coins`): „+N” i złota moneta bez cyfry (`.plus-coin`), nie napis „+N monety”.
- Skarby na karcie: duża moneta z wartością (najważniejsza informacja). Moneta (`.coin`) jest **płaska**:
  jednolite pole i podniesiony rant (jasny u góry, ciemny u dołu), cyfra szeryfowa – bez wypukłego środka.
- Królestwo: od najtańszej (lewy dolny róg) do najdroższej (prawy górny).
- Liczba kart na stosie: kwadracik w lewym górnym rogu. Licznik monet: tylko zagrane monety.
  Faza zakupów: „Faza zakupów: (monety) Zakupy N”. „Koniec tury” – niebieski przycisk, obok „↶ Cofnij”.
  Przewijanie tur botów: mała ikonka „»” zawsze po lewej stronie paska fazy (nie tam, gdzie „Koniec tury”);
  „Koniec tury/akcji” ignoruje stuknięcia przez 0,8 s od początku mojej tury.
- Ręka powyżej 5 kart: takie same karty zgrupowane w stosik (dwie karty przesunięte, tylna przyciemniona, w prawo i w górę) z licznikiem „×N” (przy wyborze „k/N”), na pigułce
  talii dochodzi „Ręka N”. Stuknięcie gra/zaznacza kolejną kartę z grupy (gdy więcej się nie da – odznacza).
  Gdy miejsc (karty + stosiki) jest więcej niż 5 (telefon pionowo) albo 8 (poziomo i komputer), ręka przewija się
  w bok (`.hand.scroll`, wygaszone brzegi, strzałki ‹ ›); stosik jest szerszy, by przednia karta miała rozmiar pojedynczej.
- Dwuklik: kupno/zdobycie stosu, zatwierdzenie wyboru kart. Przytrzymanie: podgląd karty.
- Główny przycisk ekranu (Królestwo →, Rozpocznij grę, Utwórz pokój, Dołącz…) zawsze widoczny: klasa `.sticky`
  (przyklejony do dołu `.page`, musi być bezpośrednio w `.page`, nie w `<section>`); w okienkach `.sheet-actions`
  i `.end-buttons` też przyklejone. Pola, które trzeba wypełnić przed głównym przyciskiem, na górze ekranu.
- Esc zamyka okienka (`useEscape` w `CardView.tsx` – stos: zamyka tylko to na wierzchu, np. najpierw pytanie
  „Nowa gra?”, potem menu). Okienko wyboru (opcje, odkryte karty) Esc chowa jak „Pokaż rękę”. Nowe okienko = `useEscape`.
- Okienko wyboru (odkryte karty, opcje) ma „Pokaż rękę” – chowa je (`peek`), na pasku fazy pojawia się
  „Wróć do wyboru”.

## Polecenia

```bash
npm install
npm test          # vitest: symulacje gier botów, testy kart, PWA
npm run build     # tsc + vite build → dist/ (z sw.js)
node scripts/fake-firebase.mjs 9400   # udawana baza do testów gry online; build z VITE_ONLINE_DB=http://localhost:9400
```

Podgląd dla użytkownika (Artifact na claude.ai, ten sam link przy każdej publikacji:
https://claude.ai/artifact/F3ksA6gomJxuCgJprtkHNx):
`npm run build && python3 scripts/build-artifact.py <scratchpad>` → opublikuj `<scratchpad>/crownforge.html`
narzędziem Artifact. Do testów lokalnych dołóż na początku `<!doctype html><meta name="viewport" ...>`.

Weryfikacja wizualna: Playwright (Chromium jest preinstalowany), emulacja `devices['Pixel 7']`,
`devices['iPhone 8']` i okno 1280×720; zrzuty oglądać przed zgłoszeniem.

## Sposób pracy z użytkownikiem

- Gałąź robocza, PR do `main` dopiero na prośbę („Rób PR”); po scaleniu GitHub Actions publikuje
  na https://zbludzakowe-zabawy.github.io/Dominionek/ (instalowana PWA).
- Po każdej zmianie: testy, build, podgląd Artifact, commit + push na gałąź.
- Commity i PR po polsku.
