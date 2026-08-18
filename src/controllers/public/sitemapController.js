import {
  generateSitemapXml,
  buildRobotsTxt,
  getSiteBaseUrl,
} from "../../utils/sitemapBuilder.js";

export const getSitemapXml = async (req, res) => {
  try {
    const siteUrl = req.query.site || getSiteBaseUrl();
    const xml = await generateSitemapXml(siteUrl);
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=3600");
    res.send(xml);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getRobotsTxt = async (_req, res) => {
  try {
    const text = buildRobotsTxt();
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");
    res.send(text);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
