// src/modules/insights/config/sample-size-gates.config.ts

export const SAMPLE_SIZE_GATES = {
  behavioral: {
    rage_click: {
      minEvents: 20,
      minSessions: 10,
    },
    exit_intent: {
      minEvents: 30,
      minSessions: 15,
    },
  },

  funnel: {
    step: {
      minEntered: 50,
    },
  },

  cohort: {
    perCohort: {
      minSessions: 30,
    },
  },

  engagement: {
    minSamples: 50,
  },

  time_visible: {
    minSamples: 50,
  },

  ctr: {
    minSamples: 50,
  },

  drop_off_rate: {
    minSamples: 30,
  },

  form_abandon_rate: {
    minSamples: 20,
  },

  form_completion_rate: {
    minSamples: 20,
  },

  form_error_rate: {
    minSamples: 20,
  },

  performance: {
    lcp: 30,
    inp: 30,
    cls: 30,
    ttfb: 30,
  },

  form: {
    minSamples: 20,
  },
} as const;
