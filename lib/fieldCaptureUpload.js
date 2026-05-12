import { supabase } from "./supabase";

const BUCKET = "field-captures";

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Uploads a JPEG (base64, no data-URL prefix) to Supabase Storage.
 * @param {string} base64
 * @returns {Promise<string | null>} Public URL or null on failure
 */
export async function uploadFieldCaptureJpeg(base64) {
  if (!base64 || typeof base64 !== "string") return null;
  try {
    const bytes = base64ToUint8Array(base64);
    const path = `captures/${Date.now()}-${Math.random().toString(36).slice(2, 12)}.jpg`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
      contentType: "image/jpeg",
      upsert: false,
    });
    if (error) {
      console.warn("[fieldCaptureUpload]", error.message);
      return null;
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data?.publicUrl ?? null;
  } catch (e) {
    console.warn("[fieldCaptureUpload]", e);
    return null;
  }
}
