import axios from "axios";
import { API_BASE } from "../constants/Theme.jsx";
import keycloak from "./keycloak.js";

const api = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use(async (config) => {
  if (keycloak.authenticated) {
    try {
      await keycloak.updateToken(30);
    } catch (e) {
      keycloak.login();
      return Promise.reject(e);
    }
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${keycloak.token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response && err.response.status === 401) {
      keycloak.login();
    }
    return Promise.reject(err);
  }
);

export default api;
