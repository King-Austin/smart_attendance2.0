import { useEffect, useState } from "react";
import { Alert, View } from "react-native";
import { router } from "expo-router";
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
import { RoleGate } from "@/hooks/useAuth";
import { useResource } from "@/hooks/useResource";
import { useSessions } from "@/hooks/useSessions";
import { useAcademicOptions } from "@/hooks/useAcademicOptions";
import { adminService } from "@/services/adminService";
import { CourseService, updateUserCourses } from "@/services/courseService";
import { attendanceService, hydrateSessions } from "@/services/attendanceService";
import { exportAttendance } from "@/services/exportService";
import type { Course, LecturerProfile, StudentProfile } from "@/types";
const options = (values: string[]) => values.map((value) => ({ label: value, value }));
export function AdminScreen() {
  return (
    <RoleGate role="admin">
      <AdminDashboard />
    </RoleGate>
  );
}
function AdminDashboard() {
  const [section, setSection] = useState("overview");
  const data = useResource(async () => {
    const [lecturers, students, courses] = await Promise.all([
      adminService.getLecturers(),
      adminService.getStudents(),
      CourseService.getAllCoursesLive(),
    ]);
    return { lecturers, students, courses };
  }, "admin-data");
  const sessions = useSessions();
  const [query, setQuery] = useState("");
  const [personType, setPersonType] = useState("lecturers");
  const [approval, setApproval] = useState("all");
  const [department, setDepartment] = useState("all");
  const [level, setLevel] = useState("all");
  const [semester, setSemester] = useState("all");
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [assignment, setAssignment] = useState<LecturerProfile | null>(null);
  const [assigned, setAssigned] = useState<string[]>([]);
  const [deletePerson, setDeletePerson] = useState<LecturerProfile | StudentProfile | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [selectedSession, setSelectedSession] = useState("");
  const ledger = useResource(
    () =>
      selectedSession
        ? attendanceService.getLedger(selectedSession)
        : Promise.resolve({ rows: [], present: 0 }),
    `admin-ledger:${selectedSession}`,
  );
  const [wizard, setWizard] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [faculty, setFaculty] = useState("");
  const [newFaculty, setNewFaculty] = useState("");
  const [courseDept, setCourseDept] = useState("");
  const [newDepartment, setNewDepartment] = useState("");
  const [courseLevel, setCourseLevel] = useState("");
  const [courseSemester, setCourseSemester] = useState("");
  const [drafts, setDrafts] = useState([{ code: "", title: "", creditUnit: "3" }]);
  const [academicRevision, setAcademicRevision] = useState(0);
  const academic = useAcademicOptions(faculty);
  const facultyData = useResource(
    async () => ({
      faculties: await CourseService.getFaculties(),
      departments: await CourseService.getAllDepartments(),
    }),
    `academic:${academicRevision}`,
  );
  useEffect(() => setPage(1), [section, query, personType, approval, department, level, semester]);
  const action = async (task: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await task();
      if (success) setMessage(success);
      await data.reload();
      await ledger.reload();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "The action failed.");
    } finally {
      setBusy(false);
    }
  };
  const courses = data.data?.courses ?? [];
  const people =
    personType === "lecturers" ? (data.data?.lecturers ?? []) : (data.data?.students ?? []);
  const filteredPeople = people.filter(
    (p) =>
      (approval === "all" || ("approvalStatus" in p && p.approvalStatus === approval)) &&
      `${p.name} ${p.email} ${"staffId" in p ? p.staffId : p.regNumber}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  const filteredCourses = courses.filter(
    (c) =>
      (department === "all" || c.department === department) &&
      (level === "all" || c.level === level) &&
      (semester === "all" || c.semester === semester) &&
      `${c.code} ${c.title}`.toLowerCase().includes(query.toLowerCase()),
  );
  const currentSession = sessions.find((s) => s.id === selectedSession);
  const createCourses = () =>
    action(async () => {
      if (!faculty || !courseDept || !courseLevel || !courseSemester)
        throw new Error("Complete the academic context before saving.");
      await CourseService.createCourses(
        drafts.map((d) => ({
          code: d.code,
          title: d.title,
          creditUnit: Number(d.creditUnit),
          faculty,
          department: courseDept,
          level: courseLevel,
          semester: courseSemester,
        })),
      );
      setWizard(false);
      setWizardStep(0);
      setDrafts([{ code: "", title: "", creditUnit: "3" }]);
    }, "Courses created.");
  return (
    <Shell
      title="Administration"
      subtitle="People, curriculum and attendance in one place."
      refreshing={data.loading}
      onRefresh={() => {
        void data.reload();
        void hydrateSessions();
      }}
    >
      <View className="flex-row flex-wrap gap-2">
        {["overview", "people", "courses", "attendance"].map((value) => (
          <View className="min-w-[45%] flex-1" key={value}>
            <Button
              small
              variant={section === value ? "primary" : "secondary"}
              onPress={() => {
                setSection(value);
                setQuery("");
              }}
            >
              {value[0].toUpperCase() + value.slice(1)}
            </Button>
          </View>
        ))}
      </View>
      {message && <Notice text={message} />}
      {data.error && <Notice danger text={data.error} />}
      {data.loading && !data.data ? (
        <Loading />
      ) : (
        <>
          {section === "overview" && (
            <>
              <View className="flex-row flex-wrap gap-3">
                <Metric label="Students" value={data.data?.students.length ?? 0} />
                <Metric label="Lecturers" value={data.data?.lecturers.length ?? 0} />
                <Metric label="Courses" value={courses.length} />
                <Metric
                  label="Live sessions"
                  value={sessions.filter((s) => s.status === "active").length}
                />
              </View>
              <Card className="gap-4">
                <Label className="text-lg font-bold">Lecturer approvals</Label>
                <Label muted className="text-sm">
                  {data.data?.lecturers.filter((l) => l.approvalStatus === "pending").length ?? 0}{" "}
                  accounts are waiting for review.
                </Label>
                <Button
                  variant="secondary"
                  onPress={() => {
                    setSection("people");
                    setPersonType("lecturers");
                    setApproval("pending");
                  }}
                >
                  Review pending lecturers
                </Button>
              </Card>
              <Card className="gap-4">
                <Label className="text-lg font-bold">Enrollment coverage</Label>
                <Metric
                  label="Students with face enrollment"
                  value={data.data?.students.filter((s) => s.faceEnrolled).length ?? 0}
                />
                <Metric
                  label="Students with guardian email"
                  value={data.data?.students.filter((s) => s.guardianEmail).length ?? 0}
                />
              </Card>
              <Button variant="secondary" onPress={() => router.push("/overview")}>
                System overview
              </Button>
            </>
          )}
          {section === "people" && (
            <>
              <Card className="gap-3">
                <Select
                  label="People"
                  value={personType}
                  onChange={(value) => {
                    setPersonType(value);
                    setApproval("all");
                  }}
                  options={[
                    { label: "Lecturers", value: "lecturers" },
                    { label: "Students", value: "students" },
                  ]}
                />
                <Field
                  label="Search people"
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Name, email or institutional ID"
                />
                {personType === "lecturers" && (
                  <Select
                    label="Approval status"
                    value={approval}
                    onChange={setApproval}
                    options={[
                      { label: "All statuses", value: "all" },
                      ...options(["pending", "approved", "rejected"]),
                    ]}
                  />
                )}
              </Card>
              {deletePerson && (
                <Card className="gap-4">
                  <Label className="font-bold text-destructive">Delete {deletePerson.name}?</Label>
                  <Notice
                    danger
                    text="This permanently removes the account through the protected administrator endpoint. Related records may also be removed."
                  />
                  <Field
                    label={`Type ${deletePerson.name} to confirm`}
                    value={confirmation}
                    onChangeText={setConfirmation}
                  />
                  <Button
                    variant="danger"
                    busy={busy}
                    disabled={confirmation !== deletePerson.name}
                    onPress={() =>
                      void action(async () => {
                        await adminService.deleteAccount(deletePerson.id);
                        setDeletePerson(null);
                        setConfirmation("");
                      }, "Account deleted.")
                    }
                  >
                    Permanently delete account
                  </Button>
                  <Button variant="secondary" onPress={() => setDeletePerson(null)}>
                    Cancel deletion
                  </Button>
                </Card>
              )}
              {assignment && (
                <Card className="gap-3">
                  <Label className="font-bold">Teaching assignments · {assignment.name}</Label>
                  {courses.map((c) => (
                    <ToggleRow
                      key={c.id}
                      label={c.code}
                      detail={c.title}
                      checked={assigned.includes(c.id)}
                      onPress={() =>
                        setAssigned((prev) =>
                          prev.includes(c.id) ? prev.filter((id) => id !== c.id) : [...prev, c.id],
                        )
                      }
                    />
                  ))}
                  <Button
                    busy={busy}
                    onPress={() =>
                      void action(async () => {
                        await updateUserCourses(assignment.id, assigned);
                        setAssignment(null);
                      }, "Assignments saved.")
                    }
                  >
                    Save assignments
                  </Button>
                  <Button variant="secondary" onPress={() => setAssignment(null)}>
                    Cancel
                  </Button>
                </Card>
              )}
              {filteredPeople.length === 0 ? (
                <Empty title="No matching people" />
              ) : (
                filteredPeople.slice((page - 1) * 20, page * 20).map((person) => (
                  <Card key={person.id} className="gap-3">
                    <View className="flex-row justify-between">
                      <View className="flex-1">
                        <Label className="text-base font-bold">{person.name}</Label>
                        <Label muted className="mt-1 text-xs">
                          {person.email}
                        </Label>
                      </View>
                      <Badge
                        tone={
                          "approvalStatus" in person && person.approvalStatus === "pending"
                            ? "warning"
                            : "primary"
                        }
                      >
                        {"approvalStatus" in person ? person.approvalStatus : "student"}
                      </Badge>
                    </View>
                    <Label muted className="text-xs">
                      {"staffId" in person ? person.staffId : person.regNumber} ·{" "}
                      {person.department}
                    </Label>
                    {"approvalStatus" in person ? (
                      <>
                        <Select
                          label="Account approval"
                          value={person.approvalStatus}
                          disabled={busy}
                          onChange={(value) =>
                            void action(
                              () =>
                                adminService.updateLecturerApproval(
                                  person.id,
                                  value as "approved" | "rejected" | "pending",
                                ),
                              "Approval updated.",
                            )
                          }
                          options={options(["pending", "approved", "rejected"])}
                        />
                        <Button
                          small
                          variant="secondary"
                          onPress={() => {
                            setAssignment(person);
                            setAssigned(person.courseIds);
                          }}
                        >
                          Manage course assignments
                        </Button>
                      </>
                    ) : (
                      <>
                        <Badge tone={person.faceEnrolled ? "success" : "warning"}>
                          {person.faceEnrolled ? "Face enrolled" : "Face not enrolled"}
                        </Badge>
                        <Label muted className="text-xs">
                          {person.level} · {person.courseIds.length} courses · Guardian:{" "}
                          {person.guardianEmail ?? "Missing"}
                        </Label>
                      </>
                    )}
                    <Button
                      small
                      variant="ghost"
                      onPress={() => {
                        setDeletePerson(person);
                        setConfirmation("");
                      }}
                    >
                      Delete account
                    </Button>
                  </Card>
                ))
              )}
              <Pagination page={page} count={filteredPeople.length} onChange={setPage} />
            </>
          )}
          {section === "courses" && (
            <>
              <Button onPress={() => setWizard((value) => !value)}>
                {wizard ? "Close course creator" : "Create courses"}
              </Button>
              {wizard && (
                <Card className="gap-4">
                  <Label className="text-lg font-bold">
                    Course creation · Step {wizardStep + 1} of 3
                  </Label>
                  <Progress value={((wizardStep + 1) / 3) * 100} />
                  {wizardStep === 0 && (
                    <>
                      <Select
                        label="Faculty"
                        value={faculty}
                        onChange={(value) => {
                          setFaculty(value);
                          setCourseDept("");
                        }}
                        options={options((facultyData.data?.faculties ?? []).map((f) => f.name))}
                      />
                      <Field
                        label="Or add a new faculty"
                        value={newFaculty}
                        onChangeText={setNewFaculty}
                      />
                      <Button
                        small
                        variant="secondary"
                        busy={busy}
                        onPress={() =>
                          void action(async () => {
                            const created = await CourseService.createFaculty(newFaculty);
                            setFaculty(created.name);
                            setNewFaculty("");
                            setAcademicRevision((r) => r + 1);
                          }, "Faculty created.")
                        }
                      >
                        Add faculty
                      </Button>
                      <Select
                        label="Department"
                        value={courseDept}
                        onChange={setCourseDept}
                        options={options(
                          (facultyData.data?.departments ?? [])
                            .filter(
                              (d) =>
                                d.facultyId ===
                                facultyData.data?.faculties.find((f) => f.name === faculty)?.id,
                            )
                            .map((d) => d.name),
                        )}
                      />
                      <Field
                        label="Or add a new department"
                        value={newDepartment}
                        onChangeText={setNewDepartment}
                      />
                      <Button
                        small
                        variant="secondary"
                        busy={busy}
                        onPress={() =>
                          void action(async () => {
                            const id = facultyData.data?.faculties.find(
                              (f) => f.name === faculty,
                            )?.id;
                            if (!id) throw new Error("Select a faculty first.");
                            const created = await CourseService.createDepartment(id, newDepartment);
                            setCourseDept(created.name);
                            setNewDepartment("");
                            setAcademicRevision((r) => r + 1);
                          }, "Department created.")
                        }
                      >
                        Add department
                      </Button>
                      <Select
                        label="Level"
                        value={courseLevel}
                        onChange={setCourseLevel}
                        options={options([
                          ...new Set([
                            ...academic.levels,
                            "100 Level",
                            "200 Level",
                            "300 Level",
                            "400 Level",
                            "500 Level",
                          ]),
                        ])}
                      />
                      <Select
                        label="Semester"
                        value={courseSemester}
                        onChange={setCourseSemester}
                        options={options([
                          ...new Set([...academic.semesters, "First Semester", "Second Semester"]),
                        ])}
                      />
                    </>
                  )}
                  {wizardStep === 1 && (
                    <>
                      {drafts.map((draft, i) => (
                        <View key={i} className="gap-3 rounded-2xl border border-border p-4">
                          {(["code", "title", "creditUnit"] as const).map((key) => (
                            <Field
                              key={key}
                              label={
                                key === "creditUnit"
                                  ? "Credit units"
                                  : key === "code"
                                    ? "Course code"
                                    : "Course title"
                              }
                              keyboardType={key === "creditUnit" ? "number-pad" : "default"}
                              value={draft[key]}
                              onChangeText={(value) =>
                                setDrafts((prev) =>
                                  prev.map((d, index) =>
                                    index === i ? { ...d, [key]: value } : d,
                                  ),
                                )
                              }
                            />
                          ))}
                          <Button
                            small
                            variant="ghost"
                            disabled={drafts.length === 1}
                            onPress={() =>
                              setDrafts((prev) => prev.filter((_, index) => index !== i))
                            }
                          >
                            Remove row
                          </Button>
                        </View>
                      ))}
                      <Button
                        variant="secondary"
                        onPress={() =>
                          setDrafts((prev) => [...prev, { code: "", title: "", creditUnit: "3" }])
                        }
                      >
                        Add another course
                      </Button>
                    </>
                  )}
                  {wizardStep === 2 && (
                    <>
                      <Notice
                        text={`${faculty} · ${courseDept} · ${courseLevel} · ${courseSemester}`}
                      />
                      {drafts.map((draft, i) => (
                        <Label key={i} className="text-sm">
                          {draft.code} · {draft.title} · {draft.creditUnit} units
                        </Label>
                      ))}
                      <Button busy={busy} onPress={() => void createCourses()}>
                        Commit courses to database
                      </Button>
                    </>
                  )}
                  <View className="flex-row gap-3">
                    <Button
                      small
                      variant="secondary"
                      disabled={wizardStep === 0}
                      onPress={() => setWizardStep((s) => s - 1)}
                    >
                      Back
                    </Button>
                    {wizardStep < 2 && (
                      <Button
                        small
                        disabled={
                          wizardStep === 0 &&
                          (!faculty || !courseDept || !courseLevel || !courseSemester)
                        }
                        onPress={() => setWizardStep((s) => s + 1)}
                      >
                        Continue
                      </Button>
                    )}
                  </View>
                </Card>
              )}
              <Card className="gap-3">
                <Field label="Search courses" value={query} onChangeText={setQuery} />
                <Select
                  label="Department filter"
                  value={department}
                  onChange={setDepartment}
                  options={[
                    { label: "All departments", value: "all" },
                    ...options([...new Set(courses.map((c) => c.department))]),
                  ]}
                />
                <Select
                  label="Level filter"
                  value={level}
                  onChange={setLevel}
                  options={[
                    { label: "All levels", value: "all" },
                    ...options([...new Set(courses.map((c) => c.level))]),
                  ]}
                />
                <Select
                  label="Semester filter"
                  value={semester}
                  onChange={setSemester}
                  options={[
                    { label: "All semesters", value: "all" },
                    ...options([...new Set(courses.map((c) => c.semester))]),
                  ]}
                />
              </Card>
              {filteredCourses.length === 0 ? (
                <Empty title="No matching courses" />
              ) : (
                filteredCourses.slice((page - 1) * 20, page * 20).map((course) => (
                  <Card key={course.id} className="gap-3">
                    <Badge tone="primary">{course.code}</Badge>
                    <Label className="font-bold">{course.title}</Label>
                    <Label muted className="text-xs">
                      {course.department} · {course.level} · {course.semester} · {course.creditUnit}{" "}
                      units
                    </Label>
                    <Button
                      small
                      variant="ghost"
                      disabled={busy}
                      onPress={() =>
                        Alert.alert(
                          "Delete course?",
                          `${course.code} will be removed from the catalog.`,
                          [
                            { text: "Cancel", style: "cancel" },
                            {
                              text: "Delete",
                              style: "destructive",
                              onPress: () =>
                                void action(
                                  () => CourseService.deleteCourse(course.id),
                                  "Course deleted.",
                                ),
                            },
                          ],
                        )
                      }
                    >
                      Delete course
                    </Button>
                  </Card>
                ))
              )}
              <Pagination page={page} count={filteredCourses.length} onChange={setPage} />
              {department !== "all" && (
                <Button
                  variant="danger"
                  disabled={busy}
                  onPress={() =>
                    Alert.alert(
                      "Delete department courses?",
                      `All courses under ${department} will be removed.`,
                      [
                        { text: "Cancel", style: "cancel" },
                        {
                          text: "Delete courses",
                          style: "destructive",
                          onPress: () =>
                            void action(
                              () => CourseService.deleteCoursesByDepartment(department),
                              "Department courses deleted.",
                            ),
                        },
                      ],
                    )
                  }
                >
                  Delete all courses in {department}
                </Button>
              )}
            </>
          )}
          {section === "attendance" && (
            <>
              <View className="flex-row gap-3">
                <Metric label="Sessions" value={sessions.length} />
                <Metric
                  label="Active"
                  value={sessions.filter((s) => s.status === "active").length}
                />
              </View>
              <Card className="gap-3">
                <Select
                  label="Attendance session"
                  value={selectedSession}
                  onChange={setSelectedSession}
                  options={sessions.map((s) => ({
                    label: `${courses.find((c) => c.id === s.courseId)?.code ?? s.courseId} · ${s.topic} · ${s.date}`,
                    value: s.id,
                  }))}
                />
              </Card>
              {ledger.error && <Notice danger text={ledger.error} />}
              {currentSession && (
                <>
                  <View className="flex-row gap-3">
                    <View className="flex-1">
                      <Button
                        small
                        variant="secondary"
                        onPress={() =>
                          void action(() =>
                            exportAttendance(currentSession, ledger.data?.rows ?? [], "csv"),
                          )
                        }
                      >
                        Export CSV
                      </Button>
                    </View>
                    <View className="flex-1">
                      <Button
                        small
                        variant="secondary"
                        onPress={() =>
                          void action(() =>
                            exportAttendance(currentSession, ledger.data?.rows ?? [], "pdf"),
                          )
                        }
                      >
                        Export PDF
                      </Button>
                    </View>
                  </View>
                  <Badge tone="success">{ledger.data?.present ?? 0} verified present</Badge>
                  {ledger.loading ? (
                    <Loading />
                  ) : (
                    (ledger.data?.rows ?? []).map((row) => (
                      <Card key={row.id} className="gap-2">
                        <View className="flex-row justify-between">
                          <Label className="font-semibold">{row.name}</Label>
                          <Badge tone={row.status === "verified" ? "success" : "danger"}>
                            {row.status}
                          </Badge>
                        </View>
                        <Label muted className="text-xs">
                          {row.regNumber} · {row.verifiedAt ?? "—"}
                        </Label>
                      </Card>
                    ))
                  )}
                </>
              )}
              {!selectedSession && (
                <Empty
                  title="Choose a session"
                  description="Review verified attendance across the institution."
                />
              )}
            </>
          )}
        </>
      )}
    </Shell>
  );
}
function Pagination({
  page,
  count,
  onChange,
}: {
  page: number;
  count: number;
  onChange: (value: number) => void;
}) {
  if (count <= 20) return null;
  return (
    <View className="flex-row items-center justify-between">
      <Button small variant="secondary" disabled={page <= 1} onPress={() => onChange(page - 1)}>
        Previous
      </Button>
      <Label muted className="text-xs">
        {page} / {Math.ceil(count / 20)}
      </Label>
      <Button
        small
        variant="secondary"
        disabled={page * 20 >= count}
        onPress={() => onChange(page + 1)}
      >
        Next
      </Button>
    </View>
  );
}
