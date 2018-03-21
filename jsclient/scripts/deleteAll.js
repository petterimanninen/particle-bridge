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

    var totalCount = 0;
    var startTime = new Date().getTime();
    var deleteAll = function() {
        var count = 0;
        iot.listDevices({"state": {"$ne": "DECOMMISSIONED"}}, 0, 200)
          .then(function (list) {
            list.items
              .map(function(endpoint) {
                return iot.provisionDevice(endpoint.id);
              })
              .forEach(function(device) {
                device.delete()
                  .then(function() {
                    console.log(chalk.bold("Device deleted: ") + chalk.cyan(device.getID()));
                  })
                  .catch(function (error) {
                    console.log(chalk.bold.red("*** Error Deleting "+device.getID()+" ***"));
                    console.log(error.body || error);
                  })
                  .then(function() {
                    count++;
                    if (count === list.items.length) {
                      totalCount += count;
                      if (list.hasMore) {
                          console.log(chalk.bold("** Next Page ++"));
                          deleteAll();
                      } else {
                          var time = ((new Date().getTime()) - startTime) / 1000;
                          console.log(
                            chalk.bold("All Device deleted. Total:"),
                            chalk.cyan(totalCount),
                            chalk.bold("Time:"),
                            chalk.cyan(time + " secs")
                          );
                      }
                    }
                  });
              });
          })
          .catch(function (error) {
            console.log(chalk.bold.red("*** Error ***"));
            console.log(error.body || error);
          });
    };

    deleteAll();
});
