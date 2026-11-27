
import { App, Modal } from "obsidian";
import { ImageService } from "../services/ImageService";
import { GeminiService } from "../services/GeminiService";
import type { RecognizedWord } from "../services/GeminiService";
import { AnkiService } from "../services/AnkiService";
import type { AnkiNote } from "../services/AnkiService";

export class DeutschAssistantModal extends Modal {
  private readonly apiKey: string;
  private recognizedWords: RecognizedWord[] = [];

  private selectedFile: File | null = null;
  private previewUrl: string | null = null;
  private isAnalyzing = false;
  private isImporting = false;
  private compatibleModelNames: string[] = [];
  private selectedModelName = "";

  private previewContainer: HTMLDivElement | null = null;
  private resultsContainer: HTMLDivElement | null = null;
  private statusContainer: HTMLDivElement | null = null;
  private analyzeButton: HTMLButtonElement | null = null;

  constructor(app: App, apiKey: string) {
    super(app);
    this.apiKey = apiKey;
  }

  onOpen(): void {
    const { contentEl } = this;

    contentEl.empty();
    contentEl.addClass("deutsch-assistant-modal");

    contentEl.createEl("h2", {
      text: "Deutsch Assistant",
    });

    contentEl.createEl("p", {
      text: "Import German vocabulary from book pages.",
      cls: "deutsch-assistant-description",
    });

    this.createUploadSection(contentEl);

    this.previewContainer = contentEl.createDiv({
      cls: "deutsch-assistant-preview",
    });

    this.statusContainer = contentEl.createDiv({
      cls: "deutsch-assistant-status",
    });

    this.resultsContainer = contentEl.createDiv({
      cls: "deutsch-assistant-results",
    });

    const footer = contentEl.createDiv({
      cls: "deutsch-assistant-footer",
    });

    this.analyzeButton = footer.createEl("button", {
      text: "Analyze image",
      cls: "mod-cta",
    });

    this.analyzeButton.disabled = true;

    this.analyzeButton.addEventListener("click", () => {
      void this.analyzeImage();
    });

    const closeButton = footer.createEl("button", {
      text: "Close",
    });

    closeButton.addEventListener("click", () => {
      this.close();
    });
  }

  private createUploadSection(container: HTMLElement): void {
    const uploadArea = container.createDiv({
      cls: "deutsch-assistant-dropzone",
    });

    const icon = uploadArea.createDiv({
      cls: "deutsch-assistant-upload-icon",
    });

    icon.setText("↑");

    uploadArea.createEl("h3", {
      text: "Upload book page",
    });

    uploadArea.createEl("p", {
      text: "Drag and drop an image here",
    });

    uploadArea.createEl("span", {
      text: "or",
      cls: "deutsch-assistant-muted",
    });

    const fileInput = document.createElement("input");

    fileInput.type = "file";
    fileInput.accept = "image/jpeg,image/png,image/webp";
    fileInput.hidden = true;

    const chooseButton = uploadArea.createEl("button", {
      text: "Choose image",
      cls: "mod-cta",
    });

    chooseButton.addEventListener("click", (event) => {
      event.stopPropagation();
      fileInput.click();
    });

    uploadArea.appendChild(fileInput);

    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];

      if (file) {
        this.handleFile(file);
      }

