import { useEffect, useRef, useState } from "react";
import { AppState, Linking, Modal, View } from "react-native";
import { useCameraPermissions } from "expo-camera";
import * as FileSystem from "expo-file-system/legacy";
import * as Haptics from "expo-haptics";
import { NativeFaceScanner, type FaceScannerRef } from "../../modules/smart-face-scanner";
import {
  advanceLiveness,
  createLivenessState,
  type LivenessFrameResult,
} from "@/services/livenessStateMachine";
import { useTheme } from "@/hooks/useTheme";
import { Button, Heading, Label, Notice, Progress } from "./ui";
const guidance: Record<string, string> = {
  calibrate_center: "Look straight ahead and keep your face inside the frame",
  turn_left: "Slowly turn your head to the left",
  turn_right: "Slowly turn your head to the right",
  fallback_turn_left: "Turn left and hold briefly",
  fallback_turn_right: "Turn right and hold briefly",
  blink: "Blink naturally, then look straight ahead",
  capture_lock: "Look straight ahead and hold still",
  complete: "Liveness confirmed",
  failed: "The challenge timed out. Retry the scanner.",
};
const quality: Record<string, string> = {
  FACE_NO_FACE: "Position your face in the frame",
  FACE_MULTIPLE_FACES: "Only one person should be visible",
  FACE_TOO_DARK: "Move to a brighter area",
  FACE_TOO_BRIGHT: "Reduce glare on your face",
  FACE_POSITION: "Keep your whole face centered in the frame",
  FACE_MODEL_RUNTIME: "Face analysis failed. Retry the scanner.",
};
export function FaceScanner({
  visible,
  onClose,
  onCaptured,
}: {
  visible: boolean;
  onClose: () => void;
  onCaptured: (uri: string) => Promise<void> | void;
}) {
  const { variables } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [instruction, setInstruction] = useState(guidance.calibrate_center);
  const [run, setRun] = useState(0);
  const [active, setActive] = useState(true);
  const ref = useRef<FaceScannerRef>(null);
  const state = useRef(createLivenessState("left", Date.now()));
  const capturing = useRef(false);
  const mounted = useRef(false);
  const frameAt = useRef(Date.now());
  useEffect(() => {
    mounted.current = visible;
    if (visible) {
      state.current = createLivenessState(Math.random() < 0.5 ? "left" : "right", Date.now());
      capturing.current = false;
      setError(null);
      setProgress(0);
      setInstruction(guidance.calibrate_center);
      setActive(true);
      frameAt.current = Date.now();
    }
    const subscription = AppState.addEventListener("change", (value) => {
      if (value !== "active" && visible) {
        setActive(false);
        setError("Camera paused when the app left the foreground. Retry the scanner.");
      }
    });
    return () => {
      mounted.current = false;
      subscription.remove();
    };
  }, [visible, run]);
  useEffect(() => {
    // Only watch for frames when a real, permitted scanner is actually running.
    // Missing modules and denied permissions cannot be repaired by retrying inference.
    if (!visible || !permission?.granted || !NativeFaceScanner || !active || error) return;
    frameAt.current = Date.now();
    const timer = setInterval(() => {
      if (!capturing.current && Date.now() - frameAt.current > 8000) {
        setError("The camera stopped responding. Retry the scanner.");
        setActive(false);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [visible, permission?.granted, active, error, run]);
  const onFrame = async ({ nativeEvent: frame }: { nativeEvent: LivenessFrameResult }) => {
    if (!mounted.current || capturing.current || !active) return;
    frameAt.current = Date.now();
    state.current = advanceLiveness(state.current, frame);
    const current = state.current;
    setProgress(current.progressPercent);
    setInstruction(
      current.guidanceCode
        ? (quality[current.guidanceCode] ?? guidance[current.phase])
        : guidance[current.phase],
    );
    if (current.phase === "failed") {
      setError("Liveness verification failed. Retry the challenge.");
      setActive(false);
      return;
    }
    if (current.phase === "complete") {
      capturing.current = true;
      let uri: string | undefined;
      try {
        const result = await ref.current!.capture();
        uri = result.uri;
        setActive(false);
        if (!mounted.current) return;
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await onCaptured(uri);
      } catch (err) {
        if (mounted.current) {
          setError(err instanceof Error ? err.message : "Face capture failed.");
          capturing.current = false;
        }
      } finally {
        if (uri) await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
      }
    }
  };
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      supportedOrientations={["portrait"]}
      onRequestClose={onClose}
    >
      <View style={variables} className="flex-1 bg-background px-5 pb-10 pt-16">
        <View className="mb-6 gap-2">
          <Heading>Verify it’s you</Heading>
          <Label muted className="text-sm">
            Complete the live face challenge. Your photo is used only for verification.
          </Label>
        </View>
        {!NativeFaceScanner ? (
          <Notice
            danger
            text="This app build doesn’t include face verification. Install the latest full Android or iOS build to continue. Updating or retrying this screen won’t add the camera module."
          />
        ) : !permission?.granted ? (
          <View className="gap-4">
            <Notice
              text={
                permission?.canAskAgain === false
                  ? "Camera access is blocked. Enable it in your phone’s app settings, then return here."
                  : "Camera access is required for live face verification."
              }
            />
            <Button
              onPress={() => {
                if (permission?.canAskAgain === false)
                  void Linking.openSettings().catch(() =>
                    setError("Open your phone’s settings and allow camera access for this app."),
                  );
                else
                  void requestPermission().catch(() =>
                    setError(
                      "Camera permission could not be requested. Try your phone’s app settings.",
                    ),
                  );
              }}
            >
              {permission?.canAskAgain === false ? "Open app settings" : "Allow camera access"}
            </Button>
          </View>
        ) : (
          <View className="flex-1 gap-5">
            <View className="relative flex-1 overflow-hidden rounded-3xl bg-black">
              <NativeFaceScanner
                key={run}
                ref={ref}
                active={active && !error}
                onFrame={onFrame}
                onError={({ nativeEvent }) => {
                  setError(nativeEvent.message);
                  setActive(false);
                }}
                style={{ flex: 1 }}
              />
              <View
                pointerEvents="none"
                className="absolute inset-10 rounded-[100px] border-2 border-white/70"
              />
            </View>
            <Progress value={progress} />
            <Label className="text-center text-base font-semibold">{instruction}</Label>
          </View>
        )}
        {error && NativeFaceScanner && (
          <View className="mt-4 gap-3">
            <Notice danger text={error} />
            {permission?.granted ? (
              <Button onPress={() => setRun((value) => value + 1)}>Retry scanner</Button>
            ) : null}
          </View>
        )}
        <View className="mt-5">
          <Button variant="secondary" onPress={onClose}>
            Cancel
          </Button>
        </View>
      </View>
    </Modal>
  );
}
