// The house from the design boards: a 5-level wardrobe and an under-bed drawer.
// Used for "Try with a sample house" on first run, and by the tests.

import { slotsOfLevel } from './grid';
import * as ops from './ops';
import { mergeSlots } from './grid';
import { emptyTables, type Depth, type ID, type Tables } from './types';

type BinSpec = [cell: string, number: number, category: string, items?: (string | [string, number])[]];

const DAY = 86_400_000;

export function sampleHouse(now = new Date()): Tables {
  let t = ops.ensureOthers(emptyTables(), now);
  const cats = new Map<string, ID>();
  const cat = (name: string) => {
    if (name === 'Others') return 'others';
    if (!cats.has(name)) {
      const r = ops.createCategory(t, { name, description: DESCRIPTIONS[name] ?? '' });
      t = r.tables;
      cats.set(name, r.categoryId);
    }
    return cats.get(name)!;
  };

  const wardrobe = ops.createUnit(t, {
    name: 'Wardrobe',
    room: 'Bedroom',
    kind: 'shelving',
    level: { name: 'Top shelf', code: 'A', across: 4, deep: 3, high: 1 },
  });
  t = wardrobe.tables;
  const levelB = ops.addLevel(t, wardrobe.unitId, { name: 'Middle shelf', code: 'B', across: 4, deep: 3, high: 1 });
  t = levelB.tables;
  t = mergeSlots(t, levelB.levelId, 'B', 1).tables;
  const levelC = ops.addLevel(t, wardrobe.unitId, { name: 'Bottom shelf', code: 'C', across: 4, deep: 3, high: 2 });
  t = levelC.tables;
  const levelD = ops.addLevel(t, wardrobe.unitId, { name: 'Books & bits', code: 'D', type: 'looseShelf', across: 3 });
  t = levelD.tables;
  const levelE = ops.addLevel(t, wardrobe.unitId, { name: 'Drawers', code: 'E', type: 'drawers', reach: 'openTop', across: 5 });
  t = levelE.tables;
  const underBed = ops.createUnit(t, {
    name: 'Under bed',
    room: 'Bedroom',
    kind: 'pullOutDrawer',
    level: { name: 'Pull-out drawer', code: 'U', across: 3, deep: 2, high: 1 },
  });
  t = underBed.tables;

  const levelIds: Record<string, ID> = {
    A: wardrobe.levelId,
    B: levelB.levelId,
    C: levelC.levelId,
    E: levelE.levelId,
    U: underBed.levelId,
  };

  /** "A3F", "C2B1" (stack index 1 = upper), "E3". */
  const slotFor = (cell: string): ID => {
    const levelId = levelIds[cell[0]];
    const column = Number(cell[1]);
    const depth = (cell[2] ?? 'F') as Depth;
    const stackIndex = Number(cell[3] ?? 0);
    const s = slotsOfLevel(t, levelId).find((x) => x.column === column && x.depth === depth && x.stackIndex === stackIndex);
    if (!s) throw new Error(`No slot ${cell}`);
    return s.id;
  };

  const place = (specs: BinSpec[], nicknames: Record<number, string> = {}) => {
    for (const [cell, number, category, items = []] of specs) {
      const categoryId = cat(category);
      t = ops.updateSettings(t, { lastBinNumber: number - 1 });
      const r = ops.createBin(t, { categoryId, slotId: slotFor(cell), nickname: nicknames[number] }, new Date(now.getTime() - 12 * DAY));
      t = r.tables;
      addItems({ binId: r.binId }, items);
    }
  };

  let minute = 0;
  const addItems = (home: ops.Home, items: (string | [string, number])[]) => {
    for (const spec of items) {
      const [name, quantity] = typeof spec === 'string' ? [spec, 1] : spec;
      const at = new Date(now.getTime() - 140 * DAY + minute++ * 60_000);
      t = ops.addItem(t, { name, home, quantity }, at).tables;
    }
  };

  place(
    [
      ['A1B', 1, 'Cables', ['Old micro-USB cables', 'Spare HDMI cable']],
      ['A2B', 2, 'Old phones', ['iPhone 8', 'Pixel 3']],
      ['A3B', 3, 'Paperwork', ['Tax 2024', 'Warranties']],
      ['A1M', 5, 'Electronics', ['Soldering iron', 'Solder']],
      ['A2M', 6, 'Electronics', ['Jumper wires', 'Breadboards']],
      ['A3M', 7, 'Keys & locks', ['Spare house keys', 'Bike lock']],
      ['A4M', 8, 'Fasteners', ['Zip ties']],
      ['A1F', 10, 'Tools', ['Tape measure', 'Spirit level']],
      ['A2F', 12, 'Electronics', [['ESP32 boards', 5], 'Breadboard', 'Multimeter']],
      ['A3F', 11, 'Fasteners', ['Screws', 'Wall plugs']],
      ['A4F', 9, 'Lights', ['Bulbs', 'Fairy lights (spare)']],
    ],
    { 1: 'Spare cables', 2: 'Old phones', 3: 'Docs archive', 5: 'Soldering', 6: 'Breadboards', 10: 'Measuring', 12: 'Electronics parts' },
  );

  place(
    [
      ['B1B', 21, 'Winter', ['Wool blanket', 'Gloves', 'Winter coat']],
      ['B3B', 22, 'Adapters', ['USB-C hub', 'Travel plug adapter', 'HDMI adapter']],
      ['B4B', 23, 'Paperwork', ['Manuals']],
      ['B1M', 24, 'Travel', ['Neck pillow', 'TSA padlock']],
      ['B2M', 25, 'Sports', ['Resistance bands', 'Jump rope']],
      ['B3M', 26, 'Kitchen', ['Spare mugs', 'Cake tin']],
      ['B4M', 27, 'Puzzles', ['1000-piece puzzle']],
      ['B1F', 28, 'Cables', [['USB-C cables', 4], 'Lightning cable']],
      ['B2F', 29, 'Chargers', ['Phone charger', 'Laptop charger']],
      [
        'B3F',
        30,
        'Batteries',
        [
          ['AA batteries', 12],
          ['AAA batteries', 8],
        ],
      ],
      ['B4F', 31, 'Tools', ['Screwdriver set', 'Hammer']],
    ],
    { 26: 'Kitchen extras' },
  );

  place(
    [
      ['C1B0', 41, 'Party', ['Balloons']],
      ['C1B1', 42, 'Party', ['Party hats']],
      ['C2B0', 44, 'Lights', ['Fairy lights']],
      ['C2B1', 43, 'Candles', [['Candles', 6]]],
      ['C3B0', 45, 'Picnic', ['Picnic blanket']],
      ['C3B1', 46, 'Picnic', ['Thermos']],
      ['C4B', 47, 'Kitchen', ['Lunch boxes']],
      ['C1M0', 48, 'Bedding', ['Spare duvet']],
      ['C1M1', 49, 'Bedding', ['Pillowcases']],
      ['C2M0', 50, 'Rain gear', ['Rain jacket']],
      ['C2M1', 51, 'Rain gear', ['Umbrella']],
      ['C3M', 52, 'Winter', ['Thermals']],
      ['C1F0', 53, 'Sports', ['Gym towel']],
      ['C1F1', 54, 'Sports', ['Yoga mat strap']],
      ['C2F0', 55, 'Sports', ['Stretch bands']],
      ['C2F1', 56, 'Sports', ['Jump rope (spare)']],
      ['C3F', 57, 'Sports', ['Football']],
    ],
    {
      41: 'Party',
      42: 'Party',
      44: 'Fairy lights',
      47: 'Lunch boxes',
      52: 'Thermals',
      53: 'Gym',
      54: 'Gym',
      55: 'Jump, stretch',
      56: 'Jump, stretch',
      57: 'Football',
    },
  );

  // Others lives in the front corner of the bottom shelf, easy to grab.
  const others = Object.values(t.bins).find((b) => b.isOthers)!;
  t = ops.placeBin(t, others.id, slotFor('C4F'), now);
  addItems({ binId: others.id }, ['Desk lamp', 'Label maker', 'Bike light']);

  place(
    [
      ['E1', 71, 'Clothes', [['Socks', 14]]],
      ['E2', 72, 'Clothes', ['Gym shorts', 'Gym shirt']],
      ['E3', 73, 'Keys & locks', ['Car key (spare)']],
      ['E5', 75, 'Clothes', [['Shoes', 3]]],
    ],
    { 71: 'Socks', 72: 'Gym clothes', 73: 'Keys & spares', 75: 'Shoes' },
  );

  const zones = Object.values(t.zones)
    .filter((z) => z.levelId === levelD.levelId)
    .sort((a, b) => a.order - b.order);
  addItems({ zoneId: zones[0].id }, ['Notebooks', 'Board games']);
  addItems({ zoneId: zones[1].id }, ['Mug', 'Keypad']);
  addItems({ zoneId: zones[2].id }, [['Novels', 5]]);

  place(
    [
      ['U1B', 61, 'Winter', ['Scarves', 'Winter gloves']],
      ['U2B', 62, 'Winter', ['Thermal shirt', 'Thermal leggings']],
      ['U3B', 63, 'Travel', ['Travel pillow', 'Luggage lock']],
      ['U1F', 64, 'Travel', ['Packing cubes']],
      ['U2F', 65, 'Sports', ['Swim goggles', 'Water bottle']],
    ],
    { 61: 'Winter', 62: 'Thermals', 64: 'Packing cubes' },
  );

  // Fill orders and fill levels as on the boards.
  const byNumber = (n: number) => Object.values(t.bins).find((b) => b.number === n)!;
  t = ops.updateCategory(t, cat('Cables'), { binOrder: [byNumber(28).id, byNumber(1).id] });
  t = ops.updateCategory(t, cat('Tools'), { binOrder: [byNumber(31).id, byNumber(10).id] });
  t = ops.updateBin(t, byNumber(12).id, { fillEstimate: 90 });
  t = ops.updateBin(t, byNumber(22).id, { fillEstimate: 20 });
  t = ops.updateBin(t, byNumber(28).id, { fillEstimate: 60 });

  // History that makes the design states visible.
  const find = (name: string) => Object.values(t.items).find((i) => i.name === name)!;
  const winter = Object.values(t.bins).find((b) => b.number === 21)!;
  t = { ...t, bins: { ...t.bins, [winter.id]: { ...winter, lastConfirmedAt: new Date(now.getTime() - 152 * DAY).toISOString() } } };
  const hub = find('USB-C hub');
  for (const d of [26, 19, 12, 5, 2]) {
    t = ops.takeOut(t, hub.id, 1, new Date(now.getTime() - d * DAY));
    t = ops.returnItem(t, hub.id, undefined, new Date(now.getTime() - d * DAY + 3_600_000));
  }
  t = ops.takeOut(t, find('HDMI adapter').id, 1, new Date(now.getTime() - 19 * DAY));
  t = ops.takeOut(t, find('Umbrella').id, 1, new Date(now.getTime() - 6 * DAY));
  t = ops.takeOut(t, find('ESP32 boards').id, 1, new Date(now.getTime() - 2 * 3_600_000));
  t = ops.updateSettings(t, { lastBinNumber: 75 });
  return t;
}

const DESCRIPTIONS: Record<string, string> = {
  Cables: 'Any cable, cord or lead; not chargers',
  Chargers: 'Wall plugs and charging bricks',
  Adapters: 'Dongles, hubs, plug adapters',
  Electronics: 'Boards, components, soldering and test gear',
  Tools: 'Hand tools and measuring',
  Batteries: 'Loose batteries of any size',
  Lights: 'Bulbs, lamps, fairy lights',
  Fasteners: 'Screws, plugs, zip ties, nails',
  'Keys & locks': 'Spare keys, padlocks, bike locks',
  Winter: 'Cold-weather clothes and blankets',
  Travel: 'Things for trips',
  Sports: 'Gym, exercise and ball games',
  Kitchen: 'Kitchen things not in daily use',
  Paperwork: 'Documents, manuals, receipts',
};
