import type { MappedItem, IntakeData, ValidationIssue } from './types';

/**
 * Deterministic constraint validation for mapped cabinet positions.
 * Checks physical constraints that must be true regardless of AI confidence.
 */

export function validateLayout(items: MappedItem[], intakeData: IntakeData): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Group items by wall
  const byWall = new Map<string, MappedItem[]>();
  for (const item of items) {
    if (!byWall.has(item.wallLabel)) byWall.set(item.wallLabel, []);
    byWall.get(item.wallLabel)!.push(item);
  }

  // Helper to classify cabinet row by SKU prefix
  function getCabinetRow(sku: string): 'base' | 'wall' | 'tall' {
    const s = sku.toUpperCase();
    if (s.startsWith('OR') || s.startsWith('OG') || s.startsWith('OE') || s.startsWith('O')) return 'wall';
    if (s.startsWith('HP') || s.startsWith('HSP') || s.startsWith('HS') || s.startsWith('HG') || s.startsWith('HGP') || s.startsWith('H') || s.startsWith('AH')) return 'tall';
    return 'base'; // U, US, UE, UG, DT, etc.
  }

  for (const wallDef of intakeData.walls) {
    const wallItems = byWall.get(wallDef.label) || [];
    if (wallItems.length === 0) continue;

    const wallLength = wallDef.length_cm;

    // 1. Wall fit: check each cabinet row separately (base, wall, tall)
    const rows: { label: string; items: MappedItem[] }[] = [
      { label: 'Base cabinets', items: wallItems.filter(i => getCabinetRow(i.sku) === 'base') },
      { label: 'Upper cabinets', items: wallItems.filter(i => getCabinetRow(i.sku) === 'wall') },
      { label: 'Tall units', items: wallItems.filter(i => getCabinetRow(i.sku) === 'tall') },
    ];

    for (const row of rows) {
      if (row.items.length === 0) continue;
      const totalWidth = row.items.reduce((sum, i) => sum + i.width_cm, 0);
      const gap = wallLength - totalWidth;

      if (gap < -5) {
        issues.push({
          wallLabel: wallDef.label,
          severity: 'error',
          message: `${row.label} total ${totalWidth}cm but Wall ${wallDef.label} is only ${wallLength}cm (${Math.abs(gap)}cm over).`,
          positionIds: row.items.map(i => i.positionId),
          suggestedFix: 'Reduce cabinet widths or remove an item.',
        });
      } else if (gap > 30) {
        issues.push({
          wallLabel: wallDef.label,
          severity: 'warning',
          message: `${row.label} total ${totalWidth}cm on a ${wallLength}cm wall. Gap of ${gap}cm — consider additional cabinets or filler panels.`,
          positionIds: row.items.map(i => i.positionId),
          suggestedFix: `Add cabinets or a ${gap}cm filler.`,
        });
      }
    }

    // 2. Width validation: check each item uses a valid ProLine width
    const VALID_BASE_WIDTHS = [15, 20, 27, 30, 38, 40, 45, 50, 55, 60, 75, 80, 90, 91, 100, 105, 110, 120, 125];
    const VALID_WALL_WIDTHS = [20, 25, 27, 30, 35, 40, 45, 50, 55, 60, 65, 66, 75, 80, 81, 90, 100, 120];
    const VALID_TALL_WIDTHS = [27, 30, 45, 55, 60, 75, 76, 80, 90, 120];

    for (const item of wallItems) {
      const sku = item.sku.toUpperCase();
      let validWidths = VALID_BASE_WIDTHS; // default
      if (sku.startsWith('O') || sku.startsWith('OR') || sku.startsWith('OG')) {
        validWidths = VALID_WALL_WIDTHS;
      } else if (sku.startsWith('H') || sku.startsWith('AH')) {
        validWidths = VALID_TALL_WIDTHS;
      }

      if (item.width_cm > 0 && !validWidths.includes(item.width_cm)) {
        const nearest = validWidths.reduce((prev, curr) =>
          Math.abs(curr - item.width_cm) < Math.abs(prev - item.width_cm) ? curr : prev
        );
        issues.push({
          wallLabel: wallDef.label,
          severity: 'warning',
          message: `${item.sku} has width ${item.width_cm}cm which isn't a standard ProLine width. Nearest: ${nearest}cm.`,
          positionIds: [item.positionId],
          suggestedFix: `Change width to ${nearest}cm.`,
        });
      }
    }

    // 3. Height consistency: all base units on a wall should be same height
    const baseItems = wallItems.filter(i => {
      const s = i.sku.toUpperCase();
      return s.startsWith('U') || s.startsWith('DT');
    });
    if (baseItems.length > 1) {
      const heights = new Set(baseItems.map(i => i.height_cm));
      if (heights.size > 1) {
        issues.push({
          wallLabel: wallDef.label,
          severity: 'warning',
          message: `Mixed base unit heights on Wall ${wallDef.label}: ${[...heights].join(', ')}cm. Base units should typically be the same height.`,
          positionIds: baseItems.map(i => i.positionId),
        });
      }
    }

    // 4. Window clearance: no wall units where window is
    if (wallDef.hasWindow && wallDef.windowWidth_cm) {
      const wallUnits = wallItems.filter(i => {
        const s = i.sku.toUpperCase();
        return s.startsWith('O');
      });
      if (wallUnits.length > 0) {
        // Just a reminder — we can't check exact positions without x coordinates
        issues.push({
          wallLabel: wallDef.label,
          severity: 'warning',
          message: `Wall ${wallDef.label} has a window (${wallDef.windowWidth_cm}cm wide). Verify wall units don't overlap the window area.`,
          positionIds: wallUnits.map(i => i.positionId),
        });
      }
    }

    // 5. Low confidence items
    for (const item of wallItems) {
      if (item.matchScore < 0.5) {
        issues.push({
          wallLabel: wallDef.label,
          severity: 'error',
          message: `Low confidence match for position ${item.positionId}: "${item.sku}" (score: ${(item.matchScore * 100).toFixed(0)}%). Please verify or select a different SKU.`,
          positionIds: [item.positionId],
        });
      } else if (item.matchScore < 0.7) {
        issues.push({
          wallLabel: wallDef.label,
          severity: 'warning',
          message: `Moderate confidence for ${item.positionId}: "${item.sku}" (${(item.matchScore * 100).toFixed(0)}%). Review recommended.`,
          positionIds: [item.positionId],
        });
      }
    }

    // 6. Unknown SKUs
    for (const item of wallItems) {
      if (item.sku === 'UNKNOWN' || item.unitPrice === 0) {
        issues.push({
          wallLabel: wallDef.label,
          severity: 'error',
          message: `Could not find a matching SKU for position ${item.positionId}. Please manually select a product.`,
          positionIds: [item.positionId],
        });
      }
    }
  }

  return issues;
}
