import { Platform } from 'react-native';

export const Brand = {
  name: 'Smart Campus Presence',
  university: 'Nnamdi Azikiwe University',
  shortName: 'Smart Campus',
  motto: 'Discipline · Self Reliance · Excellence',
  attendanceRadiusMeters: 150,
} as const;

export const Colors = {
  light: {
    primary: '#33456F',
    primaryPressed: '#263756',
    primarySoft: '#F2F5FA',
    orange: '#B8821E',
    orangeSoft: '#FBF3DF',
    gold: '#B8821E',
    goldSoft: '#FBF3DF',
    navy: '#33456F',
    sidebar: '#33456F',
    sidebarAccent: '#3C517D',
    background: '#F6F8FC',
    surface: '#FFFFFF',
    surfaceMuted: '#F1F5FA',
    text: '#27324A',
    textSecondary: '#68738A',
    textFaint: '#8A94A6',
    border: '#E1E7F0',
    success: '#2F8B66',
    successSoft: '#E9F6F0',
    warning: '#B8821E',
    warningSoft: '#FBF3DF',
    danger: '#C4473B',
    dangerSoft: '#FCEBE9',
  },
  dark: {
    primary: '#EEF3FB',
    primaryPressed: '#D8E2F1',
    primarySoft: '#29354D',
    orange: '#D8B755',
    orangeSoft: '#342E19',
    gold: '#D8B755',
    goldSoft: '#342E19',
    navy: '#F5F7FC',
    sidebar: '#1F293D',
    sidebarAccent: '#2B3851',
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

export const Radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
