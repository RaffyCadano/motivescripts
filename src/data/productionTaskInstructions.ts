export const TASK_INSTRUCTION_HEADINGS = [
  "Objective",
  "What to do",
  "Before starting",
  "Deliverable",
  "Done when",
  "This project's approved scope",
] as const;

export type TaskInstructionHeading = (typeof TASK_INSTRUCTION_HEADINGS)[number];

export type TaskInstructionSection = {
  heading: TaskInstructionHeading | null;
  body: string;
};

type InstructionParts = Partial<Record<Exclude<TaskInstructionHeading, "This project's approved scope">, string>>;

const LEGACY_PRODUCTION_DESCRIPTIONS = new Set([
  "Read the accepted proposal and confirm the purchased pages and features before production starts.",
  "Confirm the page list and requirements from the accepted commercial scope.",
  "Collect or confirm logos, photos, and written content needed for the purchased pages.",
  "Collect or confirm logos, photos, and written content needed to build the purchased pages.",
  "Write homepage copy included in the accepted proposal.",
  "Write About page copy included in the accepted proposal.",
  "Write Services page copy included in the accepted proposal.",
  "Write Contact page copy included in the accepted proposal.",
  "Write gallery or portfolio copy included in the accepted proposal.",
  "Write testimonials copy included in the accepted proposal.",
  "Write FAQ copy included in the accepted proposal.",
  "Write pricing copy included in the accepted proposal.",
  "Write team copy included in the accepted proposal.",
  "Write locations copy included in the accepted proposal.",
  "Write blog or news copy included in the accepted proposal.",
  "Prepare the contact details included with the purchased content work.",
  "Migrate the content included in the accepted proposal.",
  "Set the visual direction for the website based on the approved scope.",
  "Design the homepage layout and content structure.",
  "Design the About page from the accepted proposal.",
  "Design the Services page from the accepted proposal.",
  "Design the Contact page from the accepted proposal.",
  "Design the gallery or portfolio page from the accepted proposal.",
  "Design the testimonials page from the accepted proposal.",
  "Design the FAQ page from the accepted proposal.",
  "Design the Pricing page from the accepted proposal.",
  "Design the Team page from the accepted proposal.",
  "Design the Locations page from the accepted proposal.",
  "Design the blog or news page from the accepted proposal.",
  "Design layouts that work on phones and desktops.",
  "Implement the homepage from the approved design.",
  "Implement the About page from the accepted proposal.",
  "Implement the Services page from the accepted proposal.",
  "Implement the Contact page from the accepted proposal.",
  "Implement the gallery or portfolio page from the accepted proposal.",
  "Implement the testimonials page from the accepted proposal.",
  "Implement the FAQ page from the accepted proposal.",
  "Implement the pricing page from the accepted proposal.",
  "Implement the team page from the accepted proposal.",
  "Implement the locations page from the accepted proposal.",
  "Implement the blog or news page from the accepted proposal.",
  "Implement the responsive and mobile layouts included in the accepted proposal.",
  "Add the contact form included in the accepted proposal.",
  "Add the quote request form included in the accepted proposal.",
  "Add the booking form included in the accepted proposal.",
  "Add the online payment functionality included in the accepted proposal.",
  "Add the e-commerce functionality included in the accepted proposal.",
  "Add the customer login included in the accepted proposal.",
  "Add the Google Maps integration included in the accepted proposal.",
  "Connect the social profiles included in the accepted proposal.",
  "Add the newsletter signup included in the accepted proposal.",
  "Add the live chat included in the accepted proposal.",
  "Complete the SEO setup included in the accepted proposal.",
  "Install the analytics included in the accepted proposal.",
  "Complete the hosting setup included in the accepted proposal.",
  "Set up the business email included in the accepted proposal.",
  "Connect the domain included in the accepted proposal.",
  "Complete the performance work included in the accepted proposal.",
  "Complete the security setup included in the accepted proposal.",
  "Place the approved client content on the purchased pages.",
  "Prepare the staging website for internal QA and client review. Hosting stays external.",
  "Make the staging website ready for the client to review.",
  "Complete approved revision requests from client review.",
  "QA the staging website against the accepted proposal.",
  "QA phone and desktop layouts included in the accepted proposal.",
  "QA this purchased feature on staging.",
  "Deploy the approved website to the production URL. Hosting stays external.",
  "Confirm the live website matches the approved staging version.",
  "Complete final QA on the production website before handoff.",
  "Included in the accepted commercial scope.",
]);

