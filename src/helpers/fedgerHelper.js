import fs from 'fs';
import csv from 'fast-csv';
import isThere from 'is-there';
import jsonfile from 'jsonfile';
import {
  size,
  keys,
  last,
  uniq,
  first,
  isNull,
  uniqBy,
  isArray,
  replace,
  includes,
  toNumber,
  toString,
  isInteger,
  cloneDeep,
  escapeRegExp
} from 'lodash';
import {
  getTableName,
  removeNonASCII,
  sanitizeContact,
  sanitizeMetrics,
  sanitizeLocation,
  sanitizeServices,
  sanitizeReviewDetails,
  getKeboolaStorageMetadata,
  createArrayOfKeboolaStorageMetadata
} from './keboolaHelper';
import {
  EVENT_END,
  EVENT_DATA,
  EVENT_ERROR,
  EVENT_FINISH,
  API_VERSION_2,
  API_VERSION_3,
  PROFILE_PREFIX,
  API_VERSION_3_4,
  ENTITIES_PREFIX,
  EVENT_INVALID_DATA,
  FEDGER_API_BASE_URL,
  NUMBER_OF_REQUESTS_PER_MINUTE
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
export function fetchData(request, url) {
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
export function createOutputFile(fileName, data, timestamp) {
  return new Promise((resolve, reject) => {
    const headers = !isThere(fileName);
    const outputData = data.map(element => Object.assign({}, { timestamp }, element));
    const includeEndRowDelimiter = true;
    csv
      .writeToStream(fs.createWriteStream(fileName, {'flags': 'a'}), outputData, { headers, includeEndRowDelimiter })
      .on(EVENT_ERROR, () => reject('Problem with writing data into output!'))
      .on(EVENT_FINISH, () => resolve('File created!'));
  });
}

/**
 * This function creates an array of promises that leads to creating multiple files.
 */
export function createMultipleFiles(metadata, data, timestamp) {
  return keys(metadata).map(key => {
    return new Promise(resolve => {
      createOutputFile(metadata[key].fileName, [ Object.assign({}, {timestamp}, data[key]) ])
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
    return new Promise((resolve, reject) => {
      const fileName = `${metadata[key].fileName}`
      const manifestFileName = `${fileName}.manifest`;
      const { destination, incremental } = metadata[key];
      if (isThere(fileName)) {
        createManifestFile(manifestFileName, { destination, incremental })
          .then(result => resolve(`${key} manifest created!`))
          .catch(error => reject(error));
      } else {
        resolve(`${key} manifest skipped! ${fileName} is empty!`);
      }
    });
  });
}

/**
 * This function validates the ids from file input.
 * Can distinguish between API versions v0.2 and v0.3.
 */
export function validateInputStream(prefix, apiVersion, data) {
  return apiVersion === API_VERSION_2 && isInteger(toNumber(data.id))
    || (apiVersion === API_VERSION_3 || apiVersion === API_VERSION_3_4) && data.id.length === 36;
}

/**
 * Application works with the entities data.
 * After the file is downloaded/specified via input, we need to read the content.
 * This function helps to manage it and also validates, whether the input file is valid.
 */
export function readFileContent({
  city,
  prefix,
  apiVersion,
  tableInDir,
  tableOutDir,
  inputFileName,
  inputFileType
}) {
  return new Promise((resolve, reject) => {
    const result = [];
    const fileName = inputFileType && inputFileType === prefix
      ? `${tableInDir}/${inputFileName}`
      : `${tableOutDir}/${getTableName(prefix, city)}.csv`;
    if (!isThere(fileName)) {
      reject(`Missing data for ${prefix}! Please verify your configuration!`);
    }
    const stream = fs.createReadStream(fileName);
    csv
      .fromStream(stream, { headers: true })
      .validate(data => validateInputStream(prefix, apiVersion, data))
      .on(EVENT_INVALID_DATA, data => reject('Invalid input file!'))
      .on(EVENT_ERROR, error => reject(error))
      .on(EVENT_DATA, data => result.push(data.id))
      .on(EVENT_END, () => resolve(uniq(result)));
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
 * This function gets an array of entityIds and download updated entity details.
 */
export function downloadEntityById(request, entities, tableOutDir, bucketName, prefix, city, apiVersion, apiKey, timestamp) {
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
          const next = `/${apiVersion}/entity/${entityId}?expand=location`;
          const { object, id, name, location } = await fetchData(request, getUrl(FEDGER_API_BASE_URL, '', next, apiKey));
          const data = [{
            object,
            id,
            name,
            address: `${location.countryCode}-${location.postalCode} ${location.city}, ${location.streetName} ${location.streetNumber}`,
            url: `/${apiVersion}/entity/${id}`
          }];
          const result = await createOutputFile(fileName, data, timestamp);
        }
        // If data is successfully downloaded, we can create a manifest file.
        const manifest = isThere(fileName)
          ? await createManifestFile(manifestFileName, { destination, incremental })
          : null;
        const outputMessage = !isNull(manifest)
          ? `Data for '${city}' from API version ${apiVersion} downloaded!`
          : `No data for '${city}' from API version ${apiVersion} downloaded! Source dataset is empty!`;
        resolve(outputMessage);
      } catch (error) {
        reject(error);
      }
    }();
  });
}


/**
 * This function simply download data for entities.
 * The result is going to be stored in file and processed later.
 */
export function downloadDataForEntities(request, prefix, tableOutDir, city, bucketName, apiKey, startPage, maximalPage, apiVersion, pageSize, timestamp) {
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
        const init = `/${apiVersion}/entity/search?page=${startPage}&limit=${pageSize}&city=${city.toLowerCase()}`;
        do {
          let { hasMore, next, data, page } = await fetchData(request, getUrl(FEDGER_API_BASE_URL, init, next, apiKey));
          const result = size(data) > 0
            ? await createOutputFile(fileName, data, timestamp)
            : null;
          hasMoreRecords = maximalPage && maximalPage === page ? false : hasMore;
        } while (hasMoreRecords);
        // If data is successfully downloaded, we can create a manifest file.
        const manifest = isThere(fileName)
          ? await createManifestFile(manifestFileName, { destination, incremental })
          : null;
        const outputMessage = !isNull(manifest)
          ? `Data for '${city}' entity from API version ${apiVersion} downloaded!`
          : `No data for '${city}' from API version ${apiVersion} downloaded! Source dataset is empty!`;
        resolve(outputMessage);
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
export function downloadExtraEntityMetadata(request, prefix, entities, tableOutDir, city, bucketName, apiKey, apiVersion, timestamp) {
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
          const next = `/${apiVersion}/entity/${entityId}?expand=${PROFILE_PREFIX}`;
          const { type, description, tags } = await fetchData(request, getUrl(FEDGER_API_BASE_URL, '', next, apiKey));
          const data = [{
            entityId,
            type,
            tags: tags ? tags.join(',') : '',
            description: removeNonASCII(description)
          }];
          const result = await createOutputFile(fileName, data, timestamp);
        }
        // If data is successfully downloaded, we can create a manifest file.
        const manifest = isThere(fileName)
          ? await createManifestFile(manifestFileName, { destination, incremental })
          : null;
        const outputMessage = !isNull(manifest)
          ? `Extra entity metadata for '${city}' from API version ${apiVersion} downloaded!`
          : `No extra entity metadata for '${city}' from API version ${apiVersion} downloaded! Source dataset is empty!`;
        resolve(outputMessage);
      } catch (error) {
        reject(error);
      }
    }();
  });
}

