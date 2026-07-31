import type {
  AttendanceRecord,
  AttendanceSession,
  Course,
  CourseAttendanceSummary,
  LecturerProfile,
  StudentProfile,
} from "@/types";

export const FACULTIES = [
  "Faculty of Engineering",
  "Faculty of Science",
  "Faculty of Social Sciences",
  "Faculty of Management Sciences",
];

export const DEPARTMENTS = [
  "Electrical and Electronic Engineering",
  "Computer Engineering",
  "Mechanical Engineering",
  "Civil Engineering",
  "Computer Science",
];

export const LEVELS = ["100 Level", "200 Level", "300 Level", "400 Level", "500 Level"];
export const SEMESTERS = ["First Semester", "Second Semester"];
export const ACADEMIC_SESSIONS = ["2023/2024", "2024/2025", "2025/2026"];

export const COURSES: Course[] = [
  {
    id: "ece501",
    code: "ECE 501",
    title: "Digital Signal Processing",
    creditUnit: 3,
    department: "Electrical and Electronic Engineering",
    lecturer: "Dr. Adaeze Nwosu",
  },
  {
    id: "ece503",
    code: "ECE 503",
    title: "Control Systems Engineering",
    creditUnit: 3,
    department: "Electrical and Electronic Engineering",
    lecturer: "Dr. Adaeze Nwosu",
  },
  {
    id: "ece505",
    code: "ECE 505",
    title: "Communication Systems",
    creditUnit: 3,
    department: "Electrical and Electronic Engineering",
    lecturer: "Prof. Ibrahim Sanusi",
  },
  {
    id: "ece507",
    code: "ECE 507",
    title: "Embedded Systems Design",
    creditUnit: 2,
    department: "Electrical and Electronic Engineering",
    lecturer: "Dr. Adaeze Nwosu",
  },
  {
    id: "ece509",
    code: "ECE 509",
    title: "Engineering Research Methods",
    creditUnit: 2,
    department: "Electrical and Electronic Engineering",
    lecturer: "Dr. Tunde Balogun",
  },
];

export const courseById = (id: string) => COURSES.find((c) => c.id === id);

export const DEMO_STUDENT: StudentProfile = {
  id: "stu-1",
  role: "student",
  name: "Chinedu Okafor",
  regNumber: "2023/ENG/1042",
  email: "chinedu.okafor@university.edu.ng",
  faculty: "Faculty of Engineering",
  department: "Electrical and Electronic Engineering",
  level: "500 Level",
  semester: "Second Semester",
  academicSession: "2025/2026",
  phone: "+234 803 000 1042",
  courseIds: COURSES.map((c) => c.id),
  faceEnrolled: true,
};

export const DEMO_LECTURER: LecturerProfile = {
  id: "lec-1",
  role: "lecturer",
  name: "Dr. Adaeze Nwosu",
  staffId: "ENG/LECT/087",
  email: "adaeze.nwosu@university.edu.ng",
  faculty: "Faculty of Engineering",
  department: "Electrical and Electronic Engineering",
  courseIds: ["ece501", "ece503", "ece507"],
};

const today = () => new Date().toISOString().slice(0, 10);

export const ACTIVE_SESSION: AttendanceSession = {
  id: "SES-2026-0417",
  courseId: "ece503",
  topic: "State-Space Representation",
  lecturerName: "Dr. Adaeze Nwosu",
  startTime: "09:00",
  radius: 75,
  status: "active",
  anchor: { lat: 6.5244, lng: 3.3792, accuracy: 8 },
  enrolledCount: 62,
  date: today(),
};

