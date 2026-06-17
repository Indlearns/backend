import { streamCourseImage } from "../utils/courseImageStorage.js";

export const getCourseImage = async (req, res) => {
  try {
    await streamCourseImage(req.params.id, res);
  } catch {
    if (!res.headersSent) res.status(404).end();
  }
};
