/**
 * A small but complete example context map, modelled on the conference event
 * planner from Kaiser's "Architecture for Flow" (Fig. 3.22). It exercises all
 * three subdomain types and several relationship patterns (upstream-downstream
 * with OHS/PL/ACL/CF roles, and a symmetric shared kernel). Ids are fixed so the
 * fixture serialises stably, and the map is valid under all semantic rules.
 */

import { DOCUMENT_VERSION } from "./types";
import type { CmDocument } from "./types";
import { SUBDOMAIN_TYPE_SPECS } from "./notation";

const size = (t: keyof typeof SUBDOMAIN_TYPE_SPECS) => ({ ...SUBDOMAIN_TYPE_SPECS[t].defaultSize });

export const SAMPLE_DOCUMENT: CmDocument = {
  version: DOCUMENT_VERSION,
  title: "Conference event planner — context map",
  contexts: [
    {
      id: "ctx_auth",
      label: "User Access",
      subdomainType: "generic",
      team: "Platform Team",
      description: "Registration and authentication for speakers and attendees.",
      position: { x: 40, y: 300 },
      size: size("generic"),
    },
    {
      id: "ctx_cfp",
      label: "CfP Management",
      subdomainType: "core",
      team: "Program Team",
      description: "Runs the call for papers and exposes the public submission API.",
      position: { x: 340, y: 120 },
      size: size("core"),
    },
    {
      id: "ctx_submission",
      label: "Submission Handling",
      subdomainType: "core",
      team: "Program Team",
      description: "Owns proposals once submitted; the hub other contexts integrate with.",
      position: { x: 640, y: 300 },
      size: size("core"),
    },
    {
      id: "ctx_evaluation",
      label: "Session Evaluation",
      subdomainType: "core",
      team: "Review Team",
      description: "Scoring and selection of submitted sessions.",
      position: { x: 960, y: 140 },
      size: size("core"),
    },
    {
      id: "ctx_schedule",
      label: "Schedule Management",
      subdomainType: "core",
      team: "Program Team",
      description: "Builds and publishes the conference schedule.",
      position: { x: 960, y: 440 },
      size: size("core"),
    },
    {
      id: "ctx_notification",
      label: "Notification Handling",
      subdomainType: "generic",
      team: "Platform Team",
      description: "Sends emails to speakers and attendees via a published language.",
      position: { x: 1280, y: 580 },
      size: size("generic"),
    },
  ],
  relationships: [
    {
      id: "rel_auth_cfp",
      from: "ctx_auth",
      to: "ctx_cfp",
      pattern: "upstream-downstream",
      upstreamRoles: ["OHS"],
      downstreamRoles: ["ACL"],
      label: "identity",
    },
    {
      id: "rel_cfp_submission",
      from: "ctx_cfp",
      to: "ctx_submission",
      pattern: "upstream-downstream",
      upstreamRoles: ["OHS"],
      downstreamRoles: ["ACL"],
      label: "CfP API",
      implementationTechnology: "RESTful HTTP",
    },
    {
      id: "rel_submission_evaluation",
      from: "ctx_submission",
      to: "ctx_evaluation",
      pattern: "upstream-downstream",
      upstreamRoles: ["OHS"],
      downstreamRoles: ["ACL"],
    },
    {
      id: "rel_submission_schedule",
      from: "ctx_submission",
      to: "ctx_schedule",
      pattern: "upstream-downstream",
      upstreamRoles: ["OHS"],
      downstreamRoles: ["ACL"],
    },
    {
      id: "rel_notification_schedule",
      from: "ctx_notification",
      to: "ctx_schedule",
      pattern: "upstream-downstream",
      upstreamRoles: ["OHS", "PL"],
      downstreamRoles: ["CF"],
      label: "notifications",
    },
    {
      id: "rel_evaluation_schedule",
      from: "ctx_evaluation",
      to: "ctx_schedule",
      pattern: "shared-kernel",
      label: "session model",
    },
  ],
};
