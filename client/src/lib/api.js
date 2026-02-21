import axios from "axios";

// Create axios instance
const api = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

// Auth API
export const authAPI = {
  login: (credentials) => api.post("/auth/login", credentials),
  logout: () => api.post("/auth/logout"),
};

// Timetable API
export const timetableAPI = {
  get: (params) => api.get("/timetable", { params }),
  create: (data) => api.post("/timetable", data),
  end: (timeSlotId, data) => api.put(`/timetable/${timeSlotId}/end`, data),
};

// Students API
export const studentsAPI = {
  list: (params) => api.get("/students", { params }),
  create: (data) => api.post("/students", data),
  update: (id, data) => api.put(`/students/${id}`, data),
  delete: (id) => api.delete(`/students/${id}`),
  getAttendance: (studentId, params) =>
    api.get(`/students/${studentId}/attendance`, { params }),
};

// Attendance API
export const attendanceAPI = {
  recordClass: (data) => api.post("/attendance/record-class", data),
  getSummary: (params) => api.get("/attendance/summary", { params }),
};

// Batches API
export const batchesAPI = {
  list: (params) => api.get("/batches", { params }),
  create: (data) => api.post("/batches", data),
  update: (id, data) => api.put(`/batches/${id}`, data),
  delete: (id) => api.delete(`/batches/${id}`),
};

// Subjects API
export const subjectsAPI = {
  list: (params) => api.get("/subjects", { params }),
  create: (data) => api.post("/subjects", data),
  update: (id, data) => api.put(`/subjects/${id}`, data),
  delete: (id) => api.delete(`/subjects/${id}`),
};

// Classes API
export const classesAPI = {
  list: (params) => api.get("/classes", { params }),
  create: (data) => api.post("/classes", data),
  update: (id, data) => api.put(`/classes/${id}`, data),
  delete: (id) => api.delete(`/classes/${id}`),
};

// Users API
export const usersAPI = {
  list: (params) => api.get("/users", { params }),
  create: (data) => api.post("/users", data),
  update: (id, data) => api.put(`/users/${id}`, data),
  delete: (id) => api.delete(`/users/${id}`),
};

export default api;
