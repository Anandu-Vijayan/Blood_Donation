export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

export const BLOOD_GROUPS: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export type UserRole = 'donor' | 'recipient';

export type RequestStatus = 'open' | 'matched' | 'fulfilled' | 'unfulfilled';

export type UrgencyLevel = 'critical' | 'urgent' | 'normal';

export type RequirementType = 'specific' | 'standby' | 'replacement';

export const URGENCY_SCORES: Record<UrgencyLevel, number> = {
  critical: 100,
  urgent: 60,
  normal: 20,
};

export const COOLDOWN_DAYS = 90;
export const MATCH_CANCEL_WINDOW_MINUTES = 30;

export const NOTIFICATION_TIERS = [
  { radiusKm: 5,   delayMinutes: 0   },
  { radiusKm: 15,  delayMinutes: 15  },
  { radiusKm: 50,  delayMinutes: 60  },
  { radiusKm: 9999, delayMinutes: 180 }, // region-wide
] as const;

export interface KeralaHospital {
  name: string;
  city: string;
  district: string;
  latitude: number;
  longitude: number;
}

export const KERALA_HOSPITALS: KeralaHospital[] = [
  // Thiruvananthapuram (Lat: 8.5241, Lng: 76.9366)
  { name: 'Government Medical College, Thiruvananthapuram', city: 'Thiruvananthapuram', district: 'Thiruvananthapuram', latitude: 8.5241, longitude: 76.9366 },
  { name: 'KIMSHEALTH', city: 'Thiruvananthapuram', district: 'Thiruvananthapuram', latitude: 8.5301, longitude: 76.9242 },
  { name: 'Ananthapuri Hospitals & Research Institute', city: 'Thiruvananthapuram', district: 'Thiruvananthapuram', latitude: 8.4833, longitude: 76.9500 },
  { name: 'SUT Hospital', city: 'Thiruvananthapuram', district: 'Thiruvananthapuram', latitude: 8.5280, longitude: 76.9400 },
  { name: 'Sree Chitra Tirunal Institute for Medical Sciences (SCTIMST)', city: 'Thiruvananthapuram', district: 'Thiruvananthapuram', latitude: 8.5244, longitude: 76.9355 },
  { name: 'Cosmopolitan Hospital', city: 'Thiruvananthapuram', district: 'Thiruvananthapuram', latitude: 8.5190, longitude: 76.9380 },
  { name: 'NIMS Medicity', city: 'Thiruvananthapuram', district: 'Thiruvananthapuram', latitude: 8.3667, longitude: 77.0667 },
  { name: 'SK Hospital', city: 'Thiruvananthapuram', district: 'Thiruvananthapuram', latitude: 8.4980, longitude: 76.9600 },
  { name: 'PRS Hospital', city: 'Thiruvananthapuram', district: 'Thiruvananthapuram', latitude: 8.4860, longitude: 76.9530 },
  { name: 'General Hospital, Thiruvananthapuram', city: 'Thiruvananthapuram', district: 'Thiruvananthapuram', latitude: 8.5020, longitude: 76.9370 },

  // Look up district locations to give very accurate locations for all other areas:
  // Kollam (Lat: 8.8932, Lng: 76.6141)
  { name: 'Government Medical College, Kollam (Parippally)', city: 'Parippally', district: 'Kollam', latitude: 8.8105, longitude: 76.7621 },
  { name: 'Bishop Benziger Hospital', city: 'Kollam', district: 'Kollam', latitude: 8.8920, longitude: 76.5920 },
  { name: 'Holy Cross Hospital', city: 'Kollam', district: 'Kollam', latitude: 8.9100, longitude: 76.6140 },
  { name: 'Travancore Medicity', city: 'Kollam', district: 'Kollam', latitude: 8.8890, longitude: 76.6340 },
  { name: 'Upasana Hospital', city: 'Kollam', district: 'Kollam', latitude: 8.8950, longitude: 76.6020 },

  // Pathanamthitta (Lat: 9.2648, Lng: 76.7870)
  { name: 'Pushpagiri Medical College Hospital', city: 'Thiruvalla', district: 'Pathanamthitta', latitude: 9.3852, longitude: 76.5772 },
  { name: 'Believers Church Medical College Hospital', city: 'Thiruvalla', district: 'Pathanamthitta', latitude: 9.3891, longitude: 76.6013 },
  { name: 'Mar Sleeva Medicity', city: 'Cherpunkal', district: 'Pathanamthitta', latitude: 9.6934, longitude: 76.5901 },
  { name: 'St Gregorios Medical Mission Hospital', city: 'Parumala', district: 'Pathanamthitta', latitude: 9.3400, longitude: 76.5400 },

  // Alappuzha (Lat: 9.4981, Lng: 76.3388)
  { name: 'Government T.D. Medical College, Alappuzha', city: 'Alappuzha', district: 'Alappuzha', latitude: 9.4035, longitude: 76.3503 },
  { name: 'Vandanam Medical College', city: 'Vandanam', district: 'Alappuzha', latitude: 9.4040, longitude: 76.3500 },

  // Kottayam (Lat: 9.5916, Lng: 76.5222)
  { name: 'Government Medical College, Kottayam', city: 'Kottayam', district: 'Kottayam', latitude: 9.6241, longitude: 76.5367 },
  { name: 'Caritas Hospital', city: 'Kottayam', district: 'Kottayam', latitude: 9.6380, longitude: 76.5300 },
  { name: 'Bharath Hospital', city: 'Kottayam', district: 'Kottayam', latitude: 9.5880, longitude: 76.5260 },
  { name: 'Mar Sleeva Medicity Palai', city: 'Palai', district: 'Kottayam', latitude: 9.7120, longitude: 76.6850 },

  // Idukki (Lat: 9.8500, Lng: 76.9667)
  { name: 'Government Medical College, Idukki', city: 'Idukki', district: 'Idukki', latitude: 9.8500, longitude: 76.9667 },
  { name: 'Holy Family Hospital, Muttom', city: 'Muttom', district: 'Idukki', latitude: 9.8732, longitude: 76.7329 },

  // Ernakulam (Kochi) (Lat: 9.9312, Lng: 76.2673)
  { name: 'Government Medical College, Ernakulam', city: 'Kochi', district: 'Ernakulam', latitude: 10.0560, longitude: 76.3540 },
  { name: 'Amrita Institute of Medical Sciences (AIMS)', city: 'Kochi', district: 'Ernakulam', latitude: 10.0336, longitude: 76.2922 },
  { name: 'Aster Medcity', city: 'Kochi', district: 'Ernakulam', latitude: 10.0630, longitude: 76.2730 },
  { name: 'VPS Lakeshore Hospital', city: 'Kochi', district: 'Ernakulam', latitude: 9.9230, longitude: 76.3090 },
  { name: 'Lourdes Hospital', city: 'Kochi', district: 'Ernakulam', latitude: 9.9960, longitude: 76.2800 },
  { name: 'Lisie Hospital', city: 'Kochi', district: 'Ernakulam', latitude: 9.9870, longitude: 76.2920 },
  { name: 'Specialists Hospital', city: 'Kochi', district: 'Ernakulam', latitude: 9.9830, longitude: 76.2890 },
  { name: 'Renai Medicity', city: 'Kochi', district: 'Ernakulam', latitude: 10.0120, longitude: 76.3110 },
  { name: 'Medical Trust Hospital', city: 'Kochi', district: 'Ernakulam', latitude: 9.9630, longitude: 76.2860 },
  { name: 'Rajagiri Hospital', city: 'Aluva', district: 'Ernakulam', latitude: 10.1220, longitude: 76.3560 },
  { name: 'Sunrise Hospital', city: 'Kochi', district: 'Ernakulam', latitude: 10.0090, longitude: 76.3260 },
  { name: 'PVS Memorial Hospital', city: 'Kochi', district: 'Ernakulam', latitude: 9.9940, longitude: 76.2940 },
  { name: 'General Hospital, Ernakulam', city: 'Kochi', district: 'Ernakulam', latitude: 9.9770, longitude: 76.2800 },

  // Thrissur (Lat: 10.5276, Lng: 76.2144)
  { name: 'Government Medical College, Thrissur', city: 'Thrissur', district: 'Thrissur', latitude: 10.6186, longitude: 76.2081 },
  { name: 'Jubilee Mission Medical College', city: 'Thrissur', district: 'Thrissur', latitude: 10.5238, longitude: 76.2294 },
  { name: 'Amala Institute of Medical Sciences', city: 'Thrissur', district: 'Thrissur', latitude: 10.5600, longitude: 76.1830 },
  { name: 'West Fort Hospital', city: 'Thrissur', district: 'Thrissur', latitude: 10.5230, longitude: 76.2020 },
  { name: 'Aswini Hospital', city: 'Thrissur', district: 'Thrissur', latitude: 10.5340, longitude: 76.2190 },
  { name: 'Daya General Hospital', city: 'Thrissur', district: 'Thrissur', latitude: 10.5480, longitude: 76.2420 },
  { name: 'Mother Hospital', city: 'Thrissur', district: 'Thrissur', latitude: 10.5050, longitude: 76.1880 },

  // Palakkad (Lat: 10.7867, Lng: 76.6547)
  { name: 'District Hospital, Palakkad', city: 'Palakkad', district: 'Palakkad', latitude: 10.7760, longitude: 76.6490 },
  { name: 'Karuna Medical College Hospital', city: 'Vilayodi', district: 'Palakkad', latitude: 10.6730, longitude: 76.7110 },
  { name: 'Welcare Hospital', city: 'Palakkad', district: 'Palakkad', latitude: 10.7810, longitude: 76.6580 },

  // Malappuram (Lat: 11.0735, Lng: 76.0740)
  { name: 'Government Medical College, Manjeri', city: 'Manjeri', district: 'Malappuram', latitude: 11.1213, longitude: 76.1212 },
  { name: 'Aster MIMS, Manjeri', city: 'Manjeri', district: 'Malappuram', latitude: 11.1180, longitude: 76.1260 },
  { name: 'Al Shifa Hospital', city: 'Perinthalmanna', district: 'Malappuram', latitude: 10.9780, longitude: 76.2230 },
  { name: 'Almas Hospital', city: 'Kottakkal', district: 'Malappuram', latitude: 11.0020, longitude: 76.0040 },
  { name: 'Government District Hospital, Tirur', city: 'Tirur', district: 'Malappuram', latitude: 10.9120, longitude: 75.9240 },

  // Kozhikode (Lat: 11.2588, Lng: 75.7804)
  { name: 'Government Medical College, Kozhikode', city: 'Kozhikode', district: 'Kozhikode', latitude: 11.2721, longitude: 75.8364 },
  { name: 'Aster MIMS, Kozhikode', city: 'Kozhikode', district: 'Kozhikode', latitude: 11.2582, longitude: 75.8010 },
  { name: 'Baby Memorial Hospital', city: 'Kozhikode', district: 'Kozhikode', latitude: 11.2612, longitude: 75.7924 },
  { name: 'KMCT Medical College', city: 'Mukkam', district: 'Kozhikode', latitude: 11.3120, longitude: 75.9860 },
  { name: 'Iqraa International Hospital', city: 'Kozhikode', district: 'Kozhikode', latitude: 11.2780, longitude: 75.7980 },
  { name: 'Starcare Hospital', city: 'Kozhikode', district: 'Kozhikode', latitude: 11.2500, longitude: 75.7800 },
  { name: 'PVS Hospital', city: 'Kozhikode', district: 'Kozhikode', latitude: 11.2640, longitude: 75.7860 },
  { name: 'Meitra Hospital', city: 'Kozhikode', district: 'Kozhikode', latitude: 11.3020, longitude: 75.7880 },
  { name: 'National Hospital', city: 'Kozhikode', district: 'Kozhikode', latitude: 11.2560, longitude: 75.7880 },

  // Wayanad (Lat: 11.6854, Lng: 76.1320)
  { name: 'Government Medical College, Wayanad', city: 'Mananthavady', district: 'Wayanad', latitude: 11.8020, longitude: 76.0120 },
  { name: 'DM WIMS', city: 'Meppadi', district: 'Wayanad', latitude: 11.5540, longitude: 76.1420 },

  // Kannur (Lat: 11.8745, Lng: 75.3704)
  { name: 'Government Medical College, Pariyaram (Kannur)', city: 'Pariyaram', district: 'Kannur', latitude: 12.0734, longitude: 75.2954 },
  { name: 'Aster MIMS, Kannur', city: 'Kannur', district: 'Kannur', latitude: 11.8840, longitude: 75.3640 },
  { name: 'AKG Memorial Hospital', city: 'Kannur', district: 'Kannur', latitude: 11.8720, longitude: 75.3740 },
  { name: 'Indiana Hospital', city: 'Kannur', district: 'Kannur', latitude: 11.8780, longitude: 75.3720 },
  { name: 'Koyili Hospital', city: 'Kannur', district: 'Kannur', latitude: 11.8700, longitude: 75.3800 },

  // Kasaragod (Lat: 12.5103, Lng: 74.9852)
  { name: 'Government District Hospital, Kasaragod', city: 'Kasaragod', district: 'Kasaragod', latitude: 12.5020, longitude: 74.9960 },
  { name: 'General Hospital, Kanhangad', city: 'Kanhangad', district: 'Kasaragod', latitude: 12.3120, longitude: 75.0880 },
];

