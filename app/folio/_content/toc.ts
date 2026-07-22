export const FOLIO_SECTIONS = [
  { id: "problem", title: "Problem definition" },
  { id: "functional", title: "Functional requirements" },
  { id: "non-functional", title: "Non-functional requirements" },
  { id: "storyboard", title: "Storyboard" },
  { id: "financial", title: "Financial feasibility" },
  { id: "dfd", title: "Dataflow diagram" },
  { id: "data-dictionary", title: "Data dictionary" },
  { id: "uml", title: "UML class diagram" },
  { id: "er", title: "ER diagram" },
  { id: "approach", title: "Development approach" },
  { id: "gantt", title: "Gantt chart" },
  { id: "diary", title: "Project diary" },
  { id: "ethics", title: "Social, ethical & stakeholders" },
  { id: "algorithm", title: "Algorithm solution" },
  { id: "versions", title: "Version sequence" },
  { id: "prototyping", title: "Prototyping sequence" },
  { id: "testing", title: "Testing & evaluation" },
] as const;

export type FolioSectionId = (typeof FOLIO_SECTIONS)[number]["id"];
