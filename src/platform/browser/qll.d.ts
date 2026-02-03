// Allow importing .qll files as text
declare module '*.qll' {
  const content: string;
  export default content;
}

// Allow importing .qasm files as text
declare module '*.qasm' {
  const content: string;
  export default content;
}
