# Fedger.io Keboola Extractor

A Fedger.io extractor for Keboola Connection is a component extracting data from Fedger.io REST API endpoints. Written in Node.js with utilization of Babel/ES6/ES7 functionality.

## Available endpoints

Not every endpoint supported by Fedger.io is currently implemented. Let's sum up the ones that are available in this extractor. **Only full downloads** are currently available.

### v0.2 endpoints

* GET /entity/search ([getEntitySearch](https://chef.fedger.io/v0.2/docs/#!/entity/get_entity_search)) - returns a list of all entities associated with search parameters.  
* GET /entity/:id?expand='location,contact,profile,metrics,services,completeness' ([getEntity](https://chef.fedger.io/v0.2/docs/#!/entity/get_entity_id)) - returns a detail information about particular entity. Used with expand parameter that get more information about particular areas.
* GET /entity/:id/clusters ([getEntityClusters](https://chef.fedger.io/v0.2/docs/#!/entity/get_entity_id_clusters)) - returns clusters information related to particular entity.
* GET /entity/:id/peers ([getEntityPeers](https://chef.fedger.io/v0.2/docs/#!/entity/get_entity_id_peers)) - returns peers related to particular entity.

### v0.3 endpoints

* GET /entity/search ([getEntitySearch](https://chef.fedger.io/v0.3/docs/#!/entity/get_entity_search)) - returns a list of all entities associated with search parameters.  
* GET /entity/:id?expand='location,contact,profile,metrics,services,completeness' ([getEntity](https://chef.fedger.io/v0.3/docs/#!/entity/get_entity_id)) - returns a detail information about particular entity. Used with expand parameter that get more information about particular areas.
* GET /entity/:id/clusters ([getEntityClusters](https://chef.fedger.io/v0.3/docs/#!/entity/get_entity_id_clusters)) - returns clusters information related to particular entity.
* GET /entity/:id/peers ([getEntityPeers](https://chef.fedger.io/v0.3/docs/#!/entity/get_entity_id_peers)) - returns peers related to particular entity.
* GET /entity/:id/reviews ([getEntityReviews](https://chef.fedger.io/v0.3/docs/#!/entity/get_entity_id_reviews)) - returns reviews related to particular entity,
* GET /review/:id ([getReview](https://chef.fedger.io/v0.3/docs/#!/review/get_review_id)) - returns individual review.

## Configuration

Configuration is very straightforward and deeply described below. There are quite a lot of limitation in Fedger.io REST API on one hand, but on the other one, some of these parameters will help you to handle it.

### Sample configuration

    {
      "#apiKey": "some api key",
      "apiVersion": "v0.3",
      "bucketName": "in.c-bucketName",
      "city": "berlin",
      "datasets": ["entityMetadata", "entityDetails", "clusters", "peers", "reviews", "reviewsDetails"],
      "readEntitiesFromFile": false,
      "startPage": 1,
      "numberOfPages": 50
    }

### Selecting an input file

One of the option for reducing the number of HTTP requests is to select the input file with the list of the entities. **Only 1 file is allowed**. If you want to use this option, you need to set value of the parameter **readEntitiesFromFile** to true.

### API version

The extractor currently supports 2 versions of the Fedger.io API - **v0.2** and **v0.3**. You can specify the desired one by adding an apiVersion attribute set to either version.

After the API version is specified, the data for particular dataset will be downloaded based on the API version. The majority of the datasets is possible to download with both versions of the API, but there is also a new entity **reviews** and its details, which is possible to download with the **v0.3** only.

**Keep in mind** that it is not possible to mix data across the versions. The set of identifiers is different in each version.

### Datasets specification

Another option for keeping the number of requests sane is to specify the datasets for download. **This parameter is optional, but if not specified, just entities will be downloaded** (unless readEntitiesFromFile parameter is set to true, which will stop the execution). Valid values are **entityMetadata** **entityDetails**, **clusters**, **peers**, **reviews** and **reviewsDetails**.

**Important note** - value **reviewsDetails** is valid only if **reviews** is specified. If **reviewsDetails** is specified, but **reviews** is missing, the step is skipped. On the other hand, it is perfectly valid if only **reviews** parameter is specified.

It's completely up to you have many of them you are going to use per configuration. The purpose of this attribute is really a possibility to split the number of requests into more configurations.

### Pagination

Some endpoints (getEntitySearch and getEntityPeers) contain quite a few records. On the backend side, a pagination is in place and the download process is able to handle it. The very big limitation of the Fedger.io API is maximal page size of 10 records. This limitation obviously leads into a need to make a lot of requests. There are two optional attributes, **startPage** and **numberOfPages** that helps to manage it. If you decide to not use it, the extractor assumes you want to download everything.

### City

City parameter is required. Each configuration for Fedger.io in Keboola Connection will download data related to this parameter.

### Bucket name

This parameter identifies the name of the bucket in Keboola Connection, where are downloaded files are going to be stored. The files have simple identification and are in form **prefix_city**. Prefix is the name of the dataset.
