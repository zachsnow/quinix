// Allow importing .qll files as text
declare module '*.qll' {
  const content: string;
  export default content;
}
