import { useEffect, useMemo, useState } from "react";
import {
  addVitals,
  getAppointments,
  getDoctors,
  getNurses,
  getPatientRecord,
  getPatients,
  getTodaysAppointments,
  updateAppointmentStatus,
  updatePatient,
  updatePatientRecord
} from "../../services/ehrService";
import PatientRecordTable from "./PatientRecordTable";

function splitLines(value) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function extractFindingValue(text, label) {
  const source = String(text || "");
  const regex = new RegExp(`${label}:\\s*([^|]+)`, "i");
  const match = source.match(regex);
  return match ? match[1].trim() : "-";
}

function extractPrefixedValues(items, prefix) {
  const rows = (items || [])
    .filter((entry) => String(entry || "").toLowerCase().startsWith(prefix.toLowerCase()))
    .map((entry) => String(entry).slice(prefix.length).trim())
    .filter(Boolean);
  return rows.length ? rows.join(", ") : "-";
}

function extractPrefixedMultiline(items, prefix) {
  const rows = (items || [])
    .filter((entry) => String(entry || "").toLowerCase().startsWith(prefix.toLowerCase()))
    .map((entry) => String(entry).slice(prefix.length).trim())
    .filter(Boolean);
  return rows.join("\n");
}

export default function PatientOperationsPanel({ user }) {
  const isDoctorPortal = user?.role === "Doctor";
  const isNursePortal = user?.role === "Nurse";
  const isDoctorLikePortal = isDoctorPortal || isNursePortal;
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [nurses, setNurses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState(null);
  const [search, setSearch] = useState("");
  const [dataViewMode, setDataViewMode] = useState(false);
  const [allAppointments, setAllAppointments] = useState([]);
  const [dataDateFilter, setDataDateFilter] = useState("");
  const [dataSearchFilter, setDataSearchFilter] = useState("");
  const [appliedDataDateFilter, setAppliedDataDateFilter] = useState("");
  const [appliedDataSearchFilter, setAppliedDataSearchFilter] = useState("");
  const [patientRecordDateFilter, setPatientRecordDateFilter] = useState("");
  const [patientRecordSearchFilter, setPatientRecordSearchFilter] = useState("");
  const [todayAppointments, setTodayAppointments] = useState([]);
  const [todayPatientIds, setTodayPatientIds] = useState([]);
  const [showPatientRecordsTable, setShowPatientRecordsTable] = useState(true);
  const [doctorEditMode, setDoctorEditMode] = useState(false);
  const [medcareAssignMode, setMedcareAssignMode] = useState(false);
  const [medcareAssignNurseId, setMedcareAssignNurseId] = useState("");
  const [savingMedcare, setSavingMedcare] = useState(false);
  const [savingDoctorRecord, setSavingDoctorRecord] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const viewMode = dataViewMode;
  const [selectedPatientRecord, setSelectedPatientRecord] = useState(null);

  const [editForm, setEditForm] = useState({
    uhid: "",
    fullName: "",
    age: "",
    gender: "Male",
    assignedDoctorId: ""
  });
  const [recordForm, setRecordForm] = useState({
    chiefComplaint: "",
    pastMedicalHistory: "",
    socialFamilyHistory: ""
  });
  const [vitalsForm, setVitalsForm] = useState({
    bloodPressure: "",
    heartRate: "",
    temperature: "",
    spo2: "",
    respiratoryRate: "",
    physicalFindings: ""
  });
  const [nurseAssessmentForm, setNurseAssessmentForm] = useState({
    bloodGroup: "",
    bloodPressure: "",
    sugar: "",
    heartRate: "",
    height: "",
    weight: "",
    previousDisease: "",
    healthIssues: "",
    xrayImageNames: "",
    xrayReports: "",
    medicalReports: "",
    currentMedicines: ""
  });
  const [doctorEditForm, setDoctorEditForm] = useState({
    uhid: "",
    fullName: "",
    age: "",
    gender: "Male",
    chiefComplaint: "",
    pastMedicalHistory: "",
    socialFamilyHistory: "",
    bloodGroup: "",
    bloodPressure: "",
    sugar: "",
    heartRate: "",
    height: "",
    weight: "",
    xrayImage: "",
    xrayReport: "",
    healthIssues: "",
    medicalReports: "",
    currentMedicines: "",
    medcareNurseId: "",
    status: "Scheduled"
  });

  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true);
      try {
        const [patientRows, doctorRows, nurseRows] = await Promise.all([
          getPatients(search),
          getDoctors(),
          getNurses()
        ]);
        if (ignore) {
          return;
        }
        setPatients(patientRows);
        setDoctors(doctorRows);
        setNurses(nurseRows);
        if (!selectedPatientId && patientRows.length) {
          setSelectedPatientId(patientRows[0].id);
        }
      } catch (fetchError) {
        if (!ignore) {
          setError(fetchError.message);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [search, refreshKey]);

  useEffect(() => {
    let ignore = false;

    async function loadTodaysPatients() {
      try {
        const [todayRows, allRows] = await Promise.all([getTodaysAppointments(), getAppointments()]);
        if (ignore) {
          return;
        }
        const ids = [...new Set(todayRows.map((row) => row.patientId))];
        setTodayAppointments(todayRows);
        setAllAppointments(allRows);
        setTodayPatientIds(ids);
      } catch {
        if (!ignore) {
          setTodayAppointments([]);
          setAllAppointments([]);
          setTodayPatientIds([]);
        }
      }
    }

    loadTodaysPatients();
    const timer = setInterval(loadTodaysPatients, 12000);
    return () => {
      ignore = true;
      clearInterval(timer);
    };
  }, []);

  const visiblePatients = useMemo(() => {
    if (search.trim()) {
      return patients;
    }
    if (!todayPatientIds.length) {
      return patients;
    }
    return patients.filter((item) => todayPatientIds.includes(item.id));
  }, [patients, search, todayPatientIds]);

  const selectedTodayAppointment = useMemo(
    () => todayAppointments.find((row) => row.id === selectedAppointmentId) || null,
    [todayAppointments, selectedAppointmentId]
  );

  const filteredDataAppointments = useMemo(() => {
    if (!appliedDataDateFilter && !appliedDataSearchFilter.trim()) {
      return [];
    }

    const needle = appliedDataSearchFilter.trim().toLowerCase();
    return allAppointments.filter((row) => {
      const name = (row.patient?.fullName || "").toLowerCase();
      const uhid = (row.patient?.uhid || "").toLowerCase();
      const matchesText = !needle || name.includes(needle) || uhid.includes(needle);
      const matchesDate = !appliedDataDateFilter || row.appointmentDate === appliedDataDateFilter;
      return matchesText && matchesDate;
    });
  }, [allAppointments, appliedDataSearchFilter, appliedDataDateFilter]);

  const hasAppliedDoctorFilter = Boolean(appliedDataDateFilter || appliedDataSearchFilter.trim());

  const filteredPatientRecordAppointments = useMemo(() => {
    const needle = patientRecordSearchFilter.trim().toLowerCase();
    return allAppointments.filter((row) => {
      const name = (row.patient?.fullName || "").toLowerCase();
      const uhid = (row.patient?.uhid || "").toLowerCase();
      const matchesText = !needle || name.includes(needle) || uhid.includes(needle);
      const matchesDate = !patientRecordDateFilter || row.appointmentDate === patientRecordDateFilter;
      return matchesText && matchesDate;
    });
  }, [allAppointments, patientRecordDateFilter, patientRecordSearchFilter]);

  const hasPatientRecordFilter = Boolean(
    patientRecordDateFilter || patientRecordSearchFilter.trim()
  );

  const selectedPatient = useMemo(
    () => patients.find((item) => item.id === selectedPatientId) || null,
    [patients, selectedPatientId]
  );

  const selectedAnyAppointment = useMemo(
    () => allAppointments.find((row) => row.id === selectedAppointmentId) || null,
    [allAppointments, selectedAppointmentId]
  );

  const latestVitals = useMemo(() => {
    const rows = selectedPatientRecord?.vitals || [];
    return rows.length ? rows[0] : null;
  }, [selectedPatientRecord]);

  const detailBloodGroup = extractFindingValue(latestVitals?.physicalFindings, "Blood Group");
  const detailSugar = extractFindingValue(latestVitals?.physicalFindings, "Sugar");
  const detailHeight = extractFindingValue(latestVitals?.physicalFindings, "Height");
  const detailWeight = extractFindingValue(latestVitals?.physicalFindings, "Weight");

  useEffect(() => {
    if (!isDoctorLikePortal || !selectedPatient || !selectedAnyAppointment || doctorEditMode) {
      return;
    }
    setDoctorEditForm({
      uhid: selectedPatient.uhid || "",
      fullName: selectedPatient.full_name || "",
      age: String(selectedPatient.age || ""),
      gender: selectedPatient.gender || "Male",
      chiefComplaint: selectedPatientRecord?.chiefComplaint || "",
      pastMedicalHistory: (selectedPatientRecord?.pastMedicalHistory || []).join("\n"),
      socialFamilyHistory: (selectedPatientRecord?.socialFamilyHistory || []).join("\n"),
      bloodGroup: detailBloodGroup === "-" ? "" : detailBloodGroup,
      bloodPressure: latestVitals?.bloodPressure || "",
      sugar: detailSugar === "-" ? "" : detailSugar,
      heartRate: latestVitals?.heartRate || "",
      height: detailHeight === "-" ? "" : detailHeight,
      weight: detailWeight === "-" ? "" : detailWeight,
      xrayImage: extractPrefixedMultiline(selectedPatientRecord?.socialFamilyHistory, "X-ray image:"),
      xrayReport: extractPrefixedMultiline(selectedPatientRecord?.socialFamilyHistory, "X-ray:"),
      healthIssues: extractPrefixedMultiline(selectedPatientRecord?.socialFamilyHistory, "Health issue:"),
      medicalReports: extractPrefixedMultiline(selectedPatientRecord?.socialFamilyHistory, "Report:"),
      currentMedicines: extractPrefixedMultiline(selectedPatientRecord?.socialFamilyHistory, "Medicine:"),
      medcareNurseId: String(selectedPatient?.medcare_nurse_id || ""),
      status: selectedAnyAppointment.status || "Scheduled"
    });
  }, [
    isDoctorLikePortal,
    doctorEditMode,
    selectedPatient,
    selectedAnyAppointment,
    selectedPatientRecord,
    latestVitals,
    detailBloodGroup,
    detailSugar,
    detailHeight,
    detailWeight
  ]);

  useEffect(() => {
    if (isDoctorLikePortal) {
      setDoctorEditMode(false);
      setMedcareAssignMode(false);
    }
  }, [isDoctorLikePortal, selectedAppointmentId, selectedPatientId]);

  useEffect(() => {
    setMedcareAssignNurseId(String(selectedPatient?.medcare_nurse_id || ""));
  }, [selectedPatient?.id, selectedPatient?.medcare_nurse_id]);

  useEffect(() => {
    if (isDoctorLikePortal && viewMode) {
      const exists = filteredDataAppointments.some((item) => item.id === selectedAppointmentId);
      if (!exists) {
        setSelectedAppointmentId(null);
        setSelectedPatientId(null);
      }
      return;
    }

    if (!isDoctorLikePortal && !viewMode) {
      if (selectedAppointmentId && !allAppointments.some((item) => item.id === selectedAppointmentId)) {
        setSelectedAppointmentId(null);
        setSelectedPatientId(null);
      }
      return;
    }

    if (viewMode) {
      if (!visiblePatients.length) {
        setSelectedPatientId(null);
        return;
      }
      const exists = visiblePatients.some((item) => item.id === selectedPatientId);
      if (!exists) {
        setSelectedPatientId(visiblePatients[0].id);
      }
      return;
    }

    const appointmentExists = todayAppointments.some((item) => item.id === selectedAppointmentId);
    if (!appointmentExists) {
      setSelectedAppointmentId(null);
      setSelectedPatientId(null);
    }
  }, [
    visiblePatients,
    selectedPatientId,
    viewMode,
    todayAppointments,
    allAppointments,
    selectedAppointmentId,
    isDoctorLikePortal,
    filteredDataAppointments
  ]);

  useEffect(() => {
    if (!selectedPatient) {
      return;
    }
    setEditForm({
      uhid: selectedPatient.uhid,
      fullName: selectedPatient.full_name,
      age: String(selectedPatient.age),
      gender: selectedPatient.gender,
      assignedDoctorId: String(selectedPatient.assigned_doctor_id)
    });
  }, [selectedPatient]);

  useEffect(() => {
    if (!selectedPatientId) {
      return;
    }
    setNurseAssessmentForm({
      bloodGroup: "",
      bloodPressure: "",
      sugar: "",
      heartRate: "",
      height: "",
      weight: "",
      previousDisease: "",
      healthIssues: "",
      xrayImageNames: "",
      xrayReports: "",
      medicalReports: "",
      currentMedicines: ""
    });
  }, [selectedPatientId, refreshKey]);

  useEffect(() => {
    let ignore = false;
    async function loadRecord() {
      if (!selectedPatientId) {
        return;
      }
      try {
        const data = await getPatientRecord(selectedPatientId);
        if (ignore) {
          return;
        }
        setSelectedPatientRecord(data.record || null);
        setRecordForm({
          chiefComplaint: data.record.chiefComplaint || "",
          pastMedicalHistory: (data.record.pastMedicalHistory || []).join("\n"),
          socialFamilyHistory: (data.record.socialFamilyHistory || []).join("\n")
        });
      } catch {
        if (!ignore) {
          setSelectedPatientRecord(null);
          setRecordForm({
            chiefComplaint: "",
            pastMedicalHistory: "",
            socialFamilyHistory: ""
          });
        }
      }
    }
    loadRecord();
    return () => {
      ignore = true;
    };
  }, [selectedPatientId]);

  function mutateEditForm(name, value) {
    setEditForm((prev) => ({ ...prev, [name]: value }));
  }

  async function refreshSelectedPatientRecord(patientId = selectedPatientId) {
    if (!patientId) {
      return;
    }

    const data = await getPatientRecord(patientId);
    setSelectedPatientRecord(data.record || null);
    setRecordForm({
      chiefComplaint: data.record?.chiefComplaint || "",
      pastMedicalHistory: (data.record?.pastMedicalHistory || []).join("\n"),
      socialFamilyHistory: (data.record?.socialFamilyHistory || []).join("\n")
    });
  }

  async function handleUpdate(event) {
    event.preventDefault();
    if (!selectedPatientId) {
      setError("Select a patient to edit.");
      return;
    }
    setMessage("");
    setError("");
    try {
      await updatePatient(selectedPatientId, {
        uhid: editForm.uhid.trim(),
        full_name: editForm.fullName.trim(),
        age: Number(editForm.age),
        gender: editForm.gender,
        assigned_doctor_id:
          user.role === "Doctor" ? user.id : toNumber(editForm.assignedDoctorId)
      });
      setMessage("Patient demographics updated.");
      setRefreshKey((value) => value + 1);
    } catch (updateError) {
      setError(updateError.message);
    }
  }

  async function handleRecordUpdate(event) {
    event.preventDefault();
    if (!selectedPatientId) {
      setError("Select a patient to update record.");
      return;
    }
    setMessage("");
    setError("");
    try {
      await updatePatientRecord(selectedPatientId, {
        chief_complaint: recordForm.chiefComplaint,
        past_medical_history: splitLines(recordForm.pastMedicalHistory),
        social_family_history: splitLines(recordForm.socialFamilyHistory)
      });
      await refreshSelectedPatientRecord();
      setRefreshKey((value) => value + 1);
      setMessage("Clinical record updated.");
    } catch (recordError) {
      setError(recordError.message);
    }
  }

  async function handleVitals(event) {
    event.preventDefault();
    if (!selectedPatientId) {
      setError("Select a patient to add vitals.");
      return;
    }
    setMessage("");
    setError("");
    try {
      await addVitals(selectedPatientId, {
        blood_pressure: vitalsForm.bloodPressure,
        heart_rate: vitalsForm.heartRate,
        temperature: vitalsForm.temperature,
        spo2: vitalsForm.spo2,
        respiratory_rate: vitalsForm.respiratoryRate,
        physical_findings: vitalsForm.physicalFindings
      });
      setVitalsForm({
        bloodPressure: "",
        heartRate: "",
        temperature: "",
        spo2: "",
        respiratoryRate: "",
        physicalFindings: ""
      });
      await refreshSelectedPatientRecord();
      setRefreshKey((value) => value + 1);
      setMessage("Vitals saved to database.");
    } catch (vitalsError) {
      setError(vitalsError.message);
    }
  }

  async function handleNurseAssessmentSave(event) {
    event.preventDefault();
    if (!selectedPatientId) {
      setError("Select a patient to save nurse assessment.");
      return;
    }

    setMessage("");
    setError("");

    const previousDiseaseLines = splitLines(nurseAssessmentForm.previousDisease);
    const healthIssueLines = splitLines(nurseAssessmentForm.healthIssues).map(
      (item) => `Health issue: ${item}`
    );
    const medicinesLines = splitLines(nurseAssessmentForm.currentMedicines).map(
      (item) => `Medicine: ${item}`
    );
    const reportLines = [
      ...splitLines(nurseAssessmentForm.xrayImageNames).map((item) => `X-ray image: ${item}`),
      ...splitLines(nurseAssessmentForm.xrayReports).map((item) => `X-ray: ${item}`),
      ...splitLines(nurseAssessmentForm.medicalReports).map((item) => `Report: ${item}`)
    ];

    const findingsParts = [
      nurseAssessmentForm.bloodGroup ? `Blood Group: ${nurseAssessmentForm.bloodGroup}` : "",
      nurseAssessmentForm.sugar ? `Sugar: ${nurseAssessmentForm.sugar}` : "",
      nurseAssessmentForm.height ? `Height: ${nurseAssessmentForm.height}` : "",
      nurseAssessmentForm.weight ? `Weight: ${nurseAssessmentForm.weight}` : ""
    ].filter(Boolean);

    try {
      await updatePatientRecord(selectedPatientId, {
        chief_complaint: recordForm.chiefComplaint,
        past_medical_history: [...splitLines(recordForm.pastMedicalHistory), ...previousDiseaseLines],
        social_family_history: [
          ...splitLines(recordForm.socialFamilyHistory),
          ...healthIssueLines,
          ...medicinesLines,
          ...reportLines
        ]
      });

      await addVitals(selectedPatientId, {
        blood_pressure: nurseAssessmentForm.bloodPressure || "Not Provided",
        heart_rate: nurseAssessmentForm.heartRate || "Not Provided",
        temperature: "Not Provided",
        spo2: "Not Provided",
        respiratory_rate: "Not Provided",
        physical_findings: findingsParts.join(" | ") || "Nurse assessment updated"
      });

      await refreshSelectedPatientRecord();
      setRefreshKey((value) => value + 1);
      setMessage("Nurse assessment saved.");
    } catch (saveError) {
      setError(saveError.message || "Unable to save nurse assessment.");
    }
  }

  async function handleDoctorSaveAll(event) {
    event.preventDefault();
    if (savingDoctorRecord) {
      return;
    }
    if (!selectedPatientId) {
      setError("Select a patient first.");
      return;
    }

    const ageValue = Number(doctorEditForm.age);
    if (!Number.isFinite(ageValue) || ageValue <= 0) {
      setError("Age must be greater than 0 before saving.");
      return;
    }

    setMessage("");
    setError("");
    setSavingDoctorRecord(true);
    try {
      const preservedDoctorId =
        selectedPatient?.assigned_doctor_id ?? selectedAnyAppointment?.doctorId ?? null;

      const mergedSocialHistory = [
        ...splitLines(doctorEditForm.socialFamilyHistory),
        ...splitLines(doctorEditForm.healthIssues).map((item) => `Health issue: ${item}`),
        ...splitLines(doctorEditForm.xrayImage).map((item) => `X-ray image: ${item}`),
        ...splitLines(doctorEditForm.xrayReport).map((item) => `X-ray: ${item}`),
        ...splitLines(doctorEditForm.medicalReports).map((item) => `Report: ${item}`),
        ...splitLines(doctorEditForm.currentMedicines).map((item) => `Medicine: ${item}`)
      ];
      const nextPhysicalFindings = [
        doctorEditForm.bloodGroup ? `Blood Group: ${doctorEditForm.bloodGroup}` : "",
        doctorEditForm.sugar ? `Sugar: ${doctorEditForm.sugar}` : "",
        doctorEditForm.height ? `Height: ${doctorEditForm.height}` : "",
        doctorEditForm.weight ? `Weight: ${doctorEditForm.weight}` : ""
      ]
        .filter(Boolean)
        .join(" | ");

      const patientPayload = {
        uhid: doctorEditForm.uhid.trim(),
        full_name: doctorEditForm.fullName.trim(),
        age: ageValue,
        gender: doctorEditForm.gender
      };

      const demographicsChanged = Boolean(
        selectedPatient && (
          (selectedPatient.uhid || "") !== patientPayload.uhid ||
          (selectedPatient.full_name || "") !== patientPayload.full_name ||
          Number(selectedPatient.age || 0) !== patientPayload.age ||
          (selectedPatient.gender || "") !== patientPayload.gender
        )
      );

      const medcareNurseIdValue = toNumber(doctorEditForm.medcareNurseId);
      const medcareChanged = Boolean(
        isDoctorLikePortal &&
        Number(selectedPatient?.medcare_nurse_id || 0) !== Number(medcareNurseIdValue || 0)
      );

      if (isDoctorPortal) {
        patientPayload.assigned_doctor_id = user.id;
      } else if (preservedDoctorId !== null && preservedDoctorId !== undefined) {
        patientPayload.assigned_doctor_id = preservedDoctorId;
      }

      if (isDoctorLikePortal) {
        patientPayload.medcare_nurse_id = medcareNurseIdValue;
      }

      if (demographicsChanged || medcareChanged) {
        await updatePatient(selectedPatientId, patientPayload);
      }

      await updatePatientRecord(selectedPatientId, {
        chief_complaint: doctorEditForm.chiefComplaint,
        past_medical_history: splitLines(doctorEditForm.pastMedicalHistory),
        social_family_history: mergedSocialHistory
      });

      setPatients((prev) =>
        prev.map((patient) =>
          patient.id === selectedPatientId
            ? {
                ...patient,
                uhid: doctorEditForm.uhid.trim(),
                full_name: doctorEditForm.fullName.trim(),
                age: ageValue,
                gender: doctorEditForm.gender,
                medcare_nurse_id: medcareNurseIdValue,
                medcare_nurse_name:
                  nurses.find((nurse) => nurse.id === medcareNurseIdValue)?.full_name || null
              }
            : patient
        )
      );

      setSelectedPatientRecord((prev) => ({
        ...(prev || {}),
        chiefComplaint: doctorEditForm.chiefComplaint,
        pastMedicalHistory: splitLines(doctorEditForm.pastMedicalHistory),
        socialFamilyHistory: mergedSocialHistory,
        vitals: [
          {
            recordedAt: new Date().toISOString(),
            bloodPressure: doctorEditForm.bloodPressure || "Not Provided",
            heartRate: doctorEditForm.heartRate || "Not Provided",
            temperature: "Not Provided",
            spo2: "Not Provided",
            respiratoryRate: "Not Provided"
          },
          ...((prev?.vitals || []).slice(0, 19))
        ],
        physicalFindings: [nextPhysicalFindings, ...(prev?.physicalFindings || [])].filter(Boolean)
      }));

      try {
        await addVitals(selectedPatientId, {
          blood_pressure: doctorEditForm.bloodPressure || "Not Provided",
          heart_rate: doctorEditForm.heartRate || "Not Provided",
          temperature: "Not Provided",
          spo2: "Not Provided",
          respiratory_rate: "Not Provided",
          physical_findings: nextPhysicalFindings
        });
      } catch {
        // Keep core record save successful even if vitals insert fails.
      }

      setDoctorEditMode(false);
      await refreshSelectedPatientRecord();
      setRefreshKey((value) => value + 1);
      setMessage("Patient record updated successfully.");
    } catch (saveError) {
      setError(saveError.message || "Unable to update patient record.");
    } finally {
      setSavingDoctorRecord(false);
    }
  }

  async function handleDoctorStatusChange(nextStatus) {
    if (!selectedAppointmentId) {
      return;
    }
    setMessage("");
    setError("");
    try {
      await updateAppointmentStatus(selectedAppointmentId, nextStatus);
      setDoctorEditForm((prev) => ({ ...prev, status: nextStatus }));
      setTodayAppointments((prev) =>
        prev.map((item) => (item.id === selectedAppointmentId ? { ...item, status: nextStatus } : item))
      );
      setAllAppointments((prev) =>
        prev.map((item) => (item.id === selectedAppointmentId ? { ...item, status: nextStatus } : item))
      );
      setMessage("Appointment status updated.");
    } catch (statusError) {
      setError(statusError.message || "Unable to update appointment status.");
    }
  }

  async function handleAssignMedcare() {
    if (!selectedPatientId) {
      setError("Select a patient first.");
      return;
    }

    const nurseId = toNumber(medcareAssignNurseId);
    if (!nurseId) {
      setError("Select a nurse.");
      return;
    }

    setMessage("");
    setError("");
    setSavingMedcare(true);
    try {
      await updatePatient(selectedPatientId, { medcare_nurse_id: nurseId });
      const selectedNurse = nurses.find((nurse) => nurse.id === nurseId);
      setPatients((prev) =>
        prev.map((patient) =>
          patient.id === selectedPatientId
            ? {
                ...patient,
                medcare_nurse_id: nurseId,
                medcare_nurse_name: selectedNurse?.full_name || null
              }
            : patient
        )
      );
      setDoctorEditForm((prev) => ({ ...prev, medcareNurseId: String(nurseId) }));
      setMedcareAssignMode(false);
      setMessage("Medcare nurse assigned.");
    } catch (assignError) {
      setError(assignError.message || "Unable to assign medcare nurse.");
    } finally {
      setSavingMedcare(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-header-row">
        <h3>Patient Operations</h3>
        <div className="panel-actions-row">
          <button
            className={`btn ${isDoctorLikePortal ? (viewMode ? "subtle" : "primary") : (viewMode ? "primary" : "subtle")}`}
            onClick={() => {
              setMessage("");
              setError("");
              setSelectedAppointmentId(null);
              setSelectedPatientId(null);
              setDataViewMode(isDoctorLikePortal ? false : true);
            }}
            type="button"
          >
            Patients
          </button>
          <button
            className={`btn ${isDoctorLikePortal ? (viewMode ? "primary" : "subtle") : (viewMode ? "subtle" : "primary")}`}
            onClick={() => {
              setMessage("");
              setError("");
              setSelectedAppointmentId(null);
              setSelectedPatientId(null);
              setDataViewMode(isDoctorLikePortal ? true : false);
            }}
            type="button"
          >
            Records
          </button>
        </div>
      </div>

      <div className={`patient-ops-layout ${isDoctorPortal || isNursePortal ? "doctor-records-layout" : ""}`}>
        <div className="patient-list-side">
          {isDoctorLikePortal && (
            <div className="doctor-records-stack">
              {viewMode && (
                <div className="form-grid compact doctor-filters-grid">
                  <label>
                    Calendar (Date)
                    <input
                      onChange={(event) => setDataDateFilter(event.target.value)}
                      type="date"
                      value={dataDateFilter}
                    />
                  </label>
                  <label>
                    Search by Patient Name / UHID
                    <input
                      onChange={(event) => setDataSearchFilter(event.target.value)}
                      placeholder="Name or UHID"
                      type="text"
                      value={dataSearchFilter}
                    />
                  </label>
                  <button
                    className="btn subtle search-icon-btn"
                    onClick={() => {
                      if (!dataDateFilter && !dataSearchFilter.trim()) {
                        setAppliedDataDateFilter("");
                        setAppliedDataSearchFilter("");
                        setSelectedAppointmentId(null);
                        setSelectedPatientId(null);
                        return;
                      }
                      setAppliedDataDateFilter(dataDateFilter);
                      setAppliedDataSearchFilter(dataSearchFilter);
                      setSelectedAppointmentId(null);
                      setSelectedPatientId(null);
                    }}
                    title="Search"
                    type="button"
                  >
                    &#128269;
                  </button>
                </div>
              )}

              <div className="table-wrap doctor-table-wrap">
                <table className="data-table mini-table">
                  <thead>
                    {!viewMode && (
                      <tr>
                        <th>Name</th>
                        <th>UHID</th>
                        <th>Time</th>
                        <th>Status</th>
                      </tr>
                    )}
                    {viewMode && (
                      <tr>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Name</th>
                        <th>UHID</th>
                        <th>Status</th>
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {!viewMode &&
                      todayAppointments.map((appt) => (
                        <tr
                          className={`selectable-row ${selectedAppointmentId === appt.id ? "selected" : ""}`}
                          key={appt.id}
                          onClick={() => {
                            const sameRow = selectedAppointmentId === appt.id;
                            if (sameRow) {
                              setSelectedAppointmentId(null);
                              setSelectedPatientId(null);
                            } else {
                              setSelectedAppointmentId(appt.id);
                              setSelectedPatientId(appt.patientId);
                            }
                          }}
                        >
                          <td>{appt.patient?.fullName || "Unknown"}</td>
                          <td>{appt.patient?.uhid || "N/A"}</td>
                          <td>{appt.appointmentTime}</td>
                          <td>{appt.status === "Completed" ? "Completed" : "Not Completed"}</td>
                        </tr>
                      ))}

                    {viewMode &&
                      filteredDataAppointments.map((appt) => (
                        <tr
                          className={`selectable-row ${selectedAppointmentId === appt.id ? "selected" : ""}`}
                          key={appt.id}
                          onClick={() => {
                            const sameRow = selectedAppointmentId === appt.id;
                            if (sameRow) {
                              setSelectedAppointmentId(null);
                              setSelectedPatientId(null);
                            } else {
                              setSelectedAppointmentId(appt.id);
                              setSelectedPatientId(appt.patientId);
                            }
                          }}
                        >
                          <td>{appt.appointmentDate}</td>
                          <td>{appt.appointmentTime}</td>
                          <td>{appt.patient?.fullName || "Unknown"}</td>
                          <td>{appt.patient?.uhid || "N/A"}</td>
                          <td>{appt.status}</td>
                        </tr>
                      ))}

                    {!viewMode && !todayAppointments.length && (
                      <tr>
                        <td colSpan="4">No allocated patients for today.</td>
                      </tr>
                    )}

                    {viewMode && !filteredDataAppointments.length && (
                      <tr>
                        <td colSpan="5">
                          {hasAppliedDoctorFilter
                            ? "No records match selected filters."
                            : "Select Date or Name/UHID, then click search."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {selectedAnyAppointment && selectedPatient && (
                <div className="form-block">
                  <div className="panel-header-row">
                    <h4>Patient Record</h4>
                    <div className="panel-actions-row">
                      <button
                        className="btn subtle"
                        onClick={() => {
                          setMedcareAssignMode((value) => !value);
                          setDoctorEditMode(false);
                        }}
                        type="button"
                      >
                        {medcareAssignMode ? "Cancel" : "Assign Medcare"}
                      </button>
                      <button
                        className="btn subtle"
                        onClick={() => {
                          setDoctorEditMode((value) => !value);
                          setMedcareAssignMode(false);
                        }}
                        type="button"
                      >
                        {doctorEditMode ? "Cancel" : "Edit"}
                      </button>
                    </div>
                  </div>
                  {medcareAssignMode && (
                    <div className="form-grid compact">
                      <label>
                        Assign Medcare Nurse
                        <select
                          onChange={(event) => setMedcareAssignNurseId(event.target.value)}
                          value={medcareAssignNurseId}
                        >
                          <option value="">Select nurse</option>
                          {nurses.map((nurse) => (
                            <option key={nurse.id} value={nurse.id}>
                              {nurse.full_name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="btn primary"
                        disabled={savingMedcare}
                        onClick={handleAssignMedcare}
                        type="button"
                      >
                        {savingMedcare ? "Saving..." : "Save Medcare"}
                      </button>
                    </div>
                  )}
                  {doctorEditMode ? (
                  <form onSubmit={handleDoctorSaveAll}>
                    <div className="table-wrap">
                      <table className="data-table mini-table doctor-edit-table">
                        <tbody>
                          <tr>
                            <th>Name</th>
                            <td>
                              {doctorEditMode ? (
                                <input
                                  onChange={(event) =>
                                    setDoctorEditForm((prev) => ({ ...prev, fullName: event.target.value }))
                                  }
                                  type="text"
                                  value={doctorEditForm.fullName}
                                />
                              ) : (
                                selectedPatient.full_name || "-"
                              )}
                            </td>
                            <th>UHID</th>
                            <td>
                              {doctorEditMode ? (
                                <input
                                  onChange={(event) =>
                                    setDoctorEditForm((prev) => ({ ...prev, uhid: event.target.value }))
                                  }
                                  type="text"
                                  value={doctorEditForm.uhid}
                                />
                              ) : (
                                selectedPatient.uhid || "-"
                              )}
                            </td>
                            <th>Age</th>
                            <td>
                              {doctorEditMode ? (
                                <input
                                  onChange={(event) =>
                                    setDoctorEditForm((prev) => ({ ...prev, age: event.target.value }))
                                  }
                                  type="number"
                                  value={doctorEditForm.age}
                                />
                              ) : (
                                selectedPatient.age || "-"
                              )}
                            </td>
                          </tr>
                          <tr>
                            <th>Gender</th>
                            <td>
                              {doctorEditMode ? (
                                <select
                                  onChange={(event) =>
                                    setDoctorEditForm((prev) => ({ ...prev, gender: event.target.value }))
                                  }
                                  value={doctorEditForm.gender}
                                >
                                  <option>Male</option>
                                  <option>Female</option>
                                  <option>Other</option>
                                </select>
                              ) : (
                                selectedPatient.gender || "-"
                              )}
                            </td>
                            <th>Blood Group</th>
                            <td>
                              {doctorEditMode ? (
                                <input
                                  onChange={(event) =>
                                    setDoctorEditForm((prev) => ({ ...prev, bloodGroup: event.target.value }))
                                  }
                                  type="text"
                                  value={doctorEditForm.bloodGroup}
                                />
                              ) : (
                                detailBloodGroup
                              )}
                            </td>
                            <th>Blood Pressure</th>
                            <td>
                              {doctorEditMode ? (
                                <input
                                  onChange={(event) =>
                                    setDoctorEditForm((prev) => ({ ...prev, bloodPressure: event.target.value }))
                                  }
                                  type="text"
                                  value={doctorEditForm.bloodPressure}
                                />
                              ) : (
                                latestVitals?.bloodPressure || "-"
                              )}
                            </td>
                          </tr>
                          <tr>
                            <th>Sugar</th>
                            <td>
                              {doctorEditMode ? (
                                <input
                                  onChange={(event) =>
                                    setDoctorEditForm((prev) => ({ ...prev, sugar: event.target.value }))
                                  }
                                  type="text"
                                  value={doctorEditForm.sugar}
                                />
                              ) : (
                                detailSugar
                              )}
                            </td>
                            <th>Heart Rate</th>
                            <td>
                              {doctorEditMode ? (
                                <input
                                  onChange={(event) =>
                                    setDoctorEditForm((prev) => ({ ...prev, heartRate: event.target.value }))
                                  }
                                  type="text"
                                  value={doctorEditForm.heartRate}
                                />
                              ) : (
                                latestVitals?.heartRate || "-"
                              )}
                            </td>
                            <th>Height</th>
                            <td>
                              {doctorEditMode ? (
                                <input
                                  onChange={(event) =>
                                    setDoctorEditForm((prev) => ({ ...prev, height: event.target.value }))
                                  }
                                  type="text"
                                  value={doctorEditForm.height}
                                />
                              ) : (
                                detailHeight
                              )}
                            </td>
                          </tr>
                          <tr>
                            <th>Weight</th>
                            <td>
                              {doctorEditMode ? (
                                <input
                                  onChange={(event) =>
                                    setDoctorEditForm((prev) => ({ ...prev, weight: event.target.value }))
                                  }
                                  type="text"
                                  value={doctorEditForm.weight}
                                />
                              ) : (
                                detailWeight
                              )}
                            </td>
                            <th>Chief Complaint</th>
                            <td colSpan="3">
                              {doctorEditMode ? (
                                <textarea
                                  onChange={(event) =>
                                    setDoctorEditForm((prev) => ({ ...prev, chiefComplaint: event.target.value }))
                                  }
                                  rows={2}
                                  value={doctorEditForm.chiefComplaint}
                                />
                              ) : (
                                selectedPatientRecord?.chiefComplaint || "-"
                              )}
                            </td>
                          </tr>
                          <tr>
                            <th>Past Medical History</th>
                            <td colSpan="2">
                              {doctorEditMode ? (
                                <textarea
                                  onChange={(event) =>
                                    setDoctorEditForm((prev) => ({ ...prev, pastMedicalHistory: event.target.value }))
                                  }
                                  rows={2}
                                  value={doctorEditForm.pastMedicalHistory}
                                />
                              ) : (
                                (selectedPatientRecord?.pastMedicalHistory || []).join(", ") || "-"
                              )}
                            </td>
                            <th>Social / Family History</th>
                            <td colSpan="2">
                              {doctorEditMode ? (
                                <textarea
                                  onChange={(event) =>
                                    setDoctorEditForm((prev) => ({ ...prev, socialFamilyHistory: event.target.value }))
                                  }
                                  rows={2}
                                  value={doctorEditForm.socialFamilyHistory}
                                />
                              ) : (
                                (selectedPatientRecord?.socialFamilyHistory || []).join(", ") || "-"
                              )}
                            </td>
                          </tr>
                          <tr>
                            <th>X-ray image</th>
                            <td colSpan="2">
                              {doctorEditMode ? (
                                <textarea
                                  onChange={(event) =>
                                    setDoctorEditForm((prev) => ({ ...prev, xrayImage: event.target.value }))
                                  }
                                  placeholder="Image name or path"
                                  rows={1}
                                  value={doctorEditForm.xrayImage}
                                />
                              ) : (
                                extractPrefixedValues(selectedPatientRecord?.socialFamilyHistory, "X-ray image:")
                              )}
                            </td>
                            <th>X-ray report</th>
                            <td colSpan="2">
                              {doctorEditMode ? (
                                <textarea
                                  onChange={(event) =>
                                    setDoctorEditForm((prev) => ({ ...prev, xrayReport: event.target.value }))
                                  }
                                  rows={2}
                                  value={doctorEditForm.xrayReport}
                                />
                              ) : (
                                extractPrefixedValues(selectedPatientRecord?.socialFamilyHistory, "X-ray:")
                              )}
                            </td>
                          </tr>
                          <tr>
                            <th>Health Issues</th>
                            <td colSpan="2">
                              {doctorEditMode ? (
                                <textarea
                                  onChange={(event) =>
                                    setDoctorEditForm((prev) => ({ ...prev, healthIssues: event.target.value }))
                                  }
                                  rows={2}
                                  value={doctorEditForm.healthIssues}
                                />
                              ) : (
                                extractPrefixedValues(selectedPatientRecord?.socialFamilyHistory, "Health issue:")
                              )}
                            </td>
                            <th>Medical Reports</th>
                            <td colSpan="2">
                              {doctorEditMode ? (
                                <textarea
                                  onChange={(event) =>
                                    setDoctorEditForm((prev) => ({ ...prev, medicalReports: event.target.value }))
                                  }
                                  rows={2}
                                  value={doctorEditForm.medicalReports}
                                />
                              ) : (
                                extractPrefixedValues(selectedPatientRecord?.socialFamilyHistory, "Report:")
                              )}
                            </td>
                          </tr>
                          <tr>
                            <th>Current Medicines</th>
                            <td colSpan="5">
                              {doctorEditMode ? (
                                <textarea
                                  onChange={(event) =>
                                    setDoctorEditForm((prev) => ({ ...prev, currentMedicines: event.target.value }))
                                  }
                                  rows={2}
                                  value={doctorEditForm.currentMedicines}
                                />
                              ) : (
                                extractPrefixedValues(selectedPatientRecord?.socialFamilyHistory, "Medicine:")
                              )}
                            </td>
                          </tr>
                          <tr>
                            <th>Assign Medcare</th>
                            <td colSpan="5">
                              {doctorEditMode && isDoctorLikePortal ? (
                                <select
                                  onChange={(event) =>
                                    setDoctorEditForm((prev) => ({ ...prev, medcareNurseId: event.target.value }))
                                  }
                                  value={doctorEditForm.medcareNurseId}
                                >
                                  <option value="">Select nurse</option>
                                  {nurses.map((nurse) => (
                                    <option key={nurse.id} value={nurse.id}>
                                      {nurse.full_name}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                selectedPatient?.medcare_nurse_name ||
                                "-"
                              )}
                            </td>
                          </tr>
                          <tr>
                            <th>Status</th>
                            <td colSpan="5">
                              {doctorEditMode && isDoctorPortal ? (
                                <div className="status-radio-row">
                                  {[
                                    "Scheduled",
                                    "Checked In",
                                    "In Consultation",
                                    "Completed"
                                  ].map((statusOption) => (
                                    <label key={statusOption}>
                                      <input
                                        checked={doctorEditForm.status === statusOption}
                                        name="doctor-status"
                                        onChange={() => handleDoctorStatusChange(statusOption)}
                                        type="radio"
                                      />
                                      {statusOption}
                                    </label>
                                  ))}
                                </div>
                              ) : (
                                selectedAnyAppointment.status || "Scheduled"
                              )}
                            </td>
                          </tr>
                          {doctorEditMode && (
                            <tr>
                              <td colSpan="6">
                                <button className="btn primary" disabled={savingDoctorRecord} type="submit">
                                  {savingDoctorRecord ? "Saving..." : "Save All"}
                                </button>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </form>
                  ) : (
                    <PatientRecordTable
                      patient={selectedPatient}
                      record={selectedPatientRecord}
                      status={selectedAnyAppointment.status || "Scheduled"}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {!isDoctorLikePortal && (
            <>
              {viewMode && (
                <div className="table-wrap doctor-table-wrap">
                  <table className="data-table mini-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>UHID</th>
                        <th>Time</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {todayAppointments.map((appt) => (
                        <tr
                          className={`selectable-row ${selectedAppointmentId === appt.id ? "selected" : ""}`}
                          key={appt.id}
                          onClick={() => {
                            const sameRow = selectedAppointmentId === appt.id;
                            if (sameRow) {
                              setSelectedAppointmentId(null);
                              setSelectedPatientId(null);
                            } else {
                              setSelectedAppointmentId(appt.id);
                              setSelectedPatientId(appt.patientId);
                            }
                          }}
                        >
                          <td>{appt.patient?.fullName || "Unknown"}</td>
                          <td>{appt.patient?.uhid || "N/A"}</td>
                          <td>{appt.appointmentTime}</td>
                          <td>{appt.status === "Completed" ? "Completed" : "Not Completed"}</td>
                        </tr>
                      ))}

                      {!todayAppointments.length && (
                        <tr>
                          <td colSpan="4">No allocated patients for today.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {!viewMode && (
                <>
                  <button
                    className="btn subtle"
                    onClick={() => setShowPatientRecordsTable((value) => !value)}
                    type="button"
                  >
                    Patient's Record
                  </button>
                  {showPatientRecordsTable && (
                    <>
                      <div className="form-grid compact patient-record-filters-grid">
                        <label>
                          Filter by Date
                          <input
                            onChange={(event) => {
                              setPatientRecordDateFilter(event.target.value);
                              setPatientRecordSearchFilter("");
                            }}
                            type="date"
                            value={patientRecordDateFilter}
                          />
                        </label>
                        <label>
                          Search by Name / UHID
                          <input
                            onChange={(event) => setPatientRecordSearchFilter(event.target.value)}
                            placeholder="Name or UHID"
                            type="text"
                            value={patientRecordSearchFilter}
                          />
                        </label>
                      </div>

                      <div className="table-wrap">
                        <table className="data-table mini-table">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Name</th>
                              <th>UHID</th>
                              <th>Time</th>
                              <th>Status</th>
                              <th>Check-In</th>
                            </tr>
                          </thead>
                          <tbody>
                            {hasPatientRecordFilter &&
                              filteredPatientRecordAppointments.map((appt) => (
                                <tr
                                  className={`selectable-row ${selectedAppointmentId === appt.id ? "selected" : ""}`}
                                  key={appt.id}
                                  onClick={() => {
                                    const sameRow = selectedAppointmentId === appt.id;
                                    if (sameRow) {
                                      setSelectedAppointmentId(null);
                                      setSelectedPatientId(null);
                                    } else {
                                      setSelectedAppointmentId(appt.id);
                                      setSelectedPatientId(appt.patientId);
                                    }
                                  }}
                                >
                                  <td>{appt.appointmentDate}</td>
                                  <td>{appt.patient?.fullName || "Unknown"}</td>
                                  <td>{appt.patient?.uhid || "N/A"}</td>
                                  <td>{appt.appointmentTime}</td>
                                  <td>{appt.status}</td>
                                  <td>{appt.status === "Scheduled" ? "Not Completed" : "Completed"}</td>
                                </tr>
                              ))}

                            {!hasPatientRecordFilter && (
                              <tr>
                                <td colSpan="6">Choose a date or type Name/UHID to view filtered records.</td>
                              </tr>
                            )}

                            {hasPatientRecordFilter && !filteredPatientRecordAppointments.length && (
                              <tr>
                                <td colSpan="6">No records match selected filters.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}

              {isNursePortal && selectedAnyAppointment && selectedPatient && (
                <div className="form-block">
                  <PatientRecordTable
                    patient={selectedPatient}
                    record={selectedPatientRecord}
                    status={selectedAnyAppointment.status || "Scheduled"}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {!isDoctorLikePortal && <div className={`patient-forms-side ${isNursePortal ? "nurse-forms-side" : ""}`}>
          {viewMode && selectedPatient && !isNursePortal && (
            <>
              <div className="form-block">
                <h4>Edit Patient</h4>
                <form className="form-grid compact" onSubmit={handleUpdate}>
                  <input
                    onChange={(event) => mutateEditForm("uhid", event.target.value)}
                    required
                    type="text"
                    value={editForm.uhid}
                  />
                  <input
                    onChange={(event) => mutateEditForm("fullName", event.target.value)}
                    required
                    type="text"
                    value={editForm.fullName}
                  />
                  <input
                    min="1"
                    onChange={(event) => mutateEditForm("age", event.target.value)}
                    required
                    type="number"
                    value={editForm.age}
                  />
                  <select
                    onChange={(event) => mutateEditForm("gender", event.target.value)}
                    value={editForm.gender}
                  >
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                  {user.role === "Nurse" && (
                    <select
                      onChange={(event) => mutateEditForm("assignedDoctorId", event.target.value)}
                      required
                      value={editForm.assignedDoctorId}
                    >
                      {doctors.map((doctor) => (
                        <option key={doctor.id} value={doctor.id}>
                          {doctor.full_name}
                        </option>
                      ))}
                    </select>
                  )}
                  <button className="btn subtle" type="submit">
                    Save Demographics
                  </button>
                </form>
              </div>

              <div className="form-block">
                <h4>Edit Clinical Record</h4>
                <form className="form-grid compact" onSubmit={handleRecordUpdate}>
                  <textarea
                    onChange={(event) =>
                      setRecordForm((prev) => ({ ...prev, chiefComplaint: event.target.value }))
                    }
                    placeholder="Chief Complaint"
                    rows={2}
                    value={recordForm.chiefComplaint}
                  />
                  <textarea
                    onChange={(event) =>
                      setRecordForm((prev) => ({
                        ...prev,
                        pastMedicalHistory: event.target.value
                      }))
                    }
                    placeholder="Past Medical History (one per line)"
                    rows={3}
                    value={recordForm.pastMedicalHistory}
                  />
                  <textarea
                    onChange={(event) =>
                      setRecordForm((prev) => ({
                        ...prev,
                        socialFamilyHistory: event.target.value
                      }))
                    }
                    placeholder="Social / Family History (one per line)"
                    rows={3}
                    value={recordForm.socialFamilyHistory}
                  />
                  <button className="btn subtle" type="submit">
                    Save Clinical Record
                  </button>
                </form>
              </div>

              <div className="form-block">
                <h4>Add Vitals</h4>
                <form className="form-grid compact vitals-grid" onSubmit={handleVitals}>
                  <input
                    onChange={(event) =>
                      setVitalsForm((prev) => ({ ...prev, bloodPressure: event.target.value }))
                    }
                    placeholder="BP (e.g. 120/80)"
                    required
                    type="text"
                    value={vitalsForm.bloodPressure}
                  />
                  <input
                    onChange={(event) =>
                      setVitalsForm((prev) => ({ ...prev, heartRate: event.target.value }))
                    }
                    placeholder="Heart Rate"
                    required
                    type="text"
                    value={vitalsForm.heartRate}
                  />
                  <input
                    onChange={(event) =>
                      setVitalsForm((prev) => ({ ...prev, temperature: event.target.value }))
                    }
                    placeholder="Temperature"
                    required
                    type="text"
                    value={vitalsForm.temperature}
                  />
                  <input
                    onChange={(event) =>
                      setVitalsForm((prev) => ({ ...prev, spo2: event.target.value }))
                    }
                    placeholder="SpO2"
                    required
                    type="text"
                    value={vitalsForm.spo2}
                  />
                  <input
                    onChange={(event) =>
                      setVitalsForm((prev) => ({ ...prev, respiratoryRate: event.target.value }))
                    }
                    placeholder="Respiratory Rate"
                    required
                    type="text"
                    value={vitalsForm.respiratoryRate}
                  />
                  <textarea
                    onChange={(event) =>
                      setVitalsForm((prev) => ({ ...prev, physicalFindings: event.target.value }))
                    }
                    placeholder="Physical Findings"
                    rows={2}
                    value={vitalsForm.physicalFindings}
                  />
                  <button className="btn primary" type="submit">
                    Save Vitals
                  </button>
                </form>
              </div>
            </>
          )}
        </div>}
      </div>

      {message && <p className="notice mt-12">{message}</p>}
      {error && <p className="error mt-12">{error}</p>}
    </section>
  );
}
