import * as SecureStore from "expo-secure-store";
// Supabase sessions can exceed a single secure-storage value. Persist chunks,
// writing the manifest last. JWTs and refresh tokens never go into AsyncStorage.
import { splitSecureValue } from "./secureChunks";
export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    const countValue = await SecureStore.getItemAsync(`${key}.count`);
    if (!countValue) return null;
    const count = Number(countValue);
    if (!Number.isInteger(count) || count < 1 || count > 128) return null;
    const parts = await Promise.all(
      Array.from({ length: count }, (_, i) => SecureStore.getItemAsync(`${key}.${i}`)),
    );
    return parts.some((value) => value === null) ? null : parts.join("");
  },
  async setItem(key: string, value: string): Promise<void> {
    await secureStorage.removeItem(key);
    const parts = splitSecureValue(value);
    try {
      for (let i = 0; i < parts.length; i++)
        await SecureStore.setItemAsync(`${key}.${i}`, parts[i]);
      await SecureStore.setItemAsync(`${key}.count`, String(parts.length));
    } catch (error) {
      for (let i = 0; i < parts.length; i++)
        await SecureStore.deleteItemAsync(`${key}.${i}`).catch(() => {});
      throw error;
    }
  },
  async removeItem(key: string): Promise<void> {
    const count = Number((await SecureStore.getItemAsync(`${key}.count`)) ?? 0);
    await SecureStore.deleteItemAsync(`${key}.count`);
    if (Number.isInteger(count) && count > 0 && count <= 128) {
      await Promise.all(
        Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(`${key}.${i}`)),
      );
    }
  },
};
