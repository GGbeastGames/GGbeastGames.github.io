declare module 'howler' {
  export class Howl {
    constructor(options: { src: string[]; volume?: number });
    play(): void;
  }
}
