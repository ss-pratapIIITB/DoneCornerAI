export const THEME_COOKIE = "donecorner.theme";

export type PortalTheme = "light" | "dark";

export function parsePortalTheme(value: string | undefined | null): PortalTheme {
  return value === "light" ? "light" : "dark";
}

export function themeCookie(theme: PortalTheme): string {
  return `${THEME_COOKIE}=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
