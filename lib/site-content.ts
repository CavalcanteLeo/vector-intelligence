export const services = [
  {
    id: "engineering",
    title: "Software engineering",
    summary: "Design and build software that fits the way your business works.",
    detail:
      "From a new digital product to the systems behind it, we turn requirements into reliable, maintainable software.",
    points: ["Product development", "Platforms and APIs", "Engineering quality"],
  },
  {
    id: "modernization",
    title: "Modernization",
    summary: "Make existing systems easier to change and ready for what comes next.",
    detail:
      "Understand the constraints in your current stack, reduce friction, and modernize in deliberate steps.",
    points: ["Architecture review", "Legacy evolution", "Cloud foundations"],
  },
  {
    id: "ai",
    title: "AI & agents",
    summary: "Put AI inside useful workflows, with people and controls in the loop.",
    detail:
      "Explore where models and agents can help, then build the integrations, evaluations, and safeguards that make them useful.",
    points: ["AI integration", "Agent workflows", "Evaluation and oversight"],
  },
] as const;

export type ServiceId = (typeof services)[number]["id"];
