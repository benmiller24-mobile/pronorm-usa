/* ── Design Packet Questionnaire Types ── */

// ── Option Constants ──

export const PROJECT_TYPES = [
  { value: 'single_family', label: 'Single Family' },
  { value: 'multi_family', label: 'Multi-Family' },
  { value: 'new_construction', label: 'New Construction' },
  { value: 'remodel', label: 'Remodel' },
  { value: 'showroom_display', label: 'Showroom Display' },
] as const;

export const STYLE_OPTIONS = [
  { value: 'exactly_as_drawn', label: 'Exactly As Drawn' },
  { value: 'american', label: 'American' },
  { value: 'german', label: 'German' },
  { value: 'blend', label: 'Blend' },
] as const;

export const PRODUCT_LINES = [
  { value: 'proline', label: 'ProLine (Full-Overlay)' },
  { value: 'xline', label: 'X-Line (Gola Channel)' },
  { value: 'yline', label: 'Y-Line (Matching Recess)' },
] as const;

export const INTERIOR_COLORS = [
  { value: 'white', label: 'White' },
  { value: 'stratus_gray_pearl', label: 'Stratus Gray Pearl' },
] as const;

export const DRAWERBOX_STD_OPTIONS = [
  { value: 'protech_x_titanium', label: 'ProTech X Titanium (Angular Rail on Side)' },
  { value: 'protech_x_anthracite', label: 'ProTech X Anthracite (Angular Rail on Side)' },
  { value: 'protop', label: 'ProTop (Full Metal Sides)' },
] as const;

export const DRAWERBOX_WOOD_OPTIONS = [
  { value: 'protech_x_urban_oak', label: 'ProTech X Wood Urban Oak' },
  { value: 'protech_x_dark_sherwood', label: 'ProTech X Dark Sherwood' },
] as const;

export const TOEKICK_MATERIALS = [
  { value: 'matching_material', label: 'Matching Material' },
  { value: 'metal_slatted', label: 'Metal Slatted' },
] as const;

export const APPLIANCE_TYPES = [
  'Refrigerator',
  'Freezer',
  'Beverage Center',
  'Wine Refrigerator',
  'Dishwasher',
  'Range',
  'Cooktop',
  'Rangetop',
  'Vent Hood',
  'Single Oven',
  'Double Oven',
  'Microwave',
  'Coffee Maker',
  'Other',
] as const;

export const BACKSPLASH_MATERIALS = [
  { value: 'tile', label: 'Tile' },
  { value: 'matches_counters', label: 'Matches Counters' },
] as const;

export const BACKSPLASH_HEIGHTS = [
  { value: '4inch', label: '4" High' },
  { value: 'full_18inch', label: 'Full Height (18"H)' },
] as const;

// ── Data Interfaces ──

export interface GeneralInfo {
  jobName: string;
  clientName: string;
  cellPhone: string;
  email: string;
  jobAddress: string;
  room: string;
  projectType: string;
  style: string;
}

export interface CabinetDetails {
  productLine: string;
  rangeCode: string;
  styleCode: string;
  doorPriceGroup: string;
  finishColor: string;
  interiorColor: string;
  finishedEnds: boolean;
  paneledEnds: boolean;
}

export interface HardwareDetails {
  pullsCode: string;
  pullsFinish: string;
  knobsCode: string;
  knobsFinish: string;
  tipOnPushToOpen: boolean;
  xGolaChannelColor: string;
  yLineMetalEdgeColor: string;
}

export interface DrawerToekick {
  drawerboxCategory: 'std' | 'wood_laminate' | '';
  drawerboxSelection: string;
  nonSlipMats: boolean;
  toekickMaterial: string;
  toekickHeight: string;
}

export interface ApplianceEntry {
  type: string;
  manufacturer: string;
  modelNumber: string;
  dimensions: string;
  isPaneled: boolean;
}

export interface SinkDetails {
  bowlType: string;
  mountingType: string;
  dimensions: string;
  colorFinish: string;
}

export interface CountertopEntry {
  label: string;
  material: string;
  color: string;
  thickness: string;
  specialDetails: string;
}

export interface BacksplashDetails {
  material: string;
  height: string;
  color: string;
}

export interface DesignPacketData {
  generalInfo: GeneralInfo;
  cabinetDetails: CabinetDetails;
  hardwareDetails: HardwareDetails;
  drawerToekick: DrawerToekick;
  appliances: ApplianceEntry[];
  primarySink: SinkDetails;
  prepSink: SinkDetails;
  countertops: CountertopEntry[];
  backsplash: BacksplashDetails;
}

// ── Defaults ──

