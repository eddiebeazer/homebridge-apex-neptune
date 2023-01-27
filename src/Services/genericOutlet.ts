import {PlatformAccessory, Service} from "homebridge";

import {DeviceType, NeptuneApexPlatform} from "../platform";

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class GenericOutlet {
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
      this.accessory.getService(this.platform.Service.Outlet)
      || this.accessory.addService(this.platform.Service.Outlet);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);

    const {
      name,
      id,
      defaultOnState,
      shouldAutoOffShowOn
    } = accessory.context.device;

    const device = {
      id,
      name,
      type: DeviceType.Outlet
    };

    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onGet(async () => await this.platform.getOutletState(device, shouldAutoOffShowOn))
      .onSet(async () => {
        const currentState = this.service.getCharacteristic(this.platform.Characteristic.On).value;
        let newState;
        if (currentState === false) {
          newState = defaultOnState;
        } else {
          newState = 1; // off state
        }
        this.platform.log.debug(`Setting ${accessory.context.device.name} Outlet state: ${newState}`);
        // Changing outlet status - 2 is on, 1 is off, 0 is auto
        await this.platform.setOutletState(device, newState);
      });


    setInterval(async () => {
      const outletState = await this.platform.getOutletState(device, shouldAutoOffShowOn);
      // push the new value to HomeKit
      this.service.updateCharacteristic(this.platform.Characteristic.On, outletState);
    }, this.platform.randomInterval(this.platform.outletRefreshInterval - 10000, this.platform.outletRefreshInterval + 10000));
  }
}
