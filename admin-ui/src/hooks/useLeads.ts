import { useCallback, useMemo, useState } from "react";
import type { Lead, Filters } from "../types";
import { formatKST } from "../utils/time";

export function useLeads(source: Lead[]) {
  const [filters, setFilters] = useState<Filters>({
    dl: "no",
    name: "",
    phone: "",
    source: "",
    period: "",
  });
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const filtered = useMemo(() => {
    let rows = [...source];
    if (filters.dl === "no") rows = rows.filter((r) => !r.download || Number(r.download) === 0);
    if (filters.name) rows = rows.filter((r) => (r.name || "").toLowerCase().includes(filters.name.toLowerCase()));
    if (filters.phone) {
      const p = filters.phone.replace(/\D/g, "");
      rows = rows.filter((r) => (r.phone_e164 || "").replace(/\D/g, "").includes(p));
    }
    if (filters.source) rows = rows.filter((r) => (r.utm_source || "").toLowerCase().includes(filters.source.toLowerCase()));
    if (filters.period) rows = rows.filter((r) => formatKST(r.createdAt).period === filters.period);
    return rows;
  }, [source, filters]);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  // const resetToFirst = useCallback(() => setPage(1), []);
  const updateFilters = useCallback((patch: Partial<Filters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setPage(1);
  }, []);

  return { filters, updateFilters, page, setPage, total, totalPages, pageRows, pageSize, filtered };
}
