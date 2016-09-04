'use strict';
import path from 'path';
import command from './helpers/cliHelper';
import { size, includes, deburr } from 'lodash';
import { getConfig } from './helpers/configHelper';
import { parseConfiguration } from './helpers/keboolaHelper';
import {
  readEntityFileContent,
  downloadDataForEntities,
  downloadPeersForEntities,
  downloadClustersForEntities,
  downloadExtraEntityMetadata,
  downloadExpandedDataForEntities
} from './helpers/fedgerHelper';
import {
  CONFIG_FILE,
  PEERS_PREFIX,
  CONTACT_PREFIX,
  PROFILE_PREFIX,
  METRICS_PREFIX,
  CLUSTERS_PREFIX,
  ENTITIES_PREFIX,
  LOCATION_PREFIX,
  SERVICES_PREFIX,
  COMPLETENESS_PREFIX,
  ENTITY_DETAILS_PREFIX,
  DEFAULT_TABLES_IN_DIR,
  DEFAULT_TABLES_OUT_DIR,
  ENTITY_METADATA_PREFIX,
  ENTITY_METADATA_FILE_PREFIX
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
      datasets,
      startPage,
      bucketName,
      apiVersion,
      incremental,
      maximalPage,
      inputFileName,
      readEntitiesFromFile
    } = await parseConfiguration(getConfig(path.join(command.data, CONFIG_FILE)));
    // Prepare table directories.
    const tableInDir = path.join(command.data, DEFAULT_TABLES_IN_DIR);
    const tableOutDir = path.join(command.data, DEFAULT_TABLES_OUT_DIR);
    // First of all, we need to check whether running of this component does make a sense.
    // If user select reading of the entity source data from the file, but the datasets array is empty,
    // we don't need to run the component, as no new data are going to be downloaded.
    if (readEntitiesFromFile && size(datasets) === 0) {
      console.log('Nothing to download! Please make sure the datasets array in the configuration contains some data and/or the readEntitiesFromFile attribute is set to false!');
      process.exit(0);
    }
    // If we do want to load the entities from the input, we can skip this step.
    if (!readEntitiesFromFile) {
      // Specification of the initial url.
      const result = await downloadDataForEntities(ENTITIES_PREFIX, tableOutDir, city, bucketName, apiKey, startPage, maximalPage, apiVersion);
      console.log(result);
    }
    // Next step is to load the content of the input (entities) file.
    // We are going to use the one downloaded from API recently
    // or the one selected in the input configuration.
    const entities = await readEntityFileContent({ prefix: ENTITIES_PREFIX, readEntitiesFromFile, tableInDir, tableOutDir, inputFileName, city, apiVersion });
    // Following steps all depends on selected datasets.
    if (includes(datasets, ENTITY_METADATA_PREFIX)) {
      const result = await downloadExtraEntityMetadata(ENTITY_METADATA_FILE_PREFIX, entities, tableOutDir, city, bucketName, apiKey, apiVersion);
      console.log(result);
    }

    if (includes(datasets, ENTITY_DETAILS_PREFIX)) {
      const prefixes = [ LOCATION_PREFIX, CONTACT_PREFIX, PROFILE_PREFIX, METRICS_PREFIX, SERVICES_PREFIX, COMPLETENESS_PREFIX ];
      const result = await downloadExpandedDataForEntities(prefixes, entities, tableOutDir, city, bucketName, apiKey, apiVersion);
      console.log(result);
    }

    if (includes(datasets, CLUSTERS_PREFIX)) {
      const result = await downloadClustersForEntities(CLUSTERS_PREFIX, entities, tableOutDir, city, bucketName, apiKey, apiVersion);
      console.log(result);
    }

    if (includes(datasets, PEERS_PREFIX)) {
      const result = await downloadPeersForEntities(PEERS_PREFIX, entities, tableOutDir, city, bucketName, apiKey, startPage, maximalPage, apiVersion)
      console.log(result);
    }
    console.log('All data downloaded!');
    process.exit(0);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
})();
