'use strict';
import { isUndefined } from 'lodash';

/**
 * This is a simple helper that checks whether the input configuration is valid.
 * If so, the particular object with relevant parameters is returned.
 * Otherwise, an error is thrown.
 */
export function parseConfiguration(configObject) {
  return new Promise((resolve, reject) => {
    const apiKey = configObject.get('parameters:#apiKey');
    if (isUndefined(apiKey)) {
      reject('Parameter #apiKey missing from input configuration! Please check out the documentation for more information!');
    }
    const bucketName = configObject.get('parameters:bucketName');
    if (isUndefined(bucketName)) {
      reject('Parameter bucketName missing from input configuration! Please check out the documentation for more information!');
    }
    const tableName = configObject.get('parameters:tableName');
    if (isUndefined(tableName)) {
      reject('Parameter tableName missing from input configuration! Please check out the documentation for more information!');
    }
    const city = configObject.get('parameters:city');
    if (isUndefined(city)) {
      reject('Parameter city missing from input configuration! Please check out the documentation for more information!');
    }
    const stopAfterReachPage = configObject.get('parameters:stopAfterReachPage');
    resolve({
      city,
      apiKey,
      tableName,
      bucketName,
      stopAfterReachPage
    })
  });
}
