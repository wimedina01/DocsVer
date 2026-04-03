import React, { createContext, useContext, useState, useEffect } from 'react';

const StationContext = createContext();

export function StationProvider({ children }) {
  const [homeStation, setHomeStation] = useState(() => localStorage.getItem('hr_home_station') || '');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('hr_dark_mode') === 'true');

  useEffect(() => {
    localStorage.setItem('hr_home_station', homeStation);
  }, [homeStation]);

  useEffect(() => {
    localStorage.setItem('hr_dark_mode', darkMode);
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  return (
    <StationContext.Provider value={{ homeStation, setHomeStation, darkMode, setDarkMode }}>
      {children}
    </StationContext.Provider>
  );
}

export function useStation() {
  return useContext(StationContext);
}
