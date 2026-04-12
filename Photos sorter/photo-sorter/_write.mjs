import { writeFileSync } from 'fs';
const db = `
const DB_NAME = 'photo-sorter-v1';
`;
writeFileSync('photo-sorter/db.js', db);
console.log('done');
