import type { Application } from "./types";

export interface Sample {
  id: string;
  title: string;
  image: string;
  /**
   * "realistic" pictures are the ones in the downloadable test kit: flat
   * artwork and photographs of bottles and a can. "made_up" labels are flat
   * renders with a deliberate government-warning fault, kept because the
   * realistic set has no warning problems to show.
   */
  kind: "realistic" | "made_up";
  /** What you should expect to see, for anyone trying the demo. */
  expect: string;
  application: Application;
}

export const SAMPLE_GROUPS: { kind: Sample["kind"]; title: string }[] = [
  { kind: "realistic", title: "Realistic labels" },
  { kind: "made_up", title: "Made-up labels with warning faults" },
];

export const SAMPLES: Sample[] = [
  {
    id: "riverstone",
    title: "Bourbon label, everything correct",
    image: "/samples/riverstone-bourbon-label.jpg",
    kind: "realistic",
    expect: "Likely approve",
    application: {
      beverageType: "distilled_spirits",
      brandName: "Riverstone Distilling Co.",
      classType: "Bourbon Whiskey",
      alcoholContent: "45% Alc./Vol.",
      netContents: "750 mL",
      bottlerNameAddress: "Riverstone Distilling Co., Louisville, Kentucky",
      countryOfOrigin: "",
    },
  },
  {
    id: "pinot-label",
    title: "Pinot Noir label, everything correct",
    image: "/samples/blue-orchard-pinot-noir-label.jpg",
    kind: "realistic",
    expect: "Likely approve",
    application: {
      beverageType: "wine",
      brandName: "Blue Orchard Cellars",
      classType: "Reserve Pinot Noir",
      alcoholContent: "13.5% Alc./Vol.",
      netContents: "750 mL",
      bottlerNameAddress: "Blue Orchard Cellars, Napa, California",
      countryOfOrigin: "",
    },
  },
  {
    id: "gin-label",
    title: "Gin label, class written more briefly",
    image: "/samples/crescent-harbor-gin-label.jpg",
    kind: "realistic",
    expect: "Needs review (application says Gin, label says Dry Gin)",
    application: {
      beverageType: "distilled_spirits",
      brandName: "Crescent Harbor Distilling Co.",
      classType: "Gin",
      alcoholContent: "42% Alc./Vol. (84 Proof)",
      netContents: "750 mL",
      bottlerNameAddress: "Crescent Harbor Distilling Co., Portland, Maine",
      countryOfOrigin: "United States",
    },
  },
  {
    id: "ipa-can",
    title: "Beer can photo, beer name under the brand",
    image: "/samples/pine-coast-harbor-haze-can.jpg",
    kind: "realistic",
    expect: "Needs review (the can prints the beer name under the brewery name, so confirm the brand)",
    application: {
      beverageType: "malt_beverage",
      brandName: "Pine Coast Brewing Co.",
      classType: "Hazy India Pale Ale",
      alcoholContent: "6.5% Alc./Vol.",
      netContents: "12 fl oz",
      bottlerNameAddress: "Pine Coast Brewing Co., Portland, Maine",
      countryOfOrigin: "",
    },
  },
  {
    id: "gin-bottle",
    title: "Gin bottle photo, net contents wrong",
    image: "/samples/crescent-harbor-gin-bottle.jpg",
    kind: "realistic",
    expect: "Likely reject (application says 1 L, bottle says 750 mL)",
    application: {
      beverageType: "distilled_spirits",
      brandName: "Crescent Harbor Distilling Co.",
      classType: "Dry Gin",
      alcoholContent: "42% Alc./Vol.",
      netContents: "1 L",
      bottlerNameAddress: "Crescent Harbor Distilling Co., Portland, Maine",
      countryOfOrigin: "",
    },
  },
  {
    id: "pinot-bottle",
    title: "Pinot Noir bottle photo, alcohol content wrong",
    image: "/samples/blue-orchard-pinot-noir-bottle.jpg",
    kind: "realistic",
    expect: "Likely reject (application says 14.5%, bottle says 13.5%)",
    application: {
      beverageType: "wine",
      brandName: "Blue Orchard Cellars",
      classType: "Reserve Pinot Noir",
      alcoholContent: "14.5% Alc./Vol.",
      netContents: "750 mL",
      bottlerNameAddress: "Blue Orchard Cellars, Napa, California",
      countryOfOrigin: "",
    },
  },
  {
    id: "wine",
    title: "Wine, warning heading in title case",
    image: "/samples/wine.png",
    kind: "made_up",
    expect: "Likely reject (heading not in capitals)",
    application: {
      beverageType: "wine",
      brandName: "Stone's Throw",
      classType: "Cabernet Sauvignon",
      alcoholContent: "13.5% Alc. by Vol.",
      netContents: "750 mL",
      bottlerNameAddress: "Stone's Throw Vineyards, Paso Robles, California",
      countryOfOrigin: "",
    },
  },
  {
    id: "gin",
    title: "Imported gin, warning reworded",
    image: "/samples/gin.png",
    kind: "made_up",
    expect: "Likely reject (wording differs), with the changed words highlighted",
    application: {
      beverageType: "distilled_spirits",
      brandName: "Harbour Light",
      classType: "London Dry Gin",
      alcoholContent: "47% Alc./Vol. (94 Proof)",
      netContents: "700 mL",
      bottlerNameAddress: "Imported by Northgate Imports, Baltimore, Maryland",
      countryOfOrigin: "United Kingdom",
    },
  },
];
