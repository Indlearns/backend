export const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const normalizeEventType = (eventType) => {
  const type = String(eventType || "workshop").toLowerCase().trim();
  return type === "hackathon" ? "hackathon" : "workshop";
};

export const isHackathonEventType = (eventType) =>
  normalizeEventType(eventType) === "hackathon";

/** Active statuses shown on the public site (includes legacy "live"). */
export const PUBLIC_WORKSHOP_STATUSES = ["upcoming", "ongoing", "live"];

export const isPubliclyVisibleWorkshop = (workshop, today = startOfToday()) => {
  if (!workshop) return false;
  if (["cancelled", "completed"].includes(workshop.status)) return false;
  if (!PUBLIC_WORKSHOP_STATUSES.includes(workshop.status)) return false;

  const eventDate = new Date(workshop.date);
  eventDate.setHours(0, 0, 0, 0);

  if (eventDate >= today) return true;

  if (workshop.registrationCloseDate) {
    const closeDate = new Date(workshop.registrationCloseDate);
    closeDate.setHours(0, 0, 0, 0);
    if (closeDate >= today) return true;
  }

  return false;
};

export const buildPublicWorkshopFilter = (eventTypeQuery) => {
  const today = startOfToday();
  const filter = {
    status: { $in: PUBLIC_WORKSHOP_STATUSES },
    $or: [{ date: { $gte: today } }, { registrationCloseDate: { $gte: today } }],
  };

  if (eventTypeQuery === "hackathon") {
    filter.eventType = "hackathon";
  } else {
    filter.eventType = { $ne: "hackathon" };
  }

  return filter;
};

export const buildAdminWorkshopTypeFilter = (eventType) => {
  if (eventType === "hackathon") {
    return { eventType: "hackathon" };
  }
  return { eventType: { $ne: "hackathon" } };
};
