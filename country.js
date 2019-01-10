const fs = require('fs');
const path = require('path');

const puppeteer = require('puppeteer');
const _ = require('lodash');
const formatDate = require('date-fns/format');

const {
  countryPage,
  METRICS_OPTS,
  coerceMetric,
} = require('./constants/socialblade');
const COUNTRIES = require('./constants/countries');

const args = require('yargs').options({
  country: {
    alias: 'co',
    choices: COUNTRIES,
    coerce: c => _.toLower(c),
    demandOption: true,
    describe: 'the ISO-3161 alpha-2 country code to scrape on socialblade',
    string: true,
  },
  metric: {
    alias: 'm',
    choices: METRICS_OPTS,
    coerce: m => coerceMetric(m),
    demandOption: true,
    describe: 'the socialblade metric to scrape',
    string: true,
  },
  numThreads: {
    alias: 'nt',
    choices: [1, 5, 10, 15, 20, 25],
    demandOption: false,
    default: 10,
    describe: 'the number of threads that concurrently scrape socialblade',
    number: true,
  },
  top: {
    alias: 't',
    choices: _.range(1, 251, 1),
    demandOption: false,
    default: 100,
    describe: 'the top X countries to scrape',
    number: true,
  },
}).argv;

const GO_TO_OPTS = {
  waitUntil: ['networkidle2', 'domcontentloaded'],
};

// set up our final structure so we don't get any reference errors
const result = [];

// this function controls it all
(async () => {
  const now = Date.now();
  console.log(`Started | ${formatDate(now, 'hh:mm:ssa')}`);

  const { country, metric, numThreads, top } = args;

  console.log(
    `Country: ${country} | Metric: ${metric} | Top: ${top} | Threads: ${numThreads}`
  );

  const browser = await puppeteer.launch();

  try {
    const page = await browser.newPage();
    await page.goto(countryPage(country, metric), GO_TO_OPTS);

    const linkWrappers = await page.$$(
      "[style='float: left; width: 350px; line-height: 25px;']"
    );
    const linksPromises = _.map(linkWrappers, w => getHrefFromWrapper(w));
    const links = await Promise.all(linksPromises);
    const validLinks = await _.chain(links)
      .filter(l => !_.isNull(l))
      .slice(0, top)
      .value();

    await console.log(`Found ${validLinks.length} channels`);

    const chunkedLinks = _.chunk(
      validLinks,
      Math.ceil(validLinks.length / numThreads)
    );
    for (const chunk of chunkedLinks) {
      const chunkPromise = _.map(chunk, l => scrapeYouTubeURL(browser, l));
      await Promise.all(chunkPromise);
    }
  } catch (err) {
    console.log(`Failure: ${err.name} | ${err.message}`);
  }

  await browser.close();

  // write that final structure into a file
  const filePath = `${path.join(__dirname, 'data', 'country')}`;
  const fileName = `${country}_${metric}_top-${top}_${formatDate(
    now,
    'YYYY-MM-DDThh-mma'
  )}`;
  await fs.writeFileSync(
    `${filePath}/${fileName}.json`,
    JSON.stringify(result),
    { flag: 'w' }
  );

  console.log(
    `Finished | ${formatDate(
      Date.now(),
      'hh:mm:ssa'
    )} | ${filePath}/${fileName}.json`
  );
})();

async function scrapeYouTubeURL(browser, link) {
  try {
    const page = await browser.newPage();
    await page.goto(link, GO_TO_OPTS);

    const onSearchPage = _.some(_.split(page.url(), '/'), x => x === 'search');
    if (onSearchPage) {
      await page.waitForSelector(
        '[style="margin-left: 10px; font-size: 0.7em; color:#aaa;"]'
      );
      const channelID = await page.$eval(
        '[style="margin-left: 10px; font-size: 0.7em; color:#aaa;"]',
        node => node.innerText
      );
      // console.log(`Success | ${channelID}`);
      result.push(channelID);
    } else {
      await page.waitForSelector(
        'a.core-button.-margin.core-small-wide.ui-black'
      );
      const href = await page.$eval(
        'a.core-button.-margin.core-small-wide.ui-black',
        node => node.href
      );
      try {
        const decoded = decodeURI(href);
        const channelID = _.split(decoded, '/').slice(-1)[0];
        // console.log(`Success | ${channelID}`);
        result.push(channelID);
      } catch (err) {
        console.error(`Failure | ${link}`);
      }
    }

    await page.close();
  } catch (err) {
    console.error(`Failure | ${link}`);
  }
}

async function getHrefFromWrapper(wrapper) {
  const href = await wrapper.$eval('a', node => node.href);
  try {
    const decoded = decodeURI(href);
    return decoded;
  } catch (err) {
    console.error(`Failure | Malformed URI: ${href}`);
    return null;
  }
}
