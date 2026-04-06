import DoctorPortal from "../doctor/DoctorPortal";
import AdminPortal from "./AdminPortal";
import NursePortal from "./NursePortal";
import RegistrationDeskPortal from "./RegistrationDeskPortal";

export default function RolePortal({ user }) {
  if (user.role === "Doctor") {
    return <DoctorPortal user={user} />;
  }
  if (user.role === "Nurse") {
    return <NursePortal user={user} />;
  }
  if (user.role === "registration_desk") {
    return <RegistrationDeskPortal user={user} />;
  }
  if (user.role === "Administrator") {
    return <AdminPortal user={user} />;
  }
  return null;
}
