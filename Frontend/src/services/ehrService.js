const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";
const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === "true";
const CLIENT_CACHE_TTL_MS = 10000;
const clientGetCache = new Map();
const SESSION_KEY = "ehr_active_session";
const MOCK_DB_KEY = "ehr_mock_database_v1";
const ROLE_OPTIONS = ["Doctor", "Nurse", "Administrator", "registration_desk"];
const STATUS_SET = new Set(["Scheduled", "Checked In", "In Consultation", "Completed"]);

function todayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function nowStamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  const second = String(now.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

function roleAlias(role) {
  return (role || "").trim().toLowerCase().replace(/\s+/g, "_");
}

function isStrongPassword(password) {
  return /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,}$/.test(password || "");
}

function randomToken() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now()}${Math.random().toString(16).slice(2)}`;
}

function createSeedDatabase() {
  const today = todayISO();

  return {
    counters: {
      user: 4,
      patient: 5,
      vitals: 2,
      appointment: 5,
      labOrder: 1,
      labResult: 1,
      imagingOrder: 1,
      imagingReport: 1,
      charge: 2,
      operation: 1,
      securityAlert: 1
    },
    users: [
      {
        id: 1,
        full_name: "Dr. Anitha Raman",
        email: "dr.anitha@bloom.health",
        password: "Doctor@123",
        role: "Doctor",
        approval_status: "Approved",
        shift_slot: "2-10",
        is_active: 1
      },
      {
        id: 2,
        full_name: "Nurse Priya Menon",
        email: "nurse.priya@bloom.health",
        password: "Nurse@123",
        role: "Nurse",
        approval_status: "Approved",
        shift_slot: "2-10",
        is_active: 1
      },
      {
        id: 3,
        full_name: "Admin Ravi Kumar",
        email: "admin.ravi@bloom.health",
        password: "Admin@123",
        role: "Administrator",
        approval_status: "Approved",
        shift_slot: null,
        is_active: 1
      }
    ],
    patients: [
      {
        id: 1,
        uhid: "UHID-2026-1001",
        full_name: "Arun K",
        age: 46,
        gender: "Male",
        assigned_doctor_id: 1,
        updated_at: nowStamp()
      },
      {
        id: 2,
        uhid: "UHID-2026-1002",
        full_name: "Meera V",
        age: 31,
        gender: "Female",
        assigned_doctor_id: 1,
        updated_at: nowStamp()
      },
      {
        id: 3,
        uhid: "UHID-2026-1003",
        full_name: "Sanjay T",
        age: 58,
        gender: "Male",
        assigned_doctor_id: 1,
        updated_at: nowStamp()
      },
      {
        id: 4,
        uhid: "UHID-2026-1004",
        full_name: "Lakshmi R",
        age: 40,
        gender: "Female",
        assigned_doctor_id: 1,
        updated_at: nowStamp()
      }
    ],
    clinical_history: {
      1: {
        chief_complaint: "Fever with dry cough for three days.",
        past_medical_history: ["Type 2 diabetes (8 years)", "No known drug allergy"],
        social_family_history: ["Father has hypertension", "Non-smoker, no alcohol"]
      },
      2: {
        chief_complaint: "",
        past_medical_history: [],
        social_family_history: []
      },
      3: {
        chief_complaint: "",
        past_medical_history: [],
        social_family_history: []
      },
      4: {
        chief_complaint: "",
        past_medical_history: [],
        social_family_history: []
      }
    },
    billing_status: {
      1: { billing_status: "Deposit Sufficient", insurance_approval: "Not Required" },
      2: { billing_status: "Deposit Sufficient", insurance_approval: "Not Required" },
      3: { billing_status: "Deposit Sufficient", insurance_approval: "Not Required" },
      4: { billing_status: "Deposit Sufficient", insurance_approval: "Not Required" }
    },
    vitals: [
      {
        id: 1,
        patient_id: 1,
        recorded_at: nowStamp(),
        blood_pressure: "138/88",
        heart_rate: "96 bpm",
        temperature: "100.4 F",
        spo2: "97%",
        respiratory_rate: "20/min",
        physical_findings: "Mild throat congestion"
      }
    ],
    lab_orders: [],
    lab_results: [],
    imaging_orders: [],
    imaging_reports: [],
    charges: [
      {
        id: 1,
        patient_id: 1,
        item: "Consultation Fee",
        amount: 800,
        captured_at: nowStamp()
      }
    ],
    appointments: [
      {
        id: 1,
        patient_id: 1,
        doctor_id: 1,
        appointment_date: today,
        appointment_time: "09:00",
        status: "Checked In"
      },
      {
        id: 2,
        patient_id: 2,
        doctor_id: 1,
        appointment_date: today,
        appointment_time: "10:30",
        status: "Scheduled"
      },
      {
        id: 3,
        patient_id: 3,
        doctor_id: 1,
        appointment_date: today,
        appointment_time: "12:15",
        status: "Scheduled"
      },
      {
        id: 4,
        patient_id: 4,
        doctor_id: 1,
        appointment_date: today,
        appointment_time: "15:20",
        status: "In Consultation"
      }
    ],
    operation_logs: [],
    security_alerts: []
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readMockDb() {
  if (typeof localStorage === "undefined") {
    return createSeedDatabase();
  }

  const raw = localStorage.getItem(MOCK_DB_KEY);
  if (!raw) {
    const seed = createSeedDatabase();
    localStorage.setItem(MOCK_DB_KEY, JSON.stringify(seed));
    return seed;
  }

  try {
    return JSON.parse(raw);
  } catch {
    const seed = createSeedDatabase();
    localStorage.setItem(MOCK_DB_KEY, JSON.stringify(seed));
    return seed;
  }
}

function writeMockDb(db) {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.setItem(MOCK_DB_KEY, JSON.stringify(db));
}

function nextId(db, counter) {
  const current = db.counters[counter] || 1;
  db.counters[counter] = current + 1;
  return current;
}

function readSession() {
  if (typeof localStorage === "undefined") {
    return null;
  }

  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    const expectedMode = USE_MOCK_API ? "mock" : "backend";
    if (parsed?.mode !== expectedMode) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveSession(session) {
  if (typeof localStorage === "undefined") {
    return;
  }
  const mode = USE_MOCK_API ? "mock" : "backend";
  localStorage.setItem(SESSION_KEY, JSON.stringify({ ...session, mode }));
}

function clearSessionUser() {
  if (typeof localStorage === "undefined") {
    return;
  }
  localStorage.removeItem(SESSION_KEY);
}

function getToken() {
  return readSession()?.token || null;
}

function toUserModel(apiUser) {
  return {
    id: apiUser.id,
    name: apiUser.full_name,
    email: apiUser.email,
    role: apiUser.role,
    approvalStatus: apiUser.approval_status || "Approved",
    shiftSlot: apiUser.shift_slot || null
  };
}

function getSessionPrincipal(requiredRoles = null) {
  const session = readSession();
  if (!session?.user) {
    throw new Error("Session expired");
  }

  const db = readMockDb();
  const user = db.users.find((row) => row.id === session.user.id && row.is_active === 1);
  if (!user) {
    throw new Error("Session expired");
  }

  if (requiredRoles && !requiredRoles.includes(user.role)) {
    throw new Error(`Allowed roles: ${requiredRoles.join(", ")}`);
  }

  return { db, user };
}

function logOperation(db, userId, action, entityType, entityId, details) {
  db.operation_logs.push({
    id: nextId(db, "operation"),
    user_id: userId,
    action,
    entity_type: entityType,
    entity_id: String(entityId),
    details,
    created_at: nowStamp()
  });
}

function parseDbDateTime(value) {
  if (!value) {
    return new Date();
  }
  const normalized = String(value).replace(" ", "T") + "Z";
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return new Date();
  }
  return parsed;
}

function isInShift(shiftSlot, hour) {
  if (shiftSlot === "2-10") {
    return hour >= 2 && hour < 10;
  }
  if (shiftSlot === "10-18") {
    return hour >= 10 && hour < 18;
  }
  if (shiftSlot === "18-2") {
    return hour >= 18 || hour < 2;
  }
  return true;
}

function bandFromScore(score) {
  if (score >= 70) {
    return "anomaly";
  }
  if (score >= 40) {
    return "suspicious";
  }
  return "normal";
}

function scoreMockSecurityEvent(logRow, actor) {
  let score = 12;
  const reasons = [];
  const action = (logRow.action || "").toLowerCase();
  const entityType = (logRow.entity_type || "").toLowerCase();
  const details = (logRow.details || "").toLowerCase();

  const isReadLike = action === "read" || action === "list" || action === "search";
  const isWriteLike = action === "create" || action === "update" || action === "delete" || action === "patch";
  const isClinicalEntity = ["patient_record", "lab_results", "imaging_reports", "vitals"].includes(entityType);

  if (isReadLike) {
    score += 12;
  }
  if (isWriteLike) {
    score += 6;
  }
  if (action === "denied" || action === "forbidden") {
    score += 38;
    reasons.push("repeated_denied_access");
  }

  if (isClinicalEntity) {
    score += 15;
    reasons.push("clinical_record_access");
  }

  const eventTime = parseDbDateTime(logRow.created_at);
  const inShift = isInShift(actor?.shift_slot, eventTime.getUTCHours());
  if (!inShift && (isReadLike || isWriteLike)) {
    score += 24;
    reasons.push("off_shift_record_access");
  }

  if ((actor?.role || "") === "registration_desk" && isClinicalEntity && isReadLike) {
    score += 30;
    reasons.push("regdesk_deep_clinical_reads");
  }

  if ((actor?.role || "") === "Nurse" && isClinicalEntity && details.includes("unassigned")) {
    score += 26;
    reasons.push("nurse_unassigned_access_pattern");
  }

  if (entityType === "security_alerts") {
    score = 0;
  }

  score = Math.max(0, Math.min(100, score));
  const riskBand = bandFromScore(score);

  if (!reasons.length) {
    reasons.push("baseline_pattern");
  }

  return {
    risk_score: score,
    risk_band: riskBand,
    reason_codes: reasons.join("|")
  };
}

function refreshMockSecurityAlerts(db, lookbackHours = 24, limit = 300) {
  const existingLogIds = new Set(db.security_alerts.map((row) => row.log_id));
  const cutoff = Date.now() - lookbackHours * 60 * 60 * 1000;

  const candidates = db.operation_logs
    .slice()
    .sort((a, b) => b.id - a.id)
    .filter((row) => !existingLogIds.has(row.id))
    .filter((row) => row.entity_type !== "security_alerts")
    .filter((row) => parseDbDateTime(row.created_at).getTime() >= cutoff)
    .slice(0, limit)
    .reverse();

  const persisted = [];
  candidates.forEach((logRow) => {
    const actor = db.users.find((row) => row.id === logRow.user_id) || null;
    const scored = scoreMockSecurityEvent(logRow, actor);
    const alertRow = {
      id: nextId(db, "securityAlert"),
      log_id: logRow.id,
      user_id: logRow.user_id,
      user_code: actor ? `USR-${String(actor.id).padStart(6, "0")}` : null,
      user_name: actor?.full_name || "System",
      role: actor?.role || "Unknown",
      action: logRow.action,
      entity_type: logRow.entity_type,
      entity_id: logRow.entity_id,
      details: logRow.details,
      risk_score: scored.risk_score,
      risk_band: scored.risk_band,
      reason_codes: scored.reason_codes,
      event_time: parseDbDateTime(logRow.created_at).toISOString(),
      scored_at: nowStamp()
    };
    db.security_alerts.push(alertRow);
    persisted.push(alertRow);
  });

  const high = persisted.filter((row) => row.risk_band === "anomaly").length;
  const medium = persisted.filter((row) => row.risk_band === "suspicious").length;
  return {
    ok: true,
    scored: persisted.length,
    high,
    medium,
    alerts: persisted.filter((row) => row.risk_band !== "normal").slice(0, 25)
  };
}

function mapPatientRow(db, patient) {
  const doctor = db.users.find((row) => row.id === patient.assigned_doctor_id);
  const medcareNurse = db.users.find((row) => row.id === patient.medcare_nurse_id);
  return {
    id: patient.id,
    uhid: patient.uhid,
    full_name: patient.full_name,
    age: patient.age,
    gender: patient.gender,
    assigned_doctor_id: patient.assigned_doctor_id,
    assigned_doctor_name: doctor?.full_name || "Unknown",
    medcare_nurse_id: patient.medcare_nurse_id || null,
    medcare_nurse_name: medcareNurse?.full_name || null
  };
}

function getPatientById(db, patientId) {
  return db.patients.find((row) => row.id === patientId) || null;
}

function listTodayAppointmentsForUser(db, user) {
  const today = todayISO();
  const rows = db.appointments
    .filter((row) => row.appointment_date === today)
    .filter((row) => (user.role === "Doctor" ? row.doctor_id === user.id : true))
    .sort((a, b) => a.appointment_time.localeCompare(b.appointment_time));

  return rows.map((row) => {
    const patient = getPatientById(db, row.patient_id);
    return {
      id: row.id,
      patient_id: row.patient_id,
      doctor_id: row.doctor_id,
      appointmentDate: row.appointment_date,
      appointmentTime: row.appointment_time,
      status: row.status,
      patient: {
        id: row.patient_id,
        fullName: patient?.full_name || "Unknown",
        uhid: patient?.uhid || "N/A"
      }
    };
  });
}

function listAppointmentsForUser(db, user) {
  const rows = db.appointments
    .sort((a, b) => {
      const byDate = b.appointment_date.localeCompare(a.appointment_date);
      if (byDate !== 0) {
        return byDate;
      }
      return a.appointment_time.localeCompare(b.appointment_time);
    });

  return rows.map((row) => {
    const patient = getPatientById(db, row.patient_id);
    return {
      id: row.id,
      patient_id: row.patient_id,
      doctor_id: row.doctor_id,
      appointmentDate: row.appointment_date,
      appointmentTime: row.appointment_time,
      status: row.status,
      patient: {
        id: row.patient_id,
        fullName: patient?.full_name || "Unknown",
        uhid: patient?.uhid || "N/A"
      }
    };
  });
}

function serializePatientRecord(db, patientId) {
  const patient = getPatientById(db, patientId);
  if (!patient) {
    throw new Error("Patient not found");
  }

  const doctor = db.users.find((row) => row.id === patient.assigned_doctor_id);
  const clinical = db.clinical_history[patientId] || {
    chief_complaint: "",
    past_medical_history: [],
    social_family_history: []
  };
  const billing = db.billing_status[patientId] || {
    billing_status: "Deposit Sufficient",
    insurance_approval: "Not Required"
  };

  const vitalsRows = db.vitals
    .filter((row) => row.patient_id === patientId)
    .sort((a, b) => b.recorded_at.localeCompare(a.recorded_at))
    .slice(0, 20);

  const labOrders = db.lab_orders
    .filter((row) => row.patient_id === patientId)
    .sort((a, b) => b.ordered_at.localeCompare(a.ordered_at));

  const labResults = db.lab_results
    .filter((result) => labOrders.some((order) => order.id === result.lab_order_id))
    .sort((a, b) => b.reported_at.localeCompare(a.reported_at));

  const imagingOrders = db.imaging_orders
    .filter((row) => row.patient_id === patientId)
    .sort((a, b) => b.ordered_at.localeCompare(a.ordered_at));

  const imagingReports = db.imaging_reports
    .filter((result) => imagingOrders.some((order) => order.id === result.imaging_order_id))
    .sort((a, b) => b.reported_at.localeCompare(a.reported_at));

  const charges = db.charges
    .filter((row) => row.patient_id === patientId)
    .sort((a, b) => b.captured_at.localeCompare(a.captured_at));

  return {
    patient: {
      id: patient.id,
      fullName: patient.full_name,
      age: patient.age,
      gender: patient.gender,
      uhid: patient.uhid,
      doctorAssigned: doctor?.full_name || "Unknown",
      medcareNurse: patient.medcare_nurse_id
        ? {
            id: patient.medcare_nurse_id,
            fullName: db.users.find((row) => row.id === patient.medcare_nurse_id)?.full_name || null
          }
        : null
    },
    record: {
      chiefComplaint: clinical.chief_complaint || "",
      pastMedicalHistory: clone(clinical.past_medical_history || []),
      socialFamilyHistory: clone(clinical.social_family_history || []),
      vitals: vitalsRows.map((row) => ({
        recordedAt: row.recorded_at,
        bloodPressure: row.blood_pressure,
        heartRate: row.heart_rate,
        temperature: row.temperature,
        spo2: row.spo2,
        respiratoryRate: row.respiratory_rate
      })),
      physicalFindings: vitalsRows
        .map((row) => row.physical_findings || "")
        .filter(Boolean),
      labOrders: labOrders.map((row) => ({
        id: `LAB-${row.id}`,
        testName: row.test_name,
        orderedAt: row.ordered_at,
        status: row.status
      })),
      labResults: labResults.map((row) => {
        const relatedOrder = labOrders.find((order) => order.id === row.lab_order_id);
        return {
          labOrderId: `LAB-${row.lab_order_id}`,
          testName: relatedOrder?.test_name || "Unknown",
          resultValue: row.result_value,
          flag: row.result_flag,
          reportedAt: row.reported_at
        };
      }),
      imagingOrders: imagingOrders.map((row) => ({
        id: `IMG-${row.id}`,
        imagingType: row.imaging_type,
        orderedAt: row.ordered_at,
        status: row.status
      })),
      imagingReports: imagingReports.map((row) => ({
        imagingOrderId: `IMG-${row.imaging_order_id}`,
        reportText: row.report_text,
        reportedAt: row.reported_at
      })),
      billing: {
        billingStatus: billing.billing_status || "Deposit Sufficient",
        insuranceApproval: billing.insurance_approval || "Not Required"
      },
      chargeCapture: charges.map((row) => ({
        item: row.item,
        amount: row.amount,
        capturedAt: row.captured_at
      }))
    }
  };
}

function parsePath(path) {
  const url = new URL(path, "http://mock.local");
  return {
    pathname: url.pathname,
    searchParams: url.searchParams
  };
}

async function mockApiRequest(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const body = options.body || {};
  const { pathname, searchParams } = parsePath(path);

  if (pathname === "/auth/signup" && method === "POST") {
    const email = normalizeEmail(body.email);
    const role = body.role;
    const username = (body.username || "").trim().toLowerCase();

    if (!ROLE_OPTIONS.includes(role)) {
      throw new Error("Invalid role");
    }
    if (!body.full_name || !email || !body.password || !username) {
      throw new Error("Missing required fields");
    }
    if (!/^[a-z0-9._]+$/.test(username)) {
      throw new Error("Invalid username format");
    }
    if (email !== `${username}.${roleAlias(role)}@ehr.in`) {
      throw new Error("EHR username format must be username.role@ehr.in");
    }
    if (!isStrongPassword(body.password)) {
      throw new Error("Password policy failed");
    }

    const db = readMockDb();
    const exists = db.users.some((row) => normalizeEmail(row.email) === email);
    if (exists) {
      throw new Error("User already exists");
    }

    const userId = nextId(db, "user");
    db.users.push({
      id: userId,
      full_name: body.full_name.trim(),
      email,
      password: body.password,
      role,
      approval_status: "Pending",
      shift_slot: null,
      is_active: 1
    });
    logOperation(db, userId, "signup", "users", userId, "New account created");
    writeMockDb(db);
    return { ok: true, message: "Signup request submitted. Please wait for admin approval." };
  }

  if (pathname === "/auth/signin" && method === "POST") {
    const email = normalizeEmail(body.email);
    const db = readMockDb();
    const user = db.users.find(
      (row) => normalizeEmail(row.email) === email && row.is_active === 1
    );

    if (!user || user.password !== body.password) {
      throw new Error("Invalid credentials");
    }
    if (user.approval_status !== "Approved") {
      throw new Error("Account is pending administrator approval. Only approved users can sign in.");
    }

    logOperation(db, user.id, "signin", "sessions", "local", "User signed in");
    writeMockDb(db);

    return {
      token: randomToken(),
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        approval_status: user.approval_status || "Approved",
        shift_slot: user.shift_slot || null
      }
    };
  }

  if (pathname === "/auth/logout" && method === "POST") {
    const { db, user } = getSessionPrincipal();
    logOperation(db, user.id, "logout", "sessions", "local", "User signed out");
    writeMockDb(db);
    return { ok: true };
  }

  if (pathname === "/auth/me" && method === "GET") {
    const { user } = getSessionPrincipal();
    return {
      id: user.id,
      full_name: user.full_name,
      email: user.email,
      role: user.role,
      approval_status: user.approval_status || "Approved",
      shift_slot: user.shift_slot || null
    };
  }

  if (pathname === "/appointments/today" && method === "GET") {
    const { db, user } = getSessionPrincipal([
      "Doctor",
      "Nurse",
      "Administrator",
      "registration_desk"
    ]);
    return listTodayAppointmentsForUser(db, user);
  }

  if (pathname === "/appointments" && method === "GET") {
    const { db, user } = getSessionPrincipal([
      "Doctor",
      "Nurse",
      "Administrator",
      "registration_desk"
    ]);
    return listAppointmentsForUser(db, user);
  }

  if (pathname === "/appointments" && method === "POST") {
    const { db, user } = getSessionPrincipal(["Doctor", "Nurse", "registration_desk"]);

    let doctorId = body.doctor_id;
    if (user.role === "Doctor") {
      doctorId = user.id;
    }

    if (!STATUS_SET.has(body.status)) {
      throw new Error("Invalid status");
    }

    const patientId = Number(body.patient_id);
    if (!Number.isInteger(patientId) || patientId < 1) {
      throw new Error("Patient not found");
    }

    const doctorIdNumber = Number(doctorId);
    if (!Number.isInteger(doctorIdNumber) || doctorIdNumber < 1) {
      throw new Error("Doctor not found");
    }

    const patient = db.patients.find((row) => row.id === patientId);
    if (!patient) {
      throw new Error("Patient not found");
    }

    const doctor = db.users.find(
      (row) => row.id === doctorIdNumber && row.role === "Doctor" && row.is_active === 1
    );
    if (!doctor) {
      throw new Error("Doctor not found");
    }

    const appointmentId = nextId(db, "appointment");
    db.appointments.push({
      id: appointmentId,
      patient_id: patientId,
      doctor_id: doctorIdNumber,
      appointment_date: String(body.appointment_date || "").trim(),
      appointment_time: String(body.appointment_time || "").trim(),
      status: body.status
    });

    logOperation(db, user.id, "create", "appointments", appointmentId, "New appointment created");
    writeMockDb(db);
    return { ok: true, id: appointmentId };
  }

  const appointmentStatusMatch = pathname.match(/^\/appointments\/(\d+)\/status$/);
  if (appointmentStatusMatch && method === "PATCH") {
    const appointmentId = Number(appointmentStatusMatch[1]);
    const { db, user } = getSessionPrincipal(["Doctor"]);

    const appointment = db.appointments.find((row) => row.id === appointmentId);
    if (!appointment) {
      throw new Error("Appointment not found");
    }
    if (!STATUS_SET.has(body.status)) {
      throw new Error("Invalid status");
    }

    appointment.status = body.status;
    logOperation(db, user.id, "update", "appointments", appointmentId, `Status set to ${body.status}`);
    writeMockDb(db);
    return { ok: true };
  }

  if (pathname === "/users/doctors" && method === "GET") {
    const { db } = getSessionPrincipal();
    const shiftSlot = (searchParams.get("shift_slot") || "").trim();
    return db.users
      .filter(
        (row) =>
          row.role === "Doctor" &&
          row.is_active === 1 &&
          row.approval_status === "Approved" &&
          (!shiftSlot || row.shift_slot === shiftSlot)
      )
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
      .map((row) => ({
        id: row.id,
        full_name: row.full_name,
        email: row.email,
        shift_slot: row.shift_slot || null
      }));
  }

  if (pathname === "/users/nurses" && method === "GET") {
    const { db } = getSessionPrincipal();
    const shiftSlot = (searchParams.get("shift_slot") || "").trim();
    return db.users
      .filter(
        (row) =>
          row.role === "Nurse" &&
          row.is_active === 1 &&
          row.approval_status === "Approved" &&
          (!shiftSlot || row.shift_slot === shiftSlot)
      )
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
      .map((row) => ({
        id: row.id,
        full_name: row.full_name,
        email: row.email,
        shift_slot: row.shift_slot || null
      }));
  }

  if (pathname === "/users/role-wise" && method === "GET") {
    const { db } = getSessionPrincipal(["Administrator"]);
    const roleOrder = ["Doctor", "Nurse", "Administrator", "registration_desk"];
    const grouped = db.users
      .filter((row) => row.is_active === 1)
      .reduce((acc, row) => {
        const users = acc[row.role] || [];
        users.push({
          id: row.id,
          full_name: row.full_name,
          email: row.email,
          approval_status: row.approval_status || "Approved",
          shift_slot: row.shift_slot || null
        });
        return { ...acc, [row.role]: users };
      }, {});

    return roleOrder
      .filter((role) => grouped[role]?.length)
      .map((role) => ({
        role,
        count: grouped[role].length,
        users: grouped[role].sort((a, b) => a.full_name.localeCompare(b.full_name))
      }));
  }

  if (pathname === "/users/pending-approvals" && method === "GET") {
    const { db } = getSessionPrincipal(["Administrator"]);
    return db.users
      .filter((row) => row.is_active === 1 && row.approval_status === "Pending")
      .map((row) => ({
        id: row.id,
        full_name: row.full_name,
        email: row.email,
        role: row.role,
        approval_status: row.approval_status,
        shift_slot: row.shift_slot || null
      }));
  }

  const approvalMatch = pathname.match(/^\/users\/(\d+)\/approval$/);
  if (approvalMatch && method === "PATCH") {
    const { db, user } = getSessionPrincipal(["Administrator"]);
    const userId = Number(approvalMatch[1]);
    const target = db.users.find((row) => row.id === userId && row.is_active === 1);
    if (!target) {
      throw new Error("User not found");
    }
    target.approval_status = body.approval_status;
    logOperation(db, user.id, "update", "users", userId, `Approval status set to ${body.approval_status}`);
    writeMockDb(db);
    return { ok: true };
  }

  const shiftMatch = pathname.match(/^\/users\/(\d+)\/shift$/);
  if (shiftMatch && method === "PATCH") {
    const { db, user } = getSessionPrincipal(["Administrator"]);
    const userId = Number(shiftMatch[1]);
    const target = db.users.find((row) => row.id === userId && row.is_active === 1);
    if (!target) {
      throw new Error("User not found");
    }
    target.shift_slot = body.shift_slot || null;
    logOperation(db, user.id, "update", "users", userId, `Shift set to ${target.shift_slot || "None"}`);
    writeMockDb(db);
    return { ok: true };
  }

  if (pathname === "/users/staff-by-shift" && method === "GET") {
    const { db } = getSessionPrincipal(["registration_desk", "Administrator"]);
    const shiftSlot = (searchParams.get("shift_slot") || "").trim();
    if (!shiftSlot) {
      throw new Error("Invalid shift slot");
    }
    return {
      doctors: db.users
        .filter(
          (row) =>
            row.role === "Doctor" &&
            row.is_active === 1 &&
            row.approval_status === "Approved" &&
            row.shift_slot === shiftSlot
        )
        .sort((a, b) => a.full_name.localeCompare(b.full_name))
        .map((row) => ({ id: row.id, full_name: row.full_name, email: row.email, shift_slot: row.shift_slot })),
      nurses: db.users
        .filter(
          (row) =>
            row.role === "Nurse" &&
            row.is_active === 1 &&
            row.approval_status === "Approved" &&
            row.shift_slot === shiftSlot
        )
        .sort((a, b) => a.full_name.localeCompare(b.full_name))
        .map((row) => ({ id: row.id, full_name: row.full_name, email: row.email, shift_slot: row.shift_slot }))
    };
  }

  if (pathname === "/patients" && method === "GET") {
    const { db } = getSessionPrincipal([
      "Doctor",
      "Nurse",
      "Administrator",
      "registration_desk"
    ]);
    const search = (searchParams.get("search") || "").trim().toLowerCase();
    const rows = db.patients
      .filter((row) => {
        if (!search) {
          return true;
        }
        return (
          row.full_name.toLowerCase().includes(search) || row.uhid.toLowerCase().includes(search)
        );
      })
      .sort((a, b) => a.full_name.localeCompare(b.full_name))
      .map((row) => mapPatientRow(db, row));
    return rows;
  }

  if (pathname === "/patients" && method === "POST") {
    const { db, user } = getSessionPrincipal(["Doctor", "Nurse", "registration_desk"]);

    let assignedDoctorId = body.assigned_doctor_id;
    if (user.role === "Doctor" && (assignedDoctorId === null || assignedDoctorId === undefined)) {
      assignedDoctorId = user.id;
    }
    if (assignedDoctorId === null || assignedDoctorId === undefined) {
      throw new Error("assigned_doctor_id is required for nurse-created patients");
    }

    const doctor = db.users.find(
      (row) => row.id === assignedDoctorId && row.role === "Doctor" && row.is_active === 1
    );
    if (!doctor) {
      throw new Error("Doctor not found");
    }

    const uhid = (body.uhid || "").trim();
    const duplicate = db.patients.some((row) => row.uhid.toLowerCase() === uhid.toLowerCase());
    if (duplicate) {
      throw new Error("UHID already exists");
    }

    const patientId = nextId(db, "patient");
    const patient = {
      id: patientId,
      uhid,
      full_name: (body.full_name || "").trim(),
      age: Number(body.age),
      gender: body.gender,
      assigned_doctor_id: assignedDoctorId,
      medcare_nurse_id: body.medcare_nurse_id || null,
      updated_at: nowStamp()
    };

    db.patients.push(patient);
    db.clinical_history[patientId] = {
      chief_complaint: "",
      past_medical_history: [],
      social_family_history: []
    };
    db.billing_status[patientId] = {
      billing_status: "Deposit Sufficient",
      insurance_approval: "Not Required"
    };

    logOperation(db, user.id, "create", "patients", patientId, `Added patient ${patient.full_name}`);
    writeMockDb(db);
    return mapPatientRow(db, patient);
  }

  const patientRecordMatch = pathname.match(/^\/patients\/(\d+)\/record$/);
  if (patientRecordMatch && method === "GET") {
    const patientId = Number(patientRecordMatch[1]);
    const { db } = getSessionPrincipal([
      "Doctor",
      "Nurse",
      "Administrator",
      "registration_desk"
    ]);
    return serializePatientRecord(db, patientId);
  }

  if (patientRecordMatch && method === "PUT") {
    const patientId = Number(patientRecordMatch[1]);
    const { db, user } = getSessionPrincipal(["Doctor", "Nurse", "registration_desk"]);

    const patient = getPatientById(db, patientId);
    if (!patient) {
      throw new Error("Patient not found");
    }

    if (!db.clinical_history[patientId]) {
      db.clinical_history[patientId] = {
        chief_complaint: "",
        past_medical_history: [],
        social_family_history: []
      };
    }

    const current = db.clinical_history[patientId];
    if (body.chief_complaint !== undefined && body.chief_complaint !== null) {
      current.chief_complaint = body.chief_complaint;
    }
    if (Array.isArray(body.past_medical_history)) {
      current.past_medical_history = body.past_medical_history;
    }
    if (Array.isArray(body.social_family_history)) {
      current.social_family_history = body.social_family_history;
    }

    if (!db.billing_status[patientId]) {
      db.billing_status[patientId] = {
        billing_status: "Deposit Sufficient",
        insurance_approval: "Not Required"
      };
    }
    if (body.billing_status !== undefined && body.billing_status !== null) {
      db.billing_status[patientId].billing_status = body.billing_status;
    }
    if (body.insurance_approval !== undefined && body.insurance_approval !== null) {
      db.billing_status[patientId].insurance_approval = body.insurance_approval;
    }

    logOperation(db, user.id, "update", "patient_record", patientId, "Updated clinical record");
    writeMockDb(db);
    return { ok: true };
  }

  const patientVitalsMatch = pathname.match(/^\/patients\/(\d+)\/vitals$/);
  if (patientVitalsMatch && method === "POST") {
    const patientId = Number(patientVitalsMatch[1]);
    const { db, user } = getSessionPrincipal(["Doctor", "Nurse", "registration_desk"]);

    const patient = getPatientById(db, patientId);
    if (!patient) {
      throw new Error("Patient not found");
    }

    const vitalsId = nextId(db, "vitals");
    db.vitals.push({
      id: vitalsId,
      patient_id: patientId,
      recorded_at: nowStamp(),
      blood_pressure: body.blood_pressure,
      heart_rate: body.heart_rate,
      temperature: body.temperature,
      spo2: body.spo2,
      respiratory_rate: body.respiratory_rate,
      physical_findings: body.physical_findings || ""
    });

    logOperation(db, user.id, "create", "vitals", vitalsId, "Added vitals entry");
    writeMockDb(db);
    return { ok: true, id: vitalsId };
  }

  const patientMatch = pathname.match(/^\/patients\/(\d+)$/);
  if (patientMatch && method === "PUT") {
    const patientId = Number(patientMatch[1]);
    const { db, user } = getSessionPrincipal(["Doctor", "Nurse", "registration_desk"]);
    const patient = getPatientById(db, patientId);
    if (!patient) {
      throw new Error("Patient not found");
    }

    if (body.assigned_doctor_id !== null && body.assigned_doctor_id !== undefined) {
      const doctorExists = db.users.some(
        (row) => row.id === body.assigned_doctor_id && row.role === "Doctor" && row.is_active === 1
      );
      if (!doctorExists) {
        throw new Error("Assigned doctor not found");
      }
    }

    if (body.medcare_nurse_id !== null && body.medcare_nurse_id !== undefined) {
      const nurseExists = db.users.some(
        (row) => row.id === body.medcare_nurse_id && row.role === "Nurse" && row.is_active === 1
      );
      if (!nurseExists) {
        throw new Error("Assigned medcare nurse not found");
      }
    }

    if (body.uhid !== null && body.uhid !== undefined) {
      const nextUhid = body.uhid.trim();
      const duplicate = db.patients.some(
        (row) => row.id !== patientId && row.uhid.toLowerCase() === nextUhid.toLowerCase()
      );
      if (duplicate) {
        throw new Error("UHID already exists");
      }
      patient.uhid = nextUhid;
    }
    if (body.full_name !== null && body.full_name !== undefined) {
      patient.full_name = body.full_name.trim();
    }
    if (body.age !== null && body.age !== undefined) {
      patient.age = Number(body.age);
    }
    if (body.gender !== null && body.gender !== undefined) {
      patient.gender = body.gender;
    }
    if (body.assigned_doctor_id !== null && body.assigned_doctor_id !== undefined) {
      patient.assigned_doctor_id = body.assigned_doctor_id;
    }
    if (body.medcare_nurse_id !== null && body.medcare_nurse_id !== undefined) {
      patient.medcare_nurse_id = body.medcare_nurse_id;
    }
    patient.updated_at = nowStamp();

    logOperation(db, user.id, "update", "patients", patientId, "Updated patient demographics");
    writeMockDb(db);
    return mapPatientRow(db, patient);
  }

  if (pathname === "/dashboard/nurse" && method === "GET") {
    const { db } = getSessionPrincipal([
      "Doctor",
      "Nurse",
      "Administrator",
      "registration_desk"
    ]);
    const today = todayISO();
    const todayStatuses = db.appointments
      .filter((row) => row.appointment_date === today)
      .map((row) => row.status);
    return {
      todayPatients: todayStatuses.length,
      pendingTasks: todayStatuses.filter((status) => status !== "Completed").length
    };
  }

  if (pathname === "/dashboard/admin" && method === "GET") {
    const { db } = getSessionPrincipal(["Administrator"]);
    const today = todayISO();
    const todayStatuses = db.appointments
      .filter((row) => row.appointment_date === today)
      .map((row) => row.status);
    return {
      todaysFootfall: todayStatuses.length,
      consultationsCompleted: todayStatuses.filter((status) => status === "Completed").length
    };
  }

  if (pathname === "/dashboard/operations" && method === "GET") {
    const { db } = getSessionPrincipal(["Administrator"]);
    const rawLimit = Number(searchParams.get("limit") || 20);
    const limit = Number.isNaN(rawLimit) ? 20 : Math.max(1, Math.min(100, rawLimit));
    return db.operation_logs
      .slice()
      .sort((a, b) => b.id - a.id)
      .slice(0, limit)
      .map((row) => {
        const actor = db.users.find((user) => user.id === row.user_id);
        return {
          id: row.id,
          action: row.action,
          entity_type: row.entity_type,
          entity_id: row.entity_id,
          details: row.details,
          created_at: row.created_at,
          user_name: actor?.full_name || "System"
        };
      });
  }

  if (pathname === "/dashboard/security/refresh" && method === "POST") {
    const { db, user } = getSessionPrincipal(["Administrator"]);
    const lookbackHoursRaw = Number(searchParams.get("lookback_hours") || 24);
    const limitRaw = Number(searchParams.get("limit") || 300);
    const lookbackHours = Number.isFinite(lookbackHoursRaw)
      ? Math.max(1, Math.min(168, lookbackHoursRaw))
      : 24;
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(1000, limitRaw)) : 300;
    const result = refreshMockSecurityAlerts(db, lookbackHours, limit);
    logOperation(db, user.id, "refresh", "security_alerts", "batch", `Scored ${result.scored} logs`);
    writeMockDb(db);
    return result;
  }

  if (pathname === "/dashboard/security/alerts" && method === "GET") {
    const { db, user } = getSessionPrincipal(["Administrator"]);
    const rawLimit = Number(searchParams.get("limit") || 80);
    const lookbackDaysRaw = Number(searchParams.get("lookback_days") || 30);
    const riskBand = (searchParams.get("risk_band") || "").trim().toLowerCase();
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(400, rawLimit)) : 80;
    const lookbackDays = Number.isFinite(lookbackDaysRaw)
      ? Math.max(1, Math.min(90, lookbackDaysRaw))
      : 30;
    const cutoff = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;

    const rows = db.security_alerts
      .slice()
      .sort((a, b) => b.id - a.id)
      .filter((row) => (riskBand ? row.risk_band === riskBand : true))
      .filter((row) => parseDbDateTime(row.event_time).getTime() >= cutoff)
      .slice(0, limit);

    logOperation(
      db,
      user.id,
      "read",
      "security_alerts",
      "list",
      `Viewed security alerts (${riskBand || "all"})`
    );
    writeMockDb(db);
    return rows;
  }

  if (pathname === "/dashboard/security/summary" && method === "GET") {
    const { db, user } = getSessionPrincipal(["Administrator"]);
    const lookbackDaysRaw = Number(searchParams.get("lookback_days") || 30);
    const lookbackDays = Number.isFinite(lookbackDaysRaw)
      ? Math.max(1, Math.min(90, lookbackDaysRaw))
      : 30;
    const cutoff = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;

    const scoped = db.security_alerts.filter(
      (row) => parseDbDateTime(row.event_time).getTime() >= cutoff
    );
    const high = scoped.filter((row) => row.risk_band === "anomaly").length;
    const medium = scoped.filter((row) => row.risk_band === "suspicious").length;
    const roleMap = new Map();

    scoped.forEach((row) => {
      const key = row.role || "Unknown";
      if (!roleMap.has(key)) {
        roleMap.set(key, { role: key, high: 0, medium: 0, total: 0 });
      }
      const bucket = roleMap.get(key);
      if (row.risk_band === "anomaly") {
        bucket.high += 1;
      }
      if (row.risk_band === "suspicious") {
        bucket.medium += 1;
      }
      bucket.total += row.risk_band === "normal" ? 0 : 1;
    });

    logOperation(db, user.id, "read", "security_alerts", "summary", "Viewed security summary");
    writeMockDb(db);
    return {
      lookback_days: lookbackDays,
      total_scored: scoped.length,
      high_risk: high,
      medium_risk: medium,
      role_breakdown: Array.from(roleMap.values()).sort((a, b) =>
        String(a.role).localeCompare(String(b.role))
      ),
      ml_service: { ok: true, service: "mock" }
    };
  }

  throw new Error(`Mock endpoint not implemented: ${method} ${pathname}`);
}

async function fetchApiRequest(path, options = {}) {
  function formatApiError(detail) {
    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) => item?.msg || item?.detail || "")
        .filter(Boolean);
      if (messages.length) {
        return messages.join("; ");
      }
      return "Validation failed";
    }
    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }
    if (detail && typeof detail === "object") {
      if (typeof detail.msg === "string" && detail.msg.trim()) {
        return detail.msg;
      }
      if (typeof detail.detail === "string" && detail.detail.trim()) {
        return detail.detail;
      }
    }
    return "Request failed";
  }

  const token = getToken();
  const method = (options.method || "GET").toUpperCase();
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };
  if (options.auth !== false && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const cacheKey = `${API_BASE}${path}|${token || "anon"}`;
  if (method === "GET") {
    const cached = clientGetCache.get(cacheKey);
    if (cached && Date.now() - cached.time < CLIENT_CACHE_TTL_MS) {
      return cached.value;
    }
  } else {
    clientGetCache.clear();
  }

  const response = await fetch(`${API_BASE}${path}`, {
    method,
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
    if (response.status === 401) {
      clearSessionUser();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("ehr:unauthorized"));
      }
    }
    const detail = formatApiError(payload?.detail);
    throw new Error(detail);
  }

  if (method === "GET") {
    clientGetCache.set(cacheKey, { time: Date.now(), value: payload });
  }

  return payload;
}

async function apiRequest(path, options = {}) {
  if (USE_MOCK_API) {
    return mockApiRequest(path, options);
  }
  return fetchApiRequest(path, options);
}

export function getRoleOptions() {
  return [...ROLE_OPTIONS];
}

export function getSessionUser() {
  const session = readSession();
  return session?.user || null;
}

export { clearSessionUser };

export async function registerUser(payload) {
  try {
    const role = payload.role;
    const username = (payload.username || "").trim().toLowerCase();
    const email = normalizeEmail(payload.email || `${username}.${roleAlias(role)}@ehr.in`);

    await apiRequest("/auth/signup", {
      method: "POST",
      auth: false,
      body: {
        full_name: payload.name.trim(),
        age: Number(payload.age),
        username,
        email,
        password: payload.password,
        role
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
        status: STATUS_SET.has(item.status) ? item.status : "Scheduled",
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

export async function getTodaysAppointments() {
  const data = await apiRequest("/appointments/today");
  return data.map((item) => ({
    id: item.id,
    patientId: item.patient_id,
    doctorId: item.doctor_id,
    appointmentDate: item.appointmentDate,
    appointmentTime: item.appointmentTime,
    status: STATUS_SET.has(item.status) ? item.status : "Scheduled",
    patient: item.patient
  }));
}

export async function getAppointments() {
  const data = await apiRequest("/appointments");
  return data.map((item) => ({
    id: item.id,
    patientId: item.patient_id,
    doctorId: item.doctor_id,
    appointmentDate: item.appointmentDate,
    appointmentTime: item.appointmentTime,
    status: STATUS_SET.has(item.status) ? item.status : "Scheduled",
    patient: item.patient
  }));
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

export async function getDoctors(shiftSlot = "") {
  const query = shiftSlot ? `?shift_slot=${encodeURIComponent(shiftSlot)}` : "";
  return apiRequest(`/users/doctors${query}`);
}

export async function getNurses(shiftSlot = "") {
  const query = shiftSlot ? `?shift_slot=${encodeURIComponent(shiftSlot)}` : "";
  return apiRequest(`/users/nurses${query}`);
}

export async function getRoleWiseUsers() {
  return apiRequest("/users/role-wise");
}

export async function getPendingApprovals() {
  return apiRequest("/users/pending-approvals");
}

export async function updateUserApproval(userId, approvalStatus) {
  return apiRequest(`/users/${userId}/approval`, {
    method: "PATCH",
    body: { approval_status: approvalStatus }
  });
}

export async function updateUserShift(userId, shiftSlot) {
  return apiRequest(`/users/${userId}/shift`, {
    method: "PATCH",
    body: { shift_slot: shiftSlot || null }
  });
}

export async function getStaffByShift(shiftSlot) {
  return apiRequest(`/users/staff-by-shift?shift_slot=${encodeURIComponent(shiftSlot)}`);
}

export async function createPatient(payload) {
  return apiRequest("/patients", {
    method: "POST",
    body: payload
  });
}

export async function createAppointment(payload) {
  return apiRequest("/appointments", {
    method: "POST",
    body: payload
  });
}

export async function updateAppointmentStatus(appointmentId, status) {
  return apiRequest(`/appointments/${appointmentId}/status`, {
    method: "PATCH",
    body: { status }
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

export async function refreshSecurityAlerts({ lookbackHours = 24, limit = 300 } = {}) {
  const query = `?lookback_hours=${encodeURIComponent(lookbackHours)}&limit=${encodeURIComponent(limit)}`;
  return apiRequest(`/dashboard/security/refresh${query}`, {
    method: "POST"
  });
}

export async function getSecurityAlerts({ riskBand = "", limit = 80, lookbackDays = 30 } = {}) {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  params.set("lookback_days", String(lookbackDays));
  if (riskBand) {
    params.set("risk_band", riskBand);
  }
  return apiRequest(`/dashboard/security/alerts?${params.toString()}`);
}

export async function getSecuritySummary(lookbackDays = 30) {
  return apiRequest(`/dashboard/security/summary?lookback_days=${encodeURIComponent(lookbackDays)}`);
}
