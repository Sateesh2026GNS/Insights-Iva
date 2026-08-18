import { RecaptchaVerifier, signInWithPhoneNumber } from "firebase/auth";
import { auth } from "../config/firebase";

/**
 * Format phone number strictly to E.164 format (+91XXXXXXXXXX).
 */
export function formatPhoneNumber(phoneNumber, defaultCountryCode = "+91") {
  if (!phoneNumber) return "";
  const digits = String(phoneNumber).replace(/\D/g, "");
  if (digits.length === 10) {
    return `${defaultCountryCode}${digits}`;
  }
  if (digits.startsWith("91") && digits.length === 12) {
    return `+${digits}`;
  }
  return `+${digits}`;
}

/**
 * Setup a persistent RecaptchaVerifier instance.
 */
export function initRecaptchaVerifier(containerId = "recaptcha-container", isVisible = false) {
  try {
    if (window.recaptchaVerifier) {
      return window.recaptchaVerifier;
    }

    let container = document.getElementById(containerId);
    if (!container) {
      container = document.createElement("div");
      container.id = containerId;
      container.style.position = "fixed";
      container.style.bottom = "0";
      container.style.right = "0";
      container.style.zIndex = "9999";
      document.body.appendChild(container);
    }

    window.recaptchaVerifier = new RecaptchaVerifier(
      auth,
      container,
      {
        size: isVisible ? "normal" : "invisible",
        callback: () => {
          // reCAPTCHA solved
        },
        "expired-callback": () => {
          console.warn("reCAPTCHA expired. Resetting...");
          if (window.recaptchaVerifier) {
            try {
              window.recaptchaVerifier.clear();
            } catch {
              // ignore
            }
            window.recaptchaVerifier = null;
          }
        },
      }
    );

    return window.recaptchaVerifier;
  } catch (err) {
    console.error("Failed to initialize RecaptchaVerifier:", err);
    throw err;
  }
}

/**
 * Send Firebase SMS OTP to the provided phone number.
 */
export async function sendFirebasePhoneOtp(phoneNumber, containerId = "recaptcha-container") {
  const formattedPhone = formatPhoneNumber(phoneNumber);
  if (!formattedPhone || formattedPhone.length < 10) {
    throw new Error("Please enter a valid phone number with country code.");
  }

  // Ensure verifier is ready
  const verifier = initRecaptchaVerifier(containerId, false);

  try {
    const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, verifier);
    window.confirmationResult = confirmationResult;
    return confirmationResult;
  } catch (error) {
    console.error("Firebase send OTP error:", error);

    // Reset recaptcha on error so next attempt can re-initialize cleanly
    if (window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier.clear();
      } catch {
        // ignore
      }
      window.recaptchaVerifier = null;
    }

    let friendlyMessage = error.message;
    if (error.code === "auth/invalid-phone-number") {
      friendlyMessage = "The phone number format is invalid. Please use +91 followed by 10 digits.";
    } else if (error.code === "auth/quota-exceeded") {
      friendlyMessage = "SMS quota exceeded. Please try again later or add billing in Firebase.";
    } else if (error.code === "auth/captcha-check-failed") {
      friendlyMessage = "reCAPTCHA verification failed. Please try again.";
    } else if (error.code === "auth/too-many-requests") {
      friendlyMessage = "Too many OTP requests. Please wait a moment before trying again.";
    } else if (error.code === "auth/operation-not-allowed") {
      friendlyMessage = "SMS Region Policy blocked: please enable India (+91) in Firebase Authentication > Settings > SMS Region Policy.";
    }

    const customErr = new Error(friendlyMessage);
    customErr.code = error.code;
    throw customErr;
  }
}

/**
 * Confirm the OTP code with Firebase.
 */
export async function confirmFirebasePhoneOtp(confirmationResult, otpCode) {
  if (!confirmationResult && window.confirmationResult) {
    confirmationResult = window.confirmationResult;
  }

  if (!confirmationResult) {
    throw new Error("No active OTP request found. Please request a new OTP.");
  }

  const cleanCode = String(otpCode || "").trim();
  if (cleanCode.length !== 6) {
    throw new Error("Please enter all 6 digits of the OTP code.");
  }

  try {
    const userCredential = await confirmationResult.confirm(cleanCode);
    const idToken = await userCredential.user.getIdToken();
    return {
      user: userCredential.user,
      idToken,
    };
  } catch (error) {
    console.error("Firebase confirm OTP error:", error);
    let friendlyMessage = "Invalid verification code. Please check and try again.";
    if (error.code === "auth/code-expired") {
      friendlyMessage = "The OTP code has expired. Please request a new OTP.";
    } else if (error.code === "auth/invalid-verification-code") {
      friendlyMessage = "Invalid OTP code. Please enter the correct 6-digit code.";
    }
    const customErr = new Error(friendlyMessage);
    customErr.code = error.code;
    throw customErr;
  }
}
