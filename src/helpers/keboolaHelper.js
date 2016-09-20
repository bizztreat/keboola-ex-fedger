'use strict';
import {
  size,
  first,
  deburr,
  isArray,
  toLower,
  isNumber,
  includes,
  snakeCase,
  isUndefined
} from 'lodash';
import {
  PAGE_SIZE,
  API_VERSION_2,
  DEFAULT_API_VERSION,
  DEFAULT_DOWNLOAD_TYPE,
  SUPPORTED_FILE_INPUTS,
  SUPPORTED_API_VERSIONS,
  NUMBER_OF_REQUESTS_PER_MINUTE
} from '../constants';
/**
 * This is a simple helper that checks whether the input configuration is valid.
 * If so, the particular object with relevant parameters is returned.
 * Otherwise, an error is thrown.
 */
export function parseConfiguration(configObject) {
  return new Promise((resolve, reject) => {
    // Read information from the input files.
    const inputFiles = configObject.get('storage:input:tables');
    // Datasets are related to the downloading part. Sometimes we don't need to download everything at once.
    // It can be undefined, but if it's defined, it must be an array.
    const datasets = configObject.get('parameters:datasets');
    if (!isUndefined(datasets) && !isArray(datasets)) {
      reject('Please specify the datasets parameter as an array! Check out the documentation for more details!');
    }
    // We also need to read the desired version of the API.
    const apiVersion = configObject.get('parameters:apiVersion') || DEFAULT_API_VERSION;
    // We only need to work with v0.2 or v0.3 version of the API.
    if (!includes(SUPPORTED_API_VERSIONS, apiVersion)) {
      reject(`Invalid apiVersion parameter! Only following values: ${SUPPORTED_API_VERSIONS} supported!`);
    }
    // Check whether the user wishes to read entities from an input file
    const inputFileType = configObject.get('parameters:inputFileType');
    if (inputFileType && !includes(SUPPORTED_FILE_INPUTS, inputFileType)) {
      reject(`Invalid inputFile parameter! Only following values: ${SUPPORTED_FILE_INPUTS} supported!`);
    }
    // If a user wants to load entities from a file, an input file must be selected.
    if (inputFileType && size(inputFiles) === 0) {
      reject('Parameter inputFileType set, but no input file specified!');
    }
    if (inputFileType && size(inputFiles) > 1) {
      reject(`Too many input files selected! Please select exactly one file containing ${inputFileType} information!`);
    }
    const inputFileName = inputFileType && first(inputFiles).destination;
    const apiKey = configObject.get('parameters:#apiKey');
    if (isUndefined(apiKey)) {
      reject('Parameter #apiKey missing from input configuration! Please check out the documentation for more information!');
    }
    const bucketName = configObject.get('parameters:bucketName');
    if (isUndefined(bucketName)) {
      reject('Parameter bucketName missing from input configuration! Please check out the documentation for more information!');
    }
    const city = configObject.get('parameters:city');
    if (isUndefined(city)) {
      reject('Parameter city missing from input configuration! Please check out the documentation for more information!');
    }
    // These variables help with pagination.
    const startPage = configObject.get('parameters:startPage') || 1;
    const numberOfPages = configObject.get('parameters:numberOfPages');
    const pageSize = configObject.get('parameters:pageSize') || PAGE_SIZE;
    const numberOfRequestsPerMinute = configObject.get('parameters:numberOfRequestsPerMinute') || NUMBER_OF_REQUESTS_PER_MINUTE;
    const maximalPage = getMaximalPage(startPage, numberOfPages);
    resolve({
      city,
      apiKey,
      pageSize,
      datasets,
      startPage,
      bucketName,
      apiVersion,
      maximalPage,
      inputFileName,
      inputFileType,
      numberOfRequestsPerMinute
    })
  });
}

/**
 * This function simply returns maximum page that can be reached.
 */
export function getMaximalPage(startPage, numberOfPages) {
  return startPage
    && numberOfPages
    && isNumber(startPage)
    && isNumber(numberOfPages)
    && startPage + numberOfPages - 1;
}

/**
 * This is a simple function that creates a table name for specified input.
 * The pattern is a prefix + name of a city.
 */
export function getTableName(prefix, name) {
  return `${prefix}_${snakeCase(toLower(name))}`;
}

/**
 * This function prepares object containing metadata required for writing
 * output data into Keboola (output files & manifests).
 */
export function getKeboolaStorageMetadata(tableOutDir, bucketName, prefix, city) {
  const incremental = DEFAULT_DOWNLOAD_TYPE;
  const tableName = getTableName(prefix, deburr(city));
  const destination = `${bucketName}.${tableName}`;
  const fileName = `${tableOutDir}/${tableName}.csv`;
  const manifestFileName = `${fileName}.manifest`;
  return { tableName, fileName, incremental, destination, manifestFileName };
}

/**
 * This function just create an array of metadata suitable for Keboola Connection.
 */
export function createArrayOfKeboolaStorageMetadata(tableOutDir, bucketName, prefixes, city) {
  return prefixes.map(prefix => {
    const storageMetadata = getKeboolaStorageMetadata(tableOutDir, bucketName, prefix, city);
    return {[ prefix ]: storageMetadata};
  });
}

/**
 * This function simply removes non-printable characters.
 */
export function removeNonASCII(string){
  return string ? string.replace(/[^\x20-\x7E]/g, '') : '';
}

/**
 * This function sanitize location results from API v0.3 to make sure the number of columns is consistent.
 */
export function sanitizeLocation(location, apiVersion) {
  return apiVersion !== API_VERSION_2
    ? {
      entity: location.entity || '',
      object: location.object || '',
      postalCode: location.postalCode || '',
      streetName: location.streetName || '',
      countryCode: location.countryCode || '',
      city: location.city || '',
      latitude: location.latitude || '',
      streetNumber: location.streetNumber || '',
      longitude: location.longitude || ''
    } : location;
}

/**
 * This function sanitize contact results from API v0.3 to make sure the number of columns is consistent.
 */
export function sanitizeContact(contact, apiVersion) {
  return apiVersion !== API_VERSION_2
    ? {
      entity: contact.entity || '',
      object: contact.object || '',
      url: contact.url || '',
      telephone: contact.telephone || '',
      email: contact.email || '',
      faxNumber: contact.faxNumber || ''
    } : contact;
}

/**
 * This function sanitize reviewDetails results from API v0.3 to make sure the number of columns is consistent.
 */
 export function sanitizeReviewDetails(reviewsDetails) {
   return {
     object: reviewsDetails.object || '',
     expand: reviewsDetails.expand || '',
     id: reviewsDetails.id || '',
     reviewRating: reviewsDetails.reviewRating || '',
     source: reviewsDetails.source || '',
     body: reviewsDetails.body || '',
     author: reviewsDetails.author || '',
     datePublished: reviewsDetails.datePublished || '',
     entity: reviewsDetails.entity || '',
     itemReviewed: reviewsDetails.itemReviewed || '',
     topics: reviewsDetails.topics || '',
     sentiment: reviewsDetails.sentiment || ''
   }
 }
