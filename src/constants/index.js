// This file contains default constants of the application.
export const FEDGER_API_BASE_URL = 'https://chef.fedger.io';
export const CONFIG_FILE = 'config.json';
export const DEFAULT_DATA_DIR = '/data';
export const DEFAULT_TABLES_IN_DIR = '/in/tables';
export const DEFAULT_TABLES_OUT_DIR = '/out/tables';
export const DEFAULT_DOWNLOAD_TYPE = false;

/**
 * Prefixes for each tables
 */
export const ENTITY_DETAILS_PREFIX = 'entityDetails';
export const ENTITIES_PREFIX = 'entities';
export const LOCATION_PREFIX = 'location';
export const CLUSTERS_PREFIX = 'clusters';
export const CONTACT_PREFIX = 'contact';
export const PROFILE_PREFIX = 'profile';
export const METRICS_PREFIX = 'metrics';
export const PEERS_PREFIX = 'peers';

/**
 * Events constants
 */
export const EVENT_ERROR = 'error';
export const EVENT_DATA = 'data';
export const EVENT_END = 'end';
export const EVENT_FINISH = 'finish';
export const EVENT_INVALID_DATA = 'data-invalid';
