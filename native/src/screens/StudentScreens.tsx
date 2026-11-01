import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, AppState, Linking, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Shell } from "@/components/Shell";
import {
  Badge,
  Button,
  Card,
  Empty,
  Field,
  Heading,
  Label,
  Loading,
  Metric,
  Notice,
  Progress,
  Select,
  ToggleRow,
} from "@/components/ui";
import { FaceScanner } from "@/components/FaceScanner";
import { useAuth } from "@/hooks/useAuth";
import { useCourses } from "@/hooks/useCourses";
import { useSessions } from "@/hooks/useSessions";
import { useResource } from "@/hooks/useResource";
import { useTheme } from "@/hooks/useTheme";
import { useAcademicOptions } from "@/hooks/useAcademicOptions";
import { attendanceService, hydrateSessions } from "@/services/attendanceService";
import { updateUserCourses } from "@/services/courseService";
import { authService } from "@/services/authService";
import { biometricService, imageToBase64 } from "@/services/biometricService";
import {
  locationService,
  type LocationReading,
  type LocationOutcome,
} from "@/services/locationService";
import { enablePush } from "@/services/pushService";
import type { AttendanceSession, StudentProfile } from "@/types";
const opts = (values: string[]) => values.map((value) => ({ label: value, value }));
export function SessionCard({
  session,
  lecturer = false,
  code,
}: {
  session: AttendanceSession;
  lecturer?: boolean;
  code?: string;
}) {
  return (
    <Card className="gap-3">
      <View className="flex-row items-center justify-between">
        <Badge tone="primary">{code ?? session.courseId}</Badge>
        <Badge tone={session.status === "active" ? "success" : "neutral"}>
          {session.status === "active" ? "Live session" : "Ended"}
        </Badge>
      </View>
      <Label className="text-lg font-bold">{session.topic}</Label>
      <Label muted className="text-xs">
        {session.lecturerName} · {session.date} · {session.startTime}
      </Label>
      <View className="flex-row items-center justify-between">
        <Label muted className="text-xs">
          {session.radius} m attendance area
        </Label>
        <Button
          small
          variant={session.status === "active" ? "primary" : "secondary"}
          onPress={() =>
            router.push(
              lecturer
                ? { pathname: "/lecturer/session/[sessionId]", params: { sessionId: session.id } }
                : {
                    pathname: "/student/attendance/[sessionId]",
                    params: { sessionId: session.id },
                  },
            )
          }
        >
          {lecturer ? "Open session" : "Check in"}
        </Button>
      </View>
    </Card>
  );
}
export function StudentDashboard() {
  const { user } = useAuth();
  const { courses } = useCourses();
  const sessions = useSessions();
  const records = useResource(
    () => attendanceService.getStudentRecords(user!.id),
    `records:${user?.id}`,
  );
  if (user?.role !== "student") return null;
  const mine = sessions.filter((s) => user.courseIds.includes(s.courseId));
  const active = mine.filter((s) => s.status === "active");
  const verified = records.data?.filter((r) => r.status === "verified").length ?? 0;
  return (
    <Shell
      title={`Hello, ${user.name.split(" ")[0]}`}
      subtitle="Your classroom presence, at a glance."
      refreshing={records.loading}
      onRefresh={() => {
        void records.reload();
        void hydrateSessions();
      }}
    >
      <LinearGradient
        colors={["#214ec8", "#112452"]}
        style={{ padding: 24, borderRadius: 28, gap: 10 }}
      >
        <Label className="text-xs font-semibold uppercase tracking-widest text-white/70">
          STUDENT DASHBOARD
        </Label>
        <Label className="text-2xl font-bold text-white">Ready for your next lecture?</Label>
        <Label className="text-sm leading-6 text-white/75">
          {active.length
            ? `${active.length} attendance session${active.length > 1 ? "s are" : " is"} open for your courses.`
            : "Your active lecture sessions will appear here."}
        </Label>
        <Badge tone="success">{user.regNumber}</Badge>
      </LinearGradient>
      <View className="flex-row flex-wrap gap-3">
        <Metric label="Enrolled courses" value={user.courseIds.length} />
        <Metric label="Verified check-ins" value={verified} />
      </View>
      {!user.faceEnrolled && (
        <Notice danger text="Complete face enrollment in your profile before marking attendance." />
      )}
      {records.error && <Notice danger text={records.error} />}
      <View className="flex-row items-center justify-between">
        <Label className="text-lg font-bold">Live attendance</Label>
        <Badge>{active.length} open</Badge>
      </View>
      {active.length === 0 ? (
        <Empty
          title="You’re all caught up"
          description="New lecture sessions for your enrolled courses appear here automatically."
        />
      ) : (
        active.map((s) => (
          <SessionCard
            key={s.id}
            session={s}
            code={courses.find((c) => c.id === s.courseId)?.code}
          />
        ))
      )}
      <Card className="gap-3">
        <Label className="font-semibold">Keep your profile complete</Label>
        <Label muted className="text-sm leading-5">
          Check your courses, guardian details and face enrollment before the next class.
        </Label>
        <Button variant="secondary" onPress={() => router.push("/student/profile")}>
          Review profile
        </Button>
      </Card>
    </Shell>
  );
}
export function CoursesScreen({ lecturer = false }: { lecturer?: boolean }) {
  const { user, refreshUser } = useAuth();
  const { courses, loading, error, reload } = useCourses();
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("all");
  const [semester, setSemester] = useState("all");
  const [level, setLevel] = useState("all");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  useEffect(() => setSelected(user?.courseIds ?? []), [user?.id, user?.courseIds]);
  useEffect(() => setPage(1), [query, department, semester, level]);
  const filtered = courses.filter(
    (c) =>
      (department === "all" || c.department === department) &&
      (semester === "all" || c.semester === semester) &&
      (level === "all" || c.level === level) &&
      `${c.code} ${c.title}`.toLowerCase().includes(query.toLowerCase()),
  );
  const save = async () => {
    if (!user) return;
    setBusy(true);
    setMessage(null);
    try {
      await updateUserCourses(user.id, selected);
      await refreshUser();
      setMessage("Your courses have been saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save courses.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Shell
      title={lecturer ? "Teaching courses" : "My courses"}
      subtitle={
        lecturer
          ? "Manage the courses assigned to your teaching profile."
          : "Choose the courses you are taking this semester."
      }
      refreshing={loading}
      onRefresh={() => void reload()}
    >
      <View className="flex-row gap-3">
        <Metric label={lecturer ? "Assigned" : "Enrolled"} value={selected.length} />
        <Metric label="Available courses" value={courses.length} />
      </View>
      <Card className="gap-4">
        <Field
          label="Search courses"
          placeholder="Code or course title"
          value={query}
          onChangeText={setQuery}
        />
        <Select
          label="Department"
          value={department}
          onChange={setDepartment}
          options={[
            { label: "All departments", value: "all" },
            ...opts([...new Set(courses.map((c) => c.department))]),
          ]}
        />
        <View className="flex-row gap-3">
          <View className="flex-1">
            <Select
              label="Level"
              value={level}
              onChange={setLevel}
              options={[
                { label: "All levels", value: "all" },
                ...opts([...new Set(courses.map((c) => c.level))]),
              ]}
            />
          </View>
          <View className="flex-1">
            <Select
              label="Semester"
              value={semester}
              onChange={setSemester}
              options={[
                { label: "All semesters", value: "all" },
                ...opts([...new Set(courses.map((c) => c.semester))]),
              ]}
            />
          </View>
        </View>
      </Card>
      {error && <Notice danger text={error} />}
      {message && <Notice text={message} />}
      {loading && courses.length === 0 ? (
        <Loading />
      ) : filtered.length === 0 ? (
        <Empty title="No matching courses" />
      ) : (
        <Card>
          {filtered.slice((page - 1) * 25, page * 25).map((c) => (
            <ToggleRow
              key={c.id}
              label={`${c.code} · ${c.creditUnit} units`}
              detail={`${c.title}\n${c.department} · ${c.level}`}
              checked={selected.includes(c.id)}
              onPress={() =>
                setSelected((prev) =>
                  prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id],
                )
              }
            />
          ))}
        </Card>
      )}
      {filtered.length > 25 && (
        <View className="flex-row items-center justify-between">
          <Button
            small
            variant="secondary"
            disabled={page <= 1}
            onPress={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <Label muted className="text-xs">
            {page} / {Math.ceil(filtered.length / 25)}
          </Label>
          <Button
            small
            variant="secondary"
            disabled={page * 25 >= filtered.length}
            onPress={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </View>
      )}
      <Button busy={busy} onPress={() => void save()}>
        Save course selection
      </Button>
    </Shell>
  );
}
export function HistoryScreen() {
  const { user } = useAuth();
  const { courses } = useCourses();
  const records = useResource(
    () => attendanceService.getStudentRecords(user!.id),
    `history:${user?.id}`,
  );
  const [course, setCourse] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [course, status]);
  const rows = (records.data ?? []).filter(
    (r) => (course === "all" || r.courseId === course) && (status === "all" || r.status === status),
  );
  const present = records.data?.filter((r) => r.status === "verified").length ?? 0;
  return (
    <Shell
      title="Attendance history"
      subtitle="Your verified record across all courses."
      refreshing={records.loading}
      onRefresh={() => void records.reload()}
    >
      <View className="flex-row gap-3">
        <Metric label="Verified" value={present} />
        <Metric label="Total records" value={records.data?.length ?? 0} />
      </View>
      <Card className="gap-3">
        <Select
          label="Course"
          value={course}
          onChange={setCourse}
          options={[
            { label: "All courses", value: "all" },
            ...courses
              .filter((c) => user?.courseIds.includes(c.id))
              .map((c) => ({ label: c.code, value: c.id })),
          ]}
        />
        <Select
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { label: "All statuses", value: "all" },
            ...opts(["verified", "missed", "failed"]),
          ]}
        />
      </Card>
      {records.error && <Notice danger text={records.error} />}
      {records.loading && !records.data ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Empty title="No attendance records" description="Completed check-ins will appear here." />
      ) : (
        rows.slice((page - 1) * 25, page * 25).map((r) => (
          <Card key={r.id} className="gap-3">
            <View className="flex-row justify-between">
              <Badge tone="primary">
                {courses.find((c) => c.id === r.courseId)?.code ?? r.courseId}
              </Badge>
              <Badge tone={r.status === "verified" ? "success" : "danger"}>{r.status}</Badge>
            </View>
            <Label className="font-semibold">{r.topic}</Label>
            <Label muted className="text-xs">
              {r.date} · {r.verifiedAt ?? "No verification time"}
            </Label>
            {r.distance !== null && (
              <Label muted className="text-xs">
                Venue distance: {Math.round(r.distance)} m
              </Label>
            )}
          </Card>
        ))
      )}
      {rows.length > 25 && (
        <View className="flex-row justify-between">
          <Button
            small
            variant="secondary"
            disabled={page === 1}
            onPress={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <Button
            small
            variant="secondary"
            disabled={page * 25 >= rows.length}
            onPress={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </View>
      )}
    </Shell>
  );
}
export function ProfileScreen() {
  const { user, refreshUser } = useAuth();
  const { preference, setPreference } = useTheme();
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [scanner, setScanner] = useState(false);
  const [password, setPassword] = useState("");
  const [cameraStatus, setCameraStatus] = useState("Not checked");
  const academic = useAcademicOptions(form.faculty);
  useEffect(() => {
    if (user)
      setForm(
        Object.fromEntries(Object.entries(user).filter(([, v]) => typeof v === "string")) as Record<
          string,
          string
        >,
      );
  }, [user]);
  if (!user) return null;
  const student = user.role === "student";
  const update = (key: string) => (value: string) => setForm((prev) => ({ ...prev, [key]: value }));
  const field = (key: string, label: string, extra = {}) => (
    <Field key={key} label={label} value={form[key] ?? ""} onChangeText={update(key)} {...extra} />
  );
  const action = async (task: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await task();
      setMessage(success);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "The action failed.");
    } finally {
      setBusy(false);
    }
  };
  const save = () =>
    action(async () => {
      if (student) await authService.updateStudentProfile(user.id, form);
      else if (user.role === "lecturer") await authService.updateLecturerProfile(user.id, form);
      await refreshUser();
    }, "Profile saved.");
  const capture = async (uri: string) => {
    setScanner(false);
    await action(async () => {
      const image = await imageToBase64(uri);
      const enrolled = await biometricService.enroll(image);
      if (!enrolled.ok || !enrolled.vector)
        throw new Error(!enrolled.ok ? enrolled.message : "No face features returned.");
      const duplicate = await biometricService.checkDuplicate(enrolled.vector, user.id);
      if (!duplicate.ok) throw new Error(duplicate.message);
      await authService.enrollFace(user.id, enrolled.vector);
      await refreshUser();
    }, "Face enrollment updated.");
  };
  return (
    <Shell title="My profile" subtitle="Your identity, academic details and preferences.">
      <Card className="items-center gap-3">
        <View className="h-20 w-20 items-center justify-center rounded-3xl bg-primary/10">
          <Label className="text-3xl font-bold text-primary">
            {user.name
              .split(" ")
              .map((n) => n[0])
              .slice(0, 2)
              .join("")}
          </Label>
        </View>
        <Label className="text-xl font-bold">{user.name}</Label>
        <Label muted className="text-sm">
          {user.email}
        </Label>
        <Badge tone={student && user.faceEnrolled ? "success" : "primary"}>
          {student ? user.regNumber : user.role === "lecturer" ? user.staffId : "Administrator"}
        </Badge>
      </Card>
      {message && <Notice text={message} />}
      <Card className="gap-4">
        <Label className="text-lg font-bold">Personal details</Label>
        {field("name", "Full name")}
        {field("phone", "Phone number", { keyboardType: "phone-pad" })}
        <Select
          label="Faculty"
          value={form.faculty ?? ""}
          onChange={update("faculty")}
          options={opts(academic.faculties.map((f) => f.name))}
        />
        <Select
          label="Department"
          value={form.department ?? ""}
          onChange={update("department")}
          options={opts(academic.departments.map((d) => d.name))}
        />
        {student && (
          <>
            <Select
              label="Level"
              value={form.level ?? ""}
              onChange={update("level")}
              options={opts(academic.levels)}
            />
            <Select
              label="Semester"
              value={form.semester ?? ""}
              onChange={update("semester")}
              options={opts(academic.semesters)}
            />
            <Label className="mt-2 font-bold">Guardian details</Label>
            {field("guardianName", "Guardian name")}
            {field("guardianPhone", "Guardian phone", { keyboardType: "phone-pad" })}
            {field("guardianEmail", "Guardian email", {
              keyboardType: "email-address",
              autoCapitalize: "none",
            })}
            {field("guardianRelationship", "Relationship")}
            <Select
              label="Notification preference"
              value={form.notificationChannel ?? "both"}
              onChange={update("notificationChannel")}
              options={opts(["email", "push", "both", "none"])}
            />
          </>
        )}
        <Button busy={busy} onPress={() => void save()}>
          Save profile
        </Button>
      </Card>
      {student && (
        <Card className="gap-4">
          <Label className="text-lg font-bold">Face enrollment</Label>
          <Badge tone={user.faceEnrolled ? "success" : "warning"}>
            {user.faceEnrolled ? "Face enrolled" : "Enrollment required"}
          </Badge>
          <Label muted className="text-sm leading-5">
            Update your enrolled face using a fresh live challenge.
          </Label>
          <Button variant="secondary" disabled={busy} onPress={() => setScanner(true)}>
            {user.faceEnrolled ? "Update face enrollment" : "Enroll your face"}
          </Button>
        </Card>
      )}
      <Card className="gap-4">
        <Label className="text-lg font-bold">Device and appearance</Label>
        <Select
          label="Theme"
          value={preference}
          onChange={(value) => setPreference(value as typeof preference)}
          options={opts(["system", "light", "dark"])}
        />
        <Button
          variant="secondary"
          busy={busy}
          onPress={() =>
            void action(() => enablePush(user.id), "Notifications enabled for this device.")
          }
        >
          Enable push notifications
        </Button>
        <Button variant="secondary" onPress={() => void Linking.openSettings()}>
          Open app permissions
        </Button>
      </Card>
      <Card className="gap-4">
        <Label className="text-lg font-bold">Account security</Label>
        <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry />
        <Button
          busy={busy}
          variant="secondary"
          onPress={() =>
            void action(async () => {
              if (password.length < 8) throw new Error("Use at least eight characters.");
              const { getSupabase } = await import("@/lib/supabase");
              const { error } = await getSupabase()!.auth.updateUser({ password });
              if (error) throw error;
              setPassword("");
            }, "Password updated.")
          }
        >
          Change password
        </Button>
      </Card>
      <FaceScanner visible={scanner} onClose={() => setScanner(false)} onCaptured={capture} />
    </Shell>
  );
}
export function AttendanceScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { user } = useAuth();
  const sessions = useSessions();
  const session = sessions.find((s) => s.id === sessionId);
  const { courses } = useCourses();
  const [outcome, setOutcome] = useState<LocationOutcome | null>(null);
  const [preview, setPreview] = useState<LocationReading | null>(null);
  const [step, setStep] = useState("Finding your location…");
  const [locating, setLocating] = useState(false);
  const [scanner, setScanner] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ recordedAt: string; distance?: number } | null>(null);
  const controller = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const existing = useResource(
    () => attendanceService.getStudentRecords(user!.id),
    `checkin:${user?.id}:${sessionId}`,
  );
  const locate = useCallback(async () => {
    if (!session || session.status !== "active" || !user?.courseIds.includes(session.courseId))
      return null;
    controller.current?.abort();
    const task = new AbortController();
    controller.current = task;
    setLocating(true);
    setOutcome(null);
    const value = await locationService.acquire(session.anchor, session.radius, {
      signal: task.signal,
      onReading: (r) => {
        if (alive.current && !task.signal.aborted) setPreview(r);
      },
      onStep: (s) => {
        if (alive.current && !task.signal.aborted) setStep(s);
      },
    });
    if (alive.current && !task.signal.aborted) {
      setOutcome(value);
      setLocating(false);
    }
    return value;
  }, [session, user?.courseIds]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, []);
  const alreadyVerified = Boolean(
    existing.data?.some((r) => r.sessionId === sessionId && r.status === "verified"),
  );
  useEffect(() => {
    if (result || alreadyVerified) return;
    void locate();
    const subscription = AppState.addEventListener("change", (value) => {
      if (value === "active" && !busy) void locate();
      else if (value !== "active") {
        controller.current?.abort();
        setLocating(false);
        setScanner(false);
      }
    });
    return () => {
      subscription.remove();
      controller.current?.abort();
    };
  }, [locate, result, alreadyVerified, busy]);
  const captured = async (uri: string) => {
    setScanner(false);
    if (user?.role !== "student" || !session) return;
    setBusy(true);
    setError(null);
    try {
      const image = await imageToBase64(uri);
      if (!alive.current) return;
      const face = await biometricService.verify(image, user.faceVector);
      if (!face.ok) throw new Error(face.message);
      if (!alive.current || AppState.currentState !== "active") return;
      const fresh = await locate();
      if (!fresh?.ok)
        throw new Error(
          fresh && !fresh.ok ? fresh.message : "Location verification was interrupted.",
        );
      if (!alive.current || controller.current?.signal.aborted) return;
      const recorded = await attendanceService.recordAttendance(session.id, {
        faceScore: face.score,
        lat: fresh.reading.lat,
        lng: fresh.reading.lng,
        gpsAccuracy: fresh.reading.accuracy,
        locationTimestamp: fresh.reading.timestamp!,
        distance: fresh.distance,
      });
      if (alive.current) setResult(recorded);
    } catch (e) {
      if (alive.current)
        setError(e instanceof Error ? e.message : "Attendance verification failed.");
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  const recorded = existing.data?.find((r) => r.sessionId === sessionId && r.status === "verified");
  if (!session)
    return (
      <Shell title="Attendance check-in" back>
        <Empty
          title="Session unavailable"
          description="Refresh your dashboard or ask the lecturer whether the session has ended."
          action={
            <Button
              onPress={() => {
                void hydrateSessions();
                router.replace("/student/dashboard");
              }}
            >
              Return to dashboard
            </Button>
          }
        />
      </Shell>
    );
  const reading = outcome?.reading ?? preview;
  return (
    <Shell
      title="Attendance check-in"
      subtitle={courses.find((c) => c.id === session.courseId)?.title ?? session.topic}
      back
    >
      <Card className="gap-3">
        <View className="flex-row justify-between">
          <Badge tone="primary">
            {courses.find((c) => c.id === session.courseId)?.code ?? session.courseId}
          </Badge>
          <Badge tone={session.status === "active" ? "success" : "neutral"}>{session.status}</Badge>
        </View>
        <Label className="text-xl font-bold">{session.topic}</Label>
        <Label muted className="text-xs">
          {session.lecturerName} · {session.startTime} · {session.radius} m zone
        </Label>
      </Card>
      {result || recorded ? (
        <Card className="items-center gap-4 py-8">
          <Badge tone="success">Attendance verified</Badge>
          <Heading>You’re checked in</Heading>
          <Label muted className="text-sm">
            Recorded at {result?.recordedAt ?? recorded?.verifiedAt}
          </Label>
          <Button onPress={() => router.replace("/student/dashboard")}>Return to dashboard</Button>
        </Card>
      ) : session.status !== "active" ? (
        <Notice danger text="This attendance session has ended." />
      ) : !user?.courseIds.includes(session.courseId) ? (
        <Notice danger text="Enroll in this course before checking in." />
      ) : (
        <>
          <View className="flex-row gap-2">
            {[
              ["1. Session", true],
              ["2. Location", outcome?.ok],
              ["3. Face", false],
            ].map(([label, done]) => (
              <View
                key={String(label)}
                className="flex-1 rounded-2xl border border-border bg-card p-3"
              >
                <Label
                  className={`text-center text-xs font-semibold ${done ? "text-success" : "text-muted-foreground"}`}
                >
                  {label}
                </Label>
              </View>
            ))}
          </View>
          <Card className="gap-4">
            <View className="items-center gap-3 py-3">
              <View className="h-28 w-28 items-center justify-center rounded-full border border-primary/30 bg-primary/10">
                <Label className="text-3xl">{outcome?.ok ? "✓" : "◎"}</Label>
              </View>
              <Label className="text-center font-semibold">
                {outcome?.ok ? "Location verified" : step}
              </Label>
            </View>
            {reading && (
              <View className="flex-row gap-3">
                <Metric label="Estimated accuracy" value={`±${Math.ceil(reading.accuracy)} m`} />
                <Metric
                  label="Venue distance"
                  value={
                    outcome?.distance !== undefined
                      ? `${Math.round(outcome.distance)} m`
                      : "Checking"
                  }
                />
              </View>
            )}
            {outcome && !outcome.ok && <Notice danger text={outcome.message} />}
            {!locating && (
              <Button variant="secondary" disabled={busy} onPress={() => void locate()}>
                Retry location
              </Button>
            )}
            <Button variant="ghost" onPress={() => void Linking.openSettings()}>
              Location permissions and settings
            </Button>
          </Card>
          {error && <Notice danger text={error} />}
          <Card className="gap-4">
            <Label className="text-lg font-bold">Live face verification</Label>
            <Label muted className="text-sm leading-5">
              Complete the face challenge. A fresh location check runs again before your attendance
              is recorded.
            </Label>
            <Button
              busy={busy}
              disabled={!outcome?.ok || user?.role !== "student" || !user.faceEnrolled}
              onPress={() => setScanner(true)}
            >
              Verify face and check in
            </Button>
            {user?.role === "student" && !user.faceEnrolled && (
              <Button variant="secondary" onPress={() => router.push("/student/profile")}>
                Complete face enrollment
              </Button>
            )}
          </Card>
        </>
      )}
      <FaceScanner visible={scanner} onClose={() => setScanner(false)} onCaptured={captured} />
    </Shell>
  );
}
