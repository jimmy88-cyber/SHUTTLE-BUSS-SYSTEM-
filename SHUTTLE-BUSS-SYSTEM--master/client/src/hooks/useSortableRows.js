import { useMemo, useState } from "react";

function readValue(row, path) {
  return path.split(".").reduce((value, key) => value?.[key], row);
}

function compareValues(left, right) {
  if (left == null || left === "") return right == null || right === "" ? 0 : 1;
  if (right == null || right === "") return -1;

  const leftText = String(left);
  const rightText = String(right);
  if (/^\d+$/.test(leftText) && /^\d+$/.test(rightText)) {
    const leftNumber = BigInt(leftText);
    const rightNumber = BigInt(rightText);
    return leftNumber < rightNumber ? -1 : leftNumber > rightNumber ? 1 : 0;
  }

  const leftDate = typeof left === "string" ? Date.parse(left) : NaN;
  const rightDate = typeof right === "string" ? Date.parse(right) : NaN;
  if (Number.isFinite(leftDate) && Number.isFinite(rightDate)) {
    return leftDate - rightDate;
  }

  return leftText.localeCompare(rightText, undefined, { numeric: true, sensitivity: "base" });
}

export function useSortableRows(rows) {
  const [sort, setSort] = useState({ key: null, direction: "asc" });
  const sortedRows = useMemo(() => {
    if (!sort.key) return rows;
    return rows
      .map((row, index) => ({ row, index }))
      .sort((a, b) => {
        const result = compareValues(readValue(a.row, sort.key), readValue(b.row, sort.key));
        return result === 0 ? a.index - b.index : result * (sort.direction === "asc" ? 1 : -1);
      })
      .map(({ row }) => row);
  }, [rows, sort]);

  function sortBy(key) {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  }

  return { sortedRows, sort, sortBy };
}
