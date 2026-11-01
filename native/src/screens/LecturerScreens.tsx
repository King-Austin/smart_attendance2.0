import { useEffect, useRef, useState } from "react";
import { Alert, Linking, View } from "react-native";
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
  Select,
} from "@/components/ui";
import { SessionCard } from "./StudentScreens";
import { useAuth } from "@/hooks/useAuth";
import { useCourses } from "@/hooks/useCourses";
import { useSessions, useSessionFeed } from "@/hooks/useSessions";
import { useResource } from "@/hooks/useResource";
import { attendanceService, countEnrolled, hydrateSessions } from "@/services/attendanceService";
import { locationService, type LocationReading } from "@/services/locationService";
import { listVerifiedVenues } from "@/services/venueService";
import { exportAttendance } from "@/services/exportService";
import { notifySession } from "@/services/pushService";
export function LecturerDashboard() {
  const { user, refreshUser } = useAuth();
  const sessions = useSessions();
  const { courses } = useCourses();
  const [message, setMessage] = useState<string | null>(null);
  if (user?.role !== "lecturer") return null;
  const mine = sessions.filter((s) => s.lecturerId === user.id);
  return (
    <Shell
      title={`Hello, ${user.name.split(" ")[0]}`}
      subtitle="Teach more. Spend less time taking attendance."
      onRefresh={() => {
        void hydrateSessions();
        void refreshUser();
      }}
    >
      <LinearGradient
        colors={["#214ec8", "#112452"]}
        style={{ borderRadius: 28, padding: 24, gap: 12 }}
      >
        <Label className="text-xs uppercase tracking-widest text-white/70">
          LECTURER WORKSPACE
        </Label>
        <Label className="text-2xl font-bold text-white">Your classroom,{`\n`}connected.</Label>
        <Label className="text-sm leading-5 text-white/75">
          Open a live session and watch verified check-ins arrive.
        </Label>
      </LinearGradient>
      {user.approvalStatus !== "approved" ? (
        <Card className="gap-4">
          <Badge tone="warning">Account {user.approvalStatus}</Badge>
          <Notice text="Your administrator must approve this lecturer account before session creation is enabled." />
          <Button variant="secondary" onPress={() => void refreshUser()}>
            Check approval status
          </Button>
        </Card>
      ) : (
        <Button onPress={() => router.push("/lecturer/create-session")}>
          Create attendance session
        </Button>
      )}
      <View className="flex-row flex-wrap gap-3">
        <Metric label="Assigned courses" value={user.courseIds.length} />
        <Metric label="Sessions held" value={mine.length} />
      </View>
      <Label className="text-lg font-bold">Recent sessions</Label>
      {mine.length === 0 ? (
        <Empty
          title="Your first session starts here"
          description="Select your teaching courses, then open a live session."
        />
      ) : (
        mine
          .slice(0, 5)
          .map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              lecturer
              code={courses.find((c) => c.id === s.courseId)?.code}
            />
          ))
      )}
      <Button variant="secondary" onPress={() => router.push("/lecturer/sessions")}>
        View all sessions
      </Button>
    </Shell>
  );
}
export function SessionsScreen() {
  const { user } = useAuth();
  const sessions = useSessions();
  const { courses } = useCourses();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const rows = sessions.filter(
    (s) =>
      s.lecturerId === user?.id &&
      (status === "all" || s.status === status) &&
      `${s.topic} ${courses.find((c) => c.id === s.courseId)?.code}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  useEffect(() => setPage(1), [query, status]);
  return (
    <Shell
      title="Attendance sessions"
      subtitle="Your live sessions and past lecture records."
      onRefresh={() => void hydrateSessions()}
    >
      <Button onPress={() => router.push("/lecturer/create-session")}>New session</Button>
      <Card className="gap-4">
        <Field
          label="Search sessions"
          value={query}
          onChangeText={setQuery}
          placeholder="Topic or course code"
        />
        <Select
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { label: "All sessions", value: "all" },
            { label: "Live", value: "active" },
            { label: "Ended", value: "ended" },
          ]}
        />
      </Card>
      {rows.length === 0 ? (
        <Empty title="No matching sessions" />
      ) : (
        rows
          .slice((page - 1) * 20, page * 20)
          .map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              lecturer
              code={courses.find((c) => c.id === s.courseId)?.code}
            />
          ))
      )}
      {rows.length > 20 && (
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
            disabled={page * 20 >= rows.length}
            onPress={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </View>
      )}
    </Shell>
  );
}
export function CreateSessionScreen() {
  const { user } = useAuth();
  const { courses } = useCourses();
  const [course, setCourse] = useState("");
  const [topic, setTopic] = useState("");
  const [note, setNote] = useState("");
  const [radius, setRadius] = useState("150");
  const [anchor, setAnchor] = useState<LocationReading | null>(null);
  const [capturing, setCapturing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const venue = useResource(listVerifiedVenues, "verified-venues");
  const controller = useRef<AbortController | null>(null);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      controller.current?.abort();
    };
  }, []);
  const capture = async () => {
    setAnchor(null);
    setError(null);
    setCapturing(true);
    controller.current?.abort();
    const task = new AbortController();
    controller.current = task;
    try {
      const reading = await locationService.captureAnchor({
        signal: task.signal,
        onStep: (value) => {
          if (alive.current) setStep(value);
        },
      });
      if (alive.current && !task.signal.aborted) setAnchor(reading);
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e.message : "Venue capture failed.");
    } finally {
      if (alive.current) setCapturing(false);
    }
  };
  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (user?.role !== "lecturer" || user.approvalStatus !== "approved")
        throw new Error("Your lecturer account must be approved.");
      if (!course || !topic.trim() || !anchor)
        throw new Error("Choose a course, enter a topic and capture or select a venue.");
      if (!anchor.venueId && (!anchor.timestamp || Date.now() - anchor.timestamp > 300000))
        throw new Error("Your venue reading expired. Capture it again.");
      const enrolledCount = await countEnrolled(course);
      const session = await attendanceService.createSession({
        courseId: course,
        topic: topic.trim(),
        radius: Number(radius),
        note: note.trim() || undefined,
        anchor,
        lecturerId: user.id,
        lecturerName: user.name,
        enrolledCount,
      });
      setCreated(session.id);
      try {
        await notifySession(session.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Push delivery failed.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Session creation failed.");
    } finally {
      if (alive.current) setBusy(false);
    }
  };
  if (user?.role !== "lecturer") return null;
  return (
    <Shell
      title={created ? "Your session is live" : "Create a live session"}
      subtitle="Set the course, topic and verified attendance venue."
      back
    >
      {created ? (
        <>
          <Card className="items-center gap-4 py-8">
            <Badge tone="success">Live session started</Badge>
            <Heading>Ready for check-ins</Heading>
            <Label muted className="text-center text-sm">
              Students enrolled in this course can now verify their attendance.
            </Label>
            <Button
              onPress={() =>
                router.replace({
                  pathname: "/lecturer/session/[sessionId]",
                  params: { sessionId: created },
                })
              }
            >
              Open live session
            </Button>
          </Card>
          {error && <Notice text={error} />}
        </>
      ) : user.approvalStatus !== "approved" ? (
        <Notice danger text="Account approval is required before creating a session." />
      ) : (
        <>
          <Card className="gap-4">
            <Label className="text-lg font-bold">Lecture details</Label>
            <Select
              label="Course"
              value={course}
              onChange={setCourse}
              options={courses
                .filter((c) => user.courseIds.includes(c.id))
                .map((c) => ({ label: `${c.code} · ${c.title}`, value: c.id }))}
            />
            <Field label="Lecture topic" value={topic} onChangeText={setTopic} />
            <Field
              label="Note to students (optional)"
              value={note}
              onChangeText={setNote}
              multiline
            />
            <Select
              label="Attendance radius"
              value={radius}
              onChange={setRadius}
              options={["100", "150", "200", "250"].map((value) => ({
                label: `${value} metres`,
                value,
              }))}
            />
          </Card>
          <Card className="gap-4">
            <Label className="text-lg font-bold">Attendance venue</Label>
            <Select
              label="Verified classroom"
              disabled={capturing}
              value={anchor?.venueId ?? "live"}
              onChange={(value) => {
                const saved = venue.data?.find((v) => v.id === value);
                setAnchor(
                  saved
                    ? {
                        lat: saved.lat,
                        lng: saved.lng,
                        accuracy: saved.accuracy,
                        timestamp: Date.parse(saved.verified_at),
                        venueId: saved.id,
                      }
                    : null,
                );
              }}
              options={[
                { label: "Capture my current location", value: "live" },
                ...(venue.data ?? []).map((v) => ({ label: v.name, value: v.id })),
              ]}
            />
            {venue.error && <Notice text={venue.error} />}
            {anchor ? (
              <>
                <Badge tone="success">
                  {anchor.venueId ? "Verified classroom selected" : "Venue location captured"}
                </Badge>
                <Label muted className="text-sm">
                  Estimated accuracy ±{Math.ceil(anchor.accuracy)} m · {radius} m zone
                </Label>
              </>
            ) : (
              <Label muted className="text-sm leading-5">
                Capture a fresh, precise position at the venue or choose a verified classroom.
              </Label>
            )}
            {capturing && <Label className="text-sm text-primary">{step}</Label>}
            <Button busy={capturing} variant="secondary" onPress={() => void capture()}>
              Capture venue location
            </Button>
            <Button variant="ghost" onPress={() => void Linking.openSettings()}>
              Open location settings
            </Button>
          </Card>
          {error && <Notice danger text={error} />}
          <Notice text="Each attendance session remains active for a maximum of 30 minutes." />
          <Button busy={busy} disabled={!anchor || capturing} onPress={() => void submit()}>
            Start live session
          </Button>
        </>
      )}
    </Shell>
  );
}
export function LiveSessionScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { user } = useAuth();
  const sessions = useSessions();
  const feed = useSessionFeed(sessionId);
  const { courses } = useCourses();
  const session = sessions.find((s) => s.id === sessionId);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const present = feed.filter((r) => r.status === "verified").length;
  const end = () =>
    Alert.alert("End attendance session?", "Students will no longer be able to check in.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "End session",
        style: "destructive",
        onPress: () => {
          setBusy(true);
          void attendanceService
            .endSession(sessionId)
            .catch((e) => setError(e.message))
            .finally(() => setBusy(false));
        },
      },
    ]);
  if (!session || session.lecturerId !== user?.id)
    return (
      <Shell title="Session unavailable" back>
        <Empty
          title="Session not found"
          description="This session is unavailable or belongs to another lecturer."
        />
      </Shell>
    );
  return (
    <Shell
      title="Live attendance"
      subtitle={courses.find((c) => c.id === session.courseId)?.title ?? session.topic}
      back
      onRefresh={() => void hydrateSessions()}
    >
      <Card className="gap-3">
        <View className="flex-row justify-between">
          <Badge tone="primary">
            {courses.find((c) => c.id === session.courseId)?.code ?? session.courseId}
          </Badge>
          <Badge tone={session.status === "active" ? "success" : "neutral"}>
            {session.status === "active" ? "Live" : "Ended"}
          </Badge>
        </View>
        <Heading>{session.topic}</Heading>
        <Label muted className="text-xs">
          {session.date} · Started {session.startTime} · {session.radius} m zone
        </Label>
        {session.note && <Notice text={session.note} />}
      </Card>
      <View className="flex-row flex-wrap gap-3">
        <Metric label="Verified present" value={present} />
        <Metric label="Enrolled" value={session.enrolledCount} />
        <Metric
          label="Attendance rate"
          value={
            session.enrolledCount ? `${Math.round((present / session.enrolledCount) * 100)}%` : "—"
          }
        />
      </View>
      {error && <Notice danger text={error} />}
      <Button
        onPress={() =>
          router.push({ pathname: "/lecturer/ledger/[sessionId]", params: { sessionId } })
        }
      >
        Open full ledger
      </Button>
      {session.status === "active" && (
        <Button busy={busy} variant="danger" onPress={end}>
          End session
        </Button>
      )}
      <Label className="text-lg font-bold">Live check-ins</Label>
      {feed.length === 0 ? (
        <Empty
          title="Waiting for check-ins"
          description="Verified students appear here automatically."
        />
      ) : (
        feed.slice(0, 30).map((row) => (
          <Card key={row.id} className="gap-2">
            <View className="flex-row justify-between">
              <Label className="flex-1 font-semibold">{row.name}</Label>
              <Badge tone={row.status === "verified" ? "success" : "danger"}>{row.status}</Badge>
            </View>
            <Label muted className="text-xs">
              {row.regNumber} · {row.verifiedAt}
            </Label>
            <Label muted className="text-xs">
              Face match {Math.round(row.faceScore * 100)}% · {Math.round(row.distance)} m from
              venue
            </Label>
          </Card>
        ))
      )}
    </Shell>
  );
}
export function LedgerScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { user } = useAuth();
  const sessions = useSessions();
  const session = sessions.find((s) => s.id === sessionId);
  const feed = useSessionFeed(sessionId);
  const ledger = useResource(
    () => attendanceService.getLedger(sessionId),
    `ledger:${sessionId}:${feed.map((r) => `${r.id}:${r.status}`).join(",")}`,
  );
  const roster = useResource(
    () => (session ? attendanceService.getEnrolledStudents(session.courseId) : Promise.resolve([])),
    `roster:${session?.courseId}`,
  );
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("latest");
  const [student, setStudent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [query, status, sort]);
  const rows = (ledger.data?.rows ?? [])
    .filter(
      (r) =>
        (status === "all" || r.status === status) &&
        `${r.name} ${r.regNumber}`.toLowerCase().includes(query.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "alphabetical"
        ? a.name.localeCompare(b.name)
        : sort === "status"
          ? a.status.localeCompare(b.status)
          : String(b.verifiedAt).localeCompare(String(a.verifiedAt)),
    );
  const action = async (task: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await task();
      await ledger.reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "The action failed.");
    } finally {
      setBusy(false);
    }
  };
  if (!session || session.lecturerId !== user?.id)
    return (
      <Shell title="Attendance ledger" back>
        <Empty title="Session unavailable" />
      </Shell>
    );
  const removeSession = () =>
    Alert.alert("Delete this session?", "This also deletes the session’s attendance records.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          void action(async () => {
            await attendanceService.deleteSession(sessionId);
            router.replace("/lecturer/sessions");
          }),
      },
    ]);
  return (
    <Shell
      title="Attendance ledger"
      subtitle={`${session.topic} · ${session.date}`}
      back
      refreshing={ledger.loading}
      onRefresh={() => void ledger.reload()}
    >
      <View className="flex-row gap-3">
        <Metric label="Present" value={ledger.data?.present ?? 0} />
        <Metric label="Enrolled" value={session.enrolledCount} />
      </View>
      <View className="flex-row gap-3">
        <View className="flex-1">
          <Button
            small
            variant="secondary"
            disabled={busy}
            onPress={() =>
              void action(() => exportAttendance(session, ledger.data?.rows ?? [], "csv"))
            }
          >
            Export CSV
          </Button>
        </View>
        <View className="flex-1">
          <Button
            small
            variant="secondary"
            disabled={busy}
            onPress={() =>
              void action(() => exportAttendance(session, ledger.data?.rows ?? [], "pdf"))
            }
          >
            Export PDF
          </Button>
        </View>
      </View>
      <Card className="gap-3">
        <Field label="Search students" value={query} onChangeText={setQuery} />
        <Select
          label="Sort"
          value={sort}
          onChange={setSort}
          options={["latest", "alphabetical", "status"].map((value) => ({ label: value, value }))}
        />
        <Select
          label="Attendance status"
          value={status}
          onChange={setStatus}
          options={["all", "verified", "missed", "failed"].map((value) => ({
            label: value === "all" ? "All records" : value,
            value,
          }))}
        />
      </Card>
      {error && <Notice danger text={error} />}
      {ledger.error && <Notice danger text={ledger.error} />}
      {rows.length === 0 ? (
        <Empty title="No matching attendance records" />
      ) : (
        rows.slice((page - 1) * 25, page * 25).map((row) => (
          <Card key={row.id} className="gap-3">
            <View className="flex-row justify-between">
              <View className="flex-1">
                <Label className="font-semibold">{row.name}</Label>
                <Label muted className="mt-1 text-xs">
                  {row.regNumber} · {row.verifiedAt ?? "—"}
                </Label>
              </View>
              <Badge tone={row.status === "verified" ? "success" : "danger"}>{row.status}</Badge>
            </View>
            <Label muted className="text-xs">
              Face: {row.faceScore !== null ? `${Math.round(row.faceScore * 100)}%` : "—"} ·
              Distance: {Math.round(row.distance ?? 0)} m · Accuracy: ±
              {Math.ceil(row.gpsAccuracy ?? 0)} m
            </Label>
            <Select
              label="Update record status"
              value={row.status}
              onChange={(value) =>
                void action(() =>
                  attendanceService.updateRecord(row.id, {
                    status: value as "verified" | "missed" | "failed",
                  }),
                )
              }
              options={["verified", "missed", "failed"].map((value) => ({ label: value, value }))}
            />
            <Button
              small
              variant="ghost"
              disabled={busy}
              onPress={() =>
                Alert.alert("Delete record?", `${row.name} will be removed from this ledger.`, [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Delete",
                    style: "destructive",
                    onPress: () =>
                      void action(() => attendanceService.deleteRecord(row.id, sessionId)),
                  },
                ])
              }
            >
              Delete record
            </Button>
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
      <Card className="gap-3">
        <Label className="text-lg font-bold">Manual attendance correction</Label>
        <Label muted className="text-xs leading-5">
          Lecturer overrides use the existing server permissions and are distinct from student
          biometric check-ins.
        </Label>
        <Select
          label="Enrolled student"
          value={student}
          onChange={setStudent}
          options={(roster.data ?? []).map((s) => ({
            label: `${s.name} · ${s.regNumber}`,
            value: s.id,
          }))}
        />
        {roster.error && <Notice danger text={roster.error} />}
        <Button
          busy={busy}
          disabled={!student}
          variant="secondary"
          onPress={() =>
            void action(async () => {
              const selected = roster.data?.find((s) => s.id === student);
              if (!selected) throw new Error("Choose an enrolled student.");
              await attendanceService.manualRecord(sessionId, {
                id: selected.id,
                name: selected.name,
                regNumber: selected.regNumber,
                courseId: session.courseId,
                topic: session.topic,
              });
              setStudent("");
            })
          }
        >
          Mark selected student present
        </Button>
      </Card>
      <Button variant="danger" disabled={busy} onPress={removeSession}>
        Delete session and records
      </Button>
    </Shell>
  );
}
