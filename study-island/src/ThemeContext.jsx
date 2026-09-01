import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    // 1. Check URL query params (?theme=space or ?theme=portal)
    try {
      const p = new URLSearchParams(window.location.search);
      const urlTheme = p.get("theme");
      if (urlTheme === "space" || urlTheme === "portal") {
        localStorage.setItem("edtech_study_island_theme", urlTheme);
        return urlTheme;
      }
    } catch {}

    // 2. Check localStorage
    try {
      const stored = localStorage.getItem("edtech_study_island_theme");
      if (stored === "space" || stored === "portal") {
        return stored;
      }
    } catch {}

    // 3. Default to portal theme
    return "portal";
  });

  const applyThemeToDOM = useCallback((currentTheme) => {
    const isPortal = currentTheme === "portal";
    if (isPortal) {
      document.body.classList.add("theme-portal");
      document.body.classList.remove("theme-space", "light-theme");
    } else {
      document.body.classList.add("theme-space");
      document.body.classList.remove("theme-portal", "light-theme");
    }
  }, []);

  // Apply to DOM on initial mount & whenever theme changes
  useEffect(() => {
    applyThemeToDOM(theme);
    try {
      localStorage.setItem("edtech_study_island_theme", theme);
    } catch {}
  }, [theme, applyThemeToDOM]);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === "portal" ? "space" : "portal"));
  }, []);

  const setTheme = useCallback((newTheme) => {
    if (newTheme === "portal" || newTheme === "space") {
      setThemeState(newTheme);
    }
  }, []);

  const isPortal = theme === "portal";

  return (
    <ThemeContext.Provider value={{ theme, isPortal, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
