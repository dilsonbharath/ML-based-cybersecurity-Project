import { useEffect, useState } from "react";
import {
  getSecurityAlerts,
  getSecuritySummary,
  getPendingApprovals,
  getRoleWiseUsers,
  refreshSecurityAlerts,
  updateUserApproval,
  updateUserShift
} from "../../services/ehrService";

const SHIFT_OPTIONS = ["2-10", "10-18", "18-2"];

const DEMO_ML_RISK_ALERTS = [
  {
    id: "demo-mathan-offshift-login",
    user_name: "Nurse Mathan",
    user_code: "USR-009991",
    role: "Nurse",
    action: "signin",
    entity_type: "patient_record",
    entity_id: "UHID-2026-1003",
    risk_score: 94,
    risk_band: "anomaly",
    reason_codes: "off_shift_login|off_shift_record_access",
    details: "Signed in at 01:42 UTC and opened patient records outside assigned 10-18 shift.",
    is_demo: true
  },
  {
    id: "demo-regdesk-bulk-lookup",
    user_name: "Desk User Rekha",
    user_code: "USR-009992",
    role: "registration_desk",
    action: "read",
    entity_type: "patient_record",
    entity_id: "bulk-lookup",
    risk_score: 88,
    risk_band: "anomaly",
    reason_codes: "regdesk_deep_clinical_reads|bulk_lookup_spike",
    details: "Registration desk account accessed deep clinical notes for 23 patients in 18 minutes.",
    is_demo: true
  },
  {
    id: "demo-doctor-rapid-reads",
    user_name: "Dr. Kiran",
    user_code: "USR-009993",
    role: "Doctor",
    action: "read",
    entity_type: "patient_record",
    entity_id: "UHID-2026-1002",
    risk_score: 57,
    risk_band: "suspicious",
    reason_codes: "rapid_record_switching",
    details: "Single session touched 12 unrelated charts within 9 minutes.",
    is_demo: true
  }
];

function withDemoAlerts(alerts = []) {
  const incoming = Array.isArray(alerts) ? alerts : [];
  const existingKeys = new Set(incoming.map((row) => String(row.id || row.log_id || "")));
  const missingExamples = DEMO_ML_RISK_ALERTS.filter(
    (row) => !existingKeys.has(String(row.id || row.log_id || ""))
  );
  return [...missingExamples, ...incoming];
}

function buildRiskView(riskSummary, riskAlerts) {
  const mergedAlerts = withDemoAlerts(riskAlerts);
  const high = mergedAlerts.filter((row) => row.risk_band === "anomaly");
  const medium = mergedAlerts.filter((row) => row.risk_band === "suspicious");
  const baseSummary = riskSummary || {};

  return {
    summary: {
      ...baseSummary,
      high_risk: Math.max(Number(baseSummary.high_risk) || 0, high.length),
      medium_risk: Math.max(Number(baseSummary.medium_risk) || 0, medium.length),
      total_scored: Math.max(Number(baseSummary.total_scored) || 0, mergedAlerts.length),
      ml_service: baseSummary.ml_service || { ok: false }
    },
    highAlerts: high.slice(0, 8),
    mediumAlerts: medium.slice(0, 8)
  };
}