const HEADING_LOOKUP = new Map(TASK_INSTRUCTION_HEADINGS.map((heading) => [heading.toLowerCase(), heading]));

function sectioned(parts: InstructionParts): string {
  const order = ["Objective", "What to do", "Before starting", "Deliverable", "Done when"] as const;
  return order
    .filter((heading) => parts[heading]?.trim())
    .map((heading) => `${heading}\n${parts[heading]!.trim()}`)
    .join("\n\n");
}

export function normalizeProductionTaskTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^build the /, "build ")
    .replace(/^implement the /, "implement ")
    .replace(/^design the /, "design ")
    .replace(/^test the /, "test ")
    .replace(/^add the /, "add ")
    .replace(/^write the /, "write ")
    .replace(/^connect the /, "connect ")
    .replace(/^install the /, "install ");
}

const EXACT_ESTIMATED_HOURS: Record<string, number> = {
  "review approved scope": 0.5,
  "confirm sitemap and requirements": 1,
  "collect/confirm client content and assets": 1,
  "prepare contact information": 0.5,
  "migrate approved content": 2,
  "establish design direction": 3,
  "design brand identity / logo": 4,
  "design responsive/mobile layouts": 2,
  "implement responsive layouts": 3,
  "integrate approved content": 2,
  "prepare/deploy staging": 1,
  "prepare staging for client review": 0.5,
  "address requested revisions": 2,
  "test staging website": 1.5,
  "test responsive layouts": 1,
  "accessibility audit (ada/wcag)": 2,
  "deploy production": 1,
  "verify production website": 0.5,
  "set up ad campaign": 2,
  "set up social media & content calendar": 2,
  "final qa": 1,
  "write homepage copy": 2,
  "design homepage": 4,
  "build homepage": 5,
  "implement e-commerce functionality": 8,
  "implement online store": 8,
  "implement customer login": 4,
  "implement online payments": 3,
  "implement booking / appointment form": 2,
  "implement quote request form": 1.5,
  "implement contact form": 1,
  "set up seo": 2,
  "set up hosting": 1,
  "set up business email": 0.5,
  "add newsletter signup": 1,
  "add live chat": 1,
  "performance optimization": 2,
  "security setup": 1,
};

/**
 * Default effort estimate (hours) for a known production task title, for
 * prefilling a blank estimate in the task form. Never overwrites a value
 * someone already entered -- returns null for unrecognized/custom titles.
 * Mirrors production_task_estimated_hours in
 * 20260915000000_production_task_default_hours.sql -- keep both in sync.
 */
export function estimatedHoursForTitle(title: string): number | null {
  const key = normalizeProductionTaskTitle(title);
  if (!key) return null;
  if (key in EXACT_ESTIMATED_HOURS) return EXACT_ESTIMATED_HOURS[key];

  if (key.endsWith(" copy") && key.startsWith("write ")) return 1.5;
  if (key.startsWith("design ")) return 3;
  if (key.startsWith("build ")) return 4;
  if (key.startsWith("implement ")) return 2;
  if (key.startsWith("set up ")) return 1;
  if (key.startsWith("install ")) return 0.5;
  if (key.startsWith("connect ")) return 0.5;
  if (key.startsWith("add ")) return 0.5;
  if (key.startsWith("test ")) return 0.5;

  return null;
}

function displayPage(subject: string): string {
  const key = subject.trim().replace(/\s+copy$/i, "").replace(/\s+page$/i, "");
  const labels: Record<string, string> = {
    homepage: "homepage",
    about: "About page",
    services: "Services page",
    contact: "Contact page",
    "gallery / portfolio": "Gallery / Portfolio page",
    gallery: "Gallery / Portfolio page",
    testimonials: "Testimonials page",
    faq: "FAQ page",
    pricing: "Pricing page",
    team: "Team page",
    locations: "Locations page",
    "blog / news": "Blog / News page",
    blog: "Blog / News page",
  };
  return labels[key] ?? `${subject.trim()} page`.replace(/ page page$/i, " page");
}

