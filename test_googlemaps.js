// Testa a chave do Google Maps fazendo uma requisição real à API
const API_KEY = 'AIzaSyCxMCHLTfwWBiUD6-CGdUHBlaeKFJrJ_J4';

async function testGoogleMapsAPIs() {
  const tests = [
    {
      name: 'Geocoding API (endereço → coordenadas)',
      url: `https://maps.googleapis.com/maps/api/geocode/json?address=Avenida+Paulista+1000+São+Paulo&key=${API_KEY}`
    },
    {
      name: 'Distance Matrix API (distância entre pontos)',
      url: `https://maps.googleapis.com/maps/api/distancematrix/json?origins=-23.5615,-46.6560&destinations=-23.5505,-46.6333&key=${API_KEY}`
    },
    {
      name: 'Places Autocomplete API (sugestão de endereços)',
      url: `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=Rua+Augusta+São+Paulo&key=${API_KEY}`
    }
  ];

  for (const test of tests) {
    try {
      const res = await fetch(test.url);
      const data = await res.json();
      const status = data.status;

      if (status === 'OK' || status === 'ZERO_RESULTS') {
        console.log(`✅ ${test.name}: OK`);
      } else if (status === 'REQUEST_DENIED') {
        console.log(`❌ ${test.name}: NEGADO — ${data.error_message || 'API não habilitada ou chave inválida'}`);
      } else {
        console.log(`⚠️  ${test.name}: ${status} — ${data.error_message || ''}`);
      }
    } catch (e: any) {
      console.log(`❌ ${test.name}: Erro de rede — ${e.message}`);
    }
  }
}

testGoogleMapsAPIs();