      fileInput.value = "";
    });

    uploadArea.addEventListener("click", () => {
      fileInput.click();
    });

    uploadArea.addEventListener("dragover", (event) => {
      event.preventDefault();
      uploadArea.addClass("is-dragging");
    });

    uploadArea.addEventListener("dragleave", (event) => {
      event.preventDefault();
      uploadArea.removeClass("is-dragging");
    });

    uploadArea.addEventListener("drop", (event) => {
      event.preventDefault();
      uploadArea.removeClass("is-dragging");

      const file = event.dataTransfer?.files[0];

      if (file) {
        this.handleFile(file);
      }
    });
  }

  private handleFile(file: File): void {
    const validationError = ImageService.validate(file);

    if (validationError) {
      this.showStatus(validationError, "error");
      return;
    }

    this.clearPreview();

    this.selectedFile = file;
    this.previewUrl = URL.createObjectURL(file);

    this.resultsContainer?.empty();
    this.recognizedWords = [];
    this.compatibleModelNames = [];
    this.selectedModelName = "";
    this.renderPreview();

    if (this.analyzeButton) {
      this.analyzeButton.disabled = false;
    }

    this.showStatus("Image successfully loaded.", "success");
  }

  private renderPreview(): void {
    if (!this.previewContainer || !this.selectedFile || !this.previewUrl) {
      return;
    }

    const container = this.previewContainer;

    container.empty();

    container.createEl("h3", {
      text: "Image preview",
    });

    const imageWrapper = container.createDiv({
      cls: "deutsch-assistant-image-wrapper",
    });

    const image = imageWrapper.createEl("img", {
      attr: {
        src: this.previewUrl,
        alt: "Uploaded book page",
      },
      cls: "deutsch-assistant-image",
    });

    image.addEventListener("error", () => {
      this.showStatus("Could not preview this image.", "error");
    });

    const fileInfo = container.createDiv({
      cls: "deutsch-assistant-file-info",
    });

    fileInfo.createEl("strong", {
      text: this.selectedFile.name,
    });

    fileInfo.createEl("span", {
      text: ImageService.formatSize(this.selectedFile.size),
    });

    const actions = container.createDiv({
      cls: "deutsch-assistant-image-actions",
    });

    const removeButton = actions.createEl("button", {
      text: "Remove image",
    });

    removeButton.addEventListener("click", () => {
      this.clearPreview();
      this.resultsContainer?.empty();
      this.recognizedWords = [];
      this.compatibleModelNames = [];
      this.selectedModelName = "";

      if (this.analyzeButton) {
        this.analyzeButton.disabled = true;
      }

      this.showStatus("Image removed.", "success");
    });
  }

  private async analyzeImage(): Promise<void> {
    if (!this.selectedFile || this.isAnalyzing) {
      return;
    }

    if (!this.apiKey.trim()) {
      this.showStatus(
        "Gemini API key is missing. Add it in Settings → Deutsch Assistant.",
        "error",
      );
      return;
    }

    this.isAnalyzing = true;
    this.setAnalyzeButtonState(true, "Analyzing...");

    this.resultsContainer?.empty();
    this.showStatus(
      "Gemini is analyzing the image. Please wait...",
      "success",
    );

    try {
      const words = await GeminiService.analyzeImage(
        this.selectedFile,
        this.apiKey,
      );

      this.recognizedWords = words;
      this.renderResults();

      this.showStatus(
        `Analysis complete. Found ${words.length} word(s).`,
        "success",
      );
    } catch (error) {
      console.error("Deutsch Assistant: Gemini analysis failed", error);

      const message =
        error instanceof Error
          ? error.message
          : "An unknown error occurred.";

      this.showStatus(`Analysis failed: ${message}`, "error");
    } finally {
      this.isAnalyzing = false;
      this.setAnalyzeButtonState(false, "Analyze image");
    }
  }

  private renderResults(): void {
    if (!this.resultsContainer) {
      return;
    }

    const container = this.resultsContainer;
    container.empty();

    const header = container.createDiv({
      cls: "deutsch-assistant-results-header",
    });

    header.createEl("h3", {
      text: `Vocabulary editor (${this.recognizedWords.length})`,
    });

    const addButton = header.createEl("button", {
      text: "+ Add word",
    });

    addButton.addEventListener("click", () => {
      this.recognizedWords.push({
        original: "",
        lemma: "",
        partOfSpeech: "",
        forms: "",
        translation: "",
        context: "",
        confidence: 0,
      });

      this.renderResults();
    });

    const importButton = header.createEl("button", {
      text: "Import to Anki",
      cls: "mod-cta",
    });

    importButton.disabled =
      this.recognizedWords.length === 0 || this.isImporting;

    importButton.addEventListener("click", () => {
      void this.importToAnki();
    });

    if (this.compatibleModelNames.length > 1) {
      const modelSelect = header.createEl("select", {
        cls: "deutsch-assistant-model-select",
      });

      for (const modelName of this.compatibleModelNames) {
        const option = document.createElement("option");
        option.value = modelName;
        option.textContent = modelName;
        modelSelect.appendChild(option);
      }

      const firstModel = this.compatibleModelNames[0] ?? "";
      modelSelect.value = this.selectedModelName ?? firstModel;
      this.selectedModelName = modelSelect.value;

      modelSelect.addEventListener("change", () => {
        this.selectedModelName = modelSelect.value;
      });
    }

    if (this.recognizedWords.length === 0) {
      container.createEl("p", {
        text: "No words recognized. You can add a word manually.",
        cls: "deutsch-assistant-muted",
      });

      return;
    }

    this.recognizedWords.forEach((word, index) => {
      const card = container.createDiv({
        cls: "deutsch-assistant-word-card",
      });

      const heading = card.createDiv({
        cls: "deutsch-assistant-word-heading",
      });

      heading.createEl("strong", {
        text: `Word ${index + 1}`,
      });

      const removeButton = heading.createEl("button", {
        text: "Remove",
        cls: "deutsch-assistant-remove-word",
      });

      removeButton.addEventListener("click", () => {
        this.recognizedWords.splice(index, 1);
        this.renderResults();
      });

      this.createEditableField(card, index, "original", "Original word");
      this.createEditableField(card, index, "lemma", "Lemma");
      this.createEditableField(card, index, "partOfSpeech", "Part of speech");
      this.createEditableField(card, index, "forms", "Grammatical forms");
      this.createEditableField(card, index, "translation", "Translation");
      this.createEditableField(card, index, "context", "Context", true);

      const confidence = Math.round(word.confidence * 100);

      card.createEl("div", {
        text: word.confidence === 0
          ? "Manual entry"
          : `AI confidence: ${confidence}%`,
        cls: "deutsch-assistant-word-confidence",
      });
    });
  }

  private async importToAnki(): Promise<void> {
    if (this.isImporting) {
      return;
    }

    const invalidWords = this.recognizedWords
      .map((word, index) => ({
        index: index + 1,
        missingLemma: !word.lemma.trim(),
        missingTranslation: !word.translation.trim(),
      }))
      .filter((item) => item.missingLemma || item.missingTranslation);

    if (invalidWords.length > 0) {
      const details = invalidWords
        .map((item) => {
          const missing = [
            item.missingLemma ? "Lemma" : "",
            item.missingTranslation ? "Translation" : "",
          ].filter(Boolean).join(" and ");

          return `Word ${item.index}: missing ${missing}`;
        })
        .join("; ");

      this.showStatus(
        `Please complete required fields before importing. ${details}`,
        "error",
      );
      return;
    }

    this.isImporting = true;
    this.showStatus("Preparing notes for Anki...", "success");

    try {
      if (this.compatibleModelNames.length === 0) {
        const modelNames = await AnkiService.getModelNames();
        const compatibleModels: string[] = [];

        for (const modelName of modelNames) {
          const fields = await AnkiService.getModelFieldNames(modelName);

          if (
            ["Front", "Forms", "Back"].every((requiredField) =>
              fields.includes(requiredField),
            )
          ) {
            compatibleModels.push(modelName);
          }
        }

        this.compatibleModelNames = compatibleModels;

        if (compatibleModels.length === 0) {
          throw new Error(
            'No Anki note type has all required fields: "Front", "Forms", and "Back".',
          );
        }

        const firstCompatibleModel = compatibleModels[0];

        if (!firstCompatibleModel) {
          throw new Error("No compatible Anki note type was found.");
        }

        if (compatibleModels.length > 1) {
          this.selectedModelName = firstCompatibleModel;
          this.renderResults();
          this.showStatus(
            "Several compatible note types were found. Choose one and click Import to Anki again.",
            "success",
          );
          return;
        }

        this.selectedModelName = firstCompatibleModel;
      }

      const modelName = this.selectedModelName || this.compatibleModelNames[0];

      if (!modelName) {
        throw new Error("An Anki note type has not been selected.");
      }

      const notes: AnkiNote[] = this.recognizedWords.map((word) => ({
        deckName: "German vocabulary",
        modelName,
        fields: {
          Front: word.lemma.trim(),
          Forms: word.forms.trim(),
          Back: word.translation.trim(),
        },
        tags: ["deutsch-assistant"],
      }));

      const result = await AnkiService.importNotes(notes);

      this.showStatus(
        `Anki import complete: ${result.added} added, ${result.failed} skipped.`,
        result.added > 0 ? "success" : "error",
      );

      console.log("Deutsch Assistant: Anki import result", result);
    } catch (error) {
      console.error("Deutsch Assistant: Anki import failed", error);

      const message =
        error instanceof Error ? error.message : "Unknown Anki error.";

      this.showStatus(`Anki import failed: ${message}`, "error");
    } finally {
      this.isImporting = false;
      const button = this.resultsContainer?.querySelector<HTMLButtonElement>(
        ".deutsch-assistant-results-header button.mod-cta",
      );

      if (button) {
        button.disabled = this.recognizedWords.length === 0;
      }
    }
  }

  private createEditableField(
    container: HTMLElement,
    wordIndex: number,
    field: Exclude<keyof RecognizedWord, "confidence">,
    label: string,
    multiline = false,
  ): void {
    const wrapper = container.createDiv({
      cls: "deutsch-assistant-editor-field",
    });

    wrapper.createEl("label", {
      text: label,
    });

    const input = multiline
      ? document.createElement("textarea")
      : document.createElement("input");

    input.className = "deutsch-assistant-editor-input";
    input.value = this.recognizedWords?.[wordIndex]?.[field] ?? "";

    if (input instanceof HTMLTextAreaElement) {
      input.rows = 3;
    }

    input.addEventListener("input", () => {
      const word = this.recognizedWords[wordIndex];

      if (word) {
        word[field] = input.value;
      }
    });

    wrapper.appendChild(input);
  }

  private setAnalyzeButtonState(
    disabled: boolean,
    text: string,
  ): void {
    if (!this.analyzeButton) {
      return;
    }

    this.analyzeButton.disabled = disabled;
    this.analyzeButton.setText(text);
  }

  private showStatus(
    message: string,
    type: "success" | "error",
  ): void {
    if (!this.statusContainer) {
      return;
    }

    this.statusContainer.empty();
    this.statusContainer.setText(message);

    this.statusContainer.removeClass(
      "deutsch-assistant-status-success",
      "deutsch-assistant-status-error",
    );

    this.statusContainer.addClass(
      `deutsch-assistant-status-${type}`,
    );
  }

  private clearPreview(): void {
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = null;
    }

    this.selectedFile = null;
    this.previewContainer?.empty();
  }

  onClose(): void {
    this.clearPreview();
    this.recognizedWords = [];
    this.compatibleModelNames = [];
    this.selectedModelName = "";
    this.contentEl.empty();
  }
}
