import Company from "../../models/Company.js";

export const createCompany = async (req, res) => {
  try {
    const company = await Company.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json({ success: true, data: company });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getCompanies = async (req, res) => {
  const companies = await Company.find().sort({ createdAt: -1 });
  res.json({ success: true, count: companies.length, data: companies });
};

export const updateCompany = async (req, res) => {
  const company = await Company.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!company) return res.status(404).json({ success: false, message: "Company not found." });
  res.json({ success: true, data: company });
};

export const deleteCompany = async (req, res) => {
  const company = await Company.findByIdAndDelete(req.params.id);
  if (!company) return res.status(404).json({ success: false, message: "Company not found." });
  res.json({ success: true, message: "Company deleted." });
};
