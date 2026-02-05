import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(() => {
        // Check localStorage first, then system preference
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('cocoguard-theme');
            if (stored) {
                console.log('Theme loaded from localStorage:', stored);
                return stored;
            }
            const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            console.log('Theme from system preference:', systemDark ? 'dark' : 'light');
            return systemDark ? 'dark' : 'light';
        }
        return 'light';
    });

    // Apply theme to DOM
    useEffect(() => {
        const root = document.documentElement;
        console.log('Applying theme:', theme);

        if (theme === 'dark') {
            root.classList.add('dark');
            root.classList.remove('light');
        } else {
            root.classList.remove('dark');
            root.classList.add('light');
        }

        localStorage.setItem('cocoguard-theme', theme);
        console.log('Theme saved to localStorage:', theme);
    }, [theme]);

    const toggleTheme = useCallback(() => {
        setTheme((prev) => {
            const newTheme = prev === 'light' ? 'dark' : 'light';
            console.log('Theme toggled from', prev, 'to', newTheme);
            return newTheme;
        });
    }, []);

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export default ThemeContext;

