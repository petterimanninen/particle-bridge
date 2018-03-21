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
    iot.createDevice(sharedSecret)
        .then(function (gateway) {
            device = gateway;
            console.log(chalk.bold("Gateway created: ") + chalk.cyan(gateway.getID()));
            return gateway.activate([iot.CAPABILITIES.direct_activation, iot.CAPABILITIES.indirect_activation]);
        })
        .then(function (gateway) {
            var attributes = {
              manufacturer: "My Dude",
              endpointName: "Device that sends message",
              description: "This device sends temp messages",
              deviceModels: [iot.DEVICE_MODELS.TEMPERATURE_SENSOR]
            };
            return gateway.indirectEnrollDevice(attributes);
        })
        .then(function (response) {
            console.log(
              chalk.bold("Indirect Device enrolled. ID:"),
              chalk.cyan(response.body.endpointId));
            return device.getChildren();
        })
        .then(function (response) {
            var child = response.items[0];
            console.log(chalk.bold("Child device:"), chalk.cyan(child.id));
            var data = [{temperature: "182"}, {temperature: "213"}, {temperature: "16"}, {temperature: "11"}];
            var format = iot.DEVICE_MODELS.TEMPERATURE_SENSOR + ":data";
            return device.sendDataMessages(format, data, child.id);
        })
        .then(function (response) {
            console.log(chalk.bold("Messages sent"), (response.body || response));
        })
        .catch(function (error) {
            console.log(chalk.bold.red("*** Error ***"));
            console.log(error.body || error);
            console.trace();
        });
});