/**
 * This function reads entities and its teams.
 */
export function downloadEntityTeams(request, prefix, entities, tableOutDir, city, bucketName, apiKey, apiVersion, timestamp) {
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
          const next = `/${apiVersion}/entity/${entityId}/team`;
          const { entity, object } = await fetchData(request, getUrl(FEDGER_API_BASE_URL, '', next, apiKey));
          const data = [{
            entity,
            object
          }];
          const result = await createOutputFile(fileName, data, timestamp);
        }
        // If data is successfully downloaded, we can create a manifest file.
        const manifest = isThere(fileName)
          ? await createManifestFile(manifestFileName, { destination, incremental })
          : null;
        const outputMessage = !isNull(manifest)
          ? `Entity team data for '${city}' from API version ${apiVersion} downloaded!`
          : `No entity team data for '${city}' from API version ${apiVersion} downloaded! Source dataset is empty!`;
        resolve(outputMessage);
      } catch (error) {
        reject(error);
      }
    }();
  });
}


/**
 * This function takes care of downloading the expanded metadata for each individual entity.
 */
export function downloadExpandedDataForEntities(request, prefixes, entities, tableOutDir, city, bucketName, apiKey, apiVersion, timestamp) {
  return new Promise((resolve, reject) => {
    return async function() {
      try {
        // We need to prepare tablesName.
        const metadata = convertArrayOfObjectsToObject(
          createArrayOfKeboolaStorageMetadata(tableOutDir, bucketName, prefixes, city)
        );
        for (const entityId of entities) {
          const next = `/${apiVersion}/entity/${entityId}?expand=${encodeURIComponent(prefixes.join(','))}`
          const data = await fetchData(request, getUrl(FEDGER_API_BASE_URL, '', next, apiKey));
          const { contact, profile, metrics, location } = data;
          const services = Object.assign({}, sanitizeServices(data.services), {
            onlineMenu: data.services.onlineMenu ? data.services.onlineMenu.join(',') : ''
          });
          const completeness = Object.assign({}, data.completeness, {
            drillDown: JSON.stringify(data.completeness.drillDown)
          });
          const result = await Promise.all(createMultipleFiles(metadata,
            { location: sanitizeLocation(location, apiVersion), contact: sanitizeContact(contact, apiVersion), profile, metrics: sanitizeMetrics(metrics), services, completeness }, timestamp
          ));
        }
        // Create manifest files as well.
        const manifests = await Promise.all(createMultipleManifests(metadata));
        resolve(`Expanded details for '${city}' from API version ${apiVersion} downloaded!`);
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
export function downloadClustersForEntities(request, prefix, entities, tableOutDir, city, bucketName, apiKey, apiVersion, timestamp) {
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
          const next = `/${apiVersion}/entity/${entityId}/clusters`;
          const { data } = await fetchData(request, getUrl(FEDGER_API_BASE_URL, '', next, apiKey));
          const extendedData = uniqBy(data, 'id').map(cluster => Object.assign({}, cluster, { parentId: entityId }));
          const result = size(extendedData) > 0
            ? await createOutputFile(fileName, extendedData, timestamp)
            : null;
        }
        const manifest = isThere(fileName)
          ? await createManifestFile(manifestFileName, { destination, incremental })
          : null;
        const outputMessage = !isNull(manifest)
          ? `Clusters data for '${city}' from API version ${apiVersion} downloaded!`
          : `No clusters data for '${city}' from API version ${apiVersion} downloaded! Source dataset is empty!`;
        resolve(outputMessage);
      } catch (error) {
        reject(error);
      }
    }();
  });
}

