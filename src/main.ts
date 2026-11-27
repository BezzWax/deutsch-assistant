import { Notice, Plugin } from 'obsidian';

import { DeutschAssistantModal } from './ui/DeutschAssistantModal';
import { DeutschAssistantSettingsTab } from './settings/SettingsTab';
import { AnkiService } from './services/AnkiService';

export interface DeutschAssistantSettings {
	defaultDeck: string;
	geminiApiKey: string;
}

const DEFAULT_SETTINGS: DeutschAssistantSettings = {
	defaultDeck: '',
	geminiApiKey: '',
};

export default class DeutschAssistantPlugin extends Plugin {
	settings: DeutschAssistantSettings = DEFAULT_SETTINGS;

	async onload(): Promise<void> {
		await this.loadSettings();

		this.addRibbonIcon('languages', 'Open Deutsch Assistant', () =>
			this.openAssistant(),
		);

		this.addCommand({
			id: 'open-deutsch-assistant',
			name: 'Open Deutsch Assistant',
			callback: () => this.openAssistant(),
		});

		this.addCommand({
			id: 'test-anki-connection',
			name: 'Test Anki connection',
			callback: async () => {
				try {
					const version = await AnkiService.checkConnection();
					const decks = await AnkiService.getDeckNames();
					const models = await AnkiService.getModelNames();

					console.log('AnkiConnect version:', version);
					console.log('Anki decks:', decks);
					console.log('Anki note types:', models);

					new Notice(
						`Connected to AnkiConnect! Found ${decks.length} decks and ${models.length} note types.`,
					);
				} catch (error) {
					console.error('Anki connection error:', error);

					new Notice(
						error instanceof Error
							? error.message
							: 'Anki connection failed.',
					);
				}
			},
		});

		this.addSettingTab(new DeutschAssistantSettingsTab(this.app, this));

		console.log('Deutsch Assistant: Plugin loaded');
	}

	onunload(): void {
		console.log('Deutsch Assistant: Plugin unloaded');
	}

	private openAssistant(): void {
		new DeutschAssistantModal(this.app, this.settings.geminiApiKey).open();
	}

	async loadSettings(): Promise<void> {
		const savedSettings = await this.loadData();

		this.settings = Object.assign({}, DEFAULT_SETTINGS, savedSettings);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
