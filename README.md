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
* GET /cluster/:id/metrics ([getClusterMetrics](https://chef.fedger.io/v0.3/docs/#!/cluster/get_cluster_id_metrics)) - returns metrics related to cluster.
* GET /cluster/:id/members ([getClusterMembers](https://chef.fedger.io/v0.3/docs/#!/cluster/get_cluster_id_members)) - returns members related to cluster.
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
      "datasets": ["entities", "entityMetadata", "entityDetails", "clusters", "clusterMetrics", "clusterMembers", "peers", "reviews", "reviewsDetails"],
      "inputFileType": "entities"
      "startPage": 1,
      "numberOfPages": 5,
      "pageSize": 10,
      "numberOfRequestsPerMinute": 44
    }

### Selecting an input file

One of the option for reducing the number of HTTP requests is to select the input file with the list of the entities. **Only 1 file is allowed**. If you want to use this option, you need to set value of the parameter **inputFileType**. Valid values are: **entities**, **peers**, **clusters**, **reviews**.

### API version

The extractor currently supports 2 versions of the Fedger.io API - **v0.2** and **v0.3**. You can specify the desired one by adding an apiVersion attribute set to either version.

After the API version is specified, the data for particular dataset will be downloaded based on the API version. The majority of the datasets is possible to download with both versions of the API, but there are also new entities **clusterMetrics**, **clusterMembers**, **reviews** and **reviewsDetails**. These datasets is possible to download with the **v0.3** only.

**Keep in mind** that it is not possible to mix data across the versions. The set of identifiers is different in each version of the API. In other words, entities from v0.2 have completely different ids than they have in v0.3.

### Datasets specification

If you want to download all datasets at once, you need to use parameter **datasets** and specify value **[ "all" ]**. Alongside with this option, you need to specify a file which contains entity ids. This settings help you with downloading all data.

But you can also download datasets separately. For keeping the number of requests sane is to specify the datasets for download. **This parameter is important**. Valid values are **entities**, **entityMetadata**, **entityDetails**, **clusters**, **clusterMetrics**, **clusterMembers**, **peers**, **reviews** and **reviewsDetails**.

There are quite many options how to specify the desired datasets. **The ideal one** seems to be downloading main datasets (**entities**, **peers**, **clusters**, **reviews**) and then specify each of them as a source file (**parameter inputFileType**) and download rest of data in this way.

It's completely up to you have many of them you are going to use per configuration. The purpose of this attribute is really just adding a possibility to split the number of requests into more configurations.

### Pagination

Some endpoints (getEntitySearch, getEntityPeers and getClusterMembers) contain quite a few records. On the backend side, a pagination is in place and the download process is able to handle it. The very big limitation of the Fedger.io API is maximal page size of 10 records. This limitation obviously leads into a need to make a lot of requests. There are two optional attributes, **startPage** and **numberOfPages** that helps to manage it. If you decide to not use it, the extractor assumes you want to download everything. Don't forget to specify parameter **pageSize** unless you are happy with its default value of **10**.

### Requests per minute

You can also specify parameter **numberOfRequestsPerMinute**. This tells fedger.io how many requests per minutes you want to make. The limit allowed by Fedger.io is usually very low and for that reason this value must be discussed with people from Fedger.io.


### City

City parameter is required. Each configuration for Fedger.io in Keboola Connection will download data related to this parameter.

### Bucket name

This parameter identifies the name of the bucket in Keboola Connection, where are downloaded files are going to be stored. The files have simple identification and are in form **prefix_city**. Prefix is the name of the dataset.
