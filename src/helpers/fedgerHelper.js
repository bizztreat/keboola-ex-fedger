import fs from 'fs';
import csv from 'fast-csv';
import isThere from 'is-there';
import jsonfile from 'jsonfile';
import limit from 'simple-rate-limiter';
const request = limit(require("request")).to(40).per(60000);
import {
  EVENT_END,
  EVENT_DATA,
  EVENT_ERROR,
  EVENT_FINISH,
  EVENT_INVALID_DATA
} from '../constants';

import { isInteger, toNumber } from 'lodash';

/**
 * This function builds the url for downloads.
 */
export function getUrl(baseUrl, init, uri = init, apiKey) {
  return `${baseUrl}/${uri}&apikey=${apiKey}`;
}

/**
 * This function wraps-up a limited request and returns a promise that can be processed later.
 */
export function fetchData(url) {
  return new Promise((resolve, reject) => {
    request(url, (error, response, body) => {
      if (error) {
        reject(error);
      } else {
        resolve(JSON.parse(body));
      }
    });
  });
}

/**
 * This function just stores data to selected destination.
 * Data is appending to a file, the first one needs to have a header.
 */
export function createOutputFile(fileName, data) {
  return new Promise((resolve, reject) => {
    const headers = !isThere(fileName);
    const includeEndRowDelimiter = true;
    csv
      .writeToStream(fs.createWriteStream(fileName, {'flags': 'a'}), data, { headers, includeEndRowDelimiter })
      .on(EVENT_FINISH, () => resolve('File created!'));
  });
}

/**
 * This function simply create a manifest file related to the output data
 */
export function createManifestFile(fileName, data) {
  return new Promise((resolve, reject) => {
    jsonfile.writeFile(fileName, data, {}, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve('Manifest created!');
      }
    });
  });
}

/**
 * Application works with the entities data.
 * After the file is downloaded/specified via input, we need to read the content.
 * This function helps to manage it and also validates, whether the input file is valid.
 */
export function readEntityFileContent(file) {
  return new Promise((resolve, reject) => {
    const stream = fs.createReadStream(file);
    let result = [];
    csv
      .fromStream(stream, { headers: true })
      .transform(data => data.id)
      .validate(data => isInteger(toNumber(data)))
      .on(EVENT_INVALID_DATA, data => reject('Invalid input file!'))
      .on(EVENT_ERROR, error => reject(error))
      .on(EVENT_DATA, data => result.push(data))
      .on(EVENT_END, () => resolve(result));
  });
}
