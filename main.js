var fs = require("fs");
var file = "peertracker.db";
var exists = fs.existsSync(file);
var Kismet = require("kismet");
var WebSocketServer = require('ws').Server;


Array.prototype.contains = function (element) {
    return this.indexOf(element) > -1;
};

var peertracker = function () {
    var self = this;
    self.k = new Kismet('192.168.1.133',2501,'192.168.1.106');
//    self.k = new Kismet();

    self.CLIENTS_DETECTED = [];

    self.IGNORED_BSSIDS = [
        '48:F8:B3:92:F7:E4'
    ];

    self.FOUND_BSSIDS =  [];

  
    //TODO: change this to a valid_macs.txt file vs in code.
    self.VALID_MACS = [
        //'CC:B2:55:93:C9:82',
        //'54:42:49:D3:3E:12',
        //'80:BE:05:A2:36:63',
        //'00:23:63:29:7F:A7',
        //'8C:2D:AA:2D:71:0F',
        //'B8:F6:B1:1A:61:9B',
        //'6C:AD:F8:04:98:05',
        //'04:54:53:01:A6:CE',
        //'B8:E9:37:8E:4F:70',
        //'58:55:CA:51:E2:69',
        //'D0:E7:82:EE:C6:9F',
        //'18:B4:30:02:61:43',
        //'00:0D:4B:DC:EF:49',
        //'B8:E9:37:76:56:42',
        //'E0:B9:BA:AE:15:8C',
        //'B8:E9:37:3C:F5:02',
        //'FC:C2:DE:36:FD:71',
        //'C0:F2:FB:36:F5:B9',
        //'18:B4:30:2D:3E:39',
        //'B8:E9:37:8E:50:1E',
        //'BC:F5:AC:DF:DA:DD',
        //'60:67:20:28:43:10',
        //'7C:66:9D:53:6C:72',
        //'B8:E9:37:61:4C:72',
        //'7C:66:9D:53:6C:72',
        //'1C:3E:84:8B:56:A6',
        //'00:22:75:24:7F:BC'
    ];


    self.k.on('ready', function () {
        var self = this;

        console.log('ready!')

        this.subscribe('bssid'
            , ['bssid', 'manuf', 'channel', 'type']
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
            , ['bssid', 'mac', 'type']
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
        if (!self.IGNORED_BSSIDS.contains(fields.bssid)) {
            if(!self.FOUND_BSSIDS.contains(fields.bssid)){
                self.FOUND_BSSIDS.push(fields.bssid);
                console.log("New BSSID " + fields.bssid + " Detected. - Manuf: " + fields.manuf);
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
                    console.log("New CLIENT " + fields.mac + " Detected.");
                    self.printStats();
                    self.sendToWebSocket(fields);

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

    this.ws = new WebSocketServer({port: 8080});

    this.ws.on('connection', function (ws) {
        console.log("WebSocket Connected...");
    });

    this.ws.on('message', function (message) {
        console.log('received: %s', message);
    });

    //TODO: why does this not work
    this.ws.on('close', function(ws){
        console.log("Client Disconnected....");
    });
};


module.exports = peertracker;


//This kicks our server off

var pt = new peertracker();

pt.init();