function writePageInstructions(page: string): string {
  const label = displayPage(page);
  return sectioned({
    Objective: `Create clear, client-appropriate copy for the ${label}.`,
    "What to do": [
      "- Review the approved project scope and sitemap.",
      "- Review client-provided information for this page.",
      "- Identify the page's purpose and required sections.",
      "- Write the headline, supporting copy, and calls-to-action.",
      "- Use accurate business information. Do not invent facts.",
      "- Keep the copy aligned with the client's services and audience.",
      "- Proofread before handing off.",
    ].join("\n"),
    "Before starting":
      "The approved scope should include this page. Client notes and assets should be available, or missing items should already be flagged to the PM.",
    Deliverable: `${label.charAt(0).toUpperCase()}${label.slice(1)} copy ready for review.`,
    "Done when": "All required sections for this page are written, proofread, and ready for review.",
  });
}

function designPageInstructions(page: string): string {
  const label = displayPage(page);
  return sectioned({
    Objective: `Create the ${label} design from the approved scope and visual direction.`,
    "What to do": [
      "- Review the sitemap, available content, and established visual direction.",
      `- Design the ${label} layout and required sections.`,
      "- Place primary CTAs and navigation consistently with the rest of the site.",
      "- Use the correct branding and actual content where available.",
      "- Keep the hierarchy clear and do not add sections that are not in scope.",
    ].join("\n"),
    "Before starting": "Discovery requirements, sitemap, design direction, and required assets should be available.",
    Deliverable: `Completed ${label} design.`,
    "Done when":
      "Required sections are designed, branding is consistent, and the layout is ready for review or implementation.",
  });
}

function buildPageInstructions(page: string): string {
  const label = displayPage(page);
  return sectioned({
    Objective: `Implement the approved ${label} as a functional page in the external development environment.`,
    "What to do": [
      "- Review the approved design, content, and required assets.",
      "- Implement the page structure, navigation, and CTAs.",
      "- Integrate approved copy and images.",
      "- Implement responsive behavior.",
      "- Check desktop and mobile layouts.",
      "- Do not add pages or features that are not in the approved scope.",
    ].join("\n"),
    "Before starting": "Approved design, content, requirements, and required assets should be available.",
    Deliverable: `Functional ${label} in the external development environment.`,
    "Done when":
      "The page matches the approved design, approved content is integrated, responsive layout works, and no obvious implementation issues remain.",
  });
}

function implementFeatureInstructions(feature: string): string {
  return sectioned({
    Objective: `Add the ${feature} included in the approved project scope.`,
    "What to do": [
      `- Review the approved requirement for ${feature}.`,
      "- Confirm the intended behavior, fields, and destinations with the PM if anything is unclear.",
      "- Implement only what the accepted proposal includes.",
      "- Use approved copy, branding, and contact details.",
      "- Check the feature on desktop and mobile.",
      "- Do not add extra functionality that was not purchased.",
    ].join("\n"),
    "Before starting": "The feature must be listed in the approved scope. Required assets or account details should be available.",
    Deliverable: `Working ${feature} on the staging website.`,
    "Done when": `${feature} works as purchased, uses approved content, and has no obvious implementation issues.`,
  });
}

function testFeatureInstructions(feature: string): string {
  return sectioned({
    Objective: `Verify that ${feature} works on the staging website.`,
    "What to do": [
      `- Test ${feature} against the approved scope only.`,
      "- Check the happy path and obvious error states.",
      "- Confirm labels, links, and destinations.",
      "- Check desktop and mobile if the feature is user-facing.",
      "- Report issues through the existing task or feedback tools.",
    ].join("\n"),
    "Before starting": "Staging should be available and the feature should already be implemented.",
    Deliverable: `Documented test result for ${feature}.`,
    "Done when": `${feature} has been tested and any issues are documented.`,
  });
}

