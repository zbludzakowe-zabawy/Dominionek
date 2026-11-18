// Rysunki kart: proste ilustracje kreską w polu 48×48 (ziemia ok. y=44).
// m – linie główne, a – linie akcentu, f – małe wypełnione akcenty.

export interface Motif {
  m: string;
  a?: string;
  f?: string;
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
};
