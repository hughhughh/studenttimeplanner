/**
 * Gantt data for the assessment folio chart.
 * Day marks: scheduled (yellow), done/completed (blue), both (green).
 * Source tasks: Software Engineering Term 3 Project checklist
 * (docs/Notification/…/Software Engineering Term 3 Project checklist).
 */

export type GanttDayMark = "scheduled" | "done" | "both";

export type GanttTask = {
  id: string;
  section: string;
  name: string;
  /** Sparse map of YYYY-MM-DD → mark (planned / actual / both). */
  days: Record<string, GanttDayMark>;
};

/** Chart window: Thursday 26 Feb 2026 → Friday 24 Jul 2026 */
export const GANTT_START = "2026-02-26";
export const GANTT_END = "2026-07-24";

/**
 * Checklist rows with planned / completed day marks.
 */
export const GANTT_TASKS: GanttTask[] = [
  {
    "id": "problem-def",
    "section": "Identifying & Defining the Problem",
    "name": "Problem Definition",
    "days": {
      "2026-02-27": "both",
      "2026-04-29": "done",
      "2026-07-22": "done",
      "2026-07-23": "done"
    }
  },
  {
    "id": "fr",
    "section": "Identifying & Defining the Problem",
    "name": "Functional requirements",
    "days": {
      "2026-02-27": "both",
      "2026-04-24": "done",
      "2026-04-29": "done",
      "2026-07-22": "done",
      "2026-07-23": "done"
    }
  },
  {
    "id": "nfr",
    "section": "Identifying & Defining the Problem",
    "name": "Non-functional requirements",
    "days": {
      "2026-02-27": "both",
      "2026-04-24": "done",
      "2026-04-29": "done",
      "2026-07-22": "done",
      "2026-07-23": "done"
    }
  },
  {
    "id": "storyboard",
    "section": "Identifying & Defining the Problem",
    "name": "Storyboard",
    "days": {
      "2026-02-27": "done",
      "2026-04-29": "done",
      "2026-07-22": "done",
      "2026-07-23": "done"
    }
  },
  {
    "id": "financial",
    "section": "Identifying & Defining the Problem",
    "name": "Financial Feasibility",
    "days": {
      "2026-04-06": "scheduled",
      "2026-07-22": "done",
      "2026-07-23": "done"
    }
  },
  {
    "id": "dfd",
    "section": "Identifying & Defining the Problem",
    "name": "Dataflow Diagram (DFD)",
    "days": {
      "2026-04-06": "scheduled",
      "2026-07-22": "done",
      "2026-07-23": "done"
    }
  },
  {
    "id": "data-dict",
    "section": "Identifying & Defining the Problem",
    "name": "Data Dictionary",
    "days": {
      "2026-04-07": "scheduled",
      "2026-07-22": "done",
      "2026-07-23": "done"
    }
  },
  {
    "id": "uml",
    "section": "Identifying & Defining the Problem",
    "name": "UML Class diagram",
    "days": {
      "2026-04-07": "scheduled",
      "2026-07-22": "done",
      "2026-07-23": "done"
    }
  },
  {
    "id": "er",
    "section": "Identifying & Defining the Problem",
    "name": "ER Diagram",
    "days": {
      "2026-04-07": "scheduled",
      "2026-07-22": "done",
      "2026-07-23": "done"
    }
  },
  {
    "id": "approach",
    "section": "Research & Selection of Development Approach",
    "name": "Research and Selection of Development Approach",
    "days": {
      "2026-02-27": "scheduled",
      "2026-07-22": "done",
      "2026-07-23": "done"
    }
  },
  {
    "id": "gantt",
    "section": "Project Management & Scheduling",
    "name": "Gantt chart",
    "days": {
      "2026-02-26": "done",
      "2026-07-22": "done",
      "2026-07-23": "done"
    }
  },
  {
    "id": "diary",
    "section": "Project Management & Scheduling",
    "name": "Project Diary",
    "days": {
      "2026-07-22": "done",
      "2026-07-23": "done"
    }
  },
  {
    "id": "ethics",
    "section": "Project Management & Scheduling",
    "name": "Social, Ethical & Stakeholder Considerations",
    "days": {
      "2026-04-06": "scheduled",
      "2026-07-22": "done",
      "2026-07-23": "done"
    }
  },
  {
    "id": "algorithm",
    "section": "Producing & Implementing the Solution",
    "name": "Solution Implementation (Coding)",
    "days": {
      "2026-04-08": "scheduled",
      "2026-04-09": "scheduled",
      "2026-04-10": "scheduled",
      "2026-04-11": "scheduled",
      "2026-04-12": "scheduled",
      "2026-04-13": "scheduled",
      "2026-04-14": "scheduled",
      "2026-04-15": "scheduled",
      "2026-04-16": "scheduled",
      "2026-05-07": "done",
      "2026-05-08": "done",
      "2026-05-11": "done",
      "2026-05-12": "done",
      "2026-05-13": "done",
      "2026-06-30": "done",
      "2026-07-22": "done",
      "2026-07-23": "done"
    }
  },
  {
    "id": "versions",
    "section": "Producing & Implementing the Solution",
    "name": "Testing",
    "days": {
      "2026-04-08": "scheduled",
      "2026-04-09": "scheduled",
      "2026-04-10": "scheduled",
      "2026-04-11": "scheduled",
      "2026-04-13": "scheduled",
      "2026-04-14": "scheduled",
      "2026-04-15": "scheduled",
      "2026-04-16": "scheduled",
      "2026-04-12": "scheduled",
      "2026-05-07": "done",
      "2026-05-08": "done",
      "2026-05-11": "done",
      "2026-05-12": "done",
      "2026-05-13": "done",
      "2026-06-30": "done",
      "2026-07-22": "done",
      "2026-07-23": "done"
    }
  },
  {
    "id": "testing",
    "section": "Producing & Implementing the Solution",
    "name": "Evaluation",
    "days": {
      "2026-04-15": "scheduled",
      "2026-04-16": "scheduled",
      "2026-07-22": "done",
      "2026-07-23": "done"
    }
  }
];
