angular.module('syslogng-web')

	.controller('MainController', function ($scope, $location, $timeout, $http, $sce, $filter, $q, $cookies, socketEventHandler, logger, config, pkg) {

		$scope.fields  = [{
			name: 'DATE',
			description: 'Date',
			enabled: true,
			highlight: false
		}, {
			name: 'HOST',
			description: 'Host',			
			enabled: true,
			highlight: true			
		}, {
			name: 'HOST_FROM',
			description: 'Originating host',			
			enabled: false,
			highlight: true
		}, {
			name: 'SOURCEIP',
			description: 'Source address',			
			enabled: false,
			highlight: true
		}, {
			name: 'PROGRAM',
			description: 'Process',			
			enabled: true,
			highlight: true
		}, {
			name: 'PRIORITY',
			description: 'Priority',			
			enabled: true,
			highlight: true
		},  {
			name: 'MESSAGE',
			description: 'Log message',			
			enabled: true,
			highlight: true
		}, {
			name: 'SEQNUM',
			description: 'Sequence',			
			enabled: false,
			highlight: false
		}, {
			name: 'TAGS',
			description: 'Tags',			
			enabled: false,
			highlight: true
		}];
		
		if ($cookies.syslogNgWebFields) {
			angular.extend($scope.fields, JSON.parse($cookies.syslogNgWebFields));
		}
		
		// save fields in cookies upon changes
		$scope.$watch('fields', function (nVal) {
			$cookies.syslogNgWebFields = JSON.stringify(nVal);
		}, true);
		
		$scope.showSettings = false;
		
		var MAX_MESSAGES_COUNT = 1000;
		
		// trust html in log messages
		$scope.trustedHTML = function (input) {
			var html = arguments.length > 1 && arguments[1] === true ? $filter('highlight')(input, $scope.search) : input;			
			return $sce.trustAsHtml(html);
		};
		 
		$scope.pkg = pkg;
		$scope.config = config;
		
		// log messages
		$scope.messages = [];
		$scope.sortBy = 'DATE';

		// Sorting (WIP)
		$scope.sortReverse = false;
		
		$scope.setSortField = function (field) {
			$scope.sortBy = field;
			$scope.sortReverse = !$scope.sortReverse;
			logger.info('Sorting by ', $scope.sortBy, $scope.sortReverse);
		};

		// pagination attributes
		$scope.perPage = 25;
		$scope.numPages = 0;
		$scope.page = $location.search().page ? parseInt($location.search().page, 10) : 1;
		
		// search attributes		
		$scope.search = null;
		
		// socket status	
		$scope.phases = socketEventHandler.event;
		$scope.phase = null;
		$scope.statusMessage = 'Initializing...';		
		
		$scope.getClass = function (message) {
			return 'log-' + message.PRIORITY;
		};
		
		$scope.pagesRange = function () {
			return _.range(1, $scope.numPages + 1, 1);
		};
		
		$scope.goToPage = function (page) {
			$location.search({
				page: page
			});
		};
		
		$scope.nextPage = function () {
			if ($scope.page < $scope.numPages) {
				$location.search({
					page: $scope.page + 1
				});
			}
		};
		
		$scope.prevPage = function () {
			if ($scope.page > 1) {
				$location.search({
					page: $scope.page - 1
				});
			}
		};
		
		$scope.$watch("messages", function (newValue, oldValue) {
			
			if (newValue.length === oldValue.length) {
				return;
			}
			
			// Prevent a infinitely growing message list
			if (newValue.length >= MAX_MESSAGES_COUNT) {
				// pop out last element
				do {
					newValue.pop();
				} while (newValue.length >= MAX_MESSAGES_COUNT);
			}
			
			$scope.numPages = Math.ceil(newValue.length / $scope.perPage);
		});
		
		$scope.$watch(function () {
			return $location.search();
		}, function (newValue, oldValue) {
			if (!newValue.page) {
				$scope.page = 1;
				return;
			}

			if (newValue.page === oldValue.page) {
				return;
			}
			
			if (newValue.page < 1) {
				$location.search({
					page: 1
				});
				
				return;
			}
			
			$scope.page = parseInt(newValue.page, 10);
		}, true);
		
		$scope.$on(socketEventHandler.event.CONNECTING, function () {
			$scope.phase = socketEventHandler.event.CONNECTING;
			$scope.statusMessage = 'Connecting to log data source...';
		});
		
		$scope.$on(socketEventHandler.event.RECONNECTING, function () {
			$scope.phase = socketEventHandler.event.CONNECTING;
			$scope.statusMessage = 'Reconnecting to log data source...';
		});
		
		$scope.$on(socketEventHandler.event.CONNECT, function () {
			$scope.phase = socketEventHandler.event.CONNECT;
			$scope.statusMessage = null;
		});
		
		$scope.$on(socketEventHandler.event.RECONNECT, function () {
			$scope.phase = socketEventHandler.event.CONNECT;
			$scope.statusMessage = null;
		});
		
		$scope.$on(socketEventHandler.event.ERROR, function () {
			$scope.phase = socketEventHandler.event.ERROR;
			$scope.statusMessage = 'Error connecting to log data source...';
		});
		
		$scope.$on(socketEventHandler.event.DISCONNECT, function () {
			$scope.phase = socketEventHandler.event.DISCONNECT;
			$scope.statusMessage = 'Disconnected from log data source...';
		});
		
		$scope.clear = function () {
			
			logger.info("clearing all log messages");
			
			$scope.search = null;
			$scope.messages = [];
			$scope.page = 1;
		};
		
		$scope.refresh = function () {			
			scope.clear();
			socketEventHandler.emit('fetchAll');
		};

		// Get log messages as they come				
		socketEventHandler.on('log', function (data) {
			$scope.$apply(function (s) {
				s.status = '';
				
				if (s.messages.length === MAX_MESSAGES_COUNT) {
					s.messages.pop();
				}
				
				s.messages.unshift(data);
			});
		});
		
		// Keep all logs
		socketEventHandler.on('logs', function (data) {
			$scope.$apply(function (s) {			
				var slicedData = data.length >= MAX_MESSAGES_COUNT ? data.slice(0, MAX_MESSAGES_COUNT - 1) : data;
				
				if (slicedData.length < data.length) {
					logger.log('truncated ' + (data.length - slicedData.length) + ' messages');
				}
				
				s.messages = slicedData;
			});
		});
	});
