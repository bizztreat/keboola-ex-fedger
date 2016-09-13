// This file contains default constants of the application.
export const FEDGER_API_BASE_URL = 'https://chef.fedger.io';
export const CONFIG_FILE = 'config.json';
export const DEFAULT_DATA_DIR = '/data';
export const DEFAULT_TABLES_IN_DIR = '/in/tables';
export const DEFAULT_TABLES_OUT_DIR = '/out/tables';
export const DEFAULT_DOWNLOAD_TYPE = false;
export const API_VERSION_2 = 'v0.2';
export const API_VERSION_3 = 'v0.3';
export const PAGE_SIZE = 10;
export const NUMBER_OF_REQUESTS_PER_MINUTE = 44;
export const DEFAULT_API_VERSION = API_VERSION_2;
export const SUPPORTED_API_VERSIONS = [ API_VERSION_2, API_VERSION_3 ];


/**
 * Prefixes for each tables
 */
export const ENTITY_METADATA_FILE_PREFIX = 'type_tags_description';
export const ENTITY_METADATA_PREFIX = 'entityMetadata';
export const REVIEWS_DETAILS_PREFIX = 'reviewsDetails';
export const CLUSTER_METRICS_PREFIX = 'clusterMetrics';
export const CLUSTER_MEMBERS_PREFIX = 'clusterMembers';
export const ENTITY_DETAILS_PREFIX = 'entityDetails';
export const COMPLETENESS_PREFIX = 'completeness';
export const SERVICES_PREFIX = 'services';
export const ENTITIES_PREFIX = 'entities';
export const LOCATION_PREFIX = 'location';
export const CLUSTERS_PREFIX = 'clusters';
export const CONTACT_PREFIX = 'contact';
export const PROFILE_PREFIX = 'profile';
export const METRICS_PREFIX = 'metrics';
export const REVIEWS_PREFIX = 'reviews';
export const PEERS_PREFIX = 'peers';
export const SUPPORTED_FILE_INPUTS = [
  PEERS_PREFIX,
  ENTITIES_PREFIX,
  CLUSTERS_PREFIX,
  REVIEWS_PREFIX
];


/**
 * Events constants
 */
export const EVENT_ERROR = 'error';
export const EVENT_DATA = 'data';
export const EVENT_END = 'end';
export const EVENT_FINISH = 'finish';
export const EVENT_INVALID_DATA = 'data-invalid';