export const PAST_SESSIONS: AttendanceSession[] = [
  {
    id: "SES-2026-0411",
    courseId: "ece501",
    topic: "Discrete Fourier Transform",
    lecturerName: "Dr. Adaeze Nwosu",
    startTime: "08:00",
    endTime: "10:00",
    radius: 75,
    status: "ended",
    anchor: { lat: 6.5241, lng: 3.3788, accuracy: 9 },
    enrolledCount: 58,
    date: "2026-07-27",
  },
  {
    id: "SES-2026-0408",
    courseId: "ece507",
    topic: "Interrupt Handling on ARM Cortex-M",
    lecturerName: "Dr. Adaeze Nwosu",
    startTime: "11:00",
    endTime: "13:00",
    radius: 60,
    status: "ended",
    anchor: { lat: 6.5249, lng: 3.3801, accuracy: 12 },
    enrolledCount: 47,
    date: "2026-07-24",
  },
  {
    id: "SES-2026-0403",
    courseId: "ece503",
    topic: "Root Locus Analysis",
    lecturerName: "Dr. Adaeze Nwosu",
    startTime: "09:00",
    endTime: "11:00",
    radius: 75,
    status: "ended",
    anchor: { lat: 6.5244, lng: 3.3792, accuracy: 7 },
    enrolledCount: 62,
    date: "2026-07-21",
  },
  {
    id: "SES-2026-0399",
    courseId: "ece501",
    topic: "FIR Filter Design",
    lecturerName: "Dr. Adaeze Nwosu",
    startTime: "08:00",
    endTime: "10:00",
    radius: 50,
    status: "ended",
    anchor: { lat: 6.524, lng: 3.3785, accuracy: 10 },
    enrolledCount: 58,
    date: "2026-07-17",
  },
  {
    id: "SES-2026-0392",
    courseId: "ece507",
    topic: "Real-Time Scheduling",
    lecturerName: "Dr. Adaeze Nwosu",
    startTime: "11:00",
    endTime: "13:00",
    radius: 80,
    status: "ended",
    anchor: { lat: 6.5251, lng: 3.3799, accuracy: 11 },
    enrolledCount: 47,
    date: "2026-07-14",
  },
];

export const SESSION_PRESENT: Record<string, number> = {
  "SES-2026-0411": 51,
  "SES-2026-0408": 39,
  "SES-2026-0403": 55,
  "SES-2026-0399": 44,
  "SES-2026-0392": 41,
};

export const STUDENT_RECORDS: AttendanceRecord[] = [
  {
    id: "rec-1",
    sessionId: "SES-2026-0411",
    courseId: "ece501",
    studentName: DEMO_STUDENT.name,
    regNumber: DEMO_STUDENT.regNumber,
    date: "2026-07-27",
    topic: "Discrete Fourier Transform",
    status: "verified",
    faceScore: 0.94,
    distance: 18,
    gpsAccuracy: 9,
    verifiedAt: "08:06",
  },
  {
    id: "rec-2",
    sessionId: "SES-2026-0408",
    courseId: "ece507",
    studentName: DEMO_STUDENT.name,
    regNumber: DEMO_STUDENT.regNumber,
    date: "2026-07-24",
    topic: "Interrupt Handling on ARM Cortex-M",
    status: "failed",
    faceScore: 0.61,
    distance: 24,
    gpsAccuracy: 14,
    verifiedAt: "11:12",
  },
  {
    id: "rec-3",
    sessionId: "SES-2026-0403",
    courseId: "ece503",
    studentName: DEMO_STUDENT.name,
    regNumber: DEMO_STUDENT.regNumber,
    date: "2026-07-21",
    topic: "Root Locus Analysis",
    status: "verified",
    faceScore: 0.91,
    distance: 33,
    gpsAccuracy: 7,
    verifiedAt: "09:04",
  },
  {
    id: "rec-4",
    sessionId: "SES-2026-0399",
    courseId: "ece501",
    studentName: DEMO_STUDENT.name,
    regNumber: DEMO_STUDENT.regNumber,
    date: "2026-07-17",
    topic: "FIR Filter Design",
    status: "missed",
    faceScore: null,
    distance: null,
    gpsAccuracy: null,
    verifiedAt: null,
  },
  {
    id: "rec-5",
    sessionId: "SES-2026-0392",
    courseId: "ece507",
    studentName: DEMO_STUDENT.name,
    regNumber: DEMO_STUDENT.regNumber,
    date: "2026-07-14",
    topic: "Real-Time Scheduling",
    status: "verified",
    faceScore: 0.89,
    distance: 41,
    gpsAccuracy: 11,
    verifiedAt: "11:03",
  },
  {
    id: "rec-6",
    sessionId: "SES-2026-0388",
    courseId: "ece505",
    studentName: DEMO_STUDENT.name,
    regNumber: DEMO_STUDENT.regNumber,
    date: "2026-07-10",
    topic: "Amplitude Modulation",
    status: "verified",
    faceScore: 0.93,
    distance: 12,
    gpsAccuracy: 6,
    verifiedAt: "14:02",
  },
  {
    id: "rec-7",
    sessionId: "SES-2026-0381",
    courseId: "ece509",
    studentName: DEMO_STUDENT.name,
    regNumber: DEMO_STUDENT.regNumber,
    date: "2026-07-07",
    topic: "Literature Review Techniques",
    status: "verified",
    faceScore: 0.96,
    distance: 9,
    gpsAccuracy: 5,
    verifiedAt: "10:01",
  },
  {
    id: "rec-8",
    sessionId: "SES-2026-0375",
    courseId: "ece503",
    studentName: DEMO_STUDENT.name,
    regNumber: DEMO_STUDENT.regNumber,
    date: "2026-07-03",
    topic: "Transfer Functions",
    status: "missed",
    faceScore: null,
    distance: null,
    gpsAccuracy: null,
    verifiedAt: null,
  },
];

