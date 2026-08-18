import json
import urllib.request

id_instance = "710722713113"
token_instance = "f06695875d334a299730e07f781a1f0020c8276c75334159b6"
api_url = f"https://7107.api.greenapi.com/waInstance{id_instance}/sendMessage/{token_instance}"

payload = {
    "chatId": "919059186584@c.us",
    "message": "🔐 *Insights Iva Test*: Hello Sateesh! Free WhatsApp OTP gateway is now connected!",
}

try:
    req = urllib.request.Request(
        api_url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req) as resp:
        print("Green-API response:", resp.read().decode("utf-8"))
except Exception as e:
    if hasattr(e, "read"):
        print("Green-API error body:", e.read().decode("utf-8"))
    else:
        print("Green-API error:", e)
