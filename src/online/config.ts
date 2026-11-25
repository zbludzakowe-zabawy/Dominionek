// Ustawienia gry online.
//
// Adres bazy Firebase Realtime Database (projekt crownforge-5710b). Nie jest tajny: bezpieczeństwo
// zapewniają reguły bazy (firebase/database.rules.json) i losowy, długi identyfikator pokoju w linku.
// Gracze nie mogą go zmienić w aplikacji. Do testów lokalnych można go podmienić przy budowaniu:
//   VITE_ONLINE_DB=http://localhost:9400 npm run build   (udawana baza: scripts/fake-firebase.mjs)
export const ONLINE_DB: string =
  import.meta.env.VITE_ONLINE_DB || 'https://crownforge-5710b-default-rtdb.europe-west1.firebasedatabase.app';
