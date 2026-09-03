import type { Application } from "./types";

export interface Sample {
  id: string;
  title: string;
  image: string;
  /** What you should expect to see, for anyone trying the demo. */
  expect: string;
  application: Application;
}

export const SAMPLES: Sample[] = [
  {
    id: "riverstone",
    title: "Realistic bourbon label",
    image: "/samples/riverstone.jpg",
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
    id: "bourbon",
    title: "Bourbon, everything correct",
    image: "/samples/bourbon.png",
    expect: "Likely approve",
    application: {
      beverageType: "distilled_spirits",
      brandName: "Old Tom Distillery",
      classType: "Kentucky Straight Bourbon Whiskey",
      alcoholContent: "45% Alc./Vol. (90 Proof)",
      netContents: "750 mL",
      bottlerNameAddress: "Old Tom Distillery, Bardstown, Kentucky",
      countryOfOrigin: "",
    },
  },
  {
    id: "wine",
    title: "Wine, warning in title case",
    image: "/samples/wine.png",
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
    id: "beer",
    title: "Beer, alcohol content differs",
    image: "/samples/beer.png",
    expect: "Likely reject (5.5% on the application, 6.5% on the label)",
    application: {
      beverageType: "malt_beverage",
      brandName: "Riverbend Brewing",
      classType: "India Pale Ale",
      alcoholContent: "5.5% Alc./Vol.",
      netContents: "12 fl oz",
      bottlerNameAddress: "Riverbend Brewing Co., Portland, Oregon",
      countryOfOrigin: "",
    },
  },
  {
    id: "gin",
    title: "Imported gin, warning reworded",
    image: "/samples/gin.png",
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
