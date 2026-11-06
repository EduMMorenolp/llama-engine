import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";

export type ThemeMode = "dark" | "light";

export interface ThemeContextValue {
	theme: ThemeMode;
	toggleTheme: () => void;
	setTheme: (theme: ThemeMode) => void;
}

const STORAGE_KEY = "llama-engine-theme";

const ThemeContext = createContext<ThemeContextValue>({
	theme: "dark",
	toggleTheme: () => {},
	setTheme: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
	const [theme, setThemeState] = useState<ThemeMode>(() => {
		try {
			const saved = window.localStorage.getItem(STORAGE_KEY);
			if (saved === "light" || saved === "dark") return saved;
		} catch {
			// Ignore storage errors
		}
		return "dark";
	});

	useEffect(() => {
		document.documentElement.setAttribute("data-theme", theme);
		try {
			window.localStorage.setItem(STORAGE_KEY, theme);
		} catch {
			// Ignore storage errors
		}
	}, [theme]);

	const setTheme = useCallback((next: ThemeMode) => {
		setThemeState(next);
	}, []);

	const toggleTheme = useCallback(() => {
		setThemeState((prev) => (prev === "dark" ? "light" : "dark"));
	}, []);

	return (
		<ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
			{children}
		</ThemeContext.Provider>
	);
}

export function useTheme(): ThemeContextValue {
	return useContext(ThemeContext);
}
