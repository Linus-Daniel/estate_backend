const NodeGeocoder = require("node-geocoder");
const ErrorResponse = require("./errorResponse");


const apiKey = process.env.GEOCODER_API_KEY
console.log(apiKey,"my api key")

// Initialize geocoder with fallback options
const getGeocoder = () => {
  try {
    const options = {
      provider: process.env.GEOCODER_PROVIDER || "opencage",
      httpAdapter: "https",
      apiKey: process.env.GEOCODER_API_KEY ||"01c73fdd45a54bd1b7be159794c4a2a0",
      formatter: null
    };

    if (!options.apiKey) {
      throw new Error("Geocoder API key is required");
    }

    return NodeGeocoder(options);
  } catch (err) {
    console.error("Geocoder initialization failed:", err.message);
    return {
      geocode: async () => { throw new Error("Geocoder not configured") },
      reverse: async () => { throw new Error("Geocoder not configured") }
    };
  }
};

const geocoder = getGeocoder();

// Geocoding function
exports.geocode = async (address) => {
  try {
    const geoData = await geocoder.geocode(address);

    if (!geoData || geoData.length === 0) {
      throw new ErrorResponse(`No location found for ${address}`, 404);
    }

    return {
      latitude: geoData[0].latitude,
      longitude: geoData[0].longitude,
      formattedAddress: geoData[0].formattedAddress,
      street: geoData[0].streetName,
      city: geoData[0].city,
      state: geoData[0].state,
      zipcode: geoData[0].zipcode,
      country: geoData[0].countryCode,
    };
  } catch (err) {
    throw new ErrorResponse(`Geocoding error: ${err.message}`, 500);
  }
};

// Reverse geocoding function
exports.reverseGeocode = async (lat, lng) => {
  try {
    const geoData = await geocoder.reverse({ lat, lon: lng });

    if (!geoData || geoData.length === 0) {
      throw new ErrorResponse(
        `No address found for coordinates ${lat},${lng}`,
        404
      );
    }

    return {
      formattedAddress: geoData[0].formattedAddress,
      street: geoData[0].streetName,
      city: geoData[0].city,
      state: geoData[0].state,
      zipcode: geoData[0].zipcode,
      country: geoData[0].countryCode,
    };
  } catch (err) {
    throw new ErrorResponse(`Reverse geocoding error: ${err.message}`, 500);
  }
};
