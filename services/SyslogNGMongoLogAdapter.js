var _ = require('underscore'),
    mongodb = require('mongodb'),
    extend = require('extend'),
    qs = require('querystring');

/**
 * syslog-ng MongoDB adapter class
 * 
 * Manages connection and data retrieval from a capped collection
 * storing syslog messages. 
 * 
 * @param configuration {Object} configuration object
 */
function SyslogNGMongoLogAdapter (configuration) {

	var config = extend({}, {
		host: 'localhost',
		name: 'syslog',
		collectionName: 'messages'
	}, configuration);

	var privateMembers = {},
	    publicMembers = this;

	(function _definePrivateMembers() {

		privateMembers.streamDataHandlers = [];
	
		privateMembers.stream = null;
		privateMembers.cursor = null;
		privateMembers.connection = null;
		privateMembers.collection = null;
	
		privateMembers.numCollected = 0;
		privateMembers.dateStarted = null;
	
		privateMembers.collectionFindOptions = {
			fields: {
				'PROGRAM': 1,
				'PRIORITY': 1,
				'MESSAGE': 1,
				'DATE': 1,
				'HOST': 1,
				'HOST_FROM': 1,
				'SOURCEIP': 1,
				'SEQNUM': 1,
				'TAGS': 1
			},
			sort: {
				$natural: 1
			}
		};
	        
		privateMembers.getConnectionString = function __getConnectionString () {
			var cs = 'mongodb://';
	
			if (config.username) {
				cs += config.username;
	
				if (config.password) {
					cs += ':' + config.password;
				}

				cs += '@';
			}

			cs += config.host;

			if (config.port) {
				cs += ':' + config.port;
			}

			cs += '/' + config.name;

			if (config.options) {
				cs += '?' + qs.stringify(config.options);
			}
			
			return cs;
		};
	}());

	(function _definePublicMembers() {
        
		/**
		 * Open the connnection and required cursor stream to the MongoDB database specified in config.
		 * 
		 * @param handler {Function} callback to execute
		 * @return {SyslogNGMongoLogAdapter} this instance
		 */
		publicMembers.open = function _open(handler) {

			if (!handler) {
				throw 'no callback defined';
			}

			mongodb.MongoClient.connect(privateMembers.getConnectionString(), function _mongoClientConnectHandler(err, db) {
            
				if (err) {
					return handler(err);
				}
                
				privateMembers.connection = db;

				privateMembers.collection = db.collection(config.collectionName);

				collection.options(function _collectionOptionsHandler(err, options) {
					if (err) {
						return handler(err);
					}

					if (!options) {
						return handler('cannot get collection properties. Please make sure it exists!');
					}

					if (!options.capped) {
						return handler('collection is not capped');
					}

					privateMembers.cursor = collection.find({}, extend({}, privateMembers.collectionFindOptions, {
						tailable: true,
						awaitdata: true,
						numberOfRetries: -1
					}));

					privateMembers.stream = privateMembers.cursor.stream();

					privateMembers.stream.on('data', function _streamOnDataHandler(data) {
                    
						privateMembers.numCollected++;
                        
						privateMembers.streamDataHandlers.forEach(function _handleStreamDataHandler(handler) {
							handler(null, data);
						});
					});

					privateMembers.stream.on('error', function _streamOnErrorHandler(err) {
						privateMembers.streamDataHandlers.forEach(function _handleStreamErrorHandler(handler) {
							handler(err, null);
						});
					});

					privateMembers.stream.on('close', function _streamOnCloseHandler() {
						// TODO handle stream close
					});

					privateMembers.dateStarted = new Date();
                    
					handler();
				});
			});

			return publicMembers;
		};

		/**
		 * Close cursor and connection to the configured MongoDB database
		 *
		 * @param handler {Function} callback to execute
		 * @return {SyslogNGMongoLogAdapter} this instance
		 */
		publicMembers.close = function _close(handler) {

			if (!handler) {
				throw 'no callback defined';
			}
        
			privateMembers.stream = null;
                            
			privateMembers.cursor.close(function _cursorCloseHandler(err) {
				if (err) {
					return handler(err);
				}

				privateMembers.cursor = null;
				privateMembers.collection = null;

				privateMembers.connection.close(function _connectionCloseHandler(err, result) {
					if (err) {
						return handler(err);
					}

					privateMembers.connection = null;
					privateMembers.numCollected = 0;
					privateMembers.dateStarted = null;
                    
					handler(null);
				});
			});

			return publicMembers;
		};

		/**
		 * Register an event handler which will be executed when data is
		 * received by the cursor stream
		 *
		 * @param handler {Function} callback which will be executed when data is received
		 * @return {SyslogNGMongoLogAdapter} this instance
		 */
		publicMembers.onStreamData = function _onStreamData(handler) {
        
			if (!handler) {
				throw 'no callback defined';
			}
            
			if (_.isFunction(handler)) {
				privateMembers.streamDataHandlers.push(handler));
			}

			return publicMembers;
		};

		/**
		 * Fetch all log messages from the configured collection
		 *
		 * @param handler {Function} callback which will be executed
		 * @return {SyslogNGMongoLogAdapter} this instance
		 */
		publicMembers.getLogs = function _getLogs(handler) {

			if (!handler) {
				throw 'no callback defined';
			}
        
			privateMembers.collection.find({}, extend({}, privateMembers.collectionFindOptions, {
				sort: {
					'DATE': -1
				}
			}).toArray(function _getLogsToArrayHandler(err, data) {
				if (err) {
					return handler(err, null);
				}

				handler(null, data);
			});

			return publicMembers;
		};

		/**
		 * Get the number of miliseconds since the connection was opened
		 *
		 * @return {Long} the number of miliseconds since database link was brought up; -1 if database link is down
		 */
		publicMembers.getUptimeMilis = function _getUptime() {
        
			if (!privateMembers.dateStarted) {
				return -1;
			}
            
			return (new Date()).getTime() - privateMembers.dateStarted.getTime();
		};
	}());
}

module.exports = SyslogNGMongoLogAdapter;
