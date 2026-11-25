# Gra online (Firebase Realtime Database)

Gra dla 2–4 osób (plus ewentualnie boty) przez link-pokój. Bez logowania: kto ma link, ten gra.
Bez własnego serwera: stan gry leży w bazie Firebase Realtime Database, a każde urządzenie odtwarza
go deterministycznym silnikiem (`Game.replay`).

## Jak to działa

- Gospodarz: **Gra online** → gracze (człowiek / bot) → Królestwo → **Utwórz pokój** → wysyła link.
- Gość otwiera link (albo w aplikacji: **Dołącz do gry** i wkleja link) → wpisuje imię → **Dołącz**.
- Gdy wszystkie miejsca są zajęte, gospodarz stuka **Rozpocznij grę**.
- Gra zapisuje się w bazie po każdym ruchu – można ją przerwać i wrócić (ekran startowy → „Twoje gry online”).
- Boty liczy urządzenie gospodarza – ruszają się, gdy gospodarz ma otwartą grę.
- Zielona kropka przy graczu = ma teraz otwartą grę. W tytule karty przeglądarki „●” = czeka na mój ruch.
- Cofanie ruchów jest wyłączone (ruch od razu widzą inni).
- **Rewanż** (ustawia tylko gospodarz): po końcu gry gospodarz stuka „Rewanż” → ekran jak „Gra online”, ale z graczami
  poprzedniej gry z imionami (✕ usuwa gracza na stałe, „+ Dodaj miejsce” = nowy gracz z tym samym linkiem albo bot),
  Królestwo podpowiedziane z poprzedniej gry. Pozostali w tym czasie widzą okienko „Czekaj…” z kubkiem herbaty
  (pole `prep` w starym pokoju; „Wstecz” u gospodarza je kasuje, po 30 min bez rewanżu przestaje się pokazywać).
  Nowy pokój powstaje od razu z graczami na ich miejscach; bez nowych graczy także od razu ze `start` – wszyscy
  przechodzą prosto do gry. Stary pokój dostaje `next` = id nowego, więc gracze (i stary link) przechodzą sami.
  Usunięty gracz zobaczy „Gospodarz zaczął nową grę bez ciebie”; nowy gracz ze starym linkiem trafia do poczekalni.
- **Kasowanie** (robią to urządzenia graczy przy uruchomieniu aplikacji, reguły bazy pilnują czasu):
  - pokój bez gry przez 14 dni (`ROOM_TTL_DAYS`; ostatnia aktywność = pole `act`, zapisywane co 30 s, gdy ktoś
    ma pokój otwarty) – z bazy i z listy „Twoje gry online”;
  - pokój zastąpiony rewanżem (ma `next`) – po 2 dniach bez aktywności (`OLD_TTL_DAYS`), bo służy już tylko
    jako przekierowanie starego linku;
  - pokój z poddaną grą (ma `end`) – też po 2 dniach bez aktywności (lista pamięta to jako `over`).
  Każde urządzenie sprząta tylko pokoje ze swojej listy. Resztę (pokoje, których nikt już nie ma na liście)
  usuwa cotygodniowe sprzątanie na GitHubie – niżej.
- Brak tajemnic: kto zna się na narzędziach programisty, może podejrzeć cudze karty (wspólne ziarno losowania).

## Dane w bazie

```
rooms/<id pokoju: 20 losowych znaków>/
  cfg    – JSON (tekst): {v, rev, seed, kingdom, extras, slots:[{k:'h'} | {k:'b', level}]}   – zapis raz
  at     – czas założenia
  end    – nr miejsca gracza, który poddał grę – zapis raz, po starcie; potem bez nowych ruchów
  seats  – {<nr miejsca>: {name, cid}}           – zajęcie miejsca: zapis tylko w puste miejsce, przed startem;
                                                    samo `name` można zmienić w poczekalni (przed startem)
  start  – czas rozpoczęcia                       – zapis raz
  moves  – {<nr>: JSON odpowiedzi}                – zapis tylko w puste miejsce, po starcie
  ping   – {<nr miejsca>: czas}                   – „jestem w grze”, co 30 s
  act    – ostatnia aktywność (czas)              – co 30 s, gdy ktoś ma pokój otwarty
  prep   – gospodarz ustawia rewanż (czas, 0 = nie) – po starcie
  next   – id pokoju z rewanżem                    – zapis raz, po starcie
```

Cały pokój można usunąć (zapis `null`), gdy ostatnia aktywność (`act`, a bez niego `at`) jest starsza niż 14 dni,
albo – gdy pokój ma już `next` albo `end` – starsza niż 2 dni.

