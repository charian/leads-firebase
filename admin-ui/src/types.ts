export type Lead = {
  id: string;
  name?: string;
  phone_e164?: string;
  referrer?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  page?: string;
  location?: string;
  createdAt?: any; // Firestore Timestamp | Date
  download?: number;
  userAgent?: string;
};

export type Filters = {
  dl: "no" | "all";
  name: string;
  phone: string;
  source: string;
  period: "" | "오전" | "오후";
};
