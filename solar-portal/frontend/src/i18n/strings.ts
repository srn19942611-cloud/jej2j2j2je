import da from "./da.json";

// Typed accessor over the Danish string dictionary - components import `t` and reference
// e.g. t.fleet.title rather than inlining raw Danish literals, so wording review/fixes
// stay confined to da.json.
export const t = da;

export type Strings = typeof da;
