import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabase';

const StationContext = createContext();

export function StationProvider({ children }) {
  const [homeStation, setHomeStation] = useState(() => localStorage.getItem('hr_home_station') || '');
  const [pendingStation, setPendingStation] = useState('');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('hr_dark_mode') === 'true');
  const [configuredStations, setConfiguredStations] = useState([]);

  // Load configured stations from DB
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('airport_requirements').select('airport_code');
        const codes = [...new Set((data || []).map(a => a.airport_code))].sort();
        setConfiguredStations(codes);
      } catch (e) { console.error(e); }
    })();
  }, []);

  const saveStation = (code) => {
    const upper = (code || '').toUpperCase().trim();
    setHomeStation(upper);
    localStorage.setItem('hr_home_station', upper);
    setPendingStation('');
  };

  const resetStation = () => {
    setPendingStation('');
  };

  useEffect(() => {
    localStorage.setItem('hr_dark_mode', darkMode);
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const hasUnsavedChange = pendingStation !== '' && pendingStation !== homeStation;

  return (
    <StationContext.Provider value={{
      homeStation, setHomeStation: saveStation,
      pendingStation, setPendingStation, resetStation, hasUnsavedChange,
      darkMode, setDarkMode, configuredStations,
    }}>
      {children}
    </StationContext.Provider>
  );
}

export function useStation() {
  return useContext(StationContext);
}
