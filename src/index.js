'use strict';
import path from 'path';
import command from './helpers/cliHelper';
import limit from 'simple-rate-limiter';
import { getConfig } from './helpers/configHelper';
import { parseConfiguration } from './helpers/keboolaHelper';
import { size, includes, deburr, isUndefined } from 'lodash';
import {
  readFileContent,
  downloadEntityById,
  downloadEntityTeams,
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
  ALL_DATASETS,
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
  ENTITY_TEAM_PREFIX,
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

(async() => {
  try {
    // Reading the input configuration.
    const {
      city,
      apiKey,
      pageSize,
      datasets,
      startPage,
      timestamp,
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

    if (includes(datasets, ALL_DATASETS)) {
      const entities = await readFileContent({ prefix: ALL_DATASETS, inputFileType: ALL_DATASETS, tableInDir, tableOutDir, inputFileName, city, apiVersion });
      // entities
      const entitiesDownload = await downloadEntityById(request, entities, tableOutDir, bucketName, ENTITIES_PREFIX, city, apiVersion, apiKey, timestamp);
      // entities metadata
      const entitiesMetadataDownload = await downloadExtraEntityMetadata(request, ENTITY_METADATA_FILE_PREFIX, entities, tableOutDir, city, bucketName, apiKey, apiVersion, timestamp);
      const prefixes = [ LOCATION_PREFIX, CONTACT_PREFIX, PROFILE_PREFIX, METRICS_PREFIX, SERVICES_PREFIX, COMPLETENESS_PREFIX ];
      // entities expanded
      const entitiesExpandedDownload = await downloadExpandedDataForEntities(request, prefixes, entities, tableOutDir, city, bucketName, apiKey, apiVersion, timestamp);
      // entities team
      const entitiesTeamDownload = await downloadEntityTeams(request, ENTITY_TEAM_PREFIX, entities, tableOutDir, city, bucketName, apiKey, apiVersion, timestamp);
      // clusters
      const clustersDownload = await downloadClustersForEntities(request, CLUSTERS_PREFIX, entities, tableOutDir, city, bucketName, apiKey, apiVersion, timestamp);
      const clusters = await readFileContent({ prefix: CLUSTERS_PREFIX, tableOutDir, city, apiVersion });
      // downloadClusterMetricsById
      const clustersMetricsByIdDownload = await downloadClusterMetricsById(request, CLUSTER_METRICS_PREFIX, clusters, tableOutDir, city, bucketName, apiKey, apiVersion, timestamp);
      // downloadClusterMembersById
      const clusterMembersByIdDownload = await downloadClusterMembersById(request, CLUSTER_MEMBERS_PREFIX, clusters, tableOutDir, city, bucketName, apiKey, maximalPage, apiVersion, pageSize, timestamp);
      // peers for entities
      const peersForEntitiesDownload = await downloadPeersForEntities(request, PEERS_PREFIX, entities, tableOutDir, city, bucketName, apiKey, maximalPage, apiVersion, pageSize, timestamp);
      // reviews of entities
      const reviewsOfEntitiesDownload = await downloadReviewsOfEntities(request, REVIEWS_PREFIX, entities, tableOutDir, city, bucketName, apiKey, apiVersion, timestamp);
      const reviews = await readFileContent({ prefix: REVIEWS_PREFIX, tableOutDir, city, apiVersion });
      // reviews details
      const reviewsDetailsDownload = await downloadDetailsOfReviews(request, REVIEWS_DETAILS_PREFIX, reviews, tableOutDir, city, bucketName, apiKey, apiVersion, timestamp);
    } else {
      if (includes(datasets, ENTITIES_PREFIX) && includes(SUPPORTED_API_VERSIONS, apiVersion)) {
        const result = (isUndefined(inputFileType) || (inputFileType && inputFileType !== ENTITIES_PREFIX))
          ? await downloadDataForEntities(request, ENTITIES_PREFIX, tableOutDir, city, bucketName, apiKey, startPage, maximalPage, apiVersion, pageSize, timestamp)
          : `Dataset ${ENTITIES_PREFIX} are going to be read from the input file!`;
        console.log(result);
      }

      // Following steps all depends on selected datasets.
      if (includes(datasets, ENTITY_METADATA_PREFIX) && includes(SUPPORTED_API_VERSIONS, apiVersion)) {
        const entities = await readFileContent({ prefix: ENTITIES_PREFIX, inputFileType, tableInDir, tableOutDir, inputFileName, city, apiVersion });
        const result = await downloadExtraEntityMetadata(request, ENTITY_METADATA_FILE_PREFIX, entities, tableOutDir, city, bucketName, apiKey, apiVersion, timestamp);
        console.log(result);
      }

      if (includes(datasets, ENTITY_DETAILS_PREFIX) && includes(SUPPORTED_API_VERSIONS, apiVersion)) {
        const entities = await readFileContent({ prefix: ENTITIES_PREFIX, inputFileType, tableInDir, tableOutDir, inputFileName, city, apiVersion });
        const prefixes = [ LOCATION_PREFIX, CONTACT_PREFIX, PROFILE_PREFIX, METRICS_PREFIX, SERVICES_PREFIX, COMPLETENESS_PREFIX ];
        const result = await downloadExpandedDataForEntities(request, prefixes, entities, tableOutDir, city, bucketName, apiKey, apiVersion, timestamp);
        console.log(result);
      }

      if (includes(datasets, ENTITY_TEAM_PREFIX) && apiVersion === API_VERSION_3) {
        const entities = await readFileContent({ prefix: ENTITIES_PREFIX, inputFileType, tableInDir, tableOutDir, inputFileName, city, apiVersion });
        const result =  downloadEntityTeams(request, ENTITY_TEAM_PREFIX, entities, tableOutDir, city, bucketName, apiKey, apiVersion, timestamp);
        console.log(result);
      }

      if (includes(datasets, CLUSTERS_PREFIX) && includes(SUPPORTED_API_VERSIONS, apiVersion)) {
        const entities = await readFileContent({ prefix: ENTITIES_PREFIX, inputFileType, tableInDir, tableOutDir, inputFileName, city, apiVersion });
        const result = (isUndefined(inputFileType) || (inputFileType && inputFileType !== CLUSTERS_PREFIX))
          ? await downloadClustersForEntities(request, CLUSTERS_PREFIX, entities, tableOutDir, city, bucketName, apiKey, apiVersion, timestamp)
          : `Dataset ${CLUSTERS_PREFIX} are going to be read from the input file!`;
        console.log(result);
      }

      if (((inputFileType && inputFileType === CLUSTERS_PREFIX && includes(datasets, CLUSTER_METRICS_PREFIX)) || (includes(datasets, CLUSTERS_PREFIX) && includes(datasets, CLUSTER_METRICS_PREFIX))) && apiVersion === API_VERSION_3) {
        const clusters = await readFileContent({ prefix: CLUSTERS_PREFIX, inputFileType, tableInDir, tableOutDir, inputFileName, city, apiVersion });
        const result = await downloadClusterMetricsById(request, CLUSTER_METRICS_PREFIX, clusters, tableOutDir, city, bucketName, apiKey, apiVersion, timestamp);
        console.log(result);
      }

      if (((inputFileType && inputFileType === CLUSTERS_PREFIX && includes(datasets, CLUSTER_MEMBERS_PREFIX)) || (includes(datasets, CLUSTERS_PREFIX) && includes(datasets, CLUSTER_MEMBERS_PREFIX))) && apiVersion === API_VERSION_3) {
        const clusters = await readFileContent({ prefix: CLUSTERS_PREFIX, inputFileType, tableInDir, tableOutDir, inputFileName, city, apiVersion });
        const result = await downloadClusterMembersById(request, CLUSTER_MEMBERS_PREFIX, clusters, tableOutDir, city, bucketName, apiKey, maximalPage, apiVersion, pageSize, timestamp);
        console.log(result);
      }

      if (includes(datasets, PEERS_PREFIX) && includes(SUPPORTED_API_VERSIONS, apiVersion)) {
        const entities = await readFileContent({ prefix: ENTITIES_PREFIX, inputFileType, tableInDir, tableOutDir, inputFileName, city, apiVersion });
        const result = (isUndefined(inputFileType) || (inputFileType && inputFileType !== PEERS_PREFIX))
          ? await downloadPeersForEntities(request, PEERS_PREFIX, entities, tableOutDir, city, bucketName, apiKey, maximalPage, apiVersion, pageSize, timestamp)
          : `Dataset ${PEERS_PREFIX} are going to be read from the input file!`;
        console.log(result);
      }

      if (includes(datasets, REVIEWS_PREFIX) && apiVersion === API_VERSION_3) {
        const entities = await readFileContent({ prefix: ENTITIES_PREFIX, inputFileType, tableInDir, tableOutDir, inputFileName, city, apiVersion });
        const result = (isUndefined(inputFileType) || (inputFileType && inputFileType !== REVIEWS_PREFIX))
          ? await downloadReviewsOfEntities(request, REVIEWS_PREFIX, entities, tableOutDir, city, bucketName, apiKey, apiVersion, timestamp)
          : `Dataset ${REVIEWS_PREFIX} are going to be read from the input file!`;
        console.log(result);
      }

      if ((inputFileType && inputFileType === REVIEWS_PREFIX) || (includes(datasets, REVIEWS_PREFIX) && includes(datasets, REVIEWS_DETAILS_PREFIX)) && apiVersion === API_VERSION_3) {
        // First of all we need to read the content of the reviews file.
        const reviews = await readFileContent({ prefix: REVIEWS_PREFIX, inputFileType, tableInDir, tableOutDir, inputFileName, city, apiVersion });
        const result = await downloadDetailsOfReviews(request, REVIEWS_DETAILS_PREFIX, reviews, tableOutDir, city, bucketName, apiKey, apiVersion, timestamp);
        console.log(result);
      }
    }

    console.log('All data downloaded!');
    process.exit(0);
  } catch (error) {
    console.log(error);
    process.exit(1);
  }
})();
