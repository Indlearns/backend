import TutorShowcase from "../../models/TutorShowcase.js";
import {
  saveTutorShowcaseImage,
  tutorShowcaseImagePublicPath,
  deleteTutorShowcaseImageByUrl,
} from "../../utils/tutorShowcaseImageStorage.js";

const parseBool = (value, fallback = true) => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value === "boolean") return value;
  return value === "true" || value === "1";
};

const applyUploadedImage = async (item, file) => {
  if (!file) return;
  if (item.imageUrl) {
    await deleteTutorShowcaseImageByUrl(item.imageUrl);
  }
  const fileId = await saveTutorShowcaseImage(file);
  item.imageUrl = tutorShowcaseImagePublicPath(fileId);
};

export const createTutorShowcase = async (req, res) => {
  try {
    const { name, experience, description, sortOrder, isActive } = req.body;

    if (!name?.trim() || !experience?.trim() || !description?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Name, experience, and description are required.",
      });
    }

    const item = new TutorShowcase({
      name: name.trim(),
      experience: experience.trim(),
      description: description.trim(),
      imageUrl: "",
      sortOrder: Number(sortOrder) || 0,
      isActive: parseBool(isActive, true),
      createdBy: req.user._id,
    });

    await applyUploadedImage(item, req.file);
    await item.save();

    res.status(201).json({ success: true, data: item });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getTutorShowcases = async (req, res) => {
  const items = await TutorShowcase.find()
    .populate("createdBy", "name email")
    .sort({ sortOrder: 1, createdAt: -1 });
  res.json({ success: true, count: items.length, data: items });
};

export const updateTutorShowcase = async (req, res) => {
  try {
    const item = await TutorShowcase.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: "Showcase entry not found." });
    }

    if (req.body.name !== undefined) item.name = String(req.body.name).trim();
    if (req.body.experience !== undefined) item.experience = String(req.body.experience).trim();
    if (req.body.description !== undefined) item.description = String(req.body.description).trim();
    if (req.body.sortOrder !== undefined) item.sortOrder = Number(req.body.sortOrder) || 0;
    if (req.body.isActive !== undefined) item.isActive = parseBool(req.body.isActive, item.isActive);

    if (req.body.removeImage === "true" && !req.file) {
      await deleteTutorShowcaseImageByUrl(item.imageUrl);
      item.imageUrl = "";
    }

    await applyUploadedImage(item, req.file);

    if (!item.name || !item.experience || !item.description) {
      return res.status(400).json({
        success: false,
        message: "Name, experience, and description cannot be empty.",
      });
    }

    await item.save();
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteTutorShowcase = async (req, res) => {
  const item = await TutorShowcase.findById(req.params.id);
  if (!item) {
    return res.status(404).json({ success: false, message: "Showcase entry not found." });
  }

  await deleteTutorShowcaseImageByUrl(item.imageUrl);
  await item.deleteOne();
  res.json({ success: true, message: "Showcase entry deleted." });
};
