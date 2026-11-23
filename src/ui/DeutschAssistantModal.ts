
import { App, Modal } from "obsidian";
import { ImageService } from "../services/ImageService";

export class DeutschAssistantModal extends Modal {
  private selectedFile: File | null = null;
  private previewUrl: string | null = null;

  private previewContainer: HTMLDivElement | null = null;
  private statusContainer: HTMLDivElement | null = null;

  constructor(app: App) {
    super(app);
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

    const footer = contentEl.createDiv({
      cls: "deutsch-assistant-footer",
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

      // Allows selecting the same file again.
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

    this.renderPreview();
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
      this.showStatus("Image removed.", "success");
    });
  }

  private clearPreview(): void {
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = null;
    }

    this.selectedFile = null;
    this.previewContainer?.empty();
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

    this.statusContainer.addClass(
      `deutsch-assistant-status-${type}`,
    );
  }

  onClose(): void {
    this.clearPreview();
    this.contentEl.empty();
  }
}