/**
 * This function handles the download of cluster metrics by id.
 */
export function downloadClusterMetricsById(request, prefix, clusters, tableOutDir, city, bucketName, apiKey, apiVersion, timestamp) {
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
        for (const clusterId of clusters) {
          const next = `/${apiVersion}/cluster/${clusterId}/metrics`;
          const data = await fetchData(request, getUrl(FEDGER_API_BASE_URL, '', next, apiKey));
          const result = await createOutputFile(fileName, [ data ], timestamp);
        }
        const manifest = isThere(fileName)
          ? await createManifestFile(manifestFileName, { destination, incremental })
          : null;
        const outputMessage = !isNull(manifest)
          ? `Cluster metrics data for '${city}' from API version ${apiVersion} downloaded!`
          : `No cluster metrics data for '${city}' from API version ${apiVersion} downloaded! Source dataset is empty!`;
        resolve(outputMessage);
      } catch(error) {
        reject(error);
      }
    }();
  });
}

/**
 * This function handles the download of cluster members by id.
 */
export function downloadClusterMembersById(request, prefix, clusters, tableOutDir, city, bucketName, apiKey, maximalPage, apiVersion, pageSize, timestamp) {
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
        for (const clusterId of clusters) {
          let hasMoreRecords = false;
          const init = `/${apiVersion}/cluster/${clusterId}/members?page=1&limit=${pageSize}`;
          do {
            let { hasMore, next, data, page } = await fetchData(request, getUrl(FEDGER_API_BASE_URL, init, next, apiKey));
              const extendedData = isArray(data) && size(data) > 0
                ? data.map(cluster => Object.assign({}, cluster, { parentId: clusterId }))
                : [];
            const result = size(extendedData) > 0
              ? await createOutputFile(fileName, extendedData, timestamp)
              : null;
            hasMoreRecords = maximalPage && maximalPage === page ? false : hasMore;
          } while (hasMoreRecords);
        }
        const manifest = isThere(fileName)
          ? await createManifestFile(manifestFileName, { destination, incremental })
          : null;
        const outputMessage = !isNull(manifest)
          ? `Cluster members data for '${city}' from API version ${apiVersion} downloaded!`
          : `No cluster members data for '${city}' from API version ${apiVersion} downloaded! Source dataset is empty!`;
        resolve(outputMessage);
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
export function downloadPeersForEntities(request, prefix, entities, tableOutDir, city, bucketName, apiKey, maximalPage, apiVersion, pageSize, timestamp) {
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
          const init = `/${apiVersion}/entity/${entityId}/peers?page=1&limit=${pageSize}`;
          do {
            let { hasMore, next, data, page } = await fetchData(request, getUrl(FEDGER_API_BASE_URL, init, next, apiKey));
            const extendedData = isArray(data) && size(data) > 0
              ? data.map(peer => Object.assign({}, peer, { parentId: entityId }))
              : [];
            const result = size(extendedData) > 0
              ? await createOutputFile(fileName, extendedData, timestamp)
              : null;
            hasMoreRecords = maximalPage && maximalPage === page ? false : hasMore;
          } while (hasMoreRecords);
        }
        const manifest = isThere(fileName)
          ? await createManifestFile(manifestFileName, { destination, incremental })
          : null;
        const outputMessage = !isNull(manifest)
          ? `Peers data for '${city}' from API version ${apiVersion} downloaded!`
          : `No peers data for '${city}' from API version ${apiVersion} downloaded! Source dataset is empty!`;
        resolve(outputMessage);
      } catch (error) {
        reject(error);
      }
    }();
  });
}

