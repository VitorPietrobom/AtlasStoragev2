import { useColorScheme } from 'react-native';

// Paper and ink in light mode, a blueprint in dark, one signal orange for
// anything that moved. Text on signal is always ink: white on #FF5A1F fails contrast.

export interface Palette {
  scheme: 'light' | 'dark';
  background: string;
  surface: string;
  tray: string;
  ink: string;
  inkMuted: string;
  hairline: string;
  signal: string;
  signalText: string;
  /** Stored, no lifting. */
  inOk: string;
  /** Text and fill of the selected segment / dark button. */
  selected: string;
  onSelected: string;
  /** Always-dark text on signal. */
  onSignal: string;
  scrim: string;
  /** Labels are printed on white whatever the theme. */
  label: string;
  labelInk: string;
}

export const light: Palette = {
  scheme: 'light',
  background: '#F4F0E8',
  surface: '#FBF9F4',
  tray: '#EAE3D5',
  ink: '#1C1B19',
  inkMuted: '#6E6A62',
  hairline: '#D9D3C7',
  signal: '#FF5A1F',
  signalText: '#B83A0A',
  inOk: '#2F7D5B',
  selected: '#1C1B19',
  onSelected: '#FBF9F4',
  onSignal: '#1C1B19',
  scrim: 'rgba(28,27,25,0.35)',
  label: '#FFFFFF',
  labelInk: '#1C1B19',
};

export const dark: Palette = {
  scheme: 'dark',
  background: '#0E1A2B',
  surface: '#14243A',
  tray: '#11203A',
  ink: '#E8EEF5',
  inkMuted: '#8FA3BC',
  hairline: '#2B4466',
  signal: '#FF7A3D',
  signalText: '#FF7A3D',
  inOk: '#5FD39A',
  selected: '#E8EEF5',
  onSelected: '#0E1A2B',
  onSignal: '#1C1B19',
  scrim: 'rgba(5,10,18,0.55)',
  label: '#FFFFFF',
  labelInk: '#1C1B19',
};

export function useTheme(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

/** Instrument Serif for titles and answers, Inter for UI, JetBrains Mono for codes, numbers and dates. */
export const font = {
  serif: 'InstrumentSerif_400Regular',
  ui: 'Inter_400Regular',
  uiMedium: 'Inter_500Medium',
  uiSemi: 'Inter_600SemiBold',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_600SemiBold',
} as const;

export const radius = { sm: 6, md: 10, lg: 14, xl: 20, pill: 999 } as const;

/** Touch targets are at least 44 pt. */
export const TOUCH = 44;

/** Spring values from board D13: stiffness-ish response / damping as [response, dampingRatio]. */
export const springs = {
  searchHit: { response: 0.3, damping: 0.85 },
  levelSwitch: { response: 0.35, damping: 0.88 },
  takeOutPeel: { response: 0.2, damping: 0.9 },
  takeOutDrop: { response: 0.4, damping: 0.74 },
  returnFly: { response: 0.45, damping: 0.8 },
  moveSwap: { response: 0.45, damping: 0.8 },
  stack: { response: 0.28, damping: 0.82 },
} as const;

/** Convert a SwiftUI-style (response, dampingRatio) spring to Animated.spring config. */
export function springConfig(s: { response: number; damping: number }) {
  const stiffness = Math.pow((2 * Math.PI) / s.response, 2);
  const damping = (4 * Math.PI * s.damping) / s.response;
  return { stiffness, damping, mass: 1, useNativeDriver: true } as const;
}