export default function AdminPortal({ user }) {
  const [roleWiseUsers, setRoleWiseUsers] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [highAlerts, setHighAlerts] = useState([]);
  const [mediumAlerts, setMediumAlerts] = useState([]);
  const [summary, setSummary] = useState({
    high_risk: 0,
    medium_risk: 0,
    total_scored: 0,
    ml_service: { ok: false }
  });
  const [showAccessControls, setShowAccessControls] = useState(false);
  const [showRoleDirectory, setShowRoleDirectory] = useState(false);
  const [refreshingAlerts, setRefreshingAlerts] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let stopped = false;
    async function load() {
      try {
        const [grouped, pending, riskSummary, riskAlerts] = await Promise.all([
          getRoleWiseUsers(),
          getPendingApprovals(),
          getSecuritySummary(30),
          getSecurityAlerts({ limit: 120, lookbackDays: 30 })
        ]);
        if (!stopped) {
          const riskView = buildRiskView(riskSummary, riskAlerts || []);
          setRoleWiseUsers(grouped);
          setPendingUsers(pending);
          setSummary(riskView.summary);
          setHighAlerts(riskView.highAlerts);
          setMediumAlerts(riskView.mediumAlerts);
        }
      } catch {
        if (!stopped) {
          setRoleWiseUsers([]);
          setPendingUsers([]);
          setHighAlerts([]);
          setMediumAlerts([]);
          setSummary({
            high_risk: 0,
            medium_risk: 0,
            total_scored: 0,
            ml_service: { ok: false }
          });
        }
      }
    }
    load();
    return () => {
      stopped = true;
    };
  }, []);

  async function refreshAll() {
    const [grouped, pending, riskSummary, riskAlerts] = await Promise.all([
      getRoleWiseUsers(),
      getPendingApprovals(),
      getSecuritySummary(30),
      getSecurityAlerts({ limit: 120, lookbackDays: 30 })
    ]);
    const riskView = buildRiskView(riskSummary, riskAlerts || []);
    setRoleWiseUsers(grouped);
    setPendingUsers(pending);
    setSummary(riskView.summary);
    setHighAlerts(riskView.highAlerts);
    setMediumAlerts(riskView.mediumAlerts);
  }

  async function refreshRiskSignals() {
    setMessage("");
    setError("");
    setRefreshingAlerts(true);
    try {
      const refreshed = await refreshSecurityAlerts({ lookbackHours: 24, limit: 350 });
      await refreshAll();
      setMessage(
        `Security analysis updated. Scored ${refreshed.scored || 0} logs (${refreshed.high || 0} high, ${
          refreshed.medium || 0
        } medium).`
      );
    } catch (refreshError) {
      setError(refreshError.message || "Unable to refresh security alerts.");
    } finally {
      setRefreshingAlerts(false);
    }
  }

  async function handleApproval(userId, statusValue) {
    setMessage("");
    setError("");
    try {
      await updateUserApproval(userId, statusValue);
      await refreshAll();
      setMessage(`User ${statusValue.toLowerCase()} successfully.`);
    } catch (updateError) {
      setError(updateError.message || "Unable to update approval.");
    }
  }

  async function handleShiftChange(userId, shiftSlot) {
    setMessage("");
    setError("");
    try {
      await updateUserShift(userId, shiftSlot);
      await refreshAll();
      setMessage("Shift updated.");
    } catch (updateError) {
      setError(updateError.message || "Unable to update shift.");
    }
  }

  const shiftAssignableUsers = roleWiseUsers
    .filter((group) => ["Doctor", "Nurse", "registration_desk"].includes(group.role))
    .flatMap((group) => group.users.map((member) => ({ ...member, role: group.role })));

  return (
    <section className="portal-shell admin-compact-shell">
      <div className="portal-header">
        <h2>Administrator Workspace</h2>
        <p>
          {user.name} | High: {summary.high_risk || 0} | Medium: {summary.medium_risk || 0}
        </p>
      </div>

      <section className="panel admin-risk-overview">
        <div className="panel-header-row">
          <h3>Insider Risk Monitor</h3>
          <button className="btn subtle" onClick={refreshRiskSignals} type="button" disabled={refreshingAlerts}>
            {refreshingAlerts ? "Refreshing..." : "Refresh Risk Signals"}
          </button>
        </div>
        <div className="admin-risk-metrics">
          <article className="risk-metric high">
            <span>High Suspicious</span>
            <strong>{summary.high_risk || 0}</strong>
          </article>
          <article className="risk-metric medium">
            <span>Medium Suspicious</span>
            <strong>{summary.medium_risk || 0}</strong>
          </article>
          <article className="risk-metric total">
            <span>Scored Events</span>
            <strong>{summary.total_scored || 0}</strong>
          </article>
          <article className="risk-metric service">
            <span>ML Service</span>
            <strong>{summary.ml_service?.ok ? "Connected" : "Unavailable"}</strong>
          </article>
        </div>
      </section>

      <section className="panel admin-risk-grid">
        <article>
          <h3>High Suspicious Events</h3>
          {!highAlerts.length && <p className="empty-state">No high-risk alerts in current window.</p>}
          {!!highAlerts.length && (
            <ul className="admin-alert-list">
              {highAlerts.map((row) => (
                <li key={row.id || row.log_id}>
                  <strong>{row.user_name || row.user_code || "Unknown User"}</strong>
                  <span>
                    {row.role} | {row.entity_type}#{row.entity_id}
                    {row.is_demo ? " | Demo" : ""}
                  </span>
                  <span>Risk {Math.round(row.risk_score)} | {row.reason_codes}</span>
                  {row.details && <span>{row.details}</span>}
                </li>
              ))}
            </ul>
          )}
        </article>

        <article>
          <h3>Medium Suspicious Events</h3>
          {!mediumAlerts.length && <p className="empty-state">No medium-risk alerts in current window.</p>}
          {!!mediumAlerts.length && (
            <ul className="admin-alert-list">
              {mediumAlerts.map((row) => (
                <li key={row.id || row.log_id}>
                  <strong>{row.user_name || row.user_code || "Unknown User"}</strong>
                  <span>
                    {row.role} | {row.entity_type}#{row.entity_id}
                    {row.is_demo ? " | Demo" : ""}
                  </span>
                  <span>Risk {Math.round(row.risk_score)} | {row.reason_codes}</span>
                  {row.details && <span>{row.details}</span>}
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>

      <section className="panel">
        <div className="panel-header-row">
          <h3>Approvals + Shift Allocation</h3>
          <button className="btn subtle" type="button" onClick={() => setShowAccessControls((prev) => !prev)}>
            {showAccessControls ? "Hide" : "Show"}
          </button>
        </div>
        {showAccessControls && (
          <div className="admin-collapse-stack">
            <h4>Pending Signup Approvals</h4>
            {!pendingUsers.length && <p className="empty-state">No pending requests.</p>}
            {!!pendingUsers.length && (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingUsers.map((row) => (
                      <tr key={row.id}>
                        <td>{row.full_name}</td>
                        <td>{row.email}</td>
                        <td>{row.role}</td>
                        <td>
                          <div className="panel-actions-row">
                            <button className="btn subtle" onClick={() => handleApproval(row.id, "Approved")} type="button">
                              Approve
                            </button>
                            <button className="btn subtle" onClick={() => handleApproval(row.id, "Rejected")} type="button">
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h4>Shift Allocation</h4>
            {!shiftAssignableUsers.length && <p className="empty-state">No shift-eligible users found.</p>}
            {!!shiftAssignableUsers.length && (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Shift</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shiftAssignableUsers.map((member) => (
                      <tr key={`shift-${member.id}`}>
                        <td>{member.full_name}</td>
                        <td>{member.role}</td>
                        <td>{member.approval_status}</td>
                        <td>
                          <select
                            onChange={(event) => handleShiftChange(member.id, event.target.value)}
                            value={member.shift_slot || ""}
                          >
                            <option value="">No shift</option>
                            {SHIFT_OPTIONS.map((slot) => (
                              <option key={slot} value={slot}>
                                {slot}
                              </option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-header-row">
          <h3>Role-wise Users</h3>
          <button className="btn subtle" type="button" onClick={() => setShowRoleDirectory((prev) => !prev)}>
            {showRoleDirectory ? "Hide" : "Show"}
          </button>
        </div>
        {showRoleDirectory && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Count</th>
                  <th>Users</th>
                </tr>
              </thead>
              <tbody>
                {roleWiseUsers.map((group) => (
                  <tr key={group.role}>
                    <td>{group.role}</td>
                    <td>{group.count}</td>
                    <td>
                      {group.users.map((member) => (
                        <div className="role-directory-line" key={member.id}>
                          <strong>{member.full_name}</strong>
                          <span>
                            ({member.approval_status}
                            {member.shift_slot ? `, shift ${member.shift_slot}` : ""})
                          </span>
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {message && <p className="notice">{message}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
