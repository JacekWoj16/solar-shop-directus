/**
 * Catalogue seed data.
 *
 * Manufacturer and model names are real, and prices are in the range a Polish
 * installer would actually see in 2026 (panels land around 0.45–0.65 PLN/W net),
 * because a catalogue full of "Product 17 — 100.00 PLN" demonstrates nothing
 * about how the pricing logic behaves. The shop itself is fictional.
 */

export const categories = [
  {
    name: 'Solar Panels',
    slug: 'solar-panels',
    description:
      'Monocrystalline and bifacial modules from 400 W upward. Sold by the pallet: minimum order five modules.',
    // Panels ship on pallets; five is the smallest quantity a courier will take.
    min_quantity: 5,
    quantity_step: 1,
    sort_order: 1,
  },
  {
    name: 'Inverters',
    slug: 'inverters',
    description:
      'String, hybrid and three-phase inverters for residential and commercial installations.',
    min_quantity: 1,
    quantity_step: 1,
    sort_order: 2,
  },
  {
    name: 'Mounting Systems',
    slug: 'mounting-systems',
    description:
      'Rails, roof hooks, clamps and ballast systems for tile, sheet, trapezoid and flat roofs.',
    min_quantity: 1,
    quantity_step: 1,
    sort_order: 3,
  },
  {
    name: 'Cables & Connectors',
    slug: 'cables-connectors',
    description:
      'Solar cable, MC4 connectors and glands. Cable is sold on 10-metre rolls.',
    min_quantity: 1,
    quantity_step: 1,
    sort_order: 4,
  },
  {
    name: 'Monitoring',
    slug: 'monitoring',
    description:
      'Communication modules, smart meters and dataloggers for plant supervision.',
    min_quantity: 1,
    quantity_step: 1,
    sort_order: 5,
  },
  {
    name: 'Accessories',
    slug: 'accessories',
    description:
      'Surge protection, DC switches, fuses and installation labelling.',
    min_quantity: 1,
    quantity_step: 1,
    sort_order: 6,
  },
  {
    name: 'Energy Storage',
    slug: 'energy-storage',
    description:
      'High-voltage and low-voltage battery systems with matching battery inverters.',
    min_quantity: 1,
    quantity_step: 1,
    sort_order: 7,
  },
];

/**
 * Tier shapes per category: [min_quantity, max_quantity, discount from base].
 *
 * Panels get four brackets because that is where volume actually moves;
 * accessories get two. The discounts are the interesting part — they are what
 * the nudge in the cart is computed from.
 *
 * The first bracket always starts at the category's own minimum quantity. A
 * "1–4" bracket on a category that will not sell fewer than five modules is a
 * bracket no buyer can ever reach, and printing it in the volume-pricing table
 * only invites the question of why it is there. (`resolveTier` handles that
 * case anyway — it just should not be manufactured on purpose.)
 */
export const tierShapes = {
  'solar-panels': [
    [5, 49, 0],
    [50, 199, 0.04],
    [200, 499, 0.075],
    [500, null, 0.12],
  ],
  inverters: [
    [1, 2, 0],
    [3, 9, 0.04],
    [10, null, 0.08],
  ],
  'mounting-systems': [
    [1, 49, 0],
    [50, null, 0.1],
  ],
  'cables-connectors': [
    [1, 49, 0],
    [50, null, 0.12],
  ],
  monitoring: [
    [1, 4, 0],
    [5, null, 0.07],
  ],
  accessories: [
    [1, 49, 0],
    [50, null, 0.11],
  ],
  'energy-storage': [
    [1, 2, 0],
    [3, 9, 0.05],
    [10, null, 0.09],
  ],
};

/**
 * Products, grouped by category slug.
 * [sku, brand, name, base net price PLN, power_watts, stock_status]
 */
