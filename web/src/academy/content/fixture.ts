// Node-only build/test entry. The browser fetches the same hashed JSON asset.
import questions from "./published.json";
import { initializeProblems } from "./index";
initializeProblems(questions);
export * from "./index";
