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
    var device;
    iot.createDevice(sharedSecret, "JS Gateway")
        .then(function (gateway) {
            device = gateway;
            console.log(chalk.bold("Device created: ") + chalk.cyan(gateway.getID()));
            return gateway.activate(iot.DEVICE_MODELS.TEMPERATURE_SENSOR);
        })
        .then(function (gateway) {
            console.log(chalk.bold("Device Activated: ") + chalk.cyan(gateway.getState()));
            var data = [{temperature: "182"}, {temperature: "213"}, {temperature: "16"}, {temperature: "11"}];
            var format = iot.DEVICE_MODELS.TEMPERATURE_SENSOR + ":data";
            return gateway.sendDataMessages(format, data);
        })
        .then(function (response) {
            console.log(chalk.bold("Messages sent. Response: "), response.body);
            return device.delete();
        })
        .then(function (gateway) {
            console.log(chalk.bold("Device deleted."));
        })
        .catch(function (error) {
            console.log(chalk.bold.red("*** Error ***"));
            console.log(error.body || error);
            console.trace();
            if (device) device.delete();
        });
});
