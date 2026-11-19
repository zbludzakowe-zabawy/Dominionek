// Rysunki kart: proste ilustracje kreską w polu 48×48 (ziemia ok. y=44).
// m – linie główne, a – linie akcentu, f – małe wypełnione akcenty.

export interface Motif {
  m: string;
  a?: string;
  f?: string;
  /** Własne kolory zamiast palety typu karty (np. fioletowy Eliksir). */
  colors?: { m?: string; a?: string; f?: string; fOpacity?: number };
}

/** Okrąg jako ścieżka. */
const c = (x: number, y: number, r: number) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
/** Elipsa jako ścieżka. */
const e = (x: number, y: number, rx: number, ry: number) =>
  `M${x - rx} ${y}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0`;
/** Gwiazdka (iskra). */
const spark = (x: number, y: number, r: number) =>
  `M${x} ${y - r}V${y + r}M${x - r} ${y}H${x + r}M${x - r * 0.6} ${y - r * 0.6}l${r * 1.2} ${r * 1.2}M${x + r * 0.6} ${y - r * 0.6}l${-r * 1.2} ${r * 1.2}`;
const star = (x: number, y: number, r: number) => {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.42 : r;
    const ang = (i / 10) * Math.PI * 2 - Math.PI / 2;
    d += `${i ? 'L' : 'M'}${(x + Math.cos(ang) * rr).toFixed(1)} ${(y + Math.sin(ang) * rr).toFixed(1)}`;
  }
  return d + 'Z';
};
const ground = 'M2 44H46';
const waves = (y: number) => `M2 ${y}q3 -2.5 6 0t6 0t6 0t6 0t6 0t6 0t6 0t6 0`;

const ELIXIR_BODY = 'M19.6 4.8h8.8M20.92 4.8v11.0L12.12 30.54a7.92 7.92 0 0 0 6.82 11.66h10.12a7.92 7.92 0 0 0 6.82 -11.66L27.08 15.8v-11.0';
const ELIXIR_LIQUID = 'M15.2 26.14h17.6l2.86 5.28a5.72 5.72 0 0 1 -5.06 8.58H17.4a5.72 5.72 0 0 1 -5.06 -8.58z';
const ELIXIR_VARIANTS: Record<'purple' | 'gold', Motif> = {
  // w kolorach ikonki kosztu (obrys i wypełnienie z kart akcji)
  purple: {
    m: ELIXIR_BODY,
    a: spark(40, 10, 3) + spark(8, 14, 2),
    f: ELIXIR_LIQUID,
    colors: { m: '#a9b8c6', a: '#d9cfae', f: '#6d7d8e', fOpacity: 0.95 },
  },
  // kształt jak ikonka, kolorystyka złota (skarb)
  gold: {
    m: ELIXIR_BODY,
    a: 'M15.2 26.14h17.6' + spark(40, 10, 3) + spark(8, 14, 2),
    f: c(21, 34, 1.4) + c(27, 32, 1.1) + c(24, 38, 0.9),
  },
};
export let ELIXIR_STYLE: 'purple' | 'gold' = 'purple';

