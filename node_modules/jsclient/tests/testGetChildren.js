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
            return gateway.activate();
        })
        .then(function (gateway) {
            var attributes = {
              manufacturer: "My Dude",
              endpointName: "Dude!",
              description: "node description"
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
            console.log(chalk.bold("Children:"), response);
        })
        .catch(function (error) {
            console.log(chalk.bold.red("*** Error ***"));
            console.log(error.body || error);
            console.trace();
        });
});
