import {
  API,
  DynamicPlatformPlugin,
  Logger,
  PlatformAccessory,
  PlatformConfig,
  Service,
  Characteristic, UnknownContext
} from "homebridge";

import {PLATFORM_NAME, PLUGIN_NAME} from "./settings";
import {TemperatureProbe} from "./Services/temperatureProbe";
import axios from "axios";
import parser from "xml2json";
import {GenericProbe} from "./Services/genericProbe";
import {GenericOutlet} from "./Services/genericOutlet";
import {FeedOutlet} from "./Services/feedOutlet";

export interface ApexOutlet {
  name: string;
  state: string;
  deviceID: string;
  outputID?: string;
}

export interface ApexProbe {
  name: string;
  value: number;
  type: ProbeType;
}

export interface FetchDeviceStatus {
  name: string;
  id: string;
  type: DeviceType;
}

interface ApexAccessory {
  name: string;
  id: string;
  onState?: number;
  ProbeType?: ProbeType;
  displayName?: string;
}

interface InitializeAccessory {
  context: PlatformAccessory<UnknownContext>;
  exists: boolean;
}

export enum DeviceType {
  Probe = "PROBE",
  Outlet = "OUTLET",
  Feed = "FEED"
}

export enum ProbeType {
  Temperature = "TEMPERATURE",
  PH = "PH",
  ORP = "ORP",
  Salinity = "SALINITY",
  OTHER = "OTHER"
}

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class NeptuneApexPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  public probes: ApexProbe[] = [];
  public outlets: ApexOutlet[] = [];
  public lastFetchTime: Date = new Date("December 17, 1995 03:24:00");
  public probeRefreshInterval: number = this.config.probeRefreshInterval * 1000;
  public outletRefreshInterval: number = this.config.outletRefreshInterval * 1000;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API
  ) {
    this.log.debug("Finished initializing platform:", this.config.name);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on("didFinishLaunching", async () => {
      log.debug("Executed didFinishLaunching callback");
      await this.getApexStatus();
      // run the method to discover / register your devices as accessories
      this.discoverDevices();

      // removing accessories
      // this.accessories.forEach(accessory => api.unregisterPlatformAccessories("PLUGIN_NAME", "PLATFORM_NAME", [accessory]));
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to set up event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info("Loading accessory from cache:", accessory.displayName);

    // add the restored accessory to the accessories cache, so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  public randomInterval = (min, max) => Math.floor(Math.random() * (max - min)) + min;

  private async refreshApexData(type: DeviceType): Promise<void> {
    const refreshInterval = type === DeviceType.Probe ? this.probeRefreshInterval : this.outletRefreshInterval;

    // if the default fetch time has passed, refresh data else grab from cache
    if (this.lastFetchTime && (Math.abs(new Date().getTime() - this.lastFetchTime.getTime()) > refreshInterval)) {
      await this.getApexStatus();
    }
  }

  public async getProbeStatus(device: FetchDeviceStatus): Promise<number> {
    await this.refreshApexData(device.type);

    return device.type === DeviceType.Probe && this.probes.length > 0
      ? this.probes.filter(probe => device.name === probe.name || device.id === probe.name)[0].value
      : -1;
  }

  public async getOutletState(device: FetchDeviceStatus, shouldAutoOffShowOn: boolean): Promise<number> {
    await this.refreshApexData(device.type);

    const outletState = device.type === DeviceType.Outlet && this.outlets.length > 0
      ? this.outlets.filter(outlet => device.id === outlet.deviceID)[0].state : -1;

    if (outletState === "OFF" || outletState === "AOF") {
      if (shouldAutoOffShowOn) {
        return 1;
      }
      return 0;
    } else if (outletState === "ON" || outletState === "AON") {
      return 1;
    }
    return -1;
  }

  public async updateFeedMode(feedMode: number, isActive: boolean): Promise<number> {
    if (isActive) {
      await this.cancelFeedMode();
      return 0;
    } else {
      await this.setFeedMode(feedMode);
      return 1;
    }
  }

  private async setFeedMode(feedMode: number): Promise<void> {
    try {
      // eslint-disable-next-line max-len
      const response = await axios.post(`http://${this.config.host_address}:${this.config.host_port || "80"}/status.sht?$FeedSel=${feedMode}&FeedCycle=Feed`,
        {},
        {
          auth: {
            username: this.config.username,
            password: this.config.password
          }
        });
      this.log.debug("Response URL For Set Outlet State: ", response.config.url);
    } catch (error) {
      this.log.error("Failed to fetch and parse config: ", error);
    }
  }

  private async cancelFeedMode(): Promise<void> {
    try {
      // eslint-disable-next-line max-len
      const response = await axios.post(`http://${this.config.host_address}:${this.config.host_port || "80"}/status.sht?FeedCycle=Feed%20Cancel`,
        {},
        {
          auth: {
            username: this.config.username,
            password: this.config.password
          }
        });
      this.log.debug("Response URL For Set Outlet State: ", response.config.url);
    } catch (error) {
      this.log.error("Failed to fetch and parse config: ", error);
    }
  }


  public async setOutletState(device: FetchDeviceStatus, outletState: number): Promise<void> {
    try {
      // eslint-disable-next-line max-len
      const response = await axios.post(`http://${this.config.host_address}:${this.config.host_port || "80"}/status.sht?${device.name}_state=${outletState}&Update=Update`,
        {},
        {
          auth: {
            username: this.config.username,
            password: this.config.password
          }
        });
      this.log.debug("Response URL For Set Outlet State: ", response.config.url);
      this.getApexStatus().then(() => {
        this.log.debug("Updating device status");
      });
    } catch (error) {
      this.log.error("Failed to fetch and parse config: ", error);
    }
  }

  async getApexStatus() {
    this.log.debug("Attempting to fetch apex status");
    try {
      await axios.get(`http://${this.config.host_address}:${this.config.host_port || "80"}/cgi-bin/status.xml`, {
        auth: {
          username: this.config.username,
          password: this.config.password
        }
      }).then(response => {
        const currentStatus = parser.toJson(response.data, {object: true, sanitize: true, trim: true});

        this.probes = [...currentStatus.status.probes.probe].map(probe => ({...probe, value: Number(probe.value)}));

        this.outlets = [...currentStatus.status.outlets.outlet].filter((outlet: ApexOutlet) =>
          this.config.outlets.reduce((a, c) => {
            if (a === true) {
              return a;
            }
            return c.name === outlet.name && c.id === outlet.deviceID;
          }, false)
        );

        this.lastFetchTime = new Date();
      });
    } catch (error) {
      this.log.error("Failed to fetch and parse config: ", error);
    }
  }

  // Used as a helper to set up all devices for this plugin
  setupDevice(device: ApexAccessory): InitializeAccessory {
    const uuid = this.api.hap.uuid.generate(`${this.config.serial_number}-${device.name}-${device.id}`);
    const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);
    if (existingAccessory) {
      // the accessory already exists
      this.log.info("Restoring existing accessory from cache:", existingAccessory.displayName);
      // create the accessory handler for the restored accessory
      return {context: existingAccessory, exists: true};
    } else {
      // the accessory does not yet exist, so we need to create it
      this.log.info("Adding new accessory:", device.name);

      // create a new accessory and add the device options to its context
      const accessory = new this.api.platformAccessory(device.name, uuid);
      accessory.context.device = device;
      return {context: accessory, exists: true};
    }
  }

  setupFeedMode(device: ApexAccessory) {
    const initializedAccessory = this.setupDevice(device);
    new FeedOutlet(this, initializedAccessory.context);

    if (!initializedAccessory.exists) {
      // link the accessory to your platform
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [initializedAccessory.context]);
    }
  }

  setupProbe(device: ApexAccessory) {
    const initializedAccessory = this.setupDevice(device);
    if (device.ProbeType === ProbeType.Temperature) {
      new TemperatureProbe(this, initializedAccessory.context);
    } else {
      new GenericProbe(this, initializedAccessory.context);
    }

    if (!initializedAccessory.exists) {
      // link the accessory to your platform
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [initializedAccessory.context]);
    }
  }

  setupOutlet(device: ApexAccessory) {
    const initializedAccessory = this.setupDevice(device);
    new GenericOutlet(this, initializedAccessory.context);

    if (!initializedAccessory.exists) {
      // link the accessory to your platform
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [initializedAccessory.context]);
    }
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent "duplicate UUID" errors.
   */
  discoverDevices() {
    // Setting up probes
    for (const probe of this.config.probes) {
      this.setupProbe(probe);
    }

    // Setting up Trident
    if (this.config.trident && this.config.trident.id) {
      [{
        id: `Alkx${this.config.trident.id}`,
        name: "Alkalinity"
      }, {
        id: `Cax${this.config.trident.id}`,
        name: "Calcium"
      }, {
        id: `Mgx${this.config.trident.id}`,
        name: "Magnesium"
      }].forEach(tridentProbe => this.setupProbe({
        id: tridentProbe.id, name: tridentProbe.name, ProbeType: ProbeType.OTHER
      }));
    }

    // Setting up outlets
    for (const outlet of this.config.outlets) {
      this.setupOutlet(outlet);
    }

    // setting up feed modes
    for (const feedMode of this.config.feedModes) {
      this.setupFeedMode(feedMode);
    }
  }
}
