import assert from "node:assert/strict";
import { test } from "node:test";
import {
  inboxSections,
  mergeInbox,
  notificationTime,
  parseInbox,
  type InboxItem,
} from "../src/lib/inbox";
const item = (id: string, createdAt: string, read = false): InboxItem => ({
  id,
  createdAt,
  read,
  title: "Attendance is open",
  body: "CSC412",
});

test("a notification delivered while local history loads survives hydration", () => {
  const stored = [item("old", "2026-11-01T08:00:00Z")];
  const received = [item("live", "2026-11-01T09:00:00Z")];
  assert.deepEqual(
    mergeInbox(stored, received).map((entry) => entry.id),
    ["live", "old"],
  );
});
test("push/realtime redelivery does not duplicate or unread an opened update", () => {
  const stored = item("session:123", "2026-11-01T08:00:00Z", true);
  const result = mergeInbox([stored], [{ ...stored, read: false }]);
  assert.equal(result.length, 1);
  assert.equal(result[0].read, true);
});
test("corrupt and invalid cached notifications do not crash the inbox", () => {
  for (const value of [null, "broken JSON", "{}", '[null, 3, {"id":"bad"}]'])
    assert.deepEqual(parseInbox(value), []);
  assert.deepEqual(
    parseInbox(
      JSON.stringify([item("valid", "2026-11-01T08:00:00Z"), item("invalid", "not a date")]),
    ).map((entry) => entry.id),
    ["valid"],
  );
});
test("legacy push and realtime entries for the same session merge without losing read state", () => {
  const old = { ...item("old-push-id", "2026-11-01T08:00:00Z", true), sessionId: "123" };
  const realtime = { ...old, id: "session:123", read: false };
  const result = mergeInbox([old, realtime], []);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "session:123");
  assert.equal(result[0].read, true);
});
test("inbox stays bounded and keeps the newest hundred updates", () => {
  const received = Array.from({ length: 120 }, (_, i) =>
    item(String(i), new Date(1_700_000_000_000 + i * 1000).toISOString()),
  );
  const result = mergeInbox([], received);
  assert.equal(result.length, 100);
  assert.equal(result[0].id, "119");
  assert.equal(result[99].id, "20");
});
test("day sections follow local calendar boundaries, including year changes", () => {
  const now = new Date(2027, 0, 1, 10);
  const entries = [
    item("today", new Date(2027, 0, 1, 0).toISOString()),
    item("yesterday", new Date(2026, 11, 31, 23, 59).toISOString()),
    item("earlier", new Date(2026, 11, 30, 23, 59).toISOString()),
  ];
  assert.deepEqual(
    inboxSections(entries, now).map((section) => [section.title, section.data[0].id]),
    [
      ["Today", "today"],
      ["Yesterday", "yesterday"],
      ["Earlier", "earlier"],
    ],
  );
  assert.deepEqual(inboxSections([], now), []);
});
test("relative times handle fresh and slightly future-dated updates", () => {
  const now = Date.parse("2026-11-01T09:00:00Z");
  assert.equal(notificationTime("2026-11-01T09:00:05Z", now), "Just now");
  assert.equal(notificationTime("2026-11-01T08:58:00Z", now), "2m ago");
  assert.equal(notificationTime("2026-11-01T07:00:00Z", now), "2h ago");
});
