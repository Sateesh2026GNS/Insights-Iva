import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  PRIMARY_SESSION_TIMEOUT_MS,
  NEW_TAB_TIMEOUT_MS,
  getTabId,
  getTabType,
  markAsPrimaryTab,
  initTabSession,
  isPrimaryTabAlive,
  checkSessionStatus,
  markTabExpired,
  clearTabSession,
  sendPrimaryHeartbeat,
} from "./sessionManager";

describe("sessionManager", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.name = "";
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("identifies a tab without primary registration as new_tab", () => {
    expect(getTabType()).toBe("new_tab");
  });

  it("marks tab as primary and sets up 9-hour session", () => {
    markAsPrimaryTab();
    expect(getTabType()).toBe("primary");
    expect(localStorage.getItem("smrt-login-time")).toBeTruthy();
    expect(localStorage.getItem("smrt-primary-window-name")).toBe(window.name);
  });

  it("detects 9-hour expiration on primary tab", () => {
    localStorage.setItem("smrt-token", "fake-token");
    markAsPrimaryTab();

    // Just after login
    expect(checkSessionStatus().expired).toBe(false);

    // 8 hours later
    vi.advanceTimersByTime(8 * 60 * 60 * 1000);
    expect(checkSessionStatus().expired).toBe(false);

    // After 9 hours
    vi.advanceTimersByTime(1 * 60 * 60 * 1000 + 1000);
    const status = checkSessionStatus();
    expect(status.expired).toBe(true);
    expect(status.reason).toBe("primary_9hr_timeout");
  });

  it("initializes new tab with 10-minute timer and expires after 10 minutes", () => {
    localStorage.setItem("smrt-token", "fake-token");
    initTabSession();

    expect(getTabType()).toBe("new_tab");
    expect(sessionStorage.getItem("smrt-new-tab-opened-at")).toBeTruthy();
    expect(checkSessionStatus().expired).toBe(false);

    // 9 minutes later
    vi.advanceTimersByTime(9 * 60 * 1000);
    expect(checkSessionStatus().expired).toBe(false);

    // 10 minutes later
    vi.advanceTimersByTime(1 * 60 * 1000 + 1000);
    const status = checkSessionStatus();
    expect(status.expired).toBe(true);
    expect(status.reason).toBe("new_tab_10min_timeout");
  });

  it("tracks primary tab heartbeat correctly", () => {
    expect(isPrimaryTabAlive()).toBe(false);

    sendPrimaryHeartbeat();
    expect(isPrimaryTabAlive()).toBe(true);

    // After 7 seconds without heartbeat, primary tab is considered closed/dead
    vi.advanceTimersByTime(7000);
    expect(isPrimaryTabAlive()).toBe(false);
  });

  it("marks a specific tab as expired", () => {
    localStorage.setItem("smrt-token", "fake-token");
    markTabExpired("new_tab_10min_timeout");
    const status = checkSessionStatus();
    expect(status.expired).toBe(true);
    expect(status.reason).toBe("new_tab_10min_timeout");
  });

  it("promotes a new tab to primary upon login", () => {
    localStorage.setItem("smrt-token", "fake-token");
    initTabSession();
    expect(getTabType()).toBe("new_tab");

    // User logs in on this tab
    markAsPrimaryTab();
    expect(getTabType()).toBe("primary");
    expect(sessionStorage.getItem("smrt-new-tab-opened-at")).toBeNull();
  });
});
