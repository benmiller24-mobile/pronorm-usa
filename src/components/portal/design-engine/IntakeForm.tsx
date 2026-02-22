import React, { useState } from 'react';
import type { IntakeData, WallDefinition } from '../../../lib/types';

interface IntakeFormProps {
  onSubmit: (data: IntakeData) => void;
  initialData: IntakeData | null;
}

const EMPTY_WALL: WallDefinition = {
  label: '',
  length_cm: 0,
  hasWindow: false,
  hasDoor: false,
  notes: '',
};

const DEFAULT_WALLS: WallDefinition[] = [
  { ...EMPTY_WALL, label: 'A' },
  { ...EMPTY_WALL, label: 'B' },
  { ...EMPTY_WALL, label: 'C' },
  { ...EMPTY_WALL, label: 'D' },
];

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.72rem',
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: '#4a4a4a',
  marginBottom: '0.4rem',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.65rem 0.85rem',
  border: '1.5px solid #d4cdc5',
  borderRadius: '3px',
  fontSize: '0.88rem',
  fontFamily: "'DM Sans', sans-serif",
  background: '#fdfcfa',
  color: '#1a1a1a',
  boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
};

const cardStyle: React.CSSProperties = {
  background: '#fdfcfa',
  border: '1px solid rgba(26,26,26,0.08)',
  borderRadius: '4px',
  padding: '1.5rem',
  marginBottom: '1.5rem',
};

const sectionTitleStyle: React.CSSProperties = {
  fontFamily: "'Cormorant Garamond', Georgia, serif",
  fontSize: '1.15rem',
  fontWeight: 400,
  color: '#1a1a1a',
  marginBottom: '1.25rem',
};

