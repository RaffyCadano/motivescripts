export const PROPOSAL_SCOPE_PRESETS = [
  "Homepage",
  "Services Page",
  "About Page",
  "Contact Page",
  "Gallery",
  "Testimonials",
  "Quote Request Form",
  "Booking Form",
  "Responsive Website Design",
  "Mobile Optimization",
  "SEO Setup",
  "Analytics",
  "Google Maps",
  "Social Media Integration",
  "Hosting Setup",
] as const;

export const PROPOSAL_FEATURE_PRESETS = [
  "Responsive Design",
  "Contact Form",
  "Quote Request Form",
  "Booking",
  "Gallery",
  "Testimonials",
  "Google Maps",
  "Social Media Integration",
  "Analytics",
  "Basic SEO",
  "Performance Optimization",
  "Security Setup",
  "Hosting Setup",
] as const;

export function hasPresetLine(text: string, line: string): boolean {
  const needle = line.trim().toLowerCase();
  if (!needle) return false;
  return text.split(/\r?\n/).some((entry) => entry.trim().toLowerCase() === needle);
}

export function togglePresetLine(text: string, line: string): string {
  const label = line.trim();
  if (!label) return text;
  if (hasPresetLine(text, label)) {
    return text
      .split(/\r?\n/)
      .filter((entry) => entry.trim().toLowerCase() !== label.toLowerCase())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }
  const trimmed = text.replace(/\s+$/, "");
  return trimmed ? `${trimmed}\n${label}` : label;
}
