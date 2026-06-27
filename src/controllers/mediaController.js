import { streamCourseImage } from "../utils/courseImageStorage.js";
import { streamTutorShowcaseImage } from "../utils/tutorShowcaseImageStorage.js";

export const getCourseImage = async (req, res) => {
  try {
    await streamCourseImage(req.params.id, res);
  } catch {
    if (!res.headersSent) res.status(404).end();
  }
};

export const getTutorShowcaseImage = async (req, res) => {
  try {
    await streamTutorShowcaseImage(req.params.id, res);
  } catch {
    if (!res.headersSent) res.status(404).end();
  }
};
