import { expect, test } from "@playwright/test";

const doctorCredentials = {
  email: "dr.anitha@bloom.health",
  password: "Doctor@123"
};

async function signInAndGetToken(request) {
  const response = await request.post("/api/auth/signin", {
    data: doctorCredentials
  });

  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.token).toBeTruthy();
  expect(body.user.role).toBe("Doctor");
  return body.token;
}

test("health endpoint is available", async ({ request }) => {
  const response = await request.get("/health");
  expect(response.ok()).toBeTruthy();

  const body = await response.json();
  expect(body).toMatchObject({
    ok: true,
    service: "ehr-electronic-health-records-backend"
  });
});

test("doctor can sign in and retrieve own profile", async ({ request }) => {
  const token = await signInAndGetToken(request);

  const meResponse = await request.get("/api/auth/me", {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
  expect(meResponse.ok()).toBeTruthy();

  const me = await meResponse.json();
  expect(me.email).toBe(doctorCredentials.email);
  expect(me.role).toBe("Doctor");
});

test("doctor can access doctor-facing resources", async ({ request }) => {
  const token = await signInAndGetToken(request);
  const authHeaders = {
    Authorization: `Bearer ${token}`
  };

  const doctorsResponse = await request.get("/api/users/doctors", {
    headers: authHeaders
  });
  expect(doctorsResponse.ok()).toBeTruthy();

  const doctors = await doctorsResponse.json();
  expect(Array.isArray(doctors)).toBeTruthy();

  const todaysAppointmentsResponse = await request.get("/api/appointments/today", {
    headers: authHeaders
  });
  expect(todaysAppointmentsResponse.ok()).toBeTruthy();

  const dashboardResponse = await request.get("/api/dashboard/nurse", {
    headers: authHeaders
  });
  expect(dashboardResponse.ok()).toBeTruthy();
});

test("doctor cannot access admin-only dashboard", async ({ request }) => {
  const token = await signInAndGetToken(request);

  const response = await request.get("/api/dashboard/admin", {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  expect(response.status()).toBe(403);
});
