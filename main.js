var fs = require("fs");
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var file = "peertracker.db";
var Kismet = require("kismet");
var WebSocketServer = require('ws').Server;


Array.prototype.contains = function (element) {
    return this.indexOf(element) > -1;
};

function initDB() { 
	var exists = fs.existsSync(file);
	var sqlite3 = require("sqlite3").verbose();
	db = new sqlite3.Database(file);
	
	// assumes compatible schema if the db file already exists
	// otherwise, create the db file and tables that we need
	db.serialize(function() {
		if(!exists) {
			db.run("CREATE TABLE client (" +
						"mac TEXT," + 
						"bssid TEXT," +
						"manuf TEXT)")
			db.run("CREATE TABLE bssid (" +
						"bssid TEXT," +
						"manuf TEXT)")
			db.run("CREATE TABLE clientObs (" +
						"clientID INT," +
						"channel TEXT," +
						"signal_dbm TEXT," +
						"lasttime TEXT)")
			db.run("CREATE TABLE bssidObs (" +
						"bssidID INT," +
						"channel TEXT," +
						"signal_dbm TEXT," +
						"lasttime TEXT)")
		}
	
	// We are only recording data from the kismet server, not modifying, so
	// define the INSERT statements that we'll use for each of the tables
	sqlInsertClient = db.prepare("INSERT INTO client VALUES (?,?,?)");
	sqlInsertBSSID = db.prepare("INSERT INTO bssid VALUES (?,?)");
	sqlInsertClientObs = db.prepare("INSERT INTO clientObs VALUES (?,?,?,?)");
	sqlInsertBSSIDObs = db.prepare("INSERT INTO bssidObs VALUES (?,?,?,?)");
	});
}

