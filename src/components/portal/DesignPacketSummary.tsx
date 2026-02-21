import React, { useState } from 'react';
import type { DesignPacketData } from '../../lib/design-packet-types';
import {
  PROJECT_TYPES, STYLE_OPTIONS, PRODUCT_LINES, INTERIOR_COLORS,
  DRAWERBOX_STD_OPTIONS, DRAWERBOX_WOOD_OPTIONS, TOEKICK_MATERIALS,
  BACKSPLASH_MATERIALS, BACKSPLASH_HEIGHTS, getOptionLabel,
} from '../../lib/design-packet-types';

interface Props {
  data: DesignPacketData;
}

export default function DesignPacketSummary({ data }: Props) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ project: false });
  const toggle = (s: string) => setExpanded(prev => ({ ...prev, [s]: !prev[s] }));

  const g = data.generalInfo;
  const c = data.cabinetDetails;
  const h = data.hardwareDetails;
  const d = data.drawerToekick;
  const allDrawerOpts = [...DRAWERBOX_STD_OPTIONS, ...DRAWERBOX_WOOD_OPTIONS];

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <h3 style={headerStyle}>Design Specifications</h3>
      <p style={{ fontSize: '0.8rem', color: '#8a8279', marginBottom: '0.75rem' }}>
        Questionnaire answers submitted with this project.
      </p>

      <Section title="Project Information" id="project" expanded={expanded} onToggle={toggle}>
        <Row label="Job Name" value={g.jobName} />
        <Row label="Client" value={g.clientName} />
        <Row label="Phone" value={g.cellPhone} />
        <Row label="Email" value={g.email} />
        <Row label="Address" value={g.jobAddress} />
        <Row label="Room" value={g.room} />
        <Row label="Project Type" value={getOptionLabel(PROJECT_TYPES, g.projectType)} />
        <Row label="Style" value={getOptionLabel(STYLE_OPTIONS, g.style)} />
      </Section>

      <Section title="Cabinet Selection" id="cabinet" expanded={expanded} onToggle={toggle}>
        <Row label="Product Line" value={getOptionLabel(PRODUCT_LINES, c.productLine)} />
        <Row label="Range Code" value={c.rangeCode} />
        <Row label="Style Code" value={c.styleCode} />
        <Row label="Door Price Group" value={c.doorPriceGroup} />
        <Row label="Finish Color" value={c.finishColor} />
        <Row label="Interior Color" value={getOptionLabel(INTERIOR_COLORS, c.interiorColor)} />
        <Row label="Finished Ends" value={c.finishedEnds ? 'Yes' : 'No'} />
        <Row label="Paneled Ends" value={c.paneledEnds ? 'Yes' : 'No'} />
      </Section>

      <Section title="Hardware, Drawer & Toekick" id="hardware" expanded={expanded} onToggle={toggle}>
        {(h.pullsCode || h.pullsFinish) && <Row label="Pulls" value={[h.pullsCode, h.pullsFinish].filter(Boolean).join(' — ')} />}
        {(h.knobsCode || h.knobsFinish) && <Row label="Knobs" value={[h.knobsCode, h.knobsFinish].filter(Boolean).join(' — ')} />}
        {h.tipOnPushToOpen && <Row label="Tip-On / Push to Open" value="Yes" />}
        {h.xGolaChannelColor && <Row label="X-Gola Color" value={h.xGolaChannelColor} />}
        {h.yLineMetalEdgeColor && <Row label="Y-Line Edge" value={h.yLineMetalEdgeColor} />}
        {d.drawerboxCategory && <Row label="Drawerbox" value={`${d.drawerboxCategory === 'std' ? 'STD' : 'Wood Laminate'}${d.drawerboxSelection ? ` — ${getOptionLabel(allDrawerOpts, d.drawerboxSelection)}` : ''}`} />}
        <Row label="Non-Slip Mats" value={d.nonSlipMats ? 'Yes' : 'No'} />
        {d.toekickMaterial && <Row label="Toekick" value={`${getOptionLabel(TOEKICK_MATERIALS, d.toekickMaterial)}${d.toekickHeight ? ` (${d.toekickHeight})` : ''}`} />}
      </Section>

      <Section title={`Appliances (${data.appliances.length})`} id="appliances" expanded={expanded} onToggle={toggle}>
        {data.appliances.length === 0 && <span style={{ fontSize: '0.8rem', color: '#8a8279' }}>None specified</span>}
        {data.appliances.map((a, i) => (
          <div key={i} style={{ padding: '0.3rem 0', borderBottom: i < data.appliances.length - 1 ? '1px solid #f0ece7' : 'none' }}>
            <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>{a.type}</span>
            <span style={{ fontSize: '0.8rem', color: '#4a4a4a', marginLeft: '0.5rem' }}>
              {[a.manufacturer, a.modelNumber, a.dimensions].filter(Boolean).join(' · ')}
              {a.isPaneled ? ' · Paneled' : ''}
            </span>
          </div>
        ))}
      </Section>

      <Section title="Plumbing & Surfaces" id="plumbing" expanded={expanded} onToggle={toggle}>
        {(data.primarySink.bowlType || data.primarySink.mountingType) && (
          <>
            <SubLabel text="Primary Sink" />
            <Row label="Bowl" value={data.primarySink.bowlType} />
            <Row label="Mounting" value={data.primarySink.mountingType} />
            <Row label="Dimensions" value={data.primarySink.dimensions} />
            <Row label="Finish" value={data.primarySink.colorFinish} />
          </>
        )}
        {(data.prepSink.bowlType || data.prepSink.mountingType) && (
          <>
            <SubLabel text="Prep Sink" />
            <Row label="Bowl" value={data.prepSink.bowlType} />
            <Row label="Mounting" value={data.prepSink.mountingType} />
          </>
        )}
        {data.countertops.filter(ct => ct.material || ct.color).map((ct, i) => (
          <React.Fragment key={i}>
            <SubLabel text={ct.label} />
            <Row label="Material" value={ct.material} />
            <Row label="Color" value={ct.color} />
            <Row label="Thickness" value={ct.thickness} />
            {ct.specialDetails && <Row label="Details" value={ct.specialDetails} />}
          </React.Fragment>
        ))}
        {data.backsplash.material && (
          <>
            <SubLabel text="Backsplash" />
            <Row label="Material" value={getOptionLabel(BACKSPLASH_MATERIALS, data.backsplash.material)} />
            <Row label="Height" value={getOptionLabel(BACKSPLASH_HEIGHTS, data.backsplash.height)} />
            {data.backsplash.color && <Row label="Color" value={data.backsplash.color} />}
          </>
        )}
      </Section>
    </div>
  );
}

