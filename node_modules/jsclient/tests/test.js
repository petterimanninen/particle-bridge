// Set the proxy
//  npm config set proxy http://www-proxy.us.oracle.com:80
//  npm config set https-proxy http://www-proxy.us.oracle.com:80
//
// (The bellow can go away when I fix package.json)
// npm install request
// npm install node-uuid
// npm install chalk
// npm install require

//  run:
//  node test
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
            return gateway.requestActivationToken();
        })
        .then(function (gateway) {
            console.log(chalk.bold("Activation token acquired: ")
                + chalk.cyan(JSON.stringify(gateway.getAuthorizationHeaders())));
            return gateway.requestActivationPolicy();
        })
        .then(function (gateway) {
            console.log(chalk.bold("Activation policy acquired: ")
                + chalk.cyan(JSON.stringify(gateway.getActivationPolicy())));
            return gateway.activate(iot.DEVICE_MODELS.TEMPERATURE_SENSOR);
        })
        .then(function (gateway) {
            console.log(chalk.bold("Gateway Activated: ") + chalk.cyan(gateway.getState()));
            // get a big boy token
            return gateway.requestToken();
        })
        .then(function (gateway) {
            console.log(chalk.bold("Sending messages..."));
            var data = [{temperature: "182"}, {temperature: "213"}, {temperature: "16"}, {temperature: "11"}];
            var format = iot.DEVICE_MODELS.TEMPERATURE_SENSOR + ":data";
            return gateway.sendDataMessages(format, data);
        })
        .then(function (gateway) {
            console.log(chalk.bold("Messages sent"));
            return iot.deleteDevice(device);
        })
        .then(function (gateway) {
            console.log(chalk.bold("Gateway deleted."));
        })
        .catch(function (error) {
            console.log(chalk.bold.red("*** Error ***"));
            console.log(error.body || error);
            console.trace();
        });
});
