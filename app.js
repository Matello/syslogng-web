/**
 * Module dependencies.
 */

var express = require('express'), 
	routes = require('./routes'), 
	http = require('http'), 
	path = require('path'), 
	sio = require('socket.io'),
	config = require('./config'),
	pkg = require('./package'),
	q = require('q'),
	SyslogNGMongoLogAdapter = require('services/SyslogNGMongoLogAdapter');

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.favicon(__dirname + '/public/images/favicon.ico'));
app.use(express.logger('dev'));
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
	app.use(express.errorHandler());
}

// routes
app.get('/', routes.index);
app.get('/views/main', routes.main);

// socket.io to stream log messages
var server = http.createServer(app);
var io = sio.listen(server);

// Reduce log messages in production environment (WARN & ERROR)
io.set('log level', process.env.NODE_ENV === 'production' ? 1 : 3);

console.log('initializing subsystem');

// This promise will be resolved when the adapter is ready
var subsystemUpDeferred = q.defer();

var logAdapter = new SyslogNGMongoLogAdapter(config);

io.sockets.on('fetchAll', function (socket) {
	logAdapter.getLogs(function (err, logs) {
		if (err) {
			return console.error(err);
		}
		
		socket.emit('logs', logs);
	});
});

io.sockets.on('connection', function (socket) {
	logAdapter.getLogs(function (err, logs) {
		if (err) {
			return console.error(err);
		}
		
		socket.emit('logs', logs);
	});
});

logAdapter.onStreamData(function (err, data) {
	if (err) {
		return console.error(err);
	}
	
	io.sockets.emit('log', data);
});

logAdapter.open(function (err) {
	if (err) {
		return subsystemUpDeferred.reject(err);
	}
	
	// subsystem is ready
	subsystemUpDeferred.resolve();
});

// shutdown listener
server.on('close', function () {
	logAdapter.close(function (err) {
		
		var returnValue = 0;
		
		if (err) {
			console.error(err);
			returnValue = 1;
		}	
		
		// exit process
		console.log('  ...Goodbye!');
		process.exit(returnValue);
	});
});

// catch SIGTERM and SIGINT
var shutdown = function () {
	console.log('syslog-ng ' + pkg.version + ' shutting down');
	server.close();
};

process.on('SIGTERM', shutdown).on('SIGINT', shutdown);

// start the server
subsystemUpDeferred.promise.then(function () {
	server.listen(app.get('port'), function() {
		console.log('syslogng-web ' + pkg.version + ' listening on port ' + app.get('port'));
	});
}, function (err) {
	console.error('An error occured while setting up syslogng-web:', err.message);
	console.error('Bail out');
	process.exit(1);
});

