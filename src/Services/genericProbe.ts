import { Service, PlatformAccessory } from "homebridge";

import {DeviceType, NeptuneApexPlatform} from "../platform";

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class GenericProbe {
  private service: Service;

  constructor(
    private readonly platform: NeptuneApexPlatform,
    private readonly accessory: PlatformAccessory
  ) {

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, "Neptune Systems")
      .setCharacteristic(this.platform.Characteristic.Model, "Generic Probe")
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.name);

    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    this.service =
      this.accessory.getService(this.platform.Service.LightSensor)
      || this.accessory.addService(this.platform.Service.LightSensor);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);

    const {
      name,
      id
    } = accessory.context.device;

    const device = {
      id,
      name,
      type: DeviceType.Probe
    };

    // register handlers for the On/Off Characteristic
    this.service.getCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel)
      .onGet(async () =>
        await this.platform.getProbeStatus(device)
      );

    setInterval(async() => {
      const currentProbeValue = await this.platform.getProbeStatus(device);

      this.platform.log.debug(`Updating ${accessory.context.device.name} Probe: ${currentProbeValue}`);

      // push the new value to HomeKit
      return this.service.updateCharacteristic(this.platform.Characteristic.CurrentAmbientLightLevel, currentProbeValue);
    }, this.platform.randomInterval(this.platform.probeRefreshInterval - 10000, this.platform.probeRefreshInterval + 10000));
  }
}
