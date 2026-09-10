import React from "react";
import Loader from "../Loader";

/**
 * Full-page or section loading state matching Image 2 branded full-screen loader.
 */
export default function LoadingState({ className = "" }) {
  return <Loader className={className} />;
}
