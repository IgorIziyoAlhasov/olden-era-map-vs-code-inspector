export const categories = [
  ['dwellings', 'Dwellings', /^(?:barracks_|dwelling[_-])/],
  ['portals', 'Portals', /^portal(?:[_-]|$)/],
  ['resource-storage', 'Resource Storage', /^storage[_-]/],
  ['mines', 'Mines', /^mine[_-]/],
  ['altars-of-magic', 'Altars of Magic', /^altar_of_magic(?:_|$)/],
  ['magic-amplifiers', 'Magic Amplifiers', /^magic_amplifier(?:_|$)/],
  ['shrines', 'Shrines', /(?:^|_)shrine(?:_|$)/],
  ['unit-trade', 'Unit Trade', /^(?:random-hire|unit_trade)$/],
  ['campaign-only', 'Campaign-only', /^campaign[_-]/],
  ['adventure-sites', 'Adventure Sites', /^(?:arena|prison|dragon_utopia|windmill)$/],
  ['treasures-and-awards', 'Treasures & Awards', /^(?:random-item|chest|pandora_box|resource[_-].*|.*_artifact)$/],
  ['markets-and-trade', 'Markets & Trade', /^(?:market|marketplace|trading_post)(?:_|$)/],
  ['special', 'Special', /^(?:random-squad|random-hero|random-city|city-spawner)$/],
  ['other', 'Other', /./],
];

export function objectCategory(sid) {
  return categories.find(([, , pattern]) => pattern.test(sid))?.[0] ?? 'other';
}
