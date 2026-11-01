// Cliente mínimo da API do GitHub (REST + GraphQL) usado pela Action.
// Só lê dados públicos: o README do perfil é público, então nada privado entra aqui.

const API = 'https://api.github.com';

export class GitHubClient {
  #token;

  constructor(token) {
    if (!token) throw new Error('GITHUB_TOKEN ausente: a Action precisa expor o token no env.');
    this.#token = token;
  }

  #headers() {
    return {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${this.#token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'junonn-profile-updater',
    };
  }

  async rest(path) {
    const res = await fetch(`${API}/${path}`, { headers: this.#headers() });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GET ${path} -> ${res.status} ${await res.text()}`);
    return res.json();
  }

  async paginate(path) {
    const items = [];
    for (let page = 1; ; page++) {
      const sep = path.includes('?') ? '&' : '?';
      const batch = await this.rest(`${path}${sep}per_page=100&page=${page}`);
      if (!batch?.length) break;
      items.push(...batch);
      if (batch.length < 100) break;
    }
    return items;
  }

  async graphql(query, variables) {
    const res = await fetch(`${API}/graphql`, {
      method: 'POST',
      headers: { ...this.#headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    const body = await res.json();
    if (!res.ok || body.errors) throw new Error(`GraphQL: ${JSON.stringify(body.errors ?? body)}`);
    return body.data;
  }

  repo(fullName) {
    return this.rest(`repos/${fullName}`);
  }

  languages(fullName) {
    return this.rest(`repos/${fullName}/languages`);
  }

  userRepos(login) {
    return this.paginate(`users/${login}/repos?type=owner&sort=pushed`);
  }

  orgRepos(login) {
    return this.paginate(`orgs/${login}/repos?type=public&sort=pushed`);
  }

  org(login) {
    return this.rest(`orgs/${login}`);
  }

  // Contribuições do último ano. Inclui as privadas só se o perfil estiver
  // configurado para mostrá-las (Settings > Public profile > Contributions).
  async contributions(login) {
    const data = await this.graphql(
      `query($login:String!){ user(login:$login){
          contributionsCollection{
            contributionCalendar{ totalContributions weeks{ contributionDays{ date contributionCount } } }
          } } }`,
      { login },
    );
    const cal = data.user.contributionsCollection.contributionCalendar;
    const days = cal.weeks.flatMap((w) => w.contributionDays);
    return { total: cal.totalContributions, days };
  }
}
