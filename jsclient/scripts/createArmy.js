
'use strict';

var IoTServer = require("../iot");
var inquirer = require("inquirer");
var chalk = require('chalk');
var nameGenerator = require("../nameGenerator");


var DIRECTLY_CONNECTED_COUNT = 240; //Number of directly connected devices
var GATEWAY_LIKELIHOOD = 0.5; //Likelihood a DCD has children
var ACTIVATION_LIKELIHOOD = 0.5; //Likelihood a DCD without children will activate
var DISABLED_LIKELIHOOD = 0.25; //Likelihood to diabled DCD (after it is activated)
var REJECT_LIKELIHOOD = 0.25; //Likelihood to reject DCD (if not activated)
var GATEWAY_CHILDREN_MIN = 10; //Min number of children for a gateway
var GATEWAY_CHILDREN_MAX = 30; //Max number of children for a gateway
var BATCH_SIZE = 100;
var REST_TIME = 100;

var manufactures =
 ['United Technologies', 'Toshiba', 'Sumitomo', 'Sinomach', 'Siemens', 'Schneider Electric', 'Panasonic',
'Norinco', 'Mitsui', 'Mitsubishi', 'Johnson Controls', 'Hyundai Heavy Industries', 'Honeywell',
'Hitachi', 'Heraeus Holding', 'General Electric', 'Denso', 'Bosch', 'Alstom', 'ABB', '3M'];

var randomLetter = function() {
  var start = 'A'.charCodeAt();
  var letter = start + Math.floor(Math.random() * 26);
  return String.fromCharCode(letter);
};

var pad = function(size) {
  var input = parseInt(Math.random() * Math.pow(10, size));
  input = String(input);
  var padding = size - input.length;
  while (padding--) {
    input = '0' + input;
  }
  return input;
};

var makeModel = function() {
  var model = "";
  for (var i = 0; i < 4; i++) {
    model += randomLetter();
  }
  var n = pad(4);
  return model + '-' + n;
};

var modelsByManufacture = {};
manufactures.forEach(function(m) {
  //each manufacture will have between 4 and 8 models
  var count = 4 + Math.floor(Math.random() * 4);
  var models = [];
  for (var i = 0; i < count; i++) {
    models.push(makeModel());
  }
  modelsByManufacture[m] = models;
});

var randomManufacture = function() {
  var index = Math.floor(Math.random() * manufactures.length);
  return manufactures[index];
};

var randomModel = function(manufacture) {
  var models = modelsByManufacture[manufacture];
  var index = Math.floor(Math.random() * models.length);
  return models[index];
};

var randomSerial = function() {
  return pad(12);
};

