'use strict';

var nameGenerator = require("../nameGenerator");
var chalk = require('chalk');
var i;
console.log(chalk.bold("Gateway Names: "));
for (i = 0; i < 30; i++) {
    console.log(chalk.cyan("\t" + nameGenerator.generateGatewayName()));
}

console.log(chalk.bold("Device Names: "));
for (i = 0; i < 30; i++) {
    console.log(chalk.cyan("\t" + nameGenerator.generateDeviceName()));
}
