/** Local types for the small subset of the upstream JavaScript package we use. */
declare module "morse-pro/src/morse-pro-cw.js" {
  export interface MorseTokens { error?: boolean; }
  export default class MorseCW {
    constructor(options: { wpm: number; fwpm?: number; dictionaryOptions?: string[] });
    loadText(text: string): MorseTokens | null;
    loadMorse(morse: string): MorseTokens | null;
    displayMorse(tokens: MorseTokens | null): string;
    getTimings(tokens: MorseTokens): number[];
  }
}

declare module "morse-pro/src/morse-pro-decoder.js" {
  import MorseCW from "morse-pro/src/morse-pro-cw.js";
  export default class MorseDecoder extends MorseCW {
    message: string;
    morse: string;
    addTimings(timings: number[]): void;
    flush(): void;
  }
}

declare module "morse-pro/src/morse-pro-player-waa.js" {
  export default class MorsePlayer {
    constructor(options: {
      defaultFrequency?: number;
      volume?: number;
      endPadding?: number;
      sequenceEndCallback?: () => void;
      allStoppedCallback?: () => void;
      _audioContextModule?: {
        get(): AudioContext;
        ensureRunning(): Promise<AudioContext>;
      };
    });
    outputNode?: GainNode;
    play(sequence: { timings: number[] }): Promise<void>;
    stop(): void;
  }
}
