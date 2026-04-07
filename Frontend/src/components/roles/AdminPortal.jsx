import { useEffect, useState } from "react";
import {
  getPendingApprovals,
  getRoleWiseUsers,
  updateUserApproval,
  updateUserShift
} from "../../services/ehrService";

const SHIFT_OPTIONS = ["2-10", "10-18", "18-2"];

export default function AdminPortal({ user }) {
  const [roleWiseUsers, setRoleWiseUsers] = useState([]);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let stopped = false;
    async function load() {
      try {
        const [grouped, pending] = await Promise.all([getRoleWiseUsers(), getPendingApprovals()]);
        if (!stopped) {
          setRoleWiseUsers(grouped);
          setPendingUsers(pending);
        }
      } catch {
        if (!stopped) {
          setRoleWiseUsers([]);
          setPendingUsers([]);
        }
      }
    }
    load();
    return () => {
      stopped = true;
    };
  }, []);

  async function refreshAll() {
    const [grouped, pending] = await Promise.all([getRoleWiseUsers(), getPendingApprovals()]);
    setRoleWiseUsers(grouped);
    setPendingUsers(pending);
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

  return (
    <section className="portal-shell">
      <div className="portal-header">
        <h2>Administrator Workspace</h2>
        <p>{user.name}</p>
      </div>

      <section className="panel">
        <h3>Pending Signup Approvals</h3>
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
      </section>

      <section className="panel">
        <h3>Role-wise Users</h3>
        {!roleWiseUsers.length && <p className="empty-state">No active users found.</p>}
        {!!roleWiseUsers.length && (
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
                        <div key={member.id} style={{ marginBottom: "0.45rem" }}>
                          <strong>{member.full_name}</strong>{" "}
                          <span>
                            ({member.approval_status}{member.shift_slot ? `, shift ${member.shift_slot}` : ""})
                          </span>
                          {(group.role === "Doctor" ||
                            group.role === "Nurse" ||
                            group.role === "registration_desk") && (
                            <select
                              onChange={(event) => handleShiftChange(member.id, event.target.value)}
                              style={{ marginLeft: "0.5rem" }}
                              value={member.shift_slot || ""}
                            >
                              <option value="">No shift</option>
                              {SHIFT_OPTIONS.map((slot) => (
                                <option key={slot} value={slot}>
                                  {slot}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      )) || "-"}
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