export const products = {
  'solar-panels': [
    ['PNL-JKO-N430', 'Jinko Solar', 'Tiger Neo N-Type 430W JKM430N-54HL4-V black frame', 246.5, 430, 'in_stock'],
    ['PNL-JKO-N440', 'Jinko Solar', 'Tiger Neo N-Type 440W JKM440N-54HL4-V black frame', 251.9, 440, 'in_stock'],
    ['PNL-JKO-N445', 'Jinko Solar', 'Tiger Neo N-Type 445W JKM445N-54HL4-V full black', 268.4, 445, 'in_stock'],
    ['PNL-JKO-N455', 'Jinko Solar', 'Tiger Neo N-Type 455W JKM455N-54HL4R-V', 259.3, 455, 'in_stock'],
    ['PNL-JKO-N470', 'Jinko Solar', 'Tiger Neo N-Type 470W JKM470N-60HL4-V', 268.0, 470, 'low_stock'],
    ['PNL-JKO-N580', 'Jinko Solar', 'Tiger Neo N-Type 580W JKM580N-72HL4-BDV bifacial', 313.2, 580, 'in_stock'],
    ['PNL-JKO-N610', 'Jinko Solar', 'Tiger Neo N-Type 610W JKM610N-78HL4-BDV bifacial', 329.4, 610, 'in_stock'],
    ['PNL-TRN-S425', 'Trina Solar', 'Vertex S+ 425W TSM-NEG9R.28 black frame', 244.8, 425, 'in_stock'],
    ['PNL-TRN-S435', 'Trina Solar', 'Vertex S+ 435W TSM-NEG9R.28 black frame', 250.6, 435, 'in_stock'],
    ['PNL-TRN-S445', 'Trina Solar', 'Vertex S+ 445W TSM-NEG9RC.27 full black', 267.0, 445, 'low_stock'],
    ['PNL-TRN-N585', 'Trina Solar', 'Vertex N 585W TSM-NEG21C.20 bifacial', 304.2, 585, 'in_stock'],
    ['PNL-TRN-N605', 'Trina Solar', 'Vertex N 605W TSM-NEG21C.20 bifacial', 314.6, 605, 'in_stock'],
    ['PNL-TRN-N715', 'Trina Solar', 'Vertex N 715W TSM-NEG21C.20 N-Type bifacial', 346.5, 715, 'in_stock'],
    ['PNL-CSI-T440', 'Canadian Solar', 'TOPHiKu6 440W CS6R-440T N-Type', 253.0, 440, 'in_stock'],
    ['PNL-CSI-T450', 'Canadian Solar', 'TOPHiKu6 450W CS6R-450T N-Type', 258.8, 450, 'in_stock'],
    ['PNL-CSI-T460', 'Canadian Solar', 'TOPHiKu6 460W CS6R-460T all black', 278.3, 460, 'out_of_stock'],
    ['PNL-CSI-H590', 'Canadian Solar', 'HiKu7 590W CS7N-590MS mono PERC', 300.9, 590, 'in_stock'],
    ['PNL-CSI-H605', 'Canadian Solar', 'HiKu7 605W CS7N-605MS mono PERC', 308.6, 605, 'low_stock'],
    ['PNL-LON-H430', 'Longi', 'Hi-MO 6 Explorer 430W LR5-54HTH black frame', 247.7, 430, 'in_stock'],
    ['PNL-LON-H445', 'Longi', 'Hi-MO 6 Explorer 445W LR5-54HTH', 256.9, 445, 'in_stock'],
    ['PNL-LON-H455', 'Longi', 'Hi-MO 6 Scientist 455W LR5-54HAH full black', 275.4, 455, 'in_stock'],
    ['PNL-LON-H580', 'Longi', 'Hi-MO 7 580W LR7-72HGD N-Type bifacial', 310.9, 580, 'in_stock'],
    ['PNL-LON-H610', 'Longi', 'Hi-MO 7 610W LR7-72HGD N-Type bifacial', 326.4, 610, 'in_stock'],
    ['PNL-JAS-D430', 'JA Solar', 'DeepBlue 4.0 430W JAM54D40-430/LB bifacial', 249.4, 430, 'in_stock'],
    ['PNL-JAS-D440', 'JA Solar', 'DeepBlue 4.0 440W JAM54D40-440/LB bifacial', 254.7, 440, 'low_stock'],
    ['PNL-JAS-D450', 'JA Solar', 'DeepBlue 4.0 450W JAM54D41-450/LB full black', 272.5, 450, 'in_stock'],
    ['PNL-JAS-D615', 'JA Solar', 'DeepBlue 4.0 Pro 615W JAM72D42-615/LB', 331.6, 615, 'in_stock'],
    ['PNL-JAS-D630', 'JA Solar', 'DeepBlue 4.0 Pro 630W JAM72D42-630/LB', 342.9, 630, 'in_stock'],
  ],

  inverters: [
    ['INV-SE-SE5K', 'SolarEdge', 'SE5K-RWS Home Hub three-phase 5 kW hybrid', 7420.0, null, 'in_stock'],
    ['INV-SE-SE8K', 'SolarEdge', 'SE8K-RWS Home Hub three-phase 8 kW hybrid', 8180.0, null, 'in_stock'],
    ['INV-SE-SE10K', 'SolarEdge', 'SE10K-RWS Home Hub three-phase 10 kW hybrid', 8940.0, null, 'low_stock'],
    ['INV-FRN-G60', 'Fronius', 'Symo GEN24 6.0 Plus three-phase hybrid', 9260.0, null, 'in_stock'],
    ['INV-FRN-G80', 'Fronius', 'Symo GEN24 8.0 Plus three-phase hybrid', 10340.0, null, 'in_stock'],
    ['INV-FRN-G100', 'Fronius', 'Symo GEN24 10.0 Plus three-phase hybrid', 11480.0, null, 'in_stock'],
    ['INV-HUA-5KTL', 'Huawei', 'SUN2000-5KTL-M1 three-phase 5 kW', 4180.0, null, 'in_stock'],
    ['INV-HUA-10KTL', 'Huawei', 'SUN2000-10KTL-M1 three-phase 10 kW', 5240.0, null, 'in_stock'],
    ['INV-GW-5000MS', 'GoodWe', 'GW5000-MS single-phase 5 kW', 2980.0, null, 'in_stock'],
    ['INV-GW-10KET', 'GoodWe', 'GW10K-ET Plus three-phase 10 kW hybrid', 7690.0, null, 'low_stock'],
  ],

  'mounting-systems': [
    ['MNT-K2-SR36', 'K2 Systems', 'SingleRail 36 aluminium rail 4400 mm', 128.4, null, 'in_stock'],
    ['MNT-K2-MR', 'K2 Systems', 'MiniRail 5 set for trapezoid sheet roof', 41.9, null, 'in_stock'],
    ['MNT-K2-SD6', 'K2 Systems', 'S-Dome 6 east-west flat roof base', 96.7, null, 'in_stock'],
    ['MNT-K2-HK', 'K2 Systems', 'TileFix 3S adjustable roof hook stainless', 27.3, null, 'in_stock'],
    ['MNT-ESD-CFE', 'Esdec', 'ClickFit EVO base for tile roof', 24.8, null, 'in_stock'],
    ['MNT-ESD-CFH', 'Esdec', 'ClickFit EVO roof hook set of 2', 38.5, null, 'low_stock'],
    ['MNT-REN-MS', 'Renusol', 'MetaSole+ mounting set for sheet roof', 33.6, null, 'in_stock'],
    ['MNT-REN-VS', 'Renusol', 'VS+ ballast console for flat roof 10 deg', 74.2, null, 'in_stock'],
  ],

  'cables-connectors': [
    ['CBL-STA-MC4P', 'Stäubli', 'MC4 connector pair male + female 4-6 mm2', 18.9, null, 'in_stock'],
    ['CBL-STA-EVO2', 'Stäubli', 'MC4-Evo2 connector pair 1500 V', 24.6, null, 'in_stock'],
    ['CBL-STA-MC4T', 'Stäubli', 'MC4 branch connector Y-type pair', 46.2, null, 'low_stock'],
    ['CBL-HEL-S4B', 'Helukabel', 'Solarflex-X H1Z2Z2-K 4 mm2 black, 10 m roll', 34.5, null, 'in_stock'],
    ['CBL-HEL-S4R', 'Helukabel', 'Solarflex-X H1Z2Z2-K 4 mm2 red, 10 m roll', 34.5, null, 'in_stock'],
    ['CBL-HEL-S6B', 'Helukabel', 'Solarflex-X H1Z2Z2-K 6 mm2 black, 10 m roll', 49.8, null, 'in_stock'],
    ['CBL-LAP-XLR4', 'Lapp', 'OLFLEX SOLAR XLR 4 mm2 black, 10 m roll', 36.9, null, 'in_stock'],
    ['CBL-LAP-XLR6', 'Lapp', 'OLFLEX SOLAR XLR 6 mm2 black, 10 m roll', 52.4, null, 'low_stock'],
    ['CBL-GEN-GLM20', 'Weidmüller', 'Cable gland M20 IP68 with lock nut', 6.4, null, 'in_stock'],
    ['CBL-GEN-FER6', 'Weidmüller', 'Insulated ferrule 6 mm2, pack of 100', 28.7, null, 'in_stock'],
  ],

  monitoring: [
    ['MON-HUA-DONG', 'Huawei', 'Smart Dongle-WLAN-FE communication module', 289.0, null, 'in_stock'],
    ['MON-HUA-SLOG', 'Huawei', 'SmartLogger 3000A datalogger', 2340.0, null, 'in_stock'],
    ['MON-HUA-DTSU', 'Huawei', 'DTSU666-H three-phase smart meter 250 A', 754.0, null, 'in_stock'],
    ['MON-FRN-SM63', 'Fronius', 'Smart Meter TS 65A-3 three-phase', 1180.0, null, 'low_stock'],
    ['MON-SE-MTR', 'SolarEdge', 'Modbus energy meter with 3 current transformers', 1420.0, null, 'in_stock'],
  ],

  accessories: [
    ['ACC-DEH-DC1K', 'Dehn', 'DEHNguard M YPV SCI 1000 DC surge arrester type 2', 318.0, null, 'in_stock'],
    ['ACC-DEH-AC3P', 'Dehn', 'DEHNguard M TNS 275 AC surge arrester type 2', 264.5, null, 'in_stock'],
    ['ACC-EAT-DC32', 'Eaton', 'DC isolator switch 32 A 1000 V 4-pole', 187.3, null, 'in_stock'],
    ['ACC-EAT-FUS15', 'Eaton', 'gPV fuse link 15 A 1000 V 10x38', 14.2, null, 'in_stock'],
    ['ACC-EAT-FUSH', 'Eaton', 'Fuse holder 10x38 1000 V DC single pole', 22.8, null, 'in_stock'],
    ['ACC-GEN-LBL', 'Generic', 'PV warning label set, self-adhesive, 10 pcs', 11.9, null, 'in_stock'],
    ['ACC-GEN-CLIP', 'Generic', 'Stainless cable clip for module frame, 100 pcs', 46.7, null, 'low_stock'],
    ['ACC-GEN-BOX4', 'Generic', 'DC combiner box 2 strings IP65 with surge protection', 486.0, null, 'in_stock'],
  ],

  'energy-storage': [
    ['BAT-BYD-HVS51', 'BYD', 'Battery-Box Premium HVS 5.1 kWh high voltage', 12480.0, null, 'in_stock'],
    ['BAT-BYD-HVM110', 'BYD', 'Battery-Box Premium HVM 11.0 kWh high voltage', 21900.0, null, 'low_stock'],
    ['BAT-PYL-US5000', 'Pylontech', 'US5000 4.8 kWh 48 V low voltage', 6840.0, null, 'in_stock'],
    ['BAT-PYL-FH2', 'Pylontech', 'Force-H2 7.1 kWh high voltage stack', 11250.0, null, 'in_stock'],
    ['BAT-HUA-LUNA10', 'Huawei', 'LUNA2000-10-S0 10 kWh with battery module', 18600.0, null, 'in_stock'],
  ],
};

/**
 * Builds the tier rows for one product from its category shape.
 * Discounts are applied to the base price and rounded to whole grosze.
 */
export function buildTiers(categorySlug, basePrice) {
  const shape = tierShapes[categorySlug] ?? [[1, null, 0]];

  return shape.map(([min_quantity, max_quantity, discount], index) => ({
    min_quantity,
    max_quantity,
    unit_price: Math.round(basePrice * (1 - discount) * 100) / 100,
    sort_order: index + 1,
  }));
}

/**
 * Placeholder imagery. A deterministic seed per SKU keeps the same product
 * showing the same picture across reseeds, which makes screenshots stable.
 */
export function imageUrl(sku) {
  return `https://picsum.photos/seed/${sku.toLowerCase()}/400/400.webp`;
}