const EXACT_INSTRUCTIONS: Record<string, string> = {
  "review approved scope": sectioned({
    Objective: "Confirm that production work matches what the client actually purchased.",
    "What to do": [
      "- Review the accepted proposal.",
      "- Review the approved project scope.",
      "- Identify the pages included in the project.",
      "- Identify included features and functionality.",
      "- Check for special requirements or exclusions.",
      "- Confirm that the production team understands what is being delivered.",
      "- Report questions or discrepancies to the PM.",
    ].join("\n"),
    "Before starting": "The proposal must be accepted and the project scope must be available.",
    Deliverable: "Confirmed production scope and any questions or discrepancies reported to the PM.",
    "Done when":
      "Purchased pages and required features are confirmed, discrepancies have been communicated, and the production team has enough information to proceed.",
  }),
  "confirm sitemap and requirements": sectioned({
    Objective: "Establish the page structure and requirements before design and development.",
    "What to do": [
      "- Review the approved scope.",
      "- Confirm the sitemap and page list.",
      "- Identify the purpose of each purchased page.",
      "- Identify required forms, CTAs, navigation, integrations, and other functionality.",
      "- Identify any missing requirements.",
      "- Communicate questions to the PM.",
    ].join("\n"),
    "Before starting": "The approved commercial scope should be available.",
    Deliverable: "Confirmed sitemap and requirements.",
    "Done when": "The page structure and major requirements are confirmed.",
  }),
  "collect/confirm client content and assets": sectioned({
    Objective: "Make sure the team has the materials needed to design and build the website.",
    "What to do": [
      "- Check for logo, brand assets, photos, and existing website content.",
      "- Check contact information, business information, and social links.",
      "- Check written copy and service descriptions.",
      "- Identify anything missing and communicate it to the PM.",
      "- Do not invent client content to fill gaps.",
    ].join("\n"),
    "Before starting": "The project should have an approved scope so you know which pages need assets.",
    Deliverable: "Organized or confirmed project assets, plus a list of missing materials if applicable.",
    "Done when": "Required assets are available or the PM has documented what is still outstanding.",
  }),
  "prepare contact information": sectioned({
    Objective: "Confirm the contact details that will appear on the purchased pages.",
    "What to do": [
      "- Collect phone, email, address, hours, and social links from the client record or supplied assets.",
      "- Confirm the details with the PM if anything conflicts.",
      "- Note which pages or forms should use the information.",
      "- Do not invent contact details.",
    ].join("\n"),
    Deliverable: "Confirmed contact information ready for content and development.",
    "Done when": "Required contact details are confirmed or missing items are documented with the PM.",
  }),
  "migrate approved content": sectioned({
    Objective: "Move the client's existing approved content into this project.",
    "What to do": [
      "- Review the content-migration item in the accepted proposal.",
      "- Identify the source pages or files.",
      "- Copy only the content needed for purchased pages.",
      "- Note outdated or missing items for the PM.",
      "- Do not add new pages that were not purchased.",
    ].join("\n"),
    Deliverable: "Migrated content organized for the purchased pages.",
    "Done when": "Approved source content is available to the team and gaps are documented.",
  }),
  "establish design direction": sectioned({
    Objective: "Define the visual direction for the website and take that initial concept through client approval before completing the detailed page designs.",
    "What to do": [
      "- Review the client's branding, requirements, and supplied assets.",
      "- Determine typography, color usage, spacing, and layout principles.",
      "- Establish visual hierarchy.",
      "- Consider the client's industry and target audience.",
      "- Keep the direction appropriate for the approved scope.",
      "- Upload the concept as a Design deliverable (create one if it doesn't exist yet) and send it for client review.",
      "- Watch for client feedback. If changes are requested, upload a revised version and send that new version for review.",
      "- Repeat review/revise until the client approves a version.",
      "- This approval covers only the initial direction/concept, not the finished page designs -- continue into the per-page design tasks once it's approved.",
    ].join("\n"),
    "Before starting": "Brand assets and the approved sitemap should be available, or missing items should already be flagged.",
    Deliverable: "A Design deliverable with the initial visual direction, approved by the client through the existing file review workflow.",
    "Done when": "The client has approved a version of the initial design direction, giving the team a consistent, client-approved foundation to build the rest of the website on.",
  }),
  "design homepage": sectioned({
    Objective: "Create the primary homepage design based on the approved scope and design direction.",
    "What to do": [
      "- Review the sitemap, available content, and established visual direction.",
      "- Design the homepage layout, hero, and required content sections.",
      "- Establish primary CTA placement.",
      "- Design navigation and footer.",
      "- Include trust or social-proof sections only when they are in scope.",
      "- Use the correct branding and actual content where available.",
    ].join("\n"),
    "Before starting": "Discovery requirements, sitemap, design direction, and required assets should be available.",
    Deliverable: "Completed homepage design.",
    "Done when":
      "Required homepage sections are designed, branding is consistent, hierarchy is clear, and the design is ready for review or implementation.",
  }),
  "design responsive/mobile layouts": sectioned({
    Objective:
      "Finish the responsive/mobile layouts -- completing the overall website design -- then take the whole design through client approval before development begins.",
    "What to do": [
      "- Review the desktop designs for purchased pages.",
      "- Adapt layouts for mobile.",
      "- Check typography, spacing, navigation, images, and CTAs.",
      "- Ensure content remains readable and usable.",
      "- Do not design extra pages that are not in scope.",
      "- Once every purchased page and its responsive layout are ready, upload the complete design as a Design deliverable (e.g. \"Website Design\") and send it for client review.",
      "- Use a deliverable separate from the Initial Design / Concept reviewed earlier -- approving that concept did not approve this overall design, so this needs its own review and its own approval.",
      "- Watch for client feedback. If changes are requested, revise, upload a new version, and send that version for review again.",
      "- Repeat review/revise until the client approves a version.",
    ].join("\n"),
    Deliverable:
      "A Design deliverable with the completed website design, approved by the client through the existing file review workflow.",
    "Done when":
      "The client has approved a version of the overall website design. That approval means the design is ready for development -- it does not by itself start development tasks, assign developers, or change the project's status; the team picks up the already-planned development tasks against the approved version.",
  }),
  "write homepage copy": sectioned({
    Objective: "Create clear, client-appropriate copy for the homepage.",
    "What to do": [
      "- Review the approved project scope, sitemap, and client-provided information.",
      "- Identify the homepage's primary purpose.",
      "- Write the headline, supporting copy, and section copy required by the design.",
      "- Create clear calls-to-action.",
      "- Keep the content aligned with the client's services and audience.",
      "- Use accurate business information and proofread.",
    ].join("\n"),
    Deliverable: "Homepage copy ready for client review.",
    "Done when": "All required homepage content has been written, proofread, and is ready for review.",
  }),
  "write about page copy": writePageInstructions("about"),
  "write services page copy": sectioned({
    Objective: "Create clear descriptions of the services included in the project.",
    "What to do": [
      "- Review the client's actual services and the approved sitemap.",
      "- Write descriptions only for services that belong on the purchased Services page.",
      "- Make the copy easy to scan and include appropriate calls-to-action.",
      "- Avoid unsupported claims.",
      "- Proofread before handing off.",
    ].join("\n"),
    Deliverable: "Approved-scope service copy.",
    "Done when": "All required services have complete copy ready for review.",
  }),
  "build homepage": sectioned({
    Objective: "Implement the approved homepage design as a functional website page.",
    "What to do": [
      "- Review the approved design, content, and required assets.",
      "- Implement the page structure, hero, sections, navigation, and CTAs.",
      "- Integrate approved copy and images.",
      "- Implement responsive behavior.",
      "- Check desktop and mobile layouts.",
      "- Do not add features that are not in the approved scope.",
    ].join("\n"),
    "Before starting": "Approved design, content, requirements, and required assets should be available.",
    Deliverable: "Functional homepage in the external development environment.",
    "Done when":
      "The homepage matches the approved design, approved content is integrated, responsive layout works, links and CTAs work, and no obvious implementation issues remain.",
  }),
  "implement responsive layouts": sectioned({
    Objective: "Implement the purchased responsive and mobile behavior.",
    "What to do": [
      "- Review the approved responsive designs.",
      "- Implement layouts for common phone and desktop widths.",
      "- Check navigation, type size, images, and CTAs.",
      "- Fix overflow and unreadable content.",
    ].join("\n"),
    Deliverable: "Working responsive layouts on the purchased pages.",
    "Done when": "Required pages are usable on desktop and mobile.",
  }),
  "integrate approved content": sectioned({
    Objective: "Replace temporary development content with approved client content.",
    "What to do": [
      "- Review the approved content deliverables.",
      "- Match content to the correct purchased pages and sections.",
      "- Integrate the copy and check formatting, headings, and CTAs.",
      "- Verify contact information.",
      "- Remove placeholder or lorem content.",
    ].join("\n"),
    Deliverable: "Purchased pages using approved client content.",
    "Done when": "Approved content is correctly integrated and no placeholder client-facing content remains.",
  }),
  "set up hosting": sectioned({
    Objective: "Confirm and configure the agency's external hosting for this project.",
    "What to do": [
      "- Confirm the hosting provider and plan included in the accepted proposal.",
      "- Configure hosting through the agency's external hosting process.",
      "- Verify the environment is ready to receive a deployment.",
      "- Update this project's Domain & hosting delivery section: set the hosting provider and move Hosting status to In progress, then Configured once verified.",
      "- Report problems by setting Hosting status to Issue and notifying the PM.",
      "- MotiveScripts does not provision hosting itself.",
    ].join("\n"),
    Deliverable: "Configured hosting environment, ready for deployment.",
    "Done when": "Hosting is configured and verified, and the project's Hosting status reflects the result.",
  }),
  "connect the domain": sectioned({
    Objective: "Confirm and connect the domain included in the accepted proposal.",
    "What to do": [
      "- Confirm the domain name and registrar/DNS owner (agency or client) from discovery and the accepted proposal.",
      "- Connect the domain to the hosting environment through the agency's external process.",
      "- Verify the domain resolves to the correct environment.",
      "- Update this project's Domain & hosting delivery section: set the domain name and move Domain status to In progress, then Configured once verified.",
      "- Report problems by setting Domain status to Issue and notifying the PM.",
      "- MotiveScripts does not register or manage DNS itself.",
    ].join("\n"),
    Deliverable: "Domain connected and verified against the correct environment.",
    "Done when": "The domain resolves correctly and the project's Domain status reflects the result.",
  }),
  "prepare/deploy staging": sectioned({
    Objective: "Make the current website available for QA and client review.",
    "What to do": [
      "- Confirm the current development build is ready.",
      "- Deploy using the agency's external hosting process.",
      "- Verify the staging URL loads correctly.",
      "- Communicate staging availability to the PM.",
      "- MotiveScripts does not perform the deployment.",
    ].join("\n"),
    Deliverable: "Accessible staging website.",
    "Done when": "The staging website is accessible and ready for QA.",
  }),
  "prepare staging for client review": sectioned({
    Objective: "Coordinate the client's review of the staging website.",
    "What to do": [
      "- Confirm staging is available.",
      "- Confirm internal QA has been completed.",
      "- Provide the client with the staging website through the existing portal.",
      "- Monitor client feedback.",
      "- Organize revision requests.",
      "- The client should use the existing portal feedback and approval tools.",
    ].join("\n"),
    Deliverable: "Client review in progress through the portal.",
    "Done when": "Client feedback has been collected and the project is ready for revisions or approval.",
  }),
  "address requested revisions": sectioned({
    Objective: "Resolve approved client revision requests.",
    "What to do": [
      "- Review client feedback.",
      "- Clarify unclear requests with the PM.",
      "- Determine whether each request is within project scope.",
      "- Implement approved in-scope revisions.",
      "- Update staging.",
      "- Notify the PM when revisions are ready for review.",
    ].join("\n"),
    Deliverable: "Updated staging website with approved revisions.",
    "Done when": "Approved in-scope revisions have been completed and are available for review.",
  }),
  "test staging website": sectioned({
    Objective: "Verify the staging website works correctly on desktop.",
    "What to do": [
      "- Check page layout, navigation, typography, images, buttons, and links.",
      "- Check forms and other purchased functionality.",
      "- Check spacing and broken elements.",
      "- Check the browser console when something looks wrong.",
      "- Report issues through the existing task or feedback tools.",
      "- Do not test features that are not in the approved scope.",
    ].join("\n"),
    "Before starting": "Staging should be available.",
    Deliverable: "Documented desktop QA result.",
    "Done when": "The assigned desktop test has been completed and issues have been documented.",
  }),
  "test responsive layouts": sectioned({
    Objective: "Verify the staging website works correctly on mobile screen sizes.",
    "What to do": [
      "- Check responsive layout, navigation, and text readability.",
      "- Check images, buttons, forms, and spacing.",
      "- Check for horizontal overflow and broken sections.",
      "- Report issues through the existing task or feedback tools.",
    ].join("\n"),
    Deliverable: "Documented mobile QA result.",
    "Done when": "Mobile testing is complete and issues have been documented.",
  }),
  "deploy production": sectioned({
    Objective: "Deploy the approved website to the agency's production hosting environment.",
    "What to do": [
      "- Confirm client approval and that final QA is complete.",
      "- Deploy through the agency's external hosting process.",
      "- Verify the production site and production URL.",
      "- Update the MotiveScripts project production URL or development metadata where appropriate.",
      "- Inform the PM.",
      "- MotiveScripts does not perform the deployment.",
    ].join("\n"),
    Deliverable: "Live production website.",
    "Done when": "The website is live and the production URL has been verified.",
  }),
  "verify production website": sectioned({
    Objective: "Confirm the production website is functioning correctly after launch.",
    "What to do": [
      "- Open the production URL and confirm the site loads.",
      "- Check navigation, major purchased pages, forms, and important CTAs.",
      "- Confirm there are no obvious deployment issues.",
      "- Confirm the client portal can show the production URL where applicable.",
    ].join("\n"),
    Deliverable: "Verified live website.",
    "Done when": "The live website has been verified.",
  }),
  "final qa": sectioned({
    Objective: "Perform the final verification before production launch.",
    "What to do": [
      "- Check desktop and mobile layout.",
      "- Check navigation, forms, links, images, and contact information.",
      "- Check required content and major purchased functionality.",
      "- Check production configuration.",
      "- Confirm no blocking launch issues remain.",
    ].join("\n"),
    Deliverable: "Final pre-launch QA result.",
    "Done when": "No blocking launch issues remain.",
  }),
  "implement e-commerce functionality": implementFeatureInstructions("e-commerce functionality"),
  "implement online store": implementFeatureInstructions("e-commerce functionality"),
  "design brand identity / logo": sectioned({
    Objective: "Create the logo and brand identity included in the accepted proposal, and take it through client approval.",
    "What to do": [
      "- Review the client's industry, audience, and any existing brand materials.",
      "- Explore concepts for a logo mark and/or wordmark.",
      "- Define the core brand palette and typography.",
      "- Prepare the logo in the file formats needed for the website and other uses.",
      "- Keep the identity appropriate for the client's business.",
      "- Upload the work as a Branding deliverable (create one if it doesn't exist yet) and send it for client review.",
      "- Watch for client feedback. If changes are requested, upload a revised version and send that new version for review.",
      "- Repeat review/revise until the client approves a version. The approved version is the one to use across the website design.",
    ].join("\n"),
    "Before starting": "The accepted proposal should include branding/logo design. Any existing brand materials should be available, or missing items should already be flagged.",
    Deliverable: "A Branding deliverable with the logo and brand palette/typography reference, approved by the client through the existing file review workflow.",
    "Done when": "The client has approved a version of the Branding deliverable, and that approved version is ready for use across the website design.",
  }),
  "accessibility audit (ada/wcag)": sectioned({
    Objective: "Audit the staging website against WCAG 2.1 AA and document required fixes.",
    "What to do": [
      "- Review the staging website's structure, contrast, and keyboard navigation.",
      "- Check headings, alt text, form labels, and focus states.",
      "- Test with a screen reader or accessibility checker tool.",
      "- Document each issue found, with its WCAG criterion and severity.",
      "- Hand the list of required fixes to the PM.",
    ].join("\n"),
    "Before starting": "The accepted proposal should include an accessibility audit. Staging should be available.",
    Deliverable: "A documented list of WCAG 2.1 AA issues and recommended fixes.",
    "Done when": "The staging website has been audited and all findings are documented for the team to address.",
  }),
  "set up ad campaign": sectioned({
    Objective: "Set up the Google/Meta ad campaign included in the accepted proposal.",
    "What to do": [
      "- Confirm the ad platform(s), budget, and goals from the accepted proposal.",
      "- Set up or confirm access to the client's ad account.",
      "- Create the initial campaign structure, ad groups, and creative.",
      "- Use approved branding, copy, and destination links.",
      "- Confirm tracking/conversion setup where applicable.",
    ].join("\n"),
    "Before starting": "The accepted proposal should include ad campaign setup. Ad account access and creative assets should be available, or missing items should already be flagged.",
    Deliverable: "A live or ready-to-launch ad campaign matching the accepted proposal.",
    "Done when": "The campaign is set up, uses approved content, and is ready for the client to launch or approve.",
  }),
  "set up social media & content calendar": sectioned({
    Objective: "Set up social profiles and an initial content calendar included in the accepted proposal.",
    "What to do": [
      "- Confirm which social platforms are included in the accepted proposal.",
      "- Set up or confirm access to the client's social profiles.",
      "- Apply consistent branding, bio, and contact details across profiles.",
      "- Draft an initial content calendar covering the first weeks of posts.",
      "- Hand the calendar to the client/PM for review.",
    ].join("\n"),
    "Before starting": "The accepted proposal should include social media setup. Social account access and branding should be available, or missing items should already be flagged.",
    Deliverable: "Set-up social profiles and an initial content calendar.",
    "Done when": "Profiles are branded and consistent, and an initial content calendar is ready for review.",
  }),
};