export default function IntakeForm({ onSubmit, initialData }: IntakeFormProps) {
  const [projectName, setProjectName] = useState(initialData?.projectName || '');
  const [roomType, setRoomType] = useState<IntakeData['roomType']>(initialData?.roomType || 'kitchen');
  const [roomWidth, setRoomWidth] = useState(initialData?.roomWidth_cm?.toString() || '');
  const [roomDepth, setRoomDepth] = useState(initialData?.roomDepth_cm?.toString() || '');
  const [ceilingHeight, setCeilingHeight] = useState(initialData?.ceilingHeight_cm?.toString() || '244');
  const [baseUnitHeight, setBaseUnitHeight] = useState<76 | 85>(initialData?.baseUnitHeight || 76);
  const [styleNotes, setStyleNotes] = useState(initialData?.styleNotes || '');
  const [walls, setWalls] = useState<WallDefinition[]>(
    initialData?.walls?.length ? initialData.walls : DEFAULT_WALLS
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateWall = (index: number, updates: Partial<WallDefinition>) => {
    const newWalls = [...walls];
    newWalls[index] = { ...newWalls[index], ...updates };
    setWalls(newWalls);
  };

  const addWall = () => {
    const nextLabel = String.fromCharCode(65 + walls.length); // A=65, B=66...
    setWalls([...walls, { ...EMPTY_WALL, label: nextLabel }]);
  };

  const removeWall = (index: number) => {
    if (walls.length <= 2) return;
    setWalls(walls.filter((_, i) => i !== index));
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!projectName.trim()) errs.projectName = 'Required';
    if (!roomWidth || Number(roomWidth) <= 0) errs.roomWidth = 'Required';
    if (!roomDepth || Number(roomDepth) <= 0) errs.roomDepth = 'Required';
    if (!ceilingHeight || Number(ceilingHeight) <= 0) errs.ceilingHeight = 'Required';

    walls.forEach((w, i) => {
      if (!w.length_cm || w.length_cm <= 0) {
        errs[`wall_${i}_length`] = 'Required';
      }
    });

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const data: IntakeData = {
      projectName: projectName.trim(),
      roomType,
      roomWidth_cm: Number(roomWidth),
      roomDepth_cm: Number(roomDepth),
      ceilingHeight_cm: Number(ceilingHeight),
      walls: walls.filter(w => w.length_cm > 0),
      productLine: 'proline',
      baseUnitHeight,
      styleNotes: styleNotes.trim(),
    };
    onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Project Info */}
      <div style={cardStyle}>
        <h3 style={sectionTitleStyle}>Project Information</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Project Name *</label>
            <input
              style={{ ...inputStyle, borderColor: errors.projectName ? '#c44536' : '#d4cdc5' }}
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              placeholder="e.g. Smith Kitchen Remodel"
            />
          </div>
          <div>
            <label style={labelStyle}>Room Type</label>
            <select style={selectStyle} value={roomType} onChange={e => setRoomType(e.target.value as any)}>
              <option value="kitchen">Kitchen</option>
              <option value="bathroom">Bathroom</option>
              <option value="laundry">Laundry</option>
              <option value="closet">Closet</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </div>

      {/* Room Dimensions */}
      <div style={cardStyle}>
        <h3 style={sectionTitleStyle}>Room Dimensions</h3>
        <p style={{ fontSize: '0.8rem', color: '#8a8279', marginBottom: '1rem', marginTop: '-0.5rem' }}>
          All measurements in centimeters. These will be cross-checked against the uploaded drawings.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Room Width (cm) *</label>
            <input
              type="number"
              style={{ ...inputStyle, borderColor: errors.roomWidth ? '#c44536' : '#d4cdc5' }}
              value={roomWidth}
              onChange={e => setRoomWidth(e.target.value)}
              placeholder="e.g. 400"
            />
          </div>
          <div>
            <label style={labelStyle}>Room Depth (cm) *</label>
            <input
              type="number"
              style={{ ...inputStyle, borderColor: errors.roomDepth ? '#c44536' : '#d4cdc5' }}
              value={roomDepth}
              onChange={e => setRoomDepth(e.target.value)}
              placeholder="e.g. 350"
            />
          </div>
          <div>
            <label style={labelStyle}>Ceiling Height (cm) *</label>
            <input
              type="number"
              style={{ ...inputStyle, borderColor: errors.ceilingHeight ? '#c44536' : '#d4cdc5' }}
              value={ceilingHeight}
              onChange={e => setCeilingHeight(e.target.value)}
              placeholder="e.g. 244"
            />
          </div>
        </div>
      </div>

      {/* Wall Definitions */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ ...sectionTitleStyle, marginBottom: 0 }}>Wall Definitions</h3>
          <button
            type="button"
            onClick={addWall}
            style={{
              padding: '0.4rem 0.8rem',
              fontSize: '0.72rem',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              background: 'transparent',
              border: '1.5px solid #b87333',
              color: '#b87333',
              borderRadius: '3px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            + Add Wall
          </button>
        </div>
        <p style={{ fontSize: '0.8rem', color: '#8a8279', marginBottom: '1.25rem' }}>
          Define each wall with cabinets. Label them A, B, C, etc. — you'll upload elevation drawings per wall in the next step.
        </p>

        {walls.map((wall, i) => (
          <div
            key={i}
            style={{
              padding: '1rem',
              border: '1px solid rgba(26,26,26,0.06)',
              borderRadius: '3px',
              marginBottom: '0.75rem',
              background: 'rgba(247, 244, 240, 0.5)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1a1a1a' }}>
                Wall {wall.label}
              </div>
              {walls.length > 2 && (
                <button
                  type="button"
                  onClick={() => removeWall(i)}
                  style={{
                    fontSize: '0.7rem', background: 'none', border: 'none', color: '#c44536',
                    cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
                  }}
                >
                  Remove
                </button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr 1fr', gap: '0.75rem', alignItems: 'end' }}>
              <div>
                <label style={labelStyle}>Length (cm) *</label>
                <input
                  type="number"
                  style={{
                    ...inputStyle,
                    borderColor: errors[`wall_${i}_length`] ? '#c44536' : '#d4cdc5',
                  }}
                  value={wall.length_cm || ''}
                  onChange={e => updateWall(i, { length_cm: Number(e.target.value) })}
                  placeholder="cm"
                />
              </div>
              <div>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={wall.hasWindow}
                    onChange={e => updateWall(i, { hasWindow: e.target.checked })}
                    style={{ accentColor: '#b87333' }}
                  />
                  Has Window
                </label>
                {wall.hasWindow && (
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem' }}>
                    <input
                      type="number"
                      style={{ ...inputStyle, padding: '0.4rem 0.5rem', fontSize: '0.8rem' }}
                      placeholder="Width"
                      value={wall.windowWidth_cm || ''}
                      onChange={e => updateWall(i, { windowWidth_cm: Number(e.target.value) })}
                    />
                    <input
                      type="number"
                      style={{ ...inputStyle, padding: '0.4rem 0.5rem', fontSize: '0.8rem' }}
                      placeholder="Sill ht"
                      value={wall.windowSillHeight_cm || ''}
                      onChange={e => updateWall(i, { windowSillHeight_cm: Number(e.target.value) })}
                    />
                  </div>
                )}
              </div>
              <div>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="checkbox"
                    checked={wall.hasDoor}
                    onChange={e => updateWall(i, { hasDoor: e.target.checked })}
                    style={{ accentColor: '#b87333' }}
                  />
                  Has Door
                </label>
                {wall.hasDoor && (
                  <input
                    type="number"
                    style={{ ...inputStyle, padding: '0.4rem 0.5rem', fontSize: '0.8rem', marginTop: '0.35rem' }}
                    placeholder="Door width (cm)"
                    value={wall.doorWidth_cm || ''}
                    onChange={e => updateWall(i, { doorWidth_cm: Number(e.target.value) })}
                  />
                )}
              </div>
              <div>
                <label style={labelStyle}>Notes</label>
                <input
                  style={{ ...inputStyle, fontSize: '0.82rem' }}
                  value={wall.notes}
                  onChange={e => updateWall(i, { notes: e.target.value })}
                  placeholder="e.g. plumbing here"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Preferences */}
      <div style={cardStyle}>
        <h3 style={sectionTitleStyle}>Preferences</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <label style={labelStyle}>Product Line</label>
            <select style={{ ...selectStyle, color: '#8a8279' }} disabled>
              <option value="proline">ProLine</option>
            </select>
            <div style={{ fontSize: '0.7rem', color: '#b5aca3', marginTop: '0.25rem' }}>
              X-Line, Y-Line, Living coming soon
            </div>
          </div>
          <div>
            <label style={labelStyle}>Base Unit Height</label>
            <select style={selectStyle} value={baseUnitHeight} onChange={e => setBaseUnitHeight(Number(e.target.value) as 76 | 85)}>
              <option value={76}>768mm (standard)</option>
              <option value={85}>852mm (tall)</option>
            </select>
          </div>
        </div>
        <div>
          <label style={labelStyle}>Style Notes (optional)</label>
          <textarea
            style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }}
            value={styleNotes}
            onChange={e => setStyleNotes(e.target.value)}
            placeholder="e.g. Modern look, handleless preferred, glass doors on wall units..."
          />
        </div>
      </div>

      {/* Submit */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="submit"
          style={{
            padding: '0.75rem 2rem',
            fontSize: '0.78rem',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            background: '#b87333',
            color: '#fdfcfa',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'background 200ms',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#a0642d')}
          onMouseLeave={e => (e.currentTarget.style.background = '#b87333')}
        >
          Next: Upload Drawings →
        </button>
      </div>
    </form>
  );
}
