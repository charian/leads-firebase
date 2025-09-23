import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

export async function getSettlementConfig() {
  const fn = httpsCallable(functions, "getSettlementConfig");
  const res = await fn();
  return res.data as { costs: { [year: string]: number } };
}

export async function setSettlementCost(year: string, cost: number) {
  const fn = httpsCallable(functions, "setSettlementCost");
  await fn({ year, cost });
}

export async function calculateSettlement(startDate: Date, endDate: Date) {
  const fn = httpsCallable(functions, "calculateSettlement");
  const res = await fn({
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  });
  return res.data as { dailyData: any[]; costPerLead: number };
}
