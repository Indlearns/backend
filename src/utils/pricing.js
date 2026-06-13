/** Paid only when price is a positive number (ignore stale isFree flag). */
export const isFreePrice = (item) => Number(item?.price ?? 0) <= 0;
