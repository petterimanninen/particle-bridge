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

    iot.listApplications()
        .then(function (app) {
            console.log(
                chalk.bold("Apps"),
                app
            );
        })
        .catch(function (error) {
            console.log(chalk.bold.red("*** Error ***"));
            console.log(error.body || error);
            console.trace();
        });

//    var time = new Date().getTime();
//    iot.createApplication('Joes App' + time, null, iot.DEVICE_MODELS.AMPERAGE_SENSOR)
//        .then(function (app) {
//            console.log(
//                chalk.bold("App created: "),
//                chalk.cyan(app)
////                chalk.underline(answers.iotBaseURL + "/" + iot.DEVICES_URL + "/" + device.getID())
//            );
//        })
//        .catch(function (error) {
//            console.log(chalk.bold.red("*** Error ***"));
//            console.log(error.body || error);
//            console.trace();
//        });
});
