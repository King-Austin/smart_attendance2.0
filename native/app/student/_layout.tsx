import { Stack } from "expo-router";
import { RoleGate } from "@/hooks/useAuth";
export default function Layout() {
  return (
    <RoleGate role="student">
      <Stack screenOptions={{ headerShown: false }} />
    </RoleGate>
  );
}
