#!/usr/bin/env node
/**
 * fetchPokemon.js - Fetches Pokemon data from PokeAPI
 * Usage: node fetchPokemon.js <versionSlug> <pokedexFile> <totalPokemon>
 * Env: POKEMON_DATA_DIR
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

const versionSlug = process.argv[2] || "firered";
const pokedexFile = process.argv[3] || "pokemon-fire-red";
const totalPokemon = parseInt(process.argv[4] || "151");
const outputDir = process.env.POKEMON_DATA_DIR || ".";

// Determine range based on versionSlug
function getPokemonRange(slug) {
  const ranges = {
    firered: { start: 1, end: 151 },
    leafgreen: { start: 1, end: 151 },
    emerald: { start: 1, end: 386 },
    ruby: { start: 1, end: 386 },
    sapphire: { start: 1, end: 386 },
    platinum: { start: 1, end: 493 },
    diamond: { start: 1, end: 493 },
    pearl: { start: 1, end: 493 },
    heartgold: { start: 1, end: 251 },
    soulsilver: { start: 1, end: 251 },
  };
  const range = ranges[slug.toLowerCase()] || {
    start: 1,
    end: Math.min(totalPokemon, 151),
  };
  return { start: range.start, end: Math.min(range.end, totalPokemon) };
}

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`Failed to parse JSON from ${url}: ${e.message}`));
          }
        });
      })
      .on("error", reject);
  });
}

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fetchJSON(url);
    } catch (e) {
      if (i === retries - 1) throw e;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

function parseEvolutionChain(chain, targetName) {
  const result = { chain: [], details: [] };

  function traverse(node, prevDetail) {
    const name = node.species.name;
    result.chain.push(name.charAt(0).toUpperCase() + name.slice(1));

    if (prevDetail) {
      result.details.push(prevDetail);
    } else {
      result.details.push(null);
    }

    if (node.evolves_to && node.evolves_to.length > 0) {
      const evo = node.evolves_to[0];
      let detail = "";
      if (evo.evolution_details && evo.evolution_details.length > 0) {
        const d = evo.evolution_details[0];
        if (d.min_level) detail = `Lv.${d.min_level}`;
        else if (d.item) detail = d.item.name.replace(/-/g, " ");
        else if (d.trigger?.name === "trade") detail = "Trade";
        else if (d.min_happiness) detail = "Friendship";
        else detail = d.trigger?.name || "?";
      }
      traverse(evo, detail);
    }
  }

  traverse(chain);
  return result;
}

async function processPokemon(id, total) {
  const pokeData = await fetchWithRetry(
    `https://pokeapi.co/api/v2/pokemon/${id}`,
  );

  const name = pokeData.name.charAt(0).toUpperCase() + pokeData.name.slice(1);
  const sprite =
    pokeData.sprites?.other["official-artwork"].front_default ||
    pokemon.sprites.front_default;
  const types = pokeData.types.map((t) => t.type.name);

  const stats = {};
  for (const s of pokeData.stats) {
    const statName = s.stat.name.replace("-", "_");
    stats[statName] = s.base_stat;
  }

  // Evolution chain
  let evolution = { chain: [name], details: [null] };
  try {
    const speciesData = await fetchWithRetry(pokeData.species.url);
    const chainData = await fetchWithRetry(speciesData.evolution_chain.url);
    evolution = parseEvolutionChain(chainData.chain, pokeData.name);
  } catch {}

  // Encounter locations — filter by the game version being fetched, no artificial slice limit
  let locations = [];
  try {
    const encounters = await fetchWithRetry(
      `https://pokeapi.co/api/v2/pokemon/${id}/encounters`,
    );
    // Keep only encounters that appear in the target game version
    const versionEncounters = encounters.filter((e) =>
      e.version_details.some((vd) => vd.version.name === versionSlug),
    );
    // Only include locations actually in this game — no fallback to other games
    locations = versionEncounters.map((e) => {
      const vd = e.version_details.find((vd) => vd.version.name === versionSlug);
      const encounter = vd?.encounter_details?.[0];
      return {
        area: e.location_area.name.replace(/-/g, " "),
        method: encounter?.method?.name?.replace(/-/g, " ") || "walk",
        min_level: encounter?.min_level || 0,
        max_level: encounter?.max_level || 0,
      };
    });
  } catch {}

  return { id, name, sprite, types, stats, evolution, locations };
}

async function main() {
  const range = getPokemonRange(versionSlug);
  const total = range.end - range.start + 1;

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const results = [];

  for (let i = range.start; i <= range.end; i++) {
    const current = i - range.start + 1;
    process.stdout.write(`PROGRESS:${current}:${total}\n`);

    try {
      const pokemon = await processPokemon(i, total);
      results.push(pokemon);
    } catch (e) {
      console.error(`Failed to fetch pokemon ${i}: ${e.message}`);
      // Add placeholder
      results.push({
        id: i,
        name: `Pokemon-${i}`,
        sprite: null,
        types: [],
        stats: {
          hp: 0,
          attack: 0,
          defense: 0,
          special_attack: 0,
          special_defense: 0,
          speed: 0,
        },
        evolution: { chain: [], details: [] },
        locations: [],
      });
    }

    // Small delay to avoid rate limiting
    if (i % 10 === 0) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  const outputPath = path.join(outputDir, `${pokedexFile}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  process.stdout.write(`PROGRESS:${total}:${total}\n`);
  console.log(`Done! Written to ${outputPath}`);
}

main().catch((e) => {
  console.error("Fatal error:", e.message);
  process.exit(1);
});
