'use strict';
import {
  size,
  first,
  isArray,
  toLower,
  snakeCase,
  isUndefined
} from 'lodash';
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
    // Check whether the user wishes to read entities from an input file (default false)
    const readEntitiesFromFile = configObject.get('parameters:readEntitiesFromFile') || false;
    // If a user wants to load entities from a file, an input file must be selected.
    if (readEntitiesFromFile && size(inputFiles) === 0) {
      reject('Parameter readEntitiesFromFile set to true, but no input file specified!');
    }
    if (readEntitiesFromFile && size(inputFiles) > 1) {
      reject('Too many input files selected! Please select exactly one file containing entity information!');
    }
    const { destination: inputFileName } = first(inputFiles);
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
    const stopAfterReachingPage = configObject.get('parameters:stopAfterReachingPage');
    resolve({
      city,
      apiKey,
      datasets,
      bucketName,
      inputFileName,
      readEntitiesFromFile,
      stopAfterReachingPage
    })
  });
}

/**
 * This is a simple function that creates a table name for specified input.
 * The pattern is a prefix + name of a city.
 */
export function getTableName(prefix, name) {
  return `${prefix}_${snakeCase(toLower(name))}`;
}
