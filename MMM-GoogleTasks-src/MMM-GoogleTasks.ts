import { LogWrapper } from "./utilities/LogWrapper";
import { Config } from "./types/Config";
import { TaskData } from "./types/Display";
import { getLoadingView, getTaskView } from "./frontend/Display";
import * as Log from "logger";

import "./frontend/Display.scss";
import { ModuleNotification } from "./types/ModuleNotification";

Module.register<Config>("MMM-GoogleTasks", {
  // Default module config.
  defaults: {
    credentialPath: "credentials.json",
    tokenPath: "token.json",
    maxResults: 10,
    showCompleted: false, //set showCompleted and showHidden true
    ordering: "myorder", // Order by due date, title, updated timestamp or by 'my order'
    dateFormat: "LLL do", // Format to display dates (date-fns formats)
    updateInterval: 60000, // Time between content updates (millisconds)
    animationSpeed: 2000, // Speed of the update animation (milliseconds)
    initialLoadDelay: 1500,
    useRelativeDate: false,
    maxWidth: "450px",
    accounts: [],
    plannedTasks: {
      enable: false,
      duration: {
        weeks: 2
      }
    }

    // Pointless for a mirror, not currently implemented
    /* 
      dueMax: "2040-07-11T18:30:00.000Z", // RFC 3339 timestamp 
      dueMin: "1970-07-11T18:30:00.000Z", // RFC 3339 timestamp 
      completedMax: "2040-07-11T18:30:00.000Z", //only if showCompleted true (RFC 3339 timestamp)
      completedMin: "1970-07-11T18:30:00.000Z", //only if showCompleted true (RFC 3339 timestamp)
      */
  },

  isLoaded: false,

  taskData: {} as TaskData,

  requiresVersion: "2.1.0",

  getLogger: function (): LogWrapper {
    return new LogWrapper("MMM-GoogleTasks module", Log);
  },

  // Define required scripts
  // getScripts: function () {
  //   return ["moment.js"];
  // },

  // Define required scripts.
  getStyles: function () {
    return ["MMM-GoogleTasks.css"];
  },

  // Define start sequence
  start: function () {
    this.getLogger().info("Starting module: " + this.name);
    this.sendSocketNotification(ModuleNotification.CONFIG, this.config);
    this.scheduleUpdate(this.config.initialLoadDelay);
    this.isLoaded = false;
  },

  scheduleUpdate: function (delay?: number) {
    if (this.isScheduled) {
      return;
    }
    let nextLoad = this.config.updateInterval;
    if (typeof delay !== "undefined" && delay !== undefined && delay >= 0) {
      nextLoad = delay;
    }

    this.isScheduled = true;
    setTimeout(() => {
      this.getLogger().info("Requesting task update");
      this.isScheduled = false;
      this.sendSocketNotification(ModuleNotification.RETRIEVE, {});
    }, nextLoad);
  },

  socketNotificationReceived: function (notification, payload) {
    this.getLogger().info("socket notification received ", notification);
    if (notification === ModuleNotification.RESULTS) {
      const summary: TaskData = payload as TaskData;
      if (summary) {
        this.taskData = summary;
        this.getLogger().info(`Processing Task Data: Task Count = ${summary.tasks.length}`);
        this.isLoaded = true;
        this.scheduleUpdate();
        this.updateDom(this.config.animationSpeed);
      } else {
        this.getLogger().warn("Summary data not formatted correctly.");
      }
    }
    // If an error occurs, reschedule an update to try again
    if (notification === ModuleNotification.ERROR) {
      this.scheduleUpdate();
    }
  },

  getDom: function () {
    if (!this.isLoaded) {
      return getLoadingView(this.config);
    }
    return getTaskView(this.taskData, this.config);
  }
});
