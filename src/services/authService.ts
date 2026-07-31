import { DEMO_LECTURER, DEMO_STUDENT } from "@/data/mockData";
import type { LecturerProfile, Role, StudentProfile, UserProfile } from "@/types";
import { delay } from "./demoScenarios";

export interface Credentials {
  email: string;
  password: string;
  role: Role;
}

/**
 * Simulated authentication. In the production system this is replaced by a
 * server-issued session; identity is never chosen on the client.
 */
export const authService = {
  async signIn({ email, password, role }: Credentials): Promise<UserProfile> {
    await delay(900);
    if (!email.includes("@")) {
      throw new Error("Enter a valid email address.");
    }
    if (password.length < 6) {
      throw new Error("Invalid credentials. Please check your email and password.");
    }
    if (email.toLowerCase().startsWith("offline")) {
      throw new Error("Network error. Could not reach the authentication server.");
    }
    return role === "student"
      ? { ...DEMO_STUDENT, email }
      : { ...DEMO_LECTURER, email };
  },

  async registerStudent(data: Partial<StudentProfile>): Promise<StudentProfile> {
    await delay(1100);
    return { ...DEMO_STUDENT, ...data, role: "student" } as StudentProfile;
  },

  async registerLecturer(data: Partial<LecturerProfile>): Promise<LecturerProfile> {
    await delay(1100);
    return { ...DEMO_LECTURER, ...data, role: "lecturer" } as LecturerProfile;
  },
};