export const DEFAULT_GENERAL_INFO: GeneralInfo = {
  jobName: '',
  clientName: '',
  cellPhone: '',
  email: '',
  jobAddress: '',
  room: '',
  projectType: '',
  style: '',
};

export const DEFAULT_CABINET_DETAILS: CabinetDetails = {
  productLine: '',
  rangeCode: '',
  styleCode: '',
  doorPriceGroup: '',
  finishColor: '',
  interiorColor: '',
  finishedEnds: false,
  paneledEnds: false,
};

export const DEFAULT_HARDWARE: HardwareDetails = {
  pullsCode: '',
  pullsFinish: '',
  knobsCode: '',
  knobsFinish: '',
  tipOnPushToOpen: false,
  xGolaChannelColor: '',
  yLineMetalEdgeColor: '',
};

export const DEFAULT_DRAWER_TOEKICK: DrawerToekick = {
  drawerboxCategory: '',
  drawerboxSelection: '',
  nonSlipMats: false,
  toekickMaterial: '',
  toekickHeight: '',
};

export const DEFAULT_SINK: SinkDetails = {
  bowlType: '',
  mountingType: '',
  dimensions: '',
  colorFinish: '',
};

export const DEFAULT_COUNTERTOP: CountertopEntry = {
  label: '',
  material: '',
  color: '',
  thickness: '',
  specialDetails: '',
};

export const DEFAULT_BACKSPLASH: BacksplashDetails = {
  material: '',
  height: '',
  color: '',
};

export function createDefaultDesignPacket(): DesignPacketData {
  return {
    generalInfo: { ...DEFAULT_GENERAL_INFO },
    cabinetDetails: { ...DEFAULT_CABINET_DETAILS },
    hardwareDetails: { ...DEFAULT_HARDWARE },
    drawerToekick: { ...DEFAULT_DRAWER_TOEKICK },
    appliances: [],
    primarySink: { ...DEFAULT_SINK },
    prepSink: { ...DEFAULT_SINK },
    countertops: [
      { ...DEFAULT_COUNTERTOP, label: 'Countertop' },
      { ...DEFAULT_COUNTERTOP, label: 'Countertop #2' },
    ],
    backsplash: { ...DEFAULT_BACKSPLASH },
  };
}

// ── Validation ──

export interface ValidationError {
  field: string;
  message: string;
}

export function validateStep1(data: DesignPacketData): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!data.generalInfo.jobName.trim()) errors.push({ field: 'jobName', message: 'Job name is required' });
  if (!data.generalInfo.clientName.trim()) errors.push({ field: 'clientName', message: 'Client name is required' });
  if (!data.generalInfo.jobAddress.trim()) errors.push({ field: 'jobAddress', message: 'Job address is required' });
  if (!data.generalInfo.room.trim()) errors.push({ field: 'room', message: 'Room is required' });
  if (!data.generalInfo.projectType) errors.push({ field: 'projectType', message: 'Select a project type' });
  if (!data.generalInfo.style) errors.push({ field: 'style', message: 'Select a style' });
  return errors;
}

export function validateStep2(data: DesignPacketData): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!data.cabinetDetails.productLine) errors.push({ field: 'productLine', message: 'Select a product line' });
  if (!data.cabinetDetails.rangeCode.trim()) errors.push({ field: 'rangeCode', message: 'Range code is required' });
  if (!data.cabinetDetails.styleCode.trim()) errors.push({ field: 'styleCode', message: 'Style code is required' });
  if (!data.cabinetDetails.finishColor.trim()) errors.push({ field: 'finishColor', message: 'Finish color is required' });
  if (!data.cabinetDetails.interiorColor) errors.push({ field: 'interiorColor', message: 'Select an interior color' });
  return errors;
}

export function validateStep3(_data: DesignPacketData): ValidationError[] {
  // Hardware is optional — no required fields
  return [];
}

export function validateStep4(_data: DesignPacketData): ValidationError[] {
  // Appliances are optional — dealer selects what they have
  return [];
}

export function validateStep5(_data: DesignPacketData): ValidationError[] {
  // Plumbing & surfaces are optional
  return [];
}

export function validateStep6(_data: DesignPacketData, files: File[]): ValidationError[] {
  const errors: ValidationError[] = [];
  if (files.length === 0) errors.push({ field: 'files', message: 'Please upload at least one drawing (floor plan, elevations, etc.)' });
  return errors;
}

export const STEP_VALIDATORS = [validateStep1, validateStep2, validateStep3, validateStep4, validateStep5];

// ── Display Helpers ──

export function getOptionLabel(options: readonly { value: string; label: string }[], value: string): string {
  return options.find(o => o.value === value)?.label || value || '—';
}
