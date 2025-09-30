// charian/leads-firebase/leads-firebase-406454682e97bd77272c4f2bfb7458eafbb2216c/admin-ui/src/hooks/useLeads.ts

import { useState, useMemo, useEffect } from "react";
import dayjs from "dayjs";
import { useSearchParams } from "react-router-dom";
import type { Lead, Filters } from "../types";

// ✨ 수정: 기본 조회 기간을 최근 7일로 설정합니다.
const initialFilters: Filters = {
  dateRange: [dayjs().subtract(6, "day"), dayjs()],
  status: "all",
  dl: "all",
  name: "",
  phone: "",
};

export const useLeads = (rows: Lead[]) => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState<Filters>(() => {
    const params = Object.fromEntries(searchParams.entries());
    const newFilters = { ...initialFilters };
    if (params.startDate && params.endDate) {
      newFilters.dateRange = [dayjs(params.startDate), dayjs(params.endDate)];
    }
    if (params.status) newFilters.status = params.status as Filters["status"];
    if (params.dl) newFilters.dl = params.dl as Filters["dl"];
    if (params.name) newFilters.name = params.name;
    if (params.phone) newFilters.phone = params.phone;
    return newFilters;
  });

  const [page, setPage] = useState(1);
  const pageSize = 50;

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (filters.dateRange && filters.dateRange[0] && filters.dateRange[1]) {
        const rowDate = dayjs(row.createdAt.toDate());
        if (rowDate.isBefore(filters.dateRange[0], "day") || rowDate.isAfter(filters.dateRange[1], "day")) {
          return false;
        }
      }
      if (filters.status !== "all") {
        const isBad = filters.status === "bad";
        if (row.isBad !== isBad) return false;
      }
      if (filters.dl !== "all") {
        const hasDownloaded = filters.dl === "yes";
        if (!!row.downloadedAt !== hasDownloaded) return false;
      }
      if (filters.name && !row.name.includes(filters.name)) {
        return false;
      }
      if (filters.phone) {
        const phoneDigits = filters.phone.replace(/\D/g, "");
        if (!row.phone_raw.replace(/\D/g, "").includes(phoneDigits)) {
          return false;
        }
      }
      return true;
    });
  }, [rows, filters]);

  const pageRows = useMemo(() => {
    return filteredRows.slice((page - 1) * pageSize, page * pageSize);
  }, [filteredRows, page, pageSize]);

  const updateFilters = (newFilters: Partial<Filters>) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  useEffect(() => {
    const params: Record<string, string> = {};
    if (filters.dateRange && filters.dateRange[0] && filters.dateRange[1]) {
      params.startDate = filters.dateRange[0].format("YYYY-MM-DD");
      params.endDate = filters.dateRange[1].format("YYYY-MM-DD");
    }
    if (filters.status !== "all") params.status = filters.status;
    if (filters.dl !== "all") params.dl = filters.dl;
    if (filters.name) params.name = filters.name;
    if (filters.phone) params.phone = filters.phone;
    setSearchParams(params, { replace: true });
  }, [filters, setSearchParams]);

  return {
    filters,
    updateFilters,
    page,
    setPage,
    total: filteredRows.length,
    pageRows,
    pageSize,
  };
};
