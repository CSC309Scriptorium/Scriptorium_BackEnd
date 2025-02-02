/*import executeCCode from "./executeC";
import executeCppCode from "./executeCpp";
import executeJavaCode from "./executeJava";
import executeJavaScriptCode from "./executeJs";
import executePythonCode from "./executePython";
import applyCors from '../../../utils/cors';
import { NextApiRequest, NextApiResponse } from 'next';


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // Apply CORS
    await applyCors(req, res);
    
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const {code, stdinInput, language } = req.body as {code: string, stdinInput: string, language: string};

  try {
    let output; 

    if(!code){
      return res.status(400).json({ message: "Code not provided" });
    }

    if(!language){
      return res.status(400).json({ message: "language not provided" });
    }

    if (language.toLowerCase() === "python") {
      output = await executePythonCode(code, stdinInput);
    } else if (language.toLowerCase() === "java") {
      output = await executeJavaCode(code, stdinInput);
    } else if (language.toLowerCase() === "c") {
      output = await executeCCode(code, stdinInput);
    } else if (language.toLowerCase() === "cpp") {
      output = await executeCppCode(code, stdinInput);
    } else if (language.toLowerCase() === "javascript") {
      output = await executeJavaScriptCode(code, stdinInput);
    } else {
      return res.status(400).json({ message: "Unsupported language" });
    }

    res.status(200).json({ output });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}
*/
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';
import applyCors from '../../../utils/cors';
import { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Apply CORS
  await applyCors(req, res);

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { code, stdinInput, language } = req.body as { code: string, stdinInput: string, language: string };

  if (!code) {
    return res.status(400).json({ message: 'Code not provided' });
  }

  if (!language) {
    return res.status(400).json({ message: 'Language not provided' });
  }

  const timestamp = Date.now();
  const folderPath = path.join(os.tmpdir(), `Code_${timestamp}`);
  fs.mkdirSync(folderPath, { recursive: true });

  // Map language to file extensions and Docker images
  const langConfig = {
    python: { filename: 'program.py', image: 'python-app' },
    java: { filename: 'Main.java', image: 'java-app' },
    c: { filename: 'program.c', image: 'c-app' },
    cpp: { filename: 'program.cpp', image: 'cpp-app' },
    javascript: { filename: 'program.js', image: 'node-app' },
    ruby: { filename: 'program.rb', image: 'ruby-app' },
    rust: { filename: 'program.rs', image: 'rust-app' }, 
    go: { filename: 'program.go', image: 'go-app' }, 
    php: { filename: 'program.php', image: 'php-app' }, 
    elixir: {filename: 'elixir.ex', image: 'elixir-app'},
    chash: {filename: 'program.c', image: 'chash-app'},
  };

  const lang = language.toLowerCase();

  if (!langConfig[lang]) {
    return res.status(400).json({ message: `Unsupported language: ${language}` });
  }

  const { filename, image } = langConfig[lang];

  const MAX_EXECUTION_TIME = 20000;


  // Write the code to a file
  const filePath = path.join(folderPath, `${filename}`);
  fs.writeFileSync(filePath, code);

  // Write stdinInput to a separate file to be used in the container
  const inputFilePath = path.join(folderPath, 'input.txt');
  if (stdinInput) {
    fs.writeFileSync(inputFilePath, stdinInput);
  }

  try {
    const dockerCommand = `
      docker run -i --rm \
      --memory="512m" \
      --cpus="1.0" \
      --memory-swap="1g" \
      --cpuset-cpus="0,1" \
      --net=none \
      -v ${folderPath}:/code \
      ${image} 
    `;
  

    // Execute the Docker command
    const child = exec(dockerCommand, { timeout: MAX_EXECUTION_TIME }, (err, stdout, stderr) => {
      // Cleanup the temporary folder after execution
      fs.rmSync(folderPath, { recursive: true, force: true });

      if (err) {
        if (err.killed) {
          return res.status(200).json({
            error: 'Process timed out. Please optimize your code.',
          });
        }
        return res.status(200).json({ stderr });
      }

      res.status(200).json({ stdout, stderr });
    });

    // Write stdinInput to the Docker container's stdin
    if (stdinInput) {
      child.stdin.write(stdinInput);
      child.stdin.end(); // End the input
    }

  } catch (error) {
    // Cleanup in case of an error
    fs.rmSync(folderPath, { recursive: true, force: true });
    res.status(500).json({ message: error.message });
  }
}
