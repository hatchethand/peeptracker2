var fs = require("fs");
var config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
var file = "peertracker.db";
var exists = fs.existsSync(file);
var Kismet = require("kismet");
var WebSocketServer = require('ws').Server;


Array.prototype.contains = function (element) {
    return this.indexOf(element) > -1;
};

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
  
    // Get the list of MAC addresses from the config.json file to ignore
    self.VALID_MACS = config.validMACs
	// and the list of BSSIDs to ignore, too
    self.VALID_BSSIDS = config.validBSSIDs

    self.k.on('ready', function () {
        var self = this;

        console.log('ready!')

        this.subscribe('bssid'
            , ['bssid', 'manuf', 'channel', 'type', 'signal_dbm']
            , function (had_error, message) {
                console.log('bssid - ' + message)
            }
        )
        this.subscribe('ssid'
            , ['ssid', 'mac', 'cryptset', 'type', 'packets']
            , function (had_error, message) {
                console.log('ssid - ' + message)
            })
        this.subscribe('client'
            , ['bssid', 'mac', 'manuf', 'channel', 'type', 'signal_dbm']
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
            }else{
               //Uncomment this if you want to get spammed by BSSID traffic
               //console.log("Ignoring BSSID: " + fields.bssid);
            }
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

                }else{

                }

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
        console.log("Connected to Kistmet Client");
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


