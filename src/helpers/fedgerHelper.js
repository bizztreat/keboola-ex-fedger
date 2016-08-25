import fs from 'fs';
import csv from 'fast-csv';
import isThere from 'is-there';
import jsonfile from 'jsonfile';
import limit from 'simple-rate-limiter';
const request = limit(require("request")).to(40).per(60000);
import {
  size,
  keys,
  last,
  first,
  replace,
  toNumber,
  toString,
  isInteger,
  cloneDeep,
  escapeRegExp
} from 'lodash';
import {
  getTableName,
  removeNonASCII,
  getKeboolaStorageMetadata,
  createArrayOfKeboolaStorageMetadata
} from './keboolaHelper';
import {
  EVENT_END,
  EVENT_DATA,
  EVENT_ERROR,
  EVENT_FINISH,
  PROFILE_PREFIX,
  EVENT_INVALID_DATA,
  FEDGER_API_BASE_URL
} from '../constants';

/**
 * This function simply generate a query string symbol
 */
function getQueryStringSymbol(uri) {
  if (uri.indexOf('?') > 0 || uri.indexOf('&') > 0) {
    return '&';
  } else {
    return '?';
  }
}

/**
 * This function builds the url for downloads.
 */
export function getUrl(baseUrl, init, uri = init, apiKey) {
  return uri.indexOf('city') > 0
    ? `${baseUrl}${first(uri.split('city='))}city=${encodeURIComponent(last(uri.split('city=')))}&apikey=${apiKey}`
    : `${baseUrl}/${uri}${getQueryStringSymbol(uri)}apikey=${apiKey}`;
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
      .on(EVENT_ERROR, () => reject('Problem with writing data into output!'))
      .on(EVENT_FINISH, () => resolve('File created!'));
  });
}

/**
 * This function creates an array of promises that leads to creating multiple files.
 */
