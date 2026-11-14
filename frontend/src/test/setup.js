import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";

// Ensure portals/modals and pending RTL trees do not leak between files
// (open handles from unreaped jsdom trees were hanging Vitest forks).
afterEach(() => {
  cleanup();
});
