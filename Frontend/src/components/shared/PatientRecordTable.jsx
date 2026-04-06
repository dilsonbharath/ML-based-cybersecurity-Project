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

function extractUnprefixedValues(items, prefixes) {
  const lowered = (prefixes || []).map((prefix) => prefix.toLowerCase());
  const rows = (items || [])
    .filter((entry) => {
      const value = String(entry || "").toLowerCase();
      return !lowered.some((prefix) => value.startsWith(prefix));
    })
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);
  return rows.length ? rows.join(", ") : "-";
}

export default function PatientRecordTable({ patient, record, status }) {
  const latestVitals = record?.vitals?.[0] || null;
  const detailBloodGroup = extractFindingValue(latestVitals?.physicalFindings, "Blood Group");
  const detailSugar = extractFindingValue(latestVitals?.physicalFindings, "Sugar");
  const detailHeight = extractFindingValue(latestVitals?.physicalFindings, "Height");
  const detailWeight = extractFindingValue(latestVitals?.physicalFindings, "Weight");

  if (!patient) {
    return null;
  }

  return (
    <div className="table-wrap">
      <table className="data-table mini-table doctor-edit-table">
        <tbody>
          <tr>
            <th>Name</th>
            <td>{patient.full_name || "-"}</td>
            <th>UHID</th>
            <td>{patient.uhid || "-"}</td>
            <th>Age</th>
            <td>{patient.age || "-"}</td>
          </tr>
          <tr>
            <th>Gender</th>
            <td>{patient.gender || "-"}</td>
            <th>Blood Group</th>
            <td>{detailBloodGroup}</td>
            <th>Blood Pressure</th>
            <td>{latestVitals?.bloodPressure || "-"}</td>
          </tr>
          <tr>
            <th>Sugar</th>
            <td>{detailSugar}</td>
            <th>Heart Rate</th>
            <td>{latestVitals?.heartRate || "-"}</td>
            <th>Height</th>
            <td>{detailHeight}</td>
          </tr>
          <tr>
            <th>Weight</th>
            <td>{detailWeight}</td>
            <th>Chief Complaint</th>
            <td colSpan="3">{record?.chiefComplaint || "-"}</td>
          </tr>
          <tr>
            <th>Past Medical History</th>
            <td colSpan="2">{(record?.pastMedicalHistory || []).join(", ") || "-"}</td>
            <th>Social / Family History</th>
            <td colSpan="2">
              {extractUnprefixedValues(record?.socialFamilyHistory, [
                "Health issue:",
                "X-ray image:",
                "X-ray:",
                "Report:",
                "Medicine:"
              ])}
            </td>
          </tr>
          <tr>
            <th>X-ray image</th>
            <td colSpan="2">{extractPrefixedValues(record?.socialFamilyHistory, "X-ray image:")}</td>
            <th>X-ray report</th>
            <td colSpan="2">{extractPrefixedValues(record?.socialFamilyHistory, "X-ray:")}</td>
          </tr>
          <tr>
            <th>Health Issues</th>
            <td colSpan="2">{extractPrefixedValues(record?.socialFamilyHistory, "Health issue:")}</td>
            <th>Medical Reports</th>
            <td colSpan="2">{extractPrefixedValues(record?.socialFamilyHistory, "Report:")}</td>
          </tr>
          <tr>
            <th>Current Medicines</th>
            <td colSpan="5">{extractPrefixedValues(record?.socialFamilyHistory, "Medicine:")}</td>
          </tr>
          <tr>
            <th>Status</th>
            <td colSpan="5">{status || "Scheduled"}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
