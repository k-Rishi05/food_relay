import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

// Use 10.0.2.2 for Android Emulator, or localhost for iOS simulator
export const baseUrl =
  Platform.OS === "android"
    ? "http://10.0.2.2:3000/api"
    : "http://localhost:3000/api";

// Token Storage
let memoryToken = null; // Fallback if SecureStore fails

export const setToken = async (token) => {
  if (Platform.OS === "web") {
    localStorage.setItem("jwt_token", token);
  } else {
    try {
      await SecureStore.setItemAsync("jwt_token", token);
    } catch (e) {
      console.log("SecureStore unavailable, using memory token", e);
      memoryToken = token;
    }
  }
};

export const getToken = async () => {
  if (Platform.OS === "web") {
    return localStorage.getItem("jwt_token");
  } else {
    try {
      return await SecureStore.getItemAsync("jwt_token");
    } catch (e) {
      return memoryToken;
    }
  }
};

export const clearToken = async () => {
  if (Platform.OS === "web") {
    localStorage.removeItem("jwt_token");
  } else {
    try {
      await SecureStore.deleteItemAsync("jwt_token");
    } catch (e) {
      memoryToken = null;
    }
  }
};

const getAuthHeaders = async (baseHeaders = {}) => {
  const token = await getToken();
  return token
    ? { ...baseHeaders, Authorization: `Bearer ${token}` }
    : baseHeaders;
};

// API Methods
export const fetchPendingOrders = async () => {
  const headers = await getAuthHeaders();
  const res = await fetch(`${baseUrl}/orders/pending`, { headers });
  if (!res.ok) throw new Error("Failed to load pending orders");
  return res.json();
};

export const acceptOrder = async (orderId) => {
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const res = await fetch(`${baseUrl}/orders/${orderId}/accept`, {
    method: "PATCH",
    headers,
  });
  if (!res.ok) throw new Error("Failed to accept order");
  return res.json();
};

export const createOrder = async ({
  type,
  locationUrl,
  description,
  imageUri,
}) => {
  const mimeType = "image/jpeg";
  const headers = await getAuthHeaders({ "Content-Type": "application/json" });
  const authHeadersOnly = await getAuthHeaders();

  // 1. Get pre-signed URL
  const urlRes = await fetch(`${baseUrl}/upload-url?contentType=${mimeType}`, {
    headers: authHeadersOnly,
  });
  if (!urlRes.ok) throw new Error("Failed to get upload URL");
  const { uploadUrl, publicUrl } = await urlRes.json();

  // 2. Fetch binary data
  const imageBlob = await fetch(imageUri).then((r) => r.blob());

  // 3. Upload to R2 directly (unauthenticated direct to Cloudflare R2 presigned URL)
  const uploadRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": mimeType },
    body: imageBlob,
  });

  if (!uploadRes.ok) throw new Error("Failed to upload image to R2");

  // 4. Create the order
  const createRes = await fetch(`${baseUrl}/orders`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      type,
      location_url: locationUrl,
      item_description: description,
      image_url: publicUrl,
    }),
  });

  if (!createRes.ok) throw new Error("Failed to create order");
  return createRes.json();
};
