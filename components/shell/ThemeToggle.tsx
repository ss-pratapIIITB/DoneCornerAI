"use client";

import { useEffect, useState } from "react";
import {
  parsePortalTheme,
  themeCookie,
  type PortalTheme,
} from "@/lib/theme/cookie";

const THEME_KEY = "donecorner.theme";

function readTheme(): PortalTheme {
  if (typeof document === "undefined") return "dark";
  return parsePortalTheme(document.documentElement.dataset.theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<PortalTheme>("dark");

  useEffect(() => {
    let next = readTheme();
    try {
      const stored = parsePortalTheme(localStorage.getItem(THEME_KEY));
      if (!document.cookie.includes("donecorner.theme=") && localStorage.getItem(THEME_KEY)) {
        next = stored;
        document.cookie = themeCookie(next);
        document.documentElement.dataset.theme = next;
      }
    } catch {
      /* ignore quota / private mode */
    }
    setTheme(next);
  }, []);

  function apply(next: PortalTheme) {
    setTheme(next);
    document.documentElement.dataset.theme = next;
    document.cookie = themeCookie(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* ignore quota / private mode */
    }
  }

  return (
    <div className="theme-toggle" role="group" aria-label="Appearance">
      <button
        type="button"
        className={theme === "dark" ? "is-on" : ""}
        aria-pressed={theme === "dark"}
        onClick={() => apply("dark")}
      >
        Dark
      </button>
      <button
        type="button"
        className={theme === "light" ? "is-on" : ""}
        aria-pressed={theme === "light"}
        onClick={() => apply("light")}
      >
        Light
      </button>
    </div>
  );
}