Zapis „tylko w puste miejsce” (reguła `!data.exists()`) sprawia, że dwa urządzenia nie nadpiszą sobie ruchów.
Gdyby jednak dwa zapisały ruch o tym samym numerze (np. jeden gracz na dwóch telefonach), wygrywa pierwszy,
a drugie urządzenie odtwarza grę z bazy (`src/online/sync.ts`).

## Zakładanie bazy (raz, w przeglądarce)

1. Wejdź na https://console.firebase.google.com i zaloguj się kontem Google.
2. **Utwórz projekt** (Create a project), np. `crownforge`. Google Analytics – można wyłączyć.
   (Firebase zakłada przy tym zwykły projekt Google Cloud o tej samej nazwie.)
3. W menu po lewej: **Kompilacja / Build → Realtime Database → Utwórz bazę danych**.
   - Lokalizacja: **Belgia (europe-west1)**.
   - Tryb: **zablokowany (locked mode)** – reguły i tak zaraz podmienimy.
4. Zakładka **Reguły (Rules)**: usuń zawartość, wklej cały plik `firebase/database.rules.json` z repozytorium,
   **Opublikuj**.
5. Na zakładce **Dane (Data)** u góry jest adres bazy, np.
   `https://crownforge-1a2b3-default-rtdb.europe-west1.firebasedatabase.app` – skopiuj go.
6. Adres wpisz w `src/online/config.ts` (`ONLINE_DB`). Gracze nie mogą go zmienić w aplikacji, a link do pokoju
   zawiera tylko identyfikator pokoju.

**Po każdej zmianie `firebase/database.rules.json` trzeba wkleić reguły na nowo i opublikować (krok 4).**

Obecna baza: `https://crownforge-5710b-default-rtdb.europe-west1.firebasedatabase.app` (projekt `crownforge-5710b`,
reguły opublikowane i sprawdzone 25.11).

Nie trzeba: rejestrować „aplikacji internetowej” w Firebase, kluczy API, logowania, karty płatniczej.
Plan bezpłatny (Spark): 1 GB danych, 10 GB pobrań miesięcznie, 100 równoczesnych połączeń – jedna partia
to kilkadziesiąt KB.

Gdy reguły nie są ustawione (baza w „trybie testowym”), gospodarz zobaczy w poczekalni ostrzeżenie.

Stare pokoje można co jakiś czas usunąć w konsoli (zakładka Dane → `rooms` → ⋮ → Usuń) – aplikacja nie kasuje ich sama.

## Testy lokalne (bez internetu)

```bash
node scripts/fake-firebase.mjs 9400        # udawana baza z regułami (--open = bez reguł)
VITE_ONLINE_DB=http://localhost:9400 npm run build && npx vite preview --port 4173
```

Dwie przeglądarki (albo okno zwykłe i prywatne)
= dwóch graczy. Logika pokoju ma testy w `src/online/room.test.ts` (magazyn w pamięci).

## Cotygodniowe sprzątanie (GitHub Actions)

Workflow `.github/workflows/cleanup-rooms.yml` w każdy poniedziałek (3:37 UTC) uruchamia `scripts/cleanup-rooms.mjs`.
Skrypt loguje się do bazy kluczem konta usługi Firebase (omija reguły, więc widzi wszystkie pokoje) i usuwa:
pokoje bez gry przez 14 dni, pokoje po rewanżu i z poddaną grą po 2 dniach i puste śmieci – te same zasady co w aplikacji.
Ręcznie: zakładka **Actions → Sprzątanie pokoi gry online → Run workflow** (domyślnie „Próba” – tylko wypisuje,
co byłoby usunięte; odznacz, żeby naprawdę usunąć).

Klucz (raz):
1. Konsola Firebase → projekt → ⚙ obok „Przegląd projektu” → **Ustawienia projektu** → zakładka **Konta usługi**
   → **Wygeneruj nowy klucz prywatny** → pobiera się plik `.json`.
2. GitHub → repozytorium → **Settings → Secrets and variables → Actions → New repository secret**:
   nazwa `FIREBASE_SERVICE_ACCOUNT`, wartość = cała zawartość pliku `.json`.
3. Plik z dysku usunąć (klucz daje pełny dostęp do projektu Firebase; na GitHubie jest zaszyfrowany).

Test lokalny: `FIREBASE_DB=http://localhost:9400 node scripts/cleanup-rooms.mjs --no-auth --dry-run` (z `fake-firebase.mjs`).