inquirer.prompt([{
    type: "input",
    name: "iotBaseURL",
    message: "Enter the URL to the IoT Server",
    default: "http://iotserver:7101"
}], function(answers) {

    var iot = new IoTServer(answers.iotBaseURL);
    iot.setPrincipal('iot', 'welcome1');
    function Task(func) {
        this._func = func;
        this._args = Array.prototype.slice.call(arguments, 1);
        this.run = function() {
            return this._func.apply(null, this._args);
        };
    }

    var work = []; // list of Tasks
    var pendingWork = 0;
    var totalDevices = 0;
    var disabledDeviceCount = 0;
    var rejectDeviceCount = 0;
    var startTime = new Date().getTime();
    var batchIndex = 0;
    var errorCount = 0;
    var doWork = function() {
        if (work.length === 0 && pendingWork === 0) {
            var time = ((new Date().getTime()) - startTime) / 1000;
            console.log(chalk.bold("\n\n*******************************************"));
            console.log(
                chalk.bold("All work is done. Total devices created:"),
                chalk.cyan(totalDevices),
                chalk.bold("\nDisabled devices:"),
                chalk.cyan(disabledDeviceCount),
                chalk.bold("\nReject devices:"),
                chalk.cyan(rejectDeviceCount),
                chalk.bold("\nTime:"),
                chalk.cyan(time + " secs")
            );
            if (errorCount) {
                console.log(
                    chalk.bold("\nErrors:"),
                    chalk.red(errorCount)
                );
            }
            return;
        }
        console.log(chalk.bold("[Batch"), chalk.cyan(batchIndex),
                    chalk.bold(", queue size:"), chalk.cyan(work.length),
                    chalk.bold(", pending:"), chalk.cyan(pendingWork),
                    chalk.bold(", errors:"), chalk.cyan(errorCount),
                    chalk.bold("]"));
        batchIndex++;

        var count = 0;
        while (work.length > 0 && count++ < BATCH_SIZE) {
            var w = work.shift();
            if (w) {
                w.run();
            }
        }
        setTimeout(doWork, REST_TIME);
    };

    var getDeviceModels = function(type) {
        var DEVICE_MODELS = iot.DEVICE_MODELS;
        var DEVICE_MODELS_KEYS = Object.keys(DEVICE_MODELS);
        var dmKey = DEVICE_MODELS_KEYS[Math.floor(Math.random() * DEVICE_MODELS_KEYS.length)];
        var dm = [iot.CAPABILITIES.diagnostics];
        dm.push(DEVICE_MODELS[dmKey]);
        if (type === "GW") {
            dm.push(iot.CAPABILITIES.direct_activation);
            dm.push(iot.CAPABILITIES.indirect_activation);
        } else if (type === "DCD") {
            dm.push(iot.CAPABILITIES.direct_activation);
        }
        //Note: ICD does not have neither direct_activation nor indirect_activation
        return dm;
    };

    var createDevice = function() {
        var isGateway = Math.random() <= GATEWAY_LIKELIHOOD;
        var name = isGateway ? nameGenerator.generateGatewayName()
                             : nameGenerator.generateDeviceName();
        var manufactures = randomManufacture();
        var metadata = {
            description: "Nothing but a testing device",
            manufacturer: manufactures,
            modelNumber: randomModel(manufactures),
            serialNumber: randomSerial(),
            isGateway: isGateway,
        };
        pendingWork++;
        iot.createDevice("secret", name, null /*Not used in v2*/, metadata)
            .then(function(device) {
                console.log(chalk.bold("Device creating"), name, chalk.cyan("[ID:", device.getID(), "]"));
                totalDevices++;
                device.name = name;
                device.isGateway = isGateway;
                if (isGateway) {
                    work.push(new Task(activateDevice, device));
                } else {
                    if (Math.random() <= ACTIVATION_LIKELIHOOD) {
                        work.push(new Task(activateDevice, device));
                    } else {
                        if (Math.random() <= REJECT_LIKELIHOOD) {
                            work.push(new Task(rejectDevice, device));
                        }
                    }
                }
            })
            .catch(function(error) {
                try {
                    console.log(chalk.bold.red("Error creating", name));
                    console.log(error.body || error);
                } catch(e) {}
                errorCount++;
            })
            .then(function() {
                pendingWork--;
            });
    };

    var activateDevice = function(device) {
        pendingWork++;
        device.activate(getDeviceModels(device.isGateway ? "GW" : "DCD"))
            .then(function(d) {
                console.log(chalk.bold("Device activate"), d.name, chalk.cyan("[ID:", d.getID(), "]"));
                if (d.isGateway) {
                    var delta = GATEWAY_CHILDREN_MAX - GATEWAY_CHILDREN_MIN;
                    var count = GATEWAY_CHILDREN_MIN + Math.floor(Math.random() * delta);
                    console.log('\tRequesting', count, 'devices for', d.name);
                    for (var i = 0; i < count; i++) {
                        work.push(new Task(createIndirectDevices, d));
                    }
                } else {
                    if (Math.random() <= DISABLED_LIKELIHOOD) {
                        work.push(new Task(disableDevice, device));
                    }
                }
            })
            .catch(function(error) {
                try {
                    console.log(chalk.bold.red("Error activating", device.name, "[", device.getID(), "]"));
                    console.log(error.body || error);
                } catch(e) {}
                errorCount++;
            })
            .then(function() {
                pendingWork--;
            });
    };

    var createIndirectDevices = function(device) {
        var manufacturer = randomManufacture();
        var attributes = {
            endpointName: nameGenerator.generateDeviceName(),
            description: "Test JS Sensor",
            manufacturer: manufacturer,
            productClass: randomModel(manufacturer),
            serialNumber: randomSerial(),
            deviceModels: getDeviceModels("ICD")
        };
        pendingWork++;
        device.indirectEnrollDevice(attributes)
            .then(function (response) {
                totalDevices++;
                console.log(
                    chalk.bold("Indirect device created"),
                    attributes.endpointName,
                    chalk.cyan("[ID:", response.body.endpointId, "]"),
                    chalk.bold("| Gateway"),
                    device.name,
                    chalk.cyan("[ID:", device.getID(), "]")
                );
            })
            .catch(function (error) {
                try {
                    console.log(chalk.bold.red("Error creating indirect device", device.name, "Gateway", device.name, "[", device.getID(), "]"));
                    console.log(error.body || error);
                } catch(e) {}
                errorCount++;
            })
            .then(function() {
                pendingWork--;
            });
    };

    var disableDevice = function(device) {
        pendingWork++;
        device.disable()
            .then(function(d) {
                console.log(chalk.bold("Device disabled"), d.name, chalk.cyan("[ID:", device.getID(), "]"));
                disabledDeviceCount++;
            })
            .catch(function(error) {
                try {
                    console.log(chalk.bold.red("Error disabling", device.name, "[", device.getID(), "]"));
                    console.log(error.body || error);
                } catch(e) {}
                errorCount++;
            })
            .then(function() {
                pendingWork--;
            });
    };

    var rejectDevice = function(device) {
        pendingWork++;
        /* Reject is not standard IoT device state, but the UI consider a REGISTERED device
        * as reject if the connectitivityStatus is different than NEVER_HEARD.
        * The following code will do that.
        */
        device.requestActivationToken()
            .then(function(d) {
                console.log(chalk.bold("Device reject"), d.name, chalk.cyan("[ID:", device.getID(), "]"));
                rejectDeviceCount++;
            })
            .catch(function(error) {
                try {
                    console.log(chalk.bold.red("Error rejecting", device.name, "[", device.getID(), "]"));
                    console.log(error.body || error);
                } catch(e) {}
                errorCount++;
            })
            .then(function() {
                pendingWork--;
            });
    };

    //Get this going
    for (var i = 0; i < DIRECTLY_CONNECTED_COUNT; i++) {
        work.push(new Task(createDevice));
    }
    doWork();
});
