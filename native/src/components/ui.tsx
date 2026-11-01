import { useState, type ReactNode } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  FlatList,
  type TextInputProps,
  type ViewProps,
} from "react-native";
import { Check, ChevronDown, Search, AlertCircle } from "lucide-react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useTheme } from "@/hooks/useTheme";
import { BottomSheet } from "./BottomSheet";
export function Label({
  children,
  muted = false,
  className = "",
}: {
  children: ReactNode;
  muted?: boolean;
  className?: string;
}) {
  return (
    <Text
      className={`${muted ? "text-muted-foreground" : "text-foreground"} ${className}`}
      style={{
        fontFamily: className.includes("font-bold")
          ? "GeistBold"
          : className.includes("font-semibold")
            ? "GeistSemiBold"
            : className.includes("font-medium")
              ? "GeistMedium"
              : "Geist",
      }}
    >
      {children}
    </Text>
  );
}
export function Heading({ children }: { children: ReactNode }) {
  return <Label className="text-2xl font-bold tracking-tight">{children}</Label>;
}
export function Card({
  children,
  className = "",
  ...props
}: ViewProps & { children: ReactNode; className?: string }) {
  return (
    <View className={`rounded-3xl border border-border/70 bg-card p-5 ${className}`} {...props}>
      {children}
    </View>
  );
}
export function AnimatedCard({ children }: { children: ReactNode }) {
  return (
    <Animated.View entering={FadeInDown.duration(240)}>
      <Card>{children}</Card>
    </Animated.View>
  );
}
export function Button({
  children,
  onPress,
  variant = "primary",
  busy = false,
  disabled = false,
  small = false,
}: {
  children: ReactNode;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  busy?: boolean;
  disabled?: boolean;
  small?: boolean;
}) {
  const { palette } = useTheme();
  const off = disabled || busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy }}
      disabled={off}
      onPress={onPress}
      className={`flex-row items-center justify-center gap-2 rounded-2xl ${small ? "px-3 py-2.5" : "px-5 py-4"} ${variant === "primary" ? "bg-primary" : variant === "danger" ? "bg-destructive" : variant === "secondary" ? "bg-secondary border border-border" : "bg-transparent"} ${off ? "opacity-45" : "active:opacity-75"}`}
    >
      {busy && <ActivityIndicator color={variant === "primary" ? "white" : palette.primary} />}
      <Text
        style={{ fontFamily: "GeistSemiBold" }}
        className={`font-semibold ${small ? "text-xs" : "text-sm"} ${variant === "primary" || variant === "danger" ? "text-white" : "text-foreground"}`}
      >
        {children}
      </Text>
    </Pressable>
  );
}
export function Field({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  const { palette } = useTheme();
  return (
    <View className="gap-2">
      <Label className="text-xs font-semibold">{label}</Label>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={palette["muted-foreground"]}
        className="min-h-12 rounded-2xl border border-border bg-secondary/40 px-4 py-3 text-sm text-foreground"
        style={{ fontFamily: "Geist" }}
        {...props}
      />
      {error && <Label className="text-xs text-destructive">{error}</Label>}
    </View>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "primary";
}) {
  return (
    <View
      className={`self-start rounded-full px-3 py-1 ${tone === "success" ? "bg-success/15" : tone === "danger" ? "bg-destructive/10" : tone === "warning" ? "bg-warning/15" : tone === "primary" ? "bg-primary/10" : "bg-secondary"}`}
    >
      <Label
        className={`text-xs font-semibold ${tone === "success" ? "text-success" : tone === "danger" ? "text-destructive" : tone === "primary" ? "text-primary" : "text-muted-foreground"}`}
      >
        {children}
      </Label>
    </View>
  );
}
export function Notice({ text, danger = false }: { text: string; danger?: boolean }) {
  const { palette } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      className={`flex-row items-start gap-2 rounded-2xl p-4 ${danger ? "bg-destructive/10" : "bg-primary/10"}`}
    >
      <AlertCircle size={16} color={danger ? palette.destructive : palette.primary} />
      <Label
        className={`flex-1 text-xs leading-5 ${danger ? "text-destructive" : "text-foreground"}`}
      >
        {text}
      </Label>
    </View>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Card className="items-center gap-3 py-10">
      <Label className="text-base font-semibold">{title}</Label>
      {description && (
        <Label muted className="text-center text-sm leading-5">
          {description}
        </Label>
      )}
      {action}
    </Card>
  );
}
export function Loading() {
  const { palette } = useTheme();
  return (
    <View className="items-center gap-3 py-12">
      <ActivityIndicator color={palette.primary} />
      <Label muted className="text-xs">
        Loading your campus…
      </Label>
    </View>
  );
}
export function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <Card className="min-w-36 flex-1 gap-2 p-4">
      <Label muted className="text-xs">
        {label}
      </Label>
      <Label className="text-3xl font-bold">{value}</Label>
      {detail && (
        <Label muted className="text-xs">
          {detail}
        </Label>
      )}
    </Card>
  );
}
export function Select({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  options: { label: string; value: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { palette } = useTheme();
  const current = options.find((o) => o.value === value);
  return (
    <View className="gap-2">
      <Label className="text-xs font-semibold">{label}</Label>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? "Select an option"}`}
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={() => {
          setSearch("");
          setOpen(true);
        }}
        className={`min-h-12 flex-row items-center justify-between rounded-2xl border border-border bg-secondary/40 px-4 ${disabled ? "opacity-45" : "active:bg-secondary"}`}
      >
        <Label className="flex-1 text-sm">{current?.label ?? "Select…"}</Label>
        <ChevronDown size={16} color={palette["muted-foreground"]} />
      </Pressable>
      <BottomSheet
        visible={open}
        title={label}
        subtitle="Choose an option to continue"
        onClose={() => {
          setOpen(false);
          setSearch("");
        }}
      >
        <View className="mx-5 mb-3 flex-row items-center gap-2 rounded-2xl bg-secondary px-4">
          <Search size={18} color={palette["muted-foreground"]} />
          <TextInput
            accessibilityLabel={`Search ${label.toLowerCase()}`}
            placeholder="Search options…"
            placeholderTextColor={palette["muted-foreground"]}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            clearButtonMode="while-editing"
            returnKeyType="search"
            style={{
              fontFamily: "Geist",
              flex: 1,
              minHeight: 48,
              color: palette.foreground,
              paddingVertical: 12,
            }}
          />
        </View>
        <View className="px-5 pb-2">
          <Label muted className="text-xs">
            {
              options.filter((option) =>
                option.label.toLowerCase().includes(search.trim().toLowerCase()),
              ).length
            }{" "}
            options
          </Label>
        </View>
        <FlatList
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12 }}
          data={options.filter((option) =>
            option.label.toLowerCase().includes(search.trim().toLowerCase()),
          )}
          keyExtractor={(option) => option.value}
          ListEmptyComponent={
            <View className="items-center gap-2 py-12">
              <Search size={28} color={palette["muted-foreground"]} />
              <Label className="text-base font-semibold">No matches found</Label>
              <Label muted className="text-center text-sm">
                Try a different name or a shorter search.
              </Label>
            </View>
          }
          ItemSeparatorComponent={() => <View className="h-1" />}
          renderItem={({ item: option }) => (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: value === option.value }}
              className={`min-h-14 flex-row items-center justify-between gap-3 rounded-2xl px-4 py-4 ${value === option.value ? "bg-primary/10" : "active:bg-secondary"}`}
              onPress={() => {
                onChange(option.value);
                setOpen(false);
                setSearch("");
              }}
            >
              <Label
                className={`flex-1 text-sm ${value === option.value ? "font-semibold text-primary" : ""}`}
              >
                {option.label}
              </Label>
              <View
                className={`h-6 w-6 items-center justify-center rounded-full border ${value === option.value ? "border-primary bg-primary" : "border-muted-foreground/40"}`}
              >
                {value === option.value ? <Check size={14} color="white" /> : null}
              </View>
            </Pressable>
          )}
        />
      </BottomSheet>
    </View>
  );
}
export function ToggleRow({
  label,
  checked,
  onPress,
  detail,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
  detail?: string;
}) {
  const { palette } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onPress}
      className="flex-row items-center gap-3 py-3"
    >
      <View
        className={`h-6 w-6 items-center justify-center rounded-lg border ${checked ? "border-primary bg-primary" : "border-border"}`}
      >
        {checked && <Check color="white" size={16} />}
      </View>
      <View className="flex-1">
        <Label className="text-sm font-medium">{label}</Label>
        {detail && (
          <Label muted className="mt-1 text-xs">
            {detail}
          </Label>
        )}
      </View>
    </Pressable>
  );
}
export function Progress({ value }: { value: number }) {
  return (
    <View className="h-2 overflow-hidden rounded-full bg-secondary">
      <View
        className="h-full rounded-full bg-primary"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </View>
  );
}
