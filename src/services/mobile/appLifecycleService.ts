/**
 * App lifecycle service — bridges native Android lifecycle events into the SPA.
 *   - hide splash screen once the shell is ready
 *   - intercept the hardware back button (modal → history → exit confirm)
 *   - expose app state / URL-open events
 */
import { Capacitor } from "@capacitor/core";
import { App, type AppState, type URLOpenListenerEvent } from "@capacitor/app";
import { SplashScreen } from "@capacitor/splash-screen";

interface BackButtonRouter {
  history: {
    back: () => void;
    location: { state?: unknown };
  };
}

const EXIT_CONFIRM_WINDOW_MS = 2000;
let lastBackPress = 0;
let backHandlerAttached = false;

let hideSplashPromise: Promise<void> | null = null;

async function hideSplashScreen(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (hideSplashPromise) return hideSplashPromise;
  hideSplashPromise = (async () => {
    // Give the SPA a beat to paint before we yank the splash.
    await new Promise((r) => setTimeout(r, 50));
    try {
      await SplashScreen.hide({ fadeOutDuration: 250 });
    } catch (err) {
      console.warn("[lifecycle] hideSplashScreen failed", err);
    }
  })();
  return hideSplashPromise;
}

function isModalOpen(): boolean {
  if (typeof document === "undefined") return false;
  return Boolean(
    document.querySelector(
      '[role="dialog"][data-state="open"], [data-state="open"][data-radix-dialog-content]',
    ),
  );
}

function closeTopModal(): boolean {
  if (typeof document === "undefined") return false;
  const closeBtn = document.querySelector<HTMLElement>(
    '[role="dialog"][data-state="open"] [data-dialog-close], [data-state="open"][data-radix-dialog-content] [data-dialog-close]',
  );
  if (closeBtn) {
    closeBtn.click();
    return true;
  }
  // Fallback: dispatch Escape so Radix/headless dialogs self-close.
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape" }));
  return true;
}

function canGoBack(router: BackButtonRouter): boolean {
  // TanStack Router tracks `location`; if the index is non-zero we have history.
  const state = router.history.location.state as { __TSR_INDEX?: number } | null | undefined;
  const index = state?.__TSR_INDEX;
  if (typeof index === "number") return index > 0;
  return window.history.length > 1;
}

async function registerBackButton(router: BackButtonRouter): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  if (backHandlerAttached) return;
  backHandlerAttached = true;
  await App.addListener("backButton", () => {
    // 1. Close any open modal first.
    if (isModalOpen()) {
      closeTopModal();
      return;
    }

    // 2. Pop history if we have somewhere to go.
    if (canGoBack(router)) {
      try {
        router.history.back();
        return;
      } catch (err) {
        console.warn("[lifecycle] router.history.back failed", err);
      }
    }

    // 3. Confirm exit (debounced — second back within 2s closes the app).
    const now = Date.now();
    if (now - lastBackPress < EXIT_CONFIRM_WINDOW_MS) {
      void App.exitApp();
      return;
    }
    lastBackPress = now;
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("scp:exit-confirm"));
    }
  });
}

async function onAppStateChange(cb: (state: AppState) => void): Promise<() => Promise<void>> {
  if (!Capacitor.isNativePlatform()) return async () => {};
  const handle = await App.addListener("appStateChange", cb);
  return async () => {
    await handle.remove();
  };
}

async function onAppUrlOpen(
  cb: (event: URLOpenListenerEvent) => void,
): Promise<() => Promise<void>> {
  if (!Capacitor.isNativePlatform()) return async () => {};
  const handle = await App.addListener("appUrlOpen", cb);
  return async () => {
    await handle.remove();
  };
}

export const appLifecycleService = {
  hideSplashScreen,
  registerBackButton,
  onAppStateChange,
  onAppUrlOpen,
};
