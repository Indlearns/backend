/** Expand from–to range into YYYY-MM-DD strings for selected weekdays (0=Sun … 6=Sat) */
export const parseLocalDate = (dateStr) => {
  const [y, m, d] = String(dateStr).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const toDateInput = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const expandDateRange = (fromDate, toDate, weekdays = [1, 2, 3, 4, 5]) => {
  const from = parseLocalDate(fromDate);
  const to = parseLocalDate(toDate);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    return [];
  }

  const daySet = new Set((weekdays || []).map(Number));
  const dates = [];
  const cur = new Date(from);

  while (cur <= to) {
    if (daySet.has(cur.getDay())) {
      dates.push(toDateInput(cur));
    }
    cur.setDate(cur.getDate() + 1);
  }

  return dates;
};

export const normalizeDateList = (dates) =>
  [...new Set((dates || []).map((d) => String(d).slice(0, 10)))].sort();

/** Resolve dates from API body: dates[], range, or single date */
export const resolveScheduleDates = (body) => {
  if (Array.isArray(body.dates) && body.dates.length) {
    return normalizeDateList(body.dates);
  }

  if (body.fromDate && body.toDate) {
    const weekdays =
      Array.isArray(body.weekdays) && body.weekdays.length
        ? body.weekdays
        : [0, 1, 2, 3, 4, 5, 6];
    return expandDateRange(body.fromDate, body.toDate, weekdays);
  }

  if (body.date) {
    return [String(body.date).slice(0, 10)];
  }

  return [];
};
