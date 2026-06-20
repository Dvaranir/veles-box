export async function searchProviders(providers, query) {
  const settled = await Promise.allSettled(providers.map((provider) => provider.search(query)));
  const tracks = [];
  const failures = [];
  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') tracks.push(...result.value);
    else failures.push({ provider: providers[index].name, error: result.reason });
  });
  return { tracks, failures };
}