export const MAJOR_INDIAN_HOSPITALS: KeralaHospital[] = [
  // New Delhi / NCR
  { name: 'All India Institute of Medical Sciences (AIIMS), New Delhi', city: 'New Delhi', district: 'Delhi', latitude: 28.5672, longitude: 77.2100 },
  { name: 'Indraprastha Apollo Hospital, New Delhi', city: 'New Delhi', district: 'Delhi', latitude: 28.5411, longitude: 77.2833 },
  { name: 'Sir Ganga Ram Hospital, New Delhi', city: 'New Delhi', district: 'Delhi', latitude: 28.6384, longitude: 77.1896 },
  { name: 'Safdarjung Hospital, New Delhi', city: 'New Delhi', district: 'Delhi', latitude: 28.5694, longitude: 77.2081 },
  { name: 'Medanta - The Medicity, Gurugram', city: 'Gurugram', district: 'Haryana', latitude: 28.4282, longitude: 77.0422 },
  { name: 'Fortis Memorial Research Institute, Gurugram', city: 'Gurugram', district: 'Haryana', latitude: 28.4593, longitude: 77.0724 },
  { name: 'Max Super Speciality Hospital, Saket, New Delhi', city: 'New Delhi', district: 'Delhi', latitude: 28.5284, longitude: 77.2108 },

  // Mumbai, Maharashtra
  { name: 'Tata Memorial Hospital, Mumbai', city: 'Mumbai', district: 'Maharashtra', latitude: 19.0028, longitude: 72.8427 },
  { name: 'Kokilaben Dhirubhai Ambani Hospital, Mumbai', city: 'Mumbai', district: 'Maharashtra', latitude: 19.1312, longitude: 72.8252 },
  { name: 'King Edward Memorial (KEM) Hospital, Mumbai', city: 'Mumbai', district: 'Maharashtra', latitude: 19.0022, longitude: 72.8420 },
  { name: 'P. D. Hinduja National Hospital, Mumbai', city: 'Mumbai', district: 'Maharashtra', latitude: 19.0322, longitude: 72.8385 },

  // Bengaluru, Karnataka
  { name: 'NIMHANS, Bengaluru', city: 'Bengaluru', district: 'Karnataka', latitude: 12.9427, longitude: 77.5991 },
  { name: 'Fortis Hospital, Bannerghatta Road, Bengaluru', city: 'Bengaluru', district: 'Karnataka', latitude: 12.8954, longitude: 77.5977 },
  { name: 'St. John\'s Medical College Hospital, Bengaluru', city: 'Bengaluru', district: 'Karnataka', latitude: 12.9333, longitude: 77.6244 },
  { name: 'Manipal Hospital, Old Airport Road, Bengaluru', city: 'Bengaluru', district: 'Karnataka', latitude: 12.9575, longitude: 77.6481 },

  // Chennai, Tamil Nadu
  { name: 'Apollo Hospitals, Greams Road, Chennai', city: 'Chennai', district: 'Tamil Nadu', latitude: 13.0605, longitude: 80.2520 },
  { name: 'Madras Medical College (MMC), Chennai', city: 'Chennai', district: 'Tamil Nadu', latitude: 13.0818, longitude: 80.2758 },
  { name: 'Fortis Malar Hospital, Chennai', city: 'Chennai', district: 'Tamil Nadu', latitude: 13.0076, longitude: 80.2562 },

  // Kolkata, West Bengal
  { name: 'IPGMER & SSKM Hospital, Kolkata', city: 'Kolkata', district: 'West Bengal', latitude: 22.5401, longitude: 88.3444 },
  { name: 'Apollo Multispeciality Hospitals, Kolkata', city: 'Kolkata', district: 'West Bengal', latitude: 22.5732, longitude: 88.4067 },
  { name: 'Fortis Hospital, Anandapur, Kolkata', city: 'Kolkata', district: 'West Bengal', latitude: 22.5164, longitude: 88.4014 },

  // Hyderabad, Telangana
  { name: 'Nizam\'s Institute of Medical Sciences (NIMS), Hyderabad', city: 'Hyderabad', district: 'Telangana', latitude: 17.4225, longitude: 78.4552 },
  { name: 'Apollo Hospitals, Jubilee Hills, Hyderabad', city: 'Hyderabad', district: 'Telangana', latitude: 17.4244, longitude: 78.4116 },
  { name: 'Yashoda Hospitals, Secunderabad, Hyderabad', city: 'Hyderabad', district: 'Telangana', latitude: 17.4395, longitude: 78.4907 },

  // Pune, Maharashtra
  { name: 'Ruby Hall Clinic, Pune', city: 'Pune', district: 'Maharashtra', latitude: 18.5309, longitude: 73.8760 },
  { name: 'Jehangir Hospital, Pune', city: 'Pune', district: 'Maharashtra', latitude: 18.5302, longitude: 73.8770 },

  // Vellore, Tamil Nadu
  { name: 'Christian Medical College (CMC), Vellore', city: 'Vellore', district: 'Tamil Nadu', latitude: 12.9248, longitude: 79.1345 },
];