export const MOTIFS: Record<string, Motif> = {
  // ---------- skarby ----------
  copper: {
    m: c(24, 25, 14) + c(24, 25, 10.5),
    a: 'M21 22h6v6h-6z',
  },
  silver: {
    m: c(18, 28, 12) + c(18, 28, 8.5) + c(31, 20, 12) + c(31, 20, 8.5),
    a: spark(31, 20, 3),
  },
  gold: {
    m:
      e(24, 38, 15, 4.5) + 'M9 38v-5M39 38v-5' + e(24, 33, 15, 4.5) + 'M9 33v-5M39 33v-5' + e(24, 28, 15, 4.5) +
      'M12 28v-5M36 28v-5' + e(24, 22, 12, 4),
    a: spark(40, 10, 4) + spark(9, 12, 2.5),
  },

  // ---------- punkty ----------
  homestead: {
    m: ground + 'M10 44V27L24 15L38 27V44M21 44V35H27V44M13 30h5v5h-5zM31 21V13h4v11',
    a: 'M33 10q-3 -3 0 -5q3 -2 0 -5',
  },
  manor: {
    m: ground + 'M14 44V22L24 12L34 22V44M4 44V29H14M34 29H44V44M21 44V36a3 3 0 0 1 6 0V44M17 25h3v4h-3zM28 25h3v4h-3zM7 33h4v4H7zM37 33h4v4h-4z',
    a: c(24, 20, 2),
  },
  citadel: {
    m:
      ground +
      'M6 44V15H8V12H10V15H12V12H14V15H16V44M32 44V15H34V12H36V15H38V12H40V15H42V44M16 24H18V21H20V24H22V21H24V24H26V21H28V24H30V21H32M20 44V36a4 4 0 0 1 8 0V44M10 21v4M38 21v4',
    a: 'M24 21V8l7 2.5L24 13',
  },
  hex: {
    m: 'M5 25Q24 8 43 25Q24 42 5 25Z' + c(24, 25, 6.5) + 'M24 9V4M14 12l-3 -4M34 12l3 -4M24 41v4M14 38l-3 4M34 38l3 4',
    f: c(24, 25, 2.6),
  },

  // ---------- Twierdza na Rozstajach ----------
  ward: {
    m: ground + 'M14 44L16 13Q24 5 32 13L34 44',
    a: 'M24 17V38M24 23L30 19M24 29L18 25',
  },
  hedgewitch: {
    m: 'M9 31H39Q37 43 24 43Q11 43 9 31ZM31 31L39 14M7 44H41',
    a: 'M18 31C17 23 19 17 22 10M19 23q-5 -2 -6 -6q5 0 6 6M20 17q5 -3 6 -7q-5 1 -6 7M14 31q-1 -5 2 -9',
  },
  pilgrim: {
    m: 'M2 44Q24 38 46 44M34 7V44' + e(18, 21, 12, 3.5) + 'M11 21Q12 11 18 11Q24 11 25 21',
    a: c(34, 9, 2.6) + 'M15 16l3 -3l3 3M16.5 16v-1.5M19.5 16v-1.5',
  },
  gnome: {
    m: 'M12 21H34M14 21L24 3L33 21M14 21Q13 37 23 43Q33 37 33 21M39 9V35M36 35h6l-1 8h-4z',
    a: 'M19 26h2M27 26h2M18 33q5 3 11 0',
    f: c(24, 29, 2.2) + c(24, 3.5, 1.6),
  },
  inn: {
    m: 'M8 44V6M8 8H36M8 14L14 8M16 8V14M32 8V14M12 14h24v15H12z',
    a: 'M19 18h8v8h-8zM27 20h2a2 2 0 0 1 0 4h-2M19 18q4 -3 8 0',
  },
  ranger: {
    m: 'M14 5Q36 24 14 43M14 5V43',
    a: 'M5 24H40M40 24l-5 -3M40 24l-5 3M9 24l-3 -3M9 24l-3 3M12 24l-3 -3M12 24l-3 3',
  },
  herald: {
    m: 'M9 19H30L41 11V29L30 21H9Z' + c(7, 20, 2),
    a: 'M15 21V36L19 33L23 36V21',
  },
  tinker: {
    m: 'M8 25H32V37Q32 43 20 43Q8 43 8 37ZM8 25Q20 12 32 25M4 44H44',
    a: 'M31 18L43 6M28 9l5 -5l5 5l-5 5z',
  },
  guard: {
    m: 'M38 6V44M10 12H30V26Q30 38 20 44Q10 38 10 26Z',
    a: 'M38 3l-3 7h6zM20 18V36M14 25H26',
  },
  lantern: {
    m: waves(45) + 'M17 42L20 17H28L31 42M18.4 34H29.6M19.3 25H28.7M19 17V11H29V17M18 11L24 6L30 11',
    a: 'M31 12L45 8M31 14L45 18M17 12L3 8M17 14L3 18',
    f: c(24, 14, 1.6),
  },
  tithe: {
    m: 'M24 8V40M15 43H33M8 14H40M8 14L4 26M8 14L12 26M40 14L36 26M40 14L44 26M3 26Q8 31 13 26ZM35 26Q40 31 45 26Z' + c(24, 7, 1.5),
    a: c(8, 23, 2.2) + c(40, 22, 2.6),
  },
  forgemaster: {
    m: 'M6 24H36Q41 24 43 19V26Q39 30 33 30L31 35H35V41H13V35H17L15 30Q9 30 6 24Z',
    a: 'M24 21L32 7M28 4l7 4l-3 5l-7 -4zM16 18l-3 -4M20 16l1 -5M12 21l-5 -2',
  },
  siren: {
    m: waves(36) + waves(42) + 'M21 35Q18 23 28 15M28 35Q25 25 31 19',
    a: 'M29 16L22 8Q27 10 29.5 14Q32 9 37 8Z' + c(40, 25, 1.6) + 'M41.6 25V18l3 1',
  },
  orchard: {
    m: ground + 'M22 44V31Q22 27 17 25M26 44V31Q26 27 31 25M10 22a7 7 0 0 1 6 -11a9 9 0 0 1 16 0a7 7 0 0 1 6 11a7 7 0 0 1 -9 6H19a7 7 0 0 1 -9 -6Z',
    f: c(16, 17, 1.8) + c(27, 13, 1.8) + c(33, 21, 1.8) + c(22, 22, 1.8),
  },
  minstrel: {
    m: 'M8 34Q6 22 15 21Q20 17 24 23Q30 26 27 33Q22 44 10 40Q7 38 8 34Z' + c(17, 31, 3) + 'M24 22L39 7M37 5l5 5',
    a: 'M14 37L35 11M16 38L36 12M40 26v-8l5 1.5v8M40 26a1.6 1.6 0 1 1 -1 -1.5M45 27.5a1.6 1.6 0 1 1 -1 -1.5',
  },
  horn: {
    m: 'M6 34Q5 15 25 14H33L42 7V25L33 19H25Q12 19 12 34Z' + e(9, 34, 3, 1.4),
    a: 'M14 16Q21 28 29 19M45 12q2 4 0 8M47 9q4 7 0 14',
  },
  footpad: {
    m: 'M8 42Q8 12 24 8Q40 12 40 42M15 42Q15 22 24 19Q33 22 33 42M4 44H44',
    a: 'M20 30h2M26 30h2M30 38L44 24M33 35l4 4M41 23l3 -3',
  },
  scriptorium: {
    m: 'M4 36Q14 30 24 36Q34 30 44 36V18Q34 12 24 18Q14 12 4 18ZM24 18V36M9 22q5 -2 10 0M9 26q5 -2 10 0M29 22q5 -2 10 0M29 26q5 -2 10 0',
    a: 'M31 2Q42 5 37 15L29 25M29 25l-1 3',
  },
  bazaar: {
    m: 'M4 18L24 6L44 18M4 18q5 4 10 0t10 0t10 0t10 0M8 21V44M40 21V44M6 33H42M4 44H44',
    a: c(14, 30, 2.5) + c(20, 30, 2.5) + 'M27 28h5v5h-5zM35 31l2 -4l2 4z',
  },
  weaver: {
    m: (() => {
      let d = '';
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        d += `M24 24L${(24 + Math.cos(ang) * 21).toFixed(1)} ${(24 + Math.sin(ang) * 21).toFixed(1)}`;
      }
      for (const r of [6, 12, 18]) {
        for (let i = 0; i <= 8; i++) {
          const ang = (i / 8) * Math.PI * 2;
          d += `${i ? 'L' : 'M'}${(24 + Math.cos(ang) * r).toFixed(1)} ${(24 + Math.sin(ang) * r).toFixed(1)}`;
        }
      }
      return d;
    })(),
    a: 'M34 2V12M31 12l-3 -2M31 14l-3 2M37 12l3 -2M37 14l3 2',
    f: c(34, 13.5, 2.4),
  },
  banditchief: {
    m: 'M9 43L39 9M39 43L9 9',
    a: 'M34 6Q42 8 41 17L37 13ZM14 6Q6 8 7 17L11 13Z',
    f: e(24, 26, 6, 2.6),
  },
  smelter: {
    m: 'M8 44V23Q24 7 40 23V44M16 44V35Q24 27 32 35V44M4 44H44M30 14V4H35V18',
    a: 'M20 44q-2 -5 2 -8q0 4 3 4q-1 -5 3 -7q-1 5 1 8q1 2 -1 3',
  },
  council: {
    m: 'M6 16L24 6L42 16ZM10 19V39M18 19V39M30 19V39M38 19V39M6 40H42M4 44H44M6 18H42',
    a: c(24, 12, 1.8),
  },
  sage: {
    m: ground + 'M18 44V18L24 9L30 18V44M18 18H30M22 25a2 3 0 0 1 4 0v4h-4zM22 34a2 3 0 0 1 4 0v4h-4z',
    a: 'M40 6a7 7 0 1 0 4 12a6 6 0 0 1 -4 -12',
    f: star(10, 10, 4),
  },
  artisan: {
    m: 'M8 33H40V44H8ZM14 38q4 -3 8 0t8 0',
    a: 'M14 27L28 11M26 9l4 4M30 6l8 -3l4 4l-3 8l-5 -5zM31 10l-4 6',
  },

  // ---------- Skarbiec Smoka ----------
  dragongold: {
    m: c(24, 25, 15) + c(24, 25, 11.5),
    a: 'M17 31Q16 23 24 21L28 17L28.5 21Q32 22 32 26L28 26.5Q26 31 17 31Z' + spark(41, 8, 3.5),
    f: c(26.5, 23.5, 0.9),
  },
  palace: {
    m:
      ground +
      'M10 44V26H38V44M18 26a6 6 0 0 1 12 0M24 20V13M4 44V31H10M38 31H44V44M4 31a3 3 0 0 1 6 0M38 31a3 3 0 0 1 6 0M21 44V37a3 3 0 0 1 6 0V44M13 30h3v4h-3zM32 30h3v4h-3z',
    a: 'M24 13l6 2l-6 2',
  },
  hoardrat: {
    m: e(21, 35, 10, 6) + 'M29 31L39 35L29 38M11 37q-8 2 -8 -6q0 -6 6 -6M4 44H44' + c(29, 30, 2.4),
    a: c(41, 41, 3.5) + 'M39.5 41h3',
    f: c(33, 34, 0.9),
  },
  clerk: {
    m: 'M8 12h24v31h-24zM12 12v31',
    a: 'M17 20v8M20 20v8M23 20v8M26 20v8M15 29l13 -10M17 34v6M20 34v6',
    f: '',
  },
  moneychanger: {
    m: 'M8 10h32v30h-32zM8 18.5h32M8 26.5h32M8 34.5h32M6 44l4 -4M42 44l-4 -4',
    a: c(14, 18.5, 2.3) + c(19, 18.5, 2.3) + c(33, 18.5, 2.3) + c(24, 26.5, 2.3) + c(29, 26.5, 2.3) + c(13, 34.5, 2.3) + c(35, 34.5, 2.3),
  },
  gildedscale: {
    // złota smocza łuska jako amulet na łańcuszku
    m: 'M5 4Q24 22 43 4M24 19Q34 21 34 30Q34 39 24 45Q14 39 14 30Q14 21 24 19Z' + c(24, 15.5, 2.6),
    a: 'M24 23Q30 25 30 30Q30 36 24 41M19 27q1 -3 4 -4' + spark(39, 30, 3) + spark(9, 34, 2),
    f: c(11, 9.2, 0.9) + c(16, 12.6, 0.9) + c(32, 12.6, 0.9) + c(37, 9.2, 0.9),
  },
  wyrmling: {
    m:
      'M26 21Q15 26 18 38Q24 45 33 40Q41 42 43 46M24 10Q30 8 34 12Q37 15 35 19L41 20L36 23Q32 25 27 22Q22 18 24 10ZM26 10l-2 -6l5 4M2 44H46',
    a: 'M22 27L9 14L12 25L4 23L16 34',
    f: c(31, 14.5, 1.1),
  },
  gemcutter: {
    m: 'M14 16h20l8 9l-18 19l-18 -19zM6 25h36M14 16l4 9l6 19M34 16l-4 9l-6 19M18 25l6 -9l6 9',
    a: spark(41, 8, 3) + spark(7, 9, 2),
  },
  tribute: {
    m: 'M9 28h30v15h-30zM9 28q15 -12 30 0M9 34h30M4 44h40',
    a: 'M22 31h4v5h-4z' + c(16, 8, 2.6) + c(24, 4, 2.6) + c(32, 10, 2.6) + c(20, 15, 2.6),
  },
  ancientcoin: {
    m: c(24, 25, 15) + 'M24 8v2M24 40v2M7 25h2M39 25h2M12 13l1.4 1.4M36 13l-1.4 1.4M12 37l1.4 -1.4M36 37l-1.4 -1.4',
    a: 'M16 31Q16 21 25 20L30 15L30 20Q34 21 34 25L29 26Q27 32 16 31Z',
    f: c(28, 22, 0.9),
  },
  strongroom: {
    m: 'M8 25h32v18h-32zM8 25q16 -15 32 0M16 18v25M32 18v25M4 44h40',
    a: 'M22 30h4v6h-4zM24 31.5v2',
  },
  mint: {
    m: 'M12 44V14h24V44M8 44h32M24 14V5M14 5h20M16 30h16',
    a: c(24, 36, 4) + spark(41, 22, 3) + spark(7, 24, 2.5),
  },
  altar: {
    m: 'M12 33h24v11h-24zM9 29h30v4h-30zM6 44h36',
    a: 'M24 27q-8 -6 -1 -14q1 5 4 5q-1 -6 3 -10q1 7 3 10q3 7 -9 9z',
  },
  map: {
    m: 'M8 9h28q4 0 4 4v27q0 4 -4 4h-28q4 0 4 -4v-27q0 -4 -4 -4z',
    a: 'M15 36q5 -9 10 -5t7 -11M29 13l5 5M34 13l-5 5',
  },
  lair: {
    m: 'M2 44L13 20L23 10L33 18L46 44M13 44Q24 22 35 44',
    a: e(24, 41, 7, 2.2) + e(24, 38, 5, 1.8),
    f: c(21, 31, 1.1) + c(27, 31, 1.1),
  },
  hoardkey: {
    m: c(13, 24, 7) + c(13, 24, 3) + 'M20 24H43M37 24v7M41 24v6',
    a: 'M13 15v-3M13 36v-3M4 24h3M22 20l4 4l-4 4',
  },
  goldsmith: {
    m: e(18, 33, 11, 6.5) + e(18, 33, 7, 3.6) + 'M4 44h40',
    a: 'M18 22l-3 -4h6zM30 22L41 9M37 5l7 4l-3 5l-7 -4z',
  },
  elderdragon: {
    m:
      'M5 42Q9 27 20 22L30 18Q37 14 45 16L40 20L45 22Q38 26 32 26L24 28Q16 33 12 43M28 18L23 7L31 15M33 16L35 6M10 33l-6 -1l4 -4M14 27l-4 -5l6 0',
    a: 'M46 24q3 2 1 5M45 28q3 3 0 6',
    f: c(33.5, 19.5, 1.3),
  },

  // ---------- Wieża Alchemika ----------
  // Eliksir: ta sama buteleczka co w ikonce kosztu (ELIXIR_STYLE wybiera wariant)
  elixir: ELIXIR_VARIANTS[ELIXIR_STYLE],
  apprentice: {
    m: 'M6 32h36M6 38h36M8 32v12M40 32v12M13 14v22a2.5 2.5 0 0 0 5 0V14M21.5 10v26a2.5 2.5 0 0 0 5 0V10M30 16v20a2.5 2.5 0 0 0 5 0V16',
    a: 'M13 26h5M21.5 22h5M30 29h5M12 14h7M20.5 10h7M29 16h7',
  },
  mortar: {
    m: 'M8 26H40Q38 38 28 40H20Q10 38 8 26ZM18 40l-2 4h16l-2 -4M27 26L36 6',
    a: 'M34 4l4 2',
    f: c(16, 23, 0.9) + c(20, 22, 0.9) + c(24, 23, 0.9) + c(30, 22.5, 0.9) + c(33, 23.5, 0.9),
  },
  crystal: {
    m: c(24, 20, 12) + 'M15 32h18l-3 6h-12zM10 44h28M19 38l-2 6M29 38l2 6',
    a: 'M18 19q6 -7 12 0q-6 7 -12 0M24 12v2M24 26v2',
    f: c(24, 19, 1.4),
  },
  quicksilver: {
    m: 'M22 6Q32 20 32 27a10 10 0 0 1 -20 0Q12 20 22 6Z' + e(38, 38, 4, 3) + e(9, 40, 3, 2.2),
    a: 'M17 26q0 -5 3 -8M36 37q1 -1 3 -1',
  },
  vapors: {
    m: 'M16 26v14q0 4 4 4h8q4 0 4 -4V26M14 26h20',
    a: 'M20 22q-5 -4 0 -8t0 -8M28 22q5 -4 0 -8t0 -8M24 20q-3 -3 0 -6',
    f: c(22, 36, 1.2) + c(27, 33, 1.2) + c(24, 39, 1),
  },
  alembic: {
    m: 'M6 44h20M8 44V34a8 8 0 0 1 16 0V44M11 28q5 -10 10 0M16 22V18M16 18L40 12M40 12v8M36 26a6 6 0 1 0 8 0V20h-8z',
    a: 'M12 44q-1 -4 2 -5q0 2 2 2q-1 -3 2 -5q0 4 2 5q1 2 -1 3',
  },
  cauldron: {
    m: 'M8 22h32M10 22Q10 40 24 40Q38 40 38 22M14 40l-3 5M34 40l3 5',
    a: c(18, 15, 2.6) + c(26, 11, 3) + c(32, 16, 2) + c(22, 5, 1.6),
    f: '',
  },
  transmute: {
    m: c(24, 24, 19) + c(24, 24, 7) + 'M24 5L40.5 33.5H7.5Z',
    a: 'M24 17v14M17 24h14',
    f: c(24, 5, 1.6) + c(40.5, 33.5, 1.6) + c(7.5, 33.5, 1.6),
  },
  retort: {
    m: c(17, 31, 11) + 'M23 22Q28 12 44 14M44 14l-1 4M8 44h20M12 42l-2 2M22 42l2 2',
    a: 'M8 33q4 -3 9 0t9 0',
    f: c(14, 36, 1.2) + c(20, 37, 1),
  },
  herbgarden: {
    m: 'M4 44H44M6 44V38H42V44',
    a: 'M12 38V26M12 30q-5 -1 -6 -6q5 0 6 6M12 28q5 -2 6 -7q-5 1 -6 7M24 38V18M24 24q-6 -1 -7 -7q6 0 7 7M24 21q6 -2 7 -8q-6 1 -7 8M36 38V28M36 31q4 -1 5 -5q-4 0 -5 5',
    f: c(24, 15, 2),
  },
  homunculus: {
    m: 'M12 44V18Q12 7 24 7Q36 7 36 18V44M8 44h32' + c(24, 22, 4),
    a: 'M24 26v8M24 29l-5 -3M24 29l5 -3M24 34l-3 6M24 34l3 6',
    f: c(22.5, 21.5, 0.8) + c(25.5, 21.5, 0.8),
  },
  golem: {
    m: 'M18 4h12v10h-12zM13 15h22v17h-22zM13 16l-5 14M35 16l5 14M17 32v12M31 32v12M14 44h6M28 44h6',
    a: 'M20 8h2M26 8h2M17 21l4 4M31 20l-3 6M22 28h5',
  },
  magnumopus: {
    m: c(24, 24, 9) + 'M24 4v6M24 38v6M4 24h6M38 24h6M10 10l4 4M34 34l4 4M38 10l-4 4M10 38l4 -4',
    a: star(24, 24, 5),
    f: c(24, 24, 1.4),
  },
};
