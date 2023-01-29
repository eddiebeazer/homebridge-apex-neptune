import {PlatformAccessory, Service} from "homebridge";

import {DeviceType, NeptuneApexPlatform} from "../platform";

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class FeedOutlet {
  private service: Service;

  constructor(
    private readonly platform: NeptuneApexPlatform,
    private readonly accessory: PlatformAccessory
  ) {

    // set accessory information
    this.accessory.getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, "Neptune Systems")
      .setCharacteristic(this.platform.Characteristic.Model, "Feed Mode")
      .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.name);

    // get the LightBulb service if it exists, otherwise create a new LightBulb service
    // you can create multiple services for each accessory
    this.service =
      this.accessory.getService(this.platform.Service.Outlet)
      || this.accessory.addService(this.platform.Service.Outlet);

    // set the service name, this is what is displayed as the default name on the Home app
    // in this example we are using the name we stored in the `accessory.context` in the `discoverDevices` method.
    this.service.setCharacteristic(
      this.platform.Characteristic.Name,
      accessory.context.device.displayName
    );

    const {
      name,
      duration
    } = accessory.context.device;

    let timer: NodeJS.Timeout | null = null;
    let feedMode: number;

    if (name === "FeedA") {
      feedMode = 0;
    } else if (name === "FeedB") {
      feedMode = 1;
    } else if (name === "FeedC") {
      feedMode = 2;
    } else if (name === "FeedD") {
      feedMode = 3;
    }

    function isTimerValid(timer) {
      return timer !== undefined && timer !== null;
    }

    this.service.getCharacteristic(this.platform.Characteristic.On)
      .onGet( () => isTimerValid(timer) ? 1 : 0)
      .onSet(async () => {
        this.platform.log.debug(`Updating ${name}`);

        await this.platform.updateFeedMode(feedMode, isTimerValid(timer));

        if (!isTimerValid(timer)) {
          timer = setTimeout(() => {
            this.service.getCharacteristic(this.platform.Characteristic.On)
              .updateValue(0);
            timer = null;
          }, duration * 1000);
        }
      });
  }
}
