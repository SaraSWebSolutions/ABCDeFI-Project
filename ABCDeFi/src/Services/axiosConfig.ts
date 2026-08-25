import axios from "axios";

const BASE_URL = '/api';
const API_TIMEOUT = 30000;

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: Number(API_TIMEOUT), // ⚠️ ensure it's a number
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  async (config) => {
    const token = localStorage.getItem("abcdefi_jwt");

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    //  AUTO HANDLE FORM DATA
    if (config.data instanceof FormData) {
      config.headers["Content-Type"] = "multipart/form-data";
    } else {
      config.headers["Content-Type"] = "application/json";
    }

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      console.error("API request failed", { status: error.response.status });
    } else if (error.request) {
      // Request sent but no response
      console.error("API request received no response");
    } else {
      // Something else
      console.error("API request setup failed", { message: error.message });
    }

    return Promise.reject(error);
  }
);
