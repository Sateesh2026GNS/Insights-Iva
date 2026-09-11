import { useState } from "react";
import { Check, Copy } from "lucide-react";

export default function GoogleCalendarSetupPanel({ googleStatus }) {
  const [copied, setCopied] = useState(false);

  if (googleStatus?.configured) return null;

  const isLocal =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  const defaultProdRedirect = "https://insights-iva-api.onrender.com/integrations/google/calendar/callback";
  const defaultLocalRedirect = "http://localhost:8000/integrations/google/calendar/callback";
  const fallback = isLocal ? defaultLocalRedirect : defaultProdRedirect;

  let redirectUri = googleStatus?.redirect_uri || fallback;
  if (redirectUri.startsWith("https/")) {
    redirectUri = "https://" + redirectUri.slice(6);
  } else if (redirectUri.startsWith("http/")) {
    redirectUri = "http://" + redirectUri.slice(5);
  } else if (!redirectUri.includes("://")) {
    redirectUri = fallback;
  }

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(redirectUri);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const libsOk = googleStatus?.libraries_installed !== false;

  return (
    <div className="meetings-cal__setup">
      <p className="meetings-cal__setup-title">Enable Google Calendar + Meet</p>
      <ol className="meetings-cal__setup-steps">
        <li>
          Open{" "}
          <a
            href="https://console.cloud.google.com/apis/library/calendar-json.googleapis.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google Cloud Console
          </a>{" "}
          and enable <strong>Google Calendar API</strong>.
        </li>
        <li>
          Create an OAuth 2.0 <strong>Web application</strong> client ID.
        </li>
        <li>
          <div className="flex items-center justify-between gap-2">
            <span>Add authorized redirect URI:</span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200"
              title="Copy redirect URI"
            >
              {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <code className="meetings-cal__setup-code break-all select-all">{redirectUri}</code>
        </li>
        <li>
          Add to backend environment variables (or <code className="meetings-cal__setup-code">backend/.env</code>):
          <pre className="meetings-cal__setup-pre">{`GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_OAUTH_REDIRECT_URI=${redirectUri}`}</pre>
        </li>
        <li>Click <strong>Connect</strong> below and sign in with Google.</li>
      </ol>
      {!libsOk ? (
        <p className="meetings-cal__setup-warn">
          Install Python packages:{" "}
          <code>pip install google-auth google-auth-oauthlib google-api-python-client</code>
        </p>
      ) : null}
    </div>
  );
}
