/**
 * IATA Airport Code → City/Airport Name mapping
 * Used to display friendly names like "Houston Bush (IAH)"
 */
const AIRPORT_NAMES = {
  // ── United States ──
  'IAH': 'Houston Bush Intl',
  'EWR': 'Newark Liberty Intl',
  'ORD': "Chicago O'Hare Intl",
  'DEN': 'Denver Intl',
  'SFO': 'San Francisco Intl',
  'LAX': 'Los Angeles Intl',
  'IAD': 'Washington Dulles Intl',
  'JFK': 'New York Kennedy Intl',
  'LGA': 'New York LaGuardia',
  'ATL': 'Atlanta Hartsfield Intl',
  'DFW': 'Dallas/Fort Worth Intl',
  'MIA': 'Miami Intl',
  'SEA': 'Seattle-Tacoma Intl',
  'BOS': 'Boston Logan Intl',
  'PHX': 'Phoenix Sky Harbor Intl',
  'MSP': 'Minneapolis-St Paul Intl',
  'DTW': 'Detroit Metro Wayne',
  'PHL': 'Philadelphia Intl',
  'CLT': 'Charlotte Douglas Intl',
  'MCO': 'Orlando Intl',
  'TPA': 'Tampa Intl',
  'SAN': 'San Diego Intl',
  'SLC': 'Salt Lake City Intl',
  'AUS': 'Austin-Bergstrom Intl',
  'SAT': 'San Antonio Intl',
  'PDX': 'Portland Intl',
  'HNL': 'Honolulu Daniel K. Inouye',
  'ANC': 'Anchorage Ted Stevens',
  'STL': 'St. Louis Lambert Intl',
  'BNA': 'Nashville Intl',
  'RDU': 'Raleigh-Durham Intl',
  'CLE': 'Cleveland Hopkins Intl',
  'IND': 'Indianapolis Intl',
  'MCI': 'Kansas City Intl',
  'SMF': 'Sacramento Intl',
  'SJC': 'San Jose Mineta Intl',
  'OAK': 'Oakland Intl',
  'BWI': 'Baltimore/Washington Intl',
  'FLL': 'Fort Lauderdale Intl',
  'RSW': 'Fort Myers SW Florida',
  'PIT': 'Pittsburgh Intl',
  'CVG': 'Cincinnati/N. Kentucky Intl',
  'CMH': 'Columbus John Glenn Intl',
  'MKE': 'Milwaukee Mitchell Intl',
  'OMA': 'Omaha Eppley Airfield',
  'ABQ': 'Albuquerque Intl Sunport',
  'BUF': 'Buffalo Niagara Intl',
  'JAX': 'Jacksonville Intl',
  'RIC': 'Richmond Intl',
  'ONT': 'Ontario Intl',
  'BUR': 'Burbank Hollywood Intl',
  'GUM': 'Guam A.B. Won Pat Intl',

  // ── Canada ──
  'YYZ': 'Toronto Pearson Intl',
  'YVR': 'Vancouver Intl',
  'YUL': 'Montreal Trudeau Intl',
  'YYC': 'Calgary Intl',
  'YOW': 'Ottawa Macdonald-Cartier',
  'YEG': 'Edmonton Intl',
  'YWG': 'Winnipeg Richardson Intl',
  'YHZ': 'Halifax Stanfield Intl',

  // ── Mexico ──
  'MEX': 'Mexico City Intl',
  'CUN': 'Cancun Intl',
  'GDL': 'Guadalajara Intl',
  'SJD': 'San Jose del Cabo Intl',
  'PVR': 'Puerto Vallarta Intl',
  'MTY': 'Monterrey Intl',

  // ── Central America & Caribbean ──
  'PTY': 'Panama City Tocumen Intl',
  'SJO': 'San Jose Juan Santamaria',
  'SAL': 'San Salvador Intl',
  'GUA': 'Guatemala City La Aurora',
  'TGU': 'Tegucigalpa Toncontin Intl',
  'MBJ': 'Montego Bay Sangster Intl',
  'NAS': 'Nassau Lynden Pindling Intl',
  'SJU': 'San Juan Luis Munoz Marin',
  'STT': 'St. Thomas Cyril E. King',
  'STX': 'St. Croix Henry Rohlsen',
  'AUA': 'Aruba Queen Beatrix Intl',

  // ── South America ──
  'BOG': 'Bogota El Dorado Intl',
  'GRU': 'Sao Paulo Guarulhos Intl',
  'GIG': 'Rio de Janeiro Galeao Intl',
  'EZE': 'Buenos Aires Ezeiza Intl',
  'SCL': 'Santiago Arturo Merino',
  'LIM': 'Lima Jorge Chavez Intl',
  'UIO': 'Quito Mariscal Sucre Intl',
  'CCS': 'Caracas Simon Bolivar Intl',
  'MDE': 'Medellin Jose Maria Cordova',
  'CTG': 'Cartagena Rafael Nunez',
  'MVD': 'Montevideo Carrasco Intl',

  // ── Europe ──
  'LHR': 'London Heathrow',
  'LGW': 'London Gatwick',
  'CDG': 'Paris Charles de Gaulle',
  'FRA': 'Frankfurt Intl',
  'MUC': 'Munich Intl',
  'AMS': 'Amsterdam Schiphol',
  'MAD': 'Madrid Barajas',
  'BCN': 'Barcelona El Prat',
  'FCO': 'Rome Fiumicino',
  'MXP': 'Milan Malpensa',
  'ZRH': 'Zurich Intl',
  'VIE': 'Vienna Intl',
  'BRU': 'Brussels Intl',
  'LIS': 'Lisbon Humberto Delgado',
  'DUB': 'Dublin Intl',
  'EDI': 'Edinburgh Intl',
  'MAN': 'Manchester Intl',
  'CPH': 'Copenhagen Kastrup',
  'ARN': 'Stockholm Arlanda',
  'OSL': 'Oslo Gardermoen',
  'HEL': 'Helsinki Vantaa',
  'WAW': 'Warsaw Chopin',
  'PRG': 'Prague Vaclav Havel',
  'BUD': 'Budapest Ferenc Liszt',
  'ATH': 'Athens Eleftherios Venizelos',
  'IST': 'Istanbul Intl',
  'GVA': 'Geneva Intl',
  'TLV': 'Tel Aviv Ben Gurion',

  // ── Asia ──
  'NRT': 'Tokyo Narita Intl',
  'HND': 'Tokyo Haneda Intl',
  'KIX': 'Osaka Kansai Intl',
  'NGO': 'Nagoya Chubu Centrair',
  'ICN': 'Seoul Incheon Intl',
  'PEK': 'Beijing Capital Intl',
  'PVG': 'Shanghai Pudong Intl',
  'HKG': 'Hong Kong Intl',
  'TPE': 'Taipei Taoyuan Intl',
  'SIN': 'Singapore Changi',
  'BKK': 'Bangkok Suvarnabhumi',
  'KUL': 'Kuala Lumpur Intl',
  'MNL': 'Manila Ninoy Aquino Intl',
  'CGK': 'Jakarta Soekarno-Hatta',
  'DEL': 'Delhi Indira Gandhi Intl',
  'BOM': 'Mumbai Chhatrapati Shivaji',
  'HAN': 'Hanoi Noi Bai Intl',
  'SGN': 'Ho Chi Minh City Tan Son Nhat',

  // ── Oceania ──
  'SYD': 'Sydney Kingsford Smith',
  'MEL': 'Melbourne Tullamarine',
  'BNE': 'Brisbane Intl',
  'AKL': 'Auckland Intl',
  'PPT': 'Tahiti Faaa Intl',

  // ── Africa / Middle East ──
  'DXB': 'Dubai Intl',
  'AUH': 'Abu Dhabi Intl',
  'DOH': 'Doha Hamad Intl',
  'JNB': 'Johannesburg O.R. Tambo',
  'CPT': 'Cape Town Intl',
  'NBO': 'Nairobi Jomo Kenyatta',
  'CAI': 'Cairo Intl',
  'CMN': 'Casablanca Mohammed V',
  'ADD': 'Addis Ababa Bole Intl',
  'LOS': 'Lagos Murtala Muhammed',
  'ACC': 'Accra Kotoka Intl',
};

/**
 * Get airport display name: "Houston Bush Intl (IAH)"
 * Falls back to just the code if not found
 */
export function getAirportDisplay(code) {
  if (!code) return '';
  const upper = code.toUpperCase().trim();
  const name = AIRPORT_NAMES[upper];
  return name ? `${name} (${upper})` : upper;
}

/**
 * Get just the city/airport name, or empty string
 */
export function getAirportName(code) {
  if (!code) return '';
  return AIRPORT_NAMES[code.toUpperCase().trim()] || '';
}

export default AIRPORT_NAMES;
