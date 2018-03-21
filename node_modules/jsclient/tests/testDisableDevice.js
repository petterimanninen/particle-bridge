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
            console.log(
                chalk.bold("Device Activated. ID:"),
                chalk.cyan(device.getID())
            );
            return device.disable();
        })
        .then(function (response) {
            console.log(
                chalk.bold("Device disabled\n"),
                (response.body || response)
            );
//            Only activated devices can be disabled
//            return iot.createDevice(sharedSecret);
        })
//        .then(function (device) {
//            console.log(
//                chalk.bold("Second device created: "),
//                chalk.cyan(device.getID()),
//                chalk.underline(answers.iotBaseURL + "/" + iot.DEVICES_URL + "/" + device.getID())
//            );
//            return device.disable();
//        })
//        .then(function (response) {
//            console.log(
//                chalk.bold("Second Device disabled (not activation)\n"),
//                (response.body || response)
//            );
//        })
        .catch(function (error) {
            console.log(chalk.bold.red("*** Error ***"));
            console.log(error.body || error);
            console.trace();
        });
});