export function createMultipleFiles(metadata, data) {
  return keys(metadata).map(key => {
    return new Promise(resolve => {
      createOutputFile(metadata[key].fileName, [ data[key] ])
        .then(result => resolve(`${key} updated!`))
        .catch(error => reject(error));
    });
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
 * This function creates an array of promises that leads to creating multiple manifest files.
 */
export function createMultipleManifests(metadata) {
  return keys(metadata).map(key => {
    return new Promise(resolve => {
      const fileName = `${metadata[key].fileName}.manifest`;
      const { destination, incremental } = metadata[key];
      createManifestFile(fileName, { destination, incremental })
        .then(result => resolve(`${key} manifest created!`))
        .catch(error => reject(error));
    });
  });
}

/**
 * Application works with the entities data.
 * After the file is downloaded/specified via input, we need to read the content.
 * This function helps to manage it and also validates, whether the input file is valid.
 */
export function readEntityFileContent({
  city,
  prefix,
  tableInDir,
  tableOutDir,
  inputFileName,
  readEntitiesFromFile
}) {
  return new Promise((resolve, reject) => {
    let result = [];
    const fileName = readEntitiesFromFile
      ? `${tableInDir}/${inputFileName}`
      : `${tableOutDir}/${getTableName(prefix, city)}.csv`;
    const stream = fs.createReadStream(fileName);
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

/**
 * This function simply converts array of objects into single object.
 */
export function convertArrayOfObjectsToObject(inputArray) {
  return inputArray.reduce((previous, current) => {
    let key = first(Object.keys(current));
    previous[key] = current[key];
    return previous;
  }, {});
}


/**
 * This function simply download data for entities.
 * The result is going to be stored in file and processed later.
 */
export function downloadDataForEntities(prefix, tableOutDir, city, bucketName, apiKey, startPage, maximalPage) {
  return new Promise((resolve, reject) => {
    return async function() {
      try {
        let hasMoreRecords = false;
        const {
          fileName,
          tableName,
          destination,
          incremental,
          manifestFileName
        } = getKeboolaStorageMetadata(tableOutDir, bucketName, prefix, city);
        const init = `/v0.2/entity/search?page=${startPage}&limit=10&city=${city.toLowerCase()}`;
        do {
          let { hasMore, next, data, page } = await fetchData(getUrl(FEDGER_API_BASE_URL, init, next, apiKey));
          const result = size(data) > 0
            ? await createOutputFile(fileName, data)
            : null;
          hasMoreRecords = maximalPage && maximalPage === page ? false : hasMore;
        } while (hasMoreRecords);
        // If data is successfully downloaded, we can create a manifest file.
        const manifest = await createManifestFile(manifestFileName, { destination, incremental });
        resolve(`Data for '${city}' entity downloaded!`);
      } catch(error) {
        reject(error);
      }
    }();
  });
}

/**
 * This function reads entities and create a file containing extra metadata for each entity.
 * Extra set of metadata contains entity, type, description and tags.
 */
export function downloadExtraEntityMetadata(prefix, entities, tableOutDir, city, bucketName, apiKey) {
  return new Promise((resolve, reject) => {
    return async function() {
      try {
        const {
          fileName,
          tableName,
          destination,
          incremental,
          manifestFileName
        } = getKeboolaStorageMetadata(tableOutDir, bucketName, prefix, city);
        for (const entityId of entities) {
          const next = `/v0.2/entity/${entityId}?expand=${PROFILE_PREFIX}`;
          const { type, description, tags } = await fetchData(getUrl(FEDGER_API_BASE_URL, '', next, apiKey));
          const data = [{
            entityId,
            type,
            tags: tags ? tags.join(',') : '',
            description: removeNonASCII(description)
          }];
          const result = await createOutputFile(fileName, data);
        }
        // If data is successfully downloaded, we can create a manifest file.
        const manifest = await createManifestFile(manifestFileName, { destination, incremental });
        resolve(`Extra entity metadata for '${city} downloaded!'`);
      } catch (error) {
        reject(error);
      }
    }();
  });
}


/**
 * This function takes care of downloading the expanded metadata for each individual entity.
 */
export function downloadExpandedDataForEntities(prefixes, entities, tableOutDir, city, bucketName, apiKey) {
  return new Promise((resolve, reject) => {
    return async function() {
      try {
        // We need to prepare tablesName.
        const metadata = convertArrayOfObjectsToObject(
          createArrayOfKeboolaStorageMetadata(tableOutDir, bucketName, prefixes, city)
        );
        for (const entityId of entities) {
          const next = `/v0.2/entity/${entityId}?expand=${encodeURIComponent(prefixes.join(','))}`
          const data = await fetchData(getUrl(FEDGER_API_BASE_URL, '', next, apiKey));
          const { contact, profile, metrics, location } = data;
          const services = Object.assign({}, data.services, {
            onlineMenu: data.services.onlineMenu ? data.services.onlineMenu.join(',') : ''
          });
          const completeness = Object.assign({}, data.completeness, {
            drillDown: JSON.stringify(data.completeness.drillDown)
          });
          const result = await Promise.all(createMultipleFiles(metadata,
            { location, contact, profile, metrics, services, completeness }
          ));
        }
        // Create manifest files as well.
        const manifests = await Promise.all(createMultipleManifests(metadata));
        resolve(`Expanded details for '${city}' downloaded!`);
      } catch (error) {
        reject(error);
      }
    }();
  });
}

/**
 * This function handles the download of cluster data.
 * The HTTP response must be extended by parentId information.
 */
export function downloadClustersForEntities(prefix, entities, tableOutDir, city, bucketName, apiKey) {
  return new Promise((resolve, reject) => {
    return async function() {
      try {
        const {
          fileName,
          tableName,
          destination,
          incremental,
          manifestFileName
        } = getKeboolaStorageMetadata(tableOutDir, bucketName, prefix, city);
        for (const entityId of entities) {
          const next = `/v0.2/entity/${entityId}/clusters`;
          const { data } = await fetchData(getUrl(FEDGER_API_BASE_URL, '', next, apiKey));
          const extendedData = data.map(cluster => Object.assign({}, cluster, { parentId: entityId }));
          const result = size(extendedData) > 0
            ? await createOutputFile(fileName, extendedData)
            : null;
        }
        const manifest = await createManifestFile(manifestFileName, { destination, incremental });
        resolve(`Clusters data for '${city}' downloaded!`);
      } catch (error) {
        reject(error);
      }
    }();
  });
}

/**
 * This function handles the download of the peers data.
 * The HTTP response must be extended by parentId information.
 */
export function downloadPeersForEntities(prefix, entities, tableOutDir, city, bucketName, apiKey, startPage, maximalPage) {
  return new Promise((resolve, reject) => {
    return async function() {
      try {
        const {
          fileName,
          tableName,
          destination,
          incremental,
          manifestFileName
        } = getKeboolaStorageMetadata(tableOutDir, bucketName, prefix, city);
        for (const entityId of entities) {
          let hasMoreRecords = false;
          const init = `/v0.2/entity/${entityId}/peers?page=${startPage}&limit=10`;
          do {
            let { hasMore, next, data, page } = await fetchData(getUrl(FEDGER_API_BASE_URL, init, next, apiKey));
            const extendedData = data.map(peer => Object.assign({}, peer, { parentId: entityId }));
            const result = size(extendedData) > 0
              ? await createOutputFile(fileName, extendedData)
              : null;
            hasMoreRecords = maximalPage && maximalPage === page ? false : hasMore;
          } while (hasMoreRecords);
        }
        const manifest = await createManifestFile(manifestFileName, { destination, incremental });
        resolve(`Peers data for '${city}' downloaded!`);
      } catch (error) {
        reject(error);
      }
    }();
  });
}
