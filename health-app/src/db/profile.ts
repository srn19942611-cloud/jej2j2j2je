import { getJson, setJson } from './settings';

export type Sex = 'mand' | 'kvinde';

/** Det minimum, en energiberegning kræver. Alt andet kommer fra dine data. */
export type Profile = {
  heightCm: number;
  birthYear: number;
  sex: Sex;
};

export const PROFILE_KEY = 'profile';

export function getProfile(): Promise<Profile | null> {
  return getJson<Profile>(PROFILE_KEY);
}

export function saveProfile(p: Profile): Promise<void> {
  return setJson(PROFILE_KEY, p);
}
