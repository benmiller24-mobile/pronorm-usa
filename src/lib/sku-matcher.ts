import type { AIAnalysis, IntakeData, MappedItem, CabinetPosition } from './types';

/**
 * Map AI-identified cabinet positions to actual ProLine SKUs from the catalog.
 *
 * The catalog structure is: catalog.proline[category][groupKey] = item[]
 * Each item has: { s: SKU, d: description, w: width_cm, p: { priceGroup: price }, ... }
 */

interface CatalogItem {
  s: string;
  d: string;
  w: number | null;
  dr: string | null;
  pt: string;
  p: Record<string, number>;
  pg: number;
  img?: string;
  seq?: number;
}

// Map AI cabinet types to ProLine catalog categories
const TYPE_TO_CATEGORY: Record<string, string[]> = {
  'base_unit': ['Base units'],
  'base': ['Base units'],
  'sink_base': ['Base units'],
  'corner_base': ['Base units'],
  'drawer_base': ['Base units'],
  'wall_unit': ['Wall units'],
  'wall': ['Wall units'],
  'corner_wall': ['Wall units'],
  'tall_unit': ['Tall units'],
  'tall': ['Tall units'],
  'pantry': ['Tall units'],
  'oven_tall': ['Tall units'],
  'fridge_tall': ['Tall units'],
  'countertop_unit': ['Countertop units'],
  'countertop': ['Countertop units'],
};

// SKU prefixes that hint at cabinet function
const PREFIX_HINTS: Record<string, string[]> = {
  'U': ['base', 'base_unit', 'standard base'],
  'US': ['sink_base', 'sink base unit'],
  'UE': ['corner_base', 'corner base'],
  'UG': ['base_unit', 'base with internal fittings'],
  'UR': ['base_unit', 'base shelf unit'],
  'O': ['wall', 'wall_unit', 'standard wall'],
  'OR': ['wall_unit', 'wall with flap door'],
  'OG': ['wall_unit', 'wall with internal fittings'],
  'H': ['tall', 'tall_unit', 'standard tall'],
  'HS': ['tall_unit', 'tall appliance housing'],
  'HSP': ['fridge_tall', 'tall fridge/freezer housing'],
  'HG': ['tall_unit', 'tall larder'],
  'HGP': ['tall_unit', 'tall larder with pull-outs'],
  'HP': ['pantry', 'tall unit'],
  'AH': ['tall_unit', 'appliance housing'],
  'DT': ['base_unit', 'worktop unit'],
};

export async function matchPositionsToSKUs(
  analysis: AIAnalysis,
  catalog: any,
  intakeData: IntakeData,
): Promise<MappedItem[]> {
  const prolineCatalog = catalog.proline || catalog['proline'] || {};
  const mappedItems: MappedItem[] = [];

  for (const wall of analysis.walls) {
    for (const pos of wall.positions) {
      const mapped = matchSinglePosition(pos, wall.label, prolineCatalog, intakeData);
      mappedItems.push(mapped);
    }
  }

  return mappedItems;
}

function matchSinglePosition(
  pos: CabinetPosition,
  wallLabel: string,
  catalog: Record<string, Record<string, CatalogItem[]>>,
  intakeData: IntakeData,
): MappedItem {
  // 1. Determine which catalog categories to search
  const posType = pos.type.toLowerCase().replace(/[\s-]/g, '_');
  const categories = TYPE_TO_CATEGORY[posType] || ['Base units', 'Wall units', 'Tall units'];

  // 2. Collect all candidate items from relevant categories
  const candidates: CatalogItem[] = [];
  for (const catName of categories) {
    const catGroups = catalog[catName];
    if (!catGroups) continue;
    for (const groupKey of Object.keys(catGroups)) {
      const items = catGroups[groupKey];
      if (Array.isArray(items)) {
        candidates.push(...items.filter(i => i.p && Object.keys(i.p).length > 0));
      }
    }
  }

  if (candidates.length === 0) {
    // Fallback: search all categories
    for (const catName of Object.keys(catalog)) {
      const catGroups = catalog[catName];
      if (!catGroups || typeof catGroups !== 'object') continue;
      for (const groupKey of Object.keys(catGroups)) {
        const items = catGroups[groupKey];
        if (Array.isArray(items)) {
          candidates.push(...items.filter(i => i.p && Object.keys(i.p).length > 0));
        }
      }
    }
  }

  // 3. Score each candidate
  const scored = candidates
    .filter(item => item.w && item.w > 0) // must have a width
    .map(item => ({
      item,
      score: scoreMatch(item, pos, intakeData),
    }))
    .sort((a, b) => b.score - a.score);

  // 4. If the AI suggested a specific SKU, check if it exists
  let bestMatch = scored[0];
  if (pos.skuSuggestion) {
    const exactMatch = scored.find(s => s.item.s === pos.skuSuggestion);
    if (exactMatch && exactMatch.score > 0.3) {
      bestMatch = exactMatch;
    }
  }

  // 5. Build result
  const best = bestMatch?.item;
  const alternatives = scored
    .filter(s => s.item.s !== best?.s)
    .slice(0, 5)
    .map(s => ({
      sku: s.item.s,
      description: cleanDescription(s.item.d),
      width_cm: s.item.w || 0,
      matchScore: s.score,
    }));

  // Get a reasonable price (use price group 0 or first available)
  const priceGroups = best?.p || {};
  const firstPriceKey = Object.keys(priceGroups).sort((a, b) => Number(a) - Number(b))[0];
  const unitPrice = firstPriceKey ? priceGroups[firstPriceKey] : 0;

  return {
    positionId: pos.id,
    wallLabel,
    sku: best?.s || pos.skuSuggestion || 'UNKNOWN',
    description: best ? cleanDescription(best.d) : pos.type,
    width_cm: best?.w || pos.width_cm,
    height_cm: pos.height_cm,
    priceGroup: firstPriceKey ? Number(firstPriceKey) : 0,
    unitPrice,
    matchScore: bestMatch?.score || 0,
    alternatives,
    userOverride: false,
    confirmed: (bestMatch?.score || 0) >= 0.8, // Auto-confirm high-confidence matches
  };
}

