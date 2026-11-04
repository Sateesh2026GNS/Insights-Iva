import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import useBreakpoint from "./useBreakpoint";

const originalWidth = window.innerWidth;

afterEach(() => {
  window.innerWidth = originalWidth;
});

describe("useBreakpoint", () => {
  it.each([
    [360, { isMobile: true, isTablet: false, isLaptop: false, isDesktop: false }],
    [639, { isMobile: true, isTablet: false, isLaptop: false, isDesktop: false }],
    [640, { isMobile: false, isTablet: true, isLaptop: false, isDesktop: false }],
    [1023, { isMobile: false, isTablet: true, isLaptop: false, isDesktop: false }],
    [1024, { isMobile: false, isTablet: false, isLaptop: true, isDesktop: false }],
    [1439, { isMobile: false, isTablet: false, isLaptop: true, isDesktop: false }],
    [1440, { isMobile: false, isTablet: false, isLaptop: false, isDesktop: true }],
    [1920, { isMobile: false, isTablet: false, isLaptop: false, isDesktop: true }],
  ])("classifies width %i", (width, expected) => {
    window.innerWidth = width;
    const { result } = renderHook(() => useBreakpoint());
    expect(result.current).toEqual(expected);
    act(() => window.dispatchEvent(new Event("resize")));
    expect(result.current).toEqual(expected);
  });
});
