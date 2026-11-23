
import { Plugin } from "obsidian";

import { DeutschAssistantModal } from "./ui/DeutschAssistantModal";
import { DeutschAssistantSettingsTab } from "./settings/SettingsTab";

export interface DeutschAssistantSettings {
  defaultDeck: string;
  geminiApiKey: string;
}

const DEFAULT_SETTINGS: DeutschAssistantSettings = {
  defaultDeck: "",
  geminiApiKey: "",
};

export default class DeutschAssistantPlugin extends Plugin {
  settings: DeutschAssistantSettings | undefined = DEFAULT_SETTINGS;

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addRibbonIcon(
      "languages",
      "Open Deutsch Assistant",
      () => this.openAssistant(),
    );

    this.addCommand({
      id: "open-deutsch-assistant",
      name: "Open Deutsch Assistant",
      callback: () => this.openAssistant(),
    });

    this.addSettingTab(
      new DeutschAssistantSettingsTab(this.app, this),
    );

    console.log("Deutsch Assistant: Plugin loaded");
  }

  onunload(): void {
    console.log("Deutsch Assistant: Plugin unloaded");
  }

  private openAssistant(): void {
    new DeutschAssistantModal(this.app).open();
  }

  async loadSettings(): Promise<void> {
    const savedSettings = await this.loadData();

    this.settings = Object.assign(
      {},
      DEFAULT_SETTINGS,
      savedSettings,
    );
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }
}
