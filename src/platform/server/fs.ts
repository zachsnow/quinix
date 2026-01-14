import fs from 'fs';

async function readFiles(filenames: string[]): Promise<string[]> {
  return await Promise.all(filenames.map((filename) => fs.promises.readFile(filename, 'utf-8')));
}

export { readFiles };
