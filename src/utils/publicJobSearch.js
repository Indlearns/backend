const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Case-insensitive keyword match across public job text fields */
export const buildPublicJobKeywordFilter = (keyword) => {
  const trimmed = String(keyword || "").trim();
  if (!trimmed) return null;

  const regex = new RegExp(escapeRegex(trimmed), "i");
  return {
    $or: [
      { title: regex },
      { company: regex },
      { location: regex },
      { description: regex },
      { jobType: regex },
      { skills: regex },
    ],
  };
};
