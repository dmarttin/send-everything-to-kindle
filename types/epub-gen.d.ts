declare module "epub-gen" {
  export type EpubContent = {
    title?: string;
    data: string;
  };

  export type EpubOptions = {
    title: string;
    author?: string;
    publisher?: string;
    cover?: string;
    lang?: string;
    css?: string;
    tempDir?: string;
    version?: 2 | 3;
    customOpfTemplatePath?: string | null;
    customNcxTocTemplatePath?: string | null;
    customHtmlTocTemplatePath?: string | null;
    content: EpubContent[];
    tocTitle?: string;
  };

  export default class Epub {
    constructor(options: EpubOptions, output: string);
    promise: Promise<void>;
  }
}
