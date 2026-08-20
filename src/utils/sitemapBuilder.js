import Course from "../models/Course.js";
import Workshop from "../models/Workshop.js";
import JobListing from "../models/JobListing.js";
import {
  buildPublicWorkshopFilter,
  isHackathonEventType,
} from "./workshopVisibility.js";
import {
  activePublicJobFilter,
  purgeExpiredPublicJobs,
} from "./publicJobExpiry.js";

const escapeXml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const formatLastMod = (date) => {
  if (!date) return new Date().toISOString().slice(0, 10);
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
};

const urlEntry = ({ loc, lastmod, changefreq, priority }) => {
  const parts = [`  <url>`, `    <loc>${escapeXml(loc)}</loc>`];
  if (lastmod) parts.push(`    <lastmod>${lastmod}</lastmod>`);
  if (changefreq) parts.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority) parts.push(`    <priority>${priority}</priority>`);
  parts.push(`  </url>`);
  return parts.join("\n");
};

/** Static public pages safe for indexing */
export const STATIC_SITEMAP_ROUTES = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/courses", changefreq: "daily", priority: "0.9" },
  { path: "/mentorship", changefreq: "weekly", priority: "0.8" },
  { path: "/about", changefreq: "monthly", priority: "0.7" },
  { path: "/contact", changefreq: "monthly", priority: "0.7" },
  { path: "/register", changefreq: "monthly", priority: "0.6" },
  { path: "/login", changefreq: "monthly", priority: "0.5" },
  { path: "/privacy", changefreq: "yearly", priority: "0.3" },
  { path: "/terms", changefreq: "yearly", priority: "0.3" },
  { path: "/refund", changefreq: "yearly", priority: "0.3" },
];

export const getSiteBaseUrl = () => {
  const raw =
    process.env.SITE_URL ||
    process.env.FRONTEND_URL ||
    process.env.CLIENT_URL ||
    "https://indlearns.com";
  return raw.replace(/\/$/, "");
};

export const collectSitemapUrls = async (siteUrl = getSiteBaseUrl()) => {
  const base = siteUrl.replace(/\/$/, "");
  const today = formatLastMod(new Date());
  const urls = [];

  await purgeExpiredPublicJobs();

  const [courses, workshops, hackathons, publicJobCount] = await Promise.all([
    Course.find({ status: "published" }).select("_id updatedAt").sort({ updatedAt: -1 }),
    Workshop.find(buildPublicWorkshopFilter("workshop")).select("_id updatedAt eventType").sort({ date: 1 }),
    Workshop.find(buildPublicWorkshopFilter("hackathon")).select("_id updatedAt eventType").sort({ date: 1 }),
    JobListing.countDocuments(activePublicJobFilter()),
  ]);

  const visibleWorkshops = workshops.filter((w) => !isHackathonEventType(w.eventType));
  const visibleHackathons = hackathons.filter((w) => isHackathonEventType(w.eventType));

  for (const route of STATIC_SITEMAP_ROUTES) {
    urls.push({
      loc: `${base}${route.path}`,
      lastmod: today,
      changefreq: route.changefreq,
      priority: route.priority,
    });
  }

  if (visibleWorkshops.length > 0) {
    urls.push({
      loc: `${base}/workshops`,
      lastmod: formatLastMod(visibleWorkshops[0]?.updatedAt),
      changefreq: "daily",
      priority: "0.9",
    });
    for (const workshop of visibleWorkshops) {
      urls.push({
        loc: `${base}/workshops/${workshop._id}`,
        lastmod: formatLastMod(workshop.updatedAt),
        changefreq: "weekly",
        priority: "0.8",
      });
    }
  }

  if (visibleHackathons.length > 0) {
    urls.push({
      loc: `${base}/events`,
      lastmod: formatLastMod(visibleHackathons[0]?.updatedAt),
      changefreq: "daily",
      priority: "0.9",
    });
    for (const event of visibleHackathons) {
      urls.push({
        loc: `${base}/events/${event._id}`,
        lastmod: formatLastMod(event.updatedAt),
        changefreq: "weekly",
        priority: "0.8",
      });
    }
  }

  if (publicJobCount > 0) {
    urls.push({
      loc: `${base}/jobs`,
      lastmod: today,
      changefreq: "daily",
      priority: "0.8",
    });
  }

  for (const course of courses) {
    urls.push({
      loc: `${base}/courses/${course._id}`,
      lastmod: formatLastMod(course.updatedAt),
      changefreq: "weekly",
      priority: "0.85",
    });
  }

  return urls;
};

export const buildSitemapXml = (urls) => {
  const body = urls.map((entry) => urlEntry(entry)).join("\n");
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    body,
    "</urlset>",
    "",
  ].join("\n");
};

export const generateSitemapXml = async (siteUrl) => {
  const urls = await collectSitemapUrls(siteUrl);
  return buildSitemapXml(urls);
};

export const buildRobotsTxt = (siteUrl = getSiteBaseUrl()) => {
  const base = siteUrl.replace(/\/$/, "");
  return [
    "# IndLearn — robots.txt",
    "User-agent: *",
    "Allow: /",
    "",
    "# Private / authenticated areas",
    "Disallow: /admin",
    "Disallow: /admins/",
    "Disallow: /superadmin",
    "Disallow: /student",
    "Disallow: /tutor",
    "Disallow: /partner",
    "",
    "# Checkout & payment callbacks",
    "Disallow: /checkout",
    "Disallow: /payment/",
    "Disallow: /zoho/",
    "",
    "# Auth recovery (thin / session-specific pages)",
    "Disallow: /forgot-password",
    "Disallow: /reset-password",
    "",
    `Sitemap: ${base}/sitemap.xml`,
    "",
  ].join("\n");
};
