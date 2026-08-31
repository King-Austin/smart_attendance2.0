import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { BrandHeader } from '@/components/ui/brand-header';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { mobileApi } from '@/services/mobile-api';

const levels = ['100 Level', '200 Level', '300 Level', '400 Level', '500 Level'];
const semesters = ['First Semester', 'Second Semester'];

export default function RegisterScreen() {
  const { colors } = useAppTheme();
  const [role, setRole] = useState<'student' | 'lecturer'>('student');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [regNumber, setRegNumber] = useState('');
  const [staffId, setStaffId] = useState('');
  const [facultyId, setFacultyId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [level, setLevel] = useState('500 Level');
  const [semester, setSemester] = useState('First Semester');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const faculties = useQuery({ queryKey: ['faculties'], queryFn: mobileApi.faculties });
  const departments = useQuery({ queryKey: ['departments', facultyId], queryFn: () => mobileApi.departments(facultyId), enabled: Boolean(facultyId) });
  const faculty = useMemo(() => faculties.data?.find((item) => item.id === facultyId), [faculties.data, facultyId]);
  const department = useMemo(() => departments.data?.find((item) => item.id === departmentId), [departments.data, departmentId]);

  const submit = async () => {
    if (!faculty || !department) return;
    setBusy(true); setError(null);
    try {
      const data = await mobileApi.signUp({ email: email.trim(), password, fullName, role, faculty, department, regNumber, staffId, level, semester, phone });
      if (data.session && role === 'student') router.replace('/(student)/enroll-face');
      else if (data.session) router.replace('/');
      else setMessage('Check your email to confirm the account, then sign in. Students will enrol their face immediately after sign-in.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Registration failed.');
    } finally { setBusy(false); }
  };

  const valid = fullName.trim().length >= 3 && email.includes('@') && password.length >= 8 && faculty && department && (role === 'student' ? regNumber.trim() && level && semester : staffId.trim());
  const inputStyle = [styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }];
  return <Screen><BrandHeader eyebrow="Verified university identity" title="Create account" subtitle="Students self-register. Lecturer accounts remain pending until an administrator approves them." />
    {message ? <Card style={{ backgroundColor: colors.successSoft }}><AppText variant="heading" style={{ color: colors.success }}>Confirmation sent</AppText><AppText>{message}</AppText><Button onPress={() => router.replace('/(auth)/sign-in')}>Return to sign in</Button></Card> : <>
      <Card><AppText variant="label">Account type</AppText><View style={styles.row}>{(['student', 'lecturer'] as const).map((item) => <Pressable key={item} onPress={() => setRole(item)} style={[styles.choice, { backgroundColor: role === item ? colors.primary : colors.surfaceMuted }]}><AppText variant="label" style={{ color: role === item ? '#fff' : colors.text }}>{item === 'student' ? 'Student' : 'Lecturer'}</AppText></Pressable>)}</View></Card>
      <Card><AppText variant="heading">Personal details</AppText><TextInput value={fullName} onChangeText={setFullName} placeholder="Full name" placeholderTextColor={colors.textFaint} style={inputStyle} /><TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="Email address" placeholderTextColor={colors.textFaint} style={inputStyle} /><TextInput value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="Phone number" placeholderTextColor={colors.textFaint} style={inputStyle} /><TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="Password · minimum 8 characters" placeholderTextColor={colors.textFaint} style={inputStyle} />{role === 'student' ? <TextInput value={regNumber} onChangeText={setRegNumber} autoCapitalize="characters" placeholder="Registration number" placeholderTextColor={colors.textFaint} style={inputStyle} /> : <TextInput value={staffId} onChangeText={setStaffId} autoCapitalize="characters" placeholder="Staff ID" placeholderTextColor={colors.textFaint} style={inputStyle} />}</Card>
      <Card><AppText variant="heading">Academic placement</AppText><AppText variant="label">Faculty</AppText>{faculties.data?.map((item) => <Pressable key={item.id} onPress={() => { setFacultyId(item.id); setDepartmentId(''); }} style={[styles.option, { borderColor: facultyId === item.id ? colors.primary : colors.border }]}><AppText>{item.name}</AppText></Pressable>)}<AppText variant="label">Department</AppText>{departments.data?.map((item) => <Pressable key={item.id} onPress={() => setDepartmentId(item.id)} style={[styles.option, { borderColor: departmentId === item.id ? colors.primary : colors.border }]}><AppText>{item.name}</AppText></Pressable>)}</Card>
      {role === 'student' ? <Card><AppText variant="label">Level</AppText><View style={styles.wrap}>{levels.map((item) => <Pressable key={item} onPress={() => setLevel(item)} style={[styles.pill, { backgroundColor: level === item ? colors.primary : colors.surfaceMuted }]}><AppText variant="caption" style={{ color: level === item ? '#fff' : colors.text }}>{item}</AppText></Pressable>)}</View><AppText variant="label">Semester</AppText><View style={styles.row}>{semesters.map((item) => <Pressable key={item} onPress={() => setSemester(item)} style={[styles.choice, { backgroundColor: semester === item ? colors.primary : colors.surfaceMuted }]}><AppText variant="caption" style={{ color: semester === item ? '#fff' : colors.text }}>{item}</AppText></Pressable>)}</View></Card> : null}
      {error ? <AppText style={{ color: colors.danger }}>{error}</AppText> : null}<Button disabled={!valid} loading={busy} onPress={() => void submit()}>Create secure account</Button><Button variant="ghost" onPress={() => router.back()}>Already have an account</Button>
    </>}
  </Screen>;
}

const styles = StyleSheet.create({ input: { minHeight: 52, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.lg, fontSize: 15 }, row: { flexDirection: 'row', gap: Spacing.sm }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm }, choice: { flex: 1, minHeight: 46, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center', padding: Spacing.sm }, option: { minHeight: 48, borderWidth: 2, borderRadius: Radius.md, justifyContent: 'center', paddingHorizontal: Spacing.md }, pill: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.pill } });
