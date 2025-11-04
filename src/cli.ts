import * as readline from 'readline';
import { QaService } from './services/qa.service';
import { VectorService } from './services/vector.service';
import { GeminiService } from './services/gemini.service';
import { DataRepository } from './repositories/data.repository';
import { VectorRepository } from './repositories/vector.repository';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const askQuestion = (query: string): Promise<string> => {
  return new Promise(resolve => rl.question(query, resolve));
};

// Main CLI function
const main = async () => {
  // --- Dependency Injection ---
  const dataRepository = new DataRepository();
  const vectorRepository = new VectorRepository();
  const geminiService = new GeminiService();
  const vectorService = new VectorService(dataRepository, vectorRepository, geminiService);
  const qaService = new QaService(geminiService, vectorService);
  // --- End of Dependency Injection ---

  console.log('Initializing and loading the knowledge base...');
  await vectorService.loadIndex();
  console.log('Knowledge base loaded. You can now ask questions.');

  // Main interactive loop
  while (true) {
    const question = await askQuestion('\nAsk a question (or type "exit" to quit): ');

    if (question.toLowerCase() === 'exit') {
      break;
    }

    if (!question.trim()) {
      continue;
    }

    try {
      const { answer, sources } = await qaService.askQuestion(question);

      console.log('\n--- Answer ---');
      console.log(answer);

      if (sources.length > 0) {
        console.log('\n--- Sources ---');
        sources.forEach(c => {
          console.log(`- [${c.source}] ${c.text}`);
        });
      }
      console.log('---------------');

    } catch (error) {
      console.error('An error occurred:', error);
    }
  }

  rl.close();
  console.log('Goodbye!');
};

// Execute the main function
main().catch(console.error);
