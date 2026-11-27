
import { App, PluginSettingTab, Setting } from "obsidian";
import DeutschAssistantPlugin from "../main";

export class DeutschAssistantSettingsTab extends PluginSettingTab {
  plugin: DeutschAssistantPlugin;

  constructor(app: App, plugin: DeutschAssistantPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl("h2", {
      text: "Deutsch Assistant Settings",
    });

    new Setting(containerEl)
      .setName("Default Anki deck")
      .setDesc("The Anki deck used for vocabulary imports.")
      .addText((text) =>
        text
          .setPlaceholder("Enter Anki deck name")
          .setValue(this.plugin.settings.defaultDeck)
          .onChange(async (value) => {
            this.plugin.settings.defaultDeck = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Gemini API key")
      .setDesc("Your Google Gemini API key.")
      .addText((text) => {
        text.inputEl.type = "password";

        text
          .setPlaceholder("Enter your API key")
          .setValue(this.plugin.settings.geminiApiKey)
          .onChange(async (value) => {
            this.plugin.settings.geminiApiKey = value;
            await this.plugin.saveSettings();
          });
      });
  }
}
