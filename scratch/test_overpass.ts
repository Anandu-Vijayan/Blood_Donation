import fetch from 'node-fetch';

async function testOSM() {
  console.log("Searching for 'Aster MIMS' in Kerala bounding box...");
  const escapedQuery = "Aster MIMS";
  
  const query = `[out:json][timeout:15][bbox:8.15,74.85,12.85,77.55];
(
  node["amenity"="hospital"]["name"~"${escapedQuery}",i];
  way["amenity"="hospital"]["name"~"${escapedQuery}",i];
  node["healthcare"="hospital"]["name"~"${escapedQuery}",i];
  way["healthcare"="hospital"]["name"~"${escapedQuery}",i];
);
out body center 30;`;

  const OVERPASS_MIRRORS = [
    'https://lz4.overpass-api.de/api/interpreter',
    'https://z.overpass-api.de/api/interpreter',
    'https://overpass.openstreetmap.fr/api/interpreter',
  ];

  for (const mirror of OVERPASS_MIRRORS) {
    try {
      console.log(`Trying mirror: ${mirror}`);
      const url = mirror + '?data=' + encodeURIComponent(query);
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'BloodLinkApp/1.0 (contact@bloodlink.org; mobile-app-development)',
          'Accept': '*/*'
        }
      });
      
      if (!res.ok) {
        console.warn(`Mirror ${mirror} failed with status: ${res.status}`);
        continue;
      }

      const data: any = await res.json();
      console.log(`Success! Fetched ${data.elements?.length} elements from ${mirror}`);
      if (data.elements && data.elements.length > 0) {
        data.elements.forEach((el: any) => {
          console.log(`- Type: ${el.type}, ID: ${el.id}, Name: ${el.tags?.name}, Lat: ${el.lat || el.center?.lat}, Lon: ${el.lon || el.center?.lon}`);
        });
        return;
      }
    } catch (err) {
      console.error(`Error with mirror ${mirror}:`, err);
    }
  }
  console.error("All mirrors failed!");
}

testOSM();
