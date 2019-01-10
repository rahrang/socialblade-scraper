const _ = require('lodash');

const MOST_SUBSCRIBED = 'mostsubscribed';
const MOST_VIEWED = 'mostviewed';

module.exports = {};

module.exports.METRICS_OPTS = [MOST_SUBSCRIBED, 'ms', MOST_VIEWED, 'mv'];
module.exports.coerceMetric = (m) => {
  if (_.includes([MOST_SUBSCRIBED, MOST_VIEWED], m)) return m;
  if (m === "ms") return MOST_SUBSCRIBED;
  if (m === "mv") return MOST_VIEWED;
  return null;
}

module.exports.CATEGORIES = [
  'animals',
  'autos',
  'comedy',
  'education',
  'entertainment',
  'film',
  'games',
  'howto',
  'music',
  'news',
  'nonprofit',
  'people',
  'shows',
  'sports',
  'tech',
  'travel',
];

module.exports.categoryPage = (category, metric) =>
  `https://socialblade.com/youtube/top/category/${category}/${metric}`;
module.exports.countryPage = (country, metric) =>
  `https://socialblade.com/youtube/top/country/${country}/${metric}`;
