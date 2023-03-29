// Include plugin requirements
const { Assignment, ButtonType } = require("midi-mixer-plugin");
const ControlCenterClient = require('./ControlCenter/ControlCenterClient');

module.exports = class Controller
{
    ControlCenter = null;
    devices = new Map();
    assignmentsBrightness = new Map();
    assignmentsTemperature = new Map();

    constructor()
    {
        console.log('Trying to create control center client');
        this.ControlCenter = new ControlCenterClient({ host: false, port: false, debug: false});
        this.setupEvents();
        this.init();
    }

    setupEvents()
    {
        this.ControlCenter.events.on('connected', this.connected.bind(this));
        this.ControlCenter.events.on('deviceConfigurationChanged', this.deviceConfigurationChanged.bind(this));
        this.ControlCenter.events.on('connectionError', this.handleError.bind(this));
    }

    init()
    {
        this.ControlCenter.initConnection(true);
    }

    connected()
    {
        console.log('Connected, trying to get devices');
        $MM.setSettingsStatus('connectionStatus', 'Connected');
    }

    handleError(err)
    {
        console.log(err);
        var errorMessage = "Error connecting";
        switch(err.error)
        {
            case 2:
                errorMessage = "Connection refused, is Command Center running?";
                break;
        }

        $MM.setSettingsStatus('connectionStatus', errorMessage);
    }

    deviceConfigurationChanged(device)
    {
        if (device)
        {
            let deviceID = device.deviceID;
            if (!this.devices.has(deviceID))
            {
                this.devices.set(deviceID, device);
                this.setupDevice(deviceID, device);
            } else
            {
                let deviceInstance = this.devices.get(deviceID);
                // Get the brightness instance
                let brightnessAssignment = this.assignmentsBrightness.get(deviceID);
                brightnessAssignment.muted = deviceInstance.lights.on;
                brightnessAssignment.level = deviceInstance.lights.brightness / 100;
    
                // Get the temp instance
                let temperatureAssignment = this.assignmentsTemperature.get(deviceID);
                temperatureAssignment.level = this.getTemperaturePercentage(deviceInstance);
            }
        }
        
    }

    setDeviceConfig(deviceInstance)
    {
        try
        {
            this.ControlCenter.setDeviceConfiguration(deviceInstance);
        } catch(ex)
        {
            console.log('Device disconnected?');
        }
    }

    setupDevice(deviceID, device)
    {
        console.log('Setting up device', device);
        // Create fader for brightness
        let brightnessAssignment = new Assignment(`${deviceID}.brightness`, {name: `${device.name} Brightness`, muted: device.lights.on, volume: device.brightness / 100});
        brightnessAssignment.throttle = 50;

        brightnessAssignment.on('volumeChanged', (level) => {
            // Set the levels of the fader
            brightnessAssignment.volume = level;

            // Throttle the updates to the device
            clearTimeout(this.activeTimeout);
            this.activeTimeout = setTimeout(() => {
                // Set brightness of the device
                let deviceInstance = this.devices.get(deviceID);
                deviceInstance.lights.brightness = Math.round(level * 100);
                console.log('Setting device brightness to', deviceInstance.lights.brightness);
                this.setDeviceConfig(deviceInstance);
            }, 100);
        });

        brightnessAssignment.on('mutePressed', () => {
            let deviceInstance = this.devices.get(deviceID);
            brightnessAssignment.muted = !brightnessAssignment.muted;
            deviceInstance.lights.on = brightnessAssignment.muted;
            console.log('Turn device on status to', brightnessAssignment.muted);

            clearTimeout(this.activeTimeout);
            this.activeTimeout = setTimeout(() => {
                this.setDeviceConfig(deviceInstance);
            }, 100);
        });

        this.assignmentsBrightness.set(deviceID, brightnessAssignment);

        // Create fader for color temperature
        let tempPercentage = this.getTemperaturePercentage(device);
        let temperatureAssignment = new Assignment(`${deviceID}.temperature`, {name: `${device.name} Color temperature`, muted: false, volume: tempPercentage});

        temperatureAssignment.on('volumeChanged', (level) => {
            // Set the levels of the fader
            temperatureAssignment.volume = level;

            // Throttle the updates to the device
            clearTimeout(this.activeTimeout);
            this.activeTimeout = setTimeout(() => {
                // Set brightness of the device
                let deviceInstance = this.devices.get(deviceID);
                deviceInstance.lights.temperature = this.getTemperature(deviceInstance, level);
                this.setDeviceConfig(deviceInstance);
            }, 100);
        });

        this.assignmentsTemperature.set(deviceID, temperatureAssignment);
    }

    getTemperaturePercentage(device)
    {
        let min = device.lights.temperatureMin;
        let max = device.lights.temperatureMax;
        let temp = device.lights.temperature;

        return (temp - max) / (min - max);
    }

    getTemperature(device, percentage)
    {
        let min = device.lights.temperatureMin;
        let max = device.lights.temperatureMax;

        return max + Math.round(percentage * (min - max));
    }
}