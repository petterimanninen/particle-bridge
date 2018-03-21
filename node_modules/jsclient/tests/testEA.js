'use strict';

var IoT = require('../index');
var IoTServer = IoT.IoT;
var EnterpriseApplication = IoT.EnterpriseApplication;
var inquirer = require('inquirer');
var chalk = require('chalk');

inquirer.prompt([{
    type: 'input',
    name: 'iotBaseURL',
    message: 'Enter the URL to the IoT Server',
    default: 'http://iotserver:7101'
}, {
    type: 'input',
    name: 'eaID',
    message: 'Enter the Enterprise Application ID',
    default: '0-7YBQ'
}, {
    type: 'input',
    name: 'eaSS',
    message: 'Enter the Enterprise Application Shared Secret',
    default: '0-7YBQ'
}], function(answers) {

    var iot = new IoTServer(answers.iotBaseURL);
    var ea = new EnterpriseApplication(answers.eaID, answers.eaSS);
    iot.setEndpoint(ea);

    var q = {
        type: 'EQUAL',
        property: 'type',
        value: 'CONNECTOR'
    };

    iot.listEndpoints(q)
      .then(function(body) {
          console.log(body);
      })
      .catch(function(error) {
          console.log(chalk.bold.red("*** Error ***"));
          console.log(error.body || error);
          console.trace();
      });

});
