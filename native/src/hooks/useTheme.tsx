import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Appearance } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { vars, useColorScheme } from "nativewind";
import { palettes } from "@/lib/palette";
type Preference = "light" | "dark" | "system";
const ThemeContext = createContext({
  preference: "system" as Preference,
  dark: false,
  variables: {} as ReturnType<typeof vars>,
  palette: palettes.light as Record<keyof typeof palettes.light, string>,
  setPreference: (_value: Preference) => {},
});
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<Preference>("system");
  const [system, setSystem] = useState(Appearance.getColorScheme());
  const { setColorScheme } = useColorScheme();
  useEffect(() => {
    void AsyncStorage.getItem("scp.theme").then((value) => {
      if (value === "light" || value === "dark" || value === "system") setPreferenceState(value);
    });
    const sub = Appearance.addChangeListener(({ colorScheme }) => setSystem(colorScheme));
    return () => sub.remove();
  }, []);
  const dark = preference === "dark" || (preference === "system" && system === "dark");
  useEffect(() => {
    setColorScheme(preference);
    if (preference === "system") {
      Appearance.setColorScheme("unspecified");
      setSystem(Appearance.getColorScheme());
    }
  }, [preference, setColorScheme]);
  const values = dark ? palettes.dark : palettes.light;
  const variables = vars(
    Object.fromEntries(Object.entries(values).map(([key, value]) => [`--${key}`, value])),
  );
  const palette = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, `rgb(${value.replaceAll(" ", ",")})`]),
  ) as Record<keyof typeof palettes.light, string>;
  const setPreference = (value: Preference) => {
    setPreferenceState(value);
    void AsyncStorage.setItem("scp.theme", value);
  };
  return (
    <ThemeContext.Provider value={{ preference, dark, variables, palette, setPreference }}>
      {children}
    </ThemeContext.Provider>
  );
}
export const useTheme = () => useContext(ThemeContext);
