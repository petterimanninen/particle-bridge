'use strict';

var IoTServer = require("../iot");
var inquirer = require("inquirer");
var chalk = require('chalk');

inquirer.prompt([
{
    type: "input",
    name: "iotBaseURL",
    message: "Enter the URL to the IoT Server",
    default: "http://iotserver:7101"
},
{
    type: "input",
    name: "id",
    message: "Enter the ID for the Device"
},
{
    type: "input",
    name: "sharedSecret",
    message: "Enter the shared secret for the device",
    default: "secret"
},
  
], function(answers) {

    var iot = new IoTServer(answers.iotBaseURL);

    var device = iot.provisionDevice(answers.id, answers.sharedSecret);
    device.activate()
      .then(function () {
          console.log(chalk.bold("Gateway Activated: ") + chalk.cyan(device.getState()));
          var data = [{temp: 182}, {temp: 213}, {temp: 16}, {temp: 11}];
          return device.sendDataMessages("jsclient:temperature", data);
      })
      .catch(function (error) {
          console.log(chalk.bold.bold("Activation failed, is this device already activated ?"));
          device.setState('ACTIVATED');
          var data = [{temp: 999}, {temp: 11}, {temp: 22}, {temp: 33}];
          return device.sendDataMessages("jsclient:temperature", data);
      })
      .then(function (response) {
            console.log(chalk.bold("Messages sent. Response: "), response.body);
      })
      .catch(function (error) {
          console.log(chalk.bold.red("*** Error ***"));
          console.log(error.body || error);
      });
});
