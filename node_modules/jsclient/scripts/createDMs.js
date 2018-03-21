"use strict";
/* jshint esnext: true */

var IoTServer = require("../iot");
var inquirer = require("inquirer");
var chalk = require('chalk');
var commander = require("commander");

inquirer.prompt([{
    type: "input",
    name: "iotBaseURL",
    message: "Enter the URL to the IoT Server",
    default: "http://iotserver:7101"
}], function(answers) {

    var iot = new IoTServer(answers.iotBaseURL);
    iot.setPrincipal('iot', 'welcome1');
    var deviceModels = iot.DEVICE_MODELS;

    commander
      .version("0.0.1")
      .option("-d, --delete", "Delete all DMs")
      .parse(process.argv);

    if (commander.delete) {
        var promises = Object.keys(deviceModels)
            .map(dm => {
                return deviceModels[dm];
            })
            .map(dm => {
                var request = {
                    uri: iot.DEVICE_MODELS_URL + "/" + dm,
                    method: "DELETE"
                };
                return iot.sendRequest(request, 204);
            });
        Promise.all(promises).then(results => {
            console.log(chalk.bold("Device Model deleted. Total: ") + chalk.cyan(results.length));
        })
        .catch(error => {
            console.log(chalk.bold.red("*** Error ***"));
            console.log(error.body || error);
        });
        return;
    }


    var regex = /.*:(.+)_(.+)$/;
    Object.keys(deviceModels)
        .map(dm => {
            return deviceModels[dm];
        })
        .map(dm => {
            var parts = regex.exec(dm);
            if (parts) {
                var name = parts[1];
                return {
                    urn: dm,
                    name: name + " " + parts[2],
                    description: "Description for " + parts[2],
                    attributes: [{
                        name: name,
                        type: "STRING",
                        writable: true
                    }],
                    actions: [{
                        name: "testMe",
                        description: "Test action"
                    }],
                    formats: [{
                        urn: dm + ":alert:bad:" + name,
                        name: "Alert " + name,
                        description: "Description " + name,
                        type: "ALERT",
                        value: {
                            fields: [{
                                name: name,
                                type: "STRING"
                            }]
                        }
                    },{
                        urn: dm + ":data",
                        name: "Data " + name,
                        description: "Description " + name,
                        type: "DATA",
                        value: {
                            fields: [{
                                name: name,
                                type: "STRING"
                            }]
                        }
                    }]
                };
            }
            return null;
        })
        .filter(dm => {return dm;})
        .forEach(dm => {
            iot.createDeviceModel(dm)
                .then(result => {
                    console.log(chalk.bold("Device Model created: ") + chalk.cyan(result.urn));
                })
                .catch(error => {
                    console.log(chalk.bold.red("*** Error ***"));
                    console.log(error.body || error);
                });
        });

});
