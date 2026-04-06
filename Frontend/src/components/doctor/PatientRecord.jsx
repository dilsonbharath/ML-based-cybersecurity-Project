function ResultCell({ value }) {
  const isAbnormal = value === "Abnormal";
  return <span className={isAbnormal ? "abnormal" : ""}>{value}</span>;
}

export default function PatientRecord({ appointment, patientRecord, loading }) {
  if (!appointment || !patientRecord) {
    return (
      <section className="panel">
        <h3>Patient Record</h3>
        <p className="empty-state">
          {loading ? "Loading patient record..." : "Select an appointment to view full patient record."}
        </p>
      </section>
    );
  }

  const { patient, record } = patientRecord;
  const safeRecord = {
    chiefComplaint: record?.chiefComplaint || "",
    pastMedicalHistory: record?.pastMedicalHistory || [],
    socialFamilyHistory: record?.socialFamilyHistory || [],
    vitals: record?.vitals || [],
    physicalFindings: record?.physicalFindings || [],
    labOrders: record?.labOrders || [],
    labResults: record?.labResults || [],
    imagingOrders: record?.imagingOrders || [],
    billing: record?.billing || { billingStatus: "", insuranceApproval: "" },
    chargeCapture: record?.chargeCapture || []
  };

  return (
    <section className="panel">
      <h3>Patient Record</h3>

      <article className="record-section">
        <h4>1. Patient Demographics & Identification (Read-Only)</h4>
        <div className="table-wrap">
          <table className="data-table mini-table">
            <tbody>
              <tr>
                <th>Name</th>
                <td>{patient.fullName}</td>
                <th>Age</th>
                <td>{patient.age}</td>
              </tr>
              <tr>
                <th>Gender</th>
                <td>{patient.gender}</td>
                <th>UHID</th>
                <td>{patient.uhid}</td>
              </tr>
              <tr>
                <th>Doctor Assigned</th>
                <td colSpan="3">{patient.doctorAssigned}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article className="record-section">
        <h4>2. Clinical History & Current Issues (Read & Write)</h4>
        <div className="table-wrap">
          <table className="data-table mini-table">
            <tbody>
              <tr>
                <th>Chief Complaint</th>
                <td>{safeRecord.chiefComplaint || "-"}</td>
              </tr>
              <tr>
                <th>Past Medical History</th>
                <td>{safeRecord.pastMedicalHistory.length ? safeRecord.pastMedicalHistory.join(", ") : "-"}</td>
              </tr>
              <tr>
                <th>Social / Family History</th>
                <td>{safeRecord.socialFamilyHistory.length ? safeRecord.socialFamilyHistory.join(", ") : "-"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article className="record-section">
        <h4>3. Vitals & Physical Examination (Read & Write)</h4>
        <div className="table-wrap">
          <table className="data-table mini-table">
            <thead>
              <tr>
                <th>Recorded At</th>
                <th>BP</th>
                <th>Heart Rate</th>
                <th>Temperature</th>
                <th>SpO2</th>
                <th>Respiratory Rate</th>
              </tr>
            </thead>
            <tbody>
              {safeRecord.vitals.map((item) => (
                <tr key={item.recordedAt}>
                  <td>{item.recordedAt}</td>
                  <td>{item.bloodPressure}</td>
                  <td>{item.heartRate}</td>
                  <td>{item.temperature}</td>
                  <td>{item.spo2}</td>
                  <td>{item.respiratoryRate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-wrap">
          <table className="data-table mini-table">
            <tbody>
              <tr>
                <th>Physical Findings</th>
                <td>{safeRecord.physicalFindings.length ? safeRecord.physicalFindings.join(", ") : "-"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </article>

      <article className="record-section">
        <h4>4. Investigations & Lab Work (Read & Write Orders)</h4>
        <p className="section-key">Blood Test Orders:</p>
        <div className="table-wrap">
          <table className="data-table mini-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Test</th>
                <th>Ordered At</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {safeRecord.labOrders.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.testName}</td>
                  <td>{item.orderedAt}</td>
                  <td>{item.status}</td>
                </tr>
              ))}
              {!safeRecord.labOrders.length && (
                <tr>
                  <td colSpan="4">No lab orders.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="section-key">Blood Test Results:</p>
        <div className="table-wrap">
          <table className="data-table mini-table">
            <thead>
              <tr>
                <th>Test</th>
                <th>Result</th>
                <th>Flag</th>
                <th>Reported At</th>
              </tr>
            </thead>
            <tbody>
              {safeRecord.labResults.map((item) => (
                <tr key={`${item.labOrderId}-${item.reportedAt}`}>
                  <td>{item.testName}</td>
                  <td>{item.resultValue}</td>
                  <td>
                    <ResultCell value={item.flag} />
                  </td>
                  <td>{item.reportedAt}</td>
                </tr>
              ))}
              {!safeRecord.labResults.length && (
                <tr>
                  <td colSpan="4">No lab results available.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="section-key">Imaging:</p>
        <div className="table-wrap">
          <table className="data-table mini-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {safeRecord.imagingOrders.map((item) => (
                <tr key={item.id}>
                  <td>{item.id}</td>
                  <td>{item.imagingType}</td>
                  <td>{item.status}</td>
                </tr>
              ))}
              {!safeRecord.imagingOrders.length && (
                <tr>
                  <td colSpan="3">No imaging orders.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>

      <article className="record-section">
        <h4>5. Financials & Billing (Read-Only/Limited)</h4>
        <div className="table-wrap">
          <table className="data-table mini-table">
            <tbody>
              <tr>
                <th>Billing Status</th>
                <td>{safeRecord.billing.billingStatus || "-"}</td>
                <th>Insurance Approval</th>
                <td>{safeRecord.billing.insuranceApproval || "-"}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="section-key">Charge Capture:</p>
        <div className="table-wrap">
          <table className="data-table mini-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Amount</th>
                <th>Captured At</th>
              </tr>
            </thead>
            <tbody>
              {safeRecord.chargeCapture.map((item) => (
                <tr key={`${item.item}-${item.capturedAt}`}>
                  <td>{item.item}</td>
                  <td>{item.amount}</td>
                  <td>{item.capturedAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}
