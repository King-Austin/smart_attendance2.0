import { useEffect, useRef, type ReactNode } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useTheme } from "@/hooks/useTheme";

export function BottomSheet({
  visible,
  title,
  subtitle,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { palette, variables } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const translate = useRef(new Animated.Value(24)).current;
  useEffect(() => {
    if (!visible) {
      translate.setValue(24);
      return;
    }
    const animation = Animated.timing(translate, {
      toValue: 0,
      duration: reducedMotion ? 0 : 220,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [visible, translate, reducedMotion]);
  return (
    <Modal
      visible={visible}
      transparent
      animationType={reducedMotion ? "none" : "fade"}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={variables} className="flex-1">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Dismiss ${title.toLowerCase()}`}
          onPress={onClose}
          style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0, 5, 18, 0.58)" }}
        />
        <KeyboardAvoidingView
          pointerEvents="box-none"
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1, justifyContent: "flex-end", paddingTop: insets.top + 16 }}
        >
          <Animated.View
            accessibilityViewIsModal
            onAccessibilityEscape={onClose}
            style={{
              height: Math.min(height * 0.82, 720),
              width: "100%",
              maxWidth: 560,
              alignSelf: "center",
              paddingBottom: Math.max(insets.bottom, 16),
              transform: [{ translateY: translate }],
              backgroundColor: palette.card,
              borderTopLeftRadius: 32,
              borderTopRightRadius: 32,
              overflow: "hidden",
            }}
          >
            <View className="items-center pb-1 pt-3" accessible={false}>
              <View className="h-1 w-10 rounded-full bg-muted-foreground/30" />
            </View>
            <View className="flex-row items-center gap-3 px-5 pb-4 pt-2">
              <View className="flex-1 gap-1">
                <Text
                  accessibilityRole="header"
                  className="text-2xl text-foreground"
                  style={{ fontFamily: "GeistBold" }}
                >
                  {title}
                </Text>
                {subtitle ? (
                  <Text className="text-sm text-muted-foreground" style={{ fontFamily: "Geist" }}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Close ${title.toLowerCase()}`}
                onPress={onClose}
                className="h-12 w-12 items-center justify-center rounded-full bg-secondary active:opacity-70"
              >
                <X size={20} color={palette.foreground} />
              </Pressable>
            </View>
            {children}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
