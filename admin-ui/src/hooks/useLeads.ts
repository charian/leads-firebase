import { useState } from "react";
// ✨ 수정: react-router-dom 의존성을 제거하고, 불필요한 useEffect도 제거합니다.
import type { Lead, Filters } from "../types";
import dayjs from "dayjs";

export function useLeads(source: Lead[]) {
  // ✨ 수정: useSearchParams 대신 브라우저 기본 API를 사용합니다.
  const searchParams = new URLSearchParams(window.location.search);

  const [filters, setFilters] = useState<Filters>({
    dateRange: [searchParams.get("start") ? dayjs(searchParams.get("start")) : dayjs().startOf("day"), searchParams.get("end") ? dayjs(searchParams.get("end")) : dayjs().endOf("day")],
    status: (searchParams.get("status") as Filters["status"]) || "all",
    dl: (searchParams.get("dl") as Filters["dl"]) || "all",
    name: searchParams.get("name") || "",
    phone: searchParams.get("phone") || "",
  });

  const [page, setPage] = useState(1);
  const pageSize = 50;

  const filtered = source.filter((r) => {
    if (filters.name && !(r.name || "").toLowerCase().includes(filters.name.toLowerCase())) {
      return false;
    }
    const phoneDigits = filters.phone.replace(/\D/g, "");
    if (phoneDigits && !(r.phone_raw || "").replace(/\D/g, "").includes(phoneDigits)) {
      return false;
    }
    if (filters.status === "good" && r.isBad) return false;
    if (filters.status === "bad" && !r.isBad) return false;

    const downloadCount = Number(r.download || 0);
    if (filters.dl === "yes" && downloadCount === 0) return false;
    if (filters.dl === "no" && downloadCount > 0) return false;

    if (filters.dateRange && r.createdAt) {
      const leadDate = dayjs(r.createdAt.toDate());
      const [start, end] = filters.dateRange;
      if (start && leadDate.isBefore(start, "day")) return false;
      if (end && leadDate.isAfter(end, "day")) return false;
    }

    return true;
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const updateFilters = (patch: Partial<Filters>) => {
    const newFilters = { ...filters, ...patch };
    setFilters(newFilters);
    setPage(1);

    const params = new URLSearchParams();
    if (newFilters.dateRange) {
      if (newFilters.dateRange[0]) params.set("start", newFilters.dateRange[0].format("YYYY-MM-DD"));
      if (newFilters.dateRange[1]) params.set("end", newFilters.dateRange[1].format("YYYY-MM-DD"));
    }
    if (newFilters.status !== "all") params.set("status", newFilters.status);
    if (newFilters.dl !== "all") params.set("dl", newFilters.dl);
    if (newFilters.name) params.set("name", newFilters.name);
    if (newFilters.phone) params.set("phone", newFilters.phone);

    window.history.replaceState({}, "", `${window.location.pathname}?${params.toString()}`);
  };

  return { filters, updateFilters, page, setPage, total, totalPages, pageRows, pageSize };
}