/**
 * This function handles the download of the reviews data.
 * There seems to be no pagination. Each entity has the exact amount of records.
 */
export function downloadReviewsOfEntities(request, prefix, entities, tableOutDir, city, bucketName, apiKey, apiVersion, timestamp) {
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
          const next = `/${apiVersion}/entity/${entityId}/reviews`;
          const { data } = await fetchData(request, getUrl(FEDGER_API_BASE_URL, '', next, apiKey));
          const extendedData = data.map(review => Object.assign({}, review, { parentId: entityId }));
          const result = size(extendedData) > 0
            ? await createOutputFile(fileName, extendedData, timestamp)
            : null;
        }
        const manifest = isThere(fileName)
          ? await createManifestFile(manifestFileName, { destination, incremental })
          : null;
        const outputMessage = !isNull(manifest)
          ? `Reviews data for '${city}' from API version ${apiVersion} downloaded!`
          : `No reviews data for '${city}' from API version ${apiVersion} downloaded! Source dataset is empty!`;
        resolve(outputMessage);
      } catch (error) {
        reject(error);
      }
    }();
  });
}

/**
 * This function reads a list of reviews and for each item gets more details.
 */
export function downloadDetailsOfReviews(request, prefix, reviews, tableOutDir, city, bucketName, apiKey, apiVersion, timestamp) {
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
        for (const reviewId of reviews) {
          const next = `/${apiVersion}/review/${reviewId}`;
          const data = await fetchData(request, getUrl(FEDGER_API_BASE_URL, '', next, apiKey));
          const result = await createOutputFile(fileName, [ sanitizeReviewDetails(data) ], timestamp);
        }
        // If data is successfully downloaded, we can create a manifest file.
        const manifest = isThere(fileName)
          ? await createManifestFile(manifestFileName, { destination, incremental })
          : null;
        const outputMessage = !isNull(manifest)
          ? `Reviews details data for '${city}' from API version ${apiVersion} downloaded!`
          : `No reviews details data for '${city}' from API version ${apiVersion} downloaded! Source dataset is empty!`;
        resolve(outputMessage);
      } catch (error) {
        reject(error);
      }
    }();
  });
}
