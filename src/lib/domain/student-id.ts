/**
 * Registry reference format: SMS-<intake year>-<4-digit sequence>, e.g. SMS-2026-0001.
 * The sequence restarts each intake year, which is how the paper registers have always worked.
 */

export const STUDENT_ID_PREFIX = "SMS";
const SEQ_WIDTH = 4;

export function formatStudentId(year: number, sequence: number): string {
  if (!Number.isInteger(year) || year < 1900 || year > 9999) {
    throw new RangeError(`Invalid intake year: ${year}`);
  }
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new RangeError(`Invalid sequence: ${sequence}`);
  }
  // Past 9999 the number simply gets longer rather than wrapping and colliding.
  return `${STUDENT_ID_PREFIX}-${year}-${String(sequence).padStart(SEQ_WIDTH, "0")}`;
}

export function parseStudentId(value: string): { year: number; sequence: number } | null {
  const match = /^SMS-(\d{4})-(\d{4,})$/i.exec(value.trim());
  if (!match) return null;
  return { year: Number(match[1]), sequence: Number(match[2]) };
}

/**
 * Academic session label from a date, e.g. 2026-08-04 -> "2026/27".
 * UK sessions roll over on 1 August, so an August enrolment belongs to the new session.
 */
export function academicYearForDate(date: Date = new Date()): string {
  const year = date.getMonth() >= 7 ? date.getFullYear() : date.getFullYear() - 1;
  return `${year}/${String((year + 1) % 100).padStart(2, "0")}`;
}

export function intakeYearFromAcademicYear(academicYear: string): number {
  const match = /^(\d{4})\/\d{2}$/.exec(academicYear.trim());
  if (!match) throw new RangeError(`Invalid academic year: ${academicYear}`);
  return Number(match[1]);
}

/** Next few sessions, for the enrolment form's dropdown. */
export function academicYearOptions(now: Date = new Date(), count = 3): string[] {
  const current = intakeYearFromAcademicYear(academicYearForDate(now));
  return Array.from({ length: count }, (_, i) => {
    const year = current - 1 + i;
    return `${year}/${String((year + 1) % 100).padStart(2, "0")}`;
  });
}
