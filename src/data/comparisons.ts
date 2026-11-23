/*
  Brand comparison data for /compare/*.

  Rules for editing this file:
  - Pronorm facts must match the rest of pronormusa.com (FAQ, About, Why Pronorm).
  - Every competitor fact needs a public source in `sources`. No competitor prices:
    neither brand publishes a US price list, so we tell readers to compare quotes.
  - Each page must say plainly where the other brand is the better choice.
*/

export interface ComparisonRow {
  label: string;
  pronorm: string;
  other: string;
}

export interface ComparisonFaq {
  q: string;
  a: string;
}

export interface ComparisonSource {
  label: string;
  url: string;
}

export interface Comparison {
  slug: string;
  brand: string;
  title: string;
  description: string;
  summary: string;
  rows: ComparisonRow[];
  choosePronorm: string[];
  chooseOther: string[];
  faqs: ComparisonFaq[];
  sources: ComparisonSource[];
}

export const LAST_REVIEWED = '2026-11-22';

/* Shared Pronorm facts, stated once so the four pages cannot drift apart. */
export const pronormFacts = {
  founded: 'Building kitchens in Vlotho, Germany since 1972',
  madeIn: 'Vlotho, Eastern Westphalia, Germany',
  lines: 'Y-line and X-line (handleless) and Proline128 (handled), combinable in one kitchen',
  depth: '610 mm (24 in) base and tall cabinet depth as standard for US orders',
  usPresence:
    'Eleven authorized showrooms as of August 2026, in California, Arizona, Colorado, Nevada, and Washington, with protected dealer territories',
  price: 'Typical installed kitchens run $40,000 to $150,000+',
  leadTime: 'Factory production typically 6 to 9 weeks, plus about 6 weeks ocean shipping',
  hardware: 'Blum, Hettich, and Grass; soft-close standard',
};

