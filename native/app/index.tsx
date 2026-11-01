import { Redirect } from "expo-router";
import { View } from "react-native";
import { useAuth } from "@/hooks/useAuth";
import { Loading } from "@/components/ui";
import { LandingScreen } from "@/screens/PublicScreens";

export default function LaunchScreen() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <View className="flex-1 justify-center bg-background">
        <Loading />
      </View>
    );
  if (user) return <Redirect href={`/${user.role}/dashboard`} />;
  return <LandingScreen />;
}
