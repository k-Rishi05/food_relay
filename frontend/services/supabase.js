import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

// IMPORTANT: Replace with your actual Supabase project credentials in your actual code or environment variables!
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "YOUR_SUPABASE_URL";
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "YOUR_SUPABASE_ANON_KEY";

// SSR-safe storage adapter prevents crashing on Web when `window` is undefined
const ssrSafeStorage = {
  getItem: async (key) => {
    if (Platform.OS === "web" && typeof window === "undefined") return null;
    return await AsyncStorage.getItem(key);
  },
  setItem: async (key, value) => {
    if (Platform.OS === "web" && typeof window === "undefined") return;
    await AsyncStorage.setItem(key, value);
  },
  removeItem: async (key) => {
    if (Platform.OS === "web" && typeof window === "undefined") return;
    await AsyncStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ssrSafeStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
