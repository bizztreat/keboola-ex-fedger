import fs from 'fs';
import csv from 'fast-csv';
import limit from 'simple-rate-limiter';
const request = limit(require("request")).to(40).per(60000);

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
export function createOutputFile(fileName, data, pageNumber) {
  return new Promise((resolve, reject) => {
    csv
      .writeToStream(fs.createWriteStream(fileName, {'flags': 'a'}), data, { headers: pageNumber === 1, includeEndRowDelimiter: true })
      .on("finish", () => resolve('fileCreated'));
  });
}
