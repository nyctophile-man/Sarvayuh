import type { HealthDataProvider, MedicationReminder, ReportSummary } from "../../Ai/sarvayuh-chatbot";
import { pool } from "../../infrastructure/database/pg";

type ReportRow = {
  id: string;
  title: string;
  category: string | null;
  created_at: Date | string;
};

type PrescriptionRow = {
  items: unknown;
  notes: string | null;
};

function timesFromDosage(dosage: string): string[] {
  const normalized = dosage.toLowerCase();
  const times: string[] = [];
  if (/morning|before breakfast|\bam\b/.test(normalized)) times.push("08:00");
  if (/afternoon|after lunch|midday|noon/.test(normalized)) times.push("13:00");
  if (/evening|night|dinner|after food|\bpm\b|bedtime/.test(normalized)) times.push("20:00");
  return times.length ? times : ["as prescribed"];
}

export const healthData: HealthDataProvider = {
  async getRecentReports(userId: string, limit: number): Promise<ReportSummary[]> {
    const { rows } = await pool.query<ReportRow>(
      "select id,title,category,created_at from records where user_id=$1 order by created_at desc limit $2",
      [userId, limit],
    );
    return rows.map((row) => {
      const date = new Date(row.created_at).toISOString();
      return {
        id: row.id,
        title: row.title,
        date,
        summaryText: row.category ? `${row.category} uploaded on ${date.slice(0, 10)}` : undefined,
      };
    });
  },

  async getTestResults() {
    return [];
  },

  async getMedicationReminders(userId: string): Promise<MedicationReminder[]> {
    const { rows } = await pool.query<PrescriptionRow>(
      "select items,notes from prescriptions where patient_id=$1 and status='active' order by created_at desc limit 20",
      [userId],
    );
    const reminders: MedicationReminder[] = [];
    for (const row of rows) {
      const items: unknown[] = Array.isArray(row.items) ? row.items : [];
      for (const item of items) {
        if (typeof item !== "object" || item === null || !("medicine" in item)) continue;
        const medicine = item.medicine;
        if (typeof medicine !== "string" || !medicine) continue;
        const dosage = "dosage" in item && typeof item.dosage === "string" ? item.dosage : undefined;
        reminders.push({
          medicine,
          dosage,
          times: timesFromDosage(dosage ?? ""),
          instructions: row.notes ?? undefined,
        });
      }
    }
    return reminders;
  },
};