export const COURSE_SUMMARY: CourseAttendanceSummary[] = [
  { courseId: "ece501", held: 12, attended: 11 },
  { courseId: "ece503", held: 11, attended: 9 },
  { courseId: "ece505", held: 10, attended: 8 },
  { courseId: "ece507", held: 9, attended: 7 },
  { courseId: "ece509", held: 8, attended: 8 },
];

const FIRST_NAMES = [
  "Amaka",
  "Ibrahim",
  "Ngozi",
  "Yusuf",
  "Tolu",
  "Emeka",
  "Fatima",
  "Segun",
  "Chiamaka",
  "Musa",
  "Bisi",
  "Uche",
  "Halima",
  "Kelechi",
  "Damilola",
  "Obinna",
];
const LAST_NAMES = [
  "Adeyemi",
  "Bello",
  "Eze",
  "Okonkwo",
  "Lawal",
  "Nwachukwu",
  "Ogundipe",
  "Abubakar",
  "Ibeh",
  "Salami",
  "Uzoma",
  "Danjuma",
];

export function generateRoster(count: number) {
  const roster: { name: string; regNumber: string }[] = [];
  for (let i = 0; i < count; i++) {
    const name = `${FIRST_NAMES[i % FIRST_NAMES.length]} ${LAST_NAMES[(i * 3) % LAST_NAMES.length]}`;
    roster.push({
      name,
      regNumber: `2023/ENG/${(1000 + i * 7).toString()}`,
    });
  }
  return roster;
}

export function generateLedger(sessionId: string, enrolled: number, present: number) {
  const roster = generateRoster(enrolled);
  return roster.map((student, i) => {
    const isPresent = i < present;
    const failed = !isPresent && i === present;
    return {
      id: `${sessionId}-${i}`,
      sessionId,
      name: student.name,
      regNumber: student.regNumber,
      status: (isPresent ? "verified" : failed ? "failed" : "missed") as
        | "verified"
        | "failed"
        | "missed",
      faceScore: isPresent ? 0.85 + ((i * 13) % 14) / 100 : failed ? 0.58 : null,
      distance: isPresent ? 5 + ((i * 17) % 68) : failed ? 96 : null,
      gpsAccuracy: isPresent ? 4 + ((i * 5) % 12) : failed ? 22 : null,
      verifiedAt: isPresent
        ? `09:${((i * 2) % 55).toString().padStart(2, "0")}`
        : failed
          ? "09:41"
          : null,
    };
  });
}
