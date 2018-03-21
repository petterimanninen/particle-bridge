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
            console.log(chalk.bold("Gateway created: ") + chalk.cyan(gateway.getID()));
            return gateway.activate([iot.CAPABILITIES.direct_activation, iot.CAPABILITIES.indirect_activation]);
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
            // leaking endointId
            return device.delete();
        })
        .then(function (gateway) {
            console.log(chalk.bold("Gateway deleted."));
        })
        .catch(function (error) {
            console.log(chalk.bold.red("*** Error ***"));
            console.log(error.body || error);
            console.trace();
            if (device) device.delete();
        });
});
