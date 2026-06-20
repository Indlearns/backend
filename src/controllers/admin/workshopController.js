import Workshop from "../../models/Workshop.js";
import { parseRegistrationCloseDate } from "../../utils/workshopRegistration.js";

import {
  buildAdminWorkshopTypeFilter,
  normalizeEventType,
} from "../../utils/workshopVisibility.js";

const parseWorkshopBody = (body) => {
  const price = Number(body.price) || 0;
  const rawStatus = String(body.status || "upcoming").toLowerCase();
  const status = rawStatus === "live" ? "ongoing" : rawStatus;

  return {
    title: body.title,
    description: body.description || "",
    eventType: normalizeEventType(body.eventType),
    date: body.date,
    startTime: body.startTime || "10:00",
    endTime: body.endTime || "12:00",
    meetLink: body.meetLink || "",
    maxParticipants: body.maxParticipants || 100,
    status: ["upcoming", "ongoing", "completed", "cancelled"].includes(status)
      ? status
      : "upcoming",
    price,
    currency: body.currency || "INR",
    isFree: price <= 0,
    registrationCloseDate: parseRegistrationCloseDate(body.registrationCloseDate),
  };
};

export const createWorkshop = async (req, res) => {
  try {
    const data = parseWorkshopBody(req.body);
    if (!data.title || !data.date) {
      return res.status(400).json({ success: false, message: "Title and date are required." });
    }
    const workshop = await Workshop.create({ ...data, createdBy: req.user._id });
    res.status(201).json({ success: true, data: workshop });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const getWorkshops = async (req, res) => {
  const workshops = await Workshop.find()
    .populate("createdBy", "name email")
    .sort({ date: 1 });
  res.json({ success: true, count: workshops.length, data: workshops });
};

export const updateWorkshop = async (req, res) => {
  try {
    const workshop = await Workshop.findById(req.params.id);
    if (!workshop) {
      return res.status(404).json({ success: false, message: "Workshop not found." });
    }

    const fields = [
      "title",
      "description",
      "eventType",
      "date",
      "startTime",
      "endTime",
      "meetLink",
      "maxParticipants",
      "status",
    ];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) workshop[f] = req.body[f];
    });
    if (req.body.status !== undefined) {
      const rawStatus = String(req.body.status).toLowerCase();
      const status = rawStatus === "live" ? "ongoing" : rawStatus;
      if (["upcoming", "ongoing", "completed", "cancelled"].includes(status)) {
        workshop.status = status;
      }
    }
    if (req.body.eventType !== undefined) {
      workshop.eventType = normalizeEventType(req.body.eventType);
    }
    if (req.body.price !== undefined) {
      workshop.price = Number(req.body.price) || 0;
      workshop.isFree = workshop.price <= 0;
    }
    if (req.body.registrationCloseDate !== undefined) {
      workshop.registrationCloseDate = parseRegistrationCloseDate(req.body.registrationCloseDate);
    }

    await workshop.save();
    res.json({ success: true, data: workshop });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteWorkshop = async (req, res) => {
  const workshop = await Workshop.findByIdAndDelete(req.params.id);
  if (!workshop) return res.status(404).json({ success: false, message: "Workshop not found." });
  res.json({ success: true, message: "Workshop deleted." });
};
