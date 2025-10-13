// backend/tests/backend.test.js

const request = require('supertest');
const app = require('../server'); // Adjust the path if necessary

describe('Backend API Tests', () => {
    it('should respond with a 200 status for the root endpoint', async () => {
        const response = await request(app).get('/');
        expect(response.status).toBe(200);
    });

    // Add more tests as needed
});