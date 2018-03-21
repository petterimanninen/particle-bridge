"use strict";
/* jshint esnext: true */

var IoTServer = require("../iot");
var inquirer = require("inquirer");
var commander = require("commander");
var chalk = require("chalk");

var TIMEOUT = 1000 * 60 * 30;
//var INCOME_MESSAGE_LIKELIHOOD = 0.25;
var WEEKDAY_ACTIVITY = {
    "0": 0.3,
    "1": 0.7,
    "2": 0.65,
    "3": 0.6,
    "4": 0.8,
    "5": 0.7,
    "6": 0.3,
};

var DEVICE_MODELS = IoTServer.prototype.DEVICE_MODELS;

var FORMATS = {};
FORMATS[DEVICE_MODELS.HUMIDITY_SENSOR] = {
    name: "humidity",
    alertDescription: "This is too wet for my liking",
    min_range: 0,
    max_range: 100,
    alert_threshold: 90
};
FORMATS[DEVICE_MODELS.TEMPERATURE_SENSOR] = {
    name: "temperature",
    alertDescription: "It is getting HOT in here",
    min_range: -50,
    max_range: 50,
    alert_threshold: 35
};
FORMATS[DEVICE_MODELS.LOCATION_SENSOR] = {
    name: "location",
    alertDescription: "This device is not where it is suppose to be!",
    min_range: 0,
    max_range: 360,
    alert_threshold: 345

};
FORMATS[DEVICE_MODELS.WEIGHT_SENSOR] = {
    name: "weight",
    alertDescription: "Too heavy, must stop eating candy and join a gym",
    min_range: 50,
    max_range: 220,
    alert_threshold: 200

};
FORMATS[DEVICE_MODELS.AMPERAGE_SENSOR] = {
    name: "amperage",
    alertDescription: "The current is super height!",
    min_range: 10,
    max_range: 50,
    alert_threshold: 45

};
FORMATS[DEVICE_MODELS.VOLTAGE_SENSOR] = {
    name: "voltage",
    alertDescription: "The voltage is too high!",
    min_range: 100,
    max_range: 130,
    alert_threshold: 127
};

//this is sub list of create army list - so that some devices will remain offline
var MANUFACTURES =
 ['United Technologies', 'Toshiba', 'Sumitomo', 'Sinomach', 'Siemens', 'Schneider Electric', 'Panasonic',
'Norinco', 'Mitsui', 'Mitsubishi', 'Johnson Controls', 'Hyundai Heavy Industries', 'Honeywell',
/*'Hitachi', 'Heraeus Holding', 'General Electric', 'Denso', 'Bosch', 'Alstom', 'ABB', '3M'*/];