function Section({ title, id, expanded, onToggle, children }: {
  title: string; id: string; expanded: Record<string, boolean>; onToggle: (s: string) => void; children: React.ReactNode;
}) {
  const isOpen = expanded[id] ?? false;
  return (
    <div style={{ marginBottom: '0.35rem', border: '1px solid #e8e4df', borderRadius: '4px' }}>
      <button type="button" onClick={() => onToggle(id)} style={{
        width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0.6rem 0.85rem', background: '#fdfcfa', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
      }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1a1a1a' }}>{title}</span>
        <span style={{ fontSize: '0.72rem', color: '#8a8279' }}>{isOpen ? '▾' : '▸'}</span>
      </button>
      {isOpen && <div style={{ padding: '0.35rem 0.85rem 0.6rem' }}>{children}</div>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div style={{ display: 'flex', gap: '0.5rem', padding: '0.15rem 0', fontSize: '0.8rem' }}>
      <span style={{ color: '#8a8279', minWidth: '100px', flexShrink: 0 }}>{label}</span>
      <span style={{ color: '#1a1a1a' }}>{value}</span>
    </div>
  );
}

function SubLabel({ text }: { text: string }) {
  return (
    <div style={{ fontWeight: 600, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.03em', color: '#4a4a4a', marginTop: '0.4rem', marginBottom: '0.15rem' }}>
      {text}
    </div>
  );
}

const headerStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: '1.15rem', fontWeight: 400, color: '#1a1a1a', marginBottom: '0.25rem',
};
