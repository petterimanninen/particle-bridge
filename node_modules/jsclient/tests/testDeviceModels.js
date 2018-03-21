'use strict';

var IoTServer = require("../iot");
var inquirer = require("inquirer");
var chalk = require('chalk');

inquirer.prompt([{
    type: "input",
    name: "iotBaseURL",
    message: "Enter the URL to the IoT Server",
    default: "http://iotserver:7101"
}], function(answers) {

    var iot = new IoTServer(answers.iotBaseURL);
    iot.setPrincipal('iot', 'welcome1');

    var sharedSecret = "secret";
    iot.createDevice(sharedSecret)
        .then(function (device) {
            console.log(
                chalk.bold("Device created: "),
                chalk.cyan(device.getID()),
                chalk.underline(answers.iotBaseURL + "/" + iot.DEVICES_URL + "/" + device.getID())
            );
            var deviceModels = [iot.DEVICE_MODELS.AMPERAGE_SENSOR, iot.DEVICE_MODELS.HUMIDITY_SENSOR];
            return device.activate(deviceModels);
        })
        .then(function (device) {
            var attributes = {
              manufacturer: "IDC+DMs",
              description: "node description",
              deviceModels: [iot.DEVICE_MODELS.LOCATION_SENSOR]
            };
            return device.indirectEnrollDevice(attributes);
        })
        .then(function (response) {
            console.log(
                chalk.bold("Indirect Device enrolled. ID:"),
                chalk.cyan(response.body.endpointId),
                chalk.underline(answers.iotBaseURL + "/" + iot.DEVICES_URL + "/" + response.body.endpointId)
            );
        })
        .catch(function (error) {
            console.log(chalk.bold.red("*** Error ***"));
            console.log(error.body || error);
            console.trace();
        });
});