var peertracker = function () {
    var self = this;
		console.log('ready!')
    self.k = new Kismet(
		config.host,
		config.port,
		config.sourceAddress);

	// initialize the arrays for tracking devices seen by Kismet
	self.CLIENTS_DETECTED = [];
    self.FOUND_BSSIDS =  [];

	// initialize SQLite database
	initDB()
	
    // Get the list of MAC addresses from the config.json file to ignore
    self.VALID_MACS = config.validMACs
	// and the list of BSSIDs to ignore, too
    self.VALID_BSSIDS = config.validBSSIDs

    self.k.on('ready', function () {
        var self = this;

        console.log('ready!')

        this.subscribe('bssid'
            , ['bssid', 'manuf', 'channel', 'type', 'signal_dbm', 'lasttime']
            , function (had_error, message) {
                console.log('bssid - ' + message)
            }
        )
        this.subscribe('ssid'
            , ['ssid', 'mac', 'cryptset', 'type', 'packets', 'lasttime']
            , function (had_error, message) {
                console.log('ssid - ' + message)
            })
        this.subscribe('client'
            , ['bssid', 'mac', 'manuf', 'channel', 'type', 'signal_dbm', 'lasttime']
            , function (had_error, message) {
                console.log('client - ' + message)
                
            })


        // output all known sentences & fields
        //console.log('protocols:')
        //console.log(k.protocols)
        //for( var i=0; i<k.protocols.length; i++){
        //k.command('CAPABILITY '+ k.protocols[i])
        //}

    });



    self.BSSID_Found = function(fields){
        var self = this;
        if (!self.VALID_BSSIDS.contains(fields.bssid)) {
            if(!self.FOUND_BSSIDS.contains(fields.bssid)){
                self.FOUND_BSSIDS.push(fields.bssid);
                console.log("New BSSID " + fields.bssid + " Detected" +
							" -Manuf: " + fields.manuf +
							" -dBm: " + fields.signal_dbm);
                self.printStats();
			
				sqlInsertBSSID.run(
					fields.bssid,
					fields.manuf
					)
            }else{
               //Uncomment this if you want to get spammed by BSSID traffic
               //console.log("Ignoring BSSID: " + fields.bssid);
            }
			// always record an observation, even if we've already seen it
			db.serialize(function() {
				db.each("SELECT rowid FROM bssid " +
						"WHERE bssid = '" + fields.bssid + "'",
					function(err, row) {
						if (row) {
							var bssidID = row.rowid
							sqlInsertBSSIDObs.run(
								bssidID,	//bssid table primary key
								fields.channel,
								fields.signal_dbm,
								fields.lasttime
								)
						}
					})
			})
        }
    };

    self.k.on('BSSID', function (fields) {
        //var self = this;
        self.BSSID_Found(fields);

    });



    self.SSID_Found = function(fields){
        var self = this;
        if  (fields.packets > 1) {


            //
            //    'Kismet sees ssid  : ' + fields.mac
            //    + ' type: ' + self.k.types.lookup('ssid', fields.type)
            //    + ' ssid: ' + fields.ssid
            //    + ' pkts: ' + fields.packets
            //    + ' cryptset: ' + fields.cryptset
            //)
        }
    };

    self.k.on('SSID', function (fields) {
        var self = this;
        //self.SSID_Found(fields);

    });

    //self.onData = function(fields){
    //    var self = this;
    //    if (fields.bssid != fields.mac) {
    //        if (!self.VALID_MACS.contains(fields.mac)) {
    //            console.log(
    //                'Unknown Client Detected: ' + fields.bssid
    //                + ' type: ' + self.k.types.lookup('client', fields.type)
    //                + ' mac: ' + fields.mac
    //            )
    //            self.ws.send(fields);
    //        }
    //
    //    }
    //}

    self.printStats = function(){
        console.log("Clients #"+ self.CLIENTS_DETECTED.length.toString() + " BSSIDS #" + self.FOUND_BSSIDS.length.toString());
    };

    self.f = function (fields) {
        var self = this;

        if (fields.bssid != fields.mac) {
            if (!self.VALID_MACS.contains(fields.mac)) {
                if(!self.CLIENTS_DETECTED.contains(fields.mac)){
                    self.CLIENTS_DETECTED.push(fields.mac);
                    console.log("New CLIENT " + fields.mac + " Detected" +
							" -Manuf: " + fields.manuf +
							" -dBm: " + fields.signal_dbm);
                    self.printStats();
					
					sqlInsertClient.run(
						fields.mac,
						fields.bssid,
						fields.manuf
						)

                }else{
                }
				// always record an observation, even if we've already seen it
				db.serialize(function() {
					db.each("SELECT rowid FROM client " +
							"WHERE mac = '" + fields.mac + "'",
						function(err, row) {
							if (row) {
								var clientID = row.rowid
								sqlInsertClientObs.run(
									clientID,	//client table primary key
									fields.channel,
									fields.signal_dbm,
									fields.lasttime
									)
							}
						})
				})
            }
        }
    };

    //self.k.on('CLIENT', self.f);


    self.k.on("CLIENT", function (fields) {
        fields.msg_type = "CLIENT";
        self.f(fields);

        //post the new client data to the websockets connected
    });

//-===============================
//Database Stuff


//var k = new Kismet('BBB',2501,'192.168.1.133');


    self.k.on("connect", function () {
        console.log("Connected to Kismet Client");
    });

    self.k.connect();


};

peertracker.prototype.sendToWebSocket = function(message){
    var self = this;
   // ws.send(message);
    self.ws.clients.forEach(function each(client) {
        client.send(JSON.stringify(message));
    });
}

peertracker.prototype.init = function(){
	var self = this;
    //-===============================
    //Websocket Code

    ws = new WebSocketServer({port: 8080});

    ws.on('connection', function (ws) {
        console.log("WebSocket Connected...");
    });

    ws.on('message', function (message) {
        console.log('received: %s', message);
    });

//    TODO: why does this not work
    // this.ws.on('close', function(ws){
        // console.log("Client Disconnected....");
    // });
};


module.exports = peertracker;


//This kicks our server off

var pt = new peertracker();
pt.init();


