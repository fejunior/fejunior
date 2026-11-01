#!/usr/bin/env node
// Atualiza o perfil: busca dados públicos do GitHub, regenera os SVGs em assets/generated/
// e reescreve os blocos <!-- junonn:<bloco>:start/end --> do README.
//
// Uso:
//   GITHUB_TOKEN=... node scripts/update-profile.mjs
//   node scripts/update-profile.mjs --fixture scripts/fixtures/sample.json   (prévia local, sem rede)

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GitHubClient } from './lib/github.mjs';
import { FixtureClient } from './lib/fixture-client.mjs';
import { esc, languagesCard, projectCard, relativeTime, statsCard } from './lib/render.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const config = JSON.parse(readFileSync(root + 'profile.config.json', 'utf8'));
const now = new Date();

const fixtureArg = process.argv.indexOf('--fixture');
const gh = fixtureArg > -1 ? new FixtureClient(root + process.argv[fixtureArg + 1]) : new GitHubClient(process.env.GITHUB_TOKEN);

const outDir = root + 'assets/generated/';
mkdirSync(outDir, { recursive: true });

// ---------- coleta ----------
const userRepos = (await gh.userRepos(config.user)).filter((r) => !r.private);
const orgs = [];
for (const o of config.organizations) {
  const [info, repos] = await Promise.all([gh.org(o.login), gh.orgRepos(o.login)]);
  orgs.push({ ...o, info, repos: (repos ?? []).filter((r) => !r.private) });
}
const allRepos = [...userRepos, ...orgs.flatMap((o) => o.repos)];
const byName = new Map(allRepos.map((r) => [r.full_name.toLowerCase(), r]));

const languageCache = new Map();
async function languagesOf(fullName) {
  const key = fullName.toLowerCase();
  if (!languageCache.has(key)) languageCache.set(key, (await gh.languages(fullName)) ?? {});
  return languageCache.get(key);
}

function sumLanguages(maps, exclude = []) {
  const totals = new Map();
  for (const m of maps)
    for (const [lang, bytes] of Object.entries(m))
      if (!exclude.includes(lang)) totals.set(lang, (totals.get(lang) ?? 0) + bytes);
  return [...totals].map(([name, bytes]) => ({ name, bytes })).sort((a, b) => b.bytes - a.bytes);
}

// ---------- projetos ----------
const projectBlocks = [];
for (const project of config.projects) {
  const repos = [];
  for (const name of project.repos) {
    const repo = byName.get(name.toLowerCase()) ?? (await gh.repo(name));
    if (repo && !repo.private) repos.push(repo);
    else console.warn(`[aviso] ${name} não encontrado ou não é público; ignorado no card ${project.id}.`);
  }
  const langs = sumLanguages(await Promise.all(repos.map((r) => languagesOf(r.full_name))));
  const live = {
    repoCount: repos.length,
    stars: repos.reduce((s, r) => s + r.stargazers_count, 0),
    pushedAt: repos.map((r) => r.pushed_at).sort().at(-1),
    mainLanguage: langs[0]?.name ?? repos.find((r) => r.language)?.language,
  };
  const file = `project-${project.id}.svg`;
  writeFileSync(outDir + file, projectCard(project, live, now));
  projectBlocks.push(
    `<a href="${project.url}"><img src="./assets/generated/${file}" width="49%" alt="${esc(`${project.title}: ${project.description} Tecnologias: ${project.tech.join(', ')}.`)}" /></a>`,
  );
}

// ---------- linguagens (repos públicos próprios, sem forks) ----------
const ownCode = allRepos.filter((r) => !r.fork && !r.archived && r.name !== config.user);
const langs = sumLanguages(await Promise.all(ownCode.map((r) => languagesOf(r.full_name))), config.languages.exclude).slice(0, config.languages.top);
writeFileSync(outDir + 'languages.svg', languagesCard(langs, { repoCount: ownCode.length, orgCount: orgs.length }));

// ---------- números ----------
const fmt = new Intl.DateTimeFormat('pt-BR', { timeZone: config.timezone, dateStyle: 'short', timeStyle: 'short' });
const stats = {
  publicRepos: userRepos.length,
  orgRepos: orgs.reduce((s, o) => s + o.repos.length, 0),
  updatedAt: fmt.format(now),
};
try {
  const { total, days } = await gh.contributions(config.user);
  Object.assign(stats, { contributions: total, ...streaks(days, now, config.timezone) });
} catch (err) {
  console.warn(`[aviso] contribuições indisponíveis, o card segue sem elas: ${err.message}`);
}
writeFileSync(outDir + 'stats.svg', statsCard(stats));

function streaks(days, today, timeZone) {
  const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone }).format(today);
  const sorted = days.filter((d) => d.date <= todayKey).sort((a, b) => a.date.localeCompare(b.date));
  let longest = 0;
  let run = 0;
  for (const d of sorted) {
    run = d.contributionCount > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  // Hoje ainda sem commit não quebra a sequência: conta a partir de ontem.
  let i = sorted.length - 1;
  if (sorted[i]?.date === todayKey && sorted[i].contributionCount === 0) i--;
  let current = 0;
  for (; i >= 0 && sorted[i].contributionCount > 0; i--) current++;
  return { currentStreak: current, longestStreak: longest };
}

// ---------- atividade recente ----------
const recent = allRepos
  .filter((r) => (config.recentActivity.includeForks || !r.fork) && r.name !== config.user)
  .sort((a, b) => b.pushed_at.localeCompare(a.pushed_at))
  .slice(0, config.recentActivity.limit);
const recentMd = [
  '| repositório | linguagem | quando |',
  '|---|---|---|',
  ...recent.map((r) => `| [\`${r.full_name}\`](${r.html_url}) | ${r.language ?? '—'} | ${relativeTime(r.pushed_at, now).replace('atualizado ', '')} |`),
].join('\n');

// ---------- organizações ----------
const orgsMd = [
  '<table><tr>',
  ...orgs.map(
    (o) => `<td align="center" width="${Math.floor(100 / orgs.length)}%">
<a href="https://github.com/${o.login}"><img src="https://github.com/${o.login}.png?size=120" width="56" alt="${esc(o.info?.name || o.login)}" /></a><br/>
<b>${esc(o.info?.name || o.login)}</b><br/>
<sub><code>${esc(o.role)}</code> · ${o.repos.length} ${o.repos.length === 1 ? "repo público" : "repos públicos"}</sub><br/>
<sub>${esc(o.about)}</sub>
</td>`,
  ),
  '</tr></table>',
].join('\n');

// ---------- README ----------
const readmePath = root + 'README.md';
let readme = readFileSync(readmePath, 'utf8');
const blocks = {
  projects: `<p align="center">\n${projectBlocks.join('\n')}\n</p>`,
  recent: recentMd,
  orgs: orgsMd,
};
for (const [name, content] of Object.entries(blocks)) {
  const re = new RegExp(`(<!-- junonn:${name}:start -->)[\\s\\S]*?(<!-- junonn:${name}:end -->)`);
  if (!re.test(readme)) throw new Error(`Marcador junonn:${name} não encontrado no README.`);
  readme = readme.replace(re, `$1\n${content}\n$2`);
}
writeFileSync(readmePath, readme);

console.log(`ok: ${config.projects.length} cards, ${langs.length} linguagens, ${recent.length} repos recentes, ${orgs.length} orgs.`);
