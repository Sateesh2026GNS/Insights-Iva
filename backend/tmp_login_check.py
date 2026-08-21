import json
import urllib.request
import urllib.error

payload = json.dumps({"email": "admin@gnsinsights.com", "password": "Admin123!", "role": "Admin"}).encode()
req = urllib.request.Request(
    "http://127.0.0.1:8000/auth/login",
    data=payload,
    headers={"Content-Type": "application/json"},
)
try:
    with urllib.request.urlopen(req, timeout=20) as res:
        print(res.status)
        print(res.read().decode())
except urllib.error.HTTPError as e:
    print("HTTP", e.code)
    print(e.read().decode())
except Exception as e:
    print(type(e).__name__, e)
