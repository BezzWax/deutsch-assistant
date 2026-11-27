
import { requestUrl } from "obsidian";

interface AnkiConnectResponse<T> {
  result: T;
  error: string | null;
}

export interface AnkiNote {
  deckName: string;
  modelName: string;
  fields: {
    Front: string;
    Forms: string;
    Back: string;
  };
  tags?: string[];
}

export class AnkiService {
  private static readonly API_URL = "http://127.0.0.1:8765";
  private static readonly API_VERSION = 6;

  private static async invoke<T>(
    action: string,
    params?: Record<string, unknown>,
  ): Promise<T> {
    let response;

    try {
      response = await requestUrl({
        url: this.API_URL,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          version: this.API_VERSION,
          ...(params ? { params } : {}),
        }),
      });
    } catch {
      throw new Error(
        "Cannot connect to Anki. Make sure Anki is running and AnkiConnect is installed.",
      );
    }

    const data = response.json as AnkiConnectResponse<T>;

    if (data.error) {
      throw new Error(`AnkiConnect error: ${data.error}`);
    }

    return data.result;
  }

  static async checkConnection(): Promise<number> {
    return this.invoke<number>("version");
  }

  static async getDeckNames(): Promise<string[]> {
    return this.invoke<string[]>("deckNames");
  }

  static async getModelNames(): Promise<string[]> {
    return this.invoke<string[]>("modelNames");
  }

  static async getModelFieldNames(
    modelName: string,
  ): Promise<string[]> {
    return this.invoke<string[]>(
      "modelFieldNames",
      { modelName },
    );
  }

  /**
   * Checks whether notes can be added without creating them.
   */
  static async canAddNotes(notes: AnkiNote[]): Promise<boolean[]> {
    return this.invoke<boolean[]>("canAddNotes", {
      notes,
    });
  }

  /**
   * Adds notes to Anki.
   */
  static async addNotes(notes: AnkiNote[]): Promise<(number | null)[]> {
    return this.invoke<(number | null)[]>("addNotes", {
      notes,
    });
  }

  /**
   * Validates notes and adds them to Anki.
   */
  static async importNotes(
    notes: AnkiNote[],
  ): Promise<{
    added: number;
    failed: number;
    noteIds: number[];
  }> {
    if (notes.length === 0) {
      throw new Error("There are no notes to import.");
    }

    const availability = await this.canAddNotes(notes);

    const validNotes = notes.filter(
      (_, index) => availability[index] === true,
    );

    if (validNotes.length === 0) {
      throw new Error(
        "No notes can be imported. They may already exist or contain invalid data.",
      );
    }

    const results = await this.addNotes(validNotes);

    const noteIds = results.filter(
      (id): id is number => typeof id === "number",
    );

    return {
      added: noteIds.length,
      failed: notes.length - noteIds.length,
      noteIds,
    };
  }
}
