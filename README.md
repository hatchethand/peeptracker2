# What is peeptracker2?
Peeptracker2 is a node.js project for tracking wifi devices (people) around you.  This project was started from an idea my buddy (Tim) had.  The idea was to be able to detect people around your house 24 hours a day.  What most people do not know is cellphones (any wifi enabled devices) beacon (search for) their trusted wifi accesspoints.  So if you have an accesspoint of "SUPER_SECRET_HOME_AP" then every where you go (while your wifi is enabled) your device is beaconing for this access point.  

# Background
This all started from someone "breaking" into my car.  I had left my car door unlocked and they went through the car looking for money.  Luckly for me nothing was taken but it still *upset* me.  So this is a result of me being violated and wanting to know by who.

# Want to help?
Ideas we still need to introduce:
* Rules - If this then that etc...
* Notifications - I saw a new device... Your neigbor is using his tablet. etc.
* BSSID lookups?
* What else?



# Configuration
Example config.json
```
{
	"host": "192.168.1.1",
	"port": 2501,
	"sourceAddress": "192.168.1.2",
	"validMACs":
		[
			"00:00:00:00:00:00",
			"11:11:11:11:11:11"
		],
	"validBSSIDs":
		[
			"22:22:22:22:22:22",
			"33.33.33.33.33.33"
		]
}
```
