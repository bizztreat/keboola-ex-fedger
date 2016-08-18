'use strict';
import path from 'path';
import command from './helpers/cliHelper';
import {
  getConfig
} from './helpers/configHelper';
import {
  parseConfiguration
} from './helpers/keboolaHelper';
import {
  getUrl,
  fetchData,
  createOutputFile
} from './helpers/fedgerHelper';
import {
  CONFIG_FILE,
  FEDGER_API_BASE_URL,
  DEFAULT_TABLES_OUT_DIR
} from './constants';

/**
 * This is the main part of the program.
 */
(async() => {
  try {
    // Reading the input configuration.
    const {
      city,
      apiKey,
      stopAfterReachPage
    } = await parseConfiguration(getConfig(path.join(command.data, CONFIG_FILE)));
    // Specification of the initial url.
    const init = `/v0.2/entity/search?page=1&limit=10&city=${encodeURIComponent(city.toLowerCase())}`;
    let hasMoreRecords = true;
    do {
      let { hasMore, next, data, page } = await fetchData(getUrl(FEDGER_API_BASE_URL, init, next, apiKey));
      const result = await createOutputFile(`${path.join(command.data, DEFAULT_TABLES_OUT_DIR)}/EntityTest.csv`, data, page);
      hasMoreRecords = stopAfterReachPage && stopAfterReachPage === page ? false : hasMore;
    } while (hasMoreRecords);
    console.log(`Data for '${city}' downloaded!`);
    process.exit(0);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
})();
