const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";
const SESSION_KEY = "hmis_active_session";
const ROLE_OPTIONS = ["Doctor", "Nurse", "Administrator"];

function readSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function getToken() {
  return readSession()?.token || null;
}

async function apiRequest(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  if (options.auth !== false && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { detail: text };
    }
  }

  if (!response.ok) {
    const detail = payload?.detail || "Request failed";
    throw new Error(detail);
  }

  return payload;
}

function toUserModel(apiUser) {
  return {
    id: apiUser.id,
    name: apiUser.full_name,
    email: apiUser.email,
    role: apiUser.role
  };
}

export function getRoleOptions() {
  return [...ROLE_OPTIONS];
}

export function getSessionUser() {
  const session = readSession();
  return session?.user || null;
}

export function clearSessionUser() {
  localStorage.removeItem(SESSION_KEY);
}

export async function registerUser(payload) {
  try {
    await apiRequest("/auth/signup", {
      method: "POST",
      auth: false,
      body: {
        full_name: payload.name.trim(),
        email: payload.email.trim().toLowerCase(),
        password: payload.password,
        role: payload.role
      }
    });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function loginUser(payload) {
  try {
    const data = await apiRequest("/auth/signin", {
      method: "POST",
      auth: false,
      body: {
        email: payload.email.trim().toLowerCase(),
        password: payload.password
      }
    });

    const session = {
      token: data.token,
      user: toUserModel(data.user)
    };
    saveSession(session);
    return { ok: true, user: session.user };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

export async function logoutUser() {
  try {
    await apiRequest("/auth/logout", { method: "POST" });
  } catch {
    // Ignore if token already expired.
  }
  clearSessionUser();
}

export function subscribeDoctorAppointments(user, onChange) {
  let stopped = false;

  async function poll() {
    if (stopped) {
      return;
    }
    try {
      const data = await apiRequest("/appointments/today");
      const mapped = data.map((item) => ({
        id: item.id,
        patientId: item.patient_id,
        doctorId: item.doctor_id,
        appointmentDate: item.appointmentDate,
        appointmentTime: item.appointmentTime,
        status: item.status,
        patient: item.patient
      }));
      onChange(mapped);
    } catch {
      onChange([]);
    }
  }

  poll();
  const intervalId = setInterval(poll, 4000);
  return () => {
    stopped = true;
    clearInterval(intervalId);
  };
}

export async function getPatientRecord(patientId) {
  return apiRequest(`/patients/${patientId}/record`);
}

export async function updatePatientRecord(patientId, payload) {
  return apiRequest(`/patients/${patientId}/record`, {
    method: "PUT",
    body: payload
  });
}

export async function addVitals(patientId, payload) {
  return apiRequest(`/patients/${patientId}/vitals`, {
    method: "POST",
    body: payload
  });
}

export async function getPatients(search = "") {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  return apiRequest(`/patients${query}`);
}

export async function getDoctors() {
  return apiRequest("/users/doctors");
}

export async function createPatient(payload) {
  return apiRequest("/patients", {
    method: "POST",
    body: payload
  });
}

export async function updatePatient(patientId, payload) {
  return apiRequest(`/patients/${patientId}`, {
    method: "PUT",
    body: payload
  });
}

export async function getNurseSnapshot() {
  return apiRequest("/dashboard/nurse");
}

export async function getAdminSnapshot() {
  return apiRequest("/dashboard/admin");
}

export async function getRecentOperations(limit = 20) {
  return apiRequest(`/dashboard/operations?limit=${limit}`);
}
