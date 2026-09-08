import axios from "axios";
import { BASE_URL, API_TIMEOUT } from "@/src/env";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: Number(API_TIMEOUT), // ⚠️ ensure it's a number
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem("token");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    //  AUTO HANDLE FORM DATA
    if (config.data instanceof FormData) {
      config.headers["Content-Type"] = "multipart/form-data";
    } else {
      config.headers["Content-Type"] = "application/json";
    }
const fullUrl = `${config.baseURL}${config.url}`;

    console.log("🚀 API Request:", fullUrl);
    console.log("👉 token:", token);
    console.log("👉 Body:", config.data);

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Server responded with error
      console.log("❌ Status:", error.response.status);
      console.log("❌ Data:", error.response.data);
    } else if (error.request) {
      // Request sent but no response
      console.log("❌ No response received");
      console.log("❌ Request:", error.request);
    } else {
      // Something else
      console.log("❌ Error Message:", error.message);
    }

    console.log("❌ Full Error:", error);

    return Promise.reject(error);
  }
);