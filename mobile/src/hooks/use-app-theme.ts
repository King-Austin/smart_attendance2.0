import { useColorScheme } from 'react-native';

import { Colors } from '@/constants/theme';

export function useAppTheme() {
  const scheme = useColorScheme();
  return {
    scheme: scheme === 'dark' ? 'dark' : 'light',
    colors: scheme === 'dark' ? Colors.dark : Colors.light,
  } as const;
}