export const comparisons: Comparison[] = [
  {
    slug: 'pronorm-vs-leicht',
    brand: 'Leicht',
    title: 'Pronorm vs Leicht: German Kitchens Compared',
    description:
      'Pronorm vs Leicht for a US kitchen: where each is made, US showroom coverage, cabinet depths, handleless lines, lead times, and how to compare quotes.',
    summary:
      'Both are German-made fitted kitchens sold through independent US showrooms. Leicht has the larger and longer-established US showroom network. Pronorm has a smaller network with protected territories, ships a 24-inch-deep cabinet as standard for US rooms, and is generally quoted in the premium mid-range. If a Leicht showroom is near you and a Pronorm showroom is not, that alone may decide it. If both are in reach, get the same plan quoted by each.',
    rows: [
      { label: 'Company', pronorm: pronormFacts.founded, other: 'Founded 1928 by brothers Alois and Josef Leicht' },
      { label: 'Made in', pronorm: pronormFacts.madeIn, other: 'Waldstetten, Swabia, Germany' },
      { label: 'US showrooms', pronorm: pronormFacts.usPresence, other: 'Sold through the LEICHT USA network of independent showrooms; one US dealer release cites more than 50 US showrooms' },
      { label: 'Product structure', pronorm: pronormFacts.lines, other: 'Multiple door programs within one cabinet system, handled and handleless' },
      { label: 'Cabinet depth for US rooms', pronorm: pronormFacts.depth, other: 'Ask the showroom which base and tall depths it orders for US appliances' },
      { label: 'Price position', pronorm: pronormFacts.price, other: 'No published US price list; compare written quotes on the same plan' },
      { label: 'Lead time', pronorm: pronormFacts.leadTime, other: 'Quoted by the showroom per order' },
    ],
    choosePronorm: [
      'You want a German fitted kitchen planned at American depths without custom-depth upcharges or fillers behind US appliances.',
      'You want to mix handleless and handled fronts in one kitchen on one platform.',
      'A Pronorm showroom serves your area and you value a dealer with a protected territory.',
    ],
    chooseOther: [
      'There is a Leicht showroom near you and no Pronorm showroom. Local design and installation matter more than the logo.',
      'You want a brand with decades of US architect and showroom presence behind it.',
      'A specific Leicht door program or finish is what you have fallen for.',
    ],
    faqs: [
      { q: 'Is Pronorm cheaper than Leicht?', a: 'Neither brand publishes a US price list, and the final number depends on the plan, fronts, and appliances. Typical installed Pronorm kitchens run $40,000 to $150,000+. The only reliable comparison is to have the same floor plan quoted in writing by a Pronorm showroom and a Leicht showroom.' },
      { q: 'Are Pronorm and Leicht both made in Germany?', a: 'Yes. Pronorm builds in Vlotho, Eastern Westphalia. Leicht builds in Waldstetten, Swabia. Both ship finished kitchens to US dealers.' },
      { q: 'Which has more US showrooms, Pronorm or Leicht?', a: 'Leicht. Pronorm had eleven authorized US showrooms as of August 2026, in California, Arizona, Colorado, Nevada, and Washington. Leicht sells through a larger national network of independent showrooms.' },
      { q: 'Do Pronorm kitchens fit American appliances?', a: 'Yes. Pronorm ships 610 mm (24 inch) base and tall cabinet depths as standard for US orders, so US dishwashers, ranges, and panel-ready refrigeration sit flush without fillers. The factory still builds in millimeters.' },
    ],
    sources: [
      { label: 'Leicht company profile, Archilovers', url: 'https://www.archilovers.com/teams/616576/leicht-kuchen.html' },
      { label: 'Studio Europa Leicht press release (US showroom count)', url: 'https://www.24-7pressrelease.com/press-release/482736/studio-europa-leicht-celebrates-20-years-in-business-and-10-years-as-san-diegos-leicht-dealer-san-diego-ca' },
      { label: 'Pronorm manufacturing history, KBzine', url: 'https://thekbzine.com/pages/17049/pronorm_announces_new_managing_directors_as_heinz_hachmeiser_retires/' },
    ],
  },
  {
    slug: 'pronorm-vs-bauformat',
    brand: 'Bauformat',
    title: 'Pronorm vs Bauformat: German Kitchens Compared',
    description:
      'Pronorm vs Bauformat for a US kitchen: factories, US dealer coverage, price ladder, American cabinet depths, handleless lines, and how to compare quotes.',
    summary:
      'Both are German-made frameless kitchens sold through US dealers. Bauformat runs a US subsidiary and a wide price ladder that reaches lower entry points. Pronorm sells one platform across three combinable lines, ships a 24-inch-deep cabinet as standard for US rooms, and gives its dealers protected territories. Budget-led projects often start with Bauformat. Projects led by fit and finish at American depths should get a Pronorm quote alongside.',
    rows: [
      { label: 'Company', pronorm: pronormFacts.founded, other: 'Family group founded 1917, now in its third generation; sister brand burger' },
      { label: 'Made in', pronorm: pronormFacts.madeIn, other: 'Löhne (Eastern Westphalia) and Burg near Magdeburg, Germany' },
      { label: 'US presence', pronorm: pronormFacts.usPresence, other: 'Bauformat USA; sold through a select network of dealers plus architects, designers, and developers' },
      { label: 'Product structure', pronorm: pronormFacts.lines, other: 'Trade press describes ten price points, from entry level to premium' },
      { label: 'Cabinet depth for US rooms', pronorm: pronormFacts.depth, other: 'Ask the dealer which base and tall depths it orders for US appliances' },
      { label: 'Price position', pronorm: pronormFacts.price, other: 'No published US price list; compare written quotes on the same plan' },
      { label: 'Lead time', pronorm: pronormFacts.leadTime, other: 'Quoted by the dealer per order' },
    ],
    choosePronorm: [
      'You want American-depth base and tall cabinets from the standard catalog.',
      'You want handleless and handled fronts on one platform, with over 100 front options.',
      'You prefer a dealer who holds a protected territory and is not competing with a second showroom of the same brand down the road.',
    ],
    chooseOther: [
      'Your budget needs an entry-level German price group. Bauformat reaches lower price points than Pronorm does.',
      'You are a developer or multifamily buyer who wants the group’s burger line.',
      'A Bauformat dealer is local to you and a Pronorm showroom is not.',
    ],
    faqs: [
      { q: 'Is Bauformat cheaper than Pronorm?', a: 'It can be. Bauformat spans roughly ten price groups, including entry-level groups below where Pronorm starts. At comparable fronts and hardware the two are close enough that only written quotes on the same plan will tell you. Typical installed Pronorm kitchens run $40,000 to $150,000+.' },
      { q: 'Are Pronorm and Bauformat made in the same place?', a: 'Nearly. Pronorm builds in Vlotho and Bauformat in Löhne, a few miles apart in the Eastern Westphalia kitchen region. Bauformat has a second factory in Burg near Magdeburg.' },
      { q: 'Which is better quality, Pronorm or Bauformat?', a: 'Both are German-engineered frameless systems using major-brand hardware. Pronorm manufactures to a 0.1 mm tolerance and uses Blum, Hettich, and Grass with soft-close as standard. Compare the specific price group you are quoted in each brand rather than the brand names.' },
      { q: 'Does Pronorm offer American cabinet depths?', a: 'Yes. Pronorm ships 610 mm (24 inch) base and tall depths as standard for US orders. The factory builds in millimeters; the depth is planned for American rooms and appliances.' },
    ],
    sources: [
      { label: 'Bauformat company portrait', url: 'https://www.bauformat.de/en/company/company-portrait' },
      { label: 'Bauformat USA profile, Surface & Panel', url: 'https://surfaceandpanel.com/next-level-panel-processing' },
      { label: 'Pronorm manufacturing history, KBzine', url: 'https://thekbzine.com/pages/17049/pronorm_announces_new_managing_directors_as_heinz_hachmeiser_retires/' },
    ],
  },
  {
    slug: 'pronorm-vs-nobilia',
    brand: 'Nobilia',
    title: 'Pronorm vs Nobilia: German Kitchens Compared',
    description:
      'Pronorm vs Nobilia for a US kitchen: scale, US availability, price position, American cabinet depths, customization, and how to compare quotes.',
    summary:
      'Nobilia is Europe’s largest kitchen manufacturer and the value benchmark for German kitchens. Pronorm is a smaller made-to-order maker positioned a step above on fronts, customization, and fit. Nobilia usually wins on entry price. Pronorm is the stronger pick when the room needs American-depth cabinets, a mix of handleless and handled fronts, or more made-to-measure flexibility.',
    rows: [
      { label: 'Company', pronorm: pronormFacts.founded, other: 'Founded 1945; Europe’s largest kitchen manufacturer' },
      { label: 'Made in', pronorm: pronormFacts.madeIn, other: 'Verl, Eastern Westphalia, Germany' },
      { label: 'Scale', pronorm: 'Mid-size maker of made-to-order kitchens', other: 'About €1.66 billion in annual turnover and more than 4,500 employees; roughly every third kitchen sold in Germany' },
      { label: 'US presence', pronorm: pronormFacts.usPresence, other: 'Sold through US dealers; a trade-press factory report put US volume at about 1% of output' },
      { label: 'Cabinet depth for US rooms', pronorm: pronormFacts.depth, other: 'Ask the dealer which base and tall depths it orders for US appliances' },
      { label: 'Price position', pronorm: pronormFacts.price, other: 'Positioned on value for money; no published US price list' },
      { label: 'Lead time', pronorm: pronormFacts.leadTime, other: 'Quoted by the dealer per order' },
    ],
    choosePronorm: [
      'You want American-depth base and tall cabinets as standard.',
      'You want handleless Y-line or X-line fronts combined with handled Proline128 in one kitchen.',
      'You want a dealer with a protected territory and direct factory support from a small US team.',
    ],
    chooseOther: [
      'Entry price is the deciding factor. Nobilia’s scale makes it hard to beat on cost.',
      'The kitchen is a rental, a secondary home, or a developer unit where a standard European specification is fine.',
      'A Nobilia dealer is local to you and a Pronorm showroom is not.',
    ],
    faqs: [
      { q: 'Is Nobilia cheaper than Pronorm?', a: 'Usually, at entry level. Nobilia is Europe’s largest kitchen manufacturer and is positioned on value for money. Pronorm sits above it in the premium mid-range, with typical installed kitchens at $40,000 to $150,000+. Compare written quotes on the same plan.' },
      { q: 'Is Pronorm better quality than Nobilia?', a: 'They are built for different briefs. Nobilia is engineered for volume and value. Pronorm is made to order with a 0.1 mm manufacturing tolerance, over 100 front options, and Blum, Hettich, and Grass hardware with soft-close as standard.' },
      { q: 'Are Pronorm and Nobilia both German?', a: 'Yes. Both are manufactured in Eastern Westphalia: Pronorm in Vlotho and Nobilia in Verl.' },
      { q: 'Which is easier to buy in the US?', a: 'It depends on where you live. Pronorm had eleven authorized US showrooms as of August 2026, in California, Arizona, Colorado, Nevada, and Washington. Nobilia is sold through its own US dealers. Check which has a showroom that will design and install in your area.' },
    ],
    sources: [
      { label: 'Nobilia company facts', url: 'https://www.nobilia.de/en/company/' },
      { label: 'Nobilia profile, ArchDaily', url: 'https://www.archdaily.com/catalog/us/companies/5086/nobilia' },
      { label: 'Nobilia factory tour report, Surface & Panel', url: 'https://surfaceandpanel.com/group-tours-poggenpohl-and-nobilia-day-three' },
      { label: 'Pronorm manufacturing history, KBzine', url: 'https://thekbzine.com/pages/17049/pronorm_announces_new_managing_directors_as_heinz_hachmeiser_retires/' },
    ],
  },
  {
    slug: 'pronorm-vs-siematic',
    brand: 'SieMatic',
    title: 'Pronorm vs SieMatic: German Kitchens Compared',
    description:
      'Pronorm vs SieMatic for a US kitchen: luxury versus premium mid-range, US showrooms, American cabinet depths, handleless design, and how to compare quotes.',
    summary:
      'SieMatic is one of the best-known German luxury kitchen names, with a long history in the US. Pronorm is positioned in the premium mid-range below it, with the same German system engineering and major-brand hardware. Choose SieMatic for the name, the style collections, and a luxury showroom experience. Choose Pronorm when you want the German fitted-kitchen result at a lower ticket and at American cabinet depths.',
    rows: [
      { label: 'Company', pronorm: pronormFacts.founded, other: 'Founded 1929 by August Siekmann' },
      { label: 'Made in', pronorm: pronormFacts.madeIn, other: 'Löhne, Eastern Westphalia, Germany' },
      { label: 'US presence', pronorm: pronormFacts.usPresence, other: 'SieMatic USA with dedicated showrooms; the company calls the US one of its most important markets' },
      { label: 'Design structure', pronorm: pronormFacts.lines, other: 'Three style collections: Pure, Urban, and Classic' },
      { label: 'Cabinet depth for US rooms', pronorm: pronormFacts.depth, other: 'Ask the showroom which base and tall depths it orders for US appliances' },
      { label: 'Price position', pronorm: `${pronormFacts.price}; premium mid-range`, other: 'Luxury segment; no published US price list' },
      { label: 'Lead time', pronorm: pronormFacts.leadTime, other: 'Quoted by the showroom per order' },
    ],
    choosePronorm: [
      'You want German system engineering without a luxury-brand premium.',
      'You want American-depth base and tall cabinets as standard.',
      'You want to put more of the budget into appliances, stone, or lighting.',
    ],
    chooseOther: [
      'The SieMatic name and its style collections are part of what you are buying.',
      'You want a luxury showroom experience and a brand your architect already specifies.',
      'A SieMatic showroom is local to you and a Pronorm showroom is not.',
    ],
    faqs: [
      { q: 'Is Pronorm cheaper than SieMatic?', a: 'Generally yes. Pronorm is positioned in the premium mid-range, with typical installed kitchens at $40,000 to $150,000+. SieMatic sells in the luxury segment. Neither publishes a US price list, so compare written quotes on the same plan.' },
      { q: 'Is Pronorm the same quality as SieMatic?', a: 'Both are German fitted-kitchen systems made in Eastern Westphalia. Pronorm manufactures to a 0.1 mm tolerance and uses Blum, Hettich, and Grass hardware with soft-close as standard. SieMatic adds luxury materials and brand prestige. Compare the specific specification you are quoted.' },
      { q: 'Are Pronorm and SieMatic made near each other?', a: 'Yes. Pronorm builds in Vlotho and SieMatic in Löhne, neighboring towns in the Eastern Westphalia kitchen region.' },
      { q: 'Does Pronorm make handleless kitchens like SieMatic?', a: 'Yes. Y-line uses an integrated aluminum grip profile and X-line a curved C-shaped profile. Both can be combined with handled Proline128 fronts in one kitchen.' },
    ],
    sources: [
      { label: 'SieMatic company history', url: 'https://siematic.com/company/press-release/review-siematic-id-days-2020/' },
      { label: 'SieMatic at KBIS 2022', url: 'https://siematic.com/company/news/kbis-2022/' },
      { label: 'SieMatic, Wikipedia', url: 'https://en.wikipedia.org/wiki/SieMatic' },
      { label: 'Pronorm manufacturing history, KBzine', url: 'https://thekbzine.com/pages/17049/pronorm_announces_new_managing_directors_as_heinz_hachmeiser_retires/' },
    ],
  },
];
