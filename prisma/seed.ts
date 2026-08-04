/**
 * Demo data for the Registry module.
 *
 * The data set is chosen to exercise every edge case the UI claims to handle, so a reviewer can
 * see them without creating anything: a fully paid account, a part-paid one, two overdue ones, a
 * withdrawn student who still owes money, an on-time submission, a late submission, a
 * resubmission, a missing submission, an absent student, all four classification bands, published
 * results and one result withheld because of arrears.
 *
 * Run with: npx prisma db seed
 */
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { PrismaClient } from "../src/generated/prisma/client";
import {
  Classification,
  EnrolmentStatus,
  FeeType,
  PaymentMethod,
  Role,
} from "../src/generated/prisma/enums";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const UPLOAD_DIR = path.resolve(process.cwd(), process.env.UPLOAD_DIR ?? "storage/submissions");

const STAFF_PASSWORD = "Registry123!";
const STUDENT_PASSWORD = "Student123!";

/** Dates are anchored to "today" so the demo still shows overdue/open items whenever it is run. */
const TODAY = new Date();
const day = (offset: number) => {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + offset);
  d.setHours(12, 0, 0, 0);
  return d;
};
const dateOnly = (offset: number) => {
  const d = day(offset);
  d.setHours(0, 0, 0, 0);
  return d;
};

function minimalPdf(title: string): Buffer {
  // A genuinely openable one-page PDF, so the download route can be tested end to end.
  const text = title.replace(/[()\\]/g, "");
  const body = `1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj
2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>endobj
4 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj
5 0 obj<</Length ${text.length + 54}>>stream
BT /F1 18 Tf 72 760 Td (${text}) Tj ET
endstream
endobj
`;
  const header = "%PDF-1.4\n";
  return Buffer.from(`${header}${body}trailer<</Root 1 0 R/Size 6>>\n%%EOF\n`, "latin1");
}

async function writeSubmissionFile(title: string) {
  const storedName = `${randomUUID()}.pdf`;
  const bytes = minimalPdf(title);
  await writeFile(path.join(UPLOAD_DIR, storedName), bytes);
  return { storedName, sizeBytes: bytes.byteLength };
}

