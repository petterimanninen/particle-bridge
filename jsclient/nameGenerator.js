'use strict';

var adjetives = [
    "Admiring", "Adoring", "Agitated", "Amazing", "Angry", "Awesome",
    "Backstabbing", "Berserk", "Big", "Boring", "Clever", "Cocky",
    "Compassionate", "Condescending", "Cranky",
    "Desperate", "Determined", "Distracted", "Dreamy", "Drunk",
    "Ecstatic", "Elated", "Elegant", "Evil",
    "Fervent", "Focused", "Furious",
    "Gigantic", "Gloomy", "Goofy", "Grave",
    "Happy", "High", "Hopeful", "Hungry",
    "Insane", "Jolly", "Jovial", "Kickass",
    "Lonely", "Loving", "Mad", "Modest",
    "Naughty", "Nostalgic", "Nasty",
    "Pensive", "Prickly", "Perverted",
    "Reverent", "Romantic",
    "Sad", "Serene", "Sharp", "Stinky", "Silly", "Sleepy", "Small", "Stoic", "Stupefied", "Suspicious",
    "Tender", "Thirsty", "Tiny", "Trusting"];

var gatewayNames = ["Gateway", "Portal", "Box", "Machine", "Slammer", "Inlet", "Port",
    "Service", "Computer", "Entry", "Gateway", "Gateway", "Gateway", "Gateway"];

var sensorNames = ["Air Sensor", "Weight Sensor", "Speed Sensor", "GPS", "Viscosity Sensor",
                   "Flatulence Sensor", "Accelerometer", "Compass", "Gyroscope", "Ugly people detector",
                   "Luminance", "Light Sensor", "Vibration Sensor", "Temperature Sensor",
                   "Humidity Monitor", "Blood Pressure Monitor", "Wind Speed Monitor", "Digital Multimeter", 
                   "Voltage Sensor", "Amperate Sensor"];

module.exports  ={
    generateGatewayName: function() {
        var adjetiveIndex = Math.floor(Math.random() * adjetives.length);
        var adjetive = adjetives[adjetiveIndex];
        var gatewayIndex = Math.floor(Math.random() * gatewayNames.length);
        var gateway = gatewayNames[gatewayIndex];
        return adjetive + " " + gateway;
    },
    generateDeviceName: function() {
        var adjetiveIndex = Math.floor(Math.random() * adjetives.length);
        var adjetive = adjetives[adjetiveIndex];
        var sensorIndex = Math.floor(Math.random() * sensorNames.length);
        var sensor = sensorNames[sensorIndex];
        return adjetive + " " + sensor;
    },
    
};