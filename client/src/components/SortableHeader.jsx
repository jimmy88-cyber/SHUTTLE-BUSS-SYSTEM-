export default function SortableHeader({ label, sortKey, sort, onSort }) {
  const active = sort.key === sortKey;
  const indicator = active ? (sort.direction === "asc" ? " ▲" : " ▼") : " ↕";
  return (
    <button
      type="button"
      className="table-sort-button"
      onClick={() => onSort(sortKey)}
      aria-label={`เรียง${label}${active ? (sort.direction === "asc" ? " จากน้อยไปมาก" : " จากมากไปน้อย") : ""}`}
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
    >
      {label}{indicator}
    </button>
  );
}
