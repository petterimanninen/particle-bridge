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
    console.log(chalk.bold("Initial IoT Version: ") + chalk.cyan(iot.getVersion()));

    var d = null;
    iot.checkVersion()
        .then(function (version) {
            console.log(chalk.bold("IoT Version: ") + chalk.cyan(version), "[getVersion =", iot.getVersion(), "]");
            return iot.createDevice("sharedSecret");
        })
        .then(function (device) {
            d = device;
            console.log(chalk.bold("Device created: ") + chalk.cyan(device.getID()));
            return device.activate();
        })
        .then(function (device) {
            console.log(chalk.bold("Device Activated: ") + chalk.cyan(device.getState()));
            var data = [{temp: 182}, {temp: 213}, {temp: 16}, {temp: 11}];
            return device.sendDataMessages("jsclient:temperature", data);
        })
        .then(function (response) {
            console.log(chalk.bold("Messages sent. Response: "), response.body);
            return d.delete();
        })
        .then(function (gateway) {
            console.log(chalk.bold("Device deleted."));
        })
        .catch(function (error) {
            console.log(chalk.bold.red("*** Error ***"));
            console.log(error.body || error);
            if (d) d.delete();
        });
});
