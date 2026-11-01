import { useState } from "react";
import { View } from "react-native";
import { router } from "expo-router";
import { Shell } from "@/components/Shell";
import {
  Badge,
  Button,
  Card,
  Field,
  Label,
  Notice,
  Progress,
  Select,
  ToggleRow,
} from "@/components/ui";
import { FaceScanner } from "@/components/FaceScanner";
import { useAcademicOptions } from "@/hooks/useAcademicOptions";
import { useCourses } from "@/hooks/useCourses";
import { useAuth } from "@/hooks/useAuth";
import { authService } from "@/services/authService";
import { biometricService, imageToBase64 } from "@/services/biometricService";
const options = (values: string[]) => values.map((value) => ({ label: value, value }));
export function RegistrationScreen({ lecturer = false }: { lecturer?: boolean }) {
  const { signIn } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    regNumber: "",
    staffId: "",
    phone: "",
    faculty: "",
    department: "",
    level: "",
    semester: "",
    guardianName: "",
    guardianPhone: "",
    guardianEmail: "",
    guardianRelationship: "Parent",
  });
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [scanner, setScanner] = useState(false);
  const academic = useAcademicOptions(form.faculty);
  const { courses } = useCourses();
  const steps = lecturer
    ? ["Personal", "Academic", "Review"]
    : ["Personal", "Academic", "Courses", "Face enrollment"];
  const set = (key: keyof typeof form) => (value: string) =>
    setForm((prev) => ({
      ...prev,
      [key]: value,
      ...(key === "faculty" ? { department: "" } : {}),
    }));
  const field = (key: keyof typeof form, label: string, extra = {}) => (
    <Field key={key} label={label} value={form[key]} onChangeText={set(key)} {...extra} />
  );
  const validate = () => {
    if (step === 0) {
      if (
        !form.name.trim() ||
        !form.email.trim() ||
        form.password.length < 8 ||
        !form.phone.trim() ||
        !(lecturer ? form.staffId : form.regNumber).trim()
      )
        throw new Error(
          "Complete your personal details and use a password of at least eight characters.",
        );
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
        throw new Error("Enter a valid email address.");
      if (
        !lecturer &&
        (!form.guardianName.trim() ||
          !form.guardianPhone.trim() ||
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.guardianEmail))
      )
        throw new Error("Guardian name, phone number and a valid email address are required.");
    }
    if (
      step === 1 &&
      (!form.faculty || !form.department || (!lecturer && (!form.level || !form.semester)))
    )
      throw new Error("Complete the academic fields.");
    if (step === 2 && !lecturer && selected.length === 0)
      throw new Error("Select at least one course.");
  };
  const next = async () => {
    setError(null);
    try {
      validate();
      if (step === 0) {
        setBusy(true);
        const availability = await authService.checkAvailability({
          email: form.email,
          regNumber: lecturer ? undefined : form.regNumber,
          staffId: lecturer ? form.staffId : undefined,
        });
        if (availability.emailTaken || availability.regNumberTaken || availability.staffIdTaken)
          throw new Error(
            "The email or institutional identifier is already registered. Sign in or contact your administrator.",
          );
      }
      setStep((value) => Math.min(steps.length - 1, value + 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check the form.");
    } finally {
      setBusy(false);
    }
  };
  const submitLecturer = async () => {
    setBusy(true);
    setError(null);
    try {
      const profile = await authService.registerLecturer(form, form.password);
      signIn(profile);
      router.replace("/lecturer/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setBusy(false);
    }
  };
  const captured = async (uri: string) => {
    setScanner(false);
    setBusy(true);
    setError(null);
    try {
      const image = await imageToBase64(uri);
      const enrollment = await biometricService.enroll(image);
      if (!enrollment.ok || !enrollment.vector)
        throw new Error(!enrollment.ok ? enrollment.message : "Face features were not returned.");
      const duplicate = await biometricService.checkDuplicate(enrollment.vector);
      if (!duplicate.ok) throw new Error(duplicate.message);
      const profile = await authService.registerStudent(
        { ...form, courseIds: selected, faceVector: enrollment.vector },
        form.password,
      );
      signIn(profile);
      router.replace("/student/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Face enrollment failed.");
    } finally {
      setBusy(false);
    }
  };
  const available = courses.filter(
    (course) =>
      (!form.department || course.department === form.department) &&
      (!form.level || course.level === form.level) &&
      (!form.semester || course.semester === form.semester),
  );
  return (
    <Shell
      publicPage
      back
      title={lecturer ? "Join as a lecturer" : "Create your student account"}
      subtitle="Your campus. Your courses. Your verified identity."
    >
      <Card className="gap-4">
        <View className="flex-row justify-between">
          <Badge tone="primary">
            Step {step + 1} of {steps.length}
          </Badge>
          <Label className="text-sm font-semibold">{steps[step]}</Label>
        </View>
        <Progress value={((step + 1) / steps.length) * 100} />
      </Card>
      {error && <Notice danger text={error} />}
      {academic.error && <Notice danger text={academic.error} />}
      <Card className="gap-4">
        {step === 0 && (
          <>
            {field("name", "Full name", { autoComplete: "name" })}
            {field("email", "Email address", {
              keyboardType: "email-address",
              autoCapitalize: "none",
            })}
            {field("password", "Password", { secureTextEntry: true })}
            {field(
              lecturer ? "staffId" : "regNumber",
              lecturer ? "Staff ID" : "Registration number",
            )}
            {field("phone", "Phone number", { keyboardType: "phone-pad" })}
            {!lecturer && (
              <>
                <Label className="mt-3 text-base font-bold">Guardian details</Label>
                {field("guardianName", "Guardian name")}
                {field("guardianPhone", "Guardian phone", { keyboardType: "phone-pad" })}
                {field("guardianEmail", "Guardian email", {
                  keyboardType: "email-address",
                  autoCapitalize: "none",
                })}
                {field("guardianRelationship", "Relationship")}
              </>
            )}
          </>
        )}
        {step === 1 && (
          <>
            <Select
              label="Faculty"
              value={form.faculty}
              onChange={set("faculty")}
              options={options(academic.faculties.map((f) => f.name))}
            />
            <Select
              label="Department"
              value={form.department}
              onChange={set("department")}
              options={options(academic.departments.map((d) => d.name))}
            />
            {!lecturer && (
              <>
                <Select
                  label="Level"
                  value={form.level}
                  onChange={set("level")}
                  options={options(academic.levels)}
                />
                <Select
                  label="Semester"
                  value={form.semester}
                  onChange={set("semester")}
                  options={options(academic.semesters)}
                />
              </>
            )}
          </>
        )}
        {step === 2 && !lecturer && (
          <>
            <Label muted className="text-sm">
              Select the courses you are taking this semester.
            </Label>
            {available.length === 0 ? (
              <Notice text="No courses match these academic details. Check your selections or contact the department administrator." />
            ) : (
              available.map((course) => (
                <ToggleRow
                  key={course.id}
                  label={course.code}
                  detail={course.title}
                  checked={selected.includes(course.id)}
                  onPress={() =>
                    setSelected((prev) =>
                      prev.includes(course.id)
                        ? prev.filter((id) => id !== course.id)
                        : [...prev, course.id],
                    )
                  }
                />
              ))
            )}
          </>
        )}
        {step === 2 && lecturer && (
          <>
            <Label className="text-lg font-bold">Review your details</Label>
            {[
              ["Name", form.name],
              ["Email", form.email],
              ["Staff ID", form.staffId],
              ["Faculty", form.faculty],
              ["Department", form.department],
            ].map(([label, value]) => (
              <View key={label} className="gap-1">
                <Label muted className="text-xs">
                  {label}
                </Label>
                <Label className="text-sm">{value}</Label>
              </View>
            ))}
            <Notice text="Your administrator must approve your lecturer account before you create attendance sessions." />
            <Button busy={busy} onPress={() => void submitLecturer()}>
              Submit registration
            </Button>
          </>
        )}
        {step === 3 && !lecturer && (
          <>
            <Label className="text-lg font-bold">Secure your student identity</Label>
            <Label muted className="text-sm leading-6">
              Complete a live face challenge. Your face features will be checked for duplicate
              enrollment before your account is completed.
            </Label>
            <Badge tone="primary">{selected.length} courses selected</Badge>
            <Button busy={busy} onPress={() => setScanner(true)}>
              Start face enrollment
            </Button>
          </>
        )}
      </Card>
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Button
            disabled={step === 0 || busy}
            variant="secondary"
            onPress={() => setStep((v) => v - 1)}
          >
            Back
          </Button>
        </View>
        {step < steps.length - 1 && (
          <View className="flex-1">
            <Button busy={busy} onPress={() => void next()}>
              Continue
            </Button>
          </View>
        )}
      </View>
      <FaceScanner visible={scanner} onClose={() => setScanner(false)} onCaptured={captured} />
    </Shell>
  );
}
