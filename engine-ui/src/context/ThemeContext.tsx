import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";

export type ThemeMode = "dark" | "light";
export type AccentColor = "emerald" | "cyan" | "amber" | "violet";
export type UiDensity = "comfortable" | "compact";

export interface ThemeContextValue {
	theme: ThemeMode;
	accent: AccentColor;
	density: UiDensity;
	sidebarCollapsed: boolean;
	toggleTheme: () => void;
	setTheme: (theme: ThemeMode) => void;
	setAccent: (accent: AccentColor) => void;
	setDensity: (density: UiDensity) => void;
	setSidebarCollapsed: (collapsed: boolean) => void;
	toggleSidebarCollapsed: () => void;
}

const STORAGE_THEME = "llama-engine-theme";
const STORAGE_ACCENT = "llama-engine-accent";
const STORAGE_DENSITY = "llama-engine-density";
const STORAGE_SIDEBAR = "llama-engine-sidebar-collapsed";

const ThemeContext = createContext<ThemeContextValue>({
	theme: "dark",
	accent: "emerald",
	density: "comfortable",
	sidebarCollapsed: false,
	toggleTheme: () => {},
	setTheme: () => {},
	setAccent: () => {},
	setDensity: () => {},
	setSidebarCollapsed: () => {},
	toggleSidebarCollapsed: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
	const [theme, setThemeState] = useState<ThemeMode>(() => {
		try {
			const saved = window.localStorage.getItem(STORAGE_THEME);
			if (saved === "light" || saved === "dark") return saved;
		} catch {}
		return "dark";
	});

	const [accent, setAccentState] = useState<AccentColor>(() => {
		try {
			const saved = window.localStorage.getItem(STORAGE_ACCENT);
			if (saved === "emerald" || saved === "cyan" || saved === "amber" || saved === "violet") {
				return saved;
			}
		} catch {}
		return "emerald";
	});

	const [density, setDensityState] = useState<UiDensity>(() => {
		try {
			const saved = window.localStorage.getItem(STORAGE_DENSITY);
			if (saved === "comfortable" || saved === "compact") return saved;
		} catch {}
		return "comfortable";
	});

	const [sidebarCollapsed, setSidebarCollapsedState] = useState<boolean>(() => {
		try {
			return window.localStorage.getItem(STORAGE_SIDEBAR) === "true";
		} catch {}
		return false;
	});

	useEffect(() => {
		document.documentElement.setAttribute("data-theme", theme);
		try {
			window.localStorage.setItem(STORAGE_THEME, theme);
		} catch {}
	}, [theme]);

	useEffect(() => {
		document.documentElement.setAttribute("data-accent", accent);
		try {
			window.localStorage.setItem(STORAGE_ACCENT, accent);
		} catch {}
	}, [accent]);

	useEffect(() => {
		document.documentElement.setAttribute("data-density", density);
		try {
			window.localStorage.setItem(STORAGE_DENSITY, density);
		} catch {}
	}, [density]);

	useEffect(() => {
		try {
			window.localStorage.setItem(STORAGE_SIDEBAR, String(sidebarCollapsed));
		} catch {}
	}, [sidebarCollapsed]);

	const setTheme = useCallback((next: ThemeMode) => setThemeState(next), []);
	const toggleTheme = useCallback(
		() => setThemeState((prev) => (prev === "dark" ? "light" : "dark")),
		[],
	);
	const setAccent = useCallback((next: AccentColor) => setAccentState(next), []);
	const setDensity = useCallback((next: UiDensity) => setDensityState(next), []);
	const setSidebarCollapsed = useCallback((next: boolean) => setSidebarCollapsedState(next), []);
	const toggleSidebarCollapsed = useCallback(() => setSidebarCollapsedState((prev) => !prev), []);

	return (
		<ThemeContext.Provider
			value={{
				theme,
				accent,
				density,
				sidebarCollapsed,
				toggleTheme,
				setTheme,
				setAccent,
				setDensity,
				setSidebarCollapsed,
				toggleSidebarCollapsed,
			}}
		>
			{children}
		</ThemeContext.Provider>
	);
}

export function useTheme(): ThemeContextValue {
	return useContext(ThemeContext);
}
