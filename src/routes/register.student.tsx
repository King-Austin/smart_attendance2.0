import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertCircle, CheckCircle2, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorState, ProgressBar } from "@/components/layout/PageHeader";
import { CameraCaptureMock } from "@/components/verification/CameraCaptureMock";
import { authService } from "@/services/authService";
import { biometricService, imageToBase64 } from "@/services/biometricService";
import { emailService } from "@/services/emailService";
import { useAuth } from "@/hooks/useAuth";
import { useCourses } from "@/hooks/useCourses";
import { useAcademicOptions } from "@/hooks/useAcademicOptions";
import { useRegistrationScan } from "@/hooks/useRegistrationScan";

export const Route = createFileRoute("/register/student")({
  head: () => ({
    meta: [
      { title: "Student Registration — Smart Campus Presence" },
      {
        name: "description",
        content:
          "Create a student account, select your courses and enroll your face for attendance verification.",
      },
      { property: "og:title", content: "Student Registration — Smart Campus Presence" },
      {
        property: "og:description",
        content: "Four-step student registration with course selection and face enrollment.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StudentRegistration,
});

const STEPS = ["Personal", "Academic", "Courses", "Face enrollment"];
const YEAR_OPTIONS = [
  { label: "Year 1", value: "100 Level" },
  { label: "Year 2", value: "200 Level" },
  { label: "Year 3", value: "300 Level" },
  { label: "Year 4", value: "400 Level" },
];

function StudentRegistration() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const { courses } = useCourses();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: "",
    regNumber: "",
    email: "",
    password: "",
    confirm: "",
    phone: "",
    guardianName: "",
    guardianPhone: "",
    guardianEmail: "",
    faculty: "",
    department: "",
    level: "",
    semester: "",
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [captured, setCaptured] = useState(false);
  const [captureUri, setCaptureUri] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const scan = useRegistrationScan({
    email: form.email,
    regNumber: form.regNumber,
  });

  const academic = useAcademicOptions(form.faculty);
  const faculties = academic.faculties.map((faculty) => faculty.name);
  const departments = academic.departments.map((department) => department.name);
  const yearOptions = YEAR_OPTIONS.filter((option) => academic.levels.includes(option.value));

  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const filtered = useMemo(
    () =>
      courses.filter(
        (c) =>
          c.faculty === form.faculty &&
          c.department === form.department &&
          c.level === form.level &&
          c.semester === form.semester &&
          (c.code.toLowerCase().includes(query.toLowerCase()) ||
            c.title.toLowerCase().includes(query.toLowerCase()) ||
            (c.alternateCodes ?? []).some((code) =>
              code.toLowerCase().includes(query.toLowerCase()),
            )),
      ),
    [query, form.faculty, form.department, form.level, form.semester, courses],
  );

  const validateStep1 = () => {
    if (!form.name || !form.regNumber || !form.email) return "Complete all required fields.";
    if (scan.regNumberTaken) return "Registration number is already registered. Please check or sign in.";
    if (scan.emailTaken) return "Email address is already registered. Please sign in instead.";
    if (form.password.length < 6) return "Password must be at least 6 characters.";
    if (form.password !== form.confirm) return "Passwords do not match.";
    if (!form.guardianName.trim() || !form.guardianPhone.trim() || !form.guardianEmail.trim())
      return "Guardian name, phone number, and email are required.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.guardianEmail.trim()))
      return "Enter a valid guardian email address.";
    return null;
  };

  const next = () => {
    setError(null);
    if (step === 0) {
      const err = validateStep1();
      if (err) return setError(err);
    }
    if (step === 2 && selected.length === 0) {
      return setError("Select at least one course.");
    }
    setStep((s) => Math.min(3, s + 1));
  };

  const submitEnrollment = async () => {
    setProcessing(true);
    setError(null);
    try {
      const image = captureUri ? await imageToBase64(captureUri) : undefined;
      const result = await biometricService.enroll(image);
      if (!result.ok) {
        setError(result.message);
        if (
          ["no_face", "multiple_faces", "poor_lighting", "validation_error"].includes(result.code)
        ) {
          setCaptured(false);
          setCaptureUri(null);
        }
        return;
      }
      const faceVector = result.vector;
      const duplicate = await biometricService.checkDuplicate(faceVector);
      if (!duplicate.ok) {
        setError(duplicate.message);
        return;
      }
      const user = await authService.registerStudent(
        {
          name: form.name,
          regNumber: form.regNumber,
          email: form.email,
          faculty: form.faculty,
          department: form.department,
          level: form.level,
          semester: form.semester,
          phone: form.phone,
          guardianName: form.guardianName,
          guardianPhone: form.guardianPhone,
          guardianEmail: form.guardianEmail,
          courseIds: selected,
          faceEnrolled: true,
          faceVector,
        },
        form.password,
      );
      signIn(user);
      setDone(true);
      toast.success("Face enrolled successfully");
      try {
        const guardianMail = await emailService.sendGuardianEmail("registration_confirmation");
        if (!guardianMail.success) {
          toast.warning(
            "Your account was created, but the guardian confirmation email could not be delivered.",
          );
        }
      } catch {
        toast.warning(
          "Your account was created, but the guardian confirmation email could not be delivered.",
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Face enrollment failed.";
      const duplicateFace =
        /face_duplicate|duplicate[^.]*face|face[^.]*(already|linked|duplicate)/i.test(message);
      setError(
        duplicateFace
          ? "This face is already linked to another student account. If you believe this is an error, contact your department administrator."
          : message,
      );
    } finally {
      setProcessing(false);
    }
  };

  if (done) {
    return (
      <main id="main-content" tabIndex={-1} className="flex min-h-screen items-center justify-center bg-background px-4 outline-none">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-success" aria-hidden />
            <h1 className="mt-4 text-xl font-semibold text-foreground">Account created</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Your face has been enrolled and your courses saved. You can now mark attendance for
              active sessions.
            </p>
            <Button className="mt-6 w-full" onClick={() => navigate({ to: "/student/dashboard" })}>
              Continue to dashboard
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-background px-4 py-10 outline-none">
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <div>
          <Button asChild variant="ghost" size="sm">
            <Link to="/">Back to home</Link>
          </Button>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
            Student registration
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Step {step + 1} of 4 — {STEPS[step]}
          </p>
          <div className="mt-3">
            <ProgressBar value={((step + 1) / 4) * 100} label="Registration progress" />
          </div>
        </div>

        <Card>
          <CardContent className="space-y-4 p-6">
            {step === 0 && (
              <>
                <Field label="Full name" id="name">
                  <Input
                    id="name"
                    name="name"
                    autoComplete="name"
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                  />
                </Field>
                <Field label="Registration number" id="reg">
                  <Input
                    id="reg"
                    name="registrationNumber"
                    placeholder="2021364065"
                    inputMode="numeric"
                    autoComplete="off"
                    value={form.regNumber}
                    onChange={(e) => set("regNumber", e.target.value)}
                  />
                </Field>
                <Field label="Email address" id="email">
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Password" id="pwd">
                    <Input
                      id="pwd"
                      name="password"
                      type="password"
                      autoComplete="new-password"
                      value={form.password}
                      onChange={(e) => set("password", e.target.value)}
                    />
                  </Field>
                  <Field label="Confirm password" id="pwd2">
                    <Input
                      id="pwd2"
                      name="confirmPassword"
                      type="password"
                      autoComplete="new-password"
                      value={form.confirm}
                      onChange={(e) => set("confirm", e.target.value)}
                    />
                  </Field>
                </div>
                <Field label="Phone number (optional)" id="phone">
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                  />
                </Field>

                <hr className="my-4" />
                <h3 className="text-sm font-medium text-foreground">Guardian Information</h3>
                <Field label="Guardian Name *" id="guardianName">
                  <Input
                    id="guardianName"
                    name="guardianName"
                    value={form.guardianName}
                    required
                    autoComplete="name"
                    onChange={(e) => set("guardianName", e.target.value)}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Guardian Phone *" id="guardianPhone">
                    <Input
                      id="guardianPhone"
                      name="guardianPhone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      required
                      value={form.guardianPhone}
                      onChange={(e) => set("guardianPhone", e.target.value)}
                    />
                  </Field>
                  <Field label="Guardian Email *" id="guardianEmail">
                    <Input
                      id="guardianEmail"
                      name="guardianEmail"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      required
                      value={form.guardianEmail}
                      onChange={(e) => set("guardianEmail", e.target.value)}
                    />
                  </Field>
                </div>
              </>
            )}

            {step === 1 && (
              <>
                <PickField
                  label="Faculty"
                  value={form.faculty}
                  options={faculties}
                  onChange={(v) => {
                    setForm((current) => ({ ...current, faculty: v, department: "" }));
                    setSelected([]);
                  }}
                />
                <PickField
                  label="Department"
                  value={form.department}
                  options={departments}
                  disabled={!form.faculty || departments.length === 0}
                  onChange={(v) => {
                    set("department", v);
                    setSelected([]);
                  }}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <PickField
                    label="Level"
                    value={form.level}
                    options={yearOptions.map((option) => option.label)}
                    displayValue={yearOptions.find((option) => option.value === form.level)?.label}
                    onChange={(v) =>
                      set("level", yearOptions.find((option) => option.label === v)?.value ?? "")
                    }
                  />
                  <PickField
                    label="Semester"
                    value={form.semester}
                    options={academic.semesters}
                    onChange={(v) => set("semester", v)}
                  />
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    aria-label="Search courses"
                    type="search"
                    placeholder="Search by code or title"
                    className="pl-9"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  {selected.length} course(s) selected · {form.department} · {form.level}
                </p>
                {filtered.length === 0 ? (
                  <p className="rounded-lg border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
                    No courses found for {form.department} at {form.level} ({form.semester}). Adjust
                    your search or change the department/level/semester on the previous step.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filtered.map((course) => {
                      const checked = selected.includes(course.id);
                      return (
                        <label
                          key={course.id}
                          className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 hover:bg-secondary"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={(v) =>
                              setSelected((s) =>
                                v ? [...s, course.id] : s.filter((id) => id !== course.id),
                              )
                            }
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-foreground">
                              {course.code} — {course.title}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {course.creditUnit} credit units · {course.level}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {step === 3 && (
              <>
                <p className="text-sm text-muted-foreground">
                  Capture a clear image of your face in even lighting. The image is sent to the
                  enrollment server and is not stored in your browser.
                </p>
                <CameraCaptureMock
                  captured={captured}
                  processing={processing}
                  onCapture={(uri) => {
                    setError(null);
                    setCaptureUri(uri);
                    setCaptured(true);
                  }}
                  onRetake={() => {
                    setError(null);
                    setCaptureUri(null);
                    setCaptured(false);
                  }}
                  captureLabel="Capture image"
                />
                {captured && !processing && (
                  <Button className="w-full" onClick={submitEnrollment}>
                    Submit enrollment
                  </Button>
                )}
                {processing && (
                  <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Enrolling your face…
                  </p>
                )}
              </>
            )}

            {error && <ErrorState title="Please review" description={error} />}

            <div className="flex justify-between pt-2">
              <Button
                variant="outline"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0 || processing}
              >
                Back
              </Button>
              {step < 3 && (
                <Button
                  onClick={next}
                  disabled={step === 0 && (scan.hasDuplicates || scan.checking)}
                >
                  {step === 0 && scan.checking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Continue
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function PickField({
  label,
  value,
  options,
  onChange,
  disabled = false,
  displayValue,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  disabled?: boolean;
  displayValue?: string;
}) {
  const id = `student-${label.toLowerCase().replaceAll(" ", "-")}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} name={id}>
          <SelectValue placeholder={displayValue ?? `Select ${label.toLowerCase()}`}>
            {displayValue}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
