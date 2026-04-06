from typing import Literal

from pydantic import BaseModel, Field

RoleType = Literal["Doctor", "Nurse", "Administrator", "registration_desk"]
GenderType = Literal["Male", "Female", "Other"]
StatusType = Literal["Scheduled", "Checked In", "In Consultation", "Completed"]


class UserOut(BaseModel):
    id: int
    full_name: str
    email: str
    role: RoleType


class SignUpRequest(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    age: int = Field(ge=18, le=100)
    username: str = Field(min_length=3, max_length=64)
    email: str = Field(min_length=6, max_length=120)
    password: str = Field(min_length=12, max_length=120)
    role: RoleType


class SignInRequest(BaseModel):
    email: str = Field(min_length=6, max_length=120)
    password: str = Field(min_length=6, max_length=120)


class AuthResponse(BaseModel):
    token: str
    user: UserOut


class PatientCreate(BaseModel):
    uhid: str = Field(min_length=3, max_length=40)
    full_name: str = Field(min_length=2, max_length=120)
    age: int = Field(gt=0, le=130)
    gender: GenderType
    assigned_doctor_id: int | None = None


class PatientUpdate(BaseModel):
    uhid: str | None = Field(default=None, min_length=3, max_length=40)
    full_name: str | None = Field(default=None, min_length=2, max_length=120)
    age: int | None = Field(default=None, gt=0, le=130)
    gender: GenderType | None = None
    assigned_doctor_id: int | None = None


class AppointmentCreate(BaseModel):
    patient_id: int
    doctor_id: int | None = None
    appointment_date: str
    appointment_time: str
    status: StatusType = "Scheduled"


class AppointmentStatusUpdate(BaseModel):
    status: StatusType


class ClinicalRecordUpdate(BaseModel):
    chief_complaint: str | None = None
    past_medical_history: list[str] | None = None
    social_family_history: list[str] | None = None
    billing_status: str | None = None
    insurance_approval: str | None = None


class VitalsCreate(BaseModel):
    blood_pressure: str
    heart_rate: str
    temperature: str
    spo2: str
    respiratory_rate: str
    physical_findings: str = ""


class LabOrderCreate(BaseModel):
    test_name: str
    status: Literal["Pending", "Completed"] = "Pending"


class LabResultCreate(BaseModel):
    result_value: str
    result_flag: Literal["Normal", "Abnormal"]


class ImagingOrderCreate(BaseModel):
    imaging_type: str
    status: Literal["Pending", "Reported"] = "Pending"


class ImagingReportCreate(BaseModel):
    report_text: str


class ChargeCreate(BaseModel):
    item: str
    amount: float = Field(gt=0)
