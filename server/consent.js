import { createHash } from 'node:crypto';

const sha256 = text => createHash('sha256').update(text).digest('hex');

// Bump CONSENT_VERSION whenever CONSENT_TEXT changes; players on an older version are asked again.
export const CONSENT_VERSION = 'hunch-research-v2';
export const BUYER_CATEGORIES = ['consumer brands', 'retailers', 'market-research and marketing agencies'];
export const CONSENT_TEXT = [
  'I am 18 or older.',
  'I agree that Hunch may use my price guesses, my optional "most I\'d pay" and "too cheap to trust" answers, and how long I take to answer, in aggregate price-perception reports (Hunch Insights).',
  `Hunch sells these reports to ${BUYER_CATEGORIES.join(', ')}.`,
  'After opting in I may be asked four optional profile questions, once: age band, gender, region and how often I shop online. Each has "prefer not to say".',
  'Reports never include my name, room code or individual answers. They only show groups of at least 5 people, or 10 for breakdowns such as age band.',
  'I can play without opting in. If I withdraw in Profile, my research answers and profile are deleted and drop out of reports when they next refresh. Reports already downloaded cannot be recalled.',
].join(' ');
export const CONSENT_TEXT_HASH = sha256(CONSENT_TEXT);

// The opt-in shown before the rename. Imported consents keep this version so those players are re-asked.
export const LEGACY_CONSENT_VERSION = 'pricing-research-v1';
export const LEGACY_CONSENT_TEXT_HASH = sha256('Allow your guesses and optional maximum-pay answers to be used in aggregate pricing reports that may be sold to companies. Reports exclude names and room codes. You can play without opting in, and withdraw in Profile to exclude your data from future reports. Previously downloaded reports cannot be recalled.');

// Banded, optional profile answers. 'na' records "prefer not to say".
export const PROFILE_OPTIONS = {
  ageBand: ['18-24', '25-34', '35-44', '45-54', '55-64', '65+', 'na'],
  gender: ['woman', 'man', 'non-binary', 'self-described', 'na'],
  region: ['Central', 'East', 'North', 'North-East', 'West', 'Outside Singapore', 'na'],
  shopsOnlineFreq: ['weekly', 'monthly', 'few-times-a-year', 'rarely', 'na'],
};
