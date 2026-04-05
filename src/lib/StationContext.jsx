import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabase';

const StationContext = createContext();

// Major US hubs by approximate lat/lon for geo-detection
const GEO_STATIONS = [
  { code: 'IAH', lat: 29.98, lon: -95.34 }, { code: 'EWR', lat: 40.69, lon: -74.17 },
  { code: 'ORD', lat: 41.97, lon: -87.90 }, { code: 'DEN', lat: 39.85, lon: -104.67 },
  { code: 'SFO', lat: 37.62, lon: -122.37 }, { code: 'LAX', lat: 33.94, lon: -118.41 },
  { code: 'IAD', lat: 38.95, lon: -77.44 }, { code: 'JFK', lat: 40.64, lon: -73.78 },
  { code: 'ATL', lat: 33.64, lon: -84.43 }, { code: 'DFW', lat: 32.90, lon: -97.04 },
  { code: 'MIA', lat: 25.80, lon: -80.29 }, { code: 'SEA', lat: 47.45, lon: -122.31 },
  { code: 'BOS', lat: 42.36, lon: -71.01 }, { code: 'PHX', lat: 33.44, lon: -112.01 },
  { code: 'MSP', lat: 44.88, lon: -93.22 }, { code: 'DTW', lat: 42.21, lon: -83.35 },
  { code: 'CLT', lat: 35.21, lon: -80.94 }, { code: 'MCO', lat: 28.43, lon: -81.31 },
  { code: 'SAN', lat: 32.73, lon: -117.19 }, { code: 'SLC', lat: 40.79, lon: -111.98 },
  { code: 'HNL', lat: 21.32, lon: -157.92 }, { code: 'GUM', lat: 13.48, lon: 144.80 },
  { code: 'SJU', lat: 18.44, lon: -66.00 },
];

function distanceMiles(lat1, lon1, lat2, lon2) {
  const R = 3959;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function StationProvider({ children }) {
  const [homeStation, setHomeStationState] = useState(() => localStorage.getItem('hr_home_station') || '');
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('hr_dark_mode') === 'true');
  const [configuredStations, setConfiguredStations] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('airport_requirements').select('airport_code');
        setConfiguredStations([...new Set((data || []).map(a => a.airport_code))].sort());
      } catch (e) { console.error(e); }
    })();
  }, []);

  // Geo-detect on first load if no saved station
  useEffect(() => {
    if (homeStation) return;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude, longitude } = pos.coords;
      let closest = null, minDist = Infinity;
      for (const s of GEO_STATIONS) {
        const d = distanceMiles(latitude, longitude, s.lat, s.lon);
        if (d < minDist) { minDist = d; closest = s.code; }
      }
      if (closest && minDist < 100) {
        setHomeStationState(closest);
        localStorage.setItem('hr_home_station', closest);
      }
    }, () => {}, { timeout: 5000 });
  }, []);

  const setHomeStation = (code) => {
    const upper = (code || '').toUpperCase().trim();
    setHomeStationState(upper);
    localStorage.setItem('hr_home_station', upper);
  };

  useEffect(() => {
    localStorage.setItem('hr_dark_mode', darkMode);
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  return (
    <StationContext.Provider value={{ homeStation, setHomeStation, darkMode, setDarkMode, configuredStations }}>
      {children}
    </StationContext.Provider>
  );
}

export function useStation() { return useContext(StationContext); }
