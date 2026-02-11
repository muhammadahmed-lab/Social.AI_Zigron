const axios = require('axios');

/**
 * researchService - Interacts with Serper.dev for real-time web data and images
 */
const webSearch = async (query) => {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) return null;

    try {
        const response = await axios.post('https://google.serper.dev/search', {
            q: query,
            num: 8
        }, {
            headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' }
        });

        const results = response.data.organic || [];
        return results.map((res, i) =>
            `Result ${i + 1}: ${res.title}\nURL: ${res.link}\nSnippet: ${res.snippet}`
        ).join('\n\n');
    } catch (error) {
        console.error('[RESEARCH] Search failed:', error.message);
        return null;
    }
};

const webImageSearch = async (query) => {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) return null;

    try {
        const response = await axios.post('https://google.serper.dev/images', {
            q: query,
            num: 5
        }, {
            headers: { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' }
        });

        const images = response.data.images || [];
        return images.map(img => ({
            title: img.title,
            imageUrl: img.imageUrl,
            link: img.link
        }));
    } catch (error) {
        console.error('[RESEARCH] Image Search failed:', error.message);
        return [];
    }
};

module.exports = { webSearch, webImageSearch };