async function main() {
  await mkdir(UPLOAD_DIR, { recursive: true });

  console.log("Clearing existing data…");
  // Truncate in dependency order so re-seeding is idempotent.
  await prisma.auditLog.deleteMany();
  await prisma.grade.deleteMany();
  await prisma.submissionFile.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.feeAssignment.deleteMany();
  await prisma.student.deleteMany();
  await prisma.studentIdCounter.deleteMany();
  await prisma.module.deleteMany();
  await prisma.programme.deleteMany();
  await prisma.user.deleteMany();

  const staffHash = await bcrypt.hash(STAFF_PASSWORD, 10);
  const studentHash = await bcrypt.hash(STUDENT_PASSWORD, 10);

  console.log("Creating staff users…");
  const registrar = await prisma.user.create({
    data: {
      email: "registry@sms.ac.uk",
      name: "Priya Raman",
      passwordHash: staffHash,
      role: Role.STAFF,
    },
  });
  await prisma.user.create({
    data: {
      email: "tutor@sms.ac.uk",
      name: "Dr Alan Mbeki",
      passwordHash: staffHash,
      role: Role.STAFF,
    },
  });

  console.log("Creating programmes and modules…");
  const cs = await prisma.programme.create({
    data: {
      code: "BSC-CS",
      name: "BSc (Hons) Computer Science",
      level: "Undergraduate",
      durationYears: 3,
      defaultFeeAmount: "9250.00",
    },
  });
  const ds = await prisma.programme.create({
    data: {
      code: "MSC-DS",
      name: "MSc Data Science",
      level: "Postgraduate",
      durationYears: 1,
      defaultFeeAmount: "12500.00",
    },
  });

  const [cs101, cs205, cs310, , ds520] = await Promise.all([
    prisma.module.create({
      data: { code: "CS101", title: "Programming Fundamentals", credits: 20, programmeId: cs.id },
    }),
    prisma.module.create({
      data: { code: "CS205", title: "Database Systems", credits: 20, programmeId: cs.id },
    }),
    prisma.module.create({
      data: { code: "CS310", title: "Software Engineering", credits: 20, programmeId: cs.id },
    }),
    prisma.module.create({
      data: { code: "DS501", title: "Statistical Foundations", credits: 30, programmeId: ds.id },
    }),
    prisma.module.create({
      data: { code: "DS520", title: "Machine Learning", credits: 30, programmeId: ds.id },
    }),
  ]);

  console.log("Enrolling students…");

  type StudentSpec = {
    seq: number;
    intakeYear: number;
    firstName: string;
    lastName: string;
    dob: string;
    programmeId: string;
    academicYear: string;
    yearOfStudy: number;
    status: EnrolmentStatus;
    statusReason?: string;
  };

  const specs: StudentSpec[] = [
    {
      seq: 1,
      intakeYear: 2024,
      firstName: "Grace",
      lastName: "Adeyemi",
      dob: "2003-02-11",
      programmeId: cs.id,
      academicYear: "2024/25",
      yearOfStudy: 3,
      status: EnrolmentStatus.COMPLETED,
      statusReason: "Awarded BSc (Hons) Computer Science, First Class",
    },
    {
      seq: 1,
      intakeYear: 2025,
      firstName: "Amara",
      lastName: "Okafor",
      dob: "2004-06-23",
      programmeId: cs.id,
      academicYear: "2025/26",
      yearOfStudy: 2,
      status: EnrolmentStatus.ENROLLED,
    },
    {
      seq: 2,
      intakeYear: 2025,
      firstName: "Ben",
      lastName: "Whitfield",
      dob: "2005-11-02",
      programmeId: cs.id,
      academicYear: "2025/26",
      yearOfStudy: 1,
      status: EnrolmentStatus.ENROLLED,
    },
    {
      seq: 3,
      intakeYear: 2025,
      firstName: "Chloe",
      lastName: "Martins",
      dob: "2003-09-14",
      programmeId: cs.id,
      academicYear: "2025/26",
      yearOfStudy: 3,
      status: EnrolmentStatus.ENROLLED,
    },
    {
      seq: 4,
      intakeYear: 2025,
      firstName: "Elena",
      lastName: "Kowalski",
      dob: "2001-03-30",
      programmeId: ds.id,
      academicYear: "2025/26",
      yearOfStudy: 1,
      status: EnrolmentStatus.ENROLLED,
    },
    {
      seq: 5,
      intakeYear: 2025,
      firstName: "Farid",
      lastName: "Rahman",
      dob: "2000-12-05",
      programmeId: ds.id,
      academicYear: "2025/26",
      yearOfStudy: 1,
      status: EnrolmentStatus.DEFERRED,
      statusReason: "Medical deferral approved to next intake",
    },
    {
      seq: 6,
      intakeYear: 2025,
      firstName: "Hugo",
      lastName: "Lindqvist",
      dob: "2004-01-19",
      programmeId: cs.id,
      academicYear: "2025/26",
      yearOfStudy: 2,
      status: EnrolmentStatus.WITHDRAWN,
      statusReason: "Withdrew for personal reasons; tuition balance outstanding",
    },
    {
      seq: 1,
      intakeYear: 2026,
      firstName: "Daniel",
      lastName: "Ferreira",
      dob: "2006-04-08",
      programmeId: cs.id,
      academicYear: "2026/27",
      yearOfStudy: 1,
      status: EnrolmentStatus.ENROLLED,
    },
  ];

  const students: Record<string, { id: string; studentId: string }> = {};

  for (const spec of specs) {
    const studentId = `SMS-${spec.intakeYear}-${String(spec.seq).padStart(4, "0")}`;
    const email = `${spec.firstName}.${spec.lastName}@students.sms.ac.uk`.toLowerCase();

    const user = await prisma.user.create({
      data: {
        email,
        name: `${spec.firstName} ${spec.lastName}`,
        passwordHash: studentHash,
        role: Role.STUDENT,
      },
    });

    const student = await prisma.student.create({
      data: {
        studentId,
        firstName: spec.firstName,
        lastName: spec.lastName,
        email,
        dateOfBirth: new Date(`${spec.dob}T00:00:00.000Z`),
        programmeId: spec.programmeId,
        academicYear: spec.academicYear,
        yearOfStudy: spec.yearOfStudy,
        status: spec.status,
        statusReason: spec.statusReason ?? null,
        statusChangedAt: dateOnly(-40),
        enrolledOn: dateOnly(-300),
        userId: user.id,
      },
    });

    students[spec.lastName] = { id: student.id, studentId };
  }

  // Keep the ID counter in step with the seeded records so the next enrolment continues the run.
  await prisma.studentIdCounter.createMany({
    data: [
      { year: 2024, lastSeq: 1 },
      { year: 2025, lastSeq: 6 },
      { year: 2026, lastSeq: 1 },
    ],
  });

  console.log("Billing fees and recording payments…");

  async function bill(opts: {
    lastName: string;
    amount: string;
    dueOffset: number;
    academicYear: string;
    type?: FeeType;
    description?: string;
    overrideNote?: string;
  }) {
    return prisma.feeAssignment.create({
      data: {
        studentId: students[opts.lastName].id,
        type: opts.type ?? FeeType.TUITION,
        amount: opts.amount,
        academicYear: opts.academicYear,
        dueDate: dateOnly(opts.dueOffset),
        description: opts.description ?? "Annual tuition fee",
        overrideNote: opts.overrideNote ?? null,
        createdById: registrar.id,
      },
    });
  }

  async function pay(
    feeId: string,
    amount: string,
    reference: string,
    paidOffset: number,
    method: PaymentMethod = PaymentMethod.BANK_TRANSFER,
  ) {
    return prisma.payment.create({
      data: {
        feeAssignmentId: feeId,
        amount,
        reference,
        paidOn: dateOnly(paidOffset),
        method,
        recordedById: registrar.id,
      },
    });
  }

  // Settled in full, in two instalments.
  const amaraFee = await bill({ lastName: "Okafor", amount: "9250.00", dueOffset: -210, academicYear: "2025/26" });
  await pay(amaraFee.id, "4625.00", "BACS-2025-100412", -215);
  await pay(amaraFee.id, "4625.00", "BACS-2026-100987", -60);

  // Overdue: part paid, deadline long gone. Top of the arrears list.
  const benFee = await bill({ lastName: "Whitfield", amount: "9250.00", dueOffset: -95, academicYear: "2025/26" });
  await pay(benFee.id, "3000.00", "CARD-2026-556120", -120, PaymentMethod.CARD);

  // Overdue: nothing paid at all.
  await bill({ lastName: "Martins", amount: "9250.00", dueOffset: -35, academicYear: "2025/26" });

  // Part paid but not yet due — should NOT be flagged.
  const elenaFee = await bill({ lastName: "Kowalski", amount: "12500.00", dueOffset: 28, academicYear: "2025/26" });
  await pay(elenaFee.id, "6250.00", "BACS-2026-771003", -14);

  // Deferred student with an overdue balance from before the deferral.
  const faridFee = await bill({
    lastName: "Rahman",
    amount: "6250.00",
    dueOffset: -150,
    academicYear: "2025/26",
    description: "Tuition (deferred, pro-rata)",
    overrideNote: "Reduced to 50% under the deferral policy — approved by Head of Registry",
  });
  await pay(faridFee.id, "2000.00", "CHQ-2026-000318", -160, PaymentMethod.CHEQUE);

  // Withdrawn, still owes: stays on the arrears report, cannot be billed anything new.
  const hugoFee = await bill({ lastName: "Lindqvist", amount: "9250.00", dueOffset: -60, academicYear: "2025/26" });
  await pay(hugoFee.id, "1500.00", "BACS-2026-118845", -180);

  // Not due yet — new intake.
  await bill({ lastName: "Ferreira", amount: "9250.00", dueOffset: 60, academicYear: "2026/27" });
  await bill({
    lastName: "Ferreira",
    amount: "250.00",
    dueOffset: 60,
    academicYear: "2026/27",
    type: FeeType.REGISTRATION,
    description: "Registration and enrolment fee",
  });

  // Fully settled, completed student.
  const graceFee = await bill({ lastName: "Adeyemi", amount: "9250.00", dueOffset: -400, academicYear: "2024/25" });
  await pay(graceFee.id, "9250.00", "BACS-2024-004417", -410);

  console.log("Creating assessments…");
  const dbCoursework = await prisma.assessment.create({
    data: {
      title: "Coursework 1: Relational Design",
      moduleId: cs205.id,
      dueAt: day(-20),
      weighting: 40,
      description: "Normalise the supplied schema to 3NF and justify each decision.",
      createdById: registrar.id,
    },
  });
  const portfolio = await prisma.assessment.create({
    data: {
      title: "Portfolio Submission",
      moduleId: cs101.id,
      dueAt: day(-7),
      weighting: 60,
      description: "Portfolio of five programming exercises.",
      createdById: registrar.id,
    },
  });
  const groupProject = await prisma.assessment.create({
    data: {
      title: "Group Project Report",
      moduleId: cs310.id,
      dueAt: day(16),
      weighting: 50,
      description: "Team report on the term-long project.",
      createdById: registrar.id,
    },
  });
  const mlAssignment = await prisma.assessment.create({
    data: {
      title: "ML Assignment 1",
      moduleId: ds520.id,
      dueAt: day(10),
      weighting: 30,
      description: "Train and evaluate a classifier on the supplied dataset.",
      createdById: registrar.id,
    },
  });

  console.log("Recording submissions…");

  async function submit(opts: {
    assessmentId: string;
    lastName: string;
    title: string;
    submittedAt: Date;
    dueAt: Date;
    versions?: number;
  }) {
    const versions = opts.versions ?? 1;
    const late = opts.submittedAt.getTime() > opts.dueAt.getTime();
    const file = await writeSubmissionFile(opts.title);

    const submission = await prisma.submission.create({
      data: {
        assessmentId: opts.assessmentId,
        studentId: students[opts.lastName].id,
        version: versions,
        fileName: `${opts.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`,
        storedName: file.storedName,
        mimeType: "application/pdf",
        sizeBytes: file.sizeBytes,
        submittedAt: opts.submittedAt,
        isLate: late,
      },
    });

    // Version history — for a resubmission the earlier draft is kept.
    for (let v = 1; v <= versions; v += 1) {
      const isCurrent = v === versions;
      const versionFile = isCurrent ? file : await writeSubmissionFile(`${opts.title} (draft ${v})`);
      await prisma.submissionFile.create({
        data: {
          submissionId: submission.id,
          version: v,
          fileName: isCurrent
            ? `${opts.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.pdf`
            : `${opts.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-draft-${v}.pdf`,
          storedName: versionFile.storedName,
          mimeType: "application/pdf",
          sizeBytes: versionFile.sizeBytes,
          submittedAt: isCurrent ? opts.submittedAt : new Date(opts.submittedAt.getTime() - 86_400_000 * (versions - v)),
          isLate: isCurrent ? late : false,
        },
      });
    }
    return submission;
  }

  // Closed assessment: one on time, one late, one never submitted (Chloe), one absent (Hugo).
  await submit({
    assessmentId: dbCoursework.id,
    lastName: "Okafor",
    title: "Relational Design Coursework",
    submittedAt: day(-21),
    dueAt: day(-20),
  });
  await submit({
    assessmentId: dbCoursework.id,
    lastName: "Whitfield",
    title: "Relational Design Coursework (late)",
    submittedAt: day(-18),
    dueAt: day(-20),
  });

  await submit({
    assessmentId: portfolio.id,
    lastName: "Okafor",
    title: "Programming Portfolio",
    submittedAt: day(-9),
    dueAt: day(-7),
  });
  await submit({
    assessmentId: portfolio.id,
    lastName: "Whitfield",
    title: "Programming Portfolio",
    submittedAt: day(-8),
    dueAt: day(-7),
  });
  await submit({
    assessmentId: portfolio.id,
    lastName: "Ferreira",
    title: "Programming Portfolio",
    submittedAt: day(-6),
    dueAt: day(-7),
  });

  // Open assessment with a resubmission (version 2 replaced version 1 before the deadline).
  await submit({
    assessmentId: groupProject.id,
    lastName: "Martins",
    title: "Group Project Report",
    submittedAt: day(-2),
    dueAt: day(16),
    versions: 2,
  });
  await submit({
    assessmentId: mlAssignment.id,
    lastName: "Kowalski",
    title: "ML Assignment 1",
    submittedAt: day(-1),
    dueAt: day(10),
  });

  console.log("Entering marks…");

  async function grade(opts: {
    assessmentId: string;
    lastName: string;
    score?: number;
    isAbsent?: boolean;
    published: boolean;
    feedback?: string;
    withheldReason?: string;
  }) {
    const score = opts.score ?? null;
    const classification =
      opts.isAbsent || score === null
        ? opts.isAbsent
          ? Classification.FAIL
          : null
        : score >= 70
          ? Classification.DISTINCTION
          : score >= 60
            ? Classification.MERIT
            : score >= 40
              ? Classification.PASS
              : Classification.FAIL;

    return prisma.grade.create({
      data: {
        assessmentId: opts.assessmentId,
        studentId: students[opts.lastName].id,
        score: opts.isAbsent ? null : score,
        isAbsent: opts.isAbsent ?? false,
        classification,
        feedback: opts.feedback ?? null,
        published: opts.published,
        publishedAt: opts.published ? day(-3) : null,
        withheldReason: opts.withheldReason ?? null,
        enteredById: registrar.id,
      },
    });
  }

  await grade({
    assessmentId: dbCoursework.id,
    lastName: "Okafor",
    score: 78,
    published: true,
    feedback: "Excellent normalisation and a clear rationale throughout.",
  });
  await grade({
    assessmentId: dbCoursework.id,
    lastName: "Whitfield",
    score: 64,
    published: true,
    feedback: "Solid work. Marked without penalty; lateness recorded separately.",
  });
  // Marked, but held back because the account is in arrears.
  await grade({
    assessmentId: dbCoursework.id,
    lastName: "Martins",
    score: 55,
    published: false,
    feedback: "Adequate coverage of 3NF; justification is thin in places.",
    withheldReason: "Withheld pending fee settlement — £9,250.00 overdue",
  });
  await grade({
    assessmentId: dbCoursework.id,
    lastName: "Lindqvist",
    isAbsent: true,
    published: false,
    feedback: "No submission recorded; student withdrew during the assessment period.",
  });

  await grade({
    assessmentId: portfolio.id,
    lastName: "Okafor",
    score: 88,
    published: true,
    feedback: "Outstanding portfolio.",
  });
  await grade({
    assessmentId: portfolio.id,
    lastName: "Whitfield",
    score: 41,
    published: true,
    feedback: "Passes, but exercises 3 and 5 are incomplete.",
  });
  await grade({
    assessmentId: portfolio.id,
    lastName: "Ferreira",
    score: 35,
    published: true,
    feedback: "Below the pass mark — please contact your tutor about a resit.",
  });

  // Marked but not yet released: the moderation stage Registry sees as "awaiting publication".
  await grade({
    assessmentId: mlAssignment.id,
    lastName: "Kowalski",
    score: 72,
    published: false,
    feedback: "Strong methodology. Awaiting internal moderation before release.",
  });

  await prisma.auditLog.createMany({
    data: [
      {
        actorId: registrar.id,
        action: "student.status_changed",
        entityType: "Student",
        entityId: students["Lindqvist"].id,
        metadata: { from: "ENROLLED", to: "WITHDRAWN", reason: "Withdrew for personal reasons" },
      },
      {
        actorId: registrar.id,
        action: "grade.withheld",
        entityType: "Student",
        entityId: students["Martins"].id,
        metadata: { reason: "Fee arrears" },
      },
    ],
  });

  const counts = {
    users: await prisma.user.count(),
    programmes: await prisma.programme.count(),
    students: await prisma.student.count(),
    fees: await prisma.feeAssignment.count(),
    payments: await prisma.payment.count(),
    assessments: await prisma.assessment.count(),
    submissions: await prisma.submission.count(),
    grades: await prisma.grade.count(),
  };
  console.log("Seed complete:", counts);
  console.log(`\nStaff login:   registry@sms.ac.uk / ${STAFF_PASSWORD}`);
  console.log(`Student login: amara.okafor@students.sms.ac.uk / ${STUDENT_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
