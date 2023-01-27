import {PlatformAccessory, Service} from "homebridge";

import {DeviceType, NeptuneApexPlatform} from "../platform";

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class TempProbe {
  private service: Service;

  constructor(
    private readonly platform: NeptuneApexPlatform,
    private readonly accessory: PlatformAccessory
  ) {

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, "Default-Manufacturer")
      .setCharacteristic(this.platform.Characteristic.Model, "Default-Model")
      .setCharacteristic(this.platform.Characteristic.SerialNumber, "Default-Serial");

    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    this.service =
      this.accessory.getService(this.platform.Service.TemperatureSensor)
      || this.accessory.addService(this.platform.Service.TemperatureSensor);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);

    const {
      name,
      id,
      useFahrenheit
    } = accessory.context.device;

    const device = {
      id,
      name,
      type: DeviceType.Probe
    };

    this.service.getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(async () => {
        const currentTemp = await this.platform.getProbeStatus(device);
        if (useFahrenheit) {
          return this.convertToFahrenheit(currentTemp);
        }
        return currentTemp;
      });

    setInterval(async () => {
      let currentTemp = await this.platform.getProbeStatus(device);
      if (useFahrenheit) {
        currentTemp = this.convertToFahrenheit(currentTemp);
      }
      this.platform.log.debug(`Updating ${accessory.context.device.name} Probe: ${currentTemp}`);
      // push the new value to HomeKit
      return this.service.updateCharacteristic(this.platform.Characteristic.CurrentTemperature, currentTemp);
    }, this.platform.randomInterval(this.platform.probeRefreshInterval - 10000, this.platform.probeRefreshInterval + 10000));
  }

  convertToFahrenheit(temperature: number): number {
    return (temperature - 32) * .5556;
  }
}
