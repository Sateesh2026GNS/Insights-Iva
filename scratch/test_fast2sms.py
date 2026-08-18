import json
import urllib.request
import urllib.parse

api_key = "oACYJ4qfMiFl3yQ9XNwpIbgZSnOBH50uLDkdEGcP8xR2KetVazax9mXHgiJY6I8ZkSNTWDBp1F7dGtKP"
mobile = "9059186584"
code = "482910"

# Test route 'q' (Quick SMS)
params = {
    "authorization": api_key,
    "message": f"Your Insights Iva verification OTP is {code}. Valid for 5 minutes.",
    "language": "english",
    "route": "q",
    "numbers": mobile
}
url = f"https://www.fast2sms.com/dev/bulkV2?{urllib.parse.urlencode(params)}"

try:
    req = urllib.request.Request(url, headers={"cache-control": "no-cache"})
    with urllib.request.urlopen(req) as resp:
        print("Quick SMS response:", resp.read().decode())
except Exception as e:
    if hasattr(e, "read"):
        print("Quick SMS error response:", e.read().decode())
    else:
        print("Quick SMS error:", e)
