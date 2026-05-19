import * as Location from "expo-location";
import { SURVEY_LATITUDE, SURVEY_LONGITUDE } from "./surveyLocation";

/**
 * Request foreground location permission and return current WGS84 coordinates.
 * Falls back to survey reference point when GPS is unavailable (web preview, denied).
 */
export async function getCaptureCoordinates() {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      return {
        latitude: SURVEY_LATITUDE,
        longitude: SURVEY_LONGITUDE,
        source: "survey_fallback",
        accuracyMeters: null,
      };
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    const lat = position?.coords?.latitude;
    const lon = position?.coords?.longitude;
    if (typeof lat === "number" && typeof lon === "number" && !Number.isNaN(lat) && !Number.isNaN(lon)) {
      return {
        latitude: lat,
        longitude: lon,
        source: "gps",
        accuracyMeters:
          typeof position.coords.accuracy === "number"
            ? position.coords.accuracy
            : null,
      };
    }
  } catch (e) {
    console.warn("[deviceLocation]", e?.message ?? e);
  }

  return {
    latitude: SURVEY_LATITUDE,
    longitude: SURVEY_LONGITUDE,
    source: "survey_fallback",
    accuracyMeters: null,
  };
}
