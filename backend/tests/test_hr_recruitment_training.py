"""HR recruitment and training API tests."""

from datetime import date


def test_recruitment_job_crud(client, register_admin):
    auth = register_admin()

    create = client.post(
        "/hr/recruitment/jobs",
        json={
            "title": "Production Engineer",
            "department": "Manufacturing",
            "openings_count": 2,
            "status": "open",
        },
        headers=auth["headers"],
    )
    assert create.status_code == 201, create.text
    job = create.json()
    job_id = job["id"]
    assert job["title"] == "Production Engineer"
    assert job["applicants_count"] == 0

    listing = client.get("/hr/recruitment/jobs", headers=auth["headers"])
    assert listing.status_code == 200
    assert listing.json()["total"] >= 1

    detail = client.get(f"/hr/recruitment/jobs/{job_id}", headers=auth["headers"])
    assert detail.status_code == 200

    updated = client.put(
        f"/hr/recruitment/jobs/{job_id}",
        json={"status": "closed", "openings_count": 1},
        headers=auth["headers"],
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "closed"

    status_patch = client.patch(
        f"/hr/recruitment/jobs/{job_id}/status?status=open",
        headers=auth["headers"],
    )
    assert status_patch.status_code == 200
    assert status_patch.json()["status"] == "open"

    deleted = client.delete(f"/hr/recruitment/jobs/{job_id}", headers=auth["headers"])
    assert deleted.status_code == 204


def test_recruitment_applicant_and_dashboard(client, register_admin):
    auth = register_admin()

    job = client.post(
        "/hr/recruitment/jobs",
        json={"title": "QA Analyst", "department": "Quality", "openings_count": 1},
        headers=auth["headers"],
    ).json()

    applicant = client.post(
        "/hr/recruitment/applicants",
        json={
            "job_opening_id": job["id"],
            "full_name": "Jane Candidate",
            "email": "jane@example.com",
            "source": "LinkedIn",
            "stage": "screening",
            "status": "in_progress",
            "applied_on": date.today().isoformat(),
        },
        headers=auth["headers"],
    )
    assert applicant.status_code == 201, applicant.text
    applicant_id = applicant.json()["id"]
    assert applicant.json()["full_name"] == "Jane Candidate"
    assert applicant.json()["job_title"] == "QA Analyst"

    listed = client.get("/hr/recruitment/applicants", headers=auth["headers"])
    assert listed.status_code == 200
    assert listed.json()["total"] >= 1

    dashboard = client.get("/hr/recruitment/dashboard", headers=auth["headers"])
    assert dashboard.status_code == 200
    body = dashboard.json()
    assert "total_openings" in body
    assert "funnel_stages" in body
    assert len(body["recent_applicants"]) >= 1

    patched = client.patch(
        f"/hr/recruitment/applicants/{applicant_id}/status?status=hired",
        headers=auth["headers"],
    )
    assert patched.status_code == 200
    assert patched.json()["status"] == "hired"

    deleted = client.delete(
        f"/hr/recruitment/applicants/{applicant_id}", headers=auth["headers"]
    )
    assert deleted.status_code == 204


def test_training_program_crud_and_dashboard(client, register_admin):
    auth = register_admin()

    create = client.post(
        "/hr/training/programs",
        json={
            "name": "Safety Induction",
            "category": "Compliance",
            "trainer": "HR Team",
            "start_date": date.today().isoformat(),
            "status": "in_progress",
            "progress_pct": 25,
        },
        headers=auth["headers"],
    )
    assert create.status_code == 201, create.text
    program = create.json()
    program_id = program["id"]
    assert program["name"] == "Safety Induction"
    assert program["participants"] == 0

    listing = client.get("/hr/training/programs", headers=auth["headers"])
    assert listing.status_code == 200
    assert listing.json()["total"] >= 1

    enrollment = client.post(
        "/hr/training/enrollments",
        json={"program_id": program_id, "employee_name": "Test User", "status": "enrolled"},
        headers=auth["headers"],
    )
    assert enrollment.status_code == 201, enrollment.text

    dashboard = client.get("/hr/training/dashboard", headers=auth["headers"])
    assert dashboard.status_code == 200
    body = dashboard.json()
    assert body["total_programs"] >= 1
    assert "ongoing_programs" in body
    assert body["in_progress"] >= 1

    updated = client.put(
        f"/hr/training/programs/{program_id}",
        json={"progress_pct": 80, "status": "completed"},
        headers=auth["headers"],
    )
    assert updated.status_code == 200
    assert updated.json()["status"] == "completed"

    deleted = client.delete(f"/hr/training/programs/{program_id}", headers=auth["headers"])
    assert deleted.status_code == 204


def test_recruitment_dashboard_empty(client, register_admin):
    auth = register_admin()
    resp = client.get("/hr/recruitment/dashboard", headers=auth["headers"])
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_openings"] == 0
    assert body["job_openings"] == []
    assert body["recent_applicants"] == []


def test_training_dashboard_empty(client, register_admin):
    auth = register_admin()
    resp = client.get("/hr/training/dashboard", headers=auth["headers"])
    assert resp.status_code == 200
    body = resp.json()
    assert body["total_programs"] == 0
    assert body["ongoing_programs"] == []
