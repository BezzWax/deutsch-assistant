
import { App, Modal } from "obsidian";
import { ImageService } from "../services/ImageService";
import { GeminiService } from "../services/GeminiService";
import type { RecognizedWord } from "../services/GeminiService";

export class DeutschAssistantModal extends Modal {
  private readonly apiKey: string;

  private selectedFile: File | null = null;
  private previewUrl: string | null = null;
  private isAnalyzing = false;

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

      this.renderResults(words);

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

  private renderResults(words: RecognizedWord[]): void {
    if (!this.resultsContainer) {
      return;
    }

    const container = this.resultsContainer;
    container.empty();

    container.createEl("h3", {
      text: "Recognized vocabulary",
    });

    if (words.length === 0) {
      container.createEl("p", {
        text: "No vocabulary was recognized in this image.",
        cls: "deutsch-assistant-muted",
      });

      return;
    }

    words.forEach((word, index) => {
      const card = container.createDiv({
        cls: "deutsch-assistant-word-card",
      });

      const heading = card.createDiv({
        cls: "deutsch-assistant-word-heading",
      });

      heading.createEl("strong", {
        text: `${index + 1}. ${word.lemma}`,
      });

      heading.createEl("span", {
        text: word.partOfSpeech,
        cls: "deutsch-assistant-word-type",
      });

      const details = card.createDiv({
        cls: "deutsch-assistant-word-details",
      });

      this.addWordDetail(details, "Original", word.original);
      this.addWordDetail(details, "Forms", word.forms);
      this.addWordDetail(details, "Translation", word.translation);
      this.addWordDetail(details, "Context", word.context);

      const confidence = Math.round(word.confidence * 100);

      card.createEl("div", {
        text: `Confidence: ${confidence}%`,
        cls: "deutsch-assistant-word-confidence",
      });
    });
  }

  private addWordDetail(
    container: HTMLElement,
    label: string,
    value: string,
  ): void {
    const row = container.createDiv({
      cls: "deutsch-assistant-word-detail",
    });

    row.createEl("span", {
      text: `${label}:`,
      cls: "deutsch-assistant-word-detail-label",
    });

    row.createEl("span", {
      text: value || "—",
    });
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
    this.contentEl.empty();
  }
}
