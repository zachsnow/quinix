/**
 * Declaration for .qll file imports (used with bun's text import).
 */
declare module '*.qll' {
  const content: string;
  export default content;
}
