import { Platform } from 'react-native';

export const Brand = {
  name: 'UNIZIK Presence',
  university: 'Nnamdi Azikiwe University',
  shortName: 'UNIZIK',
  motto: 'Discipline · Self Reliance · Excellence',
  attendanceRadiusMeters: 150,
} as const;

export const Colors = {
  light: {
    primary: '#1C64D6',
    primaryPressed: '#154EA8',
    primarySoft: '#EAF1FC',
    orange: '#E84F10',
    orangeSoft: '#FDEDE7',
    gold: '#9A7200',
    goldSoft: '#F8F1DA',
    navy: '#0F1433',
    background: '#F6F7FB',
    surface: '#FFFFFF',
    surfaceMuted: '#ECF0F8',
    text: '#0F1433',
    textSecondary: '#5B647C',
    textFaint: '#8991A5',
    border: '#DDE3EF',
    success: '#15805A',
    successSoft: '#E7F6F0',
    warning: '#9A7200',
    warningSoft: '#F8F1DA',
    danger: '#C33A32',
    dangerSoft: '#FCEBE9',
  },
  dark: {
    primary: '#75A7F5',
    primaryPressed: '#9BBFF7',
    primarySoft: '#17284D',
    orange: '#F27A48',
    orangeSoft: '#3B211A',
    gold: '#D8B755',
    goldSoft: '#342E19',
    navy: '#F5F7FC',
    background: '#07090F',
    surface: '#0D1320',
    surfaceMuted: '#111827',
    text: '#F5F7FC',
    textSecondary: '#AEB7CA',
    textFaint: '#778197',
    border: '#273146',
    success: '#62C99F',
    successSoft: '#15362B',
    warning: '#D8B755',
    warningSoft: '#342E19',
    danger: '#F08A83',
    dangerSoft: '#3B1D1D',
  },
} as const;

export type AppColors = (typeof Colors)['light'];

export const Fonts = Platform.select({
  ios: { regular: 'System', medium: 'System', bold: 'System' },
  default: { regular: 'sans-serif', medium: 'sans-serif-medium', bold: 'sans-serif' },
})!;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  huge: 48,
} as const;

export const Radius = { sm: 10, md: 16, lg: 22, pill: 999 } as const;
