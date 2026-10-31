import { useState, useEffect, useRef, useCallback } from "react";
import { authService } from "@/services/authService";

interface ScanParams {
  email?: string;
  regNumber?: string;
  staffId?: string;
}

export function useRegistrationScan(params: ScanParams) {
  const [checking, setChecking] = useState(false);
  const [emailTaken, setEmailTaken] = useState(false);
  const [regNumberTaken, setRegNumberTaken] = useState(false);
  const [staffIdTaken, setStaffIdTaken] = useState(false);

  // Keep track of latest checked values to prevent redundant queries
  const lastChecked = useRef({ email: "", regNumber: "", staffId: "" });
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const performCheck = useCallback(async (currentParams: ScanParams) => {
    const email = currentParams.email?.trim().toLowerCase() ?? "";
    const regNumber = currentParams.regNumber?.trim().toLowerCase() ?? "";
    const staffId = currentParams.staffId?.trim().toLowerCase() ?? "";

    const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const isRegValid = regNumber.length >= 4;
    const isStaffValid = staffId.length >= 3;

    if (!isEmailValid) setEmailTaken(false);
    if (!isRegValid) setRegNumberTaken(false);
    if (!isStaffValid) setStaffIdTaken(false);

    // If none are eligible for checking, return early
    if (!isEmailValid && !isRegValid && !isStaffValid) {
      setChecking(false);
      return;
    }

    if (
      email === lastChecked.current.email &&
      regNumber === lastChecked.current.regNumber &&
      staffId === lastChecked.current.staffId
    ) {
      return;
    }

    setChecking(true);
    try {
      const res = await authService.checkAvailability({
        email: isEmailValid ? email : undefined,
        regNumber: isRegValid ? regNumber : undefined,
        staffId: isStaffValid ? staffId : undefined,
      });

      lastChecked.current = { email, regNumber, staffId };
      if (isEmailValid) setEmailTaken(res.emailTaken);
      if (isRegValid) setRegNumberTaken(res.regNumberTaken);
      if (isStaffValid) setStaffIdTaken(res.staffIdTaken);
    } catch {
      // Graceful fallback on network error
    } finally {
      setChecking(false);
    }
  }, []);

  // Debounced live typing check (500ms)
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      performCheck(params);
    }, 500);

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [params.email, params.regNumber, params.staffId, performCheck]);

  // Immediate check on blur
  const checkNow = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    performCheck(params);
  }, [params, performCheck]);

  return {
    checking,
    emailTaken,
    regNumberTaken,
    staffIdTaken,
    hasDuplicates: emailTaken || regNumberTaken || staffIdTaken,
    checkNow,
  };
}

