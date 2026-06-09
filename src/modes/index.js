import { GrainField } from './grain-field'
import { EdgeErosion } from './edge-erosion'
import { ColorQuantize } from './color-quantize'
import { PixelSort } from './pixel-sort'
import { ThermalGhost } from './thermal-ghost'

export const MODES = [
  {
    id: 'GrainField',
    label: 'Grain Field',
    sub: 'motion → granular',
    accent: '#c8a96e',
    component: GrainField,
  },
  {
    id: 'EdgeErosion',
    label: 'Edge Erosion',
    sub: 'edges → percussion',
    accent: '#6ec8b4',
    component: EdgeErosion,
  },
  {
    id: 'ColorQuantize',
    label: 'Color Quantize',
    sub: 'zones → drones',
    accent: '#c86e8a',
    component: ColorQuantize,
  },
  {
    id: 'PixelSort',
    label: 'Pixel Sort Rain',
    sub: 'columns → sweeps',
    accent: '#8a6ec8',
    component: PixelSort,
  },
  {
    id: 'ThermalGhost',
    label: 'Thermal Ghost',
    sub: 'motion → decay',
    accent: '#6e8ac8',
    component: ThermalGhost,
  },
]