function subjectAfterPrefix(title: string, prefix: string): string | null {
  if (!title.startsWith(prefix)) return null;
  return title.slice(prefix.length).trim() || null;
}

export function catalogInstructionsForTitle(title: string): string | null {
  const key = normalizeProductionTaskTitle(title);
  if (!key) return null;
  if (EXACT_INSTRUCTIONS[key]) return EXACT_INSTRUCTIONS[key];

  const writeSubject = subjectAfterPrefix(key, "write ");
  if (writeSubject && writeSubject.endsWith(" copy")) {
    return writePageInstructions(writeSubject.replace(/ copy$/, ""));
  }

  if (key.startsWith("design ") && key !== "design responsive/mobile layouts") {
    const page = subjectAfterPrefix(key, "design ");
    if (page) return designPageInstructions(page);
  }

  if (key.startsWith("build ")) {
    const page = subjectAfterPrefix(key, "build ");
    if (page) return buildPageInstructions(page);
  }

  const implementSubject = subjectAfterPrefix(key, "implement ");
  if (implementSubject && implementSubject !== "responsive layouts") {
    return implementFeatureInstructions(implementSubject);
  }

  for (const prefix of ["add ", "set up ", "install ", "connect "] as const) {
    const feature = subjectAfterPrefix(key, prefix);
    if (feature) return implementFeatureInstructions(feature);
  }

  if (key === "performance optimization" || key === "security setup") {
    return implementFeatureInstructions(key);
  }

  if (key.startsWith("test ") && key !== "test staging website" && key !== "test responsive layouts") {
    const feature = subjectAfterPrefix(key, "test ");
    if (feature) return testFeatureInstructions(feature);
  }

  return null;
}

