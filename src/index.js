'use strict';
import path from 'path';
import command from './helpers/cliHelper';
import limit from 'simple-rate-limiter';
import { getConfig } from './helpers/configHelper';
import { parseConfiguration } from './helpers/keboolaHelper';
import { size, includes, deburr, isUndefined } from 'lodash';
import {
  readFileContent,
  downloadDataForEntities,
  downloadPeersForEntities,
  downloadDetailsOfReviews,
  downloadReviewsOfEntities,
  downloadClusterMetricsById,
  downloadClusterMembersById,
  downloadClustersForEntities,
  downloadExtraEntityMetadata,
  downloadExpandedDataForEntities
} from './helpers/fedgerHelper';
import {
  CONFIG_FILE,
  PEERS_PREFIX,
  API_VERSION_2,
  API_VERSION_3,
  CONTACT_PREFIX,
  PROFILE_PREFIX,
  METRICS_PREFIX,
  REVIEWS_PREFIX,
  CLUSTERS_PREFIX,
  ENTITIES_PREFIX,
  LOCATION_PREFIX,
  SERVICES_PREFIX,
  COMPLETENESS_PREFIX,
  ENTITY_DETAILS_PREFIX,
  DEFAULT_TABLES_IN_DIR,
  CLUSTER_METRICS_PREFIX,
  CLUSTER_MEMBERS_PREFIX,
  DEFAULT_TABLES_OUT_DIR,
  REVIEWS_DETAILS_PREFIX,
  SUPPORTED_API_VERSIONS,
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
      pageSize,
      datasets,
      startPage,
      bucketName,
      apiVersion,
      incremental,
      maximalPage,
      inputFileName,
      inputFileType,
      numberOfRequestsPerMinute
    } = await parseConfiguration(getConfig(path.join(command.data, CONFIG_FILE)));
    // Prepare table directories.
    const tableInDir = path.join(command.data, DEFAULT_TABLES_IN_DIR);
    const tableOutDir = path.join(command.data, DEFAULT_TABLES_OUT_DIR);
    
    const request = limit(require("request")).to(numberOfRequestsPerMinute).per(60000);

    if (includes(datasets, ENTITIES_PREFIX) && includes(SUPPORTED_API_VERSIONS, apiVersion)) {
      const result = (isUndefined(inputFileType) || (inputFileType && inputFileType !== ENTITIES_PREFIX))
        ? await downloadDataForEntities(request, ENTITIES_PREFIX, tableOutDir, city, bucketName, apiKey, startPage, maximalPage, apiVersion, pageSize)
        : `Dataset ${ENTITIES_PREFIX} are going to be read from the input file!`;
      console.log(result);
    }

    // Following steps all depends on selected datasets.
    if (includes(datasets, ENTITY_METADATA_PREFIX) && includes(SUPPORTED_API_VERSIONS, apiVersion)) {
      const entities = await readFileContent({ prefix: ENTITIES_PREFIX, inputFileType, tableInDir, tableOutDir, inputFileName, city, apiVersion });
      const result = await downloadExtraEntityMetadata(request, ENTITY_METADATA_FILE_PREFIX, entities, tableOutDir, city, bucketName, apiKey, apiVersion);
      console.log(result);
    }

    if (includes(datasets, ENTITY_DETAILS_PREFIX) && includes(SUPPORTED_API_VERSIONS, apiVersion)) {
      const entities = await readFileContent({ prefix: ENTITIES_PREFIX, inputFileType, tableInDir, tableOutDir, inputFileName, city, apiVersion });
      const prefixes = [ LOCATION_PREFIX, CONTACT_PREFIX, PROFILE_PREFIX, METRICS_PREFIX, SERVICES_PREFIX, COMPLETENESS_PREFIX ];
      const result = await downloadExpandedDataForEntities(request, prefixes, entities, tableOutDir, city, bucketName, apiKey, apiVersion);
      console.log(result);
    }

    if (includes(datasets, CLUSTERS_PREFIX) && includes(SUPPORTED_API_VERSIONS, apiVersion)) {
      const entities = await readFileContent({ prefix: ENTITIES_PREFIX, inputFileType, tableInDir, tableOutDir, inputFileName, city, apiVersion });
      const result = (isUndefined(inputFileType) || (inputFileType && inputFileType !== CLUSTERS_PREFIX))
        ? await downloadClustersForEntities(request, CLUSTERS_PREFIX, entities, tableOutDir, city, bucketName, apiKey, apiVersion)
        : `Dataset ${CLUSTERS_PREFIX} are going to be read from the input file!`;
      console.log(result);
    }

    if (((inputFileType && inputFileType === CLUSTERS_PREFIX && includes(datasets, CLUSTER_METRICS_PREFIX)) || (includes(datasets, CLUSTERS_PREFIX) && includes(datasets, CLUSTER_METRICS_PREFIX))) && apiVersion === API_VERSION_3) {
      const clusters = await readFileContent({ prefix: CLUSTERS_PREFIX, inputFileType, tableInDir, tableOutDir, inputFileName, city, apiVersion });
      const result = await downloadClusterMetricsById(request, CLUSTER_METRICS_PREFIX, clusters, tableOutDir, city, bucketName, apiKey, apiVersion);
      console.log(result);
    }

    if (((inputFileType && inputFileType === CLUSTERS_PREFIX && includes(datasets, CLUSTER_MEMBERS_PREFIX)) || (includes(datasets, CLUSTERS_PREFIX) && includes(datasets, CLUSTER_MEMBERS_PREFIX))) && apiVersion === API_VERSION_3) {
      const clusters = await readFileContent({ prefix: CLUSTERS_PREFIX, inputFileType, tableInDir, tableOutDir, inputFileName, city, apiVersion });
      const result = await downloadClusterMembersById(request, CLUSTER_MEMBERS_PREFIX, clusters, tableOutDir, city, bucketName, apiKey, maximalPage, apiVersion, pageSize);
      console.log(result);
    }

    if (includes(datasets, PEERS_PREFIX) && includes(SUPPORTED_API_VERSIONS, apiVersion)) {
      const entities = await readFileContent({ prefix: ENTITIES_PREFIX, inputFileType, tableInDir, tableOutDir, inputFileName, city, apiVersion });
      const result = (isUndefined(inputFileType) || (inputFileType && inputFileType !== PEERS_PREFIX))
        ? await downloadPeersForEntities(request, PEERS_PREFIX, entities, tableOutDir, city, bucketName, apiKey, maximalPage, apiVersion, pageSize)
        : `Dataset ${PEERS_PREFIX} are going to be read from the input file!`;
      console.log(result);
    }

    if (includes(datasets, REVIEWS_PREFIX) && apiVersion === API_VERSION_3) {
      const entities = await readFileContent({ prefix: ENTITIES_PREFIX, inputFileType, tableInDir, tableOutDir, inputFileName, city, apiVersion });
      const result = (isUndefined(inputFileType) || (inputFileType && inputFileType !== REVIEWS_PREFIX))
        ? await downloadReviewsOfEntities(request, REVIEWS_PREFIX, entities, tableOutDir, city, bucketName, apiKey, apiVersion)
        : `Dataset ${REVIEWS_PREFIX} are going to be read from the input file!`;
      console.log(result);
    }

    if ((inputFileType && inputFileType === REVIEWS_PREFIX) || (includes(datasets, REVIEWS_PREFIX) && includes(datasets, REVIEWS_DETAILS_PREFIX)) && apiVersion === API_VERSION_3) {
      // First of all we need to read the content of the reviews file.
      const reviews = await readFileContent({ prefix: REVIEWS_PREFIX, inputFileType, tableInDir, tableOutDir, inputFileName, city, apiVersion });
      const result = await downloadDetailsOfReviews(request, REVIEWS_DETAILS_PREFIX, reviews, tableOutDir, city, bucketName, apiKey, apiVersion);
      console.log(result);
    }

    console.log('All data downloaded!');
    process.exit(0);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
})();
