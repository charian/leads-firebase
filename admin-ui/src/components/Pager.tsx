import React from "react";

type Props = {
  page: number;
  // Dispatch 또는 숫자 받는 함수 둘 다 허용 ✅
  setPage: React.Dispatch<React.SetStateAction<number>> | ((n: number) => void);
  total: number;
  totalPages: number;
  pageSize: number;
  className?: string; // ✅ 추가
};

export default function Pager({ page, setPage, total, totalPages, pageSize, className = "" }: Props) {
  const to = (n: number) => (typeof setPage === "function" ? (setPage as any)(n) : null);

  return (
    <div className={`pager ${className}`}>
      <span className='pg-info'>
        총 {total}건 • {page}/{totalPages} 페이지 (페이지당 {pageSize})
      </span>
      <div style={{ flex: 1 }} />
      <button className='pg-btn btn' disabled={page <= 1} onClick={() => to(page - 1)}>
        이전
      </button>
      <button className='pg-btn btn btn-primary' disabled={page >= totalPages} onClick={() => to(page + 1)}>
        다음
      </button>
    </div>
  );
}