export function isLegacyProductionDescription(description: string): boolean {
  const trimmed = description.trim();
  if (!trimmed) return true;
  if (LEGACY_PRODUCTION_DESCRIPTIONS.has(trimmed)) return true;
  if (/\bobjective\b/i.test(trimmed) || /\bdone when\b/i.test(trimmed)) return false;
  return trimmed.length < 160 && !trimmed.includes("\n");
}

export function displayTaskInstructionText(title: string, description: string): string {
  const stored = description.trim();
  if (stored && !isLegacyProductionDescription(stored)) return stored;
  return catalogInstructionsForTitle(title) ?? stored;
}

export function parseTaskInstructionSections(text: string): TaskInstructionSection[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const sections: TaskInstructionSection[] = [];
  let current: TaskInstructionSection = { heading: null, body: "" };

  const flush = () => {
    const body = current.body.replace(/^\n+|\n+$/g, "");
    if (current.heading || body) sections.push({ heading: current.heading, body });
  };

  for (const line of lines) {
    const heading = HEADING_LOOKUP.get(line.trim().toLowerCase());
    if (heading) {
      flush();
      current = { heading, body: "" };
      continue;
    }
    current.body = current.body ? `${current.body}\n${line}` : line;
  }
  flush();
  return sections;
}

export function hasTaskInstructionHeadings(text: string): boolean {
  return parseTaskInstructionSections(text).some((section) => section.heading);
}

export function taskInstructionPreview(title: string, description: string, maxLength = 140): string {
  const text = displayTaskInstructionText(title, description);
  if (!text) return "";
  const sections = parseTaskInstructionSections(text);
  const objective = sections.find((section) => section.heading === "Objective")?.body.trim();
  const source = (objective || sections[0]?.body || text).replace(/\s+/g, " ").trim();
  if (source.length <= maxLength) return source;
  return `${source.slice(0, maxLength - 1).trimEnd()}…`;
}
