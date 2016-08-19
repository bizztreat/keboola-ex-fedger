'use strict';
import path from 'path';
import command from './helpers/cliHelper';
import {
  getConfig
} from './helpers/configHelper';
import {
  getTableName,
  parseConfiguration
} from './helpers/keboolaHelper';
import {
  getUrl,
  fetchData,
  createOutputFile,
  createManifestFile,
  readEntityFileContent
} from './helpers/fedgerHelper';
import {
  CONFIG_FILE,
  CONTACT_PREFIX,
  PROFILE_PREFIX,
  METRICS_PREFIX,
  ENTITIES_PREFIX,
  LOCATION_PREFIX,
  FEDGER_API_BASE_URL,
  DEFAULT_TABLES_IN_DIR,
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
      bucketName,
      inputFileName,
      readEntitiesFromFile,
      stopAfterReachingPage
    } = await parseConfiguration(getConfig(path.join(command.data, CONFIG_FILE)));

    // Prepare table directories.
    const tableInDir = path.join(command.data, DEFAULT_TABLES_IN_DIR);
    const tableOutDir = path.join(command.data, DEFAULT_TABLES_OUT_DIR);
    // It is going to be always a full upload.
    const incremental = false;
    // If we do want to load the entities from the input, we can skip this step.
    if (!readEntitiesFromFile) {
      // Specification of the initial url.
      const init = `/v0.2/entity/search?page=1&limit=10&city=${encodeURIComponent(city.toLowerCase())}`;
      let hasMoreRecords = false;
      const tableName = getTableName(ENTITIES_PREFIX, city);
      const destination = `${bucketName}.${tableName}`;
      const fileName = `${tableOutDir}/${tableName}.csv`;
      do {
        let { hasMore, next, data, page } = await fetchData(getUrl(FEDGER_API_BASE_URL, init, next, apiKey));
        const result = await createOutputFile(fileName, data);
        hasMoreRecords = stopAfterReachingPage && stopAfterReachingPage === page ? false : hasMore;
      } while (hasMoreRecords);
      // If data is successfully downloaded, we can create a manifest file.
      const manifest = await createManifestFile(`${fileName}.manifest`, { destination, incremental });
      console.log(`Data for '${city}' downloaded and stored in '${destination}'!`);
    }
    // Another steps is to read the complete dataset of entities,
    // either from dataset that had been downloaded
    // or input file specified in the configuration.
    const fileName = readEntitiesFromFile
      ? `${tableInDir}/${inputFileName}`
      : `${tableOutDir}/${getTableName(ENTITIES_PREFIX, city)}.csv`;
    // Read a list of entities ids.
    const entities = await readEntityFileContent(fileName);
    const expand = [ LOCATION_PREFIX, CONTACT_PREFIX, PROFILE_PREFIX, METRICS_PREFIX ].join(',');
    // We need to prepare tablesName.
    const locationTableName = getTableName(LOCATION_PREFIX, city);
    const locationDestination = `${bucketName}.${locationTableName}`;
    const locationFileName = `${tableOutDir}/${locationTableName}.csv`;
    const contactTableName = getTableName(CONTACT_PREFIX, city);
    const contactDestination = `${bucketName}.${contactTableName}`;
    const contactFileName = `${tableOutDir}/${contactTableName}.csv`;
    const profileTableName = getTableName(PROFILE_PREFIX, city);
    const profileDestination = `${bucketName}.${profileTableName}`;
    const profileFileName = `${tableOutDir}/${profileTableName}.csv`;
    const metricsTableName = getTableName(METRICS_PREFIX, city);
    const metricsDestination = `${bucketName}.${metricsTableName}`;
    const metricsFileName = `${tableOutDir}/${metricsTableName}.csv`;
    for (const entityId of entities) {
      const next = `/v0.2/entity/${entityId}?expand=${encodeURIComponent(expand)}`
      const { location, contact, profile, metrics } = await fetchData(getUrl(FEDGER_API_BASE_URL, '', next, apiKey));
      const locationResult = await createOutputFile(locationFileName, [ location ]);
      const contactResult = await createOutputFile(contactFileName, [ contact ]);
      const profileResult = await createOutputFile(profileFileName, [ profile ]);
      const metricsResult = await createOutputFile(metricsFileName, [ metrics ]);
    }
    // Create manifest files as well.
    const locationManifest = await createManifestFile(`${locationFileName}.manifest`, { destination: locationDestination, incremental });
    const contactManifest = await createManifestFile(`${contactFileName}.manifest`, { destination: contactDestination, incremental });
    const profileManifest = await createManifestFile(`${profileFileName}.manifest`, { destination: profileDestination, incremental });
    const metricsManifest = await createManifestFile(`${metricsFileName}.manifest`, { destination: metricsDestination, incremental });
    console.log(`Expanded city details downloaded!`);

    process.exit(0);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
})();
