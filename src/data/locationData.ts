// Country → State → District → City hierarchy
// States, districts, and cities are maintained locally per country.
export const locationData: Record<string, Record<string, Record<string, string[]>>> = {
  India: {
  "Tamil Nadu": {
    "Chennai": ["Anna Nagar", "Adyar", "Besant Nagar", "T. Nagar", "Kodambakkam", "Mylapore", "Guindy", "Kilpauk"],
    "Coimbatore": ["Gandhipuram", "Peelamedu", "Saibaba Colony", "Race Course", "Tatabad"],
    "Madurai": ["Chitra Nagar", "Paravai", "Teppakulam", "Aravind Nagar"],
    "Salem": ["Fairlands", "Senthamarai Nagar", "Lalbagh"],
    "Tiruchirappalli": ["Cantonment", "Thillainagar", "Srirangam"],
    "Kanyakumari": ["Nagercoil", "Padmanabhapuram"],
    "Thoothukudi": ["Thoothukudi"],
    "Tiruppur": ["Tiruppur City", "Avinashi"],
    "Tenkasi":["Kadayanallur" ]
  },
  "Karnataka": {
    "Bangalore": ["Whitefield", "Indiranagar", "Koramangala", "Marathahalli", "HSR Layout", "Bellandur", "Jayanagar"],
    "Mysore": ["Jayanagar", "Vijayanagar", "Gokulam"],
    "Mangalore": ["Balmata", "Bendoor"],
    "Pune": ["Baner", "Kothrud"],
    "Hubli": ["Hubli City"],
  },
  "Telangana": {
    "Hyderabad": ["Hitech City", "Banjara Hills", "Jubilee Hills", "Madhapur", "Kukatpally", "Miyapur"],
    "Secunderabad": ["Secunderabad Cantonment"],
    "Warangal": ["Warangal City"],
  },
  "Andhra Pradesh": {
    "Visakhapatnam": ["Visakhapatnam City", "Gajuwaka"],
    "Vijayawada": ["Vijayawada City"],
    "Tirupati": ["Tirupati City"],
  },
  "Maharashtra": {
    "Mumbai": ["Fort", "Bandra", "Andheri", "Powai", "Thane", "Borivali"],
    "Pune": ["Baner", "Koregaon Park", "Hadapsar"],
    "Nagpur": ["Nagpur City"],
    "Ahmedabad": ["Ahmedabad City"],
  },
  "Gujarat": {
    "Ahmedabad": ["Vastrapur", "Navrangpura", "Ambawadi"],
    "Surat": ["Surat City"],
    "Vadodara": ["Vadodara City"],
  },
  "Rajasthan": {
    "Jaipur": ["C Scheme", "Malviya Nagar", "Bani Park"],
    "Udaipur": ["Udaipur City"],
    "Jodhpur": ["Jodhpur City"],
  },
  "Delhi": {
    "New Delhi": ["Connaught Place", "Dwarka", "Rohini", "Noida", "Gurgaon"],
    "Delhi": ["Delhi City"],
  },
  "Haryana": {
    "Gurgaon": ["Gurgaon City", "Sector 31"],
    "Noida": ["Noida City"],
  },
  "Uttar Pradesh": {
    "Lucknow": ["Lucknow City"],
    "Kanpur": ["Kanpur City"],
    "Agra": ["Agra City"],
  },
  "West Bengal": {
    "Kolkata": ["Kolkata City", "Salt Lake"],
    "Darjeeling": ["Darjeeling City"],
  },
  "Odisha": {
    "Bhubaneswar": ["Bhubaneswar City"],
    "Cuttack": ["Cuttack City"],
  },
  "Kerala": {
    "Kochi": ["Kochi City", "Fort Kochi"],
    "Thiruvananthapuram": ["Thiruvananthapuram City"],
    "Calicut": ["Calicut City"],
  },
  "Bihar": {
    "Patna": ["Patna City"],
  },
  "Jharkhand": {
    "Ranchi": ["Ranchi City"],
    "Jamshedpur": ["Jamshedpur City"],
  },
  "Chhattisgarh": {
    "Raipur": ["Raipur City"],
    "Bhilai": ["Bhilai City"],
  },
  "Madhya Pradesh": {
    "Indore": ["Indore City"],
    "Bhopal": ["Bhopal City"],
  },
  }, // end India
};

export const getCountriesWithLocalData = (): string[] => {
  return Object.keys(locationData).sort();
};

export const getAllStates = (country: string = "India"): string[] => {
  return Object.keys(locationData[country] || {}).sort();
};

export const getDistrictsByState = (country: string = "India", state: string): string[] => {
  return Object.keys(locationData[country]?.[state] || {}).sort();
};

export const getCitiesByDistrict = (country: string = "India", state: string, district: string): string[] => {
  return locationData[country]?.[state]?.[district] || [];
};
