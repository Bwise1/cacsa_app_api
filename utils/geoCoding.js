const fetch = require("node-fetch");
require("dotenv").config();

async function geocodeAddress(address) {
  const apiKey = process.env.GOOGLE_MAP_API_KEY;
  const baseUrl = "https://maps.googleapis.com/maps/api/geocode/json";
  const formattedAddress = encodeURIComponent(address);

  const response = await fetch(
    `${baseUrl}?address=${formattedAddress}&key=${apiKey}`
  );
  const data = await response.json();

  if (data.status === "OK" && data.results.length > 0) {
    const location = data.results[0].geometry.location;
    return {
      latitude: location.lat,
      longitude: location.lng,
    };
  } else {
    return {
      latitude: 7.73726,
      longitude: 4.58782,
    };

    // throw new Error("Unable to geocode address");
  }
}

module.exports = geocodeAddress;
