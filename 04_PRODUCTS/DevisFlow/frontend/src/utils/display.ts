export const compactCompanyName = (name?: string | null) => {
  if (!name) return "—";

  return name.replace(/^Entreprise\s+/i, "").trim();
};
