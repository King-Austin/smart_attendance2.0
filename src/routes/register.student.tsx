import { useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Loader2, Search } from "lucide-react";
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
import { ACADEMIC_SESSIONS, DEPARTMENTS, FACULTIES, LEVELS, SEMESTERS } from "@/data/constants";
import { authService } from "@/services/authService";
import { biometricService, imageToBase64 } from "@/services/biometricService";
import { useAuth } from "@/hooks/useAuth";
import { useCourses } from "@/hooks/useCourses";

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
    faculty: FACULTIES[0],
    department: DEPARTMENTS[0],
    level: LEVELS[4],
    semester: SEMESTERS[1],
    academicSession: ACADEMIC_SESSIONS[2],
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [captured, setCaptured] = useState(false);
  const [captureUri, setCaptureUri] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const filtered = useMemo(
    () =>
      courses.filter(
        (c) =>
          c.department === form.department &&
          c.level === form.level &&
          c.semester === form.semester &&
          (c.code.toLowerCase().includes(query.toLowerCase()) ||
            c.title.toLowerCase().includes(query.toLowerCase())),
      ),
    [query, form.department, form.level, form.semester, courses],
  );

  const validateStep1 = () => {
    if (!form.name || !form.regNumber || !form.email) return "Complete all required fields.";
    if (form.password.length < 6) return "Password must be at least 6 characters.";
    if (form.password !== form.confirm) return "Passwords do not match.";
    if (!form.guardianName || !form.guardianEmail) return "Guardian name and email are required.";
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
    let faceVector: number[] | undefined;
    try {
      const image = captureUri ? await imageToBase64(captureUri) : undefined;
      const result = await biometricService.enroll(image);
      if (!result.ok) {
        setProcessing(false);
        setError(result.message);
        setCaptured(false);
        setCaptureUri(null);
        return;
      }
      faceVector = result.vector;
    } catch (err) {
      setProcessing(false);
      setError(err instanceof Error ? err.message : "Face enrollment failed.");
      setCaptured(false);
      setCaptureUri(null);
      return;
    }
    const duplicate = await biometricService.checkDuplicate(faceVector);
    if (!duplicate.ok) {
      setProcessing(false);
      setError(duplicate.message);
      setCaptured(false);
      setCaptureUri(null);
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
        academicSession: form.academicSession,
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
    setProcessing(false);
    signIn(user);
    setDone(true);
    toast.success("Face enrolled successfully");
  };

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
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
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                  />
                </Field>
                <Field label="Registration number" id="reg">
                  <Input
                    id="reg"
                    placeholder="2023/ENG/1042"
                    value={form.regNumber}
                    onChange={(e) => set("regNumber", e.target.value)}
                  />
                </Field>
                <Field label="Email address" id="email">
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => set("email", e.target.value)}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Password" id="pwd">
                    <Input
                      id="pwd"
                      type="password"
                      value={form.password}
                      onChange={(e) => set("password", e.target.value)}
                    />
                  </Field>
                  <Field label="Confirm password" id="pwd2">
                    <Input
                      id="pwd2"
                      type="password"
                      value={form.confirm}
                      onChange={(e) => set("confirm", e.target.value)}
                    />
                  </Field>
                </div>
                <Field label="Phone number (optional)" id="phone">
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                  />
                </Field>
                
                <hr className="my-4" />
                <h3 className="text-sm font-medium text-foreground">Guardian Information</h3>
                <Field label="Guardian Name" id="guardianName">
                  <Input
                    id="guardianName"
                    value={form.guardianName}
                    onChange={(e) => set("guardianName", e.target.value)}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Guardian Phone" id="guardianPhone">
                    <Input
                      id="guardianPhone"
                      value={form.guardianPhone}
                      onChange={(e) => set("guardianPhone", e.target.value)}
                    />
                  </Field>
                  <Field label="Guardian Email" id="guardianEmail">
                    <Input
                      id="guardianEmail"
                      type="email"
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
                  options={FACULTIES}
                  onChange={(v) => set("faculty", v)}
                />
                <PickField
                  label="Department"
                  value={form.department}
                  options={DEPARTMENTS}
                  onChange={(v) => set("department", v)}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <PickField
                    label="Level"
                    value={form.level}
                    options={LEVELS}
                    onChange={(v) => set("level", v)}
                  />
                  <PickField
                    label="Semester"
                    value={form.semester}
                    options={SEMESTERS}
                    onChange={(v) => set("semester", v)}
                  />
                </div>
                <PickField
                  label="Academic session"
                  value={form.academicSession}
                  options={ACADEMIC_SESSIONS}
                  onChange={(v) => set("academicSession", v)}
                />
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
                    No courses found for {form.department} at {form.level} ({form.semester}). Adjust your search or
                    change the department/level/semester on the previous step.
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
              {step < 3 && <Button onClick={next}>Continue</Button>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
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
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label}>
          <SelectValue />
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
