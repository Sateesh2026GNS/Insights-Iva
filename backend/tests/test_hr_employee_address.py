def test_create_employee_saves_address(client, register_admin):
    admin = register_admin()

    response = client.post(
        "/hr/employees",
        json={
            "tenant_id": 1,
            "employee_code": "EMP-102",
            "full_name": "Asha Rao",
            "email": "asha@example.com",
            "phone": "9876543210",
            "department": "Operations",
            "address": "12/3, MG Road, Hyderabad",
        },
        headers=admin["headers"],
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["address"] == "12/3, MG Road, Hyderabad"
