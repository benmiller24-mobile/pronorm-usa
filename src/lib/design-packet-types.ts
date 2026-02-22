/* ── Design Packet Questionnaire Types ── */

// ── Option Constants ──

export const PROJECT_TYPES = [
  { value: 'new_construction', label: 'New Construction' },
  { value: 'remodel', label: 'Remodel' },
  { value: 'showroom_display', label: 'Showroom Display' },
] as const;

export const SKU_SIZE_OPTIONS = [
  { value: 'exactly_as_drawn', label: 'Exactly As Drawn' },
  { value: 'mostly_pronorm_std', label: 'Draw with Mostly Pronorm STD Sizes' },
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

export const DRAWERBOX_OPTIONS = [
  { value: 'pure_light_gray', label: 'Pure — Light Gray' },
  { value: 'pure_dark_gray', label: 'Pure — Dark Gray' },
  { value: 'pure_maxi_light_gray', label: 'Pure Maxi — Light Gray' },
  { value: 'pure_maxi_dark_gray', label: 'Pure Maxi — Dark Gray' },
  { value: 'woodbox_urban_oak', label: 'woodBox — Urban Oak' },
  { value: 'woodbox_dark_sherwood', label: 'woodBox — Dark Sherwood' },
  { value: 'woodbox_maxi_urban_oak', label: 'woodBox Maxi — Urban Oak' },
  { value: 'woodbox_maxi_dark_sherwood', label: 'woodBox Maxi — Dark Sherwood' },
  { value: 'glasscase_light_gray', label: 'glassCase — Light Gray' },
  { value: 'glasscase_dark_gray', label: 'glassCase — Dark Gray' },
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
  { value: '100mm', label: '100 mm' },
  { value: 'full_450mm', label: 'Full Height (450 mm)' },
  { value: 'to_ceiling', label: 'To the Ceiling' },
  { value: 'custom', label: 'Custom Height' },
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
  skuSize: string;
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
  drawerboxSelection: string;
  nonSlipMats: boolean;
  toekickMaterial: string;
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
  customHeight: string;
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
  skuSize: '',
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
  drawerboxSelection: '',
  nonSlipMats: false,
  toekickMaterial: '',
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
  customHeight: '',
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
  if (!data.generalInfo.skuSize) errors.push({ field: 'skuSize', message: 'Select a SKU size option' });
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
