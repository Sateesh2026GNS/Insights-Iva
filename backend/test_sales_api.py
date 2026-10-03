import requests

def main():
    baseURL = "http://localhost:8000"

    # Log in
    login_res = requests.post(f"{baseURL}/auth/login", json={
        "email": "admin@smrt.local",
        "password": "admin123"
    })
    print("Login Status:", login_res.status_code)

if __name__ == "__main__":
    main()
if login_res.status_code == 200:
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get enriched sales orders
    res = requests.get(f"{baseURL}/sales/sales-orders/enriched", headers=headers)
    print("Enriched SO Status:", res.status_code)
    try:
        print("Enriched SO Response:", res.json())
    except:
        print("Enriched SO Text:", res.text)
        
    # Get summary
    res_sum = requests.get(f"{baseURL}/sales/sales-orders/summary", headers=headers)
    print("Summary SO Status:", res_sum.status_code)
    try:
        print("Summary SO Response:", res_sum.json())
    except:
        print("Summary SO Text:", res_sum.text)

    # Get dispatch summary
    res_disp_sum = requests.get(f"{baseURL}/dispatch/summary", headers=headers)
    print("Dispatch Summary Status:", res_disp_sum.status_code)
    try:
        print("Dispatch Summary Response:", res_disp_sum.json())
    except:
        print("Dispatch Summary Text:", res_disp_sum.text)

    # Get dispatch enriched
    res_disp_enr = requests.get(f"{baseURL}/dispatch/enriched", headers=headers)
    print("Dispatch Enriched Status:", res_disp_enr.status_code)
    try:
        print("Dispatch Enriched Response:", res_disp_enr.json())
    except:
        print("Dispatch Enriched Text:", res_disp_enr.text)

    # Get invoices summary
    res_inv_sum = requests.get(f"{baseURL}/sales/invoices/summary", headers=headers)
    print("Invoices Summary Status:", res_inv_sum.status_code)
    try:
        print("Invoices Summary Response:", res_inv_sum.json())
    except:
        print("Invoices Summary Text:", res_inv_sum.text)

    # Get invoices enriched
    res_inv_enr = requests.get(f"{baseURL}/sales/invoices/enriched", headers=headers)
    print("Invoices Enriched Status:", res_inv_enr.status_code)
    try:
        print("Invoices Enriched Response:", res_inv_enr.json())
    except:
        print("Invoices Enriched Text:", res_inv_enr.text)
else:
    print("Login Failed:", login_res.text)
