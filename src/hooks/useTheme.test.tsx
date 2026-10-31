// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeProvider, useTheme, type ThemePreference } from "./useTheme";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;
let systemIsDark = false;
let mediaListener: (() => void) | undefined;

function ThemeProbe() {
  const { preference, resolvedTheme, setPreference } = useTheme();
  return (
    <button type="button" onClick={() => setPreference("dark")}>
      {preference}:{resolvedTheme}
    </button>
  );
}

beforeEach(() => {
  systemIsDark = false;
  mediaListener = undefined;
  window.localStorage.clear();
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({
      matches: systemIsDark,
      media: "(prefers-color-scheme: dark)",
      addEventListener: (_event: string, listener: () => void) => {
        mediaListener = listener;
      },
      removeEventListener: vi.fn(),
    })),
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  document.documentElement.classList.remove("dark");
  delete document.documentElement.dataset.theme;
});

function renderWithPreference(preference?: ThemePreference) {
  if (preference) window.localStorage.setItem("smart-attendance-theme", preference);
  act(() => root.render(<ThemeProvider><ThemeProbe /></ThemeProvider>));
}

describe("ThemeProvider", () => {
  it("defaults to the system preference and responds when it changes", () => {
    renderWithPreference();
    expect(container.textContent).toBe("system:light");

    systemIsDark = true;
    act(() => mediaListener?.());

    expect(container.textContent).toBe("system:dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("persists a manual theme selection", () => {
    renderWithPreference("light");
    const button = container.querySelector("button");
    act(() => button?.click());

    expect(window.localStorage.getItem("smart-attendance-theme")).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(container.textContent).toBe("dark:dark");
  });
});
