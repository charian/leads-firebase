import type { Lead } from "../types";
import { formatKST } from "../utils/time";
import { parseUA } from "../utils/ua";

type Props = {
  rows: Lead[];
  selected: Set<string>;
  onToggleRow: (id: string, checked: boolean) => void;
  onToggleAll: (check: boolean) => void;
  allCount: number; // 현재 필터 전체 개수
  className?: string;
};

export default function LeadsTable({ rows, selected, onToggleRow, onToggleAll, allCount, className = "" }: Props) {
  const selectedInFiltered = rows.filter((r) => selected.has(r.id)).length;
  const headerState = allCount === 0 ? "none" : selectedInFiltered === 0 ? "none" : selectedInFiltered === allCount ? "all" : "partial";

  return (
    <table className={`table ${className}`}>
      <thead>
        <tr>
          <th className='fit'>
            <input
              type='checkbox'
              checked={headerState === "all"}
              ref={(el) => {
                if (el) el.indeterminate = headerState === "partial";
              }}
              onChange={(e) => onToggleAll(e.target.checked)}
            />
          </th>
          <th>name</th>
          <th>phone_e164</th>
          <th>referrer</th>
          <th>utm_source</th>
          <th>utm_medium</th>
          <th>utm_campaign</th>
          <th>page</th>
          <th>location</th>
          <th>period</th>
          <th>Platform</th>
          <th>Browser</th>
          <th>createdAt (KST)</th>
          <th>download</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const { date, time, period } = formatKST(r.createdAt);
          const { platform, browser } = parseUA(r.userAgent);
          const checked = selected.has(r.id);
          return (
            <tr key={r.id}>
              <td className='fit'>
                <input type='checkbox' checked={checked} onChange={(e) => onToggleRow(r.id, e.target.checked)} />
              </td>
              <td>
                <span className='badge'>{r.name}</span>
              </td>
              <td className='nowrap'>{r.phone_e164}</td>
              <td className='kicker'>{r.referrer}</td>
              <td>
                <span className='chip'>{r.utm_source}</span>
              </td>
              <td>
                <span className='chip'>{r.utm_medium}</span>
              </td>
              <td>
                <span className='chip'>{r.utm_campaign}</span>
              </td>
              <td>{r.page}</td>
              <td>{r.location}</td>
              <td className='nowrap'>{period}</td>
              <td className='nowrap'>{platform}</td>
              <td className='right'>{browser}</td>
              <td>{`${date} ${time}`}</td>
              <td>{Number(r.download ?? 0)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
