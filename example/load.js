import http from 'k6/http';
import { sleep, check } from 'k6';

export const options = {
  vus: parseInt(__ENV.VUS || '1000', 10),
  duration: __ENV.DURATION || '1m',
  insecureSkipTLSVerify: true,
  //  stages: [
  //   { duration: '10s', target: 1000 }, // Ramp up to 1k
  //   { duration: '20s', target: 5000 }, // Ramp up to 5k
  //   { duration: '10s', target: 0 },    // Ramp down
  //  ]
};

const HOST = __ENV.HOST || '127.0.0.1';
const PORT = __ENV.PORT || '9000';
const BASE = `http://${HOST}:${PORT}`;

// SCENARIO: "pets" (default), "pet-detail", "search", "full"
const SCENARIO = __ENV.SCENARIO || 'hello';

export default function () {
  if (SCENARIO === 'pet-detail') return petDetail();
  if (SCENARIO === 'search') return searchPets();
  if (SCENARIO === 'full') return fullFlow();
  if (SCENARIO === 'pet') return petsList();
  return hello();
}


function hello() {
  const res = http.get(`${BASE}/hello`, {
    tags: { endpoint: 'hello' },
  });
  check(res, { 'res 2xx': (r) => r.status >= 200 && r.status < 300 });
  // sleep removed for max throughput
}

function petsList() {
  const res = http.get(`${BASE}/pets?limit=10&offset=0`, {
    tags: { endpoint: 'pets', type: 'list' },
  });
  check(res, {
    'pets 2xx': (r) => r.status >= 200 && r.status < 300,
  }); 
}

// GET /petBy/:id - Get single pet
function petDetail() {
  const id = `pet-${Math.floor(Math.random() * 10) + 1}`;
  const res = http.get(`${BASE}/petBy/${id}`, {
    tags: { endpoint: 'pet-detail', type: 'detail' },
  });
  check(res, {
    'pet-detail 2xx': (r) => r.status >= 200 && r.status < 300,
  }); 
}

// GET /pets/search - Search pets
function searchPets() {
  const terms = ['dog', 'cat', 'bird', 'fish', ''];
  const term = terms[Math.floor(Math.random() * terms.length)];
  const url = term 
    ? `${BASE}/pets/search?name=${encodeURIComponent(term)}`
    : `${BASE}/pets/search`;
  
  const res = http.get(url, {
    tags: { endpoint: 'search', type: 'search' },
  });
  check(res, {
    'search 2xx': (r) => r.status >= 200 && r.status < 300,
  }); 
}

// Full flow: list → detail → search
function fullFlow() {
  // List pets
  const listRes = http.get(`${BASE}/pets?limit=5`, {
    tags: { endpoint: 'pets', type: 'list' },
  });
  check(listRes, { 'list ok': (r) => r.status < 300 }); 

  // Get pet detail
  const detailRes = http.get(`${BASE}/petBy/pet-1`, {
    tags: { endpoint: 'pet-detail', type: 'detail' },
  });
  check(detailRes, { 'detail ok': (r) => r.status < 300 }); 

  // Search
  const searchRes = http.get(`${BASE}/pets/search?species=dog`, {
    tags: { endpoint: 'search', type: 'search' },
  });
  check(searchRes, { 'search ok': (r) => r.status < 300 }); 
}