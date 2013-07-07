# syslogng-web

Webapp which shows syslog-ng logs from mongodb sources

## Installing syslogng-web

Follow the instructions below to setup a fully working copy of syslogng-web on your host.

### Configuring syslog-ng

For syslogng-web to work, it is necessary to enable MongoDB support. Ensure your syslog-ng copy
supports MongoDB before continuing.

You need to configure a mongodb destination and map it to a log source. Open up /etc/syslog-ng/syslog-ng.conf 
and add the following lines:

```
destination mongodb { mongodb(); }
log { source(src); destination(mongodb); };
```

Additional options are available for the mongodb configuration. Please read syslog-ng's documentation for 
further information.

When you are done editing /etc/syslog-ng/syslog-ng.conf, restart the syslog-ng service.

### Installing syslogng-web

Next you have to install a copy of syslogng-web on your server:

```
git clone https://github.com/nlaplante/syslogng-web.git
cd syslogng-web
```

Since syslogng-web is a node.js application, ensure you have the latest node.js version installed on your server. Then,
install the dependencies:

```
npm install
```

### Configuration

Next, you need to tell syslogng-web how to connect to the MongoDB databases which holds the log messages. 
By default, the mongodb driver for syslog-ng creates a database named 'syslog' and stores the log messages
in a collection called 'messages'. If your setup is different, edit config.json and replace the host, port and/or collection
configuration properties to suit your setup.

### Running

Running syslogng-web is as simple as running any other node.js application:

```
node app.js
```

To test if everything is working correctly, open a brower at http://your-server:3000. The log messages should appear 
shortly after. It is not necessary to reload the page to see changes, as syslogng-web uses socket.io to update
its content as it gets logged.
