import * as FileSystem from 'expo-file-system/legacy';
import { Platform, Share } from 'react-native';

import type { AttendanceRecord, Session } from '@/types/data';

function cell(value: unknown) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function exportSessionCsv(session: Session, records: AttendanceRecord[]) {
  const rows = [
    ['Course', 'Topic', 'Session ID', 'Student', 'Registration number', 'Status', 'Verified at', 'Face score', 'Distance metres', 'GPS accuracy metres'],
    ...records.map((record) => [session.courseCode, session.topic, session.id, record.studentName, record.regNumber, record.status, record.createdAt, record.faceScore, record.distance, record.gpsAccuracy]),
  ];
  const csv = rows.map((row) => row.map(cell).join(',')).join('\n');
  const filename = `${session.courseCode.replace(/\s+/g, '-')}-${session.date}-${session.id.slice(0, 8)}.csv`;
  const uri = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
  const shareUri = Platform.OS === 'android' ? await FileSystem.getContentUriAsync(uri) : uri;
  await Share.share({ title: `${session.courseCode} attendance ledger`, url: shareUri, message: Platform.OS === 'android' ? undefined : `${session.courseCode} attendance ledger` });
  return uri;
}