var Simulator = function(iotBaseURL, timeout) {
    var self = this;

    this.totalMessages = 0;
    this.totalAlerts = 0;
    this.totalErrors = 0;
    this.startTime = 0;
    this._devicesMap = {}; //Used to count unique devices
    this._timeout = timeout || TIMEOUT;

    console.log(chalk.bold("IoT Server:"), chalk.cyan(iotBaseURL));
    console.log(chalk.bold("Timeout:"), chalk.cyan(this._timeout));
    this.iot = new IoTServer(iotBaseURL);
    this.iot.setPrincipal('iot', 'welcome1');

    this.start = function() {
        this.startTime = new Date().getTime();
        this.simulate();
        this._timer = setInterval(() => self.simulate(), this._timeout);
    };

    this.stop = function() {
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = null;
        }
    };

    this.simulate = function() {
        var timeEllapsed = ((new Date().getTime()) - this.startTime) / 1000;
        var totalDevices = Object.keys(this._devicesMap).length;
        console.log(chalk.bold("Total unique device:"), chalk.cyan(totalDevices));
        console.log(chalk.bold("Total messages:"), chalk.cyan(this.totalMessages));
        console.log(chalk.bold("Total alerts:"), chalk.cyan(this.totalAlerts));
        if (this.totalErrors) {
            console.log(chalk.bold("Total errors:"), chalk.red(this.totalErrors));
        }
        console.log(chalk.bold("Time ellapsed:"), chalk.cyan(timeEllapsed + "(ms)"));
        MANUFACTURES.forEach(m =>
            self.handleManufacturer(m)
        );
    };

    this.handleManufacturer = function(manufacturer) {
        var iot = this.iot;
        var query = {$and: [
            {state: "ACTIVATED"},
            {$or: [
                {type: "DIRECTLY_CONNECTED_DEVICE"},
                {type: "GATEWAY"}
            ]},
            {manufacturer: manufacturer}
        ]};
        iot.listDevices(query, 0, 200)
            .then(body => {
                body.items.forEach(item => {
                    var device = iot.provisionDevice(item.id, "", "ACTIVATED");
                    device.type = item.type;
                    device.deviceModels = item.deviceModels;
                    device.name = item.name;
                    self.handleDevice(device);
                });
            })
            .catch(error => {
                self.totalErrors++;
                console.log(chalk.bold.red("*** Error in handleManufacturer ***"));
                console.log(error.statusMessage || error);
            });
    };

    this.handleDevice = function(device) {
        this._devicesMap[device.getID()] = true;

        if (device.type === "DIRECTLY_CONNECTED_DEVICE") {
            self.handleSendMessage(device);
        } else {
            device.getChildren()
                .then(children => {
                    children.items.forEach(child => {
                       self.handleSendMessage(child, device);
                    });
                });
        }
    };

    this.handleSendMessage = function(device, parentDevice) {
        var formatName = null;
        var i = 0;
        for (i = 0; i < device.deviceModels.length; i++) {
            var dm = device.deviceModels[i];
            if (FORMATS[dm.urn]) {
                formatName = dm.urn;
                break;
            }
        }
        if (formatName) {
            var format = FORMATS[formatName];
            var day = new Date().getDay();
            var dayActivity = WEEKDAY_ACTIVITY[day];
            var maxValue = Math.max();
            var messageCount = parseInt((Math.random() + dayActivity) * 4);
            var messages = [];
            while (messageCount-- > 0) {
                var value = format.min_range + Math.floor(Math.random() * (format.max_range - format.min_range + 1));
                maxValue = Math.max(maxValue, value);
                var message = {};
                message[format.name] = String(value);
                messages.push(message);
            }

            /* Send Message */
            var dataFormat = formatName + ":data";
            var msgPromise;
            if (parentDevice) {
                msgPromise = parentDevice.sendDataMessages(dataFormat, messages, device.id);
//                console.log("ICD:", device.id, parentDevice.getID(), dataFormat, messages);
            } else {
                msgPromise = device.sendDataMessages(dataFormat, messages);
//                console.log("DCD:", device.getID(), dataFormat, messages);
            }
            msgPromise
                .then(() => {
                    self.totalMessages += messages.length;
                })
                .catch(error => {
                    self.totalErrors++;
                    console.log(chalk.bold.red("*** Error sending message", device.getID()));
                    console.log(error.statusMessage || error);
                });

            /* Check and send alerts */
            if (maxValue > format.alert_threshold) {

                var alertFormat = formatName + ":alert:bad:" + format.name;
                var alert = {};
                alert[format.name] = String(maxValue);
                var alertPromise;
                if (parentDevice) {
                    alertPromise = parentDevice.sendAlerts(alertFormat, format.alertDescription, "NORMAL", alert, device.id);
                } else {
                    alertPromise = device.sendAlerts(alertFormat, format.alertDescription, "NORMAL", alert);
                }
                alertPromise
                    .then(() => {
                        self.totalAlerts++;
                    })
                    .catch(error => {
                        self.totalErrors++;
                        console.log(chalk.bold.red("*** Error sending alert", device.getID()));
                        console.log(error.statusMessage || error);
                    });
            }
        }
    };

};

/* Start up code - using commander to make is simpler to run with npm */
commander
  .version("0.0.1")
  .option("-u, --iot-url <url>", "The URL to the IoT Cloud Server")
  .option("-t, --timeout [miliseconds]", "The timeout for the simulation step", parseInt)
  .parse(process.argv);

if (commander.iotUrl) {
    var sim = new Simulator(commander.iotUrl, commander.timeout);
    sim.start();
} else {
    inquirer.prompt([{
        type: "input",
        name: "iotUrl",
        message: "Enter the URL to the IoT Server",
        default: "http://iotserver:7101"
    },{
        type: "input",
        name: "timeout",
        message: "The timeout for the simulation step",
        default: TIMEOUT
    }], answers => {
        var sim = new Simulator(answers.iotUrl, parseInt(answers.timeout));
        sim.start();
    });
}
