import { LogWrapper } from "./utilities/LogWrapper";
import * as Log from "logger";
import * as NodeHelper from "node_helper";
import * as fs from "fs";
import { AccountToken } from "./types/Authentication";
import { DataConfig, isDataConfig } from "./types/Config";
import { GaxiosError } from "googleapis-common";
import { CredentialsFile } from "./types/Google";
import { ModuleNotification } from "./types/ModuleNotification";
import { GoogleTaskService } from "./backend/GoogleTaskService";

const logger = new LogWrapper("MMM-GoogleTasks", Log);

module.exports = NodeHelper.create({
  config: {} as DataConfig,
  start: function () {
    logger.log("Starting node helper for: " + this.name);
  },

  socketNotificationReceived: function (notification: string, payload: unknown) {
    if (notification === ModuleNotification.CONFIG) {
      if (isDataConfig(payload)) {
        this.config = payload as DataConfig;
        this.setupTaskService();
      } else {
        logger.error("Invalid configuration payload");
      }
    } else if (notification === ModuleNotification.RETRIEVE) {
      if (!this.taskService) {
        logger.error("Task Service not configured.");
      } else {
        this.getList(payload);
      }
    }
  },

  setupTaskService: function () {
    if (!fs.existsSync(this.config.credentialPath)) {
      logger.error("No credentials file found.");
    }
    if (!fs.existsSync(this.config.tokenPath)) {
      logger.error("No token file found");
    }

    const credentialContent = fs.readFileSync(this.config.credentialPath, "utf-8");
    const tokenContent = fs.readFileSync(this.config.tokenPath, "utf-8");

    const credentialConfig = JSON.parse(credentialContent) as CredentialsFile;
    const accounts = JSON.parse(tokenContent) as AccountToken[];

    this.taskService = new GoogleTaskService(this.config, logger, credentialConfig, accounts);
  },

  getList: async function () {
    if (!this.taskService) {
      logger.log("Refresh required");
      return;
    }
    try {
      const payload = await this.taskService.getGoogleTasks();
      if (payload) {
        logger.info(`Sending ${payload.tasks.length} tasks to frontend`);
        this.sendSocketNotification(ModuleNotification.RESULTS, payload);
      } else {
        logger.warn("No payload returned from Google Tasks");
      }
    } catch (e) {
      if ((e as GaxiosError).response) {
        const err = e as GaxiosError;
        logger.error(err.message);
      } else {
        logger.error(`Error retrieving Google Tasks: ${e}`);
      }
    }
  }
});