function scoreMatch(item: CatalogItem, pos: CabinetPosition, intakeData: IntakeData): number {
  let score = 0;
  const maxScore = 1;

  // Width match (40% weight)
  const widthDiff = Math.abs((item.w || 0) - pos.width_cm);
  if (widthDiff === 0) score += 0.4;
  else if (widthDiff <= 5) score += 0.35;
  else if (widthDiff <= 10) score += 0.25;
  else if (widthDiff <= 20) score += 0.1;
  // else 0

  // Height match (20% weight) — compare SKU height code to position
  const skuParts = item.s.split(/[\s-]/);
  let skuHeight = 0;
  if (skuParts.length >= 3) {
    const h = parseInt(skuParts[2] || skuParts[1]);
    if (h >= 30 && h <= 230) skuHeight = h;
  }
  if (skuHeight > 0 && pos.height_cm > 0) {
    const heightDiff = Math.abs(skuHeight - pos.height_cm);
    if (heightDiff <= 2) score += 0.2;
    else if (heightDiff <= 5) score += 0.15;
    else if (heightDiff <= 15) score += 0.08;
  } else {
    score += 0.1; // neutral if we can't compare
  }

  // Type/prefix match (25% weight)
  const skuPrefix = item.s.split(' ')[0] || item.s.split('-')[0];
  const posType = pos.type.toLowerCase();
  const prefixHints = PREFIX_HINTS[skuPrefix];
  if (prefixHints) {
    if (prefixHints.some(h => posType.includes(h.split(' ')[0]))) {
      score += 0.25;
    } else {
      score += 0.05;
    }
  } else {
    score += 0.1; // neutral for unknown prefixes
  }

  // Features bonus (15% weight)
  const desc = (item.d || '').toLowerCase();
  const features = pos.features.map(f => f.toLowerCase());

  let featureScore = 0;
  for (const feat of features) {
    if (feat.includes('drawer') && (desc.includes('drawer') || skuPrefix === 'DT')) featureScore += 0.3;
    if (feat.includes('pull-out') && desc.includes('pull-out')) featureScore += 0.3;
    if (feat.includes('glass') && desc.includes('glass')) featureScore += 0.3;
    if (feat.includes('sink') && (skuPrefix === 'US' || desc.includes('sink'))) featureScore += 0.4;
    if (feat.includes('pantry') && (skuPrefix.startsWith('HG') || desc.includes('pantry') || desc.includes('larder'))) featureScore += 0.4;
    if (feat.includes('oven') && (skuPrefix === 'HS' || desc.includes('appliance'))) featureScore += 0.4;
    if (feat.includes('fridge') && (skuPrefix === 'HSP' || desc.includes('fridge') || desc.includes('freezer'))) featureScore += 0.4;
  }
  score += Math.min(featureScore, 1) * 0.15;

  return Math.min(score, maxScore);
}

function cleanDescription(desc: string): string {
  if (!desc) return '';
  // Truncate overly long descriptions and clean up
  return desc.replace(/\s+/g, ' ').trim().slice(0, 120);
}
