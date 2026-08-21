type RecordValue = Record<string, unknown>;

const number = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const object = (value: unknown): value is RecordValue => typeof value === 'object' && value !== null && !Array.isArray(value);

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function validEnvironment(analysis: RecordValue) {
  if (analysis.faceCount !== 1 || !number(analysis.brightness) || analysis.brightness < 55 || analysis.brightness > 235 || analysis.isWellLit !== true || !object(analysis.face)) return false;
  const face = analysis.face;
  const fields = ['x', 'y', 'width', 'height', 'headEulerAngleX', 'headEulerAngleY', 'headEulerAngleZ', 'leftEyeOpenProbability', 'rightEyeOpenProbability'];
  if (!fields.every((key) => number(face[key]))) return false;
  const x = face.x as number;
  const y = face.y as number;
  const width = face.width as number;
  const height = face.height as number;
  const centreX = x + width / 2;
  const centreY = y + height / 2;
  return width >= 0.25 && width <= 0.74 && centreX >= 0.22 && centreX <= 0.78 && centreY >= 0.2 && centreY <= 0.8;
}

export async function validateOnDeviceLiveness(input: {
  evidence: unknown;
  instructions: string[];
  primaryImage: string;
}) {
  if (!object(input.evidence) || input.evidence.method !== 'google_mlkit_on_device' || input.evidence.version !== 1 || !Array.isArray(input.evidence.frames)) {
    return { ok: false as const, error: 'On-device liveness evidence is missing.' };
  }
  const frames = input.evidence.frames;
  if (frames.length !== input.instructions.length || frames.length !== 4) return { ok: false as const, error: 'The liveness sequence is incomplete.' };

  const hashes = new Set<string>();
  const captures: number[] = [];
  for (let index = 0; index < frames.length; index += 1) {
    const frame = frames[index];
    if (!object(frame) || frame.instruction !== input.instructions[index] || typeof frame.imageHash !== 'string' || !/^[a-f0-9]{64}$/.test(frame.imageHash) || !object(frame.analysis) || !validEnvironment(frame.analysis)) {
      return { ok: false as const, error: 'A liveness frame failed integrity checks.' };
    }
    if (hashes.has(frame.imageHash)) return { ok: false as const, error: 'A captured frame was reused.' };
    hashes.add(frame.imageHash);
    const captured = new Date(String(frame.capturedAt)).getTime();
    if (!Number.isFinite(captured)) return { ok: false as const, error: 'A liveness timestamp is invalid.' };
    captures.push(captured);
  }
  if (captures.some((value, index) => index > 0 && value <= captures[index - 1]) || captures[captures.length - 1] - captures[0] > 90_000 || Math.abs(Date.now() - captures[captures.length - 1]) > 30_000) {
    return { ok: false as const, error: 'The liveness sequence expired.' };
  }
  if (await sha256(input.primaryImage) !== (frames[0] as RecordValue).imageHash) return { ok: false as const, error: 'The verified face does not match the environment frame.' };

  const straight = (frames[0] as RecordValue).analysis as RecordValue;
  const straightFace = straight.face as RecordValue;
  if (Math.abs(straightFace.headEulerAngleY as number) > 12 || Math.abs(straightFace.headEulerAngleZ as number) > 14 || (straightFace.leftEyeOpenProbability as number) < 0.45 || (straightFace.rightEyeOpenProbability as number) < 0.45) {
    return { ok: false as const, error: 'The straight-face frame is invalid.' };
  }

  const turns = frames.slice(1, 3).map((frame) => (((frame as RecordValue).analysis as RecordValue).face as RecordValue).headEulerAngleY as number);
  if (turns.some((angle) => Math.abs(angle) < 18 || Math.abs(angle) > 60) || Math.sign(turns[0]) === Math.sign(turns[1])) {
    return { ok: false as const, error: 'Opposite head movements were not established.' };
  }

  const blink = (frames[3] as RecordValue).analysis as RecordValue;
  const blinkFace = blink.face as RecordValue;
  if (Math.abs(blinkFace.headEulerAngleY as number) > 15 || (blinkFace.leftEyeOpenProbability as number) > 0.35 || (blinkFace.rightEyeOpenProbability as number) > 0.35) {
    return { ok: false as const, error: 'The closed-eye movement was not established.' };
  }
  return { ok: true as const };
}
