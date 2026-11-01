// Cliente falso para prévia local: mesma interface do GitHubClient, lendo um JSON.
import { readFileSync } from 'node:fs';

export class FixtureClient {
  #data;

  constructor(path) {
    this.#data = JSON.parse(readFileSync(path, 'utf8'));
  }

  async userRepos() {
    return this.#data.userRepos;
  }

  async orgRepos(login) {
    return this.#data.orgRepos[login] ?? [];
  }

  async org(login) {
    return this.#data.orgs[login] ?? { login };
  }

  async repo(fullName) {
    return null;
  }

  async languages(fullName) {
    return this.#data.languages[fullName] ?? {};
  }

  async contributions() {
    if (!this.#data.contributions) throw new Error('fixture sem contribuições');
    return this.#data.contributions;
  }
}
