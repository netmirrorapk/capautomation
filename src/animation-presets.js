const crypto = require('crypto');

// CapCut/JianYing draft keyframe property types.
const PROP_SCALE_X = 'KFTypeScaleX';
const PROP_SCALE_Y = 'KFTypeScaleY';
const PROP_POSITION_X = 'KFTypePositionX';
const PROP_POSITION_Y = 'KFTypePositionY';

// In CapCut's normalized transform space, 1.0 == half the canvas dimension.
// The maximum a clip can pan without revealing a black edge is (scale - 1) / 2,
// which the real draft data confirms (scale 1.333 paired with pan 0.1666).
function maxPan(scale) {
  return (scale - 1) / 2;
}

function uuid() {
  return crypto.randomUUID().toUpperCase();
}

function keyframePoint(timeOffsetUs, value) {
  return {
    curveType: 'Line',
    graphID: '',
    id: uuid(),
    left_control: { x: 0, y: 0 },
    right_control: { x: 0, y: 0 },
    string_value: '',
    time_offset: Math.round(timeOffsetUs),
    values: [value]
  };
}

function keyframeChannel(propertyType, startValue, endValue, durationUs) {
  return {
    id: uuid(),
    keyframe_list: [
      keyframePoint(0, startValue),
      keyframePoint(durationUs, endValue)
    ],
    material_id: '',
    property_type: propertyType
  };
}

// Each preset returns the base clip scale/transform (the "end" state CapCut
// stores statically) plus the common_keyframes channels that animate it.
// Values are chosen so pan magnitude never exceeds maxPan(scaleAtThatMoment).
const PRESETS = {
  'zoom-in': {
    label: 'Zoom In',
    build(durationUs) {
      const startScale = 1.0;
      const endScale = 1.2;
      return {
        scale: { x: endScale, y: endScale },
        transform: { x: 0, y: 0 },
        keyframes: [
          keyframeChannel(PROP_SCALE_X, startScale, endScale, durationUs),
          keyframeChannel(PROP_SCALE_Y, startScale, endScale, durationUs)
        ]
      };
    }
  },
  'zoom-out': {
    label: 'Zoom Out',
    build(durationUs) {
      const startScale = 1.2;
      const endScale = 1.0;
      return {
        scale: { x: endScale, y: endScale },
        transform: { x: 0, y: 0 },
        keyframes: [
          keyframeChannel(PROP_SCALE_X, startScale, endScale, durationUs),
          keyframeChannel(PROP_SCALE_Y, startScale, endScale, durationUs)
        ]
      };
    }
  },
  'pan-right': {
    label: 'Pan Left → Right',
    build(durationUs) {
      const scale = 1.3; // maxPan = 0.15
      const pan = 0.14;
      return {
        scale: { x: scale, y: scale },
        transform: { x: pan, y: 0 },
        keyframes: [
          keyframeChannel(PROP_SCALE_X, scale, scale, durationUs),
          keyframeChannel(PROP_SCALE_Y, scale, scale, durationUs),
          keyframeChannel(PROP_POSITION_X, -pan, pan, durationUs)
        ]
      };
    }
  },
  'pan-down': {
    label: 'Pan Up → Down',
    build(durationUs) {
      const scale = 1.3; // maxPan = 0.15
      const pan = 0.14;
      return {
        scale: { x: scale, y: scale },
        transform: { x: 0, y: pan },
        keyframes: [
          keyframeChannel(PROP_SCALE_X, scale, scale, durationUs),
          keyframeChannel(PROP_SCALE_Y, scale, scale, durationUs),
          keyframeChannel(PROP_POSITION_Y, -pan, pan, durationUs)
        ]
      };
    }
  },
  'ken-burns': {
    label: 'Ken Burns (Zoom + Pan)',
    build(durationUs) {
      const startScale = 1.15; // maxPan = 0.075
      const endScale = 1.3; // maxPan = 0.15
      // Diagonal drift; magnitude stays under maxPan at both ends.
      const start = { x: -0.06, y: -0.04 };
      const end = { x: 0.06, y: 0.04 };
      return {
        scale: { x: endScale, y: endScale },
        transform: { x: end.x, y: end.y },
        keyframes: [
          keyframeChannel(PROP_SCALE_X, startScale, endScale, durationUs),
          keyframeChannel(PROP_SCALE_Y, startScale, endScale, durationUs),
          keyframeChannel(PROP_POSITION_X, start.x, end.x, durationUs),
          keyframeChannel(PROP_POSITION_Y, start.y, end.y, durationUs)
        ]
      };
    }
  }
};

const PRESET_IDS = Object.keys(PRESETS);
const CYCLE_ID = 'cycle';

function listPresets() {
  const presets = Object.entries(PRESETS).map(([id, preset]) => ({ id, label: preset.label }));
  presets.push({ id: CYCLE_ID, label: 'Cycle (Alternate)' });
  return presets;
}

function buildPreset(presetId, durationUs) {
  const preset = PRESETS[presetId];
  if (!preset) {
    throw new Error(`Unknown animation preset: ${presetId}`);
  }
  if (!(durationUs > 0)) {
    throw new Error('Segment duration must be positive to build an animation.');
  }
  return preset.build(durationUs);
}

// Resolve the preset for a given clip index. The special "cycle" preset rotates
// through every real preset so consecutive clips alternate their motion.
function buildPresetForIndex(presetId, index, durationUs) {
  const resolvedId = presetId === CYCLE_ID ? PRESET_IDS[index % PRESET_IDS.length] : presetId;
  const built = buildPreset(resolvedId, durationUs);
  return { ...built, presetId: resolvedId };
}

module.exports = {
  listPresets,
  buildPreset,
  buildPresetForIndex,
  CYCLE_ID,
  PRESET_IDS
};
