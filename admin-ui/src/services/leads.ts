import { collection, getDocs, query, orderBy, limit, writeBatch, doc, increment } from "firebase/firestore";
import { db } from "./firebase";
import type { Lead } from "../types";

export async function fetchLeads(max = 2000): Promise<Lead[]> {
  const q = query(collection(db, "leads"), orderBy("createdAt", "desc"), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Lead[];
}

export async function incrementDownloads(ids: string[]) {
  const batch = writeBatch(db);
  ids.forEach((id) => batch.update(doc(db, "leads", id), { download: increment(1) }));
  await batch.commit();
}
